# import logging
# import uuid
# from flask import Blueprint, request, jsonify
# from .db_config import get_db
# from datetime import datetime, date
# from flask_jwt_extended import jwt_required, get_jwt_identity
# from marshmallow import Schema, fields, validate
# from .utils import upload_to_cloudinary
# import random


# inventory_bp = Blueprint("inventory", __name__)
# logger = logging.getLogger(__name__)


# # Schema for inventory validation (with company)
# class InventorySchema(Schema):
#     name = fields.Str(required=True, validate=validate.Length(min=1))
#     company = fields.Str(required=True, validate=validate.Length(min=1))
#     unit_price = fields.Float(required=True, validate=validate.Range(min=0.01))
#     quantity = fields.Int(required=True, validate=validate.Range(min=1))
#     date_of_addition = fields.Date(required=True)
#     category = fields.Str()
#     minimum_stock = fields.Int()
#     hsn_code = fields.Str(required=True, validate=validate.Length(min=1))
#     image = fields.Str()


# @inventory_bp.route("/", methods=["GET"])
# @jwt_required()
# def get_inventory():
#     try:
#         search = request.args.get("search", "")

#         db = get_db()
#         collection = db["stock"]

#         query = {}
#         if search:
#             query["name"] = {"$regex": search, "$options": "i"}

#         inventory = list(collection.find(query, {"_id": 0}))
#         for item in inventory:
#             item["total_value"] = item["quantity"] * item["unit_price"]

#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "data": inventory,
#                 }
#             ),
#             200,
#         )
#     except Exception as e:
#         logger.error(f"Inventory retrieval error: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to retrieve inventory"}),
#             500,
#         )


# @inventory_bp.route("/add", methods=["POST"])
# @jwt_required()
# def add_item():
#     try:
#         # Parse form data instead of JSON
#         form = request.form
#         file = request.files.get("file")

#         name = form.get("name", "").strip().lower()
#         company = form.get("company", "").strip().lower()
#         unit_price = float(form.get("unit_price", 0))
#         quantity = int(form.get("quantity", 0))
#         date_str = form.get("date_of_addition")

#         try:
#             date_of_addition = datetime.strptime(date_str, "%Y-%m-%d")
#         except Exception:
#             return (
#                 jsonify(
#                     {
#                         "success": False,
#                         "message": "Invalid date format. Expected YYYY-MM-DD.",
#                     }
#                 ),
#                 400,
#             )

#         category = form.get("category")
#         minimum_stock = form.get("minimum_stock")
#         barcode = form.get("barcode")
#         hsn_code = form.get("hsn_code")

#         image_url = None
#         if file:
#             try:
#                 image_url = upload_to_cloudinary(file)
#             except Exception as e:
#                 return (
#                     jsonify(
#                         {"success": False, "message": f"Image upload failed: {str(e)}"}
#                     ),
#                     400,
#                 )
#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]

#         current_user = get_jwt_identity()

#         update_data = {
#             "$inc": {"quantity": quantity},
#             "$setOnInsert": {
#                 "unit_price": unit_price,
#                 "company": company,
#                 "category": category,
#                 "minimum_stock": int(minimum_stock) if minimum_stock else None,
#                 "barcode": barcode,
#                 "hsn_code": hsn_code,
#                 "image": image_url,
#                 "created_at": datetime.utcnow(),
#                 "created_by": current_user,
#             },
#             "$set": {
#                 "updated_at": datetime.utcnow(),
#                 "updated_by": current_user,
#                 "date_of_addition": date_of_addition,
#             },
#         }

#         stock_collection.update_one(
#             {"name": name, "company": company}, update_data, upsert=True
#         )

#         log_entry = {
#             "item_name": name,
#             "company": company,
#             "quantity_added": quantity,
#             "unit_price": unit_price,
#             "total_value": quantity * unit_price,
#             "category": category,
#             "barcode": barcode,
#             "hsn_code": hsn_code,
#             "timestamp": datetime.utcnow(),
#             "action": "add_inventory",
#             "performed_by": current_user,
#         }
#         log_collection.insert_one(log_entry)

