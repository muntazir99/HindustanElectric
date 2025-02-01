# import os
# import socket
# from dotenv import load_dotenv
# from app import create_app
# from flask_limiter import Limiter
# from flask_limiter.util import get_remote_address

# # Load environment variables from .env
# load_dotenv()

# def get_local_ip():
#     try:
#         s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
#         s.connect(("8.8.8.8", 80))
#         local_ip = s.getsockname()[0]
#         s.close()
#         return local_ip
#     except Exception:
#         return "127.0.0.1"

# app = create_app()
# # Add rate limiting
# limiter = Limiter(
#     app=app,
#     key_func=get_remote_address,
#     default_limits=["200 per day", "50 per hour"]
# )

# if __name__ == "__main__":
#     port = int(os.getenv('PORT', 5000))
#     local_ip = get_local_ip()
    
#     print("\n" + "="*50)
#     print("🚀 Inventory Management Backend")
#     print("="*50)
#     print(f"• Local Access:     http://localhost:{port}")
#     print(f"• Network Access:   http://{local_ip}:{port}")
#     print(f"• Debug Mode:       {'Enabled' if app.debug else 'Disabled'}")
#     print("="*50 + "\n")
    
#     app.run(host='0.0.0.0', port=port, debug=True)

import os
from dotenv import load_dotenv
from app import create_app
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address

# Load environment variables from .env
load_dotenv()

app = create_app()

# Apply rate limiting
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

if __name__ == "__main__":
    port = int(os.getenv("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=True)
