import logging
from datetime import datetime
from flask import jsonify, request
from app.database import db_instance
from auth.service import hash_password, verify_password, generate_token
from auth.schemas import LoginSchema, CreateUserSchema
from flask_jwt_extended import get_jwt_identity

logger = logging.getLogger(__name__)

def handle_login():
    schema = LoginSchema()
    errors = schema.validate(request.json)
    if errors:
        return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

    data = request.json
    username = data['username']
    password = data['password']

    users = db_instance.get_collection('users')
    user = users.find_one({"username": username})

    if not user or not verify_password(password, user['password']):
        logger.warning(f"Login attempt failed for user: {username}")
        return jsonify({"success": False, "message": "Invalid credentials"}), 401

    token = generate_token(identity=str(user['_id']), role=user.get("role", "user"))

    logger.info(f"User {username} logged in successfully")
    return jsonify({"success": True, "token": token, "role": user["role"]}), 200


def handle_user_creation():
    schema = CreateUserSchema()
    errors = schema.validate(request.json)
    if errors:
        return jsonify({"success": False, "message": "Validation error", "errors": errors}), 400

    data = request.json
    username = data['username']
    password = data['password']
    role = data.get('role', 'user')

    users = db_instance.get_collection('users')

    if users.find_one({"username": username}):
        logger.warning(f"User creation attempt for existing user: {username}")
        return jsonify({"success": False, "message": "User already exists"}), 409

    hashed_password = hash_password(password)
    users.insert_one({"username": username, "password": hashed_password, "role": role, "created_at": datetime.utcnow()})

    logger.info(f"User {username} created successfully")
    return jsonify({"success": True, "message": f"User '{username}' created"}), 201