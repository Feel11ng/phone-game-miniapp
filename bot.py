# bot.py
import asyncio
import logging
from telegram.ext import Application, CommandHandler, CallbackQueryHandler, ContextTypes
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
import nest_asyncio # Если используете jupyter
from config import TELEGRAM_BOT_TOKEN, MINI_APP_URL # Импортируем URL
import database as db

# nest_asyncio.apply() # Раскомментируйте, если нужно

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# --- Обработчики команд ---
async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    user = update.effective_user
    await db.create_user_if_not_exists(user.id)
    keyboard = [
        [InlineKeyboardButton("Мой инвентарь", callback_data='inventory')],
        [InlineKeyboardButton("Магазин (Кейсы)", callback_data='shop_cases')],
        [InlineKeyboardButton("Рынок", callback_data='market')],
        [InlineKeyboardButton("Mini App", web_app={'url': MINI_APP_URL})], # Используем URL из config
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text(
        f'Привет, {user.first_name}! Добро пожаловать в мир Phone Tycoon!',
        reply_markup=reply_markup
    )

async def inventory(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user_id = query.from_user.id
    user_info = await db.get_user_by_telegram_id(user_id)
    if not user_info:
        await query.edit_message_text(
            text="Сначала зарегистрируйтесь с помощью /start, чтобы увидеть инвентарь."
        )
        return
    # TODO: Получить список телефонов из инвентаря пользователя
    # Пока просто сообщение
    await query.edit_message_text(
        text=f"Ваш инвентарь:\nСигналов: {user_info['signals']}\n\n(Здесь будут ваши телефоны)"
    )

async def shop_cases(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    # TODO: Отправить список кейсов
    await query.edit_message_text(text="Магазин кейсов.\n\n(Здесь будет выбор кейсов для покупки)")

async def market(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    # TODO: Отправить список товаров на рынке
    await query.edit_message_text(text="Рынок телефонов.\n\n(Здесь будет торговля)")

# --- Запуск бота ---
def main():
    # Применяем nest_asyncio, чтобы избежать ошибки RuntimeError
    nest_asyncio.apply()
    
    application = Application.builder().token(TELEGRAM_BOT_TOKEN).build()

    application.add_handler(CommandHandler('start', start))
    application.add_handler(CallbackQueryHandler(inventory, pattern='^inventory$'))
    application.add_handler(CallbackQueryHandler(shop_cases, pattern='^shop_cases$'))
    application.add_handler(CallbackQueryHandler(market, pattern='^market$'))

    logger.info("Бот запущен...")
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    # Инициализируем БД
    asyncio.run(db.init_db())
    # Заполняем начальные данные (в реальной системе это делается отдельно)
    asyncio.run(db.populate_initial_data())
    main()