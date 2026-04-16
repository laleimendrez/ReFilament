from flask import Blueprint, request, jsonify
from database.db_config import get_db
from datetime import datetime, timezone

esp32_bp = Blueprint('esp32_bp', __name__)


# ── 1. CLASSIFICATION endpoint ───────────────────────────────────────────────
# Called by ESP32 after TinyML identifies a plastic type.
# Inserts into: scanned_spectra → classification_log
@esp32_bp.route('/classify', methods=['POST'])
def receive_classification():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'No JSON received'}), 400

    plastic_type_id  = data.get('plastic_type_id')   # int: 1=PET, 2=HDPE, 3=PP
    confidence_score = data.get('confidence_score')  # float 0.0–1.0
    vis_data         = data.get('vis_data')           # JSON string e.g. "[1.1,2.2,...]"
    nir_data         = data.get('nir_data')           # JSON string e.g. "[3.3,4.4,...]"

    if plastic_type_id is None:
        return jsonify({'error': 'plastic_type_id is required'}), 400

    db = get_db()
    if db is None:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = db.cursor()

    try:
        # Step 1: insert raw spectral data into scanned_spectra
        cursor.execute(
            "INSERT INTO scanned_spectra (vis_data, nir_data) VALUES (%s, %s)",
            (str(vis_data), str(nir_data))
        )
        scanned_spectra_id = cursor.lastrowid

        # Step 2: insert classification result into classification_log
        cursor.execute(
            """INSERT INTO classification_log
               (timestamp_utc, plastic_type_id, confidence_score, scanned_spectra_id)
               VALUES (%s, %s, %s, %s)""",
            (
                datetime.now(timezone.utc),
                plastic_type_id,
                confidence_score,
                scanned_spectra_id
            )
        )
        log_id = cursor.lastrowid
        
        # ---> THE MISSING LINK: Save the changes permanently <---
        db.commit()

    except Exception as e:
        # If something goes wrong, undo the temporary changes
        db.rollback()
        cursor.close()
        return jsonify({'error': str(e)}), 500

    cursor.close()
    return jsonify({'status': 'ok', 'log_id': log_id}), 201


# ── 2. TEMPERATURE endpoint ──────────────────────────────────────────────────
# Called by ESP32 every 10 seconds from the DHT22 sensor.
# Inserts into: temperature_log
@esp32_bp.route('/temperature', methods=['POST'])
def receive_temperature():
    data = request.get_json(silent=True)
    if not data:
        return jsonify({'error': 'No JSON received'}), 400

    system_dht_temp = data.get('temperature')        # float e.g. 28.5
    status          = data.get('status', 'normal')   # "normal" / "high" / "low"

    if system_dht_temp is None:
        return jsonify({'error': 'temperature is required'}), 400

    db = get_db()
    if db is None:
        return jsonify({'error': 'Database connection failed'}), 500

    cursor = db.cursor()

    try:
        cursor.execute(
            """INSERT INTO temperature_log
               (timestamp_utc, system_dht_temp, status)
               VALUES (%s, %s, %s)""",
            (
                datetime.now(timezone.utc),
                system_dht_temp,
                status
            )
        )
        
        # ---> THE MISSING LINK: Save the changes permanently <---
        db.commit()
        
    except Exception as e:
        db.rollback()
        cursor.close()
        return jsonify({'error': str(e)}), 500

    cursor.close()
    return jsonify({'status': 'ok'}), 201