from dotenv import load_dotenv
import os
import mysql.connector
from flask import g

# Load environment variables
load_dotenv()

def get_db():
    if "db" not in g:
        try:
            g.db = mysql.connector.connect(
                host=os.getenv("DB_HOST"),
                user=os.getenv("DB_USER"),
                password=os.getenv("DB_PASS"),
                database=os.getenv("DB_NAME"),
                port=os.getenv("DB_PORT", 3306), # <--- CRUCIAL CHANGE HERE
                autocommit=True
            )
        except mysql.connector.Error as err:
            print(f"Database connection failed: {err}")
            g.db = None
    return g.db

def close_db(e=None):
    db = g.pop("db", None)
    if db is not None and db.is_connected():
        db.close()

def init_mysql(app):
    app.teardown_appcontext(close_db)
