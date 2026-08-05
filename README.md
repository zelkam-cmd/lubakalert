# LubakAlert: Crowdsourced Road Hazard Mapping & Government Reporting System

**LubakAlert** is a crowdsourced road hazard mapping system designed for drivers and government engineering offices (e.g., DPWH - Department of Public Works and Highways). It allows drivers to quickly report road hazards on the move, automatically triages reports using a 20-meter proximity clustering algorithm, escalates high-impact hazards to "Critical" status when report counts hit 50, and equips government engineers with an interactive dashboard to dispatch work orders and update repair statuses.

---

## 📁 Project Architecture

```
lubakalert/
├── backend/
│   ├── schema.sql              # 3NF Relational Database Schema (Users, Cases, Reports)
│   ├── config.php              # PDO Database Connection & Haversine Distance Helper
│   ├── report_api.php          # Requirement 2: Triage & 20m Radius Escalation API
│   └── admin_api.php           # Requirement 4: DPWH Admin Dashboard API & Status Updater
├── css/
│   └── styles.css              # Core Cyber-Dark / Glassmorphism Design Tokens & Layouts
├── js/
│   ├── mock_backend.js         # Client-Side Fallback Engine (Dual Mode: Live PHP + Static Demo)
│   ├── driver.js               # Requirement 3: Mobile Driver Map & Quick Report Controller
│   └── admin.js                # Requirement 4: DPWH Engineering Dashboard Controller & CSV Export
├── index.html                  # Single-Page Web Launcher (Driver View + Admin Dashboard)
└── README.md                   # System Documentation
```

---

## 🗄️ 1. Database Architecture (3NF Relational SQL)

Located at `backend/schema.sql`.

### Relational Tables
1. **`users`**: Stores driver identity and device user-agent metadata.
   - Columns: `id` (PK), `name`, `device_info`, `created_at`
2. **`cases`**: Represents a unique physical road hazard centroid cluster.
   - Columns: `id` (PK), `center_latitude`, `center_longitude`, `total_reports`, `severity_level` (`Low`, `Moderate`, `Critical`), `status` (`Pending`, `In Progress`, `Resolved`), `created_at`, `updated_at`
3. **`reports`**: Stores individual crowdsourced reports sent by drivers.
   - Columns: `id` (PK), `case_id` (FK -> `cases.id`), `user_id` (FK -> `users.id`), `latitude`, `longitude`, `timestamp`
   - **Enforces 1-to-Many Relationship**: One `Case` contains many `Reports`.

---

## ⚡ 2. Triage & Escalation Logic (PHP Backend)

Located at `backend/report_api.php`.

### How it Works:
1. Accepts GPS coordinates (`latitude`, `longitude`) via POST request.
2. Executes a Haversine Great Circle query to calculate distance in meters from active cases:
   $$\text{Distance} = 6371000 \times 2 \times \arcsin\left(\sqrt{\sin^2\left(\frac{\Delta \phi}{2}\right) + \cos(\phi_1)\cos(\phi_2)\sin^2\left(\frac{\Delta \lambda}{2}\right)}\right)$$
3. **If Distance $\le$ 20.0 meters**:
   - Links the report to the existing case (`case_id`).
   - Increments `total_reports` count by +1.
   - **Automatic Escalation**: If `total_reports` $\ge$ 50, updates `severity_level` to **"Critical"**.
4. **If Distance $>$ 20.0 meters**:
   - Creates a new record in `cases` (`total_reports = 1`, `severity_level = 'Low'`, `status = 'Pending'`).
   - Inserts new report linked to the new Case ID.

---

## 🚘 3. Driver Mobile UI

Located at `index.html` (Driver View) and `js/driver.js`.

- Distraction-free dark mode map view powered by Leaflet.js.
- **Visual Caution Zones**: Pulsing color-coded geographic circles:
  - 🔴 **Red**: Critical Cases ($\ge$ 50 reports)
  - 🟠 **Orange**: Moderate Cases (10–49 reports)
  - 🟡 **Yellow**: Low / Initial Cases ($<$ 10 reports)
- **Huge "QUICK REPORT HAZARD" Button**: High-accessibility 84px+ touch target with audible audio tone and visual flash feedback for safe one-tap reporting while driving.
- Includes built-in driving simulation and rapid 50-report escalation test triggers.

---

## 🏛️ 4. DPWH Admin Dashboard

Located at `index.html` (Admin View) and `js/admin.js`.

- High-level metric summary cards (Total Cases, Critical Cases, Pending, In Progress, Resolved).
- **Critical Cases & Work Queue Data Table**: Displays Case ID, GPS Coordinates, Total Reports, Severity Badge, and Status Modifier dropdown.
- **Interactive Status Modifier**: Change status between `Pending`, `In Progress`, and `Resolved` with immediate write-back to database and live map update.
- **Export Work Orders**: One-click export to CSV format (`DPWH_LubakAlert_WorkOrders.csv`).

---

## 🚀 How to Run the Prototype

### Option A: Immediate Web Browser Preview (Zero Setup)
Simply open `index.html` in any web browser. The application automatically detects that live PHP is not attached and initializes the **integrated JS Mock Engine** (`js/mock_backend.js`) which runs the exact 20m Haversine algorithm and 50-report critical escalation in-memory.

### Option B: Running with PHP & MySQL Server
1. Start your local MySQL / MariaDB server (e.g., XAMPP, WAMP, or standalone MySQL).
2. Import `backend/schema.sql` into MySQL:
   ```bash
   mysql -u root -p < backend/schema.sql
   ```
3. Start local PHP development server in the project directory:
   ```bash
   php -S 127.0.0.1:8000
   ```
4. Open `http://127.0.0.1:8000/index.html`. The app will automatically connect to `backend/report_api.php` and `backend/admin_api.php`!
