import logging
from logging.handlers import RotatingFileHandler
from flask import Flask, jsonify
from flask_cors import CORS
from datetime import timedelta
from flask_jwt_extended import JWTManager
from .auth_routes import auth_bp
from .inventory_routes import inventory_bp
from .log_routes import log_bp

def configure_logging():
    log_file = "app.log"
    log_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5  # 10 MB file size limit, 5 backups
    )
    log_handler.setLevel(logging.INFO)
    log_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    log_handler.setFormatter(log_formatter)

    # Get the root logger and configure it
    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.addHandler(logging.StreamHandler())

def create_app():
    app = Flask(__name__)
    app.config['JWT_SECRET_KEY'] = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c'
    app.config['JWT_ACCESS_TOKEN_EXPIRES'] = timedelta(hours=1)
    
    # Initialize JWT
    jwt = JWTManager(app)
    
    # Configure CORS with more specific settings
    CORS(app, resources={
        r"/*": {
            "origins": ["http://localhost:3000"],  # Add your frontend URL
            "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
            "allow_headers": ["Content-Type", "Authorization"]
        }
    })
    
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

    app.register_blueprint(auth_bp, url_prefix='/auth')
    app.register_blueprint(inventory_bp, url_prefix='/inventory')
    app.register_blueprint(log_bp, url_prefix='/logs')

    return app