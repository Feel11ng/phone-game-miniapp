from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse
import os
import sqlite3
import logging

# --- CONFIG ---
DATABASE_PATH = "/tmp/game_database.db"

# --- DATABASE ---
logger = logging.getLogger(__name__)

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    with get_db_connection() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS users (id INTEGER PRIMARY KEY, telegram_id INTEGER UNIQUE NOT NULL, signals INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP);
            CREATE TABLE IF NOT EXISTS phones (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, brand TEXT NOT NULL, model_code TEXT, rarity TEXT DEFAULT 'Common', value INTEGER DEFAULT 10, image_filename TEXT);
            CREATE TABLE IF NOT EXISTS cases (id INTEGER PRIMARY KEY, name TEXT UNIQUE NOT NULL, price_signals INTEGER DEFAULT 10);
            CREATE TABLE IF NOT EXISTS case_contents (id INTEGER PRIMARY KEY, case_id INTEGER, phone_id INTEGER, chance REAL, FOREIGN KEY (case_id) REFERENCES cases (id), FOREIGN KEY (phone_id) REFERENCES phones (id));
            CREATE TABLE IF NOT EXISTS user_inventory (id INTEGER PRIMARY KEY, user_id INTEGER, phone_id INTEGER, acquired_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (user_id) REFERENCES users (id), FOREIGN KEY (phone_id) REFERENCES phones (id));
            CREATE TABLE IF NOT EXISTS market_listings (id INTEGER PRIMARY KEY, seller_user_id INTEGER, inventory_item_id INTEGER UNIQUE, price_signals INTEGER, listed_at DATETIME DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY (seller_user_id) REFERENCES users (id), FOREIGN KEY (inventory_item_id) REFERENCES user_inventory (id));
        """)
        conn.commit()

def get_market_listings():
    with get_db_connection() as conn:
        cursor = conn.execute("""
            SELECT
                ml.id, ml.price_signals, p.name, p.rarity, p.image_filename,
                u.telegram_id as seller_id, u.telegram_id as seller_name
            FROM market_listings ml
            JOIN users u ON ml.seller_user_id = u.id
            JOIN user_inventory ui ON ml.inventory_item_id = ui.id
            JOIN phones p ON ui.phone_id = p.id
            ORDER BY ml.listed_at DESC
        """)
        rows = cursor.fetchall()
        return [dict(row) for row in rows] if rows else []

def list_item_on_market(user_id, inventory_item_id, price):
    with get_db_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO market_listings (seller_user_id, inventory_item_id, price_signals) VALUES (?, ?, ?)",
            (user_id, inventory_item_id, price)
        )
        conn.commit()
        return cursor.lastrowid

def buy_item_from_market(listing_id, buyer_id):
    with get_db_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("BEGIN")
            cursor.execute("SELECT * FROM market_listings WHERE id = ?", (listing_id,))
            listing = cursor.fetchone()
            if not listing: raise Exception("Listing not found")
            
            seller_id, price, inventory_item_id = listing['seller_user_id'], listing['price_signals'], listing['inventory_item_id']

            cursor.execute("SELECT * FROM users WHERE id = ?", (buyer_id,))
            buyer = cursor.fetchone()
            if not buyer: raise Exception("Buyer not found")
            
            if buyer['signals'] < price: raise Exception("Not enough signals")

            new_balance = buyer['signals'] - price
            cursor.execute("UPDATE users SET signals = ? WHERE id = ?", (new_balance, buyer_id))
            cursor.execute("UPDATE users SET signals = signals + ? WHERE id = ?", (price, seller_id))
            cursor.execute("UPDATE user_inventory SET user_id = ? WHERE id = ?", (buyer_id, inventory_item_id))
            cursor.execute("DELETE FROM market_listings WHERE id = ?", (listing_id,))
            conn.commit()
            return new_balance
        except Exception as e:
            conn.rollback()
            logger.error(f"Failed to buy item: {e}")
            return None

# --- HANDLER ---
class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/market':
            self.get_market_listings_handler()
        elif parsed_path.path == '/api/user':
            self.get_user_handler()
        elif parsed_path.path.startswith('/api/inventory'):
            self.get_inventory_handler()
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    def do_POST(self):
        parsed_path = urlparse(self.path)
        if parsed_path.path == '/api/market/sell':
            self.sell_item_handler()
        elif parsed_path.path == '/api/market/buy':
            self.buy_item_handler()
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    def get_market_listings_handler(self):
        try:
            init_db()
            items = get_market_listings()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'items': items}).encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    def sell_item_handler(self):
        try:
            init_db()
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            user_id, inventory_item_id, price = post_data.get('userId'), post_data.get('inventoryItemId'), post_data.get('price')
            if not all([user_id, inventory_item_id, price]):
                self.send_response(400)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
                return
            listing_id = list_item_on_market(user_id, inventory_item_id, price)
            if listing_id:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'listingId': listing_id}).encode())
            else:
                raise Exception("Failed to list item")
        except Exception as e:
            self.send_response(500)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
            
    def buy_item_handler(self):
       try:
           init_db()
           content_length = int(self.headers['Content-Length'])
           post_data = json.loads(self.rfile.read(content_length))
           listing_id, buyer_id = post_data.get('listingId'), post_data.get('userId')
           if not all([listing_id, buyer_id]):
               self.send_response(400)
               self.send_header('Content-type', 'application/json')
               self.end_headers()
               self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
               return
           new_balance = buy_item_from_market(listing_id, buyer_id)
           if new_balance is not None:
               self.send_response(200)
               self.send_header('Content-type', 'application/json')
               self.end_headers()
               self.wfile.write(json.dumps({'ok': True, 'newBalance': new_balance}).encode())
           else:
               raise Exception("Failed to buy item")
       except Exception as e:
           self.send_response(500)
           self.send_header('Content-type', 'application/json')
           self.end_headers()
           self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    def get_user_handler(self):
        # Mock user data
        user = {"ok": True, "user": {"id": "test_user", "firstName": "Test", "signals": 1000}}
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(user).encode())

    def get_inventory_handler(self):
        # Mock inventory data
        inventory = {"ok": True, "inventory": [{"id": "p1", "name": "iPhone 14 Pro", "rarity": "epic", "image": "https://via.placeholder.com/120?text=iPhone14Pro"}]}
        self.send_response(200)
        self.send_header('Content-type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps(inventory).encode())