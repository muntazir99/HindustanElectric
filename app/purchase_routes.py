import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate, ValidationError
from datetime import datetime
from bson import ObjectId

purchase_bp = Blueprint("purchases", __name__)
logger = logging.getLogger(__name__)

# --- Marshmallow Schema for Supplier Validation ---
class SupplierSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1))
    contact_person = fields.Str()
    phone = fields.Str()
    email = fields.Email()
    gstin = fields.Str()
    address = fields.Str()

class POItemSchema(Schema):
    item_id = fields.Str(required=True)
    name = fields.Str(required=True)
    quantity = fields.Int(required=True, validate=validate.Range(min=1))
    cost_price = fields.Float(required=True, validate=validate.Range(min=0))

class PurchaseOrderSchema(Schema):
    supplier_id = fields.Str(required=True)
    supplier_name = fields.Str(required=True)
    items = fields.List(fields.Nested(POItemSchema), required=True, validate=validate.Length(min=1))
    po_date = fields.Date(required=True)
    notes = fields.Str()

# --- API Endpoints for Suppliers ---

@purchase_bp.route("/suppliers", methods=["POST"])
@jwt_required()
def add_supplier():
    """
    Adds a new supplier to the database.
    Accessible only by 'admin' role.
    """
    # Role check
    # Note: Assumes your JWT setup includes a 'role' in the claims
    # claims = get_jwt()
    # if claims.get("role") != "admin":
    #     return jsonify({"success": False, "message": "Unauthorized"}), 403

    try:
        data = request.json
        # Validate input against the schema
        errors = SupplierSchema().validate(data)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        db = get_db()
        suppliers_collection = db["suppliers"]
        current_user = get_jwt_identity()

        # Check if supplier with the same name already exists
        if suppliers_collection.find_one({"name": data.get("name").strip().lower()}):
            return jsonify({"success": False, "message": "A supplier with this name already exists."}), 409

        supplier_doc = {
            "name": data.get("name").strip().lower(),
            "contact_person": data.get("contact_person"),
            "phone": data.get("phone"),
            "email": data.get("email"),
            "gstin": data.get("gstin"),
            "address": data.get("address"),
            "created_at": datetime.utcnow(),
            "created_by": current_user,
        }

        result = suppliers_collection.insert_one(supplier_doc)
        supplier_doc["_id"] = str(result.inserted_id) # Convert ObjectId to string for the response

        logger.info(f"Supplier '{supplier_doc['name']}' added by user {current_user}")
        return jsonify({"success": True, "message": "Supplier added successfully.", "data": supplier_doc}), 201

    except Exception as e:
        logger.error(f"Supplier addition error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to add supplier"}), 500


@purchase_bp.route("/suppliers", methods=["GET"])
@jwt_required()
def get_suppliers():
    """
    Retrieves a list of all suppliers.
    """
    try:
        db = get_db()
        suppliers_collection = db["suppliers"]
        
        # Find all suppliers, exclude the ObjectId from the result
        suppliers = []
        for supplier in suppliers_collection.find({}):
            supplier["_id"] = str(supplier["_id"])
            suppliers.append(supplier)

        return jsonify({"success": True, "data": suppliers}), 200

    except Exception as e:
        logger.error(f"Supplier retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve suppliers"}), 500

