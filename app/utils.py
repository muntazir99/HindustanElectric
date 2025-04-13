import re
import bcrypt
import cloudinary
from cloudinary.uploader import upload
import cloudinary.api
import os
from dotenv import load_dotenv
from datetime import datetime
from werkzeug.utils import secure_filename
from werkzeug.datastructures import FileStorage

load_dotenv()

cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"),
    api_key=os.getenv("CLOUDINARY_API_KEY"),
    api_secret=os.getenv("CLOUDINARY_API_SECRET"),
    secure=True,
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


def generate_invoice_number(is_gst: bool, db):
    current_year = datetime.utcnow().year
    bill_type = "GST" if is_gst else "NON"
    prefix = f"{current_year}HE{bill_type}"

    counter_doc = db["counters"].find_one_and_update(
        {"_id": prefix},
        {"$inc": {"serial": 1}},
        upsert=True,
        return_document=True,
    )

    serial_no = counter_doc["serial"]
    invoice_number = f"{prefix}{str(serial_no).zfill(5)}"

    return invoice_number


def upload_to_cloudinary(file: FileStorage, folder: str = "inventory_docs") -> str:
    try:
        # Validate file extension
        allowed_extensions = {"jpg", "jpeg", "png", "gif", "bmp", "webp", "pdf"}
        filename = secure_filename(file.filename).lower()
        file_extension = filename.rsplit(".", 1)[-1] if "." in filename else ""

        if file_extension not in allowed_extensions:
            raise Exception(
                f"Unsupported file type: {file_extension}. Allowed: {', '.join(allowed_extensions)}"
            )

        # Determine resource type
        resource_type = "image" if file_extension != "pdf" else "raw"

        # Upload to Cloudinary
        response = cloudinary.uploader.upload(
            file,
            resource_type=resource_type,
            folder=folder,
            public_id=f"inventory_{filename}",
            use_filename=True,
            unique_filename=False,
            overwrite=True,
        )

        secure_url = response.get("secure_url")
        if not secure_url:
            raise Exception("Cloudinary did not return a secure URL")

        return secure_url

    except (
        cloudinary.exceptions.Error,
        cloudinary.api.Error,
        cloudinary.exceptions.InvalidSignature,
        cloudinary.exceptions.InvalidApiKey,
    ) as e:
        raise Exception(f"Cloudinary upload failed: {str(e)}")
