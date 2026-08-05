<?php
/**
 * LubakAlert - Hazard Report Triage & Escalation API
 * -------------------------------------------------------------
 * Requirement 2:
 * - Accepts GPS coordinates from the frontend.
 * - Checks if an existing 'Case' is within a 20-meter radius.
 * - If YES, increments report count for that case. If NO, creates a new case.
 * - Automatically updates 'severity_level' to "Critical" once a case hits 50 reports.
 */

require_once __DIR__ . '/config.php';

// Ensure POST request
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['success' => false, 'error' => 'Method Not Allowed. Use POST.']);
    exit();
}

// Read raw JSON input or POST form data
$inputData = json_decode(file_get_contents('php://input'), true);
if (!$inputData) {
    $inputData = $_POST;
}

$latitude  = isset($inputData['latitude']) ? floatval($inputData['latitude']) : null;
$longitude = isset($inputData['longitude']) ? floatval($inputData['longitude']) : null;
$userId    = isset($inputData['user_id']) ? intval($inputData['user_id']) : 1; // Default to user 1
$deviceInfo = isset($inputData['device_info']) ? trim($inputData['device_info']) : $_SERVER['HTTP_USER_AGENT'];

// Validate coordinates
if (is_null($latitude) || is_null($longitude) || $latitude < -90 || $latitude > 90 || $longitude < -180 || $longitude > 180) {
    http_response_code(400);
    echo json_encode([
        'success' => false,
        'error' => 'Invalid or missing GPS coordinates (latitude, longitude required).'
    ]);
    exit();
}

$db = getDBConnection();

try {
    $db->beginTransaction();

    // 1. Fetch active cases (Pending or In Progress) to check distance within 20m
    // Haversine query in SQL for efficient distance check
    $haversineSql = "
        SELECT id, center_latitude, center_longitude, total_reports, severity_level, status,
        ( 6371000 * acos( cos( radians(:lat1) ) * cos( radians( center_latitude ) ) 
        * cos( radians( center_longitude ) - radians(:lon1) ) + sin( radians(:lat2) ) 
        * sin( radians( center_latitude ) ) ) ) AS distance_meters
        FROM cases
        WHERE status != 'Resolved'
        HAVING distance_meters <= :max_radius
        ORDER BY distance_meters ASC
        LIMIT 1
    ";

    $stmt = $db->prepare($haversineSql);
    $stmt->bindValue(':lat1', $latitude);
    $stmt->bindValue(':lon1', $longitude);
    $stmt->bindValue(':lat2', $latitude);
    $stmt->bindValue(':max_radius', CLUSTER_RADIUS_METERS);
    $stmt->execute();

    $existingCase = $stmt->fetch();

    $matchedCaseId = null;
    $isNewCase = false;
    $totalReports = 1;
    $newSeverity = 'Low';
    $distanceMeters = 0.0;

    if ($existingCase) {
        // =========================================================================
        // CASE MATCHED (Within 20-meter radius) -> Increment report count
        // =========================================================================
        $matchedCaseId = (int)$existingCase['id'];
        $totalReports  = (int)$existingCase['total_reports'] + 1;
        $distanceMeters = floatval($existingCase['distance_meters']);

        // Determine severity level based on report count threshold
        if ($totalReports >= CRITICAL_SEVERITY_THRESHOLD) {
            $newSeverity = 'Critical';
        } elseif ($totalReports >= 10) {
            $newSeverity = 'Moderate';
        } else {
            $newSeverity = $existingCase['severity_level'];
        }

        // Update Case row in DB
        $updateStmt = $db->prepare("
            UPDATE cases 
            SET total_reports = :total_reports, 
                severity_level = :severity_level, 
                updated_at = NOW() 
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':total_reports' => $totalReports,
            ':severity_level' => $newSeverity,
            ':id' => $matchedCaseId
        ]);

    } else {
        // =========================================================================
        // NO MATCH FOUND -> Create a brand new Case
        // =========================================================================
        $isNewCase = true;
        $newSeverity = 'Low';
        $totalReports = 1;

        $insertCaseStmt = $db->prepare("
            INSERT INTO cases (center_latitude, center_longitude, total_reports, severity_level, status)
            VALUES (:lat, :lon, 1, 'Low', 'Pending')
        ");
        $insertCaseStmt->execute([
            ':lat' => $latitude,
            ':lon' => $longitude
        ]);

        $matchedCaseId = (int)$db->lastInsertId();
    }

    // 2. Insert individual Report record (linked via 1-to-many relationship)
    $insertReportStmt = $db->prepare("
        INSERT INTO reports (case_id, user_id, latitude, longitude, timestamp)
        VALUES (:case_id, :user_id, :latitude, :longitude, NOW())
    ");
    $insertReportStmt->execute([
        ':case_id' => $matchedCaseId,
        ':user_id' => $userId,
        ':latitude' => $latitude,
        ':longitude' => $longitude
    ]);

    $reportId = (int)$db->lastInsertId();

    $db->commit();

    // Return success payload to frontend client
    echo json_encode([
        'success' => true,
        'message' => $isNewCase ? 'New hazard case initialized.' : 'Hazard report attached to existing nearby case.',
        'data' => [
            'report_id' => $reportId,
            'case_id' => $matchedCaseId,
            'is_new_case' => $isNewCase,
            'total_reports' => $totalReports,
            'severity_level' => $newSeverity,
            'distance_to_center_meters' => round($distanceMeters, 2),
            'cluster_radius_threshold' => CLUSTER_RADIUS_METERS,
            'auto_escalated' => ($totalReports >= CRITICAL_SEVERITY_THRESHOLD)
        ]
    ]);

} catch (Exception $e) {
    if ($db->inTransaction()) {
        $db->rollBack();
    }
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'error' => 'Server error processing hazard report: ' . $e->getMessage()
    ]);
}
