import logging
from flask import Blueprint, request, jsonify
from ..db_config import get_db
from datetime import datetime, date
from flask_jwt_extended import jwt_required

reporting_bp = Blueprint("inventory_reporting", __name__)
logger = logging.getLogger(__name__)

def convert_dates(obj):
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: convert_dates(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates(item) for item in obj]
    return obj

@reporting_bp.route("/dashboard", methods=["GET"])
@jwt_required()
def get_dashboard_data():
    try:
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        total_items = stock_collection.count_documents({})
        total_value = sum(item.get("quantity", 0) * item.get("unit_price", 0) for item in stock_collection.find({}))
        recent_activities = list(log_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(10))

        return jsonify({
            "success": True,
            "data": {
                "total_items": total_items,
                "total_value": total_value,
                "recent_activities": convert_dates(recent_activities),
            },
        }), 200
    except Exception as e:
        logger.error(f"Dashboard data retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve dashboard data"}), 500

@reporting_bp.route("/by-date", methods=["GET"])
@jwt_required()
def get_inventory_by_date():
    try:
        date_str = request.args.get("date")
        if not date_str:
            return jsonify({"success": False, "message": "Date parameter is required"}), 400

        date_obj = datetime.strptime(date_str, "%Y-%m-%d")
        start_datetime = date_obj
        end_datetime = datetime.combine(date_obj.date(), datetime.max.time())

        db = get_db()
        inventory_items = list(db["stock"].find(
            {"date_of_addition": {"$gte": start_datetime, "$lte": end_datetime}},
            {"_id": 0}
        ))
        logs = list(db["logs"].find(
            {"timestamp": {"$gte": start_datetime, "$lte": end_datetime}},
            {"_id": 0}
        ))
        
        response_data = {
            "inventory": convert_dates(inventory_items),
            "logs": convert_dates(logs)
        }
        return jsonify({"success": True, "data": response_data}), 200
    except Exception as e:
        logger.error(f"Error in get_inventory_by_date: {str(e)}")
        return jsonify({"success": False, "message": "Failed to fetch data"}), 500