@purchase_bp.route("/orders", methods=["POST"])
@jwt_required()
def create_purchase_order():
    """
    Creates a new Purchase Order.
    Accessible only by 'admin' role.
    """
    # claims = get_jwt()
    # if claims.get("role") != "admin":
    #     return jsonify({"success": False, "message": "Unauthorized"}), 403

    try:
        data = request.json
        errors = PurchaseOrderSchema().validate(data)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        db = get_db()
        po_collection = db["purchase_orders"]
        current_user = get_jwt_identity()

        total_cost = sum(item['quantity'] * item['cost_price'] for item in data['items'])

        po_doc = {
            "supplier_id": data.get("supplier_id"),
            "supplier_name": data.get("supplier_name"),
            "items": data.get("items"),
            "po_date": datetime.strptime(data.get("po_date"), "%Y-%m-%d"),
            "total_cost": total_cost,
            "status": "Ordered",  # Initial status
            "notes": data.get("notes"),
            "created_at": datetime.utcnow(),
            "created_by": current_user,
        }

        result = po_collection.insert_one(po_doc)
        po_doc["_id"] = str(result.inserted_id)

        logger.info(f"Purchase Order created for supplier '{po_doc['supplier_name']}' by {current_user}")
        return jsonify({"success": True, "message": "Purchase Order created successfully.", "data": po_doc}), 201

    except Exception as e:
        logger.error(f"PO creation error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to create Purchase Order"}), 500


@purchase_bp.route("/orders", methods=["GET"])
@jwt_required()
def get_purchase_orders():
    """
    Retrieves a list of all purchase orders.
    """
    try:
        db = get_db()
        po_collection = db["purchase_orders"]
        
        # Fetch all POs and convert ObjectId to string
        purchase_orders = []
        for po in po_collection.find({}).sort("created_at", -1):
            po["_id"] = str(po["_id"])
            purchase_orders.append(po)

        return jsonify({"success": True, "data": purchase_orders}), 200

    except Exception as e:
        logger.error(f"PO retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve purchase orders"}), 500
    
class ReceiveValuesSchema(Schema):
    item_id = fields.Str(required=True)
    name = fields.Str()
    quantity = fields.Int(required=True, validate=validate.Range(min=0))
    cost_price = fields.Float(required=True, validate=validate.Range(min=0))

class ReceiveGoodsSchema(Schema):
    items = fields.List(fields.Nested(ReceiveValuesSchema), required=True, validate=validate.Length(min=1))

@purchase_bp.route("/orders/<string:order_id>/receive", methods=["POST"])
@jwt_required()
def receive_goods_for_po(order_id):
    """
    Receives goods against a PO, supports partial receipts, updates inventory,
    and intelligently updates the PO status.
    """
    try:
        data = request.json
        # Validate input
        schema = ReceiveGoodsSchema()
        try:
            validated_data = schema.load(data)
        except ValidationError as err:
             return jsonify({"success": False, "message": "Validation Error", "errors": err.messages}), 400

        items_being_received = validated_data["items"]

        db = get_db()
        po_collection = db["purchase_orders"]
        stock_collection = db["stock"]
        log_collection = db["logs"]
        current_user = get_jwt_identity()

        po = po_collection.find_one({"_id": ObjectId(order_id)})
        if not po:
            return jsonify({"success": False, "message": "Purchase Order not found."}), 404
        if po.get("status") == "Completed":
            return jsonify({"success": False, "message": "This order is already completed."}), 400

        # --- START OF NEW PARTIAL RECEIPT LOGIC ---

        # Use existing received items or initialize an empty list
        previously_received_items = po.get("received_items", [])
        
        # Process stock updates and logging for the items being received now
        for item_data in items_being_received:
            quantity_received_now = int(item_data.get("quantity"))
            if quantity_received_now > 0:
                # Update main stock collection and create logs (same as before)
                original_item = stock_collection.find_one({"_id": ObjectId(item_data.get("item_id"))})
                if not original_item: continue
                
                stock_collection.update_one(
                    {"_id": ObjectId(item_data.get("item_id"))},
                    {"$inc": {"quantity": quantity_received_now}, "$set": {"unit_price": item_data.get("cost_price")}}
                )
                log_collection.insert_one({
                    "item_name": original_item.get("name"), "company": original_item.get("company"),
                    "quantity_added": quantity_received_now, "unit_price": item_data.get("cost_price"),
                    "timestamp": datetime.utcnow(), "action": "goods_receipt", "source_po_id": order_id,
                    "performed_by": current_user,
                })

                # Add the current receipt to our list of received items for this PO
                previously_received_items.append({
                    "item_id": item_data.get("item_id"),
                    "name": item_data.get("name"),
                    "quantity_received": quantity_received_now,
                    "received_at": datetime.utcnow()
                })

        # Now, determine the final status by comparing totals
        total_ordered_map = {item['item_id']: item['quantity'] for item in po['items']}
        total_received_map = {}
        for item in previously_received_items:
            total_received_map[item['item_id']] = total_received_map.get(item['item_id'], 0) + item['quantity_received']

        is_fully_received = True
        for item_id, ordered_qty in total_ordered_map.items():
            if total_received_map.get(item_id, 0) < ordered_qty:
                is_fully_received = False
                break
        
        final_status = "Completed" if is_fully_received else "Partially Received"
        
        po_collection.update_one(
            {"_id": ObjectId(order_id)},
            {
                "$set": {
                    "status": final_status,
                    "received_items": previously_received_items, # Save the detailed history of receipts
                    "last_received_at": datetime.utcnow()
                }
            }
        )
        # --- END OF NEW LOGIC ---

        logger.info(f"Goods received for PO {order_id}. New status: '{final_status}'")
        return jsonify({"success": True, "message": f"Goods received. PO status updated to {final_status}."}), 200

    except Exception as e:
        logger.error(f"Goods receiving error for PO {order_id}: {str(e)}")
        return jsonify({"success": False, "message": "Failed to process goods receipt."}), 500
