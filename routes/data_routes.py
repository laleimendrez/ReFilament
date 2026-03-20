# routes/data_routes.py
from flask import Blueprint, render_template, jsonify, request, make_response
import csv
import io
from database.db_config import get_db
import json

data_bp = Blueprint('data_bp', __name__, template_folder='../templates')


def get_db_summary_data(cursor):
    """Fetches classification summary data."""

    cursor.execute("SELECT COUNT(*) AS total FROM classification_log;")
    total_records = cursor.fetchone().get('total', 0)

    cursor.execute("""
        SELECT COUNT(*) AS activity_24h
        FROM classification_log
        WHERE timestamp_utc >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 24 HOUR);
    """)
    activity_24h = cursor.fetchone().get('activity_24h', 0)

    cursor.execute("""
        SELECT pt.material_code, COUNT(cl.log_id) AS count
        FROM classification_log cl
        JOIN plastic_type pt ON cl.plastic_type_id = pt.id
        WHERE pt.material_code IN ('PET', 'HDPE', 'PP')
        GROUP BY pt.material_code;
    """)
    breakdown_raw = cursor.fetchall()

    breakdown = {item['material_code']: item['count'] for item in breakdown_raw}
    classified_total = sum(breakdown.values())

    pet_percent = hdpe_percent = pp_percent = avg_confidence = 0.0

    if classified_total > 0:
        pet_count  = breakdown.get('PET',  0)
        hdpe_count = breakdown.get('HDPE', 0)
        pp_count   = breakdown.get('PP',   0)

        pet_percent  = round((pet_count  / classified_total) * 100, 1)
        hdpe_percent = round((hdpe_count / classified_total) * 100, 1)
        pp_percent   = round((pp_count   / classified_total) * 100, 1)

        current_sum = pet_percent + hdpe_percent + pp_percent
        if current_sum != 100.0:
            pp_percent = round(pp_percent + (100.0 - current_sum), 1)

    cursor.execute("SELECT AVG(confidence_score) AS avg_confidence FROM classification_log;")
    avg_row = cursor.fetchone()
    if avg_row and avg_row.get('avg_confidence') is not None:
        avg_confidence = round(avg_row['avg_confidence'] * 100, 1)

    return {
        "total_records": total_records,
        "pet":           pet_percent,
        "hdpe":          hdpe_percent,
        "pp":            pp_percent,
        "activity_24h":  activity_24h,
        "avg_confidence": avg_confidence,
    }


def get_db_material_log(cursor):
    """Fetches the main classification log — confidence always returned as 'XX.X%' string."""
    cursor.execute("""
        SELECT
            cl.log_id                                          AS id,
            DATE_FORMAT(cl.timestamp_utc, '%Y-%m-%d %H:%i:%s') AS timestamp,
            pt.material_code                                   AS material,
            pt.chemical_name,
            cl.confidence_score
        FROM classification_log cl
        JOIN plastic_type pt ON cl.plastic_type_id = pt.id
        ORDER BY cl.log_id DESC
        LIMIT 100;
    """)
    logs = cursor.fetchall()

    for log in logs:
        log['confidence'] = f"{round(log['confidence_score'] * 100, 1)}%"
        del log['confidence_score']

    return logs


# ── Pages ─────────────────────────────────────────────────────────────────────

@data_bp.route('/')
def data_page():
    db = get_db()
    if db is None:
        return render_template('data.html',
            summary={"total_records": 0, "pet": 0, "hdpe": 0, "pp": 0,
                     "activity_24h": 0, "avg_confidence": 0.0},
            materials=[],
            db_error="Database connection failed.")
    cursor = db.cursor(dictionary=True)
    try:
        summary   = get_db_summary_data(cursor)
        materials = get_db_material_log(cursor)
        return render_template('data.html', summary=summary, materials=materials)
    except Exception as e:
        print(f"Error fetching data for data_page: {e}")
        return render_template('data.html', summary={}, materials=[],
                               db_error=f"Error executing query: {e}")
    finally:
        cursor.close()


# ── API endpoints ─────────────────────────────────────────────────────────────

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
        return jsonify(get_db_summary_data(cursor))
    finally:
        cursor.close()


