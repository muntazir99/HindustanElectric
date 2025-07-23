import logging
from flask import Blueprint, request, jsonify
from ..db_config import get_db
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..utils import upload_to_cloudinary
from bson import ObjectId
from marshmallow import Schema, fields, validate

crud_bp = Blueprint("inventory_crud", __name__)
logger = logging.getLogger(__name__)

# Schema for inventory validation
class InventorySchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1))
    company = fields.Str(required=True, validate=validate.Length(min=1))
    unit_price = fields.Float(required=True, validate=validate.Range(min=0.01))
    quantity = fields.Int(required=True, validate=validate.Range(min=1))
    date_of_addition = fields.Date(required=True)
    category = fields.Str()
    minimum_stock = fields.Int()
    hsn_code = fields.Str(required=True, validate=validate.Length(min=1))
    image = fields.Str()


@crud_bp.route("/", methods=["GET"])
@jwt_required()
def get_inventory():
    try:
        search = request.args.get("search", "")
        db = get_db()
        collection = db["stock"]

        query = {}
        if search:
            query["name"] = {"$regex": search, "$options": "i"}

        inventory = list(collection.find(query))
        for item in inventory:
            item["_id"] = str(item["_id"])
            item["total_value"] = item.get("quantity", 0) * item.get("unit_price", 0)

        return jsonify({"success": True, "data": inventory}), 200
    except Exception as e:
        logger.error(f"Inventory retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve inventory"}), 500

@crud_bp.route("/add", methods=["POST"])
@jwt_required()
def add_item():
    try:
        form = request.form
        file = request.files.get("file")

        name = form.get("name", "").strip().lower()
        company = form.get("company", "").strip().lower()
        unit_price = float(form.get("unit_price", 0))
        quantity = int(form.get("quantity", 0))
        date_str = form.get("date_of_addition")

        try:
            date_of_addition = datetime.strptime(date_str, "%Y-%m-%d")
        except (ValueError, TypeError):
            return jsonify({"success": False, "message": "Invalid date format. Expected YYYY-MM-DD."}), 400

        category = form.get("category")
        minimum_stock = form.get("minimum_stock")
        barcode = form.get("barcode")
        hsn_code = form.get("hsn_code")

        image_url = upload_to_cloudinary(file) if file else None
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()

        update_data = {
            "$inc": {"quantity": quantity},
            "$setOnInsert": {
                "unit_price": unit_price, "company": company, "category": category,
                "minimum_stock": int(minimum_stock) if minimum_stock else None,
                "barcode": barcode, "hsn_code": hsn_code, "image": image_url,
                "created_at": datetime.utcnow(), "created_by": current_user,
            },
            "$set": {"updated_at": datetime.utcnow(), "updated_by": current_user, "date_of_addition": date_of_addition},
        }

        stock_collection.update_one({"name": name, "company": company}, update_data, upsert=True)
        # Log this action
        log_collection.insert_one({
            "item_name": name, "company": company, "quantity_added": quantity, "unit_price": unit_price,
            "action": "add_inventory", "timestamp": datetime.utcnow(), "performed_by": current_user,
        })

        return jsonify({"success": True, "message": f"Item '{name}' from '{company}' added/updated."}), 200
    except Exception as e:
        logger.error(f"Item addition error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to add item"}), 500

# @crud_bp.route("/update", methods=["PUT"])
# @jwt_required()
# def update_item():
#     try:
#         if request.files:
#             data = request.form.to_dict()
#             file = request.files.get("file")
#         else:
#             data = request.get_json()
#             file = None

#         item_id = data.get("id")
#         if not item_id:
#             return jsonify({"success": False, "message": "Item ID is required for updates."}), 400

#         update_fields = {}
#         # Add fields to update only if they are present in the request
#         for key in ["name", "company", "category", "barcode", "hsn_code"]:
#             if key in data:
#                 update_fields[key] = data[key]
#         if "quantity" in data and data["quantity"] is not None:
#             update_fields["quantity"] = int(data["quantity"])
#         if "unit_price" in data and data["unit_price"] is not None:
#             update_fields["unit_price"] = float(data["unit_price"])

#         if not update_fields and not file:
#             return jsonify({"success": False, "message": "No update data provided."}), 400

