import os
from datetime import datetime
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse
import requests

from backend.config import PORT, HOST, DEBUG, SWEDAVIA_ENABLED, AIRPORTS_METADATA
from backend.swedavia import SwedaviaClient
from backend.mock_data import generate_flights, LOCATION_DB

app = FastAPI(
    title="Swedavia FlightInfo 3D Cockpit Backend",
    description="Secure backend server serving aeronautic data & flight details",
    version="1.0.0"
)

# Initialize Swedavia Client
swedavia_client = SwedaviaClient()

# Core Endpoints

@app.get("/api/airports")
async def get_airports():
    """Returns the list of 10 supported Swedavia airport hubs with coordinates."""
    return AIRPORTS_METADATA

@app.get("/api/flights/{airport_code}/{direction}")
async def get_flights_endpoint(airport_code: str, direction: str, date: str = None):
    """
    Fetches arrivals or departures for a given airport.
    If Swedavia client is enabled, attempts to query Swedavia's official API.
    Falls back to high-fidelity simulated flight data if the key is not active.
    """
    airport_code = airport_code.upper()
    direction = direction.lower()
    
    if airport_code not in AIRPORTS_METADATA:
        raise HTTPException(status_code=400, detail=f"Airport {airport_code} is not supported. Use one of: {list(AIRPORTS_METADATA.keys())}")
        
    if direction not in ("arrivals", "departures"):
        raise HTTPException(status_code=400, detail="Direction must be 'arrivals' or 'departures'")

    # Query real API if enabled, otherwise fall back to mock simulator
    used_mock = True
    flights = []
    error_message = None
    
    if swedavia_client.enabled:
        try:
            flights = swedavia_client.get_flights(airport_code, direction, date)
            used_mock = False
            
            # Enrich Swedavia API results with geographical coordinates from city_country.json
            for flight in flights:
                origin_code = flight["origin"]
                dest_code = flight["destination"]
                
                orig_geo = LOCATION_DB.get(origin_code, {"city": "Unknown", "country": "International", "name": "Airport", "lat": 0.0, "lon": 0.0})
                dest_geo = LOCATION_DB.get(dest_code, {"city": "Unknown", "country": "International", "name": "Airport", "lat": 0.0, "lon": 0.0})
                
                flight.update({
                    "originName": orig_geo["name"],
                    "originCity": orig_geo["city"],
                    "originCountry": orig_geo["country"],
                    "originLat": orig_geo["lat"],
                    "originLon": orig_geo["lon"],
                    "destName": dest_geo["name"],
                    "destCity": dest_geo["city"],
                    "destCountry": dest_geo["country"],
                    "destLat": dest_geo["lat"],
                    "destLon": dest_geo["lon"],
                })
                
                # Mock high-fidelity live telemetry attributes onto real flights for 3D Globe HUD simulation
                progress = 0.0
                status = flight["status"]
                
                # Setup dummy flight telemetry progress
                if status == "In Air":
                    progress = 0.4
                elif status in ("Landed", "Departed"):
                    progress = 1.0
                    
                flight["telemetry"] = {
                    "altitude": 10300 if status == "In Air" else 0,
                    "speed": 840 if status == "In Air" else 0,
                    "heading": 90, # default heading
                    "latitude": orig_geo["lat"] + (dest_geo["lat"] - orig_geo["lat"]) * progress,
                    "longitude": orig_geo["lon"] + (dest_geo["lon"] - orig_geo["lon"]) * progress,
                    "progress": progress,
                    "elapsed": 30 if status == "In Air" else 0,
                    "duration": 75,
                    "distance": 800
                }
        except Exception as e:
            error_message = str(e)
            used_mock = True

    if used_mock:
        flights = generate_flights(airport_code, direction, date)

    return {
        "airport": airport_code,
        "direction": direction,
        "date": date or datetime.utcnow().strftime("%Y-%m-%d"),
        "count": len(flights),
        "source": "SWEDAVIA_API" if not used_mock else "MOCK_FLIGHT_SIMULATOR",
        "apiError": error_message,
        "flights": flights
    }

@app.get("/api/weather/{lat}/{lon}")
async def get_weather(lat: float, lon: float):
    """
    Fetches real-time weather reports for given coordinates using the free, open Open-Meteo API.
    Provides stunning cockpit details!
    """
    url = f"https://api.open-meteo.com/v1/forecast?latitude={lat}&longitude={lon}&current_weather=true"
    try:
        response = requests.get(url, timeout=5)
        response.raise_for_status()
        data = response.json()
        current = data.get("current_weather", {})
        
        # Map weather codes to readable weather condition descriptions
        weather_code = current.get("weathercode", 0)
        description = _map_weather_code(weather_code)
        
        return {
            "temp": current.get("temperature", 15.0),
            "windspeed": current.get("windspeed", 10.0),
            "winddirection": current.get("winddirection", 0.0),
            "code": weather_code,
            "description": description,
            "success": True
        }
    except Exception as e:
        return {
            "temp": 12.0,
            "windspeed": 12.0,
            "winddirection": 45.0,
            "code": 0,
            "description": "Information Unavailable",
            "success": False,
            "error": str(e)
        }

@app.get("/api/heartbeat")
async def get_heartbeat():
    """Runs a health check on Swedavia API connectivity and backend status."""
    backend_status = {
        "status": "ONLINE",
        "time": datetime.utcnow().isoformat(),
        "simulatedMode": not SWEDAVIA_ENABLED,
        "swedavia": swedavia_client.check_heartbeat()
    }
    return backend_status

# Helper function to map WMO Weather Interpretation Codes (https://open-meteo.com/en/docs)
def _map_weather_code(code: int) -> str:
    mapping = {
        0: "Clear Sky",
        1: "Mainly Clear", 2: "Partly Cloudy", 3: "Overcast",
        45: "Foggy", 48: "Depositing Rime Fog",
        51: "Light Drizzle", 53: "Moderate Drizzle", 55: "Dense Drizzle",
        61: "Slight Rain", 63: "Moderate Rain", 65: "Heavy Rain",
        71: "Slight Snow", 73: "Moderate Snow", 75: "Heavy Snow",
        77: "Snow Grains",
        80: "Slight Rain Showers", 81: "Moderate Rain Showers", 82: "Violent Rain Showers",
        85: "Slight Snow Showers", 86: "Heavy Snow Showers",
        95: "Thunderstorm", 96: "Thunderstorm with Slight Hail", 99: "Thunderstorm with Heavy Hail"
    }
    return mapping.get(code, "Overcast Clouds")

# Mount Static Files (Frontend UI assets)
frontend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend"))
if os.path.exists(frontend_dir):
    # Mount frontend static directories
    app.mount("/css", StaticFiles(directory=os.path.join(frontend_dir, "css")), name="css")
    app.mount("/js", StaticFiles(directory=os.path.join(frontend_dir, "js")), name="js")
    
    # Root router serving index.html
    @app.get("/")
    async def serve_index():
        return FileResponse(os.path.join(frontend_dir, "index.html"))
else:
    @app.get("/")
    async def serve_missing_warning():
        return JSONResponse(status_code=404, content={"error": "Frontend folder not found. Please create 'frontend' and place HTML assets there."})
