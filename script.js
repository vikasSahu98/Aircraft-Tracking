document.addEventListener('DOMContentLoaded', function () {

    // 1. Initialize map
    const map = L.map('map', {
        zoomControl: false // We will add it later in a different position
    }).setView([23.5937, 78.9629], 5); // Centered on India

    // 2. Prepare Base Layers
    const baseLayers = {};
    for (const layerName in baseMapLayers) {
        const layerInfo = baseMapLayers[layerName];
        baseLayers[layerName] = L.tileLayer(layerInfo.url, layerInfo.options);
    }
    baseLayers["OpenStreetMap"].addTo(map); // Set light map as default

    // 4. Setup Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomleft' }).addTo(map);

    // This layer group will hold all individual aircraft layers
    const aircraftLayer = L.layerGroup();
    const overlayLayers = {
        "Aircraft Tracking": aircraftLayer
    };
    aircraftLayer.addTo(map); // Make the aircraft layer visible by default
    L.control.layers(baseLayers, overlayLayers, { position: 'topright' }).addTo(map);

    // 5. Animation Logic
    const playPauseBtn = document.getElementById('play-pause-btn');
    const timestampValueEl = document.getElementById('timestamp-value');
    const timelineSlider = document.getElementById('timeline-slider');
    const infoCard = document.getElementById('info-card');
    const altUnitSelect = document.getElementById('alt-unit-select');
    const velUnitSelect = document.getElementById('vel-unit-select');

    // History card elements
    const historyBtn = document.getElementById('history-card-btn');
    const historyCard = document.getElementById('history-card');
    const historyTableBody = document.querySelector('#history-table tbody');

    let animationFrameId = null;
    const animationDuration = 60000; // 60 seconds for the whole route
    let animationStartTime = 0;
    let pausedTime = 0;
    let selectedAircraftInstance = null;
    const aircraftInstances = [];

    // Pre-calculate route distances for performance
    // Unit conversion state
    let altitudeUnit = 'm';
    let velocityUnit = 'm/s';

    let totalDistance = 0;

    // 3. Prepare All Aircraft and Routes
    aircraftData.forEach((data, index) => {
        const route = data.route;
        const startingPosition = route[0];
        const iconSvg = `<svg viewBox="0 0 24 24" fill="${data.color}" style="transform: scale(1.5);"><path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/></svg>`;

        const aircraftIcon = L.divIcon({
            html: `<div id="aircraft-icon-${index}" style="transform: rotate(0deg); transition: transform 0.2s linear;">${iconSvg}</div>`,
            className: 'leaflet-div-icon',
            iconSize: [24, 24],
            iconAnchor: [12, 12]
        });

        const marker = L.marker(startingPosition, { icon: aircraftIcon });
        const routeHistory = L.polyline(route, { color: data.color, weight: 3, opacity: 0.8 });

        // Add this aircraft's layers to the main group
        aircraftLayer.addLayer(routeHistory);
        aircraftLayer.addLayer(marker);

        // Calculate route distances for this specific aircraft
        let aircraftTotalDistance = 0;
        const segmentDistances = route.slice(1).map((point, i) => {
            const dist = map.distance(route[i], point);
            aircraftTotalDistance += dist;
            return dist;
        });

        const instance = {
            data,
            marker,
            index,
            route,
            totalDistance: aircraftTotalDistance,
            segmentDistances,
            lastPassedWaypointIndex: -1
        };

        marker.on('click', () => onAircraftClick(instance));
        aircraftInstances.push(instance);
    });
    // Function to calculate bearing between two points
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    // A new function to update all visual elements based on progress (0 to 1)
    function updateVisuals(progress) {
        // Update each aircraft
        aircraftInstances.forEach(instance => {
            const traveledDistance = progress * instance.totalDistance;
            let cumulativeDistance = 0;

            for (let i = 0; i < instance.segmentDistances.length; i++) {
                const segmentStart = instance.route[i];
                const segmentEnd = instance.route[i + 1];
                const segmentDistance = instance.segmentDistances[i];

                if (cumulativeDistance + segmentDistance >= traveledDistance) {
                const distanceIntoSegment = traveledDistance - cumulativeDistance;
                const segmentProgress = distanceIntoSegment / segmentDistance;

                const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress;
                const lng = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress;

                    instance.marker.setLatLng([lat, lng]);

                // Update rotation
                const bearing = calculateBearing(
                    L.latLng(segmentStart).lat * Math.PI / 180, L.latLng(segmentStart).lng * Math.PI / 180,
                    L.latLng(segmentEnd).lat * Math.PI / 180, L.latLng(segmentEnd).lng * Math.PI / 180
                );
                    const iconElement = document.getElementById(`aircraft-icon-${instance.index}`);
                if (iconElement) {
                    iconElement.style.transform = `rotate(${bearing}deg)`;
                }

                // Check if a waypoint has been passed
                    if (i > instance.lastPassedWaypointIndex) {
                        instance.lastPassedWaypointIndex = i;
                    const waypointTime = timestampValueEl.textContent;
                        const waypointCoords = instance.route[i];
                    const locationString = `${waypointCoords[0].toFixed(4)}, ${waypointCoords[1].toFixed(4)}`;
                    
                    // Add a row to the history table
                    const newRow = historyTableBody.insertRow(0); // Insert at the top
                    newRow.innerHTML = `
                        <td>${waypointTime}</td>
                        <td>${locationString}</td>
                        <td>${instance.data.altitude}</td>
                        <td>${instance.data.velocity}</td>
                    `;
                }
                    // If this is the selected aircraft, update the info card
                    if (selectedAircraftInstance && selectedAircraftInstance.index === instance.index) {
                    document.getElementById('info-lat').textContent = lat.toFixed(4);
                    document.getElementById('info-lon').textContent = lng.toFixed(4);
                    document.getElementById('info-track').textContent = `${Math.round(bearing)}°`;

                    const positionSourceMap = { 0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM' };

                    // Altitude conversion and display
                        let alt = instance.data.altitude;
                    if (altitudeUnit === 'ft') {
                        alt = alt * 3.28084;
                    }
                    document.getElementById('info-alt').textContent = Math.round(alt);
                        document.getElementById('info-vert-rate').textContent = `${instance.data.verticalRate} m/s`;
                    document.getElementById('info-last-update').textContent = new Date().toLocaleTimeString();

                    // Velocity conversion and display
                        let vel = instance.data.velocity;
                    if (velocityUnit === 'km/h') {
                        vel = vel * 3.6;
                    } else if (velocityUnit === 'knots') {
                        vel = vel * 1.94384;
                    }
                    document.getElementById('info-vel').textContent = Math.round(vel);
                    }
                    break;
                }
                cumulativeDistance += segmentDistance;
            }
        });

        // Update timestamp (simple progress display)
        const totalSeconds = Math.floor(progress * (animationDuration / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        timestampValueEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

        // Update timeline slider position
        timelineSlider.value = progress * 1000;
    }

    function animate() {
        const elapsedTime = (Date.now() - animationStartTime);
        const progress = Math.min(elapsedTime / animationDuration, 1);

        updateVisuals(progress);

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            timestampValueEl.textContent = "Arrived!";
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.disabled = false;
            pausedTime = 0; // Reset for next playback
            // Add final destination to history
            const instance = aircraftInstances.find(inst => inst.lastPassedWaypointIndex < inst.route.length - 1);
            if (instance) {
                updateVisuals(1);
            }
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (animationFrameId) {
            // --- PAUSE ---
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            pausedTime = Date.now() - animationStartTime; // Record how far along we were
            playPauseBtn.textContent = '▶ Play';
        } else {
            // --- PLAY ---
            animationStartTime = Date.now() - pausedTime;
            if (pausedTime === 0) { // If starting from the beginning, clear history
                if (selectedAircraftInstance) {
                    historyTableBody.innerHTML = '';
                }
                aircraftInstances.forEach(inst => inst.lastPassedWaypointIndex = -1);
            }
            animate();
            playPauseBtn.textContent = '⏸ Pause';
        }
    });

    timelineSlider.addEventListener('input', (e) => {
        // When user scrubs, pause the animation
        if (animationFrameId) {
            playPauseBtn.click(); // Programmatically click to pause
        }
        const progress = e.target.value / 1000;
        pausedTime = progress * animationDuration; // Set the pause time to the scrubbed position
        updateVisuals(progress);
    });

    function onAircraftClick(instance) {
        selectedAircraftInstance = instance;
        const data = instance.data;

        // Populate static info card data
        document.getElementById('info-callsign').textContent = data.callsign;
        document.getElementById('info-icao24').textContent = data.icao24;
        document.getElementById('info-callsign-data').textContent = data.callsign;
        document.getElementById('info-country').textContent = data.originCountry;
        document.getElementById('info-category').textContent = data.category;
        document.getElementById('info-on-ground').textContent = data.onGround ? 'Yes' : 'No';
        const positionSourceMap = { 0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM' };
        document.getElementById('info-pos-source').textContent = positionSourceMap[data.positionSource] || 'Unknown';

        // Clear and show cards
        historyTableBody.innerHTML = ''; // Clear history for the new selection
        historyCard.style.display = 'none'; // Hide history card initially
        infoCard.style.display = 'block';

        // Update dynamic data
        updateVisuals(timelineSlider.value / 1000); // Update with current data
    }

    document.getElementById('close-card-btn').addEventListener('click', () => {
        infoCard.style.display = 'none';
        historyCard.style.display = 'none';
        selectedAircraftInstance = null;
    });

    // Unit selection change handlers
    altUnitSelect.addEventListener('change', (e) => {
        altitudeUnit = e.target.value;
        updateVisuals(timelineSlider.value / 1000); // Re-render with new unit
    });

    velUnitSelect.addEventListener('change', (e) => {
        velocityUnit = e.target.value;
        updateVisuals(timelineSlider.value / 1000); // Re-render with new unit
    });

    // --- History Card Logic ---
    historyBtn.addEventListener('click', () => {
        if (selectedAircraftInstance) {
            // Toggle the history card visibility
            historyCard.style.display = historyCard.style.display === 'none' ? 'block' : 'none';
        }
    });

    document.getElementById('close-history-card-btn').addEventListener('click', () => {
        historyCard.style.display = 'none';
    });
});