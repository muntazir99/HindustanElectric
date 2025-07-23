import logging
from flask import Blueprint, request, jsonify
from ..db_config import get_db
from datetime import datetime
from flask_jwt_extended import jwt_required, get_jwt_identity
from bson import ObjectId

sales_bp = Blueprint("inventory_sales", __name__)
logger = logging.getLogger(__name__)


@sales_bp.route("/sell", methods=["POST"])
@jwt_required()
def sell_item():
    try:
        data = request.json
        item_id = data.get("id")
        quantity = data.get("quantity")

        if not item_id or not quantity:
            return jsonify({"success": False, "message": "Item ID and quantity are required"}), 400

        db = get_db()
        stock_collection = db["stock"]

        item = stock_collection.find_one({"_id": ObjectId(item_id)})
        if not item:
            return jsonify({"success": False, "message": "Item not found"}), 404
        if item["quantity"] < quantity:
            return jsonify({"success": False, "message": "Insufficient stock"}), 400

        stock_collection.update_one(
            {"_id": ObjectId(item_id)},
            {"$inc": {"quantity": -quantity}}
        )

        db["logs"].insert_one({
            "item_name": item.get("name"), "company": item.get("company"),
            "quantity_sold": quantity, "buyer": data.get("buyer"),
            "action": "sell", "timestamp": datetime.utcnow(), "performed_by": get_jwt_identity(),
        })

        return jsonify({"success": True, "message": f"Sold {quantity} of {item.get('name')}."}), 200
    except Exception as e:
        logger.error(f"Item sale error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to sell item"}), 500

@sales_bp.route("/sell-multiple", methods=["POST"])
@jwt_required()
def sell_multiple_items():
    """
    Processes multiple sales by creating a single invoice document.
    Handles credit sales and updates customer balances.
    """
    try:
        data = request.json
        sales_items = data.get("sales", [])
        payment_method = data.get("payment_method", "Cash")
        customer_id = data.get("customer_id")
        
        db = get_db()
        stock_collection = db["stock"]
        customers_collection = db["customers"]
        invoices_collection = db["invoices"]
        current_user = get_jwt_identity()

        if not sales_items:
            return jsonify({"success": False, "message": "No sale items provided."}), 400

        total_invoice_amount = 0
        invoice_items = []
        customer = None

        # --- CORRECT CALCULATION LOGIC (from your original code) ---
        # First, calculate the total amount and prepare invoice items
        for sale in sales_items:
            price = float(sale.get("price", 0))
            quantity = int(sale.get("quantity", 0))
            discount = float(sale.get("discount", 0))
            tax_percentage = float(sale.get("taxPercentage", 0))
            tax_included = bool(sale.get("taxIncluded", False))

            base_amount = quantity * price
            tax_amount = 0
            if not tax_included:
                tax_amount = (base_amount - discount) * (tax_percentage / 100) # Tax on discounted price
            
            final_amount = base_amount - discount + tax_amount
            total_invoice_amount += final_amount
            
            # Add full details to the items list for the invoice
            invoice_items.append({
                "item_name": sale.get("item_name"),
                "company": sale.get("company"),
                "quantity": quantity,
                "price": price,
                "discount": discount,
                "taxPercentage": tax_percentage,
                "taxIncluded": tax_included,
                "final_amount": final_amount
            })

        # --- CREDIT HANDLING LOGIC (from your original code) ---
        if payment_method == "Credit":
            if not customer_id:
                return jsonify({"success": False, "message": "Customer ID is required for credit sales."}), 400
            
            customer = customers_collection.find_one({"_id": ObjectId(customer_id)})
            if not customer:
                return jsonify({"success": False, "message": "Customer not found."}), 404

            credit_limit = customer.get("credit_limit", 0)
            current_balance = customer.get("current_balance", 0)

            if (current_balance + total_invoice_amount) > credit_limit:
                return jsonify({
                    "success": False, 
                    "message": f"Sale exceeds credit limit. Available credit: ₹{(credit_limit - current_balance):.2f}"
                }), 400

        # --- CREATE INVOICE AND UPDATE STOCK ---
        invoice_status = "Unpaid" if payment_method == "Credit" else "Paid"
        invoice_number = f"INV-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"

        invoice_doc = {
            "invoice_number": invoice_number,
            "customer_id": customer_id,
            "customer_name": customer.get("name") if customer else (sales_items[0].get("buyer") or "Retail Customer"),
            "items": invoice_items,
            "total_amount": total_invoice_amount,
            "payment_method": payment_method,
            "status": invoice_status,
            "created_at": datetime.utcnow(),
            "created_by": current_user,
        }
        invoices_collection.insert_one(invoice_doc)

        # Deduct stock for each item sold
        for sale in sales_items:
            stock_collection.update_one(
                {"name": sale.get("item_name").strip().lower(), "company": sale.get("company").strip().lower()},
                {"$inc": {"quantity": -int(sale.get("quantity"))}}
            )
        
        # Update customer balance if it was a credit sale
        if payment_method == "Credit" and customer_id:
            customers_collection.update_one(
                {"_id": ObjectId(customer_id)},
                {"$inc": {"current_balance": total_invoice_amount}}
            )
            logger.info(f"Updated balance for customer {customer_id} by ₹{total_invoice_amount:.2f}")
        
        logger.info(f"Invoice {invoice_number} created for customer {customer_id or 'Retail'}")
        return jsonify({"success": True, "message": "Sale processed and invoice created.", "invoice_number": invoice_number}), 201

    except Exception as e:
        logger.error(f"Sell multiple items error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to process sales."}), 500