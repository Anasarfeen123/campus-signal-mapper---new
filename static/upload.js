// static/upload.js
const VIT_POLYGON = [
    [12.8455, 80.1532], [12.8447, 80.1587], [12.8435, 80.1589],
    [12.8395, 80.1560], [12.8387, 80.1545], [12.8419, 80.1515],
    [12.8425, 80.1510], [12.8456, 80.1518]
];

document.addEventListener('DOMContentLoaded', () => {
    const OFFLINE_QUEUE_KEY = "vit_signal_offline_queue";

    const contributeBtn = document.getElementById('contribute-btn');
    const contributionStatus = document.getElementById('contribution-status');
    const successIndicator = document.getElementById('success-indicator');
    const carrierSelect = document.getElementById('carrier-select');
    const customCarrierInput = document.getElementById('custom-carrier');
    const carrierStatus = document.getElementById('carrier-status');
    const detectBtn = document.getElementById('detect-carrier-btn');
    const offlineIndicator = document.getElementById('offline-indicator');
    
    // NEW: Get references to new inputs
    const networkSelect = document.getElementById('network-select');
    const signalInput = document.getElementById('signal-input');

signalInput.addEventListener('input', (e) => {
    let val = parseInt(e.target.value);
    if (!isNaN(val) && val > 0) {
        // If user enters a positive number like 95, flip it to -95
        e.target.value = -Math.abs(val);
    }
});

    // ---------- OFFLINE QUEUE ----------
    function getQueue() {
        return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || "[]");
    }

    function saveQueue(queue) {
        localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue));
    }

    function enqueue(sample) {
        const q = getQueue();
        q.push(sample);
        saveQueue(q);
    }

    async function flushQueue() {
        if (!navigator.onLine) return;
        const queue = getQueue();
        if (queue.length === 0) return;
        
        contributionStatus.textContent = `Syncing ${queue.length} offline submission(s)...`;
        const remaining = [];
        let syncedCount = 0;
        
        for (const sample of queue) {
            try {
                const res = await fetch('/api/submit', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(sample)
                });
                if (!res.ok) throw new Error();
                syncedCount++;
            } catch {
                remaining.push(sample);
            }
        }
        
        saveQueue(remaining);
        
        if (syncedCount > 0) {
            contributionStatus.textContent = `✅ Synced ${syncedCount} offline submission(s)!`;
            setTimeout(() => contributionStatus.textContent = "", 4000);
        }
    }

    // window.addEventListener('online', async () => {
    //     offlineIndicator.style.display = 'none';
    //     await flushQueue();
    // });

    // window.addEventListener('offline', () => {
    //     offlineIndicator.style.display = 'block';
    // });

    // // Check offline status on load
    // if (!navigator.onLine) {
    //     offlineIndicator.style.display = 'block';
    // }

    // ---------- HELPER: POINT IN POLYGON ----------
    function isPointInPolygon(lat, lng, poly) {
        let x = lat, y = lng;
        let inside = false;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
            let xi = poly[i][0], yi = poly[i][1];
            let xj = poly[j][0], yj = poly[j][1];
            let intersect = ((yi > y) != (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
            if (intersect) inside = !inside;
        }
        return inside;
    }
    
    // ---------- HELPER: SPEED TEST ----------
    async function performSpeedTest() {
        const start = performance.now();
        try {
            // Fetch 512KB payload (must be implemented in app.py)
            const res = await fetch(`/api/speed-test-payload?t=${start}`);
            if (!res.ok) throw new Error("Speed test failed");
            
            const blob = await res.blob(); 
            const end = performance.now();
            
            const durationInSeconds = (end - start) / 1000;
            const bits = blob.size * 8;
            const speedBps = bits / durationInSeconds;
            const speedMbps = speedBps / (1024 * 1024);
            
            return parseFloat(speedMbps.toFixed(2));
        } catch (e) {
            console.warn("Speed test error:", e);
            return null;
        }
    }

    // ---------- UI ----------
    carrierSelect.addEventListener('change', () => {
        // Toggle custom input visibility
        customCarrierInput.style.display =
            carrierSelect.value === 'Other' ? 'block' : 'none';
    });

    detectBtn?.addEventListener('click', async () => {
        detectBtn.disabled = true;
        carrierStatus.textContent = "🔍 Detecting carrier...";
        carrierStatus.style.color = "#94a3b8";

        try {
            const res = await fetch('/api/get-carrier');
            const data = await res.json();

            if (data.carrier && data.carrier !== "Unknown (Local IP)") {
                const exists = [...carrierSelect.options]
                    .some(o => o.value === data.carrier);

                carrierSelect.value = exists ? data.carrier : 'Other';
                if (!exists) {
                    customCarrierInput.style.display = 'block';
                    customCarrierInput.value = data.carrier;
                }

                carrierStatus.textContent = `✓ Detected: ${data.carrier}`;
                carrierStatus.style.color = "#10b981";
            } else {
                carrierStatus.textContent = "⚠ Could not detect carrier";
                carrierStatus.style.color = "#fbbf24";
            }
        } catch {
            carrierStatus.textContent = "❌ Detection error";
            carrierStatus.style.color = "#ef4444";
        } finally {
            detectBtn.disabled = false;
            setTimeout(() => {
                carrierStatus.textContent = "";
            }, 4000);
        }
    });

    // ---------- SUBMIT ----------
    contributeBtn.addEventListener('click', () => {
        // Hide success indicator from previous submission
        successIndicator.style.display = 'none';
        
        if (navigator.connection?.effectiveType === 'wifi') {
            contributionStatus.textContent = "⚠ Please disconnect Wi-Fi to submit mobile data";
            contributionStatus.style.color = "#fbbf24";
            setTimeout(() => {
                contributionStatus.textContent = "";
            }, 4000);
            return;
        }

        let carrier = carrierSelect.value;
        if (!carrier) {
            contributionStatus.textContent = "⚠ Please select a carrier";
            contributionStatus.style.color = "#fbbf24";
            setTimeout(() => {
                contributionStatus.textContent = "";
            }, 3000);
            return;
        }

        if (carrier === 'Other') {
            carrier = customCarrierInput.value.trim();
            if (!carrier) {
                contributionStatus.textContent = "⚠ Please enter carrier name";
                contributionStatus.style.color = "#fbbf24";
                setTimeout(() => {
                    contributionStatus.textContent = "";
                }, 3000);
                return;
            }
        }

        contributionStatus.textContent = "📍 Getting your location...";
        contributionStatus.style.color = "#94a3b8";
        contributeBtn.disabled = true;

        navigator.geolocation.getCurrentPosition(
            pos => handleLocation(pos, carrier),
            err => {
                contributionStatus.textContent = `❌ ${err.message}`;
                contributionStatus.style.color = "#ef4444";
                contributeBtn.disabled = false;
                setTimeout(() => {
                    contributionStatus.textContent = "";
                }, 4000);
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    });

    async function handleLocation(position, carrier) {
        const { latitude: lat, longitude: lon } = position.coords;

        if (!isPointInPolygon(lat, lon, VIT_POLYGON)) {
            contributionStatus.textContent = "🚫 You are outside the campus boundary";
            contributionStatus.style.color = "#ef4444";
            contributeBtn.disabled = false;
            setTimeout(() => {
                contributionStatus.textContent = "";
            }, 4000);
            return;
        }

        // 1. DETERMINE NETWORK TYPE
        // Priority: Manual Input > Auto Detect > Unknown
        let networkType = networkSelect.value;
        
        if (!networkType && navigator.connection) {
            const et = navigator.connection.effectiveType;
            if (et === '4g') networkType = '4G';
            else if (et === '3g') networkType = '3G';
            else if (et === '2g' || et === 'slow-2g') networkType = '2G';
        }
        if (!networkType) networkType = "Unknown";

        // 2. GET SIGNAL STRENGTH
        let signalStrength = signalInput.value ? parseInt(signalInput.value) : null;

        // 3. PERFORM SPEED TEST
        let downloadSpeed = null;
        if (true) { 
            contributionStatus.textContent = "⚡ Running speed test (~1s)...";
            downloadSpeed = await performSpeedTest();
        }
        
        // Fallback to Network API estimate if speed test failed
        if (!downloadSpeed && navigator.connection && !isNaN(navigator.connection.downlink)) {
            downloadSpeed = navigator.connection.downlink;
        }

        const payload = {
            lat,
            lng: lon,
            carrier,
            network_type: networkType,
            signal_strength: signalStrength,
            download_speed: downloadSpeed
        };

        // ---------- OFFLINE-FIRST SUBMIT ----------
        // if (!navigator.onLine) {
        //     enqueue(payload);
        //     contributionStatus.textContent = "📴 Offline. Data saved locally and will sync later.";
        //     contributionStatus.style.color = "#fbbf24";
        //     contributeBtn.disabled = false;
        //     return;
        // }

        try {
            contributionStatus.textContent = "☁️ Submitting data...";
            contributionStatus.style.color = "#0ea5e9";
            
            const res = await fetch('/api/submit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await res.json();

            if (!res.ok) {
                if (result.error === "OUT_OF_CAMPUS") {
                    contributionStatus.textContent = "🚫 Data point outside campus bounds";
                    contributionStatus.style.color = "#ef4444";
                    return;
                }
                throw new Error(result.message || "Submit failed");
            }

            // SUCCESS!
            let msg = "✅ Data submitted successfully!";
            if (downloadSpeed) msg += ` (${downloadSpeed} Mbps measured)`;
            
            contributionStatus.textContent = msg;
            contributionStatus.style.color = "#10b981";
            
            // Show success indicator
            successIndicator.style.display = 'block';
            
            // Reset form
            setTimeout(() => {
                contributionStatus.textContent = "";
                successIndicator.style.display = 'none';
            }, 5000);
            
        } catch (err) {
            console.error("Submission error:", err);
            enqueue(payload);
            contributionStatus.textContent = "📴 Connection lost. Data saved locally for later sync.";
            contributionStatus.style.color = "#fbbf24";
        } finally {
            contributeBtn.disabled = false;
        }
    }

    // ---------- INITIAL SYNC ----------
    flushQueue();
    
});