from flask import Flask, render_template, redirect, url_for
from routes.temp_routes import temp_bp
from routes.mixture_routes import mixture_bp
from routes.data_routes import data_bp
from database.db_config import init_mysql
from routes.esp32_routes import esp32_bp

    # ADD THIS


app = Flask(__name__)

# Initialize MySQL connection
from database.db_config import init_mysql
init_mysql(app)

# Register Blueprints
app.register_blueprint(temp_bp, url_prefix='/temperature')
app.register_blueprint(mixture_bp, url_prefix='/mixture')
app.register_blueprint(data_bp, url_prefix='/data')
app.register_blueprint(esp32_bp, url_prefix='/esp32')    



# --- FIX: Redirect the root path to the default content page (/data) ---
@app.route('/')
def index():
    # 'data_bp' is the Blueprint name, and 'data_page' is the function name in data_routes.py
    return redirect(url_for('data_bp.data_page'))

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5001)  # host='0.0.0.0' is the key change