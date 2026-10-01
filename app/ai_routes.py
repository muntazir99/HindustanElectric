
from flask import Blueprint, request, jsonify
from flask_jwt_extended import jwt_required
from .ai.forecasting import ForecastingEngine
from .ai.credit_risk import CreditRiskEngine

ai_bp = Blueprint("ai", __name__)
forecasting_engine = ForecastingEngine()
credit_risk_engine = CreditRiskEngine()

@ai_bp.route("/credit-score/<string:customer_id>", methods=["GET"])
@jwt_required()
def get_credit_score(customer_id):
    """
    Get credit risk score for a specific customer.
    """
    result = credit_risk_engine.calculate_credit_score(customer_id)
    
    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400

@ai_bp.route("/forecast", methods=["POST"])
@jwt_required()
def get_forecast():
    """
    Get demand forecast for a specific item.
    Payload: { "item_name": "...", "company": "..." }
    """
    data = request.json
    item_name = data.get("item_name")
    company = data.get("company")

    if not item_name or not company:
        return jsonify({"success": False, "message": "Item name and company are required."}), 400

    result = forecasting_engine.predict_demand(item_name, company)
    
    if result["success"]:
        return jsonify(result), 200
    else:
        return jsonify(result), 400 # Or 200 with success:False depending on client pref, 400 implies "Bad Request" or logic fail
