import logging
from flask import Blueprint, request, jsonify
from .db_config import get_db
from .utils import hash_password, verify_password, validate_password
from flask_jwt_extended import create_access_token, jwt_required, get_jwt_identity
from marshmallow import Schema, fields, validate

auth_bp = Blueprint('auth', __name__)
logger = logging.getLogger(__name__)

# Validation schemas
class LoginSchema(Schema):
    username = fields.Str(required=True)
    password = fields.Str(required=True)

class CreateUserSchema(Schema):
    username = fields.Str(required=True, validate=validate.Length(min=3))
    password = fields.Str(required=True, validate=validate.Length(min=8))
    role = fields.Str(validate=validate.OneOf(['user', 'admin']))

@auth_bp.route('/login', methods=['POST'])
def login():
    try:
        # Validate input
        schema = LoginSchema()
        errors = schema.validate(request.json)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        data = request.json
        username = data.get("username")
        password = data.get("password")

        db = get_db()
        collection = db["users"]
        user = collection.find_one({"username": username})

        if not user or not verify_password(password, user["password"]):
            logger.warning(f"Login attempt failed for user: {username}")
            return jsonify({"success": False, "message": "Invalid credentials"}), 401

        # Create access token
        access_token = create_access_token(
            identity=str(user['_id']),
            additional_claims={"role": user.get("role", "user")}
        )

        logger.info(f"User {username} logged in successfully")
        return jsonify({
            "success": True,
            "message": "Login successful",
            "token": access_token,
            "role": user["role"]
        }), 200

    except Exception as e:
        logger.error(f"Login error: {str(e)}")
        return jsonify({"success": False, "message": "Login failed"}), 500

@auth_bp.route('/create_user', methods=['POST'])
@jwt_required()  # Require authentication
def create_user():
    try:
        # Check if requester is admin
        claims = get_jwt_identity()
        if claims.get('role') != 'admin':
            return jsonify({"success": False, "message": "Unauthorized"}), 403

        # Validate input
        schema = CreateUserSchema()
        errors = schema.validate(request.json)
        if errors:
            return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

        data = request.json
        username = data.get("username")
        password = data.get("password")
        role = data.get("role", "user")

        if not validate_password(password):
            return jsonify({
                "success": False,
                "message": "Password must contain at least 8 characters, one uppercase, one lowercase, and one number"
            }), 400

        db = get_db()
        collection = db["users"]

        if collection.find_one({"username": username}):
            logger.warning(f"User creation attempt for existing user: {username}")
            return jsonify({"success": False, "message": "User already exists"}), 409

        hashed_password = hash_password(password)
        collection.insert_one({
            "username": username,
            "password": hashed_password,
            "role": role,
            "created_at": datetime.utcnow()
        })

        logger.info(f"User {username} created successfully")
        return jsonify({"success": True, "message": f"User '{username}' created"}), 201

    except Exception as e:
        logger.error(f"User creation error: {str(e)}")
        return jsonify({"success": False, "message": "User creation failed"}), 500