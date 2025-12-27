from http.server import BaseHTTPRequestHandler
import json
import asyncio
from urllib.parse import urlparse
import os
import aiosqlite
import logging
# --- CONFIG ---
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DATABASE_PATH = "/tmp/game_database.db"

# --- DATABASE ---
logger = logging.getLogger(__name__)

CREATE_TABLES_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    telegram_id INTEGER UNIQUE NOT NULL,
    signals INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS phones (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    brand TEXT NOT NULL,
    model_code TEXT,
    rarity TEXT DEFAULT 'Common',
    value INTEGER DEFAULT 10,
    image_filename TEXT
);
CREATE TABLE IF NOT EXISTS cases (
    id INTEGER PRIMARY KEY,
    name TEXT UNIQUE NOT NULL,
    price_signals INTEGER DEFAULT 10
);
CREATE TABLE IF NOT EXISTS case_contents (
    id INTEGER PRIMARY KEY,
    case_id INTEGER,
    phone_id INTEGER,
    chance REAL,
    FOREIGN KEY (case_id) REFERENCES cases (id),
    FOREIGN KEY (phone_id) REFERENCES phones (id)
);
CREATE TABLE IF NOT EXISTS user_inventory (
    id INTEGER PRIMARY KEY,
    user_id INTEGER,
    phone_id INTEGER,
    acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users (id),
    FOREIGN KEY (phone_id) REFERENCES phones (id)
);
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

async def get_market_listings():
    async with aiosqlite.connect(DATABASE_PATH) as db:
        db.row_factory = aiosqlite.Row
        cursor = await db.execute("""
            SELECT
                ml.id, ml.price_signals, p.name, p.rarity, p.image_filename,
                u.telegram_id as seller_id, u_profile.first_name as seller_name
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
        cursor = await db.execute(
            "INSERT INTO market_listings (seller_user_id, inventory_item_id, price_signals) VALUES (?, ?, ?)",
            (user_id, inventory_item_id, price)
        )
        await db.commit()
        return cursor.lastrowid

async def buy_item_from_market(listing_id, buyer_id):
    async with aiosqlite.connect(DATABASE_PATH) as db:
        async with db.cursor() as cursor:
            await cursor.execute("BEGIN")
            try:
                await cursor.execute("SELECT * FROM market_listings WHERE id = ?", (listing_id,))
                listing = await cursor.fetchone()
                if not listing: raise Exception("Listing not found")
                
                listing = dict(zip([d[0] for d in cursor.description], listing))
                seller_id = listing['seller_user_id']
                price = listing['price_signals']
                inventory_item_id = listing['inventory_item_id']

                await cursor.execute("SELECT * FROM users WHERE id = ?", (buyer_id,))
                buyer = await cursor.fetchone()
                if not buyer: raise Exception("Buyer not found")
                buyer = dict(zip([d[0] for d in cursor.description], buyer))
                
                if buyer['signals'] < price: raise Exception("Not enough signals")

                new_balance = buyer['signals'] - price
                await cursor.execute("UPDATE users SET signals = ? WHERE id = ?", (new_balance, buyer_id))
                await cursor.execute("UPDATE users SET signals = signals + ? WHERE id = ?", (price, seller_id))
                await cursor.execute("UPDATE user_inventory SET user_id = ? WHERE id = ?", (buyer_id, inventory_item_id))
                await cursor.execute("DELETE FROM market_listings WHERE id = ?", (listing_id,))
                await db.commit()
                return new_balance
            except Exception as e:
                await db.rollback()
                logger.error(f"Failed to buy item: {e}")
                return None

# --- HANDLER ---
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/market':
            asyncio.run(self.get_market_listings_handler())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/market/sell':
            asyncio.run(self.sell_item_handler())
        elif parsed_path.path == '/api/market/buy':
            asyncio.run(self.buy_item_handler())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    async def get_market_listings_handler(self):
        try:
            items = await get_market_listings()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'items': items}).encode())
        except Exception as e:
            print(e)
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    async def sell_item_handler(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            user_id, inventory_item_id, price = post_data.get('userId'), post_data.get('inventoryItemId'), post_data.get('price')
            if not all([user_id, inventory_item_id, price]):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
                return
            listing_id = await list_item_on_market(user_id, inventory_item_id, price)
            if listing_id:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'listingId': listing_id}).encode())
            else:
                raise Exception("Failed to list item")
        except Exception as e:
            print(e)
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
            
    async def buy_item_handler(self):
       try:
           content_length = int(self.headers['Content-Length'])
           post_data = json.loads(self.rfile.read(content_length))
           listing_id, buyer_id = post_data.get('listingId'), post_data.get('userId')
           if not all([listing_id, buyer_id]):
               self.send_response(400)
               self.send_header('Content-type', 'application/json')
               self.end_headers()
               self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
               return
           new_balance = await buy_item_from_market(listing_id, buyer_id)
           if new_balance is not None:
               self.send_response(200)
               self.send_header('Content-type', 'application/json')
               self.end_headers()
               self.wfile.write(json.dumps({'ok': True, 'newBalance': new_balance}).encode())
           else:
               raise Exception("Failed to buy item")
       except Exception as e:
           print(e)
           self.send_response(500)
           self.send_header('Content-type', 'application/json')
           self.end_headers()
           self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())