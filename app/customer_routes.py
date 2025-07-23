import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from flask_jwt_extended import jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate
from datetime import datetime
from bson import ObjectId

customer_bp = Blueprint("customers", __name__)
logger = logging.getLogger(__name__)

# --- Marshmallow Schema for Customer Validation ---
class CustomerSchema(Schema):
    name = fields.Str(required=True, validate=validate.Length(min=1))
    gstin = fields.Str()
    address = fields.Str()
    credit_limit = fields.Float(load_default=0.0)
    # --- ADDED ---
    price_tier = fields.Str(load_default="Retail", validate=validate.OneOf(["Retail", "Wholesale_A", "Wholesale_B"]))
    current_balance = fields.Float(dump_default=0.0)

# --- API Endpoints for Customers ---

@customer_bp.route("/", methods=["POST"])
@jwt_required()
def add_customer():
    """
    Adds a new wholesale customer to the database.
    """
    try:
        data = request.json
        errors = CustomerSchema().validate(data)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        db = get_db()
        customers_collection = db["customers"]
        current_user = get_jwt_identity()

        if customers_collection.find_one({"name": data.get("name").strip().lower()}):
            return jsonify({"success": False, "message": "A customer with this name already exists."}), 409

        customer_doc = {
            "name": data.get("name").strip().lower(),
            "gstin": data.get("gstin"),
            "address": data.get("address"),
            "credit_limit": data.get("credit_limit", 0.0),
            "current_balance": 0.0,
            # --- ADDED ---
            "price_tier": data.get("price_tier", "Retail"),
            "created_at": datetime.utcnow(),
            "created_by": current_user,
        }

        result = customers_collection.insert_one(customer_doc)
        customer_doc["_id"] = str(result.inserted_id)

        logger.info(f"Customer '{customer_doc['name']}' added by user {current_user}")
        return jsonify({"success": True, "message": "Customer added successfully.", "data": customer_doc}), 201

    except Exception as e:
        logger.error(f"Customer addition error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to add customer"}), 500

@customer_bp.route("/", methods=["GET"])
@jwt_required()
def get_customers():
    """
    Retrieves a list of all customers.
    """
    try:
        db = get_db()
        customers = []
        for customer in db["customers"].find({}).sort("name", 1):
            customer["_id"] = str(customer["_id"])
            customers.append(customer)

        return jsonify({"success": True, "data": customers}), 200

    except Exception as e:
        logger.error(f"Customer retrieval error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve customers"}), 500

@customer_bp.route("/<string:customer_id>", methods=["PATCH"])
@jwt_required()
def update_customer_balance(customer_id):
    """
    Updates a customer's balance. Intended for use after credit sales or payments.
    """
    try:
        data = request.json
        amount_change = data.get("amount_change")

        if not isinstance(amount_change, (int, float)):
            return jsonify({"success": False, "message": "Invalid amount provided."}), 400

        db = get_db()
        customers_collection = db["customers"]
        
        result = customers_collection.find_one_and_update(
            {"_id": ObjectId(customer_id)},
            {"$inc": {"current_balance": amount_change}},
            return_document=True
        )

        if not result:
            return jsonify({"success": False, "message": "Customer not found."}), 404
        
        result["_id"] = str(result["_id"])
        logger.info(f"Updated balance for customer {customer_id} by {amount_change}")
        return jsonify({"success": True, "message": "Customer balance updated.", "data": result}), 200

    except Exception as e:
        logger.error(f"Customer balance update error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to update customer balance."}), 500

@customer_bp.route("/<string:customer_id>/unpaid-invoices", methods=["GET"])
@jwt_required()
def get_customer_unpaid_invoices(customer_id):
    """
    Retrieves a list of all 'Unpaid' invoices for a specific customer.
    """
    try:
        db = get_db()
        invoices_collection = db["invoices"]
        
        # Find all invoices for this customer that are still marked as Unpaid
        query = {
            "customer_id": customer_id,
            "status": "Unpaid"
        }
        
        invoices = []
        for invoice in invoices_collection.find(query).sort("created_at", 1): # Sort by oldest first
            invoice["_id"] = str(invoice["_id"])
            invoices.append(invoice)

        return jsonify({"success": True, "data": invoices}), 200

    except Exception as e:
        logger.error(f"Error retrieving unpaid invoices for customer {customer_id}: {str(e)}")
        return jsonify({"success": False, "message": "Failed to retrieve unpaid invoices."}), 500