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
            // Use gorgeous earth texture that responds to dynamic light shading
            .globeImageUrl('//unpkg.com/three-globe/example/img/earth-blue-marble.jpg')
            .bumpImageUrl('//unpkg.com/three-globe/example/img/earth-topology.png')
            .backgroundImageUrl(null) // Transparent background to show our CSS gradient
            .backgroundColor('rgba(0, 0, 0, 0)'); // alpha transparency

        // Configure Globe material for moving water waves, specular shine, and night lights
        const globeMat = this.globe.globeMaterial();
        globeMat.specular = new THREE.Color(0x222222);
        globeMat.shininess = 35;

        const textureLoader = new THREE.TextureLoader();
        
        // 1. Load water specular mask
        textureLoader.load('//unpkg.com/three-globe/example/img/earth-water.png', (specularTex) => {
            globeMat.specularMap = specularTex;
            globeMat.needsUpdate = true;
        });

        // 2. Load city night lights emissive map
        textureLoader.load('//unpkg.com/three-globe/example/img/earth-night.jpg', (nightTex) => {
            globeMat.emissiveMap = nightTex;
            globeMat.emissive = new THREE.Color(0xffffdd);
            globeMat.emissiveIntensity = 1.5;
            globeMat.needsUpdate = true;
        });

        // 3. Generate and assign procedural water normal map for animated ripples
        const waterCanvas = this._generateWaterNormalMap();
        const waterTexture = new THREE.CanvasTexture(waterCanvas);
        waterTexture.wrapS = THREE.RepeatWrapping;
        waterTexture.wrapT = THREE.RepeatWrapping;
        waterTexture.repeat.set(50, 25);
        this.waterTexture = waterTexture;
        
        globeMat.normalMap = waterTexture;
        globeMat.normalScale = new THREE.Vector2(0.12, 0.12);
        globeMat.needsUpdate = true;
            
        this.globe
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
            .onArcClick(arc => {
                if (this.onFlightClick) {
                    this.onFlightClick(arc.id);
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
            .ringColor(d => d.color || 'rgba(0, 240, 255, 0.45)') // Dynamic color support
            .ringMaxRadius(d => d.maxRadius || 4.5)               // Dynamic size support
            .ringPropagationSpeed(d => d.speed || 3.0)           // Dynamic speed/propagation support
            .ringRepeatPeriod(d => d.repeatPeriod || 900)        // Dynamic timing support

            // Custom ThreeJS Layer for Animated 3D Airplanes
            .customLayerData([])
            .customThreeObject(d => {
                const airplane = new THREE.Group();
                const aircraftType = (d.aircraft || "B737").toUpperCase();
                
                // Emissive neon material that glows in the dark
                const mat = new THREE.MeshBasicMaterial({
                    color: d.color,
                    transparent: true,
                    opacity: 0.95
                });
                
                // Propeller blades material (highly visible white)
                const propMat = new THREE.MeshBasicMaterial({
                    color: 0xffffff,
                    transparent: false
                });
                
                // Jet engine thruster core material (bright orange fire)
                const engineMat = new THREE.MeshBasicMaterial({ color: '#ff6c00' });

                // Wing tip and strobe light materials
                const wingRedMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const wingGreenMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
                const strobeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
                
                if (aircraftType.includes("ATR") || 
                    aircraftType.includes("AT7") || 
                    aircraftType.includes("AT4") || 
                    aircraftType.includes("DH4") || 
                    aircraftType.includes("DASH") || 
                    aircraftType.includes("SF3") || 
                    aircraftType.includes("SAAB")) {
                    // --- 1. Regional Turboprop (e.g. ATR-72) ---
                    // Fuselage (slender cone)
                    const bodyGeom = new THREE.ConeGeometry(0.22, 1.25, 8);
                    bodyGeom.rotateX(Math.PI / 2);
                    const body = new THREE.Mesh(bodyGeom, mat);
                    airplane.add(body);
                    
                    // Wings (straight, high aspect ratio)
                    const wingsGeom = new THREE.BoxGeometry(1.8, 0.03, 0.35);
                    const wings = new THREE.Mesh(wingsGeom, mat);
                    wings.position.set(0, 0.05, 0.15);
                    airplane.add(wings);
                    
                    // Tail Fin (high T-tail)
                    const tailGeom = new THREE.BoxGeometry(0.03, 0.45, 0.25);
                    const tail = new THREE.Mesh(tailGeom, mat);
                    tail.position.set(0, 0.25, -0.45);
                    airplane.add(tail);
                    
                    // Two Engine Nacelles on wings
                    const engGeom = new THREE.BoxGeometry(0.12, 0.12, 0.32);
                    const engLeft = new THREE.Mesh(engGeom, mat);
                    engLeft.position.set(-0.4, 0.04, 0.18);
                    airplane.add(engLeft);
                    
                    const engRight = new THREE.Mesh(engGeom, mat);
                    engRight.position.set(0.4, 0.04, 0.18);
                    airplane.add(engRight);
                    
                    // Spin Propellers (named for frame animations)
                    const propGeom = new THREE.BoxGeometry(0.48, 0.04, 0.02);
                    const propLeft = new THREE.Mesh(propGeom, propMat);
                    propLeft.name = "propLeft";
                    propLeft.position.set(-0.4, 0.04, 0.35);
                    airplane.add(propLeft);
                    
                    const propRight = new THREE.Mesh(propGeom, propMat);
                    propRight.name = "propRight";
                    propRight.position.set(0.4, 0.04, 0.35);
                    airplane.add(propRight);

                    // Blinking navigation and strobe lights
                    const lightRed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), wingRedMat);
                    lightRed.name = "wingRed";
                    lightRed.position.set(-0.9, 0.05, 0.15);
                    airplane.add(lightRed);
                    
                    const lightGreen = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), wingGreenMat);
                    lightGreen.name = "wingGreen";
                    lightGreen.position.set(0.9, 0.05, 0.15);
                    airplane.add(lightGreen);
                    
                    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), strobeMat);
                    strobe.name = "strobe";
                    strobe.position.set(0, 0.48, -0.45); // tail fin tip
                    airplane.add(strobe);
                    
                } else if (aircraftType.includes("380") || aircraftType.includes("350") || aircraftType.includes("777") || aircraftType.includes("787")) {
                    // --- 2. Jumbo / Heavy Widebody Jet (4 Engines) ---
                    // Fuselage (large thick cone)
                    const bodyGeom = new THREE.ConeGeometry(0.42, 2.0, 10);
                    bodyGeom.rotateX(Math.PI / 2);
                    const body = new THREE.Mesh(bodyGeom, mat);
                    airplane.add(body);
                    
                    // Wings (long and swept back)
                    const wingsGeom = new THREE.BoxGeometry(2.7, 0.04, 0.55);
                    const wings = new THREE.Mesh(wingsGeom, mat);
                    wings.position.set(0, -0.05, 0.2);
                    airplane.add(wings);
                    
                    // Tail Fin
                    const tailGeom = new THREE.BoxGeometry(0.04, 0.65, 0.35);
                    const tail = new THREE.Mesh(tailGeom, mat);
                    tail.position.set(0, 0.32, -0.7);
                    airplane.add(tail);
                    
                    // 4 Jet Engines under wings (2 on each side)
                    const engGeom = new THREE.BoxGeometry(0.12, 0.12, 0.38);
                    const engineXCoords = [-0.5, -0.9, 0.5, 0.9];
                    
                    engineXCoords.forEach(x => {
                        const engine = new THREE.Mesh(engGeom, mat);
                        engine.position.set(x, -0.12, 0.12);
                        airplane.add(engine);
                        
                        // Orange jet thruster fire glow behind engines
                        const flameGeom = new THREE.BoxGeometry(0.07, 0.07, 0.22);
                        const flame = new THREE.Mesh(flameGeom, engineMat);
                        flame.position.set(x, -0.12, -0.12);
                        airplane.add(flame);
                    });

                    // Blinking navigation and strobe lights
                    const lightRed = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), wingRedMat);
                    lightRed.name = "wingRed";
                    lightRed.position.set(-1.35, -0.05, 0.2);
                    airplane.add(lightRed);
                    
                    const lightGreen = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), wingGreenMat);
                    lightGreen.name = "wingGreen";
                    lightGreen.position.set(1.35, -0.05, 0.2);
                    airplane.add(lightGreen);
                    
                    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.05, 4, 4), strobeMat);
                    strobe.name = "strobe";
                    strobe.position.set(0, 0.65, -0.7); // tail fin tip
                    airplane.add(strobe);
                    
                } else {
                    // --- 3. Standard Jet (2 Engines) ---
                    // Fuselage
                    const bodyGeom = new THREE.ConeGeometry(0.32, 1.6, 8);
                    bodyGeom.rotateX(Math.PI / 2);
                    const body = new THREE.Mesh(bodyGeom, mat);
                    airplane.add(body);
                    
                    // Wings
                    const wingsGeom = new THREE.BoxGeometry(2.0, 0.03, 0.45);
                    const wings = new THREE.Mesh(wingsGeom, mat);
                    wings.position.set(0, -0.04, 0.1);
                    airplane.add(wings);
                    
                    // Tail Fin
                    const tailGeom = new THREE.BoxGeometry(0.03, 0.55, 0.3);
                    const tail = new THREE.Mesh(tailGeom, mat);
                    tail.position.set(0, 0.25, -0.55);
                    airplane.add(tail);
                    
                    // 2 Jet Engines
                    const engineGeom = new THREE.BoxGeometry(0.1, 0.1, 0.25);
                    
                    const leftEngine = new THREE.Mesh(engineGeom, mat);
                    leftEngine.position.set(-0.35, -0.08, 0.05);
                    airplane.add(leftEngine);
                    
                    const rightEngine = new THREE.Mesh(engineGeom, mat);
                    rightEngine.position.set(0.35, -0.08, 0.05);
                    airplane.add(rightEngine);
                    
                    // Throttled engine glow thrusters (Bright orange flame meshes)
                    const flameGeom = new THREE.BoxGeometry(0.06, 0.06, 0.15);
                    const leftFlame = new THREE.Mesh(flameGeom, engineMat);
                    leftFlame.position.set(-0.35, -0.08, -0.1);
                    airplane.add(leftFlame);
                    
                    const rightFlame = new THREE.Mesh(flameGeom, engineMat);
                    rightFlame.position.set(0.35, -0.08, -0.1);
                    airplane.add(rightFlame);

                    // Blinking navigation and strobe lights
                    const lightRed = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), wingRedMat);
                    lightRed.name = "wingRed";
                    lightRed.position.set(-1.0, -0.04, 0.1);
                    airplane.add(lightRed);
                    
                    const lightGreen = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), wingGreenMat);
                    lightGreen.name = "wingGreen";
                    lightGreen.position.set(1.0, -0.04, 0.1);
                    airplane.add(lightGreen);
                    
                    const strobe = new THREE.Mesh(new THREE.SphereGeometry(0.04, 4, 4), strobeMat);
                    strobe.name = "strobe";
                    strobe.position.set(0, 0.55, -0.55); // tail fin tip
                    airplane.add(strobe);
                }
                
                return airplane;
            })
            .customThreeObjectUpdate((obj, d) => {
                try {
                    const progress = d.progress;
                    
                    // Propeller animation rotation (ATR-72 turboprops)
                    const propLeft = obj.getObjectByName("propLeft");
                    const propRight = obj.getObjectByName("propRight");
                    if (propLeft) propLeft.rotation.z += 0.5;
                    if (propRight) propRight.rotation.z += 0.5;

                    // Blinking navigation and strobe lights
                    const wingRed = obj.getObjectByName("wingRed");
                    const wingGreen = obj.getObjectByName("wingGreen");
                    const strobe = obj.getObjectByName("strobe");
                    
                    // Strobe flashes rapidly (e.g. short double-flash every 1.2 seconds)
                    const time = Date.now();
                    const cycle = time % 1200;
                    const isStrobeOn = (cycle > 0 && cycle < 60) || (cycle > 180 && cycle < 240);
                    if (strobe) strobe.visible = isStrobeOn;
                    
                    // Wingtip lights blink slowly (1Hz)
                    const isWingOn = (time % 1000) < 500;
                    if (wingRed) wingRed.visible = isWingOn;
                    if (wingGreen) wingGreen.visible = isWingOn;
                    
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

        // Inject dynamic day/night terminator lighting and spinning clouds layer
        setTimeout(() => {
            const scene = this.globe.scene();
            if (!scene) return;

            // 1. Clear default Globe.gl wash-out lights
            const lightsToRemove = [];
            scene.traverse(child => {
                if (child.isLight) {
                    lightsToRemove.push(child);
                }
            });
            lightsToRemove.forEach(l => scene.remove(l));

            // 2. Add custom Ambient Light (soft celestial backing)
            const spaceAmbient = new THREE.AmbientLight(0xffffff, 0.18);
            scene.add(spaceAmbient);

            // 3. Add dynamic Directional Light (representing the Sun based on real UTC time)
            const sunLight = new THREE.DirectionalLight(0xffffff, 1.4);
            sunLight.name = "sunLight";

            const now = new Date();
            const dayOfYear = (Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(now.getFullYear(), 0, 0)) / 24 / 60 / 60 / 1000;
            const sunLat = 23.45 * Math.sin((2 * Math.PI / 365) * (dayOfYear - 80)); // Sun Declination Angle
            const sunLng = 180 - (now.getUTCHours() + now.getUTCMinutes() / 60 + now.getUTCSeconds() / 3600) * 15; // Sun Longitude

            const rad = 400;
            const phi = (90 - sunLat) * Math.PI / 180;
            const theta = (sunLng + 180) * Math.PI / 180;
            sunLight.position.x = -rad * Math.sin(phi) * Math.sin(theta);
            sunLight.position.y = rad * Math.cos(phi);
            sunLight.position.z = rad * Math.sin(phi) * Math.cos(theta);
            scene.add(sunLight);

            // 4. Add concentric atmospheric rotating 3D cloud layer
            const globeRadius = this.globe.getGlobeRadius();
            const cloudsGeom = new THREE.SphereGeometry(globeRadius * 1.008, 75, 75);
            
            const textureLoader2 = new THREE.TextureLoader();
            textureLoader2.load('//unpkg.com/three-globe/example/img/earth-clouds.png', (cloudsTexture) => {
                const cloudsMat = new THREE.MeshPhongMaterial({
                    map: cloudsTexture,
                    transparent: true,
                    opacity: 0.32,
                    blending: THREE.NormalBlending
                });
                
                const cloudsMesh = new THREE.Mesh(cloudsGeom, cloudsMat);
                cloudsMesh.name = "clouds";
                cloudsMesh.raycast = () => {}; // Disable raycast to prevent clouds from blocking click events
                scene.add(cloudsMesh);
                this.cloudsMesh = cloudsMesh;
            });
        }, 120);
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
        
        const rings = [];
        
        // 1. Active Hub radar sweep
        const hub = this.airports.find(a => a.code === this.activeHubCode);
        if (hub) {
            rings.push({
                lat: hub.lat,
                lon: hub.lon,
                color: 'rgba(0, 240, 255, 0.35)',
                maxRadius: 4.5,
                speed: 2.5,
                repeatPeriod: 1200
            });
        }
        
        // 2. Target weather warning sweep
        if (this.weatherEffect) {
            rings.push(this.weatherEffect);
        }
        
        this.globe.ringsData(rings);
    }

    /**
     * Continuous frame-by-frame rendering loop to animate ALL active airplanes in real-time.
     */
    _startAnimationLoop() {
        const animate = () => {
            // Rotate the 3D clouds slowly in the opposite direction
            if (this.cloudsMesh) {
                this.cloudsMesh.rotation.y += 0.00015;
            }

            // Animate moving water waves
            if (this.waterTexture) {
                this.waterTexture.offset.x += 0.00025;
                this.waterTexture.offset.y += 0.00015;
            }

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
                        color: isSelected ? this.colors.magenta : this.colors.cyan,
                        aircraft: f.aircraft || "B737" // Pass aircraft type to feed customThreeObject builder
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

    /**
     * Generates a procedural water wave normal map on a canvas
     */
    _generateWaterNormalMap() {
        const size = 256;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        const imgData = ctx.createImageData(size, size);
        
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // Overlay multiple high-frequency sine/cosine waves for a shimmering liquid texture
                const nx = Math.sin(x / 4.0) * 0.3 + Math.sin((x + y) / 8.0) * 0.25 + Math.cos((x - y) / 6.0) * 0.15;
                const ny = Math.cos(y / 4.0) * 0.3 + Math.cos((x - y) / 8.0) * 0.25 + Math.sin((x + y) / 6.0) * 0.15;
                
                // pack into rgb normal vector space
                const r = Math.floor((nx + 1) * 127.5);
                const g = Math.floor((ny + 1) * 127.5);
                const b = 255;
                
                const idx = (y * size + x) * 4;
                imgData.data[idx] = r;
                imgData.data[idx+1] = g;
                imgData.data[idx+2] = b;
                imgData.data[idx+3] = 255;
            }
        }
        ctx.putImageData(imgData, 0, 0);
        return canvas;
    }

    /**
     * Configures the destination airport's weather warning sweep rings
     */
    setWeatherEffect(lat, lon, weatherCode) {
        if (weatherCode === undefined || weatherCode === null) {
            this.weatherEffect = null;
            this._updateRings();
            return;
        }

        let color = 'rgba(0, 240, 255, 0.45)';
        let maxRadius = 3.0;
        let speed = 2.0;
        let repeatPeriod = 1000;

        if (weatherCode >= 95) { // Thunderstorm
            color = 'rgba(255, 0, 90, 0.75)'; // Flashing warning magenta/red
            maxRadius = 3.6;
            speed = 4.5;
            repeatPeriod = 600;
        } else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) { // Rain / Drizzle / Showers
            color = 'rgba(0, 150, 255, 0.65)'; // Stormy rain blue
            maxRadius = 2.8;
            speed = 2.0;
            repeatPeriod = 1000;
        } else if ((weatherCode >= 71 && weatherCode <= 77) || (weatherCode >= 85 && weatherCode <= 86)) { // Snow / Ice
            color = 'rgba(225, 240, 255, 0.7)'; // Frozen white-blue
            maxRadius = 2.5;
            speed = 1.0; // Slow drift
            repeatPeriod = 1600;
        } else if (weatherCode === 45 || weatherCode === 48) { // Fog
            color = 'rgba(160, 170, 195, 0.55)'; // Fog gray
            maxRadius = 2.2;
            speed = 0.8;
            repeatPeriod = 2200;
        } else { // Clear / Partly Cloudy
            color = 'rgba(57, 255, 20, 0.45)'; // Calm neon green
            maxRadius = 2.4;
            speed = 1.6;
            repeatPeriod = 1200;
        }

        this.weatherEffect = {
            lat,
            lon,
            color,
            maxRadius,
            speed,
            repeatPeriod
        };

        this._updateRings();
    }
}
