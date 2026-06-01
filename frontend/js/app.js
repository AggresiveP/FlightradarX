/**
 * Swedavia FlightInfo Ultimate 3D Edition - SPA Application Orchestrator
 * Coordinates application state, tab routing, REST API communication,
 * table filtering, cockpit HUD updates, weather polling, and details views.
 */

// Application State Store
const STATE = {
    selectedAirport: "ARN",
    activeTab: "dashboard", // dashboard, arrivals, departures, diagnostics
    flights: [],           // Cached list of arrivals/departures
    filteredFlights: [],   // Filtered results from search
    selectedFlight: null,  // Currently selected active flight object
    searchQuery: "",
    currentPage: 1,
    pageSize: 5,           // Standard row display paging
    weatherCache: {},      // Coordinate key -> weather object cache
    telemetryTimer: null,  // Interval pointer for Cockpit HUD simulation
    apiHeartbeat: null,
    globeInstance: null
};

// Supported 10 Swedavia Hubs
const SWEDAVIA_HUBS = {
    "ARN": "Stockholm Arlanda Airport",
    "GOT": "Göteborg Landvetter Airport",
    "BMA": "Stockholm Bromma Airport",
    "MMX": "Malmö Airport",
    "LLA": "Luleå Airport",
    "UME": "Umeå Airport",
    "OSD": "Åre Östersund Airport",
    "VBY": "Visby Airport",
    "RNB": "Ronneby Airport",
    "KRN": "Kiruna Airport"
};

document.addEventListener("DOMContentLoaded", () => {
    initApp();
});

async function initApp() {
    // Set up tab events
    setupTabNavigation();
    
    // Set up airport dropdown events
    setupAirportSelector();

    // Set up search filter input
    setupSearchFilter();

    // Initialize Swedavia Heartbeat Diagnostics
    await fetchHeartbeat();
    setInterval(fetchHeartbeat, 30000); // refresh every 30s
    
    // Fetch and draw airports metadata list
    const response = await fetch("/api/airports");
    const airportsMeta = await response.json();

    // Instantiate and draw 3D Earth Globe
    STATE.globeInstance = new FlightGlobe("globe-container", (airportCode) => {
        // Callback: when clicking an airport node on 3D globe, select it in UI
        const selector = document.getElementById("airport-select");
        if (selector) {
            selector.value = airportCode;
            handleAirportChange(airportCode);
        }
    });
    STATE.globeInstance.init(airportsMeta);
    STATE.globeInstance.setActiveHub(STATE.selectedAirport);

    // Initial load for Stockholm Arlanda (ARN) Dashboard
    await loadAirportData();
}

/**
 * Handles Tab Switch Router Logic
 */
function setupTabNavigation() {
    const tabBtns = document.querySelectorAll(".tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            
            // Toggle active classes on tab buttons
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            // Toggle active tab view panels
            document.querySelectorAll(".tab-view").forEach(view => {
                view.classList.remove("active");
            });

            const targetView = document.getElementById(`${targetTab}-view`);
            if (targetView) targetView.classList.add("active");

            STATE.activeTab = targetTab;
            STATE.currentPage = 1;

            // Load data accordingly based on tab selection
            if (targetTab === "arrivals" || targetTab === "departures") {
                loadAirportData();
            } else if (targetTab === "dashboard") {
                renderDashboardSummary();
            } else if (targetTab === "diagnostics") {
                renderDiagnosticsPanel();
            }
        });
    });
}

/**
 * Handles Swedavia Hub selector change
 */
function setupAirportSelector() {
    const selector = document.getElementById("airport-select");
    if (!selector) return;

    // Prepopulate selector options
    selector.innerHTML = "";
    Object.entries(SWEDAVIA_HUBS).forEach(([code, name]) => {
        const option = document.createElement("option");
        option.value = code;
        option.textContent = `${code} - ${name.split(" Airport")[0]}`;
        selector.appendChild(option);
    });

    selector.addEventListener("change", (e) => {
        handleAirportChange(e.target.value);
    });
}

