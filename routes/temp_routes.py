from flask import Blueprint, render_template

temp_bp = Blueprint('temp_bp', __name__, template_folder='../templates')

@temp_bp.route('/')
def temp_page():
    return render_template('temp.html')