@data_bp.route('/spectra/<int:log_id>', methods=['GET'])
def get_spectra(log_id):
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        cursor.execute(
            "SELECT scanned_spectra_id FROM classification_log WHERE log_id = %s;",
            (log_id,)
        )
        row = cursor.fetchone()
        if not row or not row.get("scanned_spectra_id"):
            return jsonify({"error": "No matching scanned spectrum entry"}), 404

        scanned_id = row["scanned_spectra_id"]
        cursor.execute("""
            SELECT
                ss.vis_data  AS raw_vis,
                ss.nir_data  AS raw_nir,
                rs.avg_vis_data AS ref_vis,
                rs.avg_nir_data AS ref_nir,
                pt.material_code
            FROM scanned_spectra ss
            JOIN classification_log cl ON ss.id = cl.scanned_spectra_id
            JOIN plastic_type pt ON cl.plastic_type_id = pt.id
            JOIN reference_spectral rs ON pt.id = rs.plastic_type_id
            WHERE ss.id = %s;
        """, (scanned_id,))
        spectra_data = cursor.fetchone()

        if not spectra_data:
            return jsonify({"error": "Spectral data not found"}), 404

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


@data_bp.route('/api/classify', methods=['POST'])
def receive_classification():
    db = get_db()
    cursor = db.cursor(dictionary=True)
    try:
        data = request.get_json()
        plastic_type_id  = data.get("plastic_type_id")
        confidence_score = data.get("confidence_score")
        scanned_spectra_id = data.get("scanned_spectra_id")

        if not plastic_type_id or confidence_score is None:
            return jsonify({"error": "Missing required fields"}), 400

        cursor.execute("""
            INSERT INTO classification_log (plastic_type_id, confidence_score, scanned_spectra_id)
            VALUES (%s, %s, %s);
        """, (plastic_type_id, confidence_score, scanned_spectra_id))
        return jsonify({"status": "success"}), 201
    except Exception as e:
        print("Error inserting classification:", e)
        return jsonify({"error": "Server error"}), 500
    finally:
        cursor.close()


@data_bp.route('/download', methods=['GET'])
def download_logs():
    db = get_db()
    if db is None:
        return jsonify({"error": "Database connection failed"}), 500

    start    = request.args.get('start')
    end      = request.args.get('end')
    all_flag = request.args.get('all', 'false').lower() == 'true'
    # ISO-Usability: support comma-separated IDs for "export selected"
    ids_param = request.args.get('ids', '')

    cursor = db.cursor(dictionary=True)
    try:
        query = """
            SELECT
                cl.log_id          AS id,
                cl.timestamp_utc   AS timestamp,
                pt.material_code   AS material,
                pt.chemical_name,
                cl.confidence_score,
                cl.scanned_spectra_id
            FROM classification_log cl
            JOIN plastic_type pt ON cl.plastic_type_id = pt.id
        """
        params = ()

        if ids_param:
            # Export selected rows by ID list
            try:
                id_list = [int(x) for x in ids_param.split(',') if x.strip().isdigit()]
            except ValueError:
                id_list = []
            if not id_list:
                return jsonify({"error": "No valid IDs provided"}), 400
            placeholders = ','.join(['%s'] * len(id_list))
            query += f" WHERE cl.log_id IN ({placeholders})"
            params = tuple(id_list)
        elif not all_flag:
            conditions = []
            if start:
                conditions.append("DATE(cl.timestamp_utc) >= %s")
                params = params + (start,)
            if end:
                conditions.append("DATE(cl.timestamp_utc) <= %s")
                params = params + (end,)
            if conditions:
                query += " WHERE " + " AND ".join(conditions)

        query += " ORDER BY cl.timestamp_utc ASC;"
        cursor.execute(query, params)
        rows = cursor.fetchall()

        if not rows:
            return jsonify({"error": "No data found in the selected date range"}), 404

        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['id','timestamp','material','chemical_name','confidence_score','scanned_spectra_id'])

        for r in rows:
            ts = r.get('timestamp')
            ts_str = ts.strftime('%Y-%m-%d %H:%M:%S') if hasattr(ts, 'strftime') else str(ts)
            writer.writerow([
                r.get('id'),
                ts_str,
                r.get('material'),
                r.get('chemical_name'),
                f"{round(r.get('confidence_score', 0) * 100, 1)}%",
                r.get('scanned_spectra_id'),
            ])

        csv_data = output.getvalue()
        output.close()

        if ids_param:
            fname_date = f"selected_{len(rows)}_records"
        elif all_flag:
            fname_date = 'all'
        elif start and end:
            fname_date = f"{start}_to_{end}"
        elif start:
            fname_date = f"from_{start}"
        elif end:
            fname_date = f"to_{end}"
        else:
            fname_date = 'all'

        filename = f"classification_logs_{fname_date}.csv"
        response = make_response(csv_data)
        response.headers['Content-Disposition'] = f'attachment; filename={filename}'
        response.headers['Content-Type'] = 'text/csv; charset=utf-8'
        return response

    except Exception as e:
        print("Error generating CSV:", e)
        return jsonify({"error": str(e)}), 500
    finally:
        cursor.close()