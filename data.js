const baseMapLayers = {
    "OpenStreetMap": {
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        }
    },
    "Satellite": {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        options: {
            attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
        }
    },
    "Topographic": {
        url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
        options: {
            attribution: 'Map data: &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors, <a href="http://viewfinderpanoramas.org">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)'
        }
    },
    "Dark Mode": {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        options: {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }
    }
};

const aircraftData = [
    {
        flightNumber: "IND-456",
        callsign: "VISTARA",
        icao24: "800C6E",
        originCountry: "India",
        category: "A3", // Medium-sized aircraft
        altitude: 10668, // meters (approx. 35,000 ft)
        velocity: 245, // meters/second (approx. 475 knots)
        onGround: false,
        verticalRate: 0, // m/s
        positionSource: 0, // 0 = ADS-B
        color: '#007bff',
        // A more realistic, curved route from Delhi to Mumbai
        route: [
            [28.5665, 77.1032], // Delhi
            [27.8000, 76.5000], // Waypoint 1
            [26.8241, 75.8122], // Jaipur
            [25.7000, 74.6500], // Waypoint 2
            [24.5854, 73.7125], // Udaipur
            [23.4500, 73.3000], // Waypoint 3
            [22.3094, 73.1812], // Vadodara
            [20.7500, 72.9000], // Waypoint 4
            [19.0896, 72.8656]  // Mumbai
        ]
    },
    {
        flightNumber: "SGP-789",
        callsign: "SPICEJET",
        icao24: "75804F",
        originCountry: "India",
        category: "B738", // Boeing 737-800
        altitude: 11277, // meters (approx. 37,000 ft)
        velocity: 255, // meters/second (approx. 495 knots)
        onGround: false,
        verticalRate: 0, // m/s
        positionSource: 0, // 0 = ADS-B
        color: '#007bff', // Blue
        // A more realistic, curved route from Bengaluru to Delhi
        route: [
            [12.9716, 77.5946], // Bengaluru
            [15.2000, 78.0000], // Waypoint 1
            [17.3850, 78.4867], // Hyderabad
            [19.8000, 77.0000], // Waypoint 2
            [22.5000, 75.8000], // Waypoint 3
            [25.6000, 76.5000], // Waypoint 4
            [28.7041, 77.1025]  // Delhi
        ]
    }
];