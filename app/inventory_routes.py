
import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from datetime import datetime, date
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate

inventory_bp = Blueprint('inventory', __name__)
logger = logging.getLogger(__name__)

# Schema for inventory validation (with company)
class InventorySchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1))
    company = fields.Str(required=True, validate=validate.Length(min=1))
    unit_price = fields.Float(required=True, validate=validate.Range(min=0.01))
    quantity = fields.Int(required=True, validate=validate.Range(min=1))
    date_of_addition = fields.Date(required=True)
    category = fields.Str()
    minimum_stock = fields.Int()

@inventory_bp.route('/', methods=['GET'])
@jwt_required()
def get_inventory():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '')

        db = get_db()
        collection = db["stock"]

        query = {}
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}

        total = collection.count_documents(query)
        inventory = list(collection.find(query, {'_id': 0})
                         .skip((page - 1) * per_page).limit(per_page))
        for item in inventory:
            item['total_value'] = item['quantity'] * item['unit_price']

        return jsonify({
            "success": True,
            "data": inventory,
            "pagination": {
                "page": page,
                "per_page": per_page,
                "total": total,
                "pages": (total + per_page - 1) // per_page
            }
        }), 200
    except Exception as e:
        logger.error(f"Inventory retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve inventory"}), 500

@inventory_bp.route('/add', methods=['POST'])
@jwt_required()
def add_item():
    try:
        # Validate input with schema
        schema = InventorySchema()
        errors = schema.validate(request.json)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        data = request.json
        name = data.get("name").strip().lower()
        company = data.get("company").strip().lower()
        unit_price = data.get("unit_price")
        quantity = data.get("quantity")
        
        # Parse the date string; expect format "YYYY-MM-DD"
        date_str = data.get("date_of_addition")
        try:
            date_of_addition = datetime.strptime(date_str, "%Y-%m-%d")
        except Exception as parse_err:
            return jsonify({"success": False, "message": "Invalid date format. Expected YYYY-MM-DD."}), 400

        category = data.get("category")
        minimum_stock = data.get("minimum_stock")

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        current_user = get_jwt_identity()

        update_data = {
            "$inc": {"quantity": quantity},
            "$setOnInsert": {
                "unit_price": unit_price,
                "company": company,
                "category": category,
                "minimum_stock": minimum_stock,
                "created_at": datetime.utcnow(),
                "created_by": current_user
            },
            "$set": {
                "updated_at": datetime.utcnow(),
                "updated_by": current_user,
                "date_of_addition": date_of_addition
            }
        }

        stock_collection.update_one(
            {"name": name, "company": company},
            update_data,
            upsert=True
        )

        log_entry = {
            "item_name": name,
            "company": company,
            "quantity_added": quantity,
            "unit_price": unit_price,
            "total_value": quantity * unit_price,
            "category": category,
            "timestamp": datetime.utcnow(),
            "action": "add_inventory",
            "performed_by": current_user
        }
        log_collection.insert_one(log_entry)

        item = stock_collection.find_one({"name": name, "company": company})
        if item and item.get("minimum_stock") and item["quantity"] <= item["minimum_stock"]:
            logger.warning(f"Low stock alert for item: {name} from {company}")

        logger.info(f"Item added: {name} from {company}, Quantity: {quantity}, Unit Price: {unit_price}")
        return jsonify({
            "success": True,
            "message": f"Item '{name}' from {company} added/updated successfully"
        }), 200

    except Exception as e:
        logger.error(f"Item addition error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to add item"}), 500

