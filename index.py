from flask import Flask, jsonify

app = Flask(__name__)

@app.route('/')
def home():
    return jsonify({"status": "working", "message": "Flask is running!"})

@app.route('/api/test')
def test():
    return jsonify({"message": "Test successful!"})

@app.route('/api/market')
def market():
    return jsonify({
        "phones": [
            {"id": 1, "model": "iPhone 14", "price": 50000},
            {"id": 2, "model": "Samsung S23", "price": 45000}
        ]
    })
