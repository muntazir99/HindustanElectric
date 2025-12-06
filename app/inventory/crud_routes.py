import logging
from flask import Blueprint, request, jsonify
from ..db_config import get_db
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from ..utils import upload_to_cloudinary
from bson import ObjectId
from marshmallow import Schema, fields, validate, ValidationError

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
    barcode = fields.Str()
    image = fields.Str()


@crud_bp.route("/", methods=["GET"])
@jwt_required()
def get_inventory():
    try:
        # Pagination parameters
        page = int(request.args.get("page", 1))
        limit = int(request.args.get("limit", 50))
        skip = (page - 1) * limit
        
        search = request.args.get("search", "")
        db = get_db()
        collection = db["stock"]

        match_stage = {}
        if search:
            match_stage["name"] = {"$regex": search, "$options": "i"}

        # Use $facet to get both the data and the total count in one go
        pipeline = [
            {"$match": match_stage},
            {
                "$facet": {
                    "metadata": [{"$count": "total"}],
                    "data": [
                        {"$skip": skip},
                        {"$limit": limit},
                        {
                            "$addFields": {
                                "total_value": {"$multiply": ["$quantity", "$unit_price"]},
                                "_id": {"$toString": "$_id"}
                            }
                        }
                    ]
                }
            }
        ]

        result = list(collection.aggregate(pipeline))[0]
        
        inventory = result["data"]
        total_count = result["metadata"][0]["total"] if result["metadata"] else 0
        total_pages = (total_count + limit - 1) // limit

        return jsonify({
            "success": True, 
            "data": inventory,
            "pagination": {
                "current_page": page,
                "total_pages": total_pages,
                "total_items": total_count,
                "limit": limit
            }
        }), 200
    except Exception as e:
        logger.error(f"Inventory retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve inventory"}), 500

@crud_bp.route("/add", methods=["POST"])
@jwt_required()
def add_item():
    try:
        # Validate data using Marshmallow Schema
        schema = InventorySchema()
        try:
            # request.form is an ImmutableMultiDict, convert to dict for marshmallow
            form_data = request.form.to_dict()
            clean_data = schema.load(form_data)
        except ValidationError as err:
             return jsonify({"success": False, "message": "Validation Error", "errors": err.messages}), 400

        file = request.files.get("file")
        
        # Extract validated data
        name = clean_data["name"].strip().lower()
        company = clean_data["company"].strip().lower()
        unit_price = clean_data["unit_price"]
        quantity = clean_data["quantity"]
        date_of_addition = clean_data["date_of_addition"] # Already a date object
        category = clean_data.get("category")
        minimum_stock = clean_data.get("minimum_stock")
        hsn_code = clean_data.get("hsn_code")
        barcode = request.form.get("barcode") # not in schema yet? checking existing schema

        # Check existing schema:
        # barcode was NOT in the InventorySchema in previous file content!
        # Schema had: name, company, unit_price, quantity, date_of_addition, category, minimum_stock, hsn_code, image
        # Original code used: barcode = form.get("barcode")
        # So I should probably add barcode to schema or manually get it. 
        # Ideally add to schema.
        
        image_url = upload_to_cloudinary(file) if file else None
        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()
        
        # Create a datetime for date_of_addition from the date object
        # The original code did: datetime.strptime(date_str, "%Y-%m-%d")
        # Marshmallow gives a date object (datetime.date). 
        # MongoDB usually stores datetime.datetime.
        date_of_addition_dt = datetime.combine(date_of_addition, datetime.min.time())

        update_data = {
            "$inc": {"quantity": quantity},
            "$setOnInsert": {
                "unit_price": unit_price, "company": company, "category": category,
                "minimum_stock": minimum_stock,
                "barcode": barcode, "hsn_code": hsn_code, "image": image_url,
                "created_at": datetime.utcnow(), "created_by": current_user,
            },
            "$set": {"updated_at": datetime.utcnow(), "updated_by": current_user, "date_of_addition": date_of_addition_dt},
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
    except Exception as e:
        logger.error(f"Item update error: {str(e)}")
        return jsonify({"success": False, "message": str(e)}), 500

@crud_bp.route("/restock", methods=["POST"])
@jwt_required()
def restock_item():
    """
    Dedicated endpoint for restocking items.
    Updates Weighted Average Cost (WAC) and Price History (Max/Min).
    """
    try:
        data = request.get_json()
        item_id = data.get("id")
        added_quantity = int(data.get("added_quantity", 0))
        new_unit_price = float(data.get("new_unit_price", 0.0))

        if not item_id:
            return jsonify({"success": False, "message": "Item ID is required."}), 400
        if added_quantity <= 0:
            return jsonify({"success": False, "message": "Quantity must be positive."}), 400
        if new_unit_price <= 0:
            return jsonify({"success": False, "message": "Price must be positive."}), 400

        db = get_db()
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()

        # 1. Fetch current item state
        current_item = stock_collection.find_one({"_id": ObjectId(item_id)})
        if not current_item:
            return jsonify({"success": False, "message": "Item not found."}), 404

        current_qty = int(current_item.get("quantity", 0))
        current_avg_price = float(current_item.get("unit_price", 0.0))
        
        # 2. Historical Price Logic
        historical_max = float(current_item.get("historical_max_price", current_avg_price))
        historical_min = float(current_item.get("historical_min_price", current_avg_price))

        # Check against the NEW incoming price
        if new_unit_price > historical_max:
            historical_max = new_unit_price
        if new_unit_price < historical_min:
            historical_min = new_unit_price

        # 3. WAC Calculation
        # Formula: ((OldQty * OldPrice) + (NewQty * NewPrice)) / (OldQty + NewQty)
        total_qty = current_qty + added_quantity
        total_value = (current_qty * current_avg_price) + (added_quantity * new_unit_price)
        new_avg_price = total_value / total_qty

        # 4. Update Database
        update_doc = {
            "$set": {
                "quantity": total_qty,
                "unit_price": new_avg_price, # The new WAC
                "historical_max_price": historical_max,
                "historical_min_price": historical_min,
                "updated_at": datetime.utcnow(),
                "updated_by": current_user
            }
        }

        stock_collection.update_one({"_id": ObjectId(item_id)}, update_doc)

        # 5. Log Transaction
        log_collection.insert_one({
            "item_name": current_item.get("name"),
            "company": current_item.get("company"),
            "quantity_added": added_quantity,
            "incoming_unit_price": new_unit_price,
            "new_moving_average": new_avg_price,
            "action": "restock",
            "timestamp": datetime.utcnow(),
            "performed_by": current_user
        })

        return jsonify({
            "success": True, 
            "message": f"Restocked successfully. New WAC: {new_avg_price:.2f}",
            "data": {
                "new_quantity": total_qty,
                "new_wac": new_avg_price,
                "max_price": historical_max,
                "min_price": historical_min
            }
        }), 200

    except Exception as e:
        logger.error(f"Restock error: {str(e)}")
        return jsonify({"success": False, "message": f"Restock failed: {str(e)}"}), 500
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