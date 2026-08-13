/**
 * LubakAlert - Client-Side Mock Backend Engine
 * -------------------------------------------------------------
 * Realistic Real-World Bulacan Hazard Dataset:
 * - Guiguinto & Malolos Water Pipe Laying Construction & Single-Lane Bottlenecks
 * - Telematics Speed Drop Pings & High-Density Hazard Cases
 */

window.LubakBackend = (function () {
    let useLiveBackend = false; 

    // 12 Pre-Populated Real-World Bulacan Hazard Cases (Pipe Repair Bottlenecks & High Pings)
    let mockState = {
        users: [
            { id: 1, name: 'BulSU Student Driver #1042', device_info: 'Mobile Telematics Active' },
            { id: 2, name: 'Guiguinto Jeepney Driver #8821', device_info: 'Mobile Telematics Active' },
            { id: 3, name: 'DPWH Bulacan Patrol Unit 1', device_info: 'Fleet Alpha' }
        ],
        cases: [
            {
                id: 1,
                center_latitude: 14.834000,
                center_longitude: 120.866000,
                total_reports: 142,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 46.5,
                status: 'Pending',
                created_at: '2026-07-31 09:15:00',
                updated_at: '2026-08-05 11:20:00',
                address: 'MacArthur Hwy (Tabang, Guiguinto) 🚧 Pipe Laying & Single-Lane Bottleneck'
            },
            {
                id: 2,
                center_latitude: 14.845500,
                center_longitude: 120.835900,
                total_reports: 118,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 44.0,
                status: 'Pending',
                created_at: '2026-08-01 10:15:00',
                updated_at: '2026-08-05 10:22:00',
                address: 'MacArthur Hwy (Tikay, Malolos) 🚧 Pipe Repair Trench & Unpaved Steel Plates'
            },
            {
                id: 3,
                center_latitude: 14.826000,
                center_longitude: 120.884000,
                total_reports: 135,
                severity_level: 'Critical',
                detection_type: 'Telemetry Speed Drop',
                avg_speed_drop_kmh: 42.0,
                status: 'In Progress',
                created_at: '2026-08-02 08:30:00',
                updated_at: '2026-08-05 09:10:00',
                address: 'MacArthur Hwy (Guiguinto Poblacion) 🚧 Pipe Laying Digging & Asphalt Drop'
            },
            {
                id: 4,
                center_latitude: 14.852955,
                center_longitude: 120.820700,
                total_reports: 86,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 38.5,
                status: 'Pending',
                created_at: '2026-08-03 06:00:00',
                updated_at: '2026-08-05 07:45:00',
                address: 'MacArthur Hwy (Sumapang Matanda, Malolos) 🚧 Single-Lane Pipe Construction'
            },
            {
                id: 5,
                center_latitude: 14.858400,
                center_longitude: 120.816200,
                total_reports: 46,
                severity_level: 'Moderate',
                detection_type: 'Manual Report',
                avg_speed_drop_kmh: 20.0,
                status: 'Pending',
                created_at: '2026-07-30 12:00:00',
                updated_at: '2026-08-04 18:30:00',
                address: 'MacArthur Hwy (BulSU Gate 1, Malolos) Asphalt Cracks & Road Depression'
            },
            {
                id: 6,
                center_latitude: 14.820028,
                center_longitude: 120.900000,
                total_reports: 58,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 36.0,
                status: 'Pending',
                created_at: '2026-08-01 11:10:00',
                updated_at: '2026-08-05 09:00:00',
                address: 'MacArthur Hwy (Borol 1st, Balagtas) Deep Potholes & Culvert Digging'
            },
            {
                id: 7,
                center_latitude: 14.817500,
                center_longitude: 120.907800,
                total_reports: 42,
                severity_level: 'Moderate',
                detection_type: 'Manual Report',
                avg_speed_drop_kmh: 24.0,
                status: 'In Progress',
                created_at: '2026-08-02 14:00:00',
                updated_at: '2026-08-04 16:00:00',
                address: 'MacArthur Hwy (Balagtas Town Center) Unpaved Patch & Traffic Slowdown'
            },
            {
                id: 8,
                center_latitude: 14.798000,
                center_longitude: 120.928000,
                total_reports: 165,
                severity_level: 'Critical',
                detection_type: 'Telemetry Speed Drop',
                avg_speed_drop_kmh: 48.0,
                status: 'Pending',
                created_at: '2026-07-29 06:00:00',
                updated_at: '2026-08-05 08:00:00',
                address: 'MacArthur Hwy (Bocaue River Bridge) Severe Bridge Approach Pothole Trench'
            },
            {
                id: 9,
                center_latitude: 14.789000,
                center_longitude: 120.936000,
                total_reports: 94,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 41.5,
                status: 'Pending',
                created_at: '2026-07-31 09:00:00',
                updated_at: '2026-08-05 10:00:00',
                address: 'MacArthur Hwy (Lolomboy, Bocaue) Flooded Asphalt Pothole Cluster'
            },
            {
                id: 10,
                center_latitude: 14.756800,
                center_longitude: 120.960500,
                total_reports: 194,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 47.2,
                status: 'Pending',
                created_at: '2026-07-28 12:00:00',
                updated_at: '2026-08-05 11:30:00',
                address: 'MacArthur Hwy (SM City Marilao / Abangan Sur) Severe Waterlogged Pothole Cluster'
            },
            {
                id: 11,
                center_latitude: 14.746000,
                center_longitude: 120.960000,
                total_reports: 72,
                severity_level: 'Critical',
                detection_type: 'Telemetry Speed Drop',
                avg_speed_drop_kmh: 39.0,
                status: 'In Progress',
                created_at: '2026-08-03 08:00:00',
                updated_at: '2026-08-05 07:00:00',
                address: 'MacArthur Hwy (Saluysoy, Meycauayan) Drainage Excavation & Edge Drop'
            },
            {
                id: 12,
                center_latitude: 14.735000,
                center_longitude: 120.957500,
                total_reports: 87,
                severity_level: 'Critical',
                detection_type: 'Hybrid',
                avg_speed_drop_kmh: 43.0,
                status: 'Pending',
                created_at: '2026-08-01 10:00:00',
                updated_at: '2026-08-05 09:30:00',
                address: 'MacArthur Hwy (Malhacan Rd, Meycauayan) Deep Junction Pothole Cluster'
            }
        ],
        reports: [
            { id: 1, case_id: 1, user_id: 1, latitude: 14.834005, longitude: 120.866003, report_type: 'Manual_Button', timestamp: '2026-07-31 09:15:00' },
            { id: 2, case_id: 2, user_id: 2, latitude: 14.845505, longitude: 120.835903, report_type: 'Telematics_Slowdown_Ping', timestamp: '2026-08-01 10:15:00' }
        ]
    };

    function calculateHaversineDistance(lat1, lon1, lat2, lon2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    async function checkBackendConnectivity() {
        try {
            const res = await fetch('backend/admin_api.php?filter=all', { method: 'GET' });
            if (res.ok) {
                const data = await res.json();
                if (data.success) {
                    useLiveBackend = true;
                    return true;
                }
            }
        } catch (e) {
            console.log('ℹ️ LubakAlert: Mock DB active with Guiguinto/Malolos Pipe Repair Datasets.');
        }
        useLiveBackend = false;
        return false;
    }

    checkBackendConnectivity();

    return {
        isLiveBackend: () => useLiveBackend,
        calculateDistance: calculateHaversineDistance,

        setBackendMode: (mode) => { useLiveBackend = mode; },

        submitReport: async function (latitude, longitude, userId = 1, reportType = 'Manual_Button', speedDropKmh = 0) {
            if (useLiveBackend) {
                try {
                    const res = await fetch('backend/report_api.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            latitude,
                            longitude,
                            user_id: userId,
                            report_type: reportType,
                            speed_drop_kmh: speedDropKmh
                        })
                    });
                    return await res.json();
                } catch (err) {
                    console.error('PHP API Error, falling back to mock:', err);
                }
            }

            const CLUSTER_RADIUS_METERS = 20.0;
            const CRITICAL_THRESHOLD = 50;

            let closestCase = null;
            let minDistance = Infinity;

            for (let c of mockState.cases) {
                if (c.status === 'Resolved') continue;

                let dist = calculateHaversineDistance(latitude, longitude, c.center_latitude, c.center_longitude);
                if (dist <= CLUSTER_RADIUS_METERS && dist < minDistance) {
                    minDistance = dist;
                    closestCase = c;
                }
            }

            let reportId = mockState.reports.length + 1;
            let isNewCase = false;

            if (closestCase) {
                closestCase.total_reports += 1;
                closestCase.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);

                if (reportType === 'Telematics_Slowdown_Ping' && closestCase.detection_type === 'Manual Report') {
                    closestCase.detection_type = 'Hybrid';
                }

                if (speedDropKmh > 0) {
                    closestCase.avg_speed_drop_kmh = Math.round(((closestCase.avg_speed_drop_kmh + speedDropKmh) / 2) * 10) / 10;
                }

                if (closestCase.total_reports >= CRITICAL_THRESHOLD) {
                    closestCase.severity_level = 'Critical';
                } else if (closestCase.total_reports >= 10) {
                    closestCase.severity_level = 'Moderate';
                }

                mockState.reports.push({
                    id: reportId,
                    case_id: closestCase.id,
                    user_id: userId,
                    latitude: latitude,
                    longitude: longitude,
                    report_type: reportType,
                    timestamp: new Date().toISOString()
                });

                return {
                    success: true,
                    message: reportType === 'Telematics_Slowdown_Ping' 
                        ? '📡 Traffic Slowdown Ping attached to existing case within 20m.'
                        : 'Report linked to existing MacArthur Hwy case within 20m.',
                    data: {
                        report_id: reportId,
                        case_id: closestCase.id,
                        is_new_case: false,
                        total_reports: closestCase.total_reports,
                        severity_level: closestCase.severity_level,
                        detection_type: closestCase.detection_type,
                        avg_speed_drop_kmh: closestCase.avg_speed_drop_kmh,
                        distance_to_center_meters: Math.round(minDistance * 100) / 100,
                        auto_escalated: (closestCase.total_reports >= CRITICAL_THRESHOLD)
                    }
                };
            } else {
                isNewCase = true;
                let newCaseId = mockState.cases.length + 1;
                let detType = (reportType === 'Telematics_Slowdown_Ping') ? 'Telemetry Speed Drop' : 'Manual Report';

                let newCase = {
                    id: newCaseId,
                    center_latitude: latitude,
                    center_longitude: longitude,
                    total_reports: 1,
                    severity_level: 'Low',
                    detection_type: detType,
                    avg_speed_drop_kmh: speedDropKmh > 0 ? speedDropKmh : 15.0,
                    status: 'Pending',
                    created_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19),
                    address: `MacArthur Hwy Location (${latitude.toFixed(4)}, ${longitude.toFixed(4)}), Bulacan`
                };

                mockState.cases.push(newCase);
                mockState.reports.push({
                    id: reportId,
                    case_id: newCaseId,
                    user_id: userId,
                    latitude: latitude,
                    longitude: longitude,
                    report_type: reportType,
                    timestamp: new Date().toISOString()
                });

                return {
                    success: true,
                    message: reportType === 'Telematics_Slowdown_Ping'
                        ? '📡 Auto-registered new hazard from vehicle slowdown telemetry ping!'
                        : 'New Bulacan road hazard case created.',
                    data: {
                        report_id: reportId,
                        case_id: newCaseId,
                        is_new_case: true,
                        total_reports: 1,
                        severity_level: 'Low',
                        detection_type: detType,
                        avg_speed_drop_kmh: newCase.avg_speed_drop_kmh,
                        distance_to_center_meters: 0,
                        auto_escalated: false
                    }
                };
            }
        },

        getCases: async function (filter = 'all') {
            if (useLiveBackend) {
                try {
                    const res = await fetch(`backend/admin_api.php?filter=${filter}`);
                    return await res.json();
                } catch (e) {
                    console.error('PHP Admin API fetch error:', e);
                }
            }

            let filtered = mockState.cases.filter(c => {
                if (filter === 'critical') return c.severity_level === 'Critical';
                if (filter === 'telemetry') return c.detection_type.includes('Telemetry') || c.detection_type === 'Hybrid';
                if (filter === 'pending') return c.status === 'Pending';
                if (filter === 'in_progress') return c.status === 'In Progress';
                if (filter === 'resolved') return c.status === 'Resolved';
                return true;
            });

            let metrics = {
                total_cases: mockState.cases.length,
                critical_cases: mockState.cases.filter(c => c.severity_level === 'Critical').length,
                telemetry_cases: mockState.cases.filter(c => c.detection_type.includes('Telemetry') || c.detection_type === 'Hybrid').length,
                pending_cases: mockState.cases.filter(c => c.status === 'Pending').length,
                in_progress_cases: mockState.cases.filter(c => c.status === 'In Progress').length,
                resolved_cases: mockState.cases.filter(c => c.status === 'Resolved').length,
                total_individual_reports: mockState.reports.length
            };

            return {
                success: true,
                metrics: metrics,
                cases: filtered
            };
        },

        updateCaseStatus: async function (caseId, status) {
            if (useLiveBackend) {
                try {
                    const res = await fetch('backend/admin_api.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ case_id: caseId, status: status })
                    });
                    return await res.json();
                } catch (e) {
                    console.error('PHP Status update error:', e);
                }
            }

            let c = mockState.cases.find(item => item.id === parseInt(caseId));
            if (c) {
                c.status = status;
                c.updated_at = new Date().toISOString().replace('T', ' ').substring(0, 19);
                return { success: true, message: `Status updated to ${status}` };
            }
            return { success: false, error: 'Case not found' };
        }
    };
})();