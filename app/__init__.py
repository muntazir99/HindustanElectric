import logging
import os
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import timedelta
from flask_jwt_extended import JWTManager
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Import blueprints
from .auth_routes import auth_bp
from .log_routes import log_bp
from .upload_routes import upload_bp
from .inventory.crud_routes import crud_bp
from .inventory.sales_routes import sales_bp
from .inventory.invoice_routes import invoice_bp
from .inventory.reporting_routes import reporting_bp
from .purchase_routes import purchase_bp
from .customer_routes import customer_bp
from .business_reports import business_report_bp
from .payment_routes import payment_bp


def configure_logging():
    log_file = "app.log"
    log_handler = RotatingFileHandler(log_file, maxBytes=10*1024*1024, backupCount=5)
    log_handler.setLevel(logging.INFO)
    log_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    log_handler.setFormatter(log_formatter)
    
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.addHandler(logging.StreamHandler())


def create_app():
    app = Flask(__name__)
    
    # Configuration
    app.config["JWT_SECRET_KEY"] = os.getenv("JWT_SECRET_KEY", "default-fallback-secret")
    app.config["JWT_ACCESS_TOKEN_EXPIRES"] = timedelta(hours=1)
    
    # Initialize extensions
    JWTManager(app)
    CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)

    configure_logging()

    # Global error handler
    @app.errorhandler(Exception)
    def handle_global_exception(e):
        logging.error(f"Unhandled Exception: {str(e)}", exc_info=True)
        return jsonify({
            "success": False, 
            "message": "Internal server error",
            "error": str(e) if app.debug else "An unexpected error occurred"
        }), 500

    # Register blueprints with URL prefixes
    app.register_blueprint(auth_bp, url_prefix="/auth")
    app.register_blueprint(log_bp, url_prefix="/logs")
    app.register_blueprint(upload_bp, url_prefix="/upload")

    # Register new modular inventory blueprints
    app.register_blueprint(crud_bp, url_prefix="/inventory")
    app.register_blueprint(sales_bp, url_prefix="/inventory")
    app.register_blueprint(invoice_bp, url_prefix="/inventory")
    app.register_blueprint(reporting_bp, url_prefix="/inventory/reports") # Using a sub-prefix for clarity
    app.register_blueprint(purchase_bp, url_prefix="/purchases")
    app.register_blueprint(customer_bp, url_prefix="/customers")
    app.register_blueprint(business_report_bp, url_prefix="/reports")
    app.register_blueprint(payment_bp, url_prefix="/payments") 

    return app
