from flask import Blueprint, request, jsonify
from werkzeug.utils import secure_filename
from .utils import upload_to_cloudinary
from .db_config import get_db
from datetime import datetime, timezone

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

def parse_uploaded_at(uploaded_at):
    """
    Convert the uploaded_at value to a timezone-aware datetime in UTC.
    Handles both string and datetime objects.
    """
    if isinstance(uploaded_at, str):
        # Parse the ISO string with timezone info, e.g., "2025-04-14T14:40:32.225+00:00"
        return datetime.strptime(uploaded_at, "%Y-%m-%dT%H:%M:%S.%f%z").astimezone(timezone.utc)
    elif isinstance(uploaded_at, datetime):
        return uploaded_at.astimezone(timezone.utc)
    return None

@upload_bp.route("/bills", methods=["GET"])
def get_bills():
    try:
        db = get_db()
        # Fetch GST and Non-GST invoices from separate collections.
        gst_invoices = list(db["gstbills"].find({}, {"_id": 0}))
        nongst_invoices = list(db["nongstbills"].find({}, {"_id": 0}))
        
        # Add a billType field to each invoice
        for invoice in gst_invoices:
            invoice["billType"] = "gst"
        for invoice in nongst_invoices:
            invoice["billType"] = "nongst"
        
        # Combine both lists.
        all_invoices = gst_invoices + nongst_invoices

        # Optional: Filter by date if a query parameter "date" is provided.
        # Expected format: YYYY-MM-DD
        date_param = request.args.get("date")
        if date_param:
            def matches_date(inv):
                try:
                    dt = parse_uploaded_at(inv.get("uploaded_at"))
                    if dt:
                        # Compare using the UTC date portion
                        return dt.date().isoformat() == date_param
                    return False
                except Exception as e:
                    print("Date parse error:", e)
                    return False
            all_invoices = list(filter(matches_date, all_invoices))
        
        # Sort invoices descending by 'uploaded_at' (using parsed datetime)
        all_invoices.sort(
            key=lambda inv: parse_uploaded_at(inv.get("uploaded_at")) or datetime.min,
            reverse=True
        )
        
        return jsonify({"success": True, "data": all_invoices}), 200
    except Exception as e:
        return jsonify({"success": False, "message": str(e)}), 500