import os
from dotenv import load_dotenv


load_dotenv()

INFLUXDB_TOKEN = os.environ.get("INFLUXDB_TOKEN")
INFLUXDB_ORG = os.environ.get("INFLUXDB_ORG") 
INFLUXDB_URL = os.environ.get("INFLUXDB_URL")
