from http.server import BaseHTTPRequestHandler
import json
import asyncio
import sys
import os

from ... import database as db

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
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
            
            listing_id = asyncio.run(db.list_item_on_market(user_id, inventory_item_id, price))
            
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