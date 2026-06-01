import os
from pathlib import Path
from dotenv import load_dotenv

# Base directory of the project
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables from .env file
dotenv_path = BASE_DIR / ".env"
if dotenv_path.exists():
    load_dotenv(dotenv_path=dotenv_path)

# Port & host settings
PORT = int(os.environ.get("PORT", 8000))
HOST = os.environ.get("HOST", "127.0.0.1")
DEBUG = os.environ.get("DEBUG", "true").lower() in ("true", "1", "yes")

# Swedavia settings
SWEDAVIA_API_KEY = os.environ.get("SWEDAVIA_API_KEY", "").strip()
# Explicit check to enable Swedavia API only if API key is provided and setting is enabled
SWEDAVIA_ENABLED = os.environ.get("SWEDAVIA_ENABLED", "false").lower() in ("true", "1", "yes") and bool(SWEDAVIA_API_KEY)

# Define Swedish Airports details to serve endpoints
AIRPORTS_METADATA = {
    "ARN": { "city": "Stockholm", "country": "Sweden", "name": "Stockholm Arlanda Airport", "lat": 59.6519, "lon": 17.9186 },
    "GOT": { "city": "Gothenburg", "country": "Sweden", "name": "Göteborg Landvetter Airport", "lat": 57.6628, "lon": 12.2798 },
    "BMA": { "city": "Stockholm", "country": "Sweden", "name": "Stockholm Bromma Airport", "lat": 59.3544, "lon": 17.9417 },
    "MMX": { "city": "Malmö", "country": "Sweden", "name": "Malmö Airport", "lat": 55.5302, "lon": 13.3724 },
    "LLA": { "city": "Luleå", "country": "Sweden", "name": "Luleå Airport", "lat": 65.5438, "lon": 22.1219 },
    "UME": { "city": "Umeå", "country": "Sweden", "name": "Umeå Airport", "lat": 63.7915, "lon": 20.2818 },
    "OSD": { "city": "Östersund", "country": "Sweden", "name": "Åre Östersund Airport", "lat": 63.1944, "lon": 14.5003 },
    "VBY": { "city": "Visby", "country": "Sweden", "name": "Visby Airport", "lat": 57.6628, "lon": 18.3478 },
    "RNB": { "city": "Ronneby", "country": "Sweden", "name": "Ronneby Airport", "lat": 56.2667, "lon": 15.2654 },
    "KRN": { "city": "Kiruna", "country": "Sweden", "name": "Kiruna Airport", "lat": 67.8222, "lon": 20.3367 }
}
