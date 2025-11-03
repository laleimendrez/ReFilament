from flask import Flask, render_template
from routes.temp_routes import temp_bp
from routes.mixture_routes import mixture_bp
from routes.data_routes import data_bp

app = Flask(__name__)

# Register Blueprints (for your 3 tabs)
app.register_blueprint(temp_bp, url_prefix='/temperature')
app.register_blueprint(mixture_bp, url_prefix='/mixture')
app.register_blueprint(data_bp, url_prefix='/data')

@app.route('/')
def index():
    return render_template('base.html')

if __name__ == '__main__':
    app.run(debug=True)