#         item = stock_collection.find_one({"name": name, "company": company})
#         if (
#             item
#             and item.get("minimum_stock")
#             and item["quantity"] <= item["minimum_stock"]
#         ):
#             logger.warning(f"Low stock alert for item: {name} from {company}")

#         logger.info(
#             f"Item added: {name} from {company}, Quantity: {quantity}, Unit Price: {unit_price}"
#         )

#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "message": f"Item '{name}' from {company} added/updated successfully",
#                 }
#             ),
#             200,
#         )

#     except Exception as e:
#         logger.error(f"Item addition error: {str(e)}")
#         return jsonify({"success": False, "message": "Failed to add item"}), 500


# @inventory_bp.route("/sell", methods=["POST"])
# @jwt_required()
# def sell_item():
#     try:
#         data = request.json
#         item_name = data.get("item_name")
#         company = data.get("company")
#         quantity = data.get("quantity")
#         buyer = data.get("buyer")
#         price = data.get("price")

#         if not item_name or not company:
#             return (
#                 jsonify(
#                     {"success": False, "message": "Item name and company are required"}
#                 ),
#                 400,
#             )

#         item_name = item_name.strip().lower()
#         company = company.strip().lower()

#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]

#         item = stock_collection.find_one({"name": item_name, "company": company})
#         if not item:
#             return jsonify({"success": False, "message": "Item not found"}), 404
#         if item["quantity"] < quantity:
#             return jsonify({"success": False, "message": "Insufficient stock"}), 400

#         stock_collection.update_one(
#             {"name": item_name, "company": company}, {"$inc": {"quantity": -quantity}}
#         )

#         log_entry = {
#             "item_name": item_name,
#             "company": company,
#             "quantity_sold": quantity,
#             "buyer": buyer,
#             "price": price,
#             "timestamp": datetime.utcnow(),
#             "action": "sell",
#             "performed_by": get_jwt_identity(),
#         }
#         log_collection.insert_one(log_entry)

#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "message": f"Sold {quantity} of {item_name} from {company} to {buyer}",
#                 }
#             ),
#             200,
#         )
#     except Exception as e:
#         logger.error(f"Item sale error: {str(e)}")
#         return jsonify({"success": False, "message": "Failed to sell item"}), 500


# @inventory_bp.route("/delete", methods=["DELETE"])
# @jwt_required()
# def delete_item():
#     try:
#         data = request.get_json()
#         if not data or "name" not in data or "company" not in data:
#             return (
#                 jsonify(
#                     {"success": False, "message": "Item name and company are required"}
#                 ),
#                 400,
#             )

#         name = data.get("name").strip().lower()
#         company = data.get("company").strip().lower()

#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]

#         item = stock_collection.find_one({"name": name, "company": company})
#         if not item:
#             return jsonify({"success": False, "message": "Item not found"}), 404

#         stock_collection.delete_one({"name": name, "company": company})

#         log_entry = {
#             "item_name": name,
#             "company": company,
#             "action": "delete",
#             "quantity_deleted": item.get("quantity", 0),
#             "timestamp": datetime.utcnow(),
#             "performed_by": get_jwt_identity(),
#         }
#         log_collection.insert_one(log_entry)

#         logger.info(f"Item deleted: {name} from {company}")
#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "message": f"Item '{name}' from {company} deleted successfully",
#                 }
#             ),
#             200,
#         )

#     except Exception as e:
#         logger.error(f"Item deletion error: {str(e)}")
#         return jsonify({"success": False, "message": "Failed to delete item"}), 500


# @inventory_bp.route("/dashboard", methods=["GET"])
# @jwt_required()
# def get_dashboard_data():
#     try:
#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]

#         total_items = stock_collection.count_documents({})
#         total_value = sum(
#             item["quantity"] * item["unit_price"] for item in stock_collection.find({})
#         )
#         recent_activities = list(
#             log_collection.find({}, {"_id": 0}).sort("timestamp", -1).limit(10)
#         )

