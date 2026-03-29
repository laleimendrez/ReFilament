# routes/temp_routes.py
from flask import Blueprint, render_template, jsonify, make_response
from database.db_config import get_db
from flask import request
import csv
import io

temp_bp = Blueprint('temp_bp', __name__, template_folder='../templates')

@temp_bp.route('/')
def temp_page():
    """Renders the temperature monitoring page (Tab 3)."""
    return render_template('temp.html', title='Temperature Monitoring')

@temp_bp.route('/data', methods=['GET'])
def get_temperature_data():
    """API endpoint to get the latest temperature logs from MySQL."""
    db = get_db()
    
    if db is None:
        return jsonify({"error": "Database connection failed"}), 500
        
    cursor = db.cursor(dictionary=True)
    
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
        return jsonify(logs)
    except Exception as e:
        print(f"Error fetching temperature data: {e}")
        return jsonify({"error": "Failed to fetch data"}), 500
    finally:
        cursor.close()

@temp_bp.route('/api/temperature', methods=['POST'])
def receive_temperature():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        data = request.get_json()
        temperature = data.get("temperature")
        status = data.get("status", "NORMAL")

        if temperature is None:
            return jsonify({"error": "Temperature is required"}), 400

        insert_query = """
        INSERT INTO temperature_log (system_dht_temp, status)
        VALUES (%s, %s);
        """
        cursor.execute(insert_query, (temperature, status))
        return jsonify({"status": "success"}), 201

    except Exception as e:
        print("Error inserting temperature:", e)
        return jsonify({"error": "Server error"}), 500

    finally:
        cursor.close()


@temp_bp.route('/download', methods=['GET'])
def download_temp_logs():
    """Returns a CSV file of temperature_log entries."""
    db = get_db()
    if db is None:
        return jsonify({"error": "Database connection failed"}), 500

    start    = request.args.get('start')
    end      = request.args.get('end')
    all_flag = request.args.get('all', 'false').lower() == 'true'

    cursor = db.cursor(dictionary=True)
    try:
        query = """
        SELECT
            temp_log_id     AS id,
            timestamp_utc   AS timestamp,
            system_dht_temp AS temperature,
            status
        FROM temperature_log
        """
        params = ()

        if not all_flag:
            conditions = []
            if start:
                conditions.append("DATE(timestamp_utc) >= %s")
                params = params + (start,)
            if end:
                conditions.append("DATE(timestamp_utc) <= %s")
                params = params + (end,)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY timestamp_utc ASC;"

        cursor.execute(query, params)
        rows = cursor.fetchall()

        if not rows:
            return jsonify({"error": "No data found in the selected date range"}), 404

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['id', 'timestamp', 'temperature_c', 'status'])

        for r in rows:
            ts = r.get('timestamp')
            ts_str = ts.strftime('%Y-%m-%d %H:%M:%S') if hasattr(ts, 'strftime') else str(ts)
            writer.writerow([
                r.get('id'),
                ts_str,
                r.get('temperature'),
                r.get('status'),
            ])

        csv_data = output.getvalue()
        output.close()

        # Build filename
        if all_flag:
            fname_date = 'all'
        elif start and end:
            fname_date = f"{start}_to_{end}"
        elif start:
            fname_date = f"from_{start}"
        elif end:
            fname_date = f"to_{end}"
        else:
            fname_date = 'all'

        filename = f"temperature_logs_{fname_date}.csv"

        response = make_response(csv_data)
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        return response

    except Exception as e:
        print("Error generating temperature CSV:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()