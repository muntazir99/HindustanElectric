import re
import bcrypt
import cloudinary
import cloudinary.uploader
import cloudinary.api
import os
from dotenv import load_dotenv

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
)


def hash_password(password):
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(password, hashed):
    return bcrypt.checkpw(password.encode("utf-8"), hashed.encode("utf-8"))


def validate_password(password):
    """
    Validate password strength:
    - At least 8 characters
    - Contains at least one uppercase, one lowercase, one number
    """
    if len(password) < 8:
        return False

    if not re.search(r"[A-Z]", password):
        return False

    if not re.search(r"[a-z]", password):
        return False

    if not re.search(r"\d", password):
        return False

    return True


def upload_to_cloudinary(file, folder="inventory_docs"):
    try:
        result = cloudinary.uploader.upload(file, folder=folder, resource_type="auto")
        return result.get("secure_url")
    except Exception as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")
