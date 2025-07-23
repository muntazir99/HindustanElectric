import os
import socket
from dotenv import load_dotenv
from app import create_app
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env file
load_dotenv()

# --- Application Setup ---
app = create_app()

# --- CORS Configuration ---
# Load allowed origins from environment variable, split by comma
origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000")
allowed_origins = [origin.strip() for origin in origins_str.split(',')]

# Apply a single, clear CORS policy
CORS(
    app,
    resources={r"/*": {"origins": allowed_origins}},
    supports_credentials=True,
    methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

# --- Rate Limiting ---
# Apply a rate limiter to all requests
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["2000 per day", "500 per hour"],
    storage_uri="memory://",  # Use in-memory storage for simplicity
)

# --- Simple Home Route ---
@app.route("/")
def home():
    """A simple route to confirm the backend is running."""
    return "Hindustan Electric Backend is running! 🚀"

# --- Main Execution Block ---
if __name__ == "__main__":
    # Determine host and port
    port = int(os.getenv("PORT", 5001))
    is_development = os.getenv("FLASK_ENV") == "development"

    # Get local IP for network access URL
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
    except Exception:
        local_ip = "127.0.0.1"

    # Print a helpful startup message
    print("\n" + "="*50)
    print("🚀 Hindustan Electric Backend Server")
    print("="*50)
    print(f"• Environment:    {'Development' if is_development else 'Production'}")
    print(f"• Debug Mode:     {'On' if is_development else 'Off'}")
    print(f"• Local Access:   http://localhost:{port}")
    print(f"• Network Access: http://{local_ip}:{port}")
    print("="*50 + "\n")

    # Run the Flask application
    app.run(host='0.0.0.0', port=port, debug=is_development)
# import os
# from dotenv import load_dotenv

# # import socket
# from app import create_app
# from flask_cors import CORS
# from flask_limiter import Limiter
# from flask_limiter.util import get_remote_address
# from app.inventory_routes import inventory_bp

# # Load environment variables from .env
# load_dotenv()

# app = create_app()
# CORS(
#     app,
#     resources={r"/*": {"origins": ["https://hindustanelectric.vercel.app", "http://localhost:3000"]}},
#     supports_credentials=True,
# )


# @app.route("/")
# def home():
#     return "Hello, Hindustan Electric!"


# # Apply rate limiting
# limiter = Limiter(
#     app=app,
#     key_func=get_remote_address,
#     default_limits=["2000 per day", "500 per hour"],
# )

# if __name__ == "__main__":
#     port = int(os.getenv("PORT", 5001))
#     app.run(host="0.0.0.0", port=port, debug=True)
