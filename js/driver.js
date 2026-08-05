/**
 * LubakAlert - Driver Mobile Navigation Engine
 * -------------------------------------------------------------
 * 100% High-Precision Road Curvature Alignment Engine
 * Uses 1,112+ node high-resolution OpenStreetMap road geometry traces (js/road_data.js)
 * Slices exact street curves between ANY selected Origin & Destination.
 */

window.DriverApp = (function () {
    let map = null;
    let driverMarker = null;
    let routePolyline = null;
    let startMarker = null;
    let destMarker = null;
    let cautionCircles = [];
    let activeAlertedCaseIds = new Set();
    let activeTelemetryPingCaseIds = new Set();

    // Preset Locations with GPS Anchors
    const LOCATIONS = {
        'bulsu': { name: 'BulSU Gate 1, Malolos', lat: 14.858400, lng: 120.816200 },
        'malolos_capitol': { name: 'Malolos Provincial Capitol', lat: 14.855300, lng: 120.813300 },
        'guiguinto_tabang': { name: 'Tabang Junction, Guiguinto', lat: 14.836000, lng: 120.844000 },
        'balagtas': { name: 'Balagtas Town Center', lat: 14.810000, lng: 120.878000 },
        'bocaue_bridge': { name: 'Bocaue River Bridge', lat: 14.796000, lng: 120.926000 },
        'marilao': { name: 'SM City Marilao', lat: 14.755000, lng: 120.958000 },
        'meycauayan': { name: 'Meycauayan City Center', lat: 14.735000, lng: 120.957500 }
    };

    let currentOriginKey = 'bulsu';
    let currentDestKey = 'meycauayan';
    let useNlexExpressway = false;

    let routePoints = [];
    let currentRouteIndex = 0;
    let currentCoords = { lat: LOCATIONS['bulsu'].lat, lng: LOCATIONS['bulsu'].lng };
    let currentVehicleSpeedKmh = 58.0;

    let isNavigating = false;
    let navInterval = null;
    let navSpeed = 1;

    function playHazardAudioAlert(distanceMeters, address, severity) {
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            if (AudioCtx) {
                const ctx = new AudioCtx();
                const osc1 = ctx.createOscillator();
                const osc2 = ctx.createOscillator();
                const gain = ctx.createGain();

                osc1.type = 'triangle';
                osc2.type = 'sine';
                osc1.frequency.value = severity === 'Critical' ? 880 : 660;
                osc2.frequency.value = severity === 'Critical' ? 1760 : 1320;

                gain.gain.setValueAtTime(0.4, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);

                osc1.connect(gain);
                osc2.connect(gain);
                gain.connect(ctx.destination);

                osc1.start();
                osc2.start();
                osc1.stop(ctx.currentTime + 0.4);
                osc2.stop(ctx.currentTime + 0.4);
            }

            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const text = `Caution! ${severity} road hazard ahead in ${Math.round(distanceMeters)} meters.`;
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.1;
                window.speechSynthesis.speak(utterance);
            }
        } catch (e) {
            console.log('Audio warning unavailable:', e);
        }
    }

    function initDriverMap() {
        if (map) return;

        map = L.map('driverMap', {
            zoomControl: false,
            attributionControl: false
        }).setView([LOCATIONS[currentOriginKey].lat, LOCATIONS[currentOriginKey].lng], 13);

        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            maxZoom: 19,
            subdomains: 'abcd'
        }).addTo(map);

        const carIcon = L.divIcon({
            className: 'car-location-marker',
            html: `<div class="car-pulse-ring"></div>
                   <div style="
                        width: 32px; 
                        height: 32px; 
                        background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%); 
                        border: 3px solid #ffffff; 
                        border-radius: 50%; 
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        color: #ffffff;
                        font-size: 0.95rem;
                        box-shadow: 0 0 20px rgba(59, 130, 246, 0.8);
                   "><i class="fa-solid fa-car-side"></i></div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
        });

        driverMarker = L.marker([currentCoords.lat, currentCoords.lng], { icon: carIcon }).addTo(map);

        updateRoutePlan();
        refreshCautionZones();
    }

    /**
     * Find nearest node index in high-res road array
     */
    function findNearestNodeIndex(nodes, targetLat, targetLng) {
        let minD = Infinity;
        let bestIdx = 0;
        for (let i = 0; i < nodes.length; i++) {
            let latDiff = nodes[i][0] - targetLat;
            let lngDiff = nodes[i][1] - targetLng;
            let distSq = latDiff * latDiff + lngDiff * lngDiff;
            if (distSq < minD) {
                minD = distSq;
                bestIdx = i;
            }
        }
        return bestIdx;
    }

    /**
     * Slice High-Resolution 1,000+ Node Road Geometry
     * Strictly aligns with every curve on OpenStreetMap / CartoDB map tiles!
     */
    function getHighResRoadSubArray(origKey, destKey, isNlex) {
        const fullRoadDataset = (window.LubakRoadData && isNlex) 
            ? window.LubakRoadData.nlex 
            : (window.LubakRoadData ? window.LubakRoadData.macarthur : []);

        if (!fullRoadDataset || fullRoadDataset.length === 0) {
            return [];
        }

        const origObj = LOCATIONS[origKey] || LOCATIONS['bulsu'];
        const destObj = LOCATIONS[destKey] || LOCATIONS['meycauayan'];

        let startIdx = findNearestNodeIndex(fullRoadDataset, origObj.lat, origObj.lng);
        let endIdx = findNearestNodeIndex(fullRoadDataset, destObj.lat, destObj.lng);

        let isReverse = false;
        if (startIdx > endIdx) {
            let temp = startIdx;
            startIdx = endIdx;
            endIdx = temp;
            isReverse = true;
        }

        // Extract high-density road geometry segment
        let sliced = fullRoadDataset.slice(startIdx, endIdx + 1);

        if (isReverse) {
            sliced.reverse();
        }

        return sliced;
    }

    /**
     * Update Route Plan & Render High-Precision Road-Snapped Polyline
     */
    async function updateRoutePlan() {
        const orig = LOCATIONS[currentOriginKey] || LOCATIONS['bulsu'];
        const dest = LOCATIONS[currentDestKey] || LOCATIONS['meycauayan'];

        if (isNavigating) {
            isNavigating = false;
            clearInterval(navInterval);
            const btn = document.getElementById('btnStartNav');
            if (btn) btn.innerHTML = '<i class="fa-solid fa-location-arrow"></i> Start Drive Navigation';
        }

        currentCoords = { lat: orig.lat, lng: orig.lng };
        currentRouteIndex = 0;
        activeAlertedCaseIds.clear();
        activeTelemetryPingCaseIds.clear();

        if (driverMarker) driverMarker.setLatLng([orig.lat, orig.lng]);

        // Markers
        if (startMarker) map.removeLayer(startMarker);
        if (destMarker) map.removeLayer(destMarker);

        startMarker = L.marker([orig.lat, orig.lng], {
            icon: L.divIcon({
                className: 'route-label-marker',
                html: `<div style="background: #10b981; color: #fff; padding: 4px 8px; border-radius: 12px; font-weight: 700; font-size: 0.75rem; box-shadow: 0 4px 10px rgba(16,185,129,0.5);">🏁 ${orig.name}</div>`,
                iconAnchor: [30, 25]
            })
        }).addTo(map);

        destMarker = L.marker([dest.lat, dest.lng], {
            icon: L.divIcon({
                className: 'route-label-marker',
                html: `<div style="background: #ef4444; color: #fff; padding: 4px 8px; border-radius: 12px; font-weight: 700; font-size: 0.75rem; box-shadow: 0 4px 10px rgba(239,68,68,0.5);">🚩 ${dest.name}</div>`,
                iconAnchor: [30, 25]
            })
        }).addTo(map);

        // 1. Fetch 100% High-Precision Road Geometry (Matches basemap street curves 1:1)
        routePoints = getHighResRoadSubArray(currentOriginKey, currentDestKey, useNlexExpressway);

        // Render Polyline on Map
        if (routePolyline) map.removeLayer(routePolyline);
        routePolyline = L.polyline(routePoints, {
            color: useNlexExpressway ? '#f59e0b' : '#3b82f6',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        // Fit map bounds to show route
        if (routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [60, 60] });
        }

        let routeName = useNlexExpressway ? 'NLEX Expressway' : 'MacArthur Highway';
        updateRouteInfoDisplay(orig.name, dest.name, routeName);
    }

    function updateRouteInfoDisplay(origName, destName, routeName) {
        const textEl = document.getElementById('gpsStatusText');
        const badgeEl = document.getElementById('routeTypeBadge');

        if (textEl) textEl.innerText = `Route: ${origName} ➔ ${destName}`;
        if (badgeEl) {
            badgeEl.innerText = useNlexExpressway ? '⚡ NLEX Expressway' : '🛣️ MacArthur Highway';
            badgeEl.className = `route-type-badge ${useNlexExpressway ? 'nlex' : 'mcarthur'}`;
        }
    }

    async function refreshCautionZones() {
        if (!map) return;

        cautionCircles.forEach(c => map.removeLayer(c));
        cautionCircles = [];

        const response = await LubakBackend.getCases('all');
        if (!response.success || !response.cases) return;

        response.cases.forEach(item => {
            if (item.status === 'Resolved') return;

            let lat = parseFloat(item.center_latitude);
            let lng = parseFloat(item.center_longitude);
            let reports = parseInt(item.total_reports);
            let severity = item.severity_level;
            let detType = item.detection_type || 'Manual Report';

            let color = '#eab308';
            let radius = 35;

            if (severity === 'Critical' || reports >= 50) {
                color = '#ef4444';
                radius = 55;
            } else if (severity === 'Moderate' || reports >= 10) {
                color = '#f97316';
                radius = 42;
            }

            if (detType.includes('Telemetry')) color = '#a855f7';

            const circle = L.circle([lat, lng], {
                color: color,
                fillColor: color,
                fillOpacity: 0.35,
                radius: radius,
                weight: 2
            }).addTo(map);

            circle.bindPopup(`
                <div style="font-family: sans-serif; color: #1e293b; padding: 4px;">
                    <strong style="color: ${color}; font-size: 1.1em;">⚠️ ${severity.toUpperCase()} HAZARD</strong><br>
                    <b>Location:</b> ${item.address || 'Bulacan Corridor'}<br>
                    <b>Pings:</b> ${reports} (${detType})<br>
                    <small>Status: ${item.status}</small>
                </div>
            `);

            cautionCircles.push(circle);
        });
    }

    async function checkProximityAndTelematics() {
        const response = await LubakBackend.getCases('all');
        if (!response.success || !response.cases) return;

        const PROXIMITY_ALERT_RADIUS = 200.0;
        const SLOWDOWN_DETECTION_RADIUS = 45.0;

        let closestHazard = null;
        let minDistance = Infinity;

        for (let item of response.cases) {
            if (item.status === 'Resolved') continue;

            let lat = parseFloat(item.center_latitude);
            let lng = parseFloat(item.center_longitude);
            let dist = LubakBackend.calculateDistance(currentCoords.lat, currentCoords.lng, lat, lng);

            if (dist <= PROXIMITY_ALERT_RADIUS && dist < minDistance) {
                minDistance = dist;
                closestHazard = item;
            }
        }

        const hud = document.getElementById('hudWarningBanner');
        const speedText = document.getElementById('speedometerText');

        if (closestHazard) {
            let caseId = closestHazard.id;
            let severity = closestHazard.severity_level;
            let address = closestHazard.address || 'Road Hazard';

            if (minDistance <= 80) {
                currentVehicleSpeedKmh = Math.max(10.0, 58.0 - (80 - minDistance) * 0.7);
            } else {
                currentVehicleSpeedKmh = 58.0;
            }

            if (speedText) speedText.innerText = `${Math.round(currentVehicleSpeedKmh)} km/h`;

            if (hud) {
                hud.innerHTML = `
                    <div class="hud-warning-content ${severity.toLowerCase()}">
                        <div class="hud-icon"><i class="fa-solid fa-triangle-exclamation"></i></div>
                        <div class="hud-details">
                            <div class="hud-title">HAZARD AHEAD (${Math.round(minDistance)}m)</div>
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

            if (minDistance <= SLOWDOWN_DETECTION_RADIUS && currentVehicleSpeedKmh <= 22.0 && !activeTelemetryPingCaseIds.has(caseId)) {
                activeTelemetryPingCaseIds.add(caseId);
                let speedDrop = 58.0 - currentVehicleSpeedKmh;

                const res = await LubakBackend.submitReport(currentCoords.lat, currentCoords.lng, 1, 'Telematics_Slowdown_Ping', speedDrop);
                if (res.success) {
                    showToast(`📡 TELEMETRY PING: Speed dropped to ${Math.round(currentVehicleSpeedKmh)} km/h near hazard. Auto-registered!`, 'warning');
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
        const btn = document.getElementById('btnStartNav');
        
        if (!isNavigating) {
            isNavigating = true;
            if (btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pause Drive';

            if (currentRouteIndex >= routePoints.length - 1) {
                currentRouteIndex = 0;
                activeAlertedCaseIds.clear();
                activeTelemetryPingCaseIds.clear();
            }

            // Move vehicle smoothly along high-res road nodes
            let stepAdvance = Math.max(1, Math.floor(routePoints.length / 250));

            navInterval = setInterval(() => {
                if (currentRouteIndex < routePoints.length) {
                    let pt = routePoints[currentRouteIndex];
                    currentCoords.lat = pt[0];
                    currentCoords.lng = pt[1];

                    if (driverMarker) driverMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
                    if (map) map.panTo([currentCoords.lat, currentCoords.lng]);

                    checkProximityAndTelematics();
                    currentRouteIndex += (navSpeed * stepAdvance);
                } else {
                    isNavigating = false;
                    clearInterval(navInterval);
                    const destName = LOCATIONS[currentDestKey]?.name || 'Destination';
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
        if (navSpeed === 1) {
            navSpeed = 2;
            if (btn) btn.innerText = '⚡ Speed: 2x (Fast Drive)';
        } else {
            navSpeed = 1;
            if (btn) btn.innerText = '🚗 Speed: 1x (Normal)';
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
                : `⚡ Hazard Confirmed! Attached to Case #${data.case_id} (${data.total_reports} pings).`;

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
        toast.innerHTML = `<span>${type === 'warning' ? '⚠️' : '✅'}</span> <div>${message}</div>`;
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

            document.getElementById('selectOrigin')?.addEventListener('change', (e) => {
                currentOriginKey = e.target.value;
                updateRoutePlan();
            });

            document.getElementById('selectDestination')?.addEventListener('change', (e) => {
                currentDestKey = e.target.value;
                updateRoutePlan();
            });

            document.getElementById('toggleNlex')?.addEventListener('change', (e) => {
                useNlexExpressway = e.target.checked;
                updateRoutePlan();
                showToast(useNlexExpressway ? '⚡ Routing changed to NLEX Expressway' : '🛣️ Routing changed to MacArthur Highway', 'success');
            });
        },
        refresh: refreshCautionZones,
        getCoords: () => currentCoords,
        showToast: showToast
    };
})();
