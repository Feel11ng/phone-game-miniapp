# config.py
import os
from dotenv import load_dotenv # pip install python-dotenv

load_dotenv()

TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TELEGRAM_BOT_TOKEN:
    raise ValueError("TELEGRAM_BOT_TOKEN не найден в .env файле")

# Путь к базе данных (можно переопределить через .env)
DATABASE_PATH = os.getenv("DATABASE_PATH", "game_database.db")

# Путь к папке со статическими файлами для Mini App
STATIC_FOLDER_PATH = "static"
MINI_APP_URL = "https://phone-game-miniapp.vercel.app" # Замените на ваш URL позже

# Пути к изображениям
PHONE_IMAGES_DIR = os.path.join(STATIC_FOLDER_PATH, "images", "phones")