#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "data": {
#                         "total_items": total_items,
#                         "total_value": total_value,
#                         "recent_activities": recent_activities,
#                     },
#                 }
#             ),
#             200,
#         )
#     except Exception as e:
#         logger.error(f"Dashboard data retrieval error: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to retrieve dashboard data"}),
#             500,
#         )


# def convert_dates(obj):
#     """Recursively convert datetime/date objects to ISO formatted strings."""
#     if isinstance(obj, (datetime, date)):
#         return obj.isoformat()
#     elif isinstance(obj, dict):
#         return {key: convert_dates(value) for key, value in obj.items()}
#     elif isinstance(obj, list):
#         return [convert_dates(item) for item in obj]
#     return obj


# @inventory_bp.route("/by-date", methods=["GET"])
# @jwt_required()
# def get_inventory_by_date():
#     try:
#         date_str = request.args.get("date")
#         if not date_str:
#             return (
#                 jsonify({"success": False, "message": "Date parameter is required"}),
#                 400,
#             )

#         # Parse incoming date string as a datetime (with time set to midnight)
#         date_obj = datetime.strptime(date_str, "%Y-%m-%d")

#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]

#         # Query inventory items that have date_of_addition on the given date.
#         # If date_of_addition is stored as datetime, we use a range:
#         start_datetime = date_obj
#         end_datetime = datetime.combine(date_obj.date(), datetime.max.time())

#         inventory_items = list(
#             stock_collection.find(
#                 {"date_of_addition": {"$gte": start_datetime, "$lte": end_datetime}},
#                 {"_id": 0},
#             )
#         )

#         # Query logs where the timestamp falls within the day.
#         logs = list(
#             log_collection.find(
#                 {"timestamp": {"$gte": start_datetime, "$lte": end_datetime}},
#                 {"_id": 0},
#             )
#         )

#         # Recursively convert any date/datetime objects in our results
#         def convert_dates(obj):
#             if isinstance(obj, (datetime, date)):
#                 return obj.isoformat()
#             elif isinstance(obj, dict):
#                 return {key: convert_dates(value) for key, value in obj.items()}
#             elif isinstance(obj, list):
#                 return [convert_dates(item) for item in obj]
#             return obj

#         inventory_items = convert_dates(inventory_items)
#         logs = convert_dates(logs)

#         return (
#             jsonify(
#                 {"success": True, "data": {"inventory": inventory_items, "logs": logs}}
#             ),
#             200,
#         )
#     except Exception as e:
#         logger.error(f"Error in get_inventory_by_date: {str(e)}")
#         return (
#             jsonify(
#                 {
#                     "success": False,
#                     "message": "Failed to fetch data for the selected date",
#                 }
#             ),
#             500,
#         )


# @inventory_bp.route("/add-multiple", methods=["POST"])
# @jwt_required()
# def add_multiple_items():
#     try:
#         data = request.json
#         items = data.get("items", [])
#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]
#         current_user = get_jwt_identity()

#         messages = []
#         for d in items:
#             # Assume d is already validated and formatted.
#             name = d.get("name").strip().lower()
#             company = d.get("company").strip().lower()
#             unit_price = d.get("unit_price")
#             quantity = d.get("quantity")
#             date_of_addition = d.get("date_of_addition")
#             category = d.get("category")
#             minimum_stock = d.get("minimum_stock")

#             update_data = {
#                 "$inc": {"quantity": quantity},
#                 "$setOnInsert": {
#                     "unit_price": unit_price,
#                     "company": company,
#                     "category": category,
#                     "minimum_stock": minimum_stock,
#                     "created_at": datetime.utcnow(),
#                     "created_by": current_user,
#                 },
#                 "$set": {
#                     "updated_at": datetime.utcnow(),
#                     "updated_by": current_user,
#                     "date_of_addition": date_of_addition,
#                 },
#             }

#             stock_collection.update_one(
#                 {"name": name, "company": company}, update_data, upsert=True
#             )

