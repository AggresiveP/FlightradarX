# Swedavia FlightInfo Cockpit — Project Documentation

This document explains how we researched, planned, built, and finished our **3D Swedavia Flight Visualizer** project.

---

## Phase 1: Research Phase (Förstudie)

### Information Gathering (What we researched)
*   **Swedavia API:** We researched the Swedavia Developer website to find out how to get real flight arrivals and departures data.
*   **Airport Coordinates:** We collected latitude and longitude data for all Swedish airports and major international destinations so we could position them on a map.
*   **3D Globe Libraries:** We looked for ways to draw a beautiful 3D Earth in the browser. We chose `Globe.gl` and `Three.js` because they allow us to easily draw 3D objects and glowing lines on a sphere.
*   **Weather API:** We found a free weather API called `Open-Meteo` to get live weather reports for the airports.

### Choice of Tools & Technologies
*   **Backend:** **Python & FastAPI** because it is very fast, easy to write, and can serve our frontend files.
*   **Frontend:** **HTML, Vanilla CSS, and JavaScript** because we wanted complete control over the design without using heavy frameworks.
*   **3D Visuals:** **Globe.gl & Three.js** to render the rotatable 3D globe and animated objects.
*   **Launcher:** A PowerShell script (`run.ps1`) to quickly set up the project on Windows with a single command.

### Work Planning
We divided our work into four clear steps:
1.  Set up the Python backend server to handle API requests.
2.  Add the 3D globe to the webpage.
3.  Design the dark-mode dashboard interface with tables and a weather sidebar.
4.  Animate 3D airplanes flying along the flight paths on the globe.

### Problems & Solutions (Phase 1)
*   **Problem:** It was hard to find where the API keys were on the Swedavia website.
    *   *Solution:* We created a developer account on their portal, went to the "Products" page, and subscribed to the **FlightInfo Free** tier. The keys then appeared on our Profile page.
*   **Problem:** The Swedavia API does not provide coordinate data for airports.
    *   *Solution:* We created a simple JSON database file (`city_country.json`) in our backend folder containing coordinates for all airport codes.

---

## Phase 2: Starting Work (Implementation / Genomförande)

### How the work started
We started by creating the FastAPI backend (`backend/main.py`) to serve our HTML, CSS, and JS files on `http://127.0.0.1:8000`. 

### Project Structure
We organized the files like this:
*   `backend/` - Contains Python files for configuration, Swedavia API connection, and simulator data.
*   `frontend/` - Contains the HTML file and folders for CSS styling and JS scripts.
*   `.gitignore` - A file to protect our private API keys.
*   `.env.example` - A template showing other users how to set up their keys.
*   `run.ps1` - A script to start the project.

### Developing Features
1.  **Backend Routes:** We built API routes to fetch flights and weather.
2.  **3D Globe:** We loaded the globe and centered the camera on Sweden.
3.  **UI Tables:** We built tables to list flights, plus a sidebar showing targeted flight details.

### Problems & Solutions (Phase 2)
*   **Problem:** The custom PowerShell launch script (`run.ps1`) was blocked by Windows security.
    *   *Solution:* We added simple commands in our guide to run the script with the `-ExecutionPolicy Bypass` flag, which bypasses the block safely.
*   **Problem:** The code became messy and the UI flickered when loading new flights.
    *   *Solution:* We created a single global state object (`STATE` in `app.js`) to handle all data and variables cleanly without screen flickering.

---

## Phase 3: Completion (Slutförande & Förbättring)

### Finalizing the Project
We completed all main features and focused on polishing the visuals. We built custom 3D glowing jet planes in JavaScript using Three.js shapes (fuselage, wings, tail, and orange exhaust flames) to fly dynamically along the flight routes.

### Testing
*   **Simulator Mode:** We verified that if no API key is used, the project automatically runs a high-fidelity flight simulator, so it works directly out-of-the-box.
*   **Live Radar Mode:** We added our Swedavia API key and verified that the site successfully switched to official live radar feeds.

### Visual Improvements
*   **Faint Vector Lines:** We dimmed the cyan and purple flight lines, making them thin and semi-transparent. This makes the map look very clean and highlights the glowing 3D airplanes.
*   **Radar Syncing Rings:** We added expanding radar ripples pulsing out from the active airport hub to make it look like the system is actively scanning and syncing.

### Problems & Solutions (Phase 3)
*   **Problem:** The real Swedavia API only shows "Landed" or "Departed" flights (no "In Air" status), so no airplanes were rendering in live mode.
    *   *Solution:* We changed the code to animate planes for *all* listed flights, placing them at random starting points along their lines when the page loads so the airspace looks natural.
*   **Problem:** The browser kept loading old cached JavaScript code, so we could not see our visual updates.
    *   *Solution:* We performed a **Hard Refresh** (`Ctrl + F5`) or opened the website in an **Incognito Window** to force-load the new files.

---

## Phase 4: Summary of Problems & Solutions

### 1. Hiding Private API Keys
*   **Problem:** We wanted to upload our project to GitHub, but we had to hide our private Swedavia API keys.
*   **Solution:** We created a `.gitignore` file to tell Git to completely ignore the `.env` file, and created a blank `.env.example` as a template for other developers.

### 2. Cluttered Screen
*   **Problem:** The flight path lines were too thick and bright, which cluttered the globe.
*   **Solution:** We adjusted their styling to be very thin, faint, and transparent, giving the map a high-tech "radar screen" look.

### 3. No Planes on Live API
*   **Problem:** Real API data had no active "In Air" flights, leaving the 3D globe empty.
*   **Solution:** We animated planes along all active airport routes and distributed them organically across the paths.

---

## Conclusion

### What we achieved
We successfully built a beautiful, fully functional **3D Flight Visualizer** website. It connects to the official Swedavia API for live data and falls back to a high-fidelity simulator mode when offline. The UI is designed with a premium, responsive dark-mode theme.

### What we learned
*   How to handle 3D coordinate math (converting latitude and longitude into 3D space).
*   How to sync a 60 FPS 3D rendering loop with backend API updates.
*   How to write clean, secure code using `.env` variables and Git exclusions.

### What can be improved in the future
*   **Different Airplane Shapes:** Load different 3D models (like Boeing vs Airbus) depending on the actual plane type returned by the API.
*   **Sound Effects:** Add high-tech sound sweeps and soft radar-ping sound effects for a fully immersive cockpit experience.