#         update_fields["updated_at"] = datetime.utcnow()
#         if file:
#             update_fields["image"] = upload_to_cloudinary(file)

#         db = get_db()
#         result = db["stock"].update_one({"_id": ObjectId(item_id)}, {"$set": update_fields})

#         if result.modified_count > 0:
#             return jsonify({"success": True, "message": "Item updated successfully."}), 200
#         else:
#             return jsonify({"success": False, "message": "Item not found or no changes made."}), 404
#     except Exception as e:
#         logger.error(f"Item update error: {str(e)}")
#         return jsonify({"success": False, "message": str(e)}), 500
@crud_bp.route("/update", methods=["PUT"])
@jwt_required()
def update_item():
    try:
        if request.files:
            data = request.form.to_dict()
            file = request.files.get("file")
        else:
            data = request.get_json()
            file = None

        # --- START OF CHANGES ---

        item_id = data.get("id")
        if not item_id:
            return jsonify({"success": False, "message": "Item ID is required for updates."}), 400

        # Prepare fields to update, excluding the ID
        update_fields = {k: v for k, v in data.items() if k != "id" and v is not None}
        
        # Ensure numeric types are correct if they exist in the payload
        if 'quantity' in update_fields:
            update_fields['quantity'] = int(update_fields['quantity'])
        if 'unit_price' in update_fields:
            update_fields['unit_price'] = float(update_fields['unit_price'])
        
        if not update_fields and not file:
            return jsonify({"success": False, "message": "No update data provided."}), 400

        update_fields["updated_at"] = datetime.utcnow()
        update_fields["updated_by"] = get_jwt_identity()

        if file:
            update_fields["image"] = upload_to_cloudinary(file)

        db = get_db()
        result = db["stock"].update_one(
            {"_id": ObjectId(item_id)}, # Find document by its unique _id
            {"$set": update_fields}
        )

        if result.modified_count > 0:
            # Optionally return the updated item
            updated_item = db["stock"].find_one({"_id": ObjectId(item_id)})
            updated_item["_id"] = str(updated_item["_id"]) # serialize ObjectId
            return jsonify({"success": True, "message": "Item updated successfully.", "data": updated_item}), 200
        else:
            return jsonify({"success": False, "message": "Item not found or no changes made."}), 404
            
        # --- END OF CHANGES ---

    except Exception as e:
        logger.error(f"Item update error: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500
@crud_bp.route("/delete", methods=["DELETE"])
@jwt_required()
def delete_item():
    try:
        data = request.get_json()
        item_id = data.get("id")
        if not item_id:
            return jsonify({"success": False, "message": "Item ID is required"}), 400

        db = get_db()
        item = db["stock"].find_one_and_delete({"_id": ObjectId(item_id)})

        if item:
            db["logs"].insert_one({
                "item_name": item.get("name"), "company": item.get("company"),
                "action": "delete", "timestamp": datetime.utcnow(), "performed_by": get_jwt_identity(),
            })
            logger.info(f"Item deleted: {item.get('name')} from {item.get('company')}")
            return jsonify({"success": True, "message": "Item deleted successfully"}), 200
        else:
            return jsonify({"success": False, "message": "Item not found"}), 404
    except Exception as e:
        logger.error(f"Item deletion error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to delete item"}), 500

@crud_bp.route("/item/<item_id>", methods=["GET"])
@jwt_required()
def get_item_details(item_id):
    try:
        db = get_db()
        item = db["stock"].find_one({"_id": ObjectId(item_id)})

        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404
        item["_id"] = str(item["_id"])

        return jsonify({"success": True, "data": item}), 200
    except Exception as e:
        logger.error(f"Error fetching item details for {item_id}: {str(e)}")
        return jsonify({"success": False, "message": "Failed to fetch item details"}), 500

@crud_bp.route("/names", methods=["GET"])
@jwt_required(optional=True)
def get_item_names():
    try:
        db = get_db()
        results = list(db["stock"].find({}, {"_id": 1, "name": 1, "company": 1}))
        for item in results:
            item["_id"] = str(item["_id"])
        return jsonify({"success": True, "data": results}), 200
    except Exception as e:
        logger.error(f"Error fetching item names: {str(e)}")
        return jsonify({"success": False, "message": "Failed to fetch item names"}), 500