#             log_entry = {
#                 "item_name": name,
#                 "company": company,
#                 "quantity_added": quantity,
#                 "unit_price": unit_price,
#                 "total_value": quantity * unit_price,
#                 "category": category,
#                 "timestamp": datetime.utcnow(),
#                 "action": "add_inventory",
#                 "performed_by": current_user,
#             }
#             log_collection.insert_one(log_entry)
#             messages.append(f"Item '{name}' from {company} added/updated successfully")

#         return jsonify({"success": True, "message": " | ".join(messages)}), 200
#     except Exception as e:
#         logger.error(f"Add multiple items error: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to add multiple items"}),
#             500,
#         )


# @inventory_bp.route("/sell-multiple", methods=["POST"])
# @jwt_required()
# def sell_multiple_items():
#     try:
#         data = request.json
#         sales = data.get("sales", [])
#         is_gst = data.get("is_gst", False)
#         recipient_gst = data.get("recipient_gst", "") if is_gst else None

#         db = get_db()
#         stock_collection = db["stock"]
#         log_collection = db["logs"]
#         current_user = get_jwt_identity()

#         # Validate recipient GST if is_gst is true
#         if is_gst and not recipient_gst:
#             return (
#                 jsonify(
#                     {
#                         "success": False,
#                         "message": "Recipient GSTIN required for GST invoices.",
#                     }
#                 ),
#                 400,
#             )

#         messages = []
#         invoice_type = "GST" if is_gst else "NON_GST"

#         # Generate invoice number based on year & invoice type
#         current_year = datetime.utcnow().year
#         prefix = f"{current_year}HE"
#         counter_id = f"{prefix}_{invoice_type}"  # e.g., 2025HE_GST or 2025HE_NON_GST

#         counter_doc = db["counters"].find_one_and_update(
#             {"_id": counter_id},
#             {"$inc": {"serial": 1}},
#             upsert=True,
#             return_document=True,
#         )
#         serial_no = counter_doc["serial"]
#         invoice_number = f"{prefix}{str(serial_no).zfill(5)}"

#         for sale in sales:
#             # Extract and normalize fields
#             item_name = sale.get("item_name", "").strip().lower()
#             company = sale.get("company", "").strip().lower()
#             quantity = int(sale.get("quantity", 0))
#             buyer = sale.get("buyer", "").strip()
#             price = float(sale.get("price", 0))
#             taxPercentage = float(sale.get("taxPercentage", 0))
#             taxIncluded = bool(sale.get("taxIncluded", False))
#             discount = float(sale.get("discount", 0))

#             # Validate fields
#             if not item_name or not company or quantity <= 0 or price <= 0 or not buyer:
#                 messages.append(
#                     f"Sale entry missing required fields for {item_name} from {company}."
#                 )
#                 continue

#             # Check for item existence and stock
#             item = stock_collection.find_one({"name": item_name, "company": company})
#             if not item:
#                 messages.append(f"Item {item_name} from {company} not found.")
#                 continue
#             if item["quantity"] < quantity:
#                 messages.append(f"Insufficient stock for {item_name} from {company}.")
#                 continue

#             # Deduct from inventory
#             stock_collection.update_one(
#                 {"name": item_name, "company": company},
#                 {"$inc": {"quantity": -quantity}},
#             )

#             # Calculate amounts
#             baseAmount = quantity * price
#             taxAmount = 0.0 if taxIncluded else baseAmount * (taxPercentage / 100)
#             finalAmount = baseAmount + taxAmount - discount

#             # Create log entry
#             log_entry = {
#                 "item_name": item_name,
#                 "company": company,
#                 "quantity_sold": quantity,
#                 "buyer": buyer,
#                 "price": price,
#                 "taxPercentage": taxPercentage,
#                 "taxIncluded": taxIncluded,
#                 "discount": discount,
#                 "final_amount": finalAmount,
#                 "timestamp": datetime.utcnow(),
#                 "action": "sell",
#                 "performed_by": current_user,
#                 "invoice_number": invoice_number,
#                 "invoice_type": invoice_type,
#             }

#             if is_gst:
#                 log_entry["recipient_gst"] = recipient_gst

