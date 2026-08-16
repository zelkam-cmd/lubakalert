window.DriverApp = (function() {
    const MAPBOX_TOKEN = "pk.eyJ1IjoicmVkZC1jbWQi" + "LCJhIjoiY21zcXo3emZkMDh6bTJ5cTRhNHl5enJ2YSJ9.XXweEs0duVa6qtTJfZsrnQ";
    
    // Default coordinates in case nothing is selected (Bulacan center approximate)
    let currentCoords = { lat: 14.8584, lng: 120.8162 };
    
    let map = null;
    let driverMarker = null;
    let routePolyline = null;
    let routePoints = [];
    let currentRouteIndex = 0;
    
    let isNavigating = false;
    let navInterval = null;
    let navSpeed = 0.5;

    let useNlexExpressway = false; 
    let currentVehicleSpeedKmh = 58.0;
    
    let activeAlertedCaseIds = new Set();
    let activeTelemetryPingCaseIds = new Set();
    let hazardCircles = {};
    let activeRouteHazards = [];

    let selectedOriginCoords = null; // [lng, lat]
    let selectedDestCoords = null; // [lng, lat]
    let selectedOriginName = "";
    let selectedDestName = "";

    const EARLY_WARNING_RADIUS = 400; 
    const SLOWDOWN_DETECTION_RADIUS = 250; 

    // Used for geocoding debouncing
    let originTimeout = null;
    let destTimeout = null;

    function initDriverMap() {
        map = L.map('driverMap', { zoomControl: false }).setView([currentCoords.lat, currentCoords.lng], 12);
        
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
        }).addTo(map);

        const customIcon = L.divIcon({
            className: 'driver-marker',
            html: '<div class="pulse-ring"></div><div class="car-icon"><i class="fa-solid fa-car-side"></i></div>',
            iconSize: [40, 40],
            iconAnchor: [20, 20]
        });

        driverMarker = L.marker([currentCoords.lat, currentCoords.lng], { icon: customIcon }).addTo(map);

        refreshCautionZones();
    }

    async function refreshCautionZones() {
        if (!map) return;
        const res = await LubakBackend.getCases();
        if (!res.success) return;

        Object.values(hazardCircles).forEach(c => map.removeLayer(c));
        hazardCircles = {};

        res.cases.forEach(c => {
            if (c.status === 'Resolved') return;

            let color = '#3b82f6';
            if (c.severity_level === 'Moderate') color = '#f97316';
            if (c.severity_level === 'Critical') color = '#ef4444';

            let circle = L.circle([c.center_latitude, c.center_longitude], {
                color: color,
                fillColor: color,
                fillOpacity: 0.25,
                radius: 40, 
                weight: 2
            }).addTo(map);

            circle.bindPopup(`
                <div style="font-family:'Montserrat',sans-serif; color:#0f172a;">
                    <h3 style="margin:0 0 5px 0; font-size:14px; color:${color};">${c.severity_level.toUpperCase()} HAZARD</h3>
                    <div style="font-size:12px;">
                        <b>Case ID:</b> #${c.id}<br>
                        <b>Total Pings:</b> ${c.total_reports}<br>
                        <b>Status:</b> ${c.status}
                    </div>
                </div>
            `);

            hazardCircles[c.id] = circle;
        });
    }

    // MAPBOX API INTEGRATIONS

    async function fetchAutocomplete(query, type) {
        if (!query) {
            document.getElementById(`${type}Suggestions`).style.display = 'none';
            return;
        }

        // Nominatim OpenStreetMap API provides far superior POI coverage for the Philippines
        const viewbox = "120.65,15.20,121.15,14.72"; // left, top, right, bottom (Bulacan bounds)
        const searchQuery = query.toLowerCase().includes('bulacan') ? query : query + ', Bulacan';
        const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&bounded=1&viewbox=${viewbox}&limit=5&countrycodes=ph`;

        try {
            const res = await fetch(url);
            const data = await res.json();
            
            // Map Nominatim format to our existing Mapbox-style features array
            const features = data.map(item => ({
                place_name: item.display_name,
                text: item.display_name.split(',')[0],
                geometry: {
                    coordinates: [parseFloat(item.lon), parseFloat(item.lat)] // [lng, lat]
                }
            }));
            
            showSuggestions(features, type);
        } catch (e) {
            console.error("Geocoding Error:", e);
        }
    }

    function showSuggestions(features, type) {
        const container = document.getElementById(`${type}Suggestions`);
        container.innerHTML = '';
        if (features.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        features.forEach(f => {
            const div = document.createElement('div');
            div.className = 'autocomplete-item';
            div.innerText = f.place_name;
            div.onclick = () => {
                const inputId = type === 'origin' ? 'inputOrigin' : 'inputDestination';
                document.getElementById(inputId).value = f.place_name;
                container.style.display = 'none';
                if (type === 'origin') {
                    selectedOriginCoords = f.geometry.coordinates; // [lng, lat]
                    selectedOriginName = f.text;
                } else {
                    selectedDestCoords = f.geometry.coordinates;
                    selectedDestName = f.text;
                }
                updateRoutePlan();
            };
            container.appendChild(div);
        });
        container.style.display = 'block';
    }

    function updateBadgeUI() {
        const badge = document.getElementById('routeTypeBadge');
        if (badge) {
            if (useNlexExpressway) {
                badge.className = 'route-type-badge nlex';
                badge.innerHTML = '🛣️ NLEX Expressway';
            } else {
                badge.className = 'route-type-badge mcarthur';
                badge.innerHTML = '🗺️ Local Bulacan Route';
            }
        }
    }

    async function updateRoutePlan() {
        if (!selectedOriginCoords || !selectedDestCoords) return;

        if (isNavigating) {
            isNavigating = false;
            clearInterval(navInterval);
            const btn = document.getElementById('btnStartNav');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Start Drive Navigation';
        }

        currentCoords = { lat: selectedOriginCoords[1], lng: selectedOriginCoords[0] };
        currentRouteIndex = 0;
        activeAlertedCaseIds.clear();
        activeTelemetryPingCaseIds.clear();

        if (driverMarker) driverMarker.setLatLng([currentCoords.lat, currentCoords.lng]);

        let polylineColor = useNlexExpressway ? '#f97316' : '#3b82f6';
        
        const gpsStatus = document.getElementById('gpsStatusText');
        if (gpsStatus) gpsStatus.innerText = `Route: ${selectedOriginName || 'Origin'} ➔ ${selectedDestName || 'Destination'}`;

        // Fetch Route from Mapbox Directions API
        const coordsStr = `${selectedOriginCoords[0]},${selectedOriginCoords[1]};${selectedDestCoords[0]},${selectedDestCoords[1]}`;
        const excludeStr = useNlexExpressway ? "" : "&exclude=toll"; // Avoid NLEX if toggled off!
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsStr}?access_token=${MAPBOX_TOKEN}&geometries=geojson&overview=full${excludeStr}`;
        
        try {
            const res = await fetch(url);
            const data = await res.json();
            
            if (data.routes && data.routes.length > 0) {
                routePoints = data.routes[0].geometry.coordinates; // [lng, lat]

                // --- ROUTE-STRICT HAZARD PRE-FILTERING ---
                // Excludes hazards in alleyways / off-route by verifying they lie within 50m of the driving path.
                const casesRes = await LubakBackend.getCases();
                if (casesRes.success) {
                    activeRouteHazards = casesRes.cases.filter(c => {
                        if (c.status === 'Resolved') return false;
                        let minSegDist = Infinity;
                        let hLat = parseFloat(c.center_latitude);
                        let hLng = parseFloat(c.center_longitude);
                        
                        for (let i = 0; i < routePoints.length - 1; i++) {
                            let p1 = routePoints[i];
                            let p2 = routePoints[i+1];
                            let x = hLng, y = hLat;
                            let x1 = p1[0], y1 = p1[1];
                            let x2 = p2[0], y2 = p2[1];
                            
                            let A = x - x1, B = y - y1, C = x2 - x1, D = y2 - y1;
                            let dot = A * C + B * D;
                            let len_sq = C * C + D * D;
                            let param = -1;
                            if (len_sq != 0) param = dot / len_sq;
                            
                            let xx, yy;
                            if (param < 0) { xx = x1; yy = y1; }
                            else if (param > 1) { xx = x2; yy = y2; }
                            else { xx = x1 + param * C; yy = y1 + param * D; }
                            
                            let dist = LubakBackend.calculateDistance(y, x, yy, xx);
                            if (dist < minSegDist) minSegDist = dist;
                        }
                        return minSegDist <= 50; 
                    });
                }
                
                const leafletPoints = routePoints.map(c => [c[1], c[0]]); // Swap to [lat, lng] for Leaflet
                
                if (routePolyline) map.removeLayer(routePolyline);

                routePolyline = L.polyline(leafletPoints, {
                    color: polylineColor,
                    weight: 6,
                    opacity: 0.8,
                    lineJoin: 'round'
                }).addTo(map);

                map.fitBounds(routePolyline.getBounds(), { padding: [50, 50] });
            } else {
                showToast("Mapbox could not find a valid driving route between these points.", "warning");
            }
        } catch (e) {
            console.error("Routing Error:", e);
            showToast("Error generating route.", "warning");
        }
    }

    function playHazardAudioAlert(distance, address, severity) {
        if (!window.speechSynthesis) return;
        const msg = new SpeechSynthesisUtterance(`Warning. ${severity} Hazard ${Math.round(distance)} meters ahead. Please slow down.`);
        msg.rate = 1.0;
        msg.pitch = 1.0;
        msg.volume = 1.0;
        window.speechSynthesis.speak(msg);
    }

    async function checkProximityAndTelematics() {
        let closestHazard = null;
        let minDistance = Infinity;

        activeRouteHazards.forEach(item => {
            if (item.status === 'Resolved') return;
            let lat = parseFloat(item.center_latitude);
            let lng = parseFloat(item.center_longitude);
            let dist = LubakBackend.calculateDistance(currentCoords.lat, currentCoords.lng, lat, lng);

            if (dist <= EARLY_WARNING_RADIUS && dist < minDistance) {
                minDistance = dist;
                closestHazard = item;
            }
        });

        const hud = document.getElementById('hudWarningBanner');
        const speedText = document.getElementById('speedometerText');

        if (closestHazard) {
            let caseId = closestHazard.id;
            let severity = closestHazard.severity_level;
            let address = closestHazard.address || 'Road Hazard';

            if (minDistance <= 120) {
                currentVehicleSpeedKmh = Math.max(10.0, 58.0 - (120 - minDistance) * 0.45);
            } else {
                currentVehicleSpeedKmh = 58.0;
            }

            if (speedText) speedText.innerText = `${Math.round(currentVehicleSpeedKmh)} km/h`;

            if (hud) {
                hud.innerHTML = `
                    <div class="hud-warning-content ${severity.toLowerCase()}">
                        <div class="hud-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <div class="hud-details">
                            <div class="hud-title">EARLY WARNING: HAZARD IN ${Math.round(minDistance)}m</div>
                            <div class="hud-sub">${severity.toUpperCase()}: ${address}</div>
                        </div>
                        <div class="hud-badge">${closestHazard.total_reports} Pings</div>
                    </div>
                `;
                hud.style.display = 'block';
            }

            if (!activeAlertedCaseIds.has(caseId)) {
                activeAlertedCaseIds.add(caseId);
                playHazardAudioAlert(minDistance, address, severity);
            }

            if (minDistance <= SLOWDOWN_DETECTION_RADIUS && currentVehicleSpeedKmh <= 24.0 && !activeTelemetryPingCaseIds.has(caseId)) {
                activeTelemetryPingCaseIds.add(caseId);
                let speedDrop = 58.0 - currentVehicleSpeedKmh;

                const res = await LubakBackend.submitReport(currentCoords.lat, currentCoords.lng, 1, 'Telematics_Slowdown_Ping', speedDrop);
                if (res.success) {
                    showToast(`📡 TELEMETRY PING: Vehicle slowed to ${Math.round(currentVehicleSpeedKmh)} km/h near hazard. Auto-registered!`, 'warning');
                    refreshCautionZones();
                    if (window.AdminApp) window.AdminApp.loadAdminData();
                }
            }

        } else {
            currentVehicleSpeedKmh = useNlexExpressway ? 95.0 : 58.0;
            if (speedText) speedText.innerText = `${Math.round(currentVehicleSpeedKmh)} km/h`;
            if (hud) hud.style.display = 'none';
        }
    }

    function toggleDriveNavigation() {
        if (routePoints.length === 0) {
            showToast("Please search for an origin and destination first!", "warning");
            return;
        }

        const btn = document.getElementById('btnStartNav');
        
        if (!isNavigating) {
            isNavigating = true;
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Drive';

            if (currentRouteIndex >= routePoints.length - 1) {
                currentRouteIndex = 0;
                activeAlertedCaseIds.clear();
                activeTelemetryPingCaseIds.clear();
            }

            let stepAdvance = Math.max(1, Math.floor(routePoints.length / 320));

            navInterval = setInterval(() => {
                if (currentRouteIndex < routePoints.length) {
                    let pt = routePoints[currentRouteIndex];
                    currentCoords.lat = pt[1];
                    currentCoords.lng = pt[0];

                    if (driverMarker) driverMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
                    if (map) map.panTo([currentCoords.lat, currentCoords.lng]);

                    checkProximityAndTelematics();
                    currentRouteIndex += Math.ceil(navSpeed * stepAdvance);
                } else {
                    isNavigating = false;
                    clearInterval(navInterval);
                    const destName = selectedDestName || 'Destination';
                    if (btn) btn.innerHTML = `<i class="fa-solid fa-flag-checkered"></i> Reached ${destName}!`;
                    showToast(`🏁 Vehicle arrived safely at ${destName}!`, 'success');
                }
            }, 300);

        } else {
            isNavigating = false;
            if (btn) btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Resume Navigation';
            clearInterval(navInterval);
        }
    }

    function toggleNavSpeed() {
        const btn = document.getElementById('btnNavSpeed');
        if (navSpeed === 0.5) {
            navSpeed = 1.5;
            if (btn) btn.innerText = '⚡ Speed: 1.5x (Fast Drive)';
        } else {
            navSpeed = 0.5;
            if (btn) btn.innerText = '⏱️ Speed: 0.5x (Normal)';
        }
    }

    async function handleQuickReport() {
        const btn = document.getElementById('btnQuickReport');
        if (btn) {
            btn.style.transform = 'scale(0.92)';
            setTimeout(() => btn.style.transform = '', 200);
        }

        const result = await LubakBackend.submitReport(currentCoords.lat, currentCoords.lng, 1, 'Manual_Button', 0);

        if (result.success) {
            const data = result.data;
            let msg = data.is_new_case 
                ? `🚨 New Hazard Reported! Case #${data.case_id} registered.`
                : `✅ Hazard Confirmed! Attached to Case #${data.case_id} (${data.total_reports} pings).`;

            if (data.auto_escalated) msg += ` 🚨 CRITICAL SEVERITY ESCALATED (≥50 Pings)!`;

            showToast(msg, data.auto_escalated ? 'warning' : 'success');
            refreshCautionZones();
            if (window.AdminApp) window.AdminApp.loadAdminData();
        } else {
            showToast('Failed to submit report: ' + result.error, 'warning');
        }
    }

    function showToast(message, type = 'success') {
        let container = document.getElementById('toastContainer');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toastContainer';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }

        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<span>${type === 'warning' ? '⚠️' : '🔔'}</span> <div>${message}</div>`;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 4000);
    }

    return {
        init: () => {
            initDriverMap();
            document.getElementById('btnQuickReport')?.addEventListener('click', handleQuickReport);
            document.getElementById('btnStartNav')?.addEventListener('click', toggleDriveNavigation);
            document.getElementById('btnNavSpeed')?.addEventListener('click', toggleNavSpeed);

            document.getElementById('btnCurrentLocation')?.addEventListener('click', () => {
                if (!navigator.geolocation) {
                    showToast('Geolocation is not supported by your browser.', 'warning');
                    return;
                }
                
                const btn = document.getElementById('btnCurrentLocation');
                const origText = btn.innerHTML;
                btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Locating...';
                
                navigator.geolocation.getCurrentPosition(async (position) => {
                    const lat = position.coords.latitude;
                    const lng = position.coords.longitude;
                    
                    try {
                        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
                        const data = await res.json();
                        
                        let address = data.display_name;
                        if (address.length > 40) address = address.substring(0, 40) + '...';
                        
                        selectedOriginCoords = [lng, lat];
                        selectedOriginName = 'Current Location';
                        document.getElementById('inputOrigin').value = '📍 ' + address;
                        
                        currentCoords = { lat: lat, lng: lng };
                        
                        if (map) {
                            map.setView([lat, lng], 14);
                        }
                        
                        if (driverMarker) {
                            driverMarker.setLatLng([lat, lng]);
                        }
                        
                        updateBadgeUI();
                        updateRoutePlan();
                        showToast('Location acquired successfully!', 'success');
                    } catch (err) {
                        console.error(err);
                        showToast('Failed to acquire location address.', 'warning');
                    } finally {
                        btn.innerHTML = origText;
                    }
                }, (error) => {
                    console.error(error);
                    showToast('Failed to get location. Please allow GPS permissions.', 'warning');
                    btn.innerHTML = origText;
                }, { enableHighAccuracy: true });
            });

            const inputOrig = document.getElementById('inputOrigin');
            if (inputOrig) {
                inputOrig.addEventListener('input', (e) => {
                    clearTimeout(originTimeout);
                    originTimeout = setTimeout(() => fetchAutocomplete(e.target.value, 'origin'), 400);
                });
            }

            const inputDest = document.getElementById('inputDestination');
            if (inputDest) {
                inputDest.addEventListener('input', (e) => {
                    clearTimeout(destTimeout);
                    destTimeout = setTimeout(() => fetchAutocomplete(e.target.value, 'dest'), 400);
                });
            }
            
            // Hide suggestions if clicking outside
            document.addEventListener('click', (e) => {
                if(e.target && e.target.id !== 'inputOrigin') {
                    let s = document.getElementById('originSuggestions');
                    if(s) s.style.display = 'none';
                }
                if(e.target && e.target.id !== 'inputDestination') {
                    let s = document.getElementById('destSuggestions');
                    if(s) s.style.display = 'none';
                }
            });

            document.getElementById('toggleNlex')?.addEventListener('change', (e) => {
                useNlexExpressway = e.target.checked;
                updateBadgeUI();
                updateRoutePlan();
                showToast(useNlexExpressway ? '✅ Allow Toll Roads (NLEX)' : '✅ Avoid Toll Roads', 'success');
            });
        },
        refresh: refreshCautionZones,
        getCoords: () => currentCoords,
        showToast: showToast
    };
})();