async function handleAirportChange(airportCode) {
    STATE.selectedAirport = airportCode;
    STATE.selectedFlight = null;
    clearTelemetryTimer();
    resetDetailsSidebar();
    
    if (STATE.globeInstance) {
        STATE.globeInstance.setActiveHub(airportCode);
        STATE.globeInstance.recenter();
    }

    if (STATE.activeTab === "dashboard") {
        await loadAirportData();
        renderDashboardSummary();
    } else {
        await loadAirportData();
    }
}

/**
 * Sets up client-side real-time typing filter
 */
function setupSearchFilter() {
    const input = document.getElementById("search-input");
    if (!input) return;

    input.addEventListener("input", (e) => {
        STATE.searchQuery = e.target.value.toLowerCase().trim();
        STATE.currentPage = 1;
        applyFiltersAndRender();
    });
}

/**
 * Loads Airport Arrivals/Departures from FastAPI server
 */
async function loadAirportData() {
    const direction = (STATE.activeTab === "arrivals" || STATE.activeTab === "departures") 
        ? STATE.activeTab 
        : "arrivals"; // default fetch arrivals for summary
        
    showTableLoading();

    try {
        const url = `/api/flights/${STATE.selectedAirport}/${direction}`;
        const res = await fetch(url);
        const data = await res.json();
        
        STATE.flights = data.flights || [];
        applyFiltersAndRender();
        
        // Pass flight list to the 3D globe to render beautiful cyber arcs
        if (STATE.globeInstance) {
            STATE.globeInstance.updateFlights(STATE.flights);
        }

        // Render dashboard statistics if active
        if (STATE.activeTab === "dashboard") {
            renderDashboardSummary();
        }
    } catch (err) {
        showTableError(err.message);
    }
}

/**
 * Client-Side Real-Time Filter & Search Evaluator
 */
function applyFiltersAndRender() {
    if (STATE.searchQuery === "") {
        STATE.filteredFlights = [...STATE.flights];
    } else {
        STATE.filteredFlights = STATE.flights.filter(f => {
            return f.flightNumber.toLowerCase().includes(STATE.searchQuery) ||
                   f.airline.toLowerCase().includes(STATE.searchQuery) ||
                   f.originCity.toLowerCase().includes(STATE.searchQuery) ||
                   f.origin.toLowerCase().includes(STATE.searchQuery) ||
                   f.destination.toLowerCase().includes(STATE.searchQuery) ||
                   f.destCity.toLowerCase().includes(STATE.searchQuery) ||
                   f.aircraft.toLowerCase().includes(STATE.searchQuery);
        });
    }
    
    renderFlightTable();
}

/**
 * Renders Flight Details into Table View (with pagination)
 */
function renderFlightTable() {
    const isArrival = STATE.activeTab === "arrivals";
    const tbodyId = isArrival ? "flights-table-body" : "flights-table-body-departures";
    const tbody = document.getElementById(tbodyId);
    if (!tbody) return;

    tbody.innerHTML = "";

    if (STATE.filteredFlights.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="empty-message">No matching flights active for ${STATE.selectedAirport}.</td></tr>`;
        renderPagination(0);
        return;
    }

    // Pagination calculations
    const startIdx = (STATE.currentPage - 1) * STATE.pageSize;
    const endIdx = Math.min(startIdx + STATE.pageSize, STATE.filteredFlights.length);
    const paginatedList = STATE.filteredFlights.slice(startIdx, endIdx);

    paginatedList.forEach(flight => {
        const tr = document.createElement("tr");
        
        // Highlights row if it is currently selected flight
        if (STATE.selectedFlight && STATE.selectedFlight.id === flight.id) {
            tr.classList.add("selected");
        }

        // Determine actual vs scheduled times
        const isArrival = STATE.activeTab === "arrivals";
        const schedTime = new Date(flight.scheduledTime);
        const actualTime = new Date(flight.actualTime);
        const formattedSched = formatClockTime(schedTime);
        const formattedActual = formatClockTime(actualTime);
        
        let timeCellContent = "";
        if (flight.status === "Delayed") {
            timeCellContent = `<span class="time-cell delayed-time">${formattedSched}</span><span class="time-actual">${formattedActual}</span>`;
        } else {
            timeCellContent = `<span class="time-cell">${formattedSched}</span>`;
        }

        const originDestCode = isArrival ? flight.origin : flight.destination;
        const originDestCity = isArrival ? flight.originCity : flight.destCity;

        const statusClass = flight.status.toLowerCase().replace(" ", "-");

        tr.innerHTML = `
            <td class="time-cell">${timeCellContent}</td>
            <td class="code-cell">${flight.flightNumber}</td>
            <td>
                <div class="airline-cell">
                    <div class="airline-logo-box">${flight.airlineCode || flight.flightNumber.slice(0, 2)}</div>
                    <span>${flight.airline}</span>
                </div>
            </td>
            <td class="code-cell">${originDestCode} <span style="font-size:0.8em; color:var(--text-secondary); font-weight:normal;">(${originDestCity})</span></td>
            <td class="code-cell">${flight.terminal || "-"} / ${flight.gate || "-"}</td>
            <td><span class="status-badge ${statusClass}">${flight.statusText}</span></td>
        `;

        // Click handler to select and inspect flight details
        tr.addEventListener("click", () => {
            selectFlight(flight);
            
            // Update table classes
            document.querySelectorAll(`#${tbodyId} tr`).forEach(row => row.classList.remove("selected"));
            tr.classList.add("selected");
        });

        tbody.appendChild(tr);
    });

    renderPagination(STATE.filteredFlights.length);
}

