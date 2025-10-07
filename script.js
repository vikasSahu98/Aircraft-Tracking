document.addEventListener('DOMContentLoaded', function () {

    // 1. Initialize map
    const map = L.map('map', {
        zoomControl: false
    }).setView([23.5937, 78.9629], 5);

    // 2. Prepare Base Layers
    const baseLayers = {};
    for (const layerName in baseMapLayers) {
        const layerInfo = baseMapLayers[layerName];
        baseLayers[layerName] = L.tileLayer(layerInfo.url, layerInfo.options);
    }
    baseLayers["OpenStreetMap"].addTo(map);

    // 4. Setup Controls
    L.control.zoom({ position: 'topright' }).addTo(map);
    L.control.scale({ position: 'bottomleft' }).addTo(map);

    // Layer setup
    const aircraftLayer = L.layerGroup();
    const overlayLayers = { "Aircraft Tracking": aircraftLayer };
    aircraftLayer.addTo(map);
    L.control.layers(baseLayers, overlayLayers, { position: 'topright' }).addTo(map);

    // Animation controls
    const playPauseBtn = document.getElementById('play-pause-btn');
    const timestampValueEl = document.getElementById('timestamp-value');
    const timelineSlider = document.getElementById('timeline-slider');
    const infoCard = document.getElementById('info-card');
    const altUnitSelect = document.getElementById('alt-unit-select');
    const velUnitSelect = document.getElementById('vel-unit-select');
    const vertRateUnitSelect = document.getElementById('vert-rate-unit-select');

    // History card
    const historyBtn = document.getElementById('history-card-btn');
    const historyCard = document.getElementById('history-card');
    const historyTableBody = document.querySelector('#history-table tbody');

    let animationFrameId = null;
    const animationDuration = 60000; // 60 seconds full route
    let animationStartTime = 0;
    let pausedTime = 0;
    let selectedAircraftInstance = null;
    const aircraftInstances = [];

    // --- Default Units ---
    let altitudeUnit = 'ft';   // Default altitude unit
    let velocityUnit = 'knots'; // Default velocity unit
    let verticalRateUnit = 'ft/min'; // Default vertical rate unit

    // Simulation setup
    const simulationStartTime = new Date();
    simulationStartTime.setUTCHours(4, 0, 0, 0); // Start time in UTC (example 04:00 UTC)
    const simulationDurationMinutes = 30;

    // --- Aircraft Setup ---
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

        aircraftLayer.addLayer(routeHistory);
        aircraftLayer.addLayer(marker);

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
            lastPassedWaypointIndex: -1,
            lastLoggedMinute: null
        };

        marker.on('click', () => onAircraftClick(instance));
        aircraftInstances.push(instance);
    });

    function calculateBearing(lat1, lon1, lat2, lon2) {
        const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
        const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);
        return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    }

    function updateVisuals(progress) {
        const positionSourceMap = { 0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM' };

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

                    const bearing = calculateBearing(
                        L.latLng(segmentStart).lat * Math.PI / 180, L.latLng(segmentStart).lng * Math.PI / 180,
                        L.latLng(segmentEnd).lat * Math.PI / 180, L.latLng(segmentEnd).lng * Math.PI / 180
                    );
                    const iconElement = document.getElementById(`aircraft-icon-${instance.index}`);
                    if (iconElement) iconElement.style.transform = `rotate(${bearing}deg)`;

                    // --- Dynamic Altitude and Vertical Rate Calculation ---
                    const realisticVerticalRate = 15; // m/s (approx. 3000 ft/min)
                    const altitudeDifference = instance.data.cruiseAltitude - instance.data.startAltitude;
                    
                    // Calculate how long it takes to climb and descend at a realistic rate
                    const climbDurationSeconds = altitudeDifference / realisticVerticalRate;
                    const descentDurationSeconds = climbDurationSeconds; // Assume descent takes the same time

                    // Calculate what percentage of the total animation time is spent on climb/descent
                    const climbPhaseEnd = (climbDurationSeconds * 1000) / animationDuration;
                    const descentPhaseStart = 1.0 - ((descentDurationSeconds * 1000) / animationDuration);

                    let currentAltitude = instance.data.cruiseAltitude;
                    let currentVerticalRate = 0; // m/s

                    if (progress < climbPhaseEnd && progress > 0) {
                        // Climbing Phase
                        const climbProgress = progress / climbPhaseEnd;
                        currentAltitude = instance.data.startAltitude + (altitudeDifference * climbProgress);
                        currentVerticalRate = realisticVerticalRate;
                    } else if (progress > descentPhaseStart) {
                        // Descending Phase
                        const descentProgress = (progress - descentPhaseStart) / (1 - descentPhaseStart);
                        currentAltitude = instance.data.cruiseAltitude - (altitudeDifference * descentProgress);
                        currentVerticalRate = -realisticVerticalRate;
                    }

                    // Ensure altitude doesn't go below start altitude at the very end
                    if (progress >= 1) {
                        currentAltitude = instance.data.startAltitude;
                        currentVerticalRate = 0;
                    }
                    // --- End of Dynamic Calculations ---

                    // --- Per-Minute Logging ---
                    const elapsedTimeMs = progress * simulationDurationMinutes * 60 * 1000;
                    const currentTime = new Date(simulationStartTime.getTime() + elapsedTimeMs);
                    const currentMinute = currentTime.getUTCMinutes();

                    if (selectedAircraftInstance && selectedAircraftInstance.index === instance.index) {
                        if (instance.lastLoggedMinute !== currentMinute) {
                            instance.lastLoggedMinute = currentMinute;

                            const hours = currentTime.getUTCHours();
                            const minutes = currentTime.getUTCMinutes();
                            const formattedTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC`;

                            const locationString = `${lat.toFixed(2)}, ${lng.toFixed(2)}`;
                            const posSourceString = positionSourceMap[instance.data.positionSource] || 'Unknown';

                            // Unit conversion
                            let alt = currentAltitude;

                            let vel = instance.data.velocity;
                            if (velocityUnit === 'km/h') vel *= 3.6;
                            else if (velocityUnit === 'knots') vel *= 1.94384;

                            const newRow = historyTableBody.insertRow(0);
                            newRow.innerHTML = `
                                <td>${formattedTime}</td>
                                <td>${locationString}</td>
                                <td>${Math.round(alt)}</td>
                                <td>${Math.round(vel)}</td>
                                <td>${posSourceString}</td>
                            `;
                        }
                    }

                    // --- Info Card Update ---
                    if (selectedAircraftInstance && selectedAircraftInstance.index === instance.index) {
                        document.getElementById('info-lat').textContent = lat.toFixed(2);
                        document.getElementById('info-lon').textContent = lng.toFixed(2);
                        document.getElementById('info-track').textContent = `${Math.round(bearing)}°`;

                        let alt = currentAltitude;
                        if (altitudeUnit === 'ft') alt *= 3.28084;
                        document.getElementById('info-alt').textContent = Math.round(alt);

                        let vel = instance.data.velocity;
                        if (velocityUnit === 'km/h') vel *= 3.6;
                        else if (velocityUnit === 'knots') vel *= 1.94384;
                        document.getElementById('info-vel').textContent = Math.round(vel);

                        let vertRate = currentVerticalRate;
                        if (verticalRateUnit === 'ft/min') vertRate *= 196.85; // 1 m/s = 196.85 ft/min
                        document.getElementById('info-vert-rate').textContent = Math.round(vertRate);

                        const utcHours = currentTime.getUTCHours();
                        const utcMinutes = currentTime.getUTCMinutes();
                        const utcFormatted = `${String(utcHours).padStart(2, '0')}:${String(utcMinutes).padStart(2, '0')} UTC`;
                        document.getElementById('info-last-update').textContent = utcFormatted;
                    }
                    break;
                }
                cumulativeDistance += segmentDistance;
            }
        });

        // Update UTC clock
        const elapsedTimeMs = progress * simulationDurationMinutes * 60 * 1000;
        const currentTime = new Date(simulationStartTime.getTime() + elapsedTimeMs);
        const hours = currentTime.getUTCHours();
        const minutes = currentTime.getUTCMinutes();
        timestampValueEl.textContent = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')} UTC`;
        timelineSlider.value = progress * 1000;
    }

    function animate() {
        const elapsedTime = (Date.now() - animationStartTime);
        const progress = Math.min(elapsedTime / animationDuration, 1);
        updateVisuals(progress);

        if (progress < 1) {
            animationFrameId = requestAnimationFrame(animate);
        } else {
            playPauseBtn.textContent = '▶ Play';
            playPauseBtn.disabled = false;
            pausedTime = 0;
        }
    }

    playPauseBtn.addEventListener('click', () => {
        if (animationFrameId) {
            cancelAnimationFrame(animationFrameId);
            animationFrameId = null;
            pausedTime = Date.now() - animationStartTime;
            playPauseBtn.textContent = '▶ Play';
        } else {
            animationStartTime = Date.now() - pausedTime;
            if (pausedTime === 0 && selectedAircraftInstance) {
                historyTableBody.innerHTML = '';
                selectedAircraftInstance.lastLoggedMinute = null;
            }
            animate();
            playPauseBtn.textContent = '⏸ Pause';
        }
    });

    timelineSlider.addEventListener('input', (e) => {
        if (animationFrameId) playPauseBtn.click();
        const progress = e.target.value / 1000;
        pausedTime = progress * animationDuration;
        updateVisuals(progress);
    });

    function onAircraftClick(instance) {
        selectedAircraftInstance = instance;
        const data = instance.data;

        document.getElementById('info-callsign').textContent = data.callsign;
        document.getElementById('info-icao24').textContent = data.icao24;
        document.getElementById('info-callsign-data').textContent = data.callsign;
        document.getElementById('info-country').textContent = data.originCountry;
        document.getElementById('info-category').textContent = data.category;
        document.getElementById('info-on-ground').textContent = data.onGround ? 'Yes' : 'No';
        const positionSourceMap = { 0: 'ADS-B', 1: 'ASTERIX', 2: 'MLAT', 3: 'FLARM' };
        document.getElementById('info-pos-source').textContent = positionSourceMap[data.positionSource] || 'Unknown';

        historyTableBody.innerHTML = '';
        historyCard.style.display = 'none';
        infoCard.style.display = 'block';
        updateVisuals(timelineSlider.value / 1000);
    }

    document.getElementById('close-card-btn').addEventListener('click', () => {
        infoCard.style.display = 'none';
        historyCard.style.display = 'none';
        selectedAircraftInstance = null;
    });

    // --- Unit Selectors ---
    altUnitSelect.value = 'ft';
    velUnitSelect.value = 'knots';
    vertRateUnitSelect.value = 'ft/min';

    altUnitSelect.addEventListener('change', (e) => {
        altitudeUnit = e.target.value;
        updateVisuals(timelineSlider.value / 1000);
    });

    velUnitSelect.addEventListener('change', (e) => {
        velocityUnit = e.target.value;
        updateVisuals(timelineSlider.value / 1000);
    });

    vertRateUnitSelect.addEventListener('change', (e) => {
        verticalRateUnit = e.target.value;
        updateVisuals(timelineSlider.value / 1000);
    });

    historyBtn.addEventListener('click', () => {
        if (selectedAircraftInstance) {
            historyCard.style.display = historyCard.style.display === 'none' ? 'block' : 'none';
        }
    });

    document.getElementById('close-history-card-btn').addEventListener('click', () => {
        historyCard.style.display = 'none';
    });
});