#             log_collection.insert_one(log_entry)
#             messages.append(
#                 f"Sold {quantity} of {item_name} from {company} to {buyer} (Final Amount: ₹{finalAmount:.2f})"
#             )

#         if messages:
#             return (
#                 jsonify(
#                     {
#                         "success": True,
#                         "message": " | ".join(messages),
#                         "invoice_number": invoice_number,
#                     }
#                 ),
#                 200,
#             )
#         else:
#             return jsonify({"success": False, "message": "No sales processed"}), 400

#     except Exception as e:
#         logger.error(f"Sell multiple items error: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to process multiple sales"}),
#             500,
#         )


# @inventory_bp.route("/generate-invoice", methods=["POST"])
# @jwt_required()
# def generate_invoice():
#     try:
#         data = request.json

#         supplier = data.get("supplier")
#         if (
#             not supplier
#             or not supplier.get("name")
#             or not supplier.get("gstin")
#             or not supplier.get("address")
#         ):
#             return (
#                 jsonify(
#                     {"success": False, "message": "Incomplete supplier information."}
#                 ),
#                 400,
#             )

#         recipient = data.get("recipient", {})

#         date_str = data.get("date_of_issuance")
#         if not date_str:
#             return (
#                 jsonify({"success": False, "message": "Date of issuance is required."}),
#                 400,
#             )
#         try:
#             date_of_issuance = datetime.strptime(date_str, "%Y-%m-%d")
#         except Exception as e:
#             return (
#                 jsonify(
#                     {
#                         "success": False,
#                         "message": "Invalid date format for issuance. Expected YYYY-MM-DD.",
#                     }
#                 ),
#                 400,
#             )

#         items = data.get("items", [])
#         if not items:
#             return (
#                 jsonify(
#                     {"success": False, "message": "No items provided for the invoice."}
#                 ),
#                 400,
#             )

#         billing_address = data.get("billing_address", "")
#         shipping_address = data.get("shipping_address", "")
#         charge_type = data.get("charge_type", "forward")
#         signature = data.get("signature", "")

#         db = get_db()
#         invoice_total = 0
#         # For each item, calculate totals and check for HSN code.
#         for item in items:
#             qty = float(item.get("quantity", 0))
#             price = float(item.get("price", 0))
#             base_total = qty * price
#             tax_percentage = float(item.get("taxPercentage", 0))
#             tax_included = bool(item.get("taxIncluded", False))
#             discount = float(item.get("discount", 0))
#             tax_amount = 0
#             if not tax_included:
#                 tax_amount = base_total * (tax_percentage / 100)
#             item_total = base_total + tax_amount - discount
#             item["total"] = item_total
#             invoice_total += item_total

#             # If HSN code is missing, look it up in the inventory.
#             if not item.get("hsn_code"):
#                 inv_item = db["stock"].find_one(
#                     {
#                         "name": item.get("item_name").strip().lower(),
#                         "company": item.get("company").strip().lower(),
#                     }
#                 )
#                 if inv_item and "hsn_code" in inv_item and inv_item["hsn_code"]:
#                     item["hsn_code"] = inv_item["hsn_code"]
#                 else:
#                     item["hsn_code"] = ""  # or leave as empty string if not found

#         invoice_number = str(random.randint(10**15, 10**16 - 1))
#         current_user = get_jwt_identity()

#         invoice_data = {
#             "invoice_number": invoice_number,
#             "supplier": supplier,
#             "recipient": recipient,
#             "date_of_issuance": date_of_issuance,
#             "items": items,
#             "invoice_total": invoice_total,
#             "billing_address": billing_address,
#             "shipping_address": shipping_address,
#             "charge_type": charge_type,
#             "signature": signature,
#             "created_at": datetime.utcnow(),
#             "created_by": current_user,
#         }

#         result = db["invoices"].insert_one(invoice_data)
#         invoice_data["invoice_id"] = str(result.inserted_id)
#         if "_id" in invoice_data:
#             del invoice_data["_id"]

#         logger.info(f"Invoice {invoice_number} generated by user {current_user}")
#         return (
#             jsonify(
#                 {
#                     "success": True,
#                     "message": "Invoice generated successfully.",
#                     "invoice": invoice_data,
#                 }
#             ),
#             200,
#         )

