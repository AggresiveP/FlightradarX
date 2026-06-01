/**
 * Swedavia FlightInfo Ultimate 3D Edition - 3D Globe Visualizer
 * Integrates Globe.gl with Three.js to construct a rotatable 3D earth
 * with glowing arcs, neon pulses, and active flight tracking.
 * Enhanced with 3D glowing jet models and propagating radar sync sweeps.
 */

class FlightGlobe {
    constructor(containerId, onAirportClick) {
        this.container = document.getElementById(containerId);
        this.onAirportClick = onAirportClick;
        this.globe = null;
        this.airports = [];
        this.activeArcs = [];
        this.selectedFlightId = null;
        this.currentFlights = []; // Cache list of active flights for custom 3D airplane animations
        this.activeHubCode = "ARN"; // Default active hub

        // Custom theme settings
        this.colors = {
            cyan: "#00f0ff",
            magenta: "#bd00ff",
            amber: "#ffb700",
            green: "#39ff14",
            darkBg: "#06070a"
        };
    }

    init(airportsData) {
        if (!this.container) return;

        this.airports = Object.entries(airportsData).map(([code, meta]) => ({
            code,
            lat: meta.lat,
            lon: meta.lon,
            name: meta.name,
            city: meta.city,
            size: code === "ARN" ? 0.3 : 0.18,
            color: this.colors.cyan
        }));

        // Instantiate Globe.gl
        this.globe = Globe()(this.container)
            // Use gorgeous, dark, glowing earth textures
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-night.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl(null) // Transparent background to show our CSS gradient
            .backgroundColor('rgba(0, 0, 0, 0)') // alpha transparency
            
            // Markers for Swedish Hub Airports
            .pointsData(this.airports)
            .pointLat('lat')
            .pointLng('lon')
            .pointColor('color')
            .pointAltitude(0.01)
            .pointRadius('size')
            .pointsMerge(false)
            .pointLabel(d => `
                <div style="background: rgba(14,17,27,0.9); border: 1px solid #00f0ff; border-radius: 8px; padding: 8px 12px; font-family: sans-serif; color: white;">
                    <b style="color: #00f0ff; font-family: monospace; font-size: 1.1em;">${d.code}</b><br>
                    <span style="font-size: 0.85em; opacity: 0.85;">${d.name}</span><br>
                    <span style="font-size: 0.75em; color: #8e9dae;">${d.city}, Sweden</span>
                </div>
            `)
            .onPointClick(point => {
                if (this.onAirportClick) {
                    this.onAirportClick(point.code);
                }
            })

            // Dynamic Neon Bezier Arcs for Flight Paths
            .arcsData([])
            .arcStartLat('startLat')
            .arcStartLng('startLon')
            .arcEndLat('endLat')
            .arcEndLng('endLon')
            .arcColor('color')
            .arcAltitude('alt')
            .arcStroke('stroke')
            .arcDashLength(0.4)
            .arcDashGap(0.15)
            .arcDashAnimateTime(1600) // Beautiful shooting star animation speed
            
            // Labels for arcs when hovered
            .arcLabel(d => `
                <div style="background: rgba(14,17,27,0.95); border: 1px solid #bd00ff; border-radius: 8px; padding: 10px; font-family: sans-serif; color: white; box-shadow: 0 0 15px rgba(189,0,255,0.3);">
                    <div style="font-weight: 800; color: #bd00ff; font-family: monospace; font-size: 1.1em; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 4px; margin-bottom: 6px;">
                        🛫 FLIGHT ${d.flightNumber}
                    </div>
                    <div style="font-size: 0.85em; display: flex; gap: 8px; justify-content: space-between;">
                        <span><b>${d.origin}</b> to <b>${d.destination}</b></span>
                        <span style="color: #39ff14;">${d.status}</span>
                    </div>
                    <div style="font-size: 0.75em; color: #8e9dae; margin-top: 4px;">
                        Carrier: ${d.airline}<br>
                        Aircraft: ${d.aircraft}
                    </div>
                </div>
            `)

            // Radar Sync Rings at the Active Hub Airport (Pulsing Radar Sweep)
            .ringsData([])
            .ringLat('lat')
            .ringLng('lon')
            .ringColor(() => 'rgba(0, 240, 255, 0.45)') // Subtle glowing cyan radar ripple
            .ringMaxRadius(4.5)
            .ringPropagationSpeed(3.0)
            .ringRepeatPeriod(900)

            // Custom ThreeJS Layer for Animated 3D Airplanes
            .customLayerData([])
            .customThreeObject(d => {
                const airplane = new THREE.Group();
                
                // Fuselage (Cone shape pointing forward)
                const bodyGeom = new THREE.ConeGeometry(0.32, 1.6, 8);
                bodyGeom.rotateX(Math.PI / 2); // Rotate to point forward along the Z axis
                
                // Emissive neon material that glows in the dark
                const mat = new THREE.MeshBasicMaterial({
                    color: d.color,
                    transparent: true,
                    opacity: 0.95
                });
                
                const body = new THREE.Mesh(bodyGeom, mat);
                airplane.add(body);
                
                // Wings (Thin flattened box)
                const wingsGeom = new THREE.BoxGeometry(2.0, 0.03, 0.45);
                const wings = new THREE.Mesh(wingsGeom, mat);
                wings.position.set(0, -0.04, 0.1);
                airplane.add(wings);
                
                // Tail Fin (Vertical box)
                const tailGeom = new THREE.BoxGeometry(0.03, 0.55, 0.3);
                const tail = new THREE.Mesh(tailGeom, mat);
                tail.position.set(0, 0.25, -0.55);
                airplane.add(tail);
                
                // Throttled engine glow thrusters (Bright orange flame meshes)
                const engineGeom = new THREE.BoxGeometry(0.1, 0.1, 0.25);
                const engineMat = new THREE.MeshBasicMaterial({ color: '#ffb700' });
                
                const leftEngine = new THREE.Mesh(engineGeom, engineMat);
                leftEngine.position.set(-0.3, -0.08, -0.28);
                airplane.add(leftEngine);
                
                const rightEngine = new THREE.Mesh(engineGeom, engineMat);
                rightEngine.position.set(0.3, -0.08, -0.28);
                airplane.add(rightEngine);
                
                return airplane;
            })
            .customThreeObjectUpdate((obj, d) => {
                try {
                    const progress = d.progress;
                    
                    // Simple linear interpolation of latitude and longitude
                    const lat = d.startLat + (d.endLat - d.startLat) * progress;
                    const lon = d.startLon + (d.endLon - d.startLon) * progress;
                    
                    // Beautiful arched trajectory matching the visual Bezier arcs
                    const arcAlt = Math.min(0.35, Math.max(0.12, d.distance / 4500));
                    const currentAlt = arcAlt * Math.sin(progress * Math.PI);
                    
                    // Retrieve 3D Cartesian coordinates of current position on the sphere surface
                    const coords = this.globe.getCoords(lat, lon, currentAlt);
                    if (coords) {
                        obj.position.set(coords.x, coords.y, coords.z);
                    }
                    
                    // Orient the airplane to look forward along the flight path tangent
                    const nextProgress = Math.min(1.0, progress + 0.005);
                    const nextLat = d.startLat + (d.endLat - d.startLat) * nextProgress;
                    const nextLon = d.startLon + (d.endLon - d.startLon) * nextProgress;
                    const nextAlt = arcAlt * Math.sin(nextProgress * Math.PI);
                    
                    const nextCoords = this.globe.getCoords(nextLat, nextLon, nextAlt);
                    if (nextCoords) {
                        obj.lookAt(new THREE.Vector3(nextCoords.x, nextCoords.y, nextCoords.z));
                    }
                } catch (err) {
                    console.error("Error updating 3D airplane position:", err);
                }
            });

        // Set initial camera view focused squarely on Sweden/Scandinavia
        this.globe.pointOfView({ lat: 60.5, lng: 18.0, altitude: 1.85 }, 0);
        
        // Disable automatic globe rotation to allow smooth focus panning
        this.globe.controls().autoRotate = false;
        this.globe.controls().enableZoom = true;
        this.globe.controls().minAltitude = 1.1;
        this.globe.controls().maxAltitude = 4.0;
        
        // Handle window resize events cleanly
        window.addEventListener('resize', () => {
            if (this.globe) {
                this.globe.width(this.container.clientWidth);
                this.globe.height(this.container.clientHeight);
            }
        });

        // Kick off our custom, frame-by-frame airplane telemetry animation loop
        this._startAnimationLoop();

        // Draw initial radar sync rings centered at default active hub
        this._updateRings();
    }

