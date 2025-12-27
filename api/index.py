from http.server import BaseHTTPRequestHandler
import json
import asyncio
from urllib.parse import urlparse

# Поскольку все в одном файле, импорты должны быть простыми
import database as db
import config

class handler(BaseHTTPRequestHandler):
    def do_GET(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/market':
            asyncio.run(self.get_market_listings())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': 'Not Found'}).encode())

    def do_POST(self):
        parsed_path = urlparse(self.path)
        
        if parsed_path.path == '/api/market/sell':
            asyncio.run(self.sell_item())
        elif parsed_path.path == '/api/market/buy':
            asyncio.run(self.buy_item())
        else:
            self.send_response(404)
            self.send_header('Content-type', 'application/json')
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
            self.send_header('Content-type', 'application/json')
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
                self.send_header('Content-type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
                return
            
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
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'ok': False, 'error': str(e)}).encode())
            
    async def buy_item(self):
       try:
           content_length = int(self.headers['Content-Length'])
           post_data = json.loads(self.rfile.read(content_length))
           
           listing_id = post_data.get('listingId')
           buyer_id = post_data.get('userId')

           if not all([listing_id, buyer_id]):
               self.send_response(400)
               self.send_header('Content-type', 'application/json')
               self.end_headers()
               self.wfile.write(json.dumps({'ok': False, 'error': 'Missing required fields'}).encode())
               return

           new_balance = await db.buy_item_from_market(listing_id, buyer_id)
           
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