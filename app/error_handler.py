import logging
from flask import jsonify

def handle_global_exception(e, app):
    logging.error(f"Unhandled Exception: {str(e)}", exc_info=True)
    return jsonify({
        "success": False,
        "message": "Internal server error",
        "error": str(e) if app.debug else "An unexpected error occurred"
    }), 500