    /**
     * Updates the active Swedish airport hub to center the radar sync sweep rings.
     */
    setActiveHub(airportCode) {
        this.activeHubCode = airportCode;
        this._updateRings();
    }

    /**
     * Refreshes the radar sync rings position centered at the active airport hub.
     */
    _updateRings() {
        if (!this.globe) return;
        
        const hub = this.airports.find(a => a.code === this.activeHubCode);
        if (hub) {
            this.globe.ringsData([{
                lat: hub.lat,
                lon: hub.lon
            }]);
        } else {
            this.globe.ringsData([]);
        }
    }

    /**
     * Continuous frame-by-frame rendering loop to animate ALL active airplanes in real-time.
     */
    _startAnimationLoop() {
        const animate = () => {
            if (this.globe && this.currentFlights.length > 0) {
                // Render and animate 3D airplanes for all active routes on the globe
                const flyingFlights = this.currentFlights;
                
                const customData = flyingFlights.map(f => {
                    // Ensure telemetry and progress are initialized organically
                    if (!f.telemetry) {
                        f.telemetry = { progress: Math.random(), duration: 60, distance: 500 };
                    }
                    if (f.telemetry.progress === undefined) {
                        f.telemetry.progress = Math.random();
                    }
                    
                    // Ticking progress: speed is proportional to duration to look realistic
                    const duration = f.telemetry.duration || 60;
                    const increment = 0.004 / duration; // Smooth ticking increment
                    f.telemetry.progress += increment;
                    if (f.telemetry.progress >= 1.0) {
                        f.telemetry.progress = 0.0; // Loop flight path
                    }
                    
                    const isSelected = f.id === this.selectedFlightId;
                    return {
                        id: f.id,
                        flightNumber: f.flightNumber,
                        startLat: f.originLat,
                        startLon: f.originLon,
                        endLat: f.destLat,
                        endLon: f.destLon,
                        distance: f.telemetry.distance || 500,
                        progress: f.telemetry.progress,
                        color: isSelected ? this.colors.magenta : this.colors.cyan
                    };
                });
                
                this.globe.customLayerData(customData);
            }
            requestAnimationFrame(animate);
        };
        requestAnimationFrame(animate);
    }

