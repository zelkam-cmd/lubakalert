/**
 * LubakAlert - DPWH Admin Dashboard Controller
 * -------------------------------------------------------------
 * Bulacan Engineering District Focus (San Miguel, Malolos, MacArthur Highway)
 * Requirements:
 * - Data dashboard displaying Critical Cases, Telemetry Traffic Slowdown Detections, and Manual Driver Reports.
 * - Table columns: Case ID, Location Coords, Total Reports, Detection Type (Manual vs Telemetry Ping), Severity, Status.
 * - Work Order CSV export.
 */

window.AdminApp = (function () {
    let adminMap = null;
    let adminMarkers = [];
    let currentFilter = 'all';

    function initAdminMap() {
        const container = document.getElementById('adminMap');
        if (!container) return;

        if (!adminMap) {
            adminMap = L.map('adminMap', {
                zoomControl: true,
                attributionControl: false
            }).setView([14.9500, 120.9000], 11);

            L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
                maxZoom: 19,
                subdomains: 'abcd',
                attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
            }).addTo(adminMap);
        }

        setTimeout(() => {
            if (adminMap) adminMap.invalidateSize();
        }, 150);
    }

    function invalidateAdminMap() {
        if (adminMap) {
            setTimeout(() => { adminMap.invalidateSize(); }, 100);
            setTimeout(() => { adminMap.invalidateSize(); }, 300);
        }
    }

    async function loadAdminData() {
        initAdminMap();

        const response = await LubakBackend.getCases(currentFilter);
        if (!response.success) return;

        const m = response.metrics || {};
        document.getElementById('kpiTotalCases').innerText = m.total_cases || 0;
        document.getElementById('kpiCriticalCases').innerText = m.critical_cases || 0;
        document.getElementById('kpiPendingCases').innerText = m.pending_cases || 0;
        document.getElementById('kpiInProgressCases').innerText = m.in_progress_cases || 0;
        document.getElementById('kpiResolvedCases').innerText = m.resolved_cases || 0;

        renderCasesTable(response.cases || []);
        renderAdminMapMarkers(response.cases || []);
        invalidateAdminMap();
    }

    function renderCasesTable(casesList) {
        const tbody = document.getElementById('adminCasesTbody');
        if (!tbody) return;

        if (casesList.length === 0) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align: center; color: var(--text-muted); padding: 2rem;">
                        No hazard cases match the selected filter in Bulacan.
                    </td>
                </tr>`;
            return;
        }

        let html = '';
        casesList.forEach(item => {
            let lat = parseFloat(item.center_latitude).toFixed(5);
            let lng = parseFloat(item.center_longitude).toFixed(5);
            
            let badgeClass = 'badge-low';
            if (item.severity_level === 'Critical') badgeClass = 'badge-critical';
            else if (item.severity_level === 'Moderate') badgeClass = 'badge-moderate';

            let detType = item.detection_type || 'Manual Report';
            let detBadgeStyle = 'background: rgba(59, 130, 246, 0.18); color: #93c5fd; border: 1px solid rgba(59, 130, 246, 0.4);';
            let detIcon = 'fa-user-gear';

            if (detType.includes('Telemetry')) {
                detBadgeStyle = 'background: rgba(168, 85, 247, 0.18); color: #e9d5ff; border: 1px solid rgba(168, 85, 247, 0.4);';
                detIcon = 'fa-satellite-dish';
            } else if (detType === 'Hybrid') {
                detBadgeStyle = 'background: rgba(16, 185, 129, 0.18); color: #6ee7b7; border: 1px solid rgba(16, 185, 129, 0.4);';
                detIcon = 'fa-network-wired';
            }

            html += `
                <tr id="case-row-${item.id}">
                    <td>
                        <strong style="color: var(--text-primary);">#CASE-${item.id}</strong>
                    </td>
                    <td>
                        <div style="font-family: var(--font-mono); font-size: 0.82rem;">
                            📍 ${lat}, ${lng}
                        </div>
                        <small style="color: var(--text-muted); font-size: 0.76rem;">${item.address || 'MacArthur Hwy, Bulacan'}</small>
                    </td>
                    <td>
                        <span class="badge" style="${detBadgeStyle}">
                            <i class="fa-solid ${detIcon}"></i> ${detType}
                        </span>
                        ${item.avg_speed_drop_kmh ? `<div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">Avg Drop: -${item.avg_speed_drop_kmh} km/h</div>` : ''}
                    </td>
                    <td>
                        <span style="font-family: var(--font-mono); font-weight: 700; color: #ffffff;">
                            ${item.total_reports} pings
                        </span>
                    </td>
                    <td>
                        <span class="badge ${badgeClass}">${item.severity_level}</span>
                    </td>
                    <td>
                        <select class="status-select" onchange="AdminApp.handleStatusChange(${item.id}, this.value)">
                            <option value="Pending" ${item.status === 'Pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="In Progress" ${item.status === 'In Progress' ? 'selected' : ''}>🚜 In Progress</option>
                            <option value="Resolved" ${item.status === 'Resolved' ? 'selected' : ''}>✅ Resolved</option>
                        </select>
                    </td>
                    <td>
                        <button class="sim-btn" onclick="AdminApp.zoomToCase(${item.center_latitude}, ${item.center_longitude})">
                            🔍 Locate
                        </button>
                    </td>
                </tr>
            `;
        });

        tbody.innerHTML = html;
    }

    function renderAdminMapMarkers(casesList) {
        if (!adminMap) return;

        adminMarkers.forEach(m => adminMap.removeLayer(m));
        adminMarkers = [];

        casesList.forEach(item => {
            let lat = parseFloat(item.center_latitude);
            let lng = parseFloat(item.center_longitude);
            let color = '#eab308';
            if (item.severity_level === 'Critical') color = '#ef4444';
            else if (item.severity_level === 'Moderate') color = '#f97316';

            if (item.detection_type && item.detection_type.includes('Telemetry')) {
                color = '#a855f7'; // Purple marker for Telemetry Speed Drop Pings
            }

            const markerIcon = L.divIcon({
                className: 'custom-admin-marker',
                html: `<div style="
                    background: ${color};
                    color: #fff;
                    font-weight: 800;
                    font-size: 0.75rem;
                    padding: 3px 8px;
                    border-radius: 12px;
                    border: 2px solid #fff;
                    box-shadow: 0 4px 12px ${color};
                    white-space: nowrap;
                ">#${item.id} (${item.total_reports})</div>`,
                iconAnchor: [20, 10]
            });

            const marker = L.marker([lat, lng], { icon: markerIcon }).addTo(adminMap);
            marker.bindPopup(`
                <div style="font-family: sans-serif; color: #0f172a; padding: 4px;">
                    <h4 style="margin: 0; color: ${color};">DPWH Bulacan Case #${item.id}</h4>
                    <p style="margin: 4px 0 0 0; font-size: 0.85em;">
                        <b>Detection:</b> ${item.detection_type}<br>
                        <b>Location:</b> ${item.address || 'MacArthur Hwy, Bulacan'}<br>
                        <b>Severity:</b> ${item.severity_level}<br>
                        <b>Total Pings:</b> ${item.total_reports}<br>
                        <b>Status:</b> ${item.status}
                    </p>
                </div>
            `);

            adminMarkers.push(marker);
        });
    }

    async function handleStatusChange(caseId, newStatus) {
        const res = await LubakBackend.updateCaseStatus(caseId, newStatus);
        if (res.success) {
            DriverApp.showToast(`Case #${caseId} status updated to '${newStatus}'`, 'success');
            loadAdminData();
            DriverApp.refresh();
        } else {
            DriverApp.showToast('Failed to update status: ' + res.error, 'warning');
        }
    }

    function zoomToCase(lat, lng) {
        if (!adminMap) return;
        adminMap.setView([lat, lng], 15, { animate: true });
        invalidateAdminMap();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }

    async function exportToCSV() {
        const response = await LubakBackend.getCases('all');
        if (!response.success || !response.cases.length) {
            DriverApp.showToast('No data available to export.', 'warning');
            return;
        }

        let csvContent = 'data:text/csv;charset=utf-8,';
        csvContent += 'Case ID,Location Address,Center Latitude,Center Longitude,Detection Type,Avg Speed Drop (km/h),Total Reports,Severity Level,Status,Created At,Updated At\n';

        response.cases.forEach(c => {
            let row = [
                c.id,
                `"${c.address || 'MacArthur Hwy, Bulacan'}"`,
                c.center_latitude,
                c.center_longitude,
                `"${c.detection_type || 'Manual Report'}"`,
                c.avg_speed_drop_kmh || 0,
                c.total_reports,
                c.severity_level,
                c.status,
                `"${c.created_at}"`,
                `"${c.updated_at}"`
            ].join(',');
            csvContent += row + '\n';
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement('a');
        link.setAttribute('href', encodedUri);
        link.setAttribute('download', `DPWH_Bulacan_WorkOrders_${new Date().toISOString().substring(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        DriverApp.showToast('📄 Exported DPWH Bulacan Work Orders CSV file successfully!', 'success');
    }

    return {
        init: () => {
            loadAdminData();

            document.querySelectorAll('.filter-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');
                    currentFilter = btn.getAttribute('data-filter');
                    loadAdminData();
                });
            });

            document.getElementById('btnExportCSV')?.addEventListener('click', exportToCSV);
            document.getElementById('btnRefreshAdmin')?.addEventListener('click', loadAdminData);

            window.addEventListener('resize', invalidateAdminMap);
        },
        loadAdminData: loadAdminData,
        invalidateMap: invalidateAdminMap,
        handleStatusChange: handleStatusChange,
        zoomToCase: zoomToCase
    };
})();
