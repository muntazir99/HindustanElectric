from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from .utils import upload_to_cloudinary
from .db_config import get_db
from datetime import datetime

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/bill", methods=["POST"])
def upload_bill():
    try:
        invoice_number = request.form.get("invoiceNumber")
        bill_type = request.form.get("billType")
        file = request.files.get("file")

        if not file or not invoice_number or not bill_type:
            return jsonify({"success": False, "message": "Missing data"}), 400

        # Upload PDF to Cloudinary
        url = upload_to_cloudinary(file, folder="bills")

        # Save to MongoDB
        db = get_db()
        collection_name = "gstbills" if bill_type.lower() == "gst" else "nongstbills"
        collection = db[collection_name]

        collection.insert_one(
            {
                "invoice_number": invoice_number,
                "url": url,
                "uploaded_at": datetime.utcnow(),
            }
        )

        return jsonify({"success": True, "url": url}), 200

    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500
