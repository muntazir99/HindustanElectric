import logging
from logging.handlers import RotatingFileHandler

def configure_logging():
    log_file = "app.log"
    log_handler = RotatingFileHandler(
        log_file, maxBytes=10 * 1024 * 1024, backupCount=5  # 10 MB file size limit, 5 backups
    )
    log_handler.setLevel(logging.INFO)
    log_formatter = logging.Formatter("%(asctime)s - %(levelname)s - %(message)s")
    log_handler.setFormatter(log_formatter)

    logger = logging.getLogger()
    logger.setLevel(logging.INFO)
    logger.addHandler(log_handler)
    logger.addHandler(logging.StreamHandler())