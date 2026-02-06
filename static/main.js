// ================== CONFIG ==================
const API_BASE = "https://vitc-signal-mapper.onrender.com";

// ================== CAMPUS POLYGON ==================
const VIT_POLYGON_COORDS = [
    [12.8455, 80.1532],
    [12.8447, 80.1587],
    [12.8435, 80.1589],
    [12.8395, 80.1560],
    [12.8387, 80.1545],
    [12.8419, 80.1515],
    [12.8425, 80.1510],
    [12.8456, 80.1518]
];

const VIT_POLYGON = L.polygon(VIT_POLYGON_COORDS, {
    color: "#0ea5e9",
    weight: 2,
    fillOpacity: 0.08,
    dashArray: "6 4",
    interactive: false
});

const VIT_BOUNDS = VIT_POLYGON.getBounds();

// ================== MAP ==================
const map = L.map("map", {
    maxBounds: VIT_BOUNDS,
    maxBoundsViscosity: 0.8,
    minZoom: 15,
    maxZoom: 19,
    zoomControl: false  // We'll add custom position
}).setView([12.8406, 80.1534], 17);

// Add zoom control to bottom right
L.control.zoom({
    position: 'bottomright'
}).addTo(map);

VIT_POLYGON.addTo(map);

L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '© OpenStreetMap'
}).addTo(map);

// ================== HEATMAP ==================
const heatLayer = L.heatLayer([], {
    radius: 18,
    blur: 12,
    maxZoom: 17,
    gradient: {
        0.0: 'blue',
        0.25: 'cyan',
        0.5: 'lime',
        0.75: 'yellow',
        1.0: 'red'
    }
}).addTo(map);

// ================== DOM ==================
const controlPanel = document.getElementById("control-panel");
const panelToggle = document.getElementById("panel-toggle");
const panelContent = document.getElementById("panel-content");
const carrierSelect = document.getElementById("carrier-select");
const networkSelect = document.getElementById("network");
const heatmapDataSelect = document.getElementById("heatmap-data");
const statusLight = document.getElementById("status-light");
const statusText = document.getElementById("status-text");
const locateBtn = document.getElementById("locate-btn");
const resetFiltersBtn = document.getElementById("reset-filters");
const offlineIndicator = document.getElementById("offline-indicator");
const toast = document.getElementById("toast");
const pointCountSpan = document.getElementById("point-count");
const avgSignalSpan = document.getElementById("avg-signal");
const avgSpeedSpan = document.getElementById("avg-speed");
const legendTitle = document.getElementById("legend-title");
const legendLow = document.getElementById("legend-low");
const legendHigh = document.getElementById("legend-high");

// ================== GLOBAL STATE ==================
let allDataPoints = [];
let currentFilteredData = [];

// ================== COLLAPSIBLE PANEL ==================
panelToggle.addEventListener('click', () => {
    controlPanel.classList.toggle('collapsed');
    
    // Save state to localStorage
    const isCollapsed = controlPanel.classList.contains('collapsed');
    localStorage.setItem('panelCollapsed', isCollapsed);
});

// Restore collapsed state on load
document.addEventListener('DOMContentLoaded', () => {
    const wasCollapsed = localStorage.getItem('panelCollapsed') === 'true';
    if (wasCollapsed) {
        controlPanel.classList.add('collapsed');
    }
});

// ================== UI HELPERS ==================
function setStatus(state, text) {
    statusLight.className = "";
    statusLight.classList.add(state);
    statusText.textContent = text;
}

function showToast(msg, type = "info") {
    toast.textContent = msg;
    toast.className = `toast show ${type}`;
    setTimeout(() => toast.classList.remove("show"), 3000);
}

