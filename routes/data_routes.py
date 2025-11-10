from flask import Blueprint, render_template

data_bp = Blueprint('data_bp', __name__, template_folder='../templates')

@data_bp.route('/')
def data_page():
    # Mock summary data (placeholder while DB isn’t connected)
    summary = {
        "total_records": 1248,
        "pet": 45,
        "hdpe": 30,
        "pp": 25,
        "activity_24h": 12,
        "avg_confidence": 97.2
    }

    # Mock material log
    materials = [
        {"id": 1248, "timestamp": "25-11-06 23:15:01", "material": "PET",  "confidence": "98.9%", "temp": "26.0°C", "status": "Processed"},
        {"id": 1247, "timestamp": "25-11-06 23:14:45", "material": "HDPE", "confidence": "99.4%", "temp": "25.9°C", "status": "Processed"},
        {"id": 1246, "timestamp": "25-11-06 23:14:02", "material": "PP",   "confidence": "95.2%", "temp": "25.8°C", "status": "Processed"},
        {"id": 1245, "timestamp": "25-11-06 23:13:30", "material": "PET",  "confidence": "94.5%", "temp": "26.1°C", "status": "Processed"},
        {"id": 1244, "timestamp": "25-11-06 23:13:01", "material": "HDPE", "confidence": "96.7%", "temp": "25.7°C", "status": "Processed"}
    ]

    return render_template('data.html', summary=summary, materials=materials)
