/**
 * LubakAlert - Driver Mobile Navigation & Route Engine
 * -------------------------------------------------------------
 * CLEAN HIGHWAY ROUTING (No interior loops / backroad shortcuts):
 * - BLUE Line (#3b82f6): MacArthur Highway (Manila North Road / R-8)
 * - ORANGE Line (#f97316): North Luzon Expressway (NLEX / E1)
 *
 * Uses verified, clean highway node traces from js/road_data.js.
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

    // Preset Location Coordinates in Bulacan
    // NOTE: These are verified against real MacArthur Highway landmarks (Wikipedia /
    // geocoded municipal hall & interchange coordinates). The previous guiguinto_tabang
    // and balagtas points were ~2-3km off the actual highway, which is why simulated
    // navigation was cutting diagonally through blocks instead of following the road.
    const LOCATIONS = {
        'bulsu': { name: 'BulSU Gate 1, Malolos', lat: 14.858400, lng: 120.816200 },
        'malolos_capitol': { name: 'Malolos Provincial Capitol', lat: 14.856500, lng: 120.814340 },
        'guiguinto_tabang': { name: 'Tabang Junction, Guiguinto', lat: 14.834000, lng: 120.866000 },
        'balagtas': { name: 'Balagtas Town Center', lat: 14.817500, lng: 120.907800 },
        'bocaue_bridge': { name: 'Bocaue River Bridge', lat: 14.798000, lng: 120.928000 },
        'marilao': { name: 'SM City Marilao', lat: 14.756800, lng: 120.960500 },
        'meycauayan': { name: 'Meycauayan City Center', lat: 14.735000, lng: 120.957500 }
    };

    let currentOriginKey = 'bulsu';
    let currentDestKey = 'meycauayan';
    let useNlexExpressway = false; // Default: FALSE (Blue Line = MacArthur Highway)

    let routePoints = [];
    let currentRouteIndex = 0;
    let currentCoords = { lat: LOCATIONS['bulsu'].lat, lng: LOCATIONS['bulsu'].lng };
    let currentVehicleSpeedKmh = 58.0;

    let isNavigating = false;
    let navInterval = null;
    let navSpeed = 0.5;

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
                const routeName = useNlexExpressway ? 'NLEX Expressway' : 'MacArthur Highway';
                const text = `Caution! ${severity} road hazard ahead in ${Math.round(distanceMeters)} meters on ${routeName}.`;
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.rate = 1.05;
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
     * Slice Clean Highway Dataset (MacArthur or NLEX) strictly between Origin & Destination
     */
    function getCleanHighwaySubArray(origKey, destKey, isNlex) {
        const fullRoadDataset = (window.LubakRoadData && isNlex) 
            ? window.LubakRoadData.nlex 
            : (window.LubakRoadData ? window.LubakRoadData.macarthur : []);

        if (!fullRoadDataset || fullRoadDataset.length === 0) return [];

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

        let sliced = fullRoadDataset.slice(startIdx, endIdx + 1);
        if (isReverse) sliced.reverse();
        return sliced;
    }

    /**
     * Update Route Plan & Render Blue (MacArthur) or Orange (NLEX) Highway Polyline
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

        // Fetch verified, clean highway node points (MacArthur Highway vs NLEX Expressway)
        routePoints = getCleanHighwaySubArray(currentOriginKey, currentDestKey, useNlexExpressway);

        // Color coding: BLUE for MacArthur Highway (#3b82f6), ORANGE for NLEX Expressway (#f97316)
        let polylineColor = useNlexExpressway ? '#f97316' : '#3b82f6';
        let routeName = useNlexExpressway ? 'NLEX Expressway (E1)' : 'MacArthur Highway (R-8)';

        if (routePolyline) map.removeLayer(routePolyline);
        routePolyline = L.polyline(routePoints, {
            color: polylineColor,
            weight: 6,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round'
        }).addTo(map);

        if (routePoints.length > 0) {
            const bounds = L.latLngBounds(routePoints);
            map.fitBounds(bounds, { padding: [60, 60] });
        }

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
        // Hazard-circle markers intentionally removed from the driver map (per request)
        // so the route polyline itself can be inspected cleanly against the basemap.
        // Proximity-based early-warning logic in checkProximityAndTelematics() below is
        // unaffected -- it queries the case data directly and does not depend on these
        // visual markers, so HUD warnings, audio alerts, and telemetry pings still work.
        if (!map) return;
        cautionCircles.forEach(c => map.removeLayer(c));
        cautionCircles = [];
    }

    async function checkProximityAndTelematics() {
        const response = await LubakBackend.getCases('all');
        if (!response.success || !response.cases) return;

        const EARLY_WARNING_RADIUS = 400.0;
        const SLOWDOWN_DETECTION_RADIUS = 50.0;

        let closestHazard = null;
        let minDistance = Infinity;

        for (let item of response.cases) {
            if (item.status === 'Resolved') continue;

            let lat = parseFloat(item.center_latitude);
            let lng = parseFloat(item.center_longitude);
            let dist = LubakBackend.calculateDistance(currentCoords.lat, currentCoords.lng, lat, lng);

            if (dist <= EARLY_WARNING_RADIUS && dist < minDistance) {
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
                    currentCoords.lat = pt[0];
                    currentCoords.lng = pt[1];

                    if (driverMarker) driverMarker.setLatLng([currentCoords.lat, currentCoords.lng]);
                    if (map) map.panTo([currentCoords.lat, currentCoords.lng]);

                    checkProximityAndTelematics();
                    currentRouteIndex += Math.ceil(navSpeed * stepAdvance);
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
        if (navSpeed === 0.5) {
            navSpeed = 1.5;
            if (btn) btn.innerText = '⚡ Speed: 1.5x (Fast Drive)';
        } else {
            navSpeed = 0.5;
            if (btn) btn.innerText = '🚗 Speed: 0.5x (Normal)';
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
                showToast(useNlexExpressway ? '⚡ Routing changed to NLEX Expressway (Orange Line)' : '🛣️ Routing changed to MacArthur Highway (Blue Line)', 'success');
            });
        },
        refresh: refreshCautionZones,
        getCoords: () => currentCoords,
        showToast: showToast
    };
})();