
# from flask import Blueprint, request, jsonify
# from .db_config import get_db
# from datetime import datetime

# log_bp = Blueprint('logs', __name__)

# @log_bp.route('/', methods=['GET'])
# def get_logs():
#     db = get_db()
#     collection = db["logs"]
#     logs = list(collection.find({}, {"_id": 0}))
#     return jsonify({"success": True, "data": logs}), 200

# @log_bp.route('/allot', methods=['POST'])
# def log_allotment():
#     # (Optional: You might not use allotment anymore for shop inventory.)
#     db = get_db()
#     collection = db["logs"]
#     data = request.json
#     log_entry = {
#         "item_name": data.get("item_name"),
#         "quantity": data.get("quantity"),
#         "buyer": data.get("buyer"),  # changed from project/taker/head to buyer
#         "date_alloted": datetime.now(),
#         "date_returned": None,
#         "action": "sell"  # or "allot" if you still need to differentiate
#     }
#     collection.insert_one(log_entry)
#     return jsonify({"success": True, "message": "Log entry added for sale/allotment"}), 200

# @log_bp.route('/return', methods=['POST'])
# def log_return():
#     db = get_db()
#     collection = db["logs"]
#     data = request.json
#     # Use buyer instead of taker in a shop inventory scenario
#     log_entry = {
#         "item_name": data.get("item_name"),
#         "quantity": data.get("quantity"),
#         "buyer": data.get("buyer"),
#         "date_alloted": None,
#         "date_returned": datetime.now(),
#         "action": "return"
#     }
#     collection.insert_one(log_entry)
#     return jsonify({"success": True, "message": "Log entry added for return"}), 200

from flask import Blueprint, request, jsonify
from .db_config import get_db
from datetime import datetime

log_bp = Blueprint('logs', __name__)

@log_bp.route('/', methods=['GET'])
def get_logs():
    db = get_db()
    collection = db["logs"]
    logs = list(collection.find({}, {"_id": 0}))
    return jsonify({"success": True, "data": logs}), 200

@log_bp.route('/allot', methods=['POST'])
def log_allotment():
    # In a shop setting, this route is used for logging sales
    db = get_db()
    collection = db["logs"]
    data = request.json
    log_entry = {
        "item_name": data.get("item_name"),
        "company": data.get("company"),
        "quantity": data.get("quantity"),
        "buyer": data.get("buyer"),
        "date_alloted": datetime.now(),
        "date_returned": None,
        "action": "sell"
    }
    collection.insert_one(log_entry)
    return jsonify({"success": True, "message": "Log entry added for sale"}), 200

@log_bp.route('/return', methods=['POST'])
def log_return():
    db = get_db()
    logs_collection = db["logs"]
    stock_collection = db["stock"]
    data = request.json

    # Expect item_name, company, quantity, and buyer in the payload
    item_name = data.get("item_name")
    company = data.get("company")
    quantity = data.get("quantity")
    buyer = data.get("buyer")

    if not item_name or not company or not quantity:
        return jsonify({"success": False, "message": "Item name, company, and quantity are required"}), 400

    # Normalize the strings (assuming they are stored in lowercase)
    item_name = item_name.strip().lower()
    company = company.strip().lower()

    # Update the inventory by incrementing the quantity by the returned amount
    result = stock_collection.update_one(
        {"name": item_name, "company": company},
        {"$inc": {"quantity": quantity}}
    )

    if result.modified_count == 0:
        return jsonify({"success": False, "message": "Item not found or inventory update failed"}), 404

    # Log the return event
    log_entry = {
        "item_name": item_name,
        "company": company,
        "quantity": quantity,
        "buyer": buyer,
        "date_alloted": None,
        "date_returned": datetime.now(),
        "action": "return"
    }
    logs_collection.insert_one(log_entry)

    return jsonify({"success": True, "message": f"Return logged and inventory updated by adding {quantity} unit(s)."}), 200
