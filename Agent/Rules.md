**Role & Objective:**
Act as an expert Full-Stack Developer and Security Architect. Your task is to reverse-engineer a terminal-based Python application that uses the Swedavia FlightInfo API v2, and completely rebuild it into a "Masterpiece" local web application. 

**Context of the Original App:**
The original terminal app fetched flight data for 10 Swedish airports (ARN, GOT, BMA, MMX, LLA, UME, OSD, VBY, RNB, KRN). It featured 6 menu options (Arrivals, Departures, Search, City/Country lookup, API Heartbeat, and Auto-demo), handled timezone conversions to CET/CEST, and used pagination. It relied on a locally generated `city_country.json` file for location mapping.

**Your Task:**
Build the ultimate, fully functional, and secure local version of this system using Python (backend), HTML, CSS, JavaScript, and JSON. You have full creative and architectural control, but you must adhere to the following strict requirements:

**1. Architecture & Tech Stack:**
* **Backend:** Python (use a lightweight, secure framework like Flask or FastAPI). It must handle all Swedavia API calls to avoid CORS issues on the frontend.
* **Frontend:** HTML5, CSS3, and Vanilla JavaScript. No heavy external frameworks like React—keep it raw, fast, and elegant.
* **Data Handling:** Use JSON for configuration and the local city/country routing.

**2. Design & UI/UX (The "Vibe Coder" Aesthetic):**
* Create a modern, sleek, and exceptionally clean UI. 
* Implement a polished Dark Mode by default. Think glowing accents on deep dark backgrounds, smooth transitions, and high readability.
* **Layout:** Build a Single Page Application (SPA) feel with functional navigation tabs (e.g., "Dashboard", "Arrivals", "Departures", "Search", "System Status").
* Ensure the layout is responsive, structured, and visually impressive.

**3. Core Features:**
* **Live Data Fetching:** Seamlessly fetch and display arrivals and departures for the selected Swedavia airports.
* **Dynamic Search/Filter:** Implement real-time JavaScript filtering (search by flight number, destination, or city) without needing to reload the page.
* **Status Indicators:** Visually represent flight statuses (e.g., Delayed, Boarding, Cancelled) with color-coded badges.
* **API Heartbeat:** A visual system status widget showing if the Swedavia API is online.

**4. Security & Best Practices (Mandatory):**
* **API Key Protection:** The Swedavia API key MUST NOT be hardcoded or sent to the frontend. It must be strictly managed in the Python backend using a `.env` file (`python-dotenv`).
* **Input Validation:** Sanitize all user inputs both on the frontend (JS) and backend (Python) to prevent injection attacks.
* **Error Handling:** Implement graceful error handling. If the API fails, the UI should display a clean, user-friendly error message, not raw code output.

**Output Generation Requirements:**
Provide a complete, step-by-step project setup guide. 
1. Define the ideal folder structure.
2. Provide the requirements.txt.
3. Write the complete, secure Python backend code.
4. Write the flawless HTML, CSS, and JS code for the frontend.
5. Explain briefly how to run the application securely on a local machine.

Execute this with precision. Make it functional, secure, and beautiful.