#     except Exception as e:
#         logger.error(f"Error generating invoice: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to generate invoice."}),
#             500,
#         )


# # @inventory_bp.route('/generate-invoice', methods=['POST'])
# # @jwt_required()
# # def generate_invoice():
# #     try:
# #         data = request.json

# #         supplier = data.get("supplier")
# #         if not supplier or not supplier.get("name") or not supplier.get("gstin") or not supplier.get("address"):
# #             return jsonify({"success": False, "message": "Incomplete supplier information."}), 400

# #         recipient = data.get("recipient", {})

# #         date_str = data.get("date_of_issuance")
# #         if not date_str:
# #             return jsonify({"success": False, "message": "Date of issuance is required."}), 400
# #         try:
# #             date_of_issuance = datetime.strptime(date_str, "%Y-%m-%d")
# #         except Exception as e:
# #             return jsonify({"success": False, "message": "Invalid date format for issuance. Expected YYYY-MM-DD."}), 400

# #         items = data.get("items", [])
# #         if not items:
# #             return jsonify({"success": False, "message": "No items provided for the invoice."}), 400

# #         billing_address = data.get("billing_address", "")
# #         shipping_address = data.get("shipping_address", "")
# #         charge_type = data.get("charge_type", "forward")
# #         signature = data.get("signature", "")

# #         invoice_total = 0
# #         for item in items:
# #             qty = float(item.get("quantity", 0))
# #             price = float(item.get("price", 0))
# #             base_total = qty * price
# #             tax_percentage = float(item.get("taxPercentage", 0))
# #             tax_included = bool(item.get("taxIncluded", False))
# #             discount = float(item.get("discount", 0))
# #             tax_amount = 0
# #             if not tax_included:
# #                 tax_amount = base_total * (tax_percentage / 100)
# #             item_total = base_total + tax_amount - discount
# #             item["total"] = item_total
# #             invoice_total += item_total

# #         invoice_number = str(random.randint(10**15, 10**16 - 1))

# #         db = get_db()
# #         invoices_collection = db["invoices"]
# #         current_user = get_jwt_identity()

# #         invoice_data = {
# #             "invoice_number": invoice_number,
# #             "supplier": supplier,
# #             "recipient": recipient,
# #             "date_of_issuance": date_of_issuance,
# #             "items": items,
# #             "invoice_total": invoice_total,
# #             "billing_address": billing_address,
# #             "shipping_address": shipping_address,
# #             "charge_type": charge_type,
# #             "signature": signature,
# #             "created_at": datetime.utcnow(),
# #             "created_by": current_user
# #         }

# #         result = invoices_collection.insert_one(invoice_data)
# #         invoice_data["invoice_id"] = str(result.inserted_id)
# #         if "_id" in invoice_data:
# #             del invoice_data["_id"]

# #         logger.info(f"Invoice {invoice_number} generated by user {current_user}")
# #         return jsonify({
# #             "success": True,
# #             "message": "Invoice generated successfully.",
# #             "invoice": invoice_data
# #         }), 200

# #     except Exception as e:
# #         logger.error(f"Error generating invoice: {str(e)}")
# #         return jsonify({"success": False, "message": "Failed to generate invoice."}), 500


# @inventory_bp.route("/names", methods=["GET"])
# def get_item_names():
#     try:
#         db = get_db()
#         collection = db["stock"]

#         # Fetch all documents, projecting only name and _id fields
#         results = list(collection.find({}, {"_id": 1, "name": 1}))

#         # Convert ObjectId to string for JSON serialization
#         for item in results:
#             item["object_id"] = str(item["_id"])
#             del item["_id"]  # Remove original _id field

#         return jsonify({"success": True, "data": results}), 200

#     except Exception as e:
#         logger.error(f"Error fetching item names: {str(e)}")
#         return jsonify({"success": False, "message": "Failed to fetch item names"}), 500


# @inventory_bp.route("/item/<item_id>", methods=["GET"])
# def get_item_details(item_id):
#     try:
#         from bson import ObjectId