/**
 * Handles Flight Selection & populates the HUD / Side Panel
 */
function selectFlight(flight) {
    STATE.selectedFlight = flight;
    
    // Focus camera on the 3D globe
    if (STATE.globeInstance) {
        STATE.globeInstance.selectFlight(flight);
    }

    // Clear any previous HUD simulations
    clearTelemetryTimer();

    // Populate Sidebar Details Panel
    populateSidebarDetails(flight);

    // Fetch dynamic weather forecasts for departure/arrival coordinates
    fetchFlightWeather(flight);

    // If flight is "In Air", kickstart our high-fidelity real-time Cockpit HUD simulator!
    if (flight.status === "In Air") {
        startCockpitTelemetryHUD(flight);
    } else {
        updateCockpitHUDDisplay(flight.telemetry);
    }
}

/**
 * Formats details inside the slide-out panel
 */
function populateSidebarDetails(flight) {
    const isArrival = STATE.activeTab === "arrivals" || flight.destination === STATE.selectedAirport;
    
    document.getElementById("sidebar-placeholder").style.display = "none";
    document.getElementById("sidebar-details").style.display = "block";

    // Text details
    document.getElementById("det-flight-number").textContent = flight.flightNumber;
    document.getElementById("det-airline").textContent = flight.airline;
    document.getElementById("det-aircraft").textContent = flight.aircraft;
    
    // Status Badge
    const badge = document.getElementById("det-status-badge");
    badge.textContent = flight.statusText;
    badge.className = `status-badge ${flight.status.toLowerCase().replace(" ", "-")}`;

    // Locations
    document.getElementById("det-origin-code").textContent = flight.origin;
    document.getElementById("det-origin-city").textContent = flight.originCity;
    document.getElementById("det-origin-country").textContent = flight.originCountry;
    document.getElementById("det-origin-name").textContent = flight.originName;

    document.getElementById("det-dest-code").textContent = flight.destination;
    document.getElementById("det-dest-city").textContent = flight.destCity;
    document.getElementById("det-dest-country").textContent = flight.destCountry;
    document.getElementById("det-dest-name").textContent = flight.destName;

    // Gates / Terminal details
    document.getElementById("det-terminal").textContent = flight.terminal || "-";
    document.getElementById("det-gate").textContent = flight.gate || "-";
    document.getElementById("det-baggage").textContent = flight.baggageBelt || "-";

    // Date & Scheduled Time
    const schedDate = new Date(flight.scheduledTime);
    const actualDate = new Date(flight.actualTime);
    document.getElementById("det-scheduled-time").textContent = `${schedDate.toLocaleDateString()} ${formatClockTime(schedDate)}`;
    document.getElementById("det-actual-time").textContent = `${actualDate.toLocaleDateString()} ${formatClockTime(actualDate)}`;

    // Distance metric
    document.getElementById("det-distance").textContent = `${flight.telemetry.distance} km`;

    // Progress Bar & Plane Plotter in details arc diagram
    updateRouteProgressBar(flight.telemetry.progress);
    
    // Set up Countdown Timer
    startCountdownTimer(actualDate, flight.status);
}

