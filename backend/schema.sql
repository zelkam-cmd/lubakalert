-- ============================================================
-- LubakAlert: Crowdsourced Road Hazard Mapping & Government Reporting System
-- Database Schema (3NF Normalized Relational Design)
-- Region Focus: Bulacan Province (San Miguel, Malolos, Guiguinto, MacArthur Highway)
-- Realistic Real-World Datasets: Pipe Laying Construction, One-Lane Bottlenecks & Potholes
-- ============================================================

CREATE DATABASE IF NOT EXISTS `lubakalert` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `lubakalert`;

-- 1. USERS TABLE
CREATE TABLE IF NOT EXISTS `users` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `name` VARCHAR(100) NOT NULL DEFAULT 'Anonymous Driver',
    `device_info` VARCHAR(255) NULL COMMENT 'Browser User-Agent or Device Identifier',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. CASES TABLE
CREATE TABLE IF NOT EXISTS `cases` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `center_latitude` DECIMAL(10, 8) NOT NULL,
    `center_longitude` DECIMAL(11, 8) NOT NULL,
    `total_reports` INT NOT NULL DEFAULT 1 COMMENT 'Crowdsourced reports & telematics pings',
    `severity_level` ENUM('Low', 'Moderate', 'Critical') NOT NULL DEFAULT 'Low',
    `detection_type` ENUM('Manual Report', 'Telemetry Speed Drop', 'Hybrid') NOT NULL DEFAULT 'Manual Report',
    `avg_speed_drop_kmh` DECIMAL(4, 1) NULL COMMENT 'Average speed drop detected by telematics',
    `status` ENUM('Pending', 'In Progress', 'Resolved') NOT NULL DEFAULT 'Pending',
    `address` VARCHAR(255) NULL COMMENT 'Landmark address & hazard notes',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX `idx_geo_coords` (`center_latitude`, `center_longitude`),
    INDEX `idx_severity_status` (`severity_level`, `status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. REPORTS TABLE
CREATE TABLE IF NOT EXISTS `reports` (
    `id` INT AUTO_INCREMENT PRIMARY KEY,
    `case_id` INT NOT NULL,
    `user_id` INT NOT NULL,
    `latitude` DECIMAL(10, 8) NOT NULL,
    `longitude` DECIMAL(11, 8) NOT NULL,
    `report_type` ENUM('Manual_Button', 'Telematics_Slowdown_Ping') NOT NULL DEFAULT 'Manual_Button',
    `vehicle_speed_kmh` DECIMAL(4, 1) NULL,
    `timestamp` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT `fk_reports_cases` FOREIGN KEY (`case_id`) REFERENCES `cases` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `fk_reports_users` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    INDEX `idx_case_id` (`case_id`),
    INDEX `idx_timestamp` (`timestamp`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- REAL-WORLD BULACAN HAZARD SEED DATA (Pipe Repair Bottlenecks, Potholes & Telematics Pings)
INSERT INTO `users` (`id`, `name`, `device_info`) VALUES
(1, 'BulSU Commuter #1042', 'Mobile Telematics Active'),
(2, 'Guiguinto Jeepney Driver #8821', 'Mobile Telematics Active'),
(3, 'DPWH Bulacan Patrol Alpha', 'Fleet Unit');

INSERT INTO `cases` (`id`, `center_latitude`, `center_longitude`, `total_reports`, `severity_level`, `detection_type`, `avg_speed_drop_kmh`, `status`, `address`, `created_at`) VALUES
-- Guiguinto & Malolos Pipe Repair Bottlenecks
(1, 14.83600000, 120.84400000, 142, 'Critical', 'Hybrid', 46.5, 'Pending', 'MacArthur Hwy (Tabang Spur, Guiguinto) - Pipe Laying & Single Lane Bottleneck', NOW() - INTERVAL 5 DAY),
(2, 14.84250000, 120.82900000, 118, 'Critical', 'Hybrid', 44.0, 'Pending', 'MacArthur Hwy (Tikay, Malolos) - Water Pipe Trench & Unpaved Steel Plates', NOW() - INTERVAL 4 DAY),
(3, 14.82750000, 120.85250000, 135, 'Critical', 'Telemetry Speed Drop', 42.0, 'In Progress', 'MacArthur Hwy (Guiguinto Poblacion) - Pipe Repair Digging & Asphalt Drop', NOW() - INTERVAL 3 DAY),
(4, 14.84850000, 120.82100000, 86, 'Critical', 'Hybrid', 38.5, 'Pending', 'MacArthur Hwy (Sumapang Matanda, Malolos) - Single Lane Construction & Deep Potholes', NOW() - INTERVAL 2 DAY),

-- Additional MacArthur Highway Hazard Hotspots
(5, 14.85840000, 120.81620000, 46, 'Moderate', 'Manual Report', 20.0, 'Pending', 'MacArthur Hwy (BulSU Gate 1, Malolos) - Asphalt Cracks & Road Depression', NOW() - INTERVAL 6 DAY),
(6, 14.81500000, 120.86800000, 58, 'Critical', 'Hybrid', 36.0, 'Pending', 'MacArthur Hwy (Borol 1st, Balagtas) - Deep Potholes & Culvert Digging', NOW() - INTERVAL 4 DAY),
(7, 14.81000000, 120.87800000, 42, 'Moderate', 'Manual Report', 24.0, 'In Progress', 'MacArthur Hwy (Balagtas Town Center) - Unpaved Patch & Traffic Slowdown', NOW() - INTERVAL 3 DAY),
(8, 14.79600000, 120.92600000, 165, 'Critical', 'Telemetry Speed Drop', 48.0, 'Pending', 'MacArthur Hwy (Bocaue River Bridge) - Severe Bridge Approach Pothole Trench', NOW() - INTERVAL 7 DAY),
(9, 14.78200000, 120.94000000, 94, 'Critical', 'Hybrid', 41.5, 'Pending', 'MacArthur Hwy (Lolomboy, Bocaue) - Flooded Asphalt Potholes', NOW() - INTERVAL 5 DAY),
(10, 14.75500000, 120.95800000, 194, 'Critical', 'Hybrid', 47.2, 'Pending', 'MacArthur Hwy (SM City Marilao / Abangan Sur) - Severe Waterlogged Pothole Cluster', NOW() - INTERVAL 8 DAY),
(11, 14.74300000, 120.95800000, 72, 'Critical', 'Telemetry Speed Drop', 39.0, 'In Progress', 'MacArthur Hwy (Saluysoy, Meycauayan) - Drainage Excavation & Edge Drop', NOW() - INTERVAL 2 DAY),
(12, 14.73500000, 120.95750000, 87, 'Critical', 'Hybrid', 43.0, 'Pending', 'MacArthur Hwy (Malhacan Rd, Meycauayan) - Deep Junction Potholes', NOW() - INTERVAL 4 DAY);
