# api/market.py
from http.server import BaseHTTPRequestHandler
import json
import asyncio
from urllib.parse import urlparse, parse_qs
import sys
import os

# Добавляем корневую директорию проекта в sys.path
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

import database as db
from config import DATABASE_PATH

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/market':
            asyncio.run(self.get_market_listings())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/market/sell':
            asyncio.run(self.sell_item())
        elif parsed_path.path == '/api/market/buy':
            asyncio.run(self.buy_item())
        elif parsed_path.path == '/api/market/unlist':
            asyncio.run(self.unlist_item())
        else:
            self.send_response(404)
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    async def get_market_listings(self):
        try:
            items = await db.get_market_listings()
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': True, 'items': items}).encode())
        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())

    async def sell_item(self):
        try:
            content_length = int(self.headers['Content-Length'])
            post_data = json.loads(self.rfile.read(content_length))
            
            user_id = post_data.get('userId')
            inventory_item_id = post_data.get('inventoryItemId')
            price = post_data.get('price')

            if not all([user_id, inventory_item_id, price]):
                self.send_response(400)
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
                return

            # TODO: Проверить, что inventory_item_id принадлежит user_id
            
            listing_id = await db.list_item_on_market(user_id, inventory_item_id, price)
            
            if listing_id:
                self.send_response(200)
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': True, 'listingId': listing_id}).encode())
            else:
                raise Exception("Failed to list item")

        except Exception as e:
            self.send_response(500)
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
            
    async def buy_item(self):
        # Логика покупки товара
        pass

    async def unlist_item(self):
        # Логика снятия товара с продажи
        pass
