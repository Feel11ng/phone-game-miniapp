from flask import Flask, request, jsonify, send_from_directory
import os
import sys

# Добавляем текущую директорию в путь
sys.path.insert(0, os.path.dirname(__file__))

from utils.database import GameDatabase
from utils.config import Config

app = Flask(__name__, static_folder='public', static_url_path='')

# Инициализация БД
try:
    db = GameDatabase()
    print("Database initialized successfully!", flush=True)
except Exception as e:
    print(f"Database initialization error: {e}", flush=True)
    db = None

@app.route('/api/market', methods=['GET'])
def get_market():
    if not db:
        return jsonify({"error": "Database not initialized"}), 500
    
    try:
        items = db.get_market_listings()
        return jsonify({'ok': True, 'items': items})
    except Exception as e:
        print(f"Error in /api/market: {e}", flush=True)
        return jsonify({"error": str(e)}), 500

@app.route('/api/market/sell', methods=['POST'])
def sell_item():
    if not db:
        return jsonify({"error": "Database not initialized"}), 500
    
    try:
        data = request.get_json()
        user_id, inventory_item_id, price = data.get('userId'), data.get('inventoryItemId'), data.get('price')
        if not all([user_id, inventory_item_id, price]):
            return jsonify({'ok': False, 'error': 'Missing required fields'}), 400
        
        listing_id = db.list_item_on_market(user_id, inventory_item_id, price)
        
        if listing_id:
            return jsonify({'ok': True, 'listingId': listing_id})
        else:
            raise Exception("Failed to list item")
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/market/buy', methods=['POST'])
def buy_item():
    if not db:
        return jsonify({"error": "Database not initialized"}), 500
    try:
        data = request.get_json()
        listing_id, buyer_id = data.get('listingId'), data.get('userId')
        if not all([listing_id, buyer_id]):
            return jsonify({'ok': False, 'error': 'Missing required fields'}), 400

        new_balance = db.buy_item_from_market(listing_id, buyer_id)
            
        return jsonify({'ok': True, 'newBalance': new_balance})
    except Exception as e:
        return jsonify({'ok': False, 'error': str(e)}), 500

@app.route('/api/user', methods=['GET'])
def get_user():
    # Это все еще мок-данные, нужно будет реализовать реальную логику
    user = {"ok": True, "user": {"id": "test_user", "firstName": "Test", "signals": 1000}}
    return jsonify(user)

@app.route('/api/inventory', methods=['GET'])
def get_inventory():
    # Это все еще мок-данные, нужно будет реализовать реальную логику
    inventory = {"ok": True, "inventory": [{"id": "p1", "name": "iPhone 14 Pro", "rarity": "epic", "image": "https://via.placeholder.com/120?text=iPhone14Pro"}]}
    return jsonify(inventory)

# Обслуживание статических файлов
@app.route('/')
def serve_index():
    return send_from_directory(app.static_folder, 'index.html')

@app.route('/<path:path>')
def serve_static(path):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    app.run(debug=True)