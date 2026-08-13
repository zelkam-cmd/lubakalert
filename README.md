# LubakAlert: Crowdsourced Road Hazard Mapping & DPWH Government Telematics System

**LubakAlert** is a crowdsourced road hazard mapping and government escalation system built for drivers and Department of Public Works and Highways (DPWH) engineering offices. It features real-time 400m early hazard proximity warnings, telematics vehicle speed drop detection, 20-meter Haversine report clustering, automatic 50-report critical escalation, and an interactive DPWH work order dispatch console.

---

## 📁 Project Structure

```
lubakalert/
├── backend/
│   ├── schema.sql              # 3NF Relational Database Schema & Bulacan Seed Data
│   ├── config.php              # PDO Database Connection (XAMPP MySQL/MariaDB) & Haversine Distance
│   ├── report_api.php          # Triage, 20m Radius Clustering & 50-Ping Escalation API
│   └── admin_api.php           # DPWH Admin Dashboard API & Status Update Handler
├── css/
│   └── styles.css              # Cyber-Dark & Glassmorphism UI Styles
├── js/
│   ├── road_data.js            # High-Res Mapbox API Road Geometry Dataset (MacArthur & NLEX)
│   ├── mock_backend.js         # Client-Side Fallback Engine (Runs browser preview offline)
│   ├── driver.js               # Mobile Driver Navigation, 400m Early Warning & Telematics Engine
│   └── admin.js                # DPWH Admin Dashboard, Work Order Data Table & CSV Exporter
├── index.html                  # Main Web App Launcher (Driver View + Admin Dashboard)
└── README.md                   # System Setup Guide & XAMPP Instructions
```

---

## 🚀 Deployment Guide using XAMPP

Follow these step-by-step instructions to run LubakAlert with XAMPP on Windows:

### Step 1: Start XAMPP Server Modules
1. Open **XAMPP Control Panel**.
2. Click **Start** for both **Apache** and **MySQL** modules until both indicators turn green.

### Step 2: Copy Project to XAMPP `htdocs`
Copy the `lubakalert` project directory into your XAMPP `htdocs` folder:
`C:\xampp\htdocs\lubakalert\`

### Step 3: Import Database Schema via phpMyAdmin
1. Open your web browser and navigate to:
   `http://localhost/phpmyadmin/`
2. Click **New** in the left sidebar to create a database named:
   `lubakalert` (Collation: `utf8mb4_unicode_ci`).
3. Click on the `lubakalert` database, navigate to the **Import** tab at the top.
4. Choose the `C:\xampp\htdocs\lubakalert\backend\schema.sql` file and click **Import** (or paste the contents into the **SQL** tab).

### Step 4: Open LubakAlert in Browser
Navigate to:
`http://localhost/lubakalert/index.html`

The top-right badge will display **`LIVE PHP API CONNECTED`**, indicating full connectivity to `backend/report_api.php` and `backend/admin_api.php`!

---

## 💻 Standalone Browser Preview Mode (No XAMPP Required)

If you just want to preview the interface without XAMPP:
Simply double-click or open `index.html` directly in any web browser. LubakAlert automatically detects that a live PHP server is not attached and initializes the **integrated client-side engine** (`js/mock_backend.js`), running the 20m Haversine algorithm and 50-report critical escalation in-memory!

---

## 🗄️ Database Architecture (3NF SQL)

Located at `backend/schema.sql`.

- **`users`**: `id` (PK), `name`, `device_info`, `created_at`
- **`cases`**: `id` (PK), `center_latitude`, `center_longitude`, `total_reports`, `severity_level` (`Low`, `Moderate`, `Critical`), `detection_type` (`Manual Report`, `Telemetry Speed Drop`, `Hybrid`), `avg_speed_drop_kmh`, `status` (`Pending`, `In Progress`, `Resolved`), `address`
- **`reports`**: `id` (PK), `case_id` (FK -> `cases.id`), `user_id` (FK -> `users.id`), `latitude`, `longitude`, `report_type` (`Manual_Button`, `Telematics_Slowdown_Ping`), `vehicle_speed_kmh`, `timestamp`
- **1-to-Many Relationship**: One `Case` contains many `Reports`.

---

## ⚡ Key Application Features

1. **400m Early Hazard Warning Alerts**:
   Audio chimes, text-to-speech voice alerts, and HUD top banners notify drivers 400 meters before entering hazard circles (e.g. single-lane pipe construction in Guiguinto and Malolos).

2. **Automated Telematics Speed Drop Detection**:
   When vehicles slow down to <18 km/h over a pothole zone, the system auto-registers a telematics traffic ping (`Telematics_Slowdown_Ping`).

3. **Interactive Route Planner & Mapbox API Integration**:
   Choose custom Origin & Destination points in Bulacan, or toggle between **MacArthur Highway** and **NLEX Expressway**. Powered by the **Mapbox Directions API** for flawless, high-resolution road geometry tracing that perfectly matches true GPS driving routes.

4. **DPWH Admin Dashboard & CSV Work Order Exporter**:
   Filter critical cases, modify repair statuses (`Pending`, `In Progress`, `Resolved`), and export official work order CSV files (`DPWH_Bulacan_WorkOrders.csv`).
