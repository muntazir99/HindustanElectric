import bcrypt
from flask_jwt_extended import create_access_token
from datetime import timedelta

def hash_password(password):
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password, hashed_password):
    return bcrypt.checkpw(password.encode('utf-8'), hashed_password.encode('utf-8'))

def generate_token(identity, role):
    return create_access_token(identity=identity, additional_claims={"role": role}, expires_delta=timedelta(hours=1))