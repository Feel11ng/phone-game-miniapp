# database.py
import aiosqlite
import logging
from config import DATABASE_PATH

logger = logging.getLogger(__name__)

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    signals INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Таблица с телефонами (их типами, не экземплярами)
CREATE TABLE IF NOT EXISTS phones (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL, -- 'Apple', 'Samsung', 'Google' etc.
    model_code TEXT, -- 'iPhone15,2', 'SM-S928B' etc.
    rarity TEXT DEFAULT 'Common', -- 'Common', 'Rare', 'Epic', 'Legendary'
    value INTEGER DEFAULT 10, -- Базовая стоимость в сигналах
    image_filename TEXT -- Имя файла изображения в static/images/phones/
);

-- Таблица с кейсами
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    price_signals INTEGER DEFAULT 10
);

-- Таблица с содержимым кейсов (телефон -> шанс)
CREATE TABLE IF NOT EXISTS case_contents (
    id INTEGER PRIMARY KEY,
    case_id INTEGER,
    phone_id INTEGER,
    chance REAL, -- Например, 0.5 для 50%
    FOREIGN KEY (case_id) REFERENCES cases (id),
    FOREIGN KEY (phone_id) REFERENCES phones (id)
);

-- Инвентарь пользователя (его телефоны)
CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    phone_id INTEGER,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (phone_id) REFERENCES phones (id)
);

-- Таблица с товарами на рынке
CREATE TABLE IF NOT EXISTS market_listings (
    id INTEGER PRIMARY KEY,
    seller_user_id INTEGER,
    inventory_item_id INTEGER UNIQUE,
    price_signals INTEGER,
    listed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (seller_user_id) REFERENCES users (id),
    FOREIGN KEY (inventory_item_id) REFERENCES user_inventory (id)
);
"""

async def init_db():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.executescript(CREATE_TABLES_SQL)
        await db.commit()
        logger.info(f"База данных {DATABASE_PATH} инициализирована.")

# --- Примеры функций ---
async def get_user_by_telegram_id(telegram_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        cursor = await db.execute("SELECT * FROM users WHERE telegram_id = ?", (telegram_id,))
        row = await cursor.fetchone()
        if row:
            return dict(zip([d[0] for d in cursor.description], row))
        return None

async def create_user_if_not_exists(telegram_id):
    existing_user = await get_user_by_telegram_id(telegram_id)
    if existing_user:
        return existing_user

    async with aiosqlite.connect(DATABASE_PATH) as db:
        try:
            await db.execute(
                "INSERT INTO users (telegram_id) VALUES (?)",
                (telegram_id,)
            )
            await db.commit()
        except Exception:
            logger.exception("Не удалось создать пользователя %s", telegram_id)
            return None

    user = await get_user_by_telegram_id(telegram_id)
    if not user:
        logger.error("Пользователь %s не появился в БД после вставки", telegram_id)
        return None

    logger.info("Новый пользователь создан: %s", telegram_id)
    await give_starting_items(user)
    return user

async def give_starting_items(user):
    if not user:
        logger.warning("Нельзя выдать стартовые предметы: пользователь не найден")
        return

    phone_name = "Samsung Galaxy A01"
    async with aiosqlite.connect(DATABASE_PATH) as db:
        try:
            cursor = await db.execute("SELECT id FROM phones WHERE name = ?", (phone_name,))
            phone_row = await cursor.fetchone()
            if not phone_row:
                logger.warning("Стартовый телефон %s не найден", phone_name)
                return

            phone_id = phone_row[0]
            await db.execute(
                "INSERT INTO user_inventory (user_id, phone_id) VALUES (?, ?)",
                (user['id'], phone_id)
            )
            await db.execute(
                "UPDATE users SET signals = signals + 50 WHERE telegram_id = ?",
                (user['telegram_id'],)
            )
            await db.commit()
            logger.info("Стартовые предметы выданы пользователю %s", user['telegram_id'])
        except Exception:
            logger.exception("Не удалось выдать стартовые предметы пользователю %s", user['telegram_id'])

# --- Функции для рынка ---
async def get_market_listings():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT
                ml.id,
                ml.price_signals,
                p.name,
                p.rarity,
                p.image_filename,
                u.telegram_id as seller_id,
                u_profile.first_name as seller_name
            FROM market_listings ml
            JOIN users u ON ml.seller_user_id = u.id
            JOIN user_inventory ui ON ml.inventory_item_id = ui.id
            JOIN phones p ON ui.phone_id = p.id
            LEFT JOIN users u_profile ON u.telegram_id = u_profile.telegram_id
            ORDER BY ml.listed_at DESC
        """)
        rows = await cursor.fetchall()
        return [dict(row) for row in rows] if rows else []

async def list_item_on_market(user_id, inventory_item_id, price):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        # TODO: Проверить, что предмет принадлежит пользователю и не выставлен на продажу
        cursor = await db.execute(
            "INSERT INTO market_listings (seller_user_id, inventory_item_id, price_signals) VALUES (?, ?, ?)",
            (user_id, inventory_item_id, price)
        )
        await db.commit()
        return cursor.lastrowid

