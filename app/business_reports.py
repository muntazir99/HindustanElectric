import logging
from flask import Blueprint, jsonify
from .db_config import get_db
from flask_jwt_extended import jwt_required
from datetime import datetime, timedelta

# Define a new blueprint with a unique name
business_report_bp = Blueprint("business_reports", __name__)
logger = logging.getLogger(__name__)

@business_report_bp.route("/aging", methods=["GET"])
@jwt_required()
def get_aging_report():
    """
    Generates an Accounts Receivable Aging Report.
    Groups unpaid invoices by customer and time buckets.
    """
    try:
        db = get_db()
        # Note: We will create the 'invoices' collection in the next step
        invoices_collection = db["invoices"]
        
        unpaid_invoices = invoices_collection.find({"status": "Unpaid"})
        
        report = {}
        today = datetime.utcnow()

        for invoice in unpaid_invoices:
            customer_name = invoice.get("customer_name", "Unknown Customer").capitalize()
            if customer_name not in report:
                report[customer_name] = {
                    "0-30": 0, "31-60": 0, "61-90": 0, "90+": 0, "total": 0
                }
            
            days_overdue = (today - invoice["created_at"]).days
            amount = invoice["total_amount"]
            
            if days_overdue <= 30:
                report[customer_name]["0-30"] += amount
            elif 31 <= days_overdue <= 60:
                report[customer_name]["31-60"] += amount
            elif 61 <= days_overdue <= 90:
                report[customer_name]["61-90"] += amount
            else:
                report[customer_name]["90+"] += amount
            
            report[customer_name]["total"] += amount

        return jsonify({"success": True, "data": report}), 200

    except Exception as e:
        logger.error(f"Aging report generation error: {str(e)}")
        return jsonify({"success": False, "message": "Failed to generate aging report."}), 500