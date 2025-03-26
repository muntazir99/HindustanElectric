from flask import Blueprint
from flask_jwt_extended import jwt_required
from auth.controller import handle_login, handle_user_creation

auth_bp = Blueprint('auth', __name__)

@auth_bp.route('/login', methods=['POST'])
def login():
    return handle_login()

@auth_bp.route('/create_user', methods=['POST'])
@jwt_required()
def create_user():
    return handle_user_creation()