# ✈️ Swedavia FlightInfo Ultimate 3D Edition

A stunning, real-time 3D flight visualizer and AR cockpit dashboard that tracks arrivals and departures at Sweden's 10 major airport hubs. Built using **FastAPI**, **Three.js**, and **Globe.gl**.

![Swedavia FlightInfo 3D Cockpit](https://apideveloper.swedavia.se/assets/img/custom/developer-portal-logo.png)

---

## 🚀 Key Features

*   **Bustling 3D Globe Visualisation:** Real-time 3D earth visualizer centered on Scandinavia showing active flight paths as sleek glowing bezier curves.
*   **Animated 3D Aircraft Models:** Detailed 3D jets with glowing engine fire thrusters flying along flight routes in real-time.
*   **Radar Syncing Sweeps:** Expanding, semi-transparent sonar/radar ripple effects pulsing outwards from the active airport hub representing data beacon synchronization.
*   **AR Cockpit Telemetry HUD:** Active speedometer, altimeter, and geographic coordinate displays ticking in sync with active flights.
*   **Live Meteorological Forecasts:** Real-time weather data integration via Open-Meteo API for departure and arrival airports.
*   **Dual Mode Architecture:** Seamlessly falls back to an offline high-fidelity flight simulator if no Swedavia API key is configured.

---

## 🛠️ Getting Started (For Other Developers)

To run this project locally, simply follow these steps:

### 1. Prerequisites
Make sure you have **Python 3.8+** installed on your system. During installation, ensure you check the box to **"Add python.exe to PATH"**.

### 2. Launch the Application
This project comes with a built-in launch script that automates the setup of virtual environments, dependency installations, and server boots.

#### On Windows (PowerShell):
Open a PowerShell window in the project folder and run:
```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

#### On macOS / Linux:
Open your terminal, set up a virtual environment, install dependencies, and start the server:
```bash
# Create and activate virtual environment
python3 -m venv .venv
source .venv/bin/activate

# Install requirements
pip install -r requirements.txt

# Start backend FastAPI server
python3 -m uvicorn backend.main:app --host 127.0.0.1 --port 8000 --reload
```

Open your browser and navigate to **[http://127.0.0.1:8000](http://127.0.0.1:8000)**!

---

## 🔒 API Key & Live Radar Setup

By default, the application runs out-of-the-box in **Offline High-Fidelity Simulation Mode**—allowing anyone to explore the 3D globe and track simulated flights without registering any keys.

To connect the application to the **live, official Swedavia Airport radar feeds**:

1. Register an account on the [Swedavia Developer Portal](https://apideveloper.swedavia.se/).
2. Subscribe to the **FlightInfo Free** product in the portal.
3. Retrieve your **Primary subscription key** from your Profile page.
4. Copy `.env.example` in the project root and rename the copy to `.env`.
5. Open your new `.env` file, paste your API key, and enable the live stream:

```properties
# Swedavia API configuration
SWEDAVIA_API_KEY="your_actual_primary_key_here"
SWEDAVIA_ENABLED=true
```

6. Refresh your browser tab. The system diagnostic pulse will change to green (**SWEDAVIA API: SECURE CONNECT**), and you are now tracking live flights!
