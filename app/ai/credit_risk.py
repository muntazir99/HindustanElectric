
import logging
from datetime import datetime, timedelta
from ..db_config import get_db
from bson import ObjectId

logger = logging.getLogger(__name__)

class CreditRiskEngine:
    def __init__(self):
        self.db = get_db()
        self.customers_collection = self.db["customers"]
        self.invoices_collection = self.db["invoices"]

    def calculate_credit_score(self, customer_id):
        """
        Calculates a credit risk score (0-100) for a customer.
        100 = Perfect Credit
        < 50 = High Risk
        """
        try:
            # 1. Fetch Customer Data
            try:
                customer = self.customers_collection.find_one({"_id": ObjectId(customer_id)})
            except:
                return {"success": False, "message": "Invalid Customer ID"}
            
            if not customer:
                return {"success": False, "message": "Customer not found"}

            score = 100
            factors = []
            
            current_balance = float(customer.get("current_balance", 0))
            credit_limit = float(customer.get("credit_limit", 0))

            # 2. Rule: Credit Utilization
            if credit_limit > 0:
                utilization = (current_balance / credit_limit) * 100
                if utilization > 100:
                    score -= 30
                    factors.append("Exceeded Credit Limit")
                elif utilization > 90:
                    score -= 15
                    factors.append("High Credit Utilization (>90%)")
                elif utilization > 75:
                    score -= 10
                    factors.append("Moderate Credit Utilization (>75%)")
            elif current_balance > 0:
                # No limit set but owes money
                score -= 5
                factors.append("Owes money (No Credit Limit set)")

            # 3. Rule: Unpaid Invoices Age
            # Find unpaid invoices for this customer
            unpaid_invoices = list(self.invoices_collection.find({
                "customer_id": customer_id,
                "status": "Unpaid"
            }))

            now = datetime.utcnow()
            overdue_count = 0
            
            for invoice in unpaid_invoices:
                created_at = invoice.get("created_at")
                if isinstance(created_at, str):
                    try:
                        # Attempt to parse ISO string if stored as string
                         created_at = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    except:
                        continue # specific format error
                
                if not created_at:
                    continue

                age_days = (now - created_at).days
                
                if age_days > 90:
                    score -= 20
                    overdue_count += 1
                    factors.append(f"Invoice overdue by >90 days ({age_days} days)")
                elif age_days > 60:
                    score -= 10
                    overdue_count += 1
                elif age_days > 30:
                    score -= 5
                    overdue_count += 1

            if overdue_count > 3:
                score -= 15
                factors.append("Multiple Overdue Invoices")

            # Clamp score
            score = max(0, min(100, score))

            # Determine Risk Level
            risk_level = "Low"
            color = "green"
            
            if score < 50:
                risk_level = "High"
                color = "red"
            elif score < 80:
                risk_level = "Medium"
                color = "yellow"

            return {
                "success": True,
                "data": {
                    "score": score,
                    "risk_level": risk_level,
                    "color": color,
                    "factors": list(set(factors)), # unique factors
                    "current_balance": current_balance,
                    "credit_limit": credit_limit
                }
            }

        except Exception as e:
            logger.error(f"Credit scoring error for {customer_id}: {str(e)}")
            return {"success": False, "message": str(e)}
