from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId
from .utils import upload_to_cloudinary
from .db_config import get_db
from datetime import datetime

upload_bp = Blueprint("upload", __name__)


@upload_bp.route("/item/<stock_id>", methods=["POST"])
@jwt_required()
def upload_file(stock_id):
    try:
        if "file" not in request.files:
            return (
                jsonify({"success": False, "message": "No file part in the request"}),
                400,
            )

        file = request.files["file"]
        if file.filename == "":
            return jsonify({"success": False, "message": "No selected file"}), 400

        uploaded_url = upload_to_cloudinary(file)

        db = get_db()
        result = db["stock"].update_one(
            {"_id": ObjectId(stock_id)},
            {
                "$set": {
                    "image": uploaded_url,
                    "updated_at": datetime.utcnow(),
                    "updated_by": get_jwt_identity(),
                }
            },
        )

        if result.modified_count == 0:
            return (
                jsonify(
                    {"success": False, "message": "Stock item not found or not updated"}
                ),
                404,
            )

        return (
            jsonify(
                {
                    "success": True,
                    "message": "File uploaded successfully",
                    "url": uploaded_url,
                }
            ),
            200,
        )

    except Exception as e:
        return jsonify({"success": False, "message": f"Upload failed: {str(e)}"}), 500
