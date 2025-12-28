import os

class Config:
    DATABASE_PATH = os.environ.get('DATABASE_PATH', '/tmp/game_database.db')
    TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')