// ================== STATS CALCULATION ==================
function updateStats(data) {
    // Update point count
    pointCountSpan.textContent = data.length.toLocaleString();
    
    if (data.length === 0) {
        avgSignalSpan.textContent = "--";
        avgSpeedSpan.textContent = "--";
        return;
    }
    
    // Calculate average signal strength
    const validSignals = data.filter(d => d.signal_strength != null);
    if (validSignals.length > 0) {
        const avgSignal = validSignals.reduce((sum, d) => sum + d.signal_strength, 0) / validSignals.length;
        avgSignalSpan.textContent = Math.round(avgSignal) + " dBm";
    } else {
        avgSignalSpan.textContent = "--";
    }
    
    // Calculate average speed
    const validSpeeds = data.filter(d => d.download_speed != null && d.download_speed > 0);
    if (validSpeeds.length > 0) {
        const avgSpeed = validSpeeds.reduce((sum, d) => sum + d.download_speed, 0) / validSpeeds.length;
        avgSpeedSpan.textContent = avgSpeed.toFixed(1) + " Mbps";
    } else {
        avgSpeedSpan.textContent = "--";
    }
}

// ================== LEGEND UPDATE ==================
function updateLegend() {
    const dataType = heatmapDataSelect.value;
    
    if (dataType === "dbm") {
        legendTitle.textContent = "Signal Strength";
        legendLow.textContent = "-120 dBm";
        legendHigh.textContent = "-50 dBm";
    } else {
        legendTitle.textContent = "Download Speed";
        legendLow.textContent = "0 Mbps";
        legendHigh.textContent = "100+ Mbps";
    }
}

// ================== DATA ==================
async function fetchSamples() {
    const qs = new URLSearchParams();
    if (carrierSelect.value) qs.set("carrier", carrierSelect.value);
    if (networkSelect.value) qs.set("network_type", networkSelect.value);

    try {
        setStatus("loading", "LOADING");
        const res = await fetch(`${API_BASE}/api/samples?${qs}`);
        const data = await res.json();
        
        // Store all data points
        allDataPoints = data;
        currentFilteredData = data;

        const points = data
            .filter(s => s.lat && s.lng)
            .map(s => {
                const weight =
                    heatmapDataSelect.value === "dbm"
                        ? (Math.max(-120, Math.min(-50, s.signal_strength || -120)) + 120) / 70
                        : Math.min(100, s.download_speed || 0) / 100;

                return [s.lat, s.lng, weight];
            });

        heatLayer.setLatLngs(points);
        updateStats(data);
        updateLegend();
        setStatus("live", "LIVE");
    } catch (err) {
        console.error("Fetch error:", err);
        setStatus("disconnected", "OFFLINE");
    }
}

// ================== EVENT LISTENERS ==================
carrierSelect.addEventListener("change", fetchSamples);
networkSelect.addEventListener("change", fetchSamples);
heatmapDataSelect.addEventListener("change", () => {
    fetchSamples();
    updateLegend();
});

// Reset filters
resetFiltersBtn.addEventListener("click", () => {
    carrierSelect.value = "";
    networkSelect.value = "";
    heatmapDataSelect.value = "dbm";
    fetchSamples();
    showToast("Filters reset", "info");
});

// ================== SOCKET.IO ==================
const socket = io(API_BASE, { transports: ["websocket", "polling"] });

socket.on("connect", () => {
    setStatus("live", "LIVE");
    showToast("Connected to live feed", "success");
});

socket.on("disconnect", () => {
    setStatus("disconnected", "OFFLINE");
});

socket.on("new_data_point", s => {
    if (!s?.lat || !s?.lng) return;
    
    // Add to global data
    allDataPoints.push(s);
    
    // Check if it matches current filters
    const matchesCarrier = !carrierSelect.value || s.carrier === carrierSelect.value;
    const matchesNetwork = !networkSelect.value || s.network_type === networkSelect.value;
    
    if (matchesCarrier && matchesNetwork) {
        const weight =
            heatmapDataSelect.value === "dbm"
                ? (Math.max(-120, Math.min(-50, s.signal_strength || -120)) + 120) / 70
                : Math.min(100, s.download_speed || 0) / 100;
        
        heatLayer.addLatLng([s.lat, s.lng, weight]);
        currentFilteredData.push(s);
        updateStats(currentFilteredData);
        
        // Show subtle toast for new data
        showToast("New data point added", "info");
    }
});

