from flask import Blueprint, render_template

data_bp = Blueprint('data_bp', __name__, template_folder='../templates')

@data_bp.route('/')
def data_page():
    return render_template('data.html')
