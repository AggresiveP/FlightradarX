import random
import json
import math
from datetime import datetime, timedelta
from pathlib import Path
from typing import List, Dict, Any
from backend.config import AIRPORTS_METADATA

# Load city/country mapping for routes
DATA_DIR = Path(__file__).resolve().parent / "data"
CITY_COUNTRY_PATH = DATA_DIR / "city_country.json"

def get_location_database() -> Dict[str, Any]:
    if CITY_COUNTRY_PATH.exists():
        try:
            with open(CITY_COUNTRY_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    # Fallback in case of read error
    return AIRPORTS_METADATA

LOCATION_DB = get_location_database()

# Mock definitions for high fidelity generation
AIRLINES = [
    {"name": "Scandinavian Airlines (SAS)", "code": "SK", "aircraft": ["A320neo", "A350-900", "CRJ-900"]},
    {"name": "Norwegian Air Shuttle", "code": "DY", "aircraft": ["B737-800", "B737-MAX8"]},
    {"name": "Lufthansa", "code": "LH", "aircraft": ["A320neo", "A321neo", "CRJ-900"]},
    {"name": "KLM Royal Dutch Airlines", "code": "KL", "aircraft": ["B737-800", "E190"]},
    {"name": "British Airways", "code": "BA", "aircraft": ["A320-200", "A321-200"]},
    {"name": "Ryanair", "code": "FR", "aircraft": ["B737-800", "B737-MAX200"]},
    {"name": "Finnair", "code": "AY", "aircraft": ["A321-200", "ATR-72"]},
    {"name": "Emirates", "code": "EK", "aircraft": ["B777-300ER", "A380-800"]},
    {"name": "Qatar Airways", "code": "QR", "aircraft": ["B787-9", "A350-900"]},
    {"name": "Eurowings", "code": "EW", "aircraft": ["A320neo", "A319"]}
]

STATUS_WEIGHTS = {
    "arrivals": ["Landed", "Landed", "Landed", "In Air", "In Air", "Boarding", "Delayed", "Scheduled", "Scheduled"],
    "departures": ["Departed", "Departed", "Departed", "In Air", "In Air", "Boarding", "Delayed", "Scheduled", "Scheduled"]
}

def generate_flights(airport_code: str, direction: str, date_str: str = None) -> List[Dict[str, Any]]:
    """
    Generates deterministic, highly realistic simulated flights for an airport,
    anchored to the current time, so 'In Air' flights are actively flying.
    """
    airport_code = airport_code.upper()
    direction = direction.lower()
    
    # Anchor time to current server time
    now = datetime.now()
    
    # Retrieve details of the current Swedish airport (hub)
    hub_info = LOCATION_DB.get(airport_code, AIRPORTS_METADATA.get(airport_code))
    if not hub_info:
        hub_info = {"city": "Unknown", "country": "Sweden", "name": "Airport", "lat": 59.3, "lon": 18.0}
        
    # Pick a list of possible international and domestic destinations (excluding the hub itself)
    destinations = [code for code in LOCATION_DB.keys() if code != airport_code]
    
    # We will generate a consistent set of 12 flights per airport/direction per day
    # We seed the random generator using airport code, date, and direction to make it deterministic
    if not date_str:
        date_str = now.strftime("%Y-%m-%d")
    
    seed_str = f"{airport_code}_{direction}_{date_str}"
    # Sum characters to get a seed
    random.seed(sum(ord(c) for c in seed_str))
    
    flights = []
    
    # Generate schedule times spread across the day
    for idx in range(12):
        airline = random.choice(AIRLINES)
        flight_num_val = random.randint(100, 9999)
        flight_number = f"{airline['code']}{flight_num_val}"
        aircraft = random.choice(airline['aircraft'])
        
        # Route logic
        other_port_code = random.choice(destinations)
        other_port = LOCATION_DB[other_port_code]
        
        if direction == "arrivals":
            origin_code = other_port_code
            dest_code = airport_code
        else:
            origin_code = airport_code
            dest_code = other_port_code
            
        origin_info = LOCATION_DB[origin_code]
        dest_info = LOCATION_DB[dest_code]

        # Scheduled time (spread over the 24 hours)
        hour_spread = int((24 / 12) * idx) + random.randint(0, 1)
        minute_spread = random.choice([0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55])
        sched_time = now.replace(hour=hour_spread % 24, minute=minute_spread, second=0, microsecond=0)
        
        # Adjust date if necessary (e.g. today)
        if date_str != now.strftime("%Y-%m-%d"):
            try:
                date_parts = [int(p) for p in date_str.split("-")]
                sched_time = sched_time.replace(year=date_parts[0], month=date_parts[1], day=date_parts[2])
            except Exception:
                pass
                
        # Status selection based on proximity to current time 'now'
        time_diff = (sched_time - now).total_seconds() / 60.0 # in minutes
        
        if time_diff < -120:
            # Past flights are landed or departed
            status = "Landed" if direction == "arrivals" else "Departed"
        elif -120 <= time_diff < -30:
            # Recent past flights are either landed, departed or actively In Air
            status = "In Air"
        elif -30 <= time_diff < 0:
            # Current flights
            status = random.choice(["In Air", "Boarding"])
        elif 0 <= time_diff < 30:
            # Near future
            status = random.choice(["Boarding", "Scheduled", "Delayed"])
        else:
            # Future
            status = "Scheduled" if random.random() > 0.05 else "Delayed"
            
        # Error handling / Delay details
        actual_time = sched_time
        delay_minutes = 0
        if status == "Delayed":
            delay_minutes = random.choice([15, 30, 45, 60, 90])
            actual_time = sched_time + timedelta(minutes=delay_minutes)
            
        # Detailed active telemetry calculation if "In Air"
        telemetry = {}
        if status == "In Air":
            # Flight duration estimation based on distance
            distance = calculate_distance(origin_info["lat"], origin_info["lon"], dest_info["lat"], dest_info["lon"])
            # Average airspeed: 800 km/h (13.3 km/minute)
            flight_duration_min = max(35, int(distance / 13.3))
            
            # Place the departure time so that the flight is currently flying
            # Completion progress (between 10% and 90% based on how far in we are)
            # Make it look alive: we calculate it based on actual time
            elapsed_min = random.randint(5, flight_duration_min - 5)
            progress = elapsed_min / flight_duration_min
            
            # Telemetry metrics
            altitude_m = random.choice([9500, 10300, 10900, 11200, 11800])
            speed_kmh = random.randint(810, 890)
            heading = int(calculate_bearing(origin_info["lat"], origin_info["lon"], dest_info["lat"], dest_info["lon"]))
            
            # Add dynamic tracking data
            curr_lat, curr_lon = interpolate_route(
                origin_info["lat"], origin_info["lon"], 
                dest_info["lat"], dest_info["lon"], 
                progress
            )
            
            # Format time strings
            dep_time = now - timedelta(minutes=elapsed_min)
            arr_time = dep_time + timedelta(minutes=flight_duration_min)
            
            telemetry = {
                "altitude": altitude_m,
                "speed": speed_kmh,
                "heading": heading,
                "latitude": curr_lat,
                "longitude": curr_lon,
                "progress": progress,
                "elapsed": elapsed_min,
                "duration": flight_duration_min,
                "distance": int(distance)
            }
            sched_time = dep_time
            actual_time = arr_time
        else:
            # Non-active flights telemetry
            telemetry = {
                "altitude": 0,
                "speed": 0,
                "heading": 0,
                "latitude": origin_info["lat"] if direction == "departures" else dest_info["lat"],
                "longitude": origin_info["lon"] if direction == "departures" else dest_info["lon"],
                "progress": 0.0 if status != "Landed" and status != "Departed" else 1.0,
                "elapsed": 0,
                "duration": 60,
                "distance": int(calculate_distance(origin_info["lat"], origin_info["lon"], dest_info["lat"], dest_info["lon"]))
            }

        flights.append({
            "id": f"{flight_number}_{idx}",
            "flightNumber": flight_number,
            "airline": airline["name"],
            "airlineCode": airline["code"],
            "origin": origin_code,
            "destination": dest_code,
            "originName": origin_info["name"],
            "originCity": origin_info["city"],
            "originCountry": origin_info["country"],
            "originLat": origin_info["lat"],
            "originLon": origin_info["lon"],
            "destName": dest_info["name"],
            "destCity": dest_info["city"],
            "destCountry": dest_info["country"],
            "destLat": dest_info["lat"],
            "destLon": dest_info["lon"],
            "scheduledTime": sched_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "actualTime": actual_time.strftime("%Y-%m-%dT%H:%M:%S"),
            "status": status,
            "statusText": f"Delayed by {delay_minutes} min" if status == "Delayed" else status,
            "gate": f"Gate {random.choice(['A','B','C','D','E','F'])}{random.randint(1, 30)}" if status != "Landed" else "-",
            "baggageBelt": f"Belt {random.randint(1, 10)}" if status in ("Landed", "In Air") and direction == "arrivals" else "-",
            "terminal": str(random.choice([2, 3, 4, 5])),
            "aircraft": aircraft,
            "telemetry": telemetry
        })
        
    # Sort by actual/scheduled time
    flights.sort(key=lambda x: x["actualTime"])
    return flights

# Helper math formulas for coordinates, great circle arcs and bearings
def calculate_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates haversine distance in kilometers between two points."""
    R = 6371.0  # Earth radius
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)
    
    a = math.sin(delta_phi / 2.0)**2 + \
        math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0)**2
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def calculate_bearing(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculates initial bearing (heading) along great-circle path."""
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_lambda = math.radians(lon2 - lon1)
    
    y = math.sin(delta_lambda) * math.cos(phi2)
    x = math.cos(phi1) * math.sin(phi2) - \
        math.sin(phi1) * math.cos(phi2) * math.cos(delta_lambda)
        
    bearing_rad = math.atan2(y, x)
    bearing_deg = math.degrees(bearing_rad)
    return (bearing_deg + 360.0) % 360.0

def interpolate_route(lat1: float, lon1: float, lat2: float, lon2: float, fraction: float) -> tuple:
    """
    Interpolates a point at 'fraction' along the great-circle path from point 1 to point 2.
    Uses spherical linear interpolation (Slerp).
    """
    phi1 = math.radians(lat1)
    lambda1 = math.radians(lon1)
    phi2 = math.radians(lat2)
    lambda2 = math.radians(lon2)
    
    # Angular distance
    d = 2.0 * math.asin(math.sqrt(
        math.sin((phi2 - phi1) / 2.0)**2 + 
        math.cos(phi1) * math.cos(phi2) * math.sin((lambda2 - lambda1) / 2.0)**2
    ))
    
    if d == 0:
        return lat1, lon1
        
    A = math.sin((1.0 - fraction) * d) / math.sin(d)
    B = math.sin(fraction * d) / math.sin(d)
    
    x = A * math.cos(phi1) * math.cos(lambda1) + B * math.cos(phi2) * math.cos(lambda2)
    y = A * math.cos(phi1) * math.sin(lambda1) + B * math.cos(phi2) * math.sin(lambda2)
    z = A * math.sin(phi1) + B * math.sin(phi2)
    
    lat = math.atan2(z, math.sqrt(x**2 + y**2))
    lon = math.atan2(y, x)
    
    return math.degrees(lat), math.degrees(lon)
