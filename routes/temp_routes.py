from flask import Blueprint, render_template, jsonify
import random  # For demo purposes - replace with actual temperature reading logic

temp_bp = Blueprint('temp_bp', __name__, template_folder='../templates')

@temp_bp.route('/')
def temp_page():
    return render_template('temp.html')

@temp_bp.route('/api/temperature')
def get_temperature():
    # Demo: Generate a random temperature between -40 and 80
    # Replace this with your actual temperature reading logic
    temperature = round(random.uniform(-40, 80), 1)
    return jsonify({'temperature': temperature})