@inventory_bp.route('/sell', methods=['POST'])
@jwt_required()
def sell_item():
    try:
        data = request.json
        item_name = data.get("item_name")
        company = data.get("company")
        quantity = data.get("quantity")
        buyer = data.get("buyer")
        price = data.get("price")

        if not item_name or not company:
            return jsonify({"success": False, "message": "Item name and company are required"}), 400

        item_name = item_name.strip().lower()
        company = company.strip().lower()

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        item = stock_collection.find_one({"name": item_name, "company": company})
        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404
        if item["quantity"] < quantity:
            return jsonify({"success": False, "message": "Insufficient stock"}), 400

        stock_collection.update_one(
            {"name": item_name, "company": company},
            {"$inc": {"quantity": -quantity}}
        )

        log_entry = {
            "item_name": item_name,
            "company": company,
            "quantity_sold": quantity,
            "buyer": buyer,
            "price": price,
            "timestamp": datetime.utcnow(),
            "action": "sell",
            "performed_by": get_jwt_identity()
        }
        log_collection.insert_one(log_entry)

        return jsonify({
            "success": True,
            "message": f"Sold {quantity} of {item_name} from {company} to {buyer}"
        }), 200
    except Exception as e:
        logger.error(f"Item sale error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to sell item"}), 500

@inventory_bp.route('/delete', methods=['DELETE'])
@jwt_required()
def delete_item():
    try:
        data = request.get_json()
        if not data or "name" not in data or "company" not in data:
            return jsonify({"success": False, "message": "Item name and company are required"}), 400

        name = data.get("name").strip().lower()
        company = data.get("company").strip().lower()

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        item = stock_collection.find_one({"name": name, "company": company})
        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404

        stock_collection.delete_one({"name": name, "company": company})

        log_entry = {
            "item_name": name,
            "company": company,
            "action": "delete",
            "quantity_deleted": item.get("quantity", 0),
            "timestamp": datetime.utcnow(),
            "performed_by": get_jwt_identity()
        }
        log_collection.insert_one(log_entry)

        logger.info(f"Item deleted: {name} from {company}")
        return jsonify({"success": True, "message": f"Item '{name}' from {company} deleted successfully"}), 200

    except Exception as e:
        logger.error(f"Item deletion error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to delete item"}), 500

@inventory_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_data():
    try:
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        total_items = stock_collection.count_documents({})
        total_value = sum(item['quantity'] * item['unit_price'] for item in stock_collection.find({}))
        recent_activities = list(log_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(10))

        return jsonify({
            "success": True,
            "data": {
                "total_items": total_items,
                "total_value": total_value,
                "recent_activities": recent_activities
            }
        }), 200
    except Exception as e:
        logger.error(f"Dashboard data retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve dashboard data"}), 500

from flask import Blueprint, request, jsonify, current_app
from .db_config import get_db
from datetime import datetime, date
from flask_jwt_extended import jwt_required
import logging
import json

logger = logging.getLogger(__name__)

