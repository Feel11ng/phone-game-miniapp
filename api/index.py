from http.server import BaseHTTPRequestHandler
import json
from urllib.parse import urlparse
import os
import sqlite3
import logging

# --- CONFIG ---
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
DATABASE_PATH = "/tmp/game_database.db"

# --- DATABASE ---
logger = logging.getLogger(__name__)

def get_db_connection():
    conn = sqlite3.connect(DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    return conn

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
            
            seller_id = listing['seller_user_id']
            price = listing['price_signals']
            inventory_item_id = listing['inventory_item_id']

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