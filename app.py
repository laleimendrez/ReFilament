from flask import Flask, render_template, redirect, url_for
from routes.temp_routes import temp_bp
from routes.mixture_routes import mixture_bp
from routes.data_routes import data_bp
from database.db_config import init_mysql

app = Flask(__name__)

# Initialize MySQL connection
mysql = init_mysql(app)
app.config['MYSQL_INSTANCE'] = mysql 

# Register Blueprints
app.register_blueprint(temp_bp, url_prefix='/temperature')
app.register_blueprint(mixture_bp, url_prefix='/mixture')
app.register_blueprint(data_bp, url_prefix='/data')

# --- FIX: Redirect the root path to the default content page (/data) ---
@app.route('/')
def index():
    # 'data_bp' is the Blueprint name, and 'data_page' is the function name in data_routes.py
    return redirect(url_for('data_bp.data_page'))

if __name__ == '__main__':
    app.run(debug=True)