// ================== LOCATION (LOCKED ONCE) ==================
let userMarker = null;
let accuracyCircle = null;
let isLocationLocked = false;

locateBtn.addEventListener("click", () => {
    if (!navigator.geolocation) {
        showToast("Geolocation not supported", "error");
        return;
    }

    // Reset lock if user clicks again
    if (isLocationLocked) {
        if (userMarker) map.removeLayer(userMarker);
        if (accuracyCircle) map.removeLayer(accuracyCircle);
        userMarker = null;
        accuracyCircle = null;
        isLocationLocked = false;
        locateBtn.textContent = "📍 Show My Location";
        showToast("Location cleared", "info");
        return;
    }

    locateBtn.disabled = true;
    locateBtn.textContent = "⌛ Locating…";

    navigator.geolocation.getCurrentPosition(
        pos => {
            if (isLocationLocked) return;

            const { latitude, longitude, accuracy } = pos.coords;
            const latlng = L.latLng(latitude, longitude);

            console.log("LOCKED LOCATION:", latitude, longitude, "±", accuracy);

            // Lock immediately
            isLocationLocked = true;

            if (userMarker) map.removeLayer(userMarker);
            if (accuracyCircle) map.removeLayer(accuracyCircle);

            // Custom icon for user location
            const userIcon = L.divIcon({
                className: 'user-location-marker',
                html: `<div style="
                    width: 20px;
                    height: 20px;
                    background: linear-gradient(135deg, #0ea5e9, #f59e0b);
                    border: 3px solid white;
                    border-radius: 50%;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.4);
                "></div>`,
                iconSize: [20, 20]
            });

            userMarker = L.marker(latlng, { icon: userIcon })
                .addTo(map)
                .bindPopup(`<b>Your Location</b><br>Accuracy: ±${Math.round(accuracy)}m`)
                .openPopup();

            accuracyCircle = L.circle(latlng, {
                radius: accuracy,
                color: "#0ea5e9",
                fillColor: "#0ea5e9",
                fillOpacity: 0.15,
                weight: 2,
                dashArray: "4 4"
            }).addTo(map);

            map.setView(latlng, 18);

            setStatus("live", "LIVE");
            showToast("Location locked", "success");

            locateBtn.disabled = false;
            locateBtn.textContent = "✓ Location Locked (tap to clear)";
        },
        err => {
            console.error("GEO ERROR:", err);
            showToast(err.message, "error");
            locateBtn.disabled = false;
            locateBtn.textContent = "📍 Show My Location";
        },
        {
            enableHighAccuracy: true,
            timeout: 20000,
            maximumAge: 0
        }
    );
});

// ================== OFFLINE HANDLING ==================
function updateOfflineUI() {
    const isOffline = !navigator.onLine;
    offlineIndicator.style.display = isOffline ? "block" : "none";
    
    if (isOffline) {
        setStatus("disconnected", "OFFLINE");
    }
}

window.addEventListener("online", () => {
    updateOfflineUI();
    showToast("Back online", "success");
    fetchSamples();
});

window.addEventListener("offline", () => {
    updateOfflineUI();
    showToast("Connection lost", "error");
});

updateOfflineUI();

// ================== INIT ==================
fetchSamples();
updateLegend();

// ================== KEYBOARD SHORTCUTS ==================
document.addEventListener('keydown', (e) => {
    // Toggle panel with 'T' key
    if (e.key === 't' || e.key === 'T') {
        controlPanel.classList.toggle('collapsed');
    }
    
    // Reset filters with 'R' key
    if (e.key === 'r' || e.key === 'R') {
        resetFiltersBtn.click();
    }
    
    // Locate with 'L' key
    if (e.key === 'l' || e.key === 'L') {
        locateBtn.click();
    }
});