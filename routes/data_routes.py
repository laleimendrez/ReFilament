# routes/data_routes.py

from flask import Blueprint, render_template, jsonify, request
from database.db_config import get_db
import json # Used to parse JSON data fields from MySQL

data_bp = Blueprint('data_bp', __name__, template_folder='../templates')

# In routes/data_routes.py

def get_db_summary_data(cursor):
    """Fetches classification summary data (Total Records, Breakdown, Avg Confidence)."""
    
    # 1. Total Records and 24H Activity
    total_query = "SELECT COUNT(*) AS total FROM classification_log;"
    activity_query = """
    SELECT COUNT(*) AS activity_24h 
    FROM classification_log
    WHERE timestamp_utc >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR);
    """
    
    # Execute queries and safely get results
    cursor.execute(total_query)
    total_records = cursor.fetchone().get('total', 0)
    
    cursor.execute(activity_query)
    activity_24h = cursor.fetchone().get('activity_24h', 0)

    # 2. Classification Breakdown (PET, HDPE, PP percentages)
    breakdown_query = """
    SELECT pt.material_code, COUNT(cl.log_id) AS count
    FROM classification_log cl
    JOIN plastic_type pt ON cl.plastic_type_id = pt.id
    WHERE pt.material_code IN ('PET', 'HDPE', 'PP')
    GROUP BY pt.material_code;
    """
    cursor.execute(breakdown_query)
    breakdown_raw = cursor.fetchall()
    
    breakdown = {item['material_code']: item['count'] for item in breakdown_raw}
    classified_total = sum(breakdown.values())

    pet_percent = 0.0
    hdpe_percent = 0.0
    pp_percent = 0.0
    avg_confidence = 0.0

    if classified_total > 0:
        pet_count = breakdown.get('PET', 0)
        hdpe_count = breakdown.get('HDPE', 0)
        pp_count = breakdown.get('PP', 0)

        # Calculate percentages
        pet_percent = round((pet_count / classified_total) * 100, 1)
        hdpe_percent = round((hdpe_count / classified_total) * 100, 1)
        pp_percent = round((pp_count / classified_total) * 100, 1)

        # Ensure percentages sum to 100 (handles rounding errors)
        current_sum = pet_percent + hdpe_percent + pp_percent
        if current_sum != 100.0:
            pp_percent = round(pp_percent + (100.0 - current_sum), 1)

    # 3. Average Confidence
    avg_conf_query = "SELECT AVG(confidence_score) AS avg_confidence FROM classification_log;"
    cursor.execute(avg_conf_query)
    # The result may be a row with 'avg_confidence': None if no logs exist.
    avg_row = cursor.fetchone()
    if avg_row and avg_row.get('avg_confidence') is not None:
        # Convert from 0.xx to percentage, round to 1 decimal
        avg_confidence = round(avg_row['avg_confidence'] * 100, 1)
    
    return {
        "total_records": total_records,
        "pet": pet_percent,
        "hdpe": hdpe_percent,
        "pp": pp_percent,
        "activity_24h": activity_24h,
        "avg_confidence": avg_confidence
    }

def get_db_material_log(cursor):
    """Fetches the main classification log data for the table."""
    # Note: We join with plastic_type to get the material_code and use the
    # system_dht_temp from the closest timestamp in the temperature_log table.
    
    # For simplicity, we are skipping the temperature join here to focus on the main log.
    # To join temperature, you would need a complex subquery or trigger to map temp_log_id.
    # We will fetch only the main classification log data and structure it for the HTML.
    
    log_query = """
    SELECT
        cl.log_id AS id,
        DATE_FORMAT(cl.timestamp_utc, '%Y-%m-%d %H:%i:%s') AS timestamp,
        pt.material_code AS material,
        pt.chemical_name,
        cl.confidence_score
    FROM classification_log cl
    JOIN plastic_type pt ON cl.plastic_type_id = pt.id
    ORDER BY cl.log_id DESC
    LIMIT 100;
    """
    cursor.execute(log_query)
    logs = cursor.fetchall()
    
    # Format the confidence score for the frontend
    for log in logs:
        log['confidence'] = f"{round(log['confidence_score'] * 100, 1)}%"
        # The chemical name is now available via the JOIN
        # log['chemical_name'] = '...fetched from pt.chemical_name' 
        # log['temp'] = '26.0°C' # Removed temperature column from the database query for simplicity
        del log['confidence_score'] # Clean up the output
    
    return logs