    /**
     * Updates the 3D globe with active routes. 
     * Plots glowing bezier arcs for all currently visible flights.
     */
    updateFlights(flights) {
        if (!this.globe) return;

        // Cache all flights to feed the airplane animation engine
        this.currentFlights = flights;

        this.activeArcs = flights.map(f => {
            const isSelected = f.id === this.selectedFlightId;
            return {
                id: f.id,
                flightNumber: f.flightNumber,
                airline: f.airline,
                aircraft: f.aircraft,
                status: f.status,
                origin: f.origin,
                destination: f.destination,
                startLat: f.originLat,
                startLon: f.originLon,
                endLat: f.destLat,
                endLon: f.destLon,
                // Adjust curve altitude based on distance to make it look uniform
                alt: Math.min(0.35, Math.max(0.12, f.telemetry.distance / 4500)),
                // Elegant, semi-transparent radar vectors to keep the scene clean
                color: isSelected ? 'rgba(189, 0, 255, 0.45)' : 'rgba(0, 240, 255, 0.12)',
                stroke: isSelected ? 1.0 : 0.22
            };
        });

        this.globe.arcsData(this.activeArcs);
        this._updateRings(); // Keep rings aligned with loaded data
    }

    /**
     * Pan camera and focus squarely on a selected flight's active trajectory.
     */
    selectFlight(flight) {
        if (!this.globe || !flight) return;

        this.selectedFlightId = flight.id;
        
        // Redraw arcs to highlight the chosen flight in glowing hot magenta
        if (this.activeArcs.length > 0) {
            this.activeArcs.forEach(arc => {
                const isSelected = arc.id === flight.id;
                arc.color = isSelected ? 'rgba(189, 0, 255, 0.45)' : 'rgba(0, 240, 255, 0.12)';
                arc.stroke = isSelected ? 1.0 : 0.22;
            });
            this.globe.arcsData(this.activeArcs);
        }

        // Calculate midpoint of flight route for camera centering
        const midLat = (flight.originLat + flight.destLat) / 2.0;
        const midLon = (flight.originLon + flight.destLon) / 2.0;

        // Animate camera focus pan & zoom in to the route
        this.globe.pointOfView({
            lat: midLat - 2.0, // slight offset south to make cockpit HUD visible
            lng: midLon,
            altitude: 1.25 // zoomed in close HUD-view
        }, 1500); // 1.5 second camera fly-to transition
    }

    /**
     * Recenters camera view back to Scandinavian airspace
     */
    recenter() {
        if (!this.globe) return;
        this.selectedFlightId = null;
        
        // Reset arc styles back to cyber cyan
        if (this.activeArcs.length > 0) {
            this.activeArcs.forEach(arc => {
                arc.color = 'rgba(0, 240, 255, 0.12)';
                arc.stroke = 0.22;
            });
            this.globe.arcsData(this.activeArcs);
        }

        this.globe.pointOfView({ lat: 60.5, lng: 18.0, altitude: 1.85 }, 1200);
    }
}
