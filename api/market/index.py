from http.server import BaseHTTPRequestHandler
import json
import asyncio
from urllib.parse import urlparse
import sys
import os

from api import database as db

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