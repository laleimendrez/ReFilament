# routes/temp_routes.py
from flask import Blueprint, render_template, jsonify
from database.db_config import get_db

temp_bp = Blueprint('temp_bp', __name__, template_folder='../templates')

@temp_bp.route('/')
def temp_page():
    """Renders the temperature monitoring page (Tab 1)."""
    return render_template('temp.html', title='Temperature Monitoring')

@temp_bp.route('/data', methods=['GET'])
def get_temperature_data():
    """API endpoint to get the latest temperature logs from MySQL."""
    db = get_db()
    
    if db is None:
        # Fallback if connection fails
        return jsonify({"error": "Database connection failed"}), 500
        
    cursor = db.cursor(dictionary=True)
    
    # Query to fetch the latest 30 logs for history, and the single latest log for status.
    # We use DESC LIMIT 30 and handle the history logic in JS.
    query = """
    SELECT
        DATE_FORMAT(timestamp_utc, '%Y-%m-%d %H:%i:%s') AS timestamp,
        system_dht_temp AS temperature,
        status
    FROM temperature_log
    ORDER BY timestamp_utc DESC
    LIMIT 30;
    """
    try:
        cursor.execute(query)
        logs = cursor.fetchall()
        
        # NOTE: We return the logs in DESCENDING order (latest first).
        return jsonify(logs)
    except Exception as e:
        print(f"Error fetching temperature data: {e}")
        return jsonify({"error": "Failed to fetch data"}), 500
    finally:
        cursor.close()

# Note: The old mock '/api/temperature' route is replaced by '/data'.