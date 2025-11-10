from flask import Flask, render_template
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

@app.route('/')
def index():
    return render_template('base.html')

if __name__ == '__main__':
    app.run(debug=True)
