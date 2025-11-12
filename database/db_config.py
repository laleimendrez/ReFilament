import pymysql
from flask import Flask, g

def get_db():
    if 'db' not in g:
        g.db = pymysql.connect(
            host='localhost',
            user='root',
            password='lalei',
            database='refilament_db',
            cursorclass=pymysql.cursors.DictCursor
        )
    return g.db

def close_db(e=None):
    db = g.pop('db', None)
    if db is not None:
        db.close()

def init_mysql(app: Flask):
    app.teardown_appcontext(close_db)