async def remove_item_from_market(listing_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        await db.execute("DELETE FROM market_listings WHERE id = ?", (listing_id,))
        await db.commit()
        
async def get_listing_by_id(listing_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("SELECT * FROM market_listings WHERE id = ?", (listing_id,))
        row = await cursor.fetchone()
        return dict(row) if row else None

async def buy_item_from_market(listing_id, buyer_id):
   async with aiosqlite.connect(DATABASE_PATH) as db:
       async with db.cursor() as cursor:
           await cursor.execute("BEGIN")
           try:
               # Получаем информацию о лоте
               await cursor.execute("SELECT * FROM market_listings WHERE id = ?", (listing_id,))
               listing = await cursor.fetchone()
               if not listing:
                   raise Exception("Listing not found")
               
               listing = dict(zip([d[0] for d in cursor.description], listing))
               seller_id = listing['seller_user_id']
               price = listing['price_signals']
               inventory_item_id = listing['inventory_item_id']

               # Получаем информацию о покупателе
               await cursor.execute("SELECT * FROM users WHERE id = ?", (buyer_id,))
               buyer = await cursor.fetchone()
               if not buyer:
                   raise Exception("Buyer not found")

               buyer = dict(zip([d[0] for d in cursor.description], buyer))
               
               if buyer['signals'] < price:
                   raise Exception("Not enough signals")

               # Обновляем баланс покупателя
               new_balance = buyer['signals'] - price
               await cursor.execute("UPDATE users SET signals = ? WHERE id = ?", (new_balance, buyer_id))

               # Обновляем баланс продавца
               await cursor.execute("UPDATE users SET signals = signals + ? WHERE id = ?", (price, seller_id))
               
               # Перемещаем предмет в инвентарь покупателя
               await cursor.execute("UPDATE user_inventory SET user_id = ? WHERE id = ?", (buyer_id, inventory_item_id))

               # Удаляем лот с рынка
               await cursor.execute("DELETE FROM market_listings WHERE id = ?", (listing_id,))

               await db.commit()
               return new_balance
           except Exception as e:
               await db.rollback()
               logger.error(f"Failed to buy item: {e}")
               return None

async def get_user_inventory(user_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT
                ui.id,
                p.name,
                p.rarity,
                p.image_filename
            FROM user_inventory ui
            JOIN phones p ON ui.phone_id = p.id
            WHERE ui.user_id = ?
        """, (user_id,))
        rows = await cursor.fetchall()
        return [dict(row) for row in rows]
        
# --- Функции для заполнения начальных данных (только один раз!) ---
async def populate_initial_data():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        try:
            phones = [
                ("Samsung Galaxy A01", "Samsung", "SM-A015F", "Common", 10, "galaxy_a01.jpg"),
                ("iPhone 15 Pro Max", "Apple", "iPhone16,2", "Legendary", 1000, "iphone_15_pro_max.jpg"),
                ("Google Pixel 8 Pro", "Google", "G3JH8", "Epic", 500, "pixel_8_pro.jpg"),
            ]
            for phone in phones:
                await db.execute(
                    """INSERT OR IGNORE INTO phones (name, brand, model_code, rarity, value, image_filename)
                       VALUES (?, ?, ?, ?, ?, ?)""",
                    phone
                )

            await db.execute(
                """INSERT OR IGNORE INTO cases (name, price_signals)
                   VALUES (?, ?)""",
                ("Базовый кейс", 50)
            )

            async def _fetch_id(table, name):
                cursor = await db.execute(f"SELECT id FROM {table} WHERE name = ?", (name,))
                row = await cursor.fetchone()
                if not row:
                    logger.error("Запись %s не найдена в %s", name, table)
                return row[0] if row else None

            galaxy_a01_id = await _fetch_id("phones", "Samsung Galaxy A01")
            pixel_8_pro_id = await _fetch_id("phones", "Google Pixel 8 Pro")
            basic_case_id = await _fetch_id("cases", "Базовый кейс")

            if None in (galaxy_a01_id, pixel_8_pro_id, basic_case_id):
                logger.warning("Не удалось добавить содержимое кейсов из-за отсутствующих данных")
                await db.commit()
                return

            await db.execute(
                """INSERT OR IGNORE INTO case_contents (case_id, phone_id, chance)
                   VALUES (?, ?, ?)""",
                (basic_case_id, galaxy_a01_id, 0.8)
            )
            await db.execute(
                """INSERT OR IGNORE INTO case_contents (case_id, phone_id, chance)
                   VALUES (?, ?, ?)""",
                (basic_case_id, pixel_8_pro_id, 0.05)
            )
            await db.commit()
            logger.info("Начальные данные (телефоны, кейсы) добавлены.")
        except Exception:
            logger.exception("Ошибка при заполнении начальных данных")