def convert_dates(obj):
    """Recursively convert datetime/date objects to ISO formatted strings."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    elif isinstance(obj, dict):
        return {key: convert_dates(value) for key, value in obj.items()}
    elif isinstance(obj, list):
        return [convert_dates(item) for item in obj]
    return obj

@inventory_bp.route('/by-date', methods=['GET'])
@jwt_required()
def get_inventory_by_date():
    try:
        date_str = request.args.get("date")
        if not date_str:
            return jsonify({"success": False, "message": "Date parameter is required"}), 400

        # Parse incoming date string as a datetime (with time set to midnight)
        date_obj = datetime.strptime(date_str, "%Y-%m-%d")

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        # Query inventory items that have date_of_addition on the given date.
        # If date_of_addition is stored as datetime, we use a range:
        start_datetime = date_obj
        end_datetime = datetime.combine(date_obj.date(), datetime.max.time())

        inventory_items = list(stock_collection.find(
            {"date_of_addition": {"$gte": start_datetime, "$lte": end_datetime}},
            {"_id": 0}
        ))

        # Query logs where the timestamp falls within the day.
        logs = list(log_collection.find(
            {"timestamp": {"$gte": start_datetime, "$lte": end_datetime}},
            {"_id": 0}
        ))

        # Recursively convert any date/datetime objects in our results
        def convert_dates(obj):
            if isinstance(obj, (datetime, date)):
                return obj.isoformat()
            elif isinstance(obj, dict):
                return {key: convert_dates(value) for key, value in obj.items()}
            elif isinstance(obj, list):
                return [convert_dates(item) for item in obj]
            return obj

        inventory_items = convert_dates(inventory_items)
        logs = convert_dates(logs)

        return jsonify({
            "success": True,
            "data": {
                "inventory": inventory_items,
                "logs": logs
            }
        }), 200
    except Exception as e:
        logger.error(f"Error in get_inventory_by_date: {str(e)}")
        return jsonify({"success": False, "message": "Failed to fetch data for the selected date"}), 500


@inventory_bp.route('/add-multiple', methods=['POST'])
@jwt_required()
def add_multiple_items():
    try:
        data = request.json
        items = data.get("items", [])
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()

        messages = []
        for d in items:
            # Assume d is already validated and formatted.
            name = d.get("name").strip().lower()
            company = d.get("company").strip().lower()
            unit_price = d.get("unit_price")
            quantity = d.get("quantity")
            date_of_addition = d.get("date_of_addition")
            category = d.get("category")
            minimum_stock = d.get("minimum_stock")

            update_data = {
                "$inc": {"quantity": quantity},
                "$setOnInsert": {
                    "unit_price": unit_price,
                    "company": company,
                    "category": category,
                    "minimum_stock": minimum_stock,
                    "created_at": datetime.utcnow(),
                    "created_by": current_user
                },
                "$set": {
                    "updated_at": datetime.utcnow(),
                    "updated_by": current_user,
                    "date_of_addition": date_of_addition
                }
            }

            stock_collection.update_one(
                {"name": name, "company": company},
                update_data,
                upsert=True
            )

            log_entry = {
                "item_name": name,
                "company": company,
                "quantity_added": quantity,
                "unit_price": unit_price,
                "total_value": quantity * unit_price,
                "category": category,
                "timestamp": datetime.utcnow(),
                "action": "add_inventory",
                "performed_by": current_user
            }
            log_collection.insert_one(log_entry)
            messages.append(f"Item '{name}' from {company} added/updated successfully")
        
        return jsonify({"success": True, "message": " | ".join(messages)}), 200
    except Exception as e:
        logger.error(f"Add multiple items error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to add multiple items"}), 500

@inventory_bp.route('/sell-multiple', methods=['POST'])
@jwt_required()
def sell_multiple_items():
    try:
        data = request.json
        sales = data.get("sales", [])
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()

        messages = []
        for sale in sales:
            # Extract and normalize fields.
            item_name = sale.get("item_name").strip().lower()
            company = sale.get("company").strip().lower()
            quantity = sale.get("quantity")
            buyer = sale.get("buyer").strip()
            price = sale.get("price")
            
            # Check for item existence and stock
            item = stock_collection.find_one({"name": item_name, "company": company})
            if not item:
                messages.append(f"Item {item_name} from {company} not found.")
                continue
            if item["quantity"] < quantity:
                messages.append(f"Insufficient stock for {item_name} from {company}.")
                continue

            # Deduct the sold quantity.
            stock_collection.update_one(
                {"name": item_name, "company": company},
                {"$inc": {"quantity": -quantity}}
            )

            # Insert a sell log.
            log_entry = {
                "item_name": item_name,
                "company": company,
                "quantity_sold": quantity,
                "buyer": buyer,
                "price": price,
                "timestamp": datetime.utcnow(),
                "action": "sell",
                "performed_by": current_user
            }
            log_collection.insert_one(log_entry)
            messages.append(f"Sold {quantity} of {item_name} from {company} to {buyer}")
        
        if messages:
            return jsonify({"success": True, "message": " | ".join(messages)}), 200
        else:
            return jsonify({"success": False, "message": "No sales processed"}), 400
    except Exception as e:
        logger.error(f"Sell multiple items error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to process multiple sales"}), 500

@inventory_bp.route('/names', methods=['GET'])
def get_item_names():
    try:
        db = get_db()
        collection = db["stock"]
        # Get distinct names from the stock collection.
        names = collection.distinct("name")
        return jsonify({"success": True, "data": names}), 200
    except Exception as e:
        logger.error(f"Error fetching item names: {str(e)}")
        return jsonify({"success": False, "message": "Failed to fetch item names"}), 500
