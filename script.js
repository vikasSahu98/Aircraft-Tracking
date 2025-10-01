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

    // 3. Prepare Aircraft and Route
    const route = aircraftData.route;
    const startingPosition = route[0];

    // Create a custom icon for the aircraft
    const aircraftIcon = L.divIcon({
        html: `<div id="aircraft-icon" style="font-size: 24px; transform: rotate(0deg); transition: transform 0.1s linear;">${aircraftData.icon}</div>`,
        className: 'leaflet-div-icon',
        iconSize: [24, 24],
        iconAnchor: [12, 12] // Point of the icon which will correspond to marker's location
    });

    // Create the marker, starting at the first point of the route
    const aircraftMarker = L.marker(startingPosition, { icon: aircraftIcon });

    // Create the polyline for the aircraft's route history
    const routeHistory = L.polyline(route, { color: '#007bff', weight: 3, opacity: 0.8 });

    // Group the marker and route into a single layer group
    const aircraftLayer = L.layerGroup([routeHistory, aircraftMarker]);

    // 4. Setup Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomleft' }).addTo(map);

    const overlayLayers = {
        "Aircraft Tracking": aircraftLayer
    };
    aircraftLayer.addTo(map); // Make the aircraft layer visible by default
    L.control.layers(baseLayers, overlayLayers, { position: 'topright' }).addTo(map);

    // 5. Animation Logic
    const playBtn = document.getElementById('play-btn');
    const stopBtn = document.getElementById('stop-btn');
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
    const animationDuration = 30000; // 30 seconds for the whole route
    let animationStartTime = 0;
    let pausedTime = 0;
    let lastPassedWaypointIndex = -1;
    const waypointNames = ['Delhi', 'Jaipur', 'Udaipur', 'Vadodara', 'Mumbai'];

    // Pre-calculate route distances for performance
    // Unit conversion state
    let altitudeUnit = 'm';
    let velocityUnit = 'm/s';

    let totalDistance = 0;
    const segmentDistances = route.slice(1).map((point, i) => {
        const dist = map.distance(route[i], point);
        totalDistance += dist;
        return dist;
    });

    // Function to calculate bearing between two points
    function calculateBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    // A new function to update all visual elements based on progress (0 to 1)
    function updateVisuals(progress) {
        const traveledDistance = progress * totalDistance;

        // Find current segment and position along the route
        let cumulativeDistance = 0;
        for (let i = 0; i < segmentDistances.length; i++) {
            const segmentStart = route[i];
            const segmentEnd = route[i + 1];
            const segmentDistance = segmentDistances[i];

            if (cumulativeDistance + segmentDistance >= traveledDistance) {
                const distanceIntoSegment = traveledDistance - cumulativeDistance;
                const segmentProgress = distanceIntoSegment / segmentDistance;

                const lat = segmentStart[0] + (segmentEnd[0] - segmentStart[0]) * segmentProgress;
                const lng = segmentStart[1] + (segmentEnd[1] - segmentStart[1]) * segmentProgress;

                aircraftMarker.setLatLng([lat, lng]);
                const currentCoords = [lat, lng];

                // Update rotation
                const bearing = calculateBearing(
                    L.latLng(segmentStart).lat * Math.PI / 180, L.latLng(segmentStart).lng * Math.PI / 180,
                    L.latLng(segmentEnd).lat * Math.PI / 180, L.latLng(segmentEnd).lng * Math.PI / 180
                );
                const iconElement = document.getElementById('aircraft-icon');
                if (iconElement) {
                    iconElement.style.transform = `rotate(${bearing}deg)`;
                }

                // Check if a waypoint has been passed
                if (i > lastPassedWaypointIndex) {
                    lastPassedWaypointIndex = i;
                    const waypointTime = timestampValueEl.textContent;
                    const waypointName = waypointNames[i] || `Waypoint ${i}`;
                    
                    // Add a row to the history table
                    const newRow = historyTableBody.insertRow(0); // Insert at the top
                    newRow.innerHTML = `
                        <td>${waypointTime}</td>
                        <td>${waypointName}</td>
                        <td>${aircraftData.altitude}</td>
                        <td>${aircraftData.velocity}</td>
                    `;
                }
                // If info card is visible, update its content
                if (infoCard.style.display !== 'none') {
                    document.getElementById('info-lat').textContent = lat.toFixed(4);
                    document.getElementById('info-lon').textContent = lng.toFixed(4);
                    document.getElementById('info-track').textContent = `${Math.round(bearing)}°`;

                    const positionSourceMap = { 0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM' };

                    // Altitude conversion and display
                    let alt = aircraftData.altitude;
                    if (altitudeUnit === 'ft') {
                        alt = alt * 3.28084;
                    }
                    document.getElementById('info-alt').textContent = Math.round(alt);
                    document.getElementById('info-vert-rate').textContent = `${aircraftData.verticalRate} m/s`;

                    // Set static data (this is okay to set repeatedly)
                    document.getElementById('info-callsign-data').textContent = aircraftData.callsign;
                    document.getElementById('info-category').textContent = aircraftData.category;
                    document.getElementById('info-on-ground').textContent = aircraftData.onGround ? 'Yes' : 'No';
                    document.getElementById('info-pos-source').textContent = positionSourceMap[aircraftData.positionSource] || 'Unknown';
                    document.getElementById('info-last-update').textContent = new Date().toLocaleTimeString();
                    // Velocity conversion and display
                    let vel = aircraftData.velocity;
                    if (velocityUnit === 'km/h') {
                        vel = vel * 3.6;
                    } else if (velocityUnit === 'knots') {
                        vel = vel * 1.94384;
                    }
                    document.getElementById('info-vel').textContent = Math.round(vel);
                }

                document.getElementById('info-callsign').textContent = aircraftData.callsign;
                document.getElementById('info-icao24').textContent = aircraftData.icao24;
                document.getElementById('info-country').textContent = aircraftData.originCountry;

                break;
            }
            cumulativeDistance += segmentDistance;
        }

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
            playBtn.disabled = false;
            stopBtn.disabled = true;
            pausedTime = 0; // Reset for next playback
            // Add final destination to history
            if (lastPassedWaypointIndex < route.length - 1) {
                updateVisuals(1);
            }
        }
    }

    playBtn.addEventListener('click', () => {
        if (animationFrameId) return; // Already playing
        // If paused, resume. Otherwise, start from the beginning.
        animationStartTime = Date.now() - pausedTime;
        if (pausedTime === 0) { // If starting from the beginning, clear history
            historyTableBody.innerHTML = '';
            lastPassedWaypointIndex = -1;
        }
        animate();
        playBtn.disabled = true;
        stopBtn.disabled = false;
    });

    stopBtn.addEventListener('click', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            pausedTime = Date.now() - animationStartTime; // Record how far along we were
            playBtn.disabled = false;
            stopBtn.disabled = true;
        }
    });

    timelineSlider.addEventListener('input', (e) => {
        // When user scrubs, pause the animation
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            playBtn.disabled = false;
            stopBtn.disabled = true;
        }
        const progress = e.target.value / 1000;
        pausedTime = progress * animationDuration; // Set the pause time to the scrubbed position
        updateVisuals(progress);
    });

    // Show/Hide Info Card
    aircraftMarker.on('click', () => {
        infoCard.style.display = 'block';
        updateVisuals(timelineSlider.value / 1000); // Update with current data
    });

    document.getElementById('close-card-btn').addEventListener('click', () => {
        infoCard.style.display = 'none';
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
        // Toggle the history card visibility
        historyCard.style.display = historyCard.style.display === 'none' ? 'block' : 'none';
    });

    document.getElementById('close-history-card-btn').addEventListener('click', () => {
        historyCard.style.display = 'none';
    });
});