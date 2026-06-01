import requests
from datetime import datetime
from typing import List, Dict, Any
from backend.config import SWEDAVIA_API_KEY, SWEDAVIA_ENABLED

BASE_URL = "https://api.swedavia.se/flightinfo/v2"

class SwedaviaClient:
    def __init__(self):
        self.api_key = SWEDAVIA_API_KEY
        self.enabled = SWEDAVIA_ENABLED
        self.headers = {
            "Ocp-Apim-Subscription-Key": self.api_key,
            "Accept": "application/json"
        }

    def check_heartbeat(self) -> Dict[str, Any]:
        """
        Verify connection to Swedavia API. 
        Usually checks if key is configured and pings the endpoint.
        """
        if not self.api_key:
            return {
                "status": "MISSING_KEY",
                "message": "Swedavia API Key is not configured in .env",
                "connected": False
            }
        
        if not self.enabled:
            return {
                "status": "DISABLED",
                "message": "Swedavia API is disabled in .env config",
                "connected": False
            }

        # Let's perform a lightweight heartbeat check by querying a single date at ARN
        today = datetime.utcnow().strftime("%Y-%m-%d")
        url = f"{BASE_URL}/ARN/arrivals/{today}"
        try:
            # Short timeout to avoid hanging the dashboard status check
            response = requests.get(url, headers=self.headers, timeout=5)
            if response.status_code == 200:
                return {
                    "status": "ONLINE",
                    "message": "Successfully authenticated and connected to Swedavia FlightInfo API v2",
                    "connected": True
                }
            else:
                return {
                    "status": f"HTTP_{response.status_code}",
                    "message": f"Server returned error code {response.status_code}: {response.reason}",
                    "connected": False
                }
        except Exception as e:
            return {
                "status": "OFFLINE",
                "message": f"Could not establish connection to API server: {str(e)}",
                "connected": False
            }

    def get_flights(self, airport_code: str, direction: str, date_str: str = None) -> List[Dict[str, Any]]:
        """
        Fetch arrivals or departures for an airport on a specific date.
        direction: 'arrivals' or 'departures'
        date_str: 'YYYY-MM-DD' (defaults to current UTC date)
        """
        if not self.enabled or not self.api_key:
            raise ValueError("Swedavia API is not active or disabled.")

        if not date_str:
            date_str = datetime.utcnow().strftime("%Y-%m-%d")

        direction = direction.lower()
        if direction not in ("arrivals", "departures"):
            raise ValueError("Direction must be 'arrivals' or 'departures'.")

        url = f"{BASE_URL}/{airport_code.upper()}/{direction}/{date_str}"
        
        try:
            response = requests.get(url, headers=self.headers, timeout=10)
            response.raise_for_status()
            data = response.json()
            
            # Map Swedavia's raw API response to our unified clean flight format
            return self._parse_flights(data, direction, airport_code)
        except requests.RequestException as e:
            print(f"Swedavia API request failed: {e}")
            raise RuntimeError(f"Swedavia API call failed: {str(e)}")

    def _parse_flights(self, raw_data: Dict[str, Any], direction: str, hub: str) -> List[Dict[str, Any]]:
        """
        Normalize Swedavia's API fields to our unified design system format.
        """
        # Swedavia response typically contains a list of flights under 'flights' or 'bookings'
        flights_list = raw_data.get("flights", []) if isinstance(raw_data, dict) else []
        parsed = []

        for f in flights_list:
            flight_id = f.get("flightId", "")
            # Obtain airline and flight number
            flight_number = f.get("flightMarket", {}).get("flightNumber", flight_id)
            airline_name = f.get("flightMarket", {}).get("airline", {}).get("name", "Unknown Airline")
            airline_code = f.get("flightMarket", {}).get("airline", {}).get("iata", "")

            # Schedule time formatting (ISO strings usually)
            sched_time_str = f.get("scheduledTime", {}).get("utc", "")
            actual_time_str = f.get("actualTime", {}).get("utc", "") or f.get("estimatedTime", {}).get("utc", "")
            
            # Formulate coordinate links
            route = f.get("route", [])
            origin_code = hub
            dest_code = hub
            
            # For arrivals, the final destination is hub, first route point is origin
            # For departures, the origin is hub, last route point is destination
            if direction == "arrivals":
                if route:
                    origin_code = route[0].get("iata", "UNK")
            else:
                if route:
                    dest_code = route[-1].get("iata", "UNK")

            # Determine flight status
            status_code = f.get("status", {}).get("code", "")
            status_text = f.get("status", {}).get("swedish", f.get("status", {}).get("english", "Scheduled"))
            
            # Map Swedavia states to our normalized visual states
            normalized_status = "Scheduled"
            if "DEL" in status_code or "DELAY" in status_text.upper():
                normalized_status = "Delayed"
            elif "BRD" in status_code or "BOARD" in status_text.upper():
                normalized_status = "Boarding"
            elif "CAN" in status_code or "CANCEL" in status_text.upper():
                normalized_status = "Cancelled"
            elif "LND" in status_code or "ARR" in status_code or "LAND" in status_text.upper() or "ANK" in status_text.upper():
                normalized_status = "Landed" if direction == "arrivals" else "Departed"

            parsed.append({
                "id": flight_id,
                "flightNumber": flight_number,
                "airline": airline_name,
                "airlineCode": airline_code,
                "origin": origin_code,
                "destination": dest_code,
                "scheduledTime": sched_time_str,
                "actualTime": actual_time_str,
                "status": normalized_status,
                "statusText": status_text,
                "gate": f.get("gate", ""),
                "baggageBelt": f.get("baggageBelt", ""),
                "terminal": f.get("terminal", ""),
                "aircraft": f.get("aircraft", {}).get("type", "B737-800")
            })

        return parsed
