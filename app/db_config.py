import os
import logging
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure, PyMongoError
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()

def get_db():
    try:
        mongo_uri = os.getenv("MONGO_URI")
        if not mongo_uri:
            raise ValueError("MONGO_URI environment variable not set")
        
        client = MongoClient(mongo_uri)
        client.admin.command('ismaster')  # Test connection
        db = client["hindustanelectric"]
        return db
    except ConnectionFailure:
        logging.error("Failed to connect to MongoDB")
        raise
    except PyMongoError as e:
        logging.error(f"MongoDB Error: {e}")
        raise