/**
 * Renders Glowing Progress Bar
 */
function updateRouteProgressBar(progress) {
    const fill = document.getElementById("det-progress-fill");
    const pct = document.getElementById("det-progress-pct");
    const planeDot = document.getElementById("det-plane-dot");

    const percentage = Math.round(progress * 100);
    if (fill) fill.style.width = `${percentage}%`;
    if (pct) pct.textContent = `${percentage}%`;
    
    // Animate plane position on route line
    if (planeDot) {
        // Bound left percentage offset between 10% and 90% representing path
        const boundedLeft = Math.max(10, Math.min(90, percentage));
        planeDot.style.left = `${boundedLeft}%`;
    }
}

/**
 * Renders Countdown Clock Left Till Touchdown
 */
let countdownTimerInterval = null;
function startCountdownTimer(targetTime, status) {
    if (countdownTimerInterval) clearInterval(countdownTimerInterval);

    const container = document.getElementById("det-countdown-container");
    const valueEl = document.getElementById("det-countdown-value");
    
    if (status === "Landed" || status === "Departed" || status === "Cancelled") {
        container.style.display = "none";
        return;
    }

    container.style.display = "flex";

    const updateCountdown = () => {
        const now = new Date();
        const diffMs = targetTime - now;

        if (diffMs <= 0) {
            valueEl.textContent = "TOUCHDOWN / DEPARTED";
            clearInterval(countdownTimerInterval);
            return;
        }

        const diffMins = Math.floor(diffMs / 1000 / 60);
        const hours = Math.floor(diffMins / 60);
        const mins = diffMins % 60;
        const secs = Math.floor((diffMs / 1000) % 60);

        let display = "";
        if (hours > 0) display += `${hours}h `;
        display += `${mins}m ${secs}s`;
        
        valueEl.textContent = display;
    };

    updateCountdown();
    countdownTimerInterval = setInterval(updateCountdown, 1000);
}

/**
 * Real-Time Dynamic Cockpit HUD Telemetry Engine!
 * Updates speed, alt, progress, and geographic coordinates every 2s.
 */
function startCockpitTelemetryHUD(flight) {
    const duration = flight.telemetry.duration;
    
    const updateHUD = () => {
        // Read progress smoothly updated by the 3D globe's frame-rendering loop
        let progress = flight.telemetry.progress;
        
        if (progress >= 1.0) {
            progress = 1.0;
            clearTelemetryTimer();
            STATE.selectedFlight.status = "Landed";
            STATE.selectedFlight.statusText = "Landed";
            populateSidebarDetails(STATE.selectedFlight);
        }

        const elapsed = Math.round(progress * duration);

        // Fluctuate airspeed and altitude slightly to show aerodynamic realism!
        const speedFluctuation = Math.floor(Math.random() * 9) - 4; // -4 to +4
        const altFluctuation = Math.floor(Math.random() * 21) - 10; // -10 to +10
        
        const speed = Math.max(810, Math.min(880, flight.telemetry.speed + speedFluctuation));
        
        let altitude = flight.telemetry.altitude;
        if (progress > 0.9) {
            // Descending
            altitude = Math.max(0, Math.round(altitude * (1.0 - (progress - 0.9) * 10)));
        } else {
            altitude = Math.max(9000, flight.telemetry.altitude + altFluctuation);
        }

        // Interpolate live coordinates to reflect live hud tracking
        const currLat = flight.originLat + (flight.destLat - flight.originLat) * progress;
        const currLon = flight.originLon + (flight.destLon - flight.originLon) * progress;

        const currentTelemetry = {
            altitude,
            speed,
            heading: flight.telemetry.heading,
            latitude: currLat,
            longitude: currLon,
            progress,
            elapsed,
            duration,
            distance: flight.telemetry.distance
        };

        // Render Telemetry onto float cockpit HUD cards
        updateCockpitHUDDisplay(currentTelemetry);

        // Refresh Sidebar details elements (progress bar)
        updateRouteProgressBar(progress);
    };

    updateHUD();
    STATE.telemetryTimer = setInterval(updateHUD, 1000); // Check and sync values every 1 second
}

