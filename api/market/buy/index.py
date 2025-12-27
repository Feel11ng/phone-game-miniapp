from http.server import BaseHTTPRequestHandler
import json
import asyncio
import sys
import os

from api import database as db

class handler(BaseHTTPRequestHandler):
    def do_POST(self):
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

            new_balance = asyncio.run(db.buy_item_from_market(listing_id, buyer_id))
            
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