@data_bp.route('/')
def data_page():
    """Renders the classified plastics history page (Tab 3) with dynamic data."""
    db = get_db()
    
    if db is None:
        # Fallback in case of DB connection failure
        return render_template('data.html', 
                               summary={"total_records": 0, "pet": 0, "hdpe": 0, "pp": 0, "activity_24h": 0, "avg_confidence": 0.0}, 
                               materials=[], 
                               db_error="Database connection failed.")

    cursor = db.cursor(dictionary=True)
    try:
        # Fetch Summary Data
        summary = get_db_summary_data(cursor)
        
        # Fetch Log Data
        materials = get_db_material_log(cursor)

        # Since the 'chemical name' is now fetched from the database, 
        # we need to remove the Python logic in data.html (see notes below).
        
        return render_template('data.html', summary=summary, materials=materials)
        
    except Exception as e:
        print(f"Error fetching data for data_page: {e}")
        return render_template('data.html', 
                               summary={}, 
                               materials=[], 
                               db_error=f"Error executing query: {e}")
    finally:
        cursor.close()

# --- API Endpoint for the Modal (Unchanged from previous plan, but included for completeness) ---

@data_bp.route('/spectra/<int:log_id>', methods=['GET'])
def get_spectra(log_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)

    # First fetch the scanned_spectra_id from classification_log
    lookup_query = "SELECT scanned_spectra_id FROM classification_log WHERE log_id = %s;"
    try:
        cursor.execute(lookup_query, (log_id,))
        row = cursor.fetchone()

        if not row or not row.get("scanned_spectra_id"):
            return jsonify({"error": "No matching scanned spectrum entry"}), 404

        scanned_id = row["scanned_spectra_id"]

        # Now use scanned_spectra_id to fetch spectra from scanned_spectra
        query = """
        SELECT
            ss.vis_data AS raw_vis,
            ss.nir_data AS raw_nir,
            rs.avg_vis_data AS ref_vis,
            rs.avg_nir_data AS ref_nir,
            pt.material_code
        FROM scanned_spectra ss
        JOIN classification_log cl ON ss.id = cl.scanned_spectra_id
        JOIN plastic_type pt ON cl.plastic_type_id = pt.id
        JOIN reference_spectral rs ON pt.id = rs.plastic_type_id
        WHERE ss.id = %s;
        """

        cursor.execute(query, (scanned_id,))
        spectra_data = cursor.fetchone()

        if not spectra_data:
            return jsonify({"error": "Spectral data not found"}), 404

        # Convert JSON strings to arrays
        spectra_data['raw_vis'] = json.loads(spectra_data['raw_vis'])
        spectra_data['raw_nir'] = json.loads(spectra_data['raw_nir'])
        spectra_data['ref_vis'] = json.loads(spectra_data['ref_vis'])
        spectra_data['ref_nir'] = json.loads(spectra_data['ref_nir'])

        return jsonify(spectra_data)

    except Exception as e:
        print("Error fetching spectra:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        cursor.close()

@data_bp.route('/api/logs')
def api_logs():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        materials = get_db_material_log(cursor)
        return jsonify(materials)
    except Exception as e:
        print("Error fetching logs:", e)
        return jsonify([])
    finally:
        cursor.close()

@data_bp.route('/summary', methods=['GET'])
def get_summary_api():
    db = get_db()
    cursor = db.cursor(dictionary=True)

    try:
        summary = get_db_summary_data(cursor)
        return jsonify(summary)
    finally:
        cursor.close()

