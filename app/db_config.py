import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


# Global variable to hold the client
mongo_client = None

def get_db():
    global mongo_client
    try:
        if mongo_client is None:
            mongo_uri = os.getenv("MONGO_URI")
            if not mongo_uri:
                raise ValueError("MONGO_URI environment variable not set")
            mongo_client = MongoClient(mongo_uri)
            # Optional: Test connection immediately
            mongo_client.admin.command("ismaster")

        return mongo_client["hindustanelectric"]
    except ConnectionFailure:
        logging.error("Failed to connect to MongoDB")
        raise
    except PyMongoError as e:
        logging.error(f"MongoDB Error: {e}")
        raise