#         db = get_db()
#         collection = db["stock"]

#         item = collection.find_one({"_id": ObjectId(item_id)})

#         if not item:
#             return jsonify({"success": False, "message": "Item not found"}), 404

#         item["_id"] = str(item["_id"])

#         return jsonify({"success": True, "data": item}), 200

#     except Exception as e:
#         logger.error(f"Error fetching item details for {item_id}: {str(e)}")
#         return (
#             jsonify({"success": False, "message": "Failed to fetch item details"}),
#             500,
#         )


# # @inventory_bp.route('/hsn', methods=['GET'])
# # def get_hsn_code():
# #     try:
# #         item_name = request.args.get("name", "").strip().lower()
# #         db = get_db()
# #         inv_item = db["stock"].find_one({"name": item_name})
# #         if inv_item and "hsn_code" in inv_item:
# #             return jsonify({"success": True, "data": {"hsn_code": inv_item["hsn_code"]}}), 200
# #         else:
# #             return jsonify({"success": True, "data": {"hsn_code": ""}}), 200
# #     except Exception as e:
# #         logger.error(f"Error fetching HSN code: {str(e)}")
# #         return jsonify({"success": False, "message": "Failed to fetch HSN code"}), 500


# # @inventory_bp.route('/details', methods=['GET'])
# # @jwt_required(optional=True)
# # def get_inventory_details():
# #     try:
# #         # Get the item name from query parameters and normalize it.
# #         item_name = request.args.get("name", "").strip().lower()
# #         db = get_db()
# #         # Find the item in the stock collection.
# #         inv_item = db["stock"].find_one({"name": item_name})
# #         if inv_item:
# #             details = {
# #                 "available_quantity": inv_item.get("quantity", 0),
# #                 "unit_price": inv_item.get("unit_price", 0),
# #                 "image": inv_item.get("image", ""),       # URL or empty string if not available
# #                 "hsn_code": inv_item.get("hsn_code", ""),
# #                 "company": inv_item.get("company", "")
# #             }
# #             return jsonify({"success": True, "data": details}), 200
# #         else:
# #             # If no item is found, return default values.
# #             return jsonify({
# #                 "success": True,
# #                 "data": {
# #                     "available_quantity": 0,
# #                     "unit_price": 0,
# #                     "image": "",
# #                     "hsn_code": "",
# #                     "company": ""
# #                 }
# #             }), 200
# #     except Exception as e:
# #         logger.error(f"Error fetching item details: {str(e)}")
# #         return jsonify({"success": False, "message": "Failed to fetch item details"}), 500


# @inventory_bp.route("/update", methods=["PUT"])
# def update_item():
#     try:
#         # Check if files are in the request (multipart/form-data)
#         if request.files:
#             data = request.form.to_dict()
#             file = request.files.get("file")
#         else:
#             data = request.get_json()
#             file = None

#         original_name = data.get("originalName")
#         original_company = data.get("originalCompany")

#         update_data = {
#             "name": data.get("name"),
#             "company": data.get("company"),
#             "quantity": int(data.get("quantity")) if data.get("quantity") else None,
#             "unit_price": (
#                 float(data.get("unit_price")) if data.get("unit_price") else None
#             ),
#             "category": data.get("category"),
#             "barcode": data.get("barcode"),
#             "hsn_code": data.get("hsn_code"),
#             "updated_at": datetime.utcnow(),
#         }

#         # If a file is provided, upload it and update the "image" field.
#         if file:
#             image_url = upload_to_cloudinary(file)
#             update_data["image"] = image_url

#         db = get_db()
#         result = db["stock"].update_one(
#             {"name": original_name, "company": original_company}, {"$set": update_data}
#         )

#         if result.modified_count > 0:
#             return (
#                 jsonify({"success": True, "message": "Item updated successfully."}),
#                 200,
#             )
#         else:
#             return jsonify({"success": False, "message": "No changes made."}), 200

#     except Exception as e:
#         return jsonify({"success": False, "message": str(e)}), 500
