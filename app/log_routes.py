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
#     db = get_db()
#     collection = db["logs"]
#     data = request.json
#     log_entry = {
#         "item_name": data.get("item_name"),
#         "quantity": data.get("quantity"),
#         "project": data.get("project"),
#         "taker": data.get("taker"),
#         "head": data.get("head"),
#         "date_alloted": datetime.now(),
#         "date_returned": None
#     }
#     collection.insert_one(log_entry)
#     return jsonify({"success": True, "message": "Log entry added for allotment"}), 200

# @log_bp.route('/return', methods=['POST'])
# def log_return():
#     db = get_db()
#     collection = db["logs"]
#     data = request.json
#     log_entry = {
#         "item_name": data.get("item_name"),
#         "quantity": data.get("quantity"),
#         "taker": data.get("taker"),
#         "date_alloted": None,
#         "date_returned": datetime.now()
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
    # (Optional: You might not use allotment anymore for shop inventory.)
    db = get_db()
    collection = db["logs"]
    data = request.json
    log_entry = {
        "item_name": data.get("item_name"),
        "quantity": data.get("quantity"),
        "buyer": data.get("buyer"),  # changed from project/taker/head to buyer
        "date_alloted": datetime.now(),
        "date_returned": None,
        "action": "sell"  # or "allot" if you still need to differentiate
    }
    collection.insert_one(log_entry)
    return jsonify({"success": True, "message": "Log entry added for sale/allotment"}), 200

@log_bp.route('/return', methods=['POST'])
def log_return():
    db = get_db()
    collection = db["logs"]
    data = request.json
    # Use buyer instead of taker in a shop inventory scenario
    log_entry = {
        "item_name": data.get("item_name"),
        "quantity": data.get("quantity"),
        "buyer": data.get("buyer"),
        "date_alloted": None,
        "date_returned": datetime.now(),
        "action": "return"
    }
    collection.insert_one(log_entry)
    return jsonify({"success": True, "message": "Log entry added for return"}), 200
