from flask import Blueprint, render_template

mixture_bp = Blueprint('mixture_bp', __name__, template_folder='../templates')

@mixture_bp.route('/')
def mixture_page():
    return render_template('mixture.html')