@purchase_bp.route("/orders/<string:order_id>", methods=["GET"])
@jwt_required()
def get_purchase_order_details(order_id):
    """
    Retrieves the full details for a single purchase order.
    """
    try:
        db = get_db()
        po = db["purchase_orders"].find_one({"_id": ObjectId(order_id)})
        if not po:
            return jsonify({"success": False, "message": "Purchase Order not found."}), 404
        
        po["_id"] = str(po["_id"])
        return jsonify({"success": True, "data": po}), 200
    except Exception as e:
        logger.error(f"Error fetching PO details for {order_id}: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve PO details."}), 500

# --- NEW: Endpoint to manually close a Purchase Order ---

@purchase_bp.route("/orders/<string:order_id>/close", methods=["POST"])
@jwt_required()
def close_purchase_order(order_id):
    """
    Manually closes a Purchase Order. Sets the status to 'Completed' or
    'Completed with Variance' based on received quantities.
    """
    try:
        db = get_db()
        po_collection = db["purchase_orders"]
        po = po_collection.find_one({"_id": ObjectId(order_id)})

        if not po:
            return jsonify({"success": False, "message": "Purchase Order not found."}), 404
        if po.get("status") == "Completed":
            return jsonify({"success": False, "message": "Order is already completed."}), 400

        # Determine if there is a variance
        has_variance = False
        total_ordered_map = {item['item_id']: item['quantity'] for item in po.get('items', [])}
        
        # Calculate total received from the received_items log
        total_received_map = {}
        for item in po.get("received_items", []):
            total_received_map[item['item_id']] = total_received_map.get(item['item_id'], 0) + item['quantity_received']

        for item_id, ordered_qty in total_ordered_map.items():
            if total_received_map.get(item_id, 0) != ordered_qty:
                has_variance = True
                break
        
        final_status = "Completed with Variance" if has_variance else "Completed"

        po_collection.update_one(
            {"_id": ObjectId(order_id)},
            {"$set": {"status": final_status, "closed_at": datetime.utcnow()}}
        )
        
        logger.info(f"PO {order_id} manually closed with status '{final_status}'")
        return jsonify({"success": True, "message": f"Order manually closed with status: {final_status}"}), 200

    except Exception as e:
        logger.error(f"Error closing PO {order_id}: {str(e)}")
        return jsonify({"success": False, "message": "Failed to close Purchase Order."}), 500