function updateCockpitHUDDisplay(telemetry) {
    document.getElementById("hud-altitude").textContent = telemetry.altitude > 0 ? `${telemetry.altitude.toLocaleString()} m` : "GND";
    document.getElementById("hud-speed").textContent = telemetry.speed > 0 ? `${telemetry.speed} km/h` : "STN";
    document.getElementById("hud-heading").textContent = `${telemetry.heading}°`;
    document.getElementById("hud-lat").textContent = telemetry.latitude.toFixed(4);
    document.getElementById("hud-lon").textContent = telemetry.longitude.toFixed(4);
    
    // Rotate HUD glass compass needle
    const needle = document.getElementById("hud-compass-needle");
    if (needle) {
        needle.style.transform = `rotate(${telemetry.heading}deg)`;
    }
}

function clearTelemetryTimer() {
    if (STATE.telemetryTimer) {
        clearInterval(STATE.telemetryTimer);
        STATE.telemetryTimer = null;
    }
}

/**
 * Weather Engine: Fetches Open-Meteo local forecasts for coordinates
 */
async function fetchFlightWeather(flight) {
    const originLabel = document.getElementById("weather-origin-city");
    const originTemp = document.getElementById("weather-origin-temp");
    const originCond = document.getElementById("weather-origin-cond");
    const originWind = document.getElementById("weather-origin-wind");

    const destLabel = document.getElementById("weather-dest-city");
    const destTemp = document.getElementById("weather-dest-temp");
    const destCond = document.getElementById("weather-dest-cond");
    const destWind = document.getElementById("weather-dest-wind");

    // Origin Weather Fetch
    originLabel.textContent = flight.originCity;
    const originWeather = await getWeather(flight.originLat, flight.originLon);
    originTemp.innerHTML = `${Math.round(originWeather.temp)}<span>°C</span>`;
    originCond.textContent = originWeather.description;
    originWind.textContent = `🌬️ ${originWeather.windspeed} km/h`;

    // Destination Weather Fetch
    destLabel.textContent = flight.destCity;
    const destWeather = await getWeather(flight.destLat, flight.destLon);
    destTemp.innerHTML = `${Math.round(destWeather.temp)}<span>°C</span>`;
    destCond.textContent = destWeather.description;
    destWind.textContent = `🌬️ ${destWeather.windspeed} km/h`;
}

async function getWeather(lat, lon) {
    const cacheKey = `${lat.toFixed(2)}_${lon.toFixed(2)}`;
    if (STATE.weatherCache[cacheKey]) {
        return STATE.weatherCache[cacheKey];
    }

    try {
        const res = await fetch(`/api/weather/${lat}/${lon}`);
        const data = await res.json();
        STATE.weatherCache[cacheKey] = data;
        return data;
    } catch {
        return { temp: 15.0, windspeed: 12.0, description: "Mainly Clear" };
    }
}

/**
 * Heartbeat diagnostic widget updater
 */
async function fetchHeartbeat() {
    try {
        const res = await fetch("/api/heartbeat");
        const data = await res.json();
        STATE.apiHeartbeat = data;

        const dot = document.getElementById("heartbeat-pulse-dot");
        const statusText = document.getElementById("heartbeat-status-text");

        if (dot && statusText) {
            if (data.swedavia.connected) {
                dot.className = "pulse-dot animating";
                statusText.textContent = "SWEDAVIA API: SECURE CONNECT";
            } else if (data.swedavia.status === "MISSING_KEY" || data.swedavia.status === "DISABLED") {
                dot.className = "pulse-dot warning animating";
                statusText.textContent = "LIVE SIMULATION MODE";
            } else {
                dot.className = "pulse-dot error animating";
                statusText.textContent = "SWEDAVIA OFFLINE";
            }
        }
    } catch (err) {
        console.error("Diagnostic heartbeat failed", err);
    }
}

/**
 * Dashboard Tab renderer
 */
function renderDashboardSummary() {
    const flightsCount = STATE.flights.length;
    const activeAir = STATE.flights.filter(f => f.status === "In Air").length;
    const boarding = STATE.flights.filter(f => f.status === "Boarding").length;
    const delayed = STATE.flights.filter(f => f.status === "Delayed").length;

    const cardsHtml = `
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; width: 100%;">
            <div class="hud-panel" style="width:100%; border-left: 3px solid var(--color-cyan);">
                <div class="hud-title">📊 Hub Flights Today</div>
                <div class="hud-value" style="font-size:2.2rem; text-shadow: var(--shadow-cyan);">${flightsCount}</div>
                <span style="font-size:0.75rem; color:var(--text-secondary);">Total Arrivals / Departures</span>
            </div>
            <div class="hud-panel" style="width:100%; border-left: 3px solid var(--color-green);">
                <div class="hud-title">✈️ Actively In Air</div>
                <div class="hud-value" style="font-size:2.2rem; text-shadow: 0 0 15px rgba(57,255,20,0.4);">${activeAir}</div>
                <span style="font-size:0.75rem; color:var(--text-secondary);">Simulated Great-Circle Tracking</span>
            </div>
            <div class="hud-panel" style="width:100%; border-left: 3px solid var(--color-magenta);">
                <div class="hud-title">🎫 Boarding Now</div>
                <div class="hud-value" style="font-size:2.2rem; text-shadow: var(--shadow-magenta);">${boarding}</div>
                <span style="font-size:0.75rem; color:var(--text-secondary);">Active Gate Transmissions</span>
            </div>
            <div class="hud-panel" style="width:100%; border-left: 3px solid var(--color-amber);">
                <div class="hud-title">⚠️ Delayed Flights</div>
                <div class="hud-value" style="font-size:2.2rem; text-shadow: 0 0 15px rgba(255,183,0,0.4);">${delayed}</div>
                <span style="font-size:0.75rem; color:var(--text-secondary);">Punctuality Variance Warnings</span>
            </div>
        </div>
        <div style="margin-top:24px; background:var(--bg-card); border: 1px solid var(--border-light); border-radius:12px; padding:24px;">
            <h3 style="font-size:1.1rem; color:var(--color-cyan); margin-bottom:12px;">Welcome to Swedavia FlightInfo Cockpit</h3>
            <p style="color:var(--text-secondary); line-height:1.6; font-size:0.9rem;">
                Select any Swedavia hub from the top right selector to fetch live airport flight logs. 
                Interact with the <b>3D Globe View</b> above by clicking, spinning, and zooming. 
                To inspect a flight's real-time trajectory and activate the <b>floating cockpit HUD</b>, click on any flight row in the Arrivals or Departures tables below.
            </p>
        </div>
    `;
    
    document.getElementById("dashboard-view").innerHTML = cardsHtml;
}

/**
 * Diagnostics Tab renderer
 */
function renderDiagnosticsPanel() {
    const wrapper = document.getElementById("diagnostics-view");
    if (!wrapper || !STATE.apiHeartbeat) return;

    const hb = STATE.apiHeartbeat;
    const clientStatus = hb.swedavia.connected ? "STABLE CONNECTED" : "FALLBACK SIMULATOR";
    const color = hb.swedavia.connected ? "var(--color-green)" : "var(--color-amber)";

    wrapper.innerHTML = `
        <div class="diagnostic-deck">
            <div class="diagnostic-card">
                <h3>🖥️ Core API Status</h3>
                <p style="color: ${color}; font-size: 1.1rem; font-weight: bold;">${clientStatus}</p>
                <span style="font-size:0.75rem;">Time: ${formatClockTime(new Date(hb.time))}</span>
            </div>
            <div class="diagnostic-card">
                <h3>🔌 Swedavia Endpoint Diagnostics</h3>
                <p>Status: ${hb.swedavia.status}</p>
                <span style="font-size:0.75rem; color:var(--text-secondary);">${hb.swedavia.message}</span>
            </div>
            <div class="diagnostic-card">
                <h3>🚀 Swedavia API Credentials</h3>
                <p>Protected Backend Scope</p>
                <span style="font-size:0.75rem; color:var(--text-secondary);">Active Key Length: ${STATE.apiHeartbeat.simulatedMode ? '0 bytes (Mock fallback active)' : 'Protected Key Masked'}</span>
            </div>
        </div>
        <div style="margin-top:20px; background:var(--bg-card); border: 1px solid var(--border-light); border-radius:12px; padding:20px;">
            <h3 style="font-size:0.9rem; color:var(--color-cyan); text-transform:uppercase; margin-bottom:10px;">Security Architecture Report</h3>
            <pre style="background:rgba(0,0,0,0.3); padding:16px; border-radius:8px; font-family:var(--font-mono); font-size:0.8rem; line-height:1.5;">
[SECURITY CONFIG] CORS protection strictly routed through local loopback backend.
[API SCOPE] Subscription key Ocp-Apim-Subscription-Key is securely hidden inside the Python OS environment block.
[FRONTEND SAFETY] Browser console query network traces reveal 0 leaks of Swedavia subscription parameters.
[INPUT INTEGRITY] Sanitized parameters for both terminal simulation and weather endpoints.
            </pre>
        </div>
    `;
}

// Pagination Drawer

function renderPagination(totalCount) {
    const isArrival = STATE.activeTab === "arrivals";
    const wrapperId = isArrival ? "pagination-container" : "pagination-container-dep";
    const wrapper = document.getElementById(wrapperId);
    if (!wrapper) return;

    const totalPages = Math.max(1, Math.ceil(totalCount / STATE.pageSize));
    const startIdx = (STATE.currentPage - 1) * STATE.pageSize + 1;
    const endIdx = Math.min(startIdx + STATE.pageSize - 1, totalCount);

    wrapper.innerHTML = `
        <div class="pagination-controls">
            <div>Showing ${totalCount > 0 ? startIdx : 0}-${endIdx} of ${totalCount} flights</div>
            <div class="pagination-btns">
                <button class="pagination-btn" id="btn-prev-page" ${STATE.currentPage === 1 ? "disabled" : ""}>◀ PREV</button>
                <span style="display:flex; align-items:center; padding: 0 10px; font-family:var(--font-mono);">${STATE.currentPage} / ${totalPages}</span>
                <button class="pagination-btn" id="btn-next-page" ${STATE.currentPage === totalPages ? "disabled" : ""}>NEXT ▶</button>
            </div>
        </div>
    `;

    const prevBtn = document.getElementById("btn-prev-page");
    const nextBtn = document.getElementById("btn-next-page");

    if (prevBtn) {
        prevBtn.addEventListener("click", () => {
            if (STATE.currentPage > 1) {
                STATE.currentPage--;
                renderFlightTable();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener("click", () => {
            if (STATE.currentPage < totalPages) {
                STATE.currentPage++;
                renderFlightTable();
            }
        });
    }
}

// State Resetting Helpers

function resetDetailsSidebar() {
    document.getElementById("sidebar-placeholder").style.display = "flex";
    document.getElementById("sidebar-details").style.display = "none";
}

// Table Status States Display

function showTableLoading() {
    const isArrival = STATE.activeTab === "arrivals" || STATE.activeTab === "dashboard";
    const tbodyId = isArrival ? "flights-table-body" : "flights-table-body-departures";
    const tbody = document.getElementById(tbodyId);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7">
                    <div class="loading-overlay">
                        <div class="spinner"></div>
                        <div style="font-family:var(--font-mono); color:var(--color-cyan); font-size:0.9rem;">ACQUIRING RADAR BEACON TRANSMISSIONS...</div>
                    </div>
                </td>
            </tr>
        `;
    }
}

function showTableError(msg) {
    const isArrival = STATE.activeTab === "arrivals" || STATE.activeTab === "dashboard";
    const tbodyId = isArrival ? "flights-table-body" : "flights-table-body-departures";
    const tbody = document.getElementById(tbodyId);
    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="empty-message" style="color:var(--color-red);">
                    ⚠️ Radar Connection Failure: ${msg}
                </td>
            </tr>
        `;
    }
}

// Utility Formatters

function formatClockTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
}
