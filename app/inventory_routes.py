import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate

inventory_bp = Blueprint('inventory', __name__)
logger = logging.getLogger(__name__)


# Schema for inventory validation (extended to include company)
class InventorySchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1))
    company = fields.Str(required=True, validate=validate.Length(min=1))  # New required field
    unit_price = fields.Float(required=True, validate=validate.Range(min=0.01))
    quantity = fields.Int(required=True, validate=validate.Range(min=1))
    date_of_addition = fields.Date(required=True)
    category = fields.Str()
    minimum_stock = fields.Int()


# Fetch inventory data with enhancements for the dashboard
@inventory_bp.route('/', methods=['GET'])
@jwt_required()
def get_inventory():
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        search = request.args.get('search', '')

        db = get_db()
        collection = db["stock"]

        # Build query
        query = {}
        if search:
            query['name'] = {'$regex': search, '$options': 'i'}

        # Get total count
        total = collection.count_documents(query)

        # Get paginated results
        inventory = list(collection.find(
            query,
            {'_id': 0}
        ).skip((page - 1) * per_page).limit(per_page))

        # Enhance data for the dashboard
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

# Add or update inventory with additional fields
@inventory_bp.route('/add', methods=['POST'])
@jwt_required()
def add_item():
    try:
        # Validate input
        schema = InventorySchema()
        errors = schema.validate(request.json)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        data = request.json
        name = data.get("name").strip().lower()
        company = data.get("company").strip().lower()  # Extract company
        unit_price = data.get("unit_price")
        quantity = data.get("quantity")
        date_of_addition = data.get("date_of_addition")
        category = data.get("category")
        minimum_stock = data.get("minimum_stock")

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        # Get current user
        current_user = get_jwt_identity()

        # Update stock: use both name and company in the query
        update_data = {
            "$inc": {"quantity": quantity},
            "$setOnInsert": {
                "unit_price": unit_price,
                "company": company,  # Save company on insert
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

        result = stock_collection.update_one(
            {"name": name, "company": company},  # Composite key: name and company
            update_data,
            upsert=True
        )

        # Log the inventory addition
        log_entry = {
            "item_name": name,
            "company": company,  # Log company as well
            "quantity_added": quantity,
            "unit_price": unit_price,
            "total_value": quantity * unit_price,
            "category": category,
            "timestamp": datetime.utcnow(),
            "action": "add_inventory",
            "performed_by": current_user
        }
        log_collection.insert_one(log_entry)

        # Check if stock is low after update
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

# Sell or allot items
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

        # Normalize name and company (assuming lowercase storage)
        item_name = item_name.strip().lower()
        company = company.strip().lower()

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        # Check if the item exists and if there's enough stock
        item = stock_collection.find_one({"name": item_name, "company": company})
        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404
        if item["quantity"] < quantity:
            return jsonify({"success": False, "message": "Insufficient stock"}), 400

        # Update stock by deducting the sold quantity
        stock_collection.update_one(
            {"name": item_name, "company": company},
            {"$inc": {"quantity": -quantity}}
        )

        # Log the sale
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

# Dashboard data
@inventory_bp.route('/dashboard', methods=['GET'])
@jwt_required()
def get_dashboard_data():
    try:
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]

        # Get total items and total value
        total_items = stock_collection.count_documents({})
        total_value = sum(item['quantity'] * item['unit_price'] for item in stock_collection.find({}))

        # Get recent activities
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
    
# In inventory_routes.py
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

        # Check if the item exists based on name and company
        item = stock_collection.find_one({"name": name, "company": company})
        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404

        # Delete the item from inventory
        stock_collection.delete_one({"name": name, "company": company})

        # Log the deletion event
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
