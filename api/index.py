from flask import Flask, request, jsonify
import os
import sqlite3
import logging

app = Flask(__name__)

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

@app.route('/api/market', methods=['GET'])
def get_market():
    try:
        init_db()
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
            items = [dict(row) for row in rows] if rows else []
        return jsonify({'ok': True, 'items': items})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/market/sell', methods=['POST'])
def sell_item():
    try:
        init_db()
        data = request.get_json()
        user_id, inventory_item_id, price = data.get('userId'), data.get('inventoryItemId'), data.get('price')
        if not all([user_id, inventory_item_id, price]):
            return jsonify({'ok': False, 'error': 'Missing required fields'}), 400
        
        with get_db_connection() as conn:
            cursor = conn.execute(
                "INSERT INTO market_listings (seller_user_id, inventory_item_id, price_signals) VALUES (?, ?, ?)",
                (user_id, inventory_item_id, price)
            )
            conn.commit()
            listing_id = cursor.lastrowid
        
        if listing_id:
            return jsonify({'ok': True, 'listingId': listing_id})
        else:
            raise Exception("Failed to list item")
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/market/buy', methods=['POST'])
def buy_item():
    try:
        init_db()
        data = request.get_json()
        listing_id, buyer_id = data.get('listingId'), data.get('userId')
        if not all([listing_id, buyer_id]):
            return jsonify({'ok': False, 'error': 'Missing required fields'}), 400

        with get_db_connection() as conn:
            cursor = conn.cursor()
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
            
        return jsonify({'ok': True, 'newBalance': new_balance})
    except Exception as e:
        conn.rollback()
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
def get_user():
    user = {"ok": True, "user": {"id": "test_user", "firstName": "Test", "signals": 1000}}
    return jsonify(user)

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    inventory = {"ok": True, "inventory": [{"id": "p1", "name": "iPhone 14 Pro", "rarity": "epic", "image": "https://via.placeholder.com/120?text=iPhone14Pro"}]}
    return jsonify(inventory)