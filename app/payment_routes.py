import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from flask_jwt_extended import jwt_required, get_jwt_identity
from datetime import datetime
from bson import ObjectId

payment_bp = Blueprint("payments", __name__)
logger = logging.getLogger(__name__)

@payment_bp.route("/", methods=["POST"])
@jwt_required()
def record_payment():
    """
    Records a payment against an invoice and updates the customer's balance.
    """
    try:
        data = request.json
        invoice_id = data.get("invoice_id")
        amount_paid = float(data.get("amount_paid"))
        payment_date = datetime.strptime(data.get("payment_date"), "%Y-%m-%d")
        
        if not invoice_id or amount_paid <= 0:
            return jsonify({"success": False, "message": "Invoice ID and a positive amount are required."}), 400

        db = get_db()
        invoices_collection = db["invoices"]
        customers_collection = db["customers"]

        # Find the invoice
        invoice = invoices_collection.find_one({"_id": ObjectId(invoice_id)})
        if not invoice:
            return jsonify({"success": False, "message": "Invoice not found."}), 404

        customer_id = invoice.get("customer_id")
        if not customer_id:
            return jsonify({"success": False, "message": "This invoice is not associated with a customer."}), 400
            
        # Update invoice status and add payment to its history
        invoices_collection.update_one(
            {"_id": ObjectId(invoice_id)},
            {
                "$set": {"status": "Paid"},
                "$push": {"payments": {"amount": amount_paid, "date": payment_date}}
            }
        )

        # Decrease the customer's balance
        customers_collection.update_one(
            {"_id": ObjectId(customer_id)},
            {"$inc": {"current_balance": -amount_paid}}
        )

        logger.info(f"Payment of {amount_paid} recorded for invoice {invoice_id}")
        return jsonify({"success": True, "message": "Payment recorded successfully."}), 200

    except Exception as e:
        logger.error(f"Payment recording error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to record payment."}), 500