<?php
/**
 * LubakAlert - DPWH Engineering Admin Dashboard API
 * -------------------------------------------------------------
 * Requirements:
 * - Fetches cases (Critical & all severity levels) with coordinate details.
 * - Handles case status updates (Pending, In Progress, Resolved).
 * - Provides stats/metrics summary for government administrative overview.
 */

require_once __DIR__ . '/config.php';

$method = $_SERVER['REQUEST_METHOD'];
$db = getDBConnection();

// GET REQUEST: Fetch cases and metrics
if ($method === 'GET') {
    try {
        $filter = isset($_GET['filter']) ? trim($_GET['filter']) : 'all'; // 'all', 'critical', 'pending', etc.

        $whereClause = "1=1";
        if ($filter === 'critical') {
            $whereClause = "severity_level = 'Critical'";
        } elseif ($filter === 'pending') {
            $whereClause = "status = 'Pending'";
        } elseif ($filter === 'in_progress') {
            $whereClause = "status = 'In Progress'";
        } elseif ($filter === 'resolved') {
            $whereClause = "status = 'Resolved'";
        }

        // Fetch Cases with details
        $casesStmt = $db->query("
            SELECT id, center_latitude, center_longitude, total_reports, severity_level, status, created_at, updated_at
            FROM cases
            WHERE {$whereClause}
            ORDER BY 
                CASE severity_level 
                    WHEN 'Critical' THEN 1 
                    WHEN 'Moderate' THEN 2 
                    ELSE 3 
                END, 
                total_reports DESC, 
                created_at DESC
        ");
        $cases = $casesStmt->fetchAll();

        // Compute summary metrics
        $metricsStmt = $db->query("
            SELECT 
                COUNT(*) AS total_cases,
                SUM(CASE WHEN severity_level = 'Critical' THEN 1 ELSE 0 END) AS critical_cases,
                SUM(CASE WHEN status = 'Pending' THEN 1 ELSE 0 END) AS pending_cases,
                SUM(CASE WHEN status = 'In Progress' THEN 1 ELSE 0 END) AS in_progress_cases,
                SUM(CASE WHEN status = 'Resolved' THEN 1 ELSE 0 END) AS resolved_cases,
                SUM(total_reports) AS total_individual_reports
            FROM cases
        ");
        $metrics = $metricsStmt->fetch();

        echo json_encode([
            'success' => true,
            'metrics' => $metrics,
            'cases' => $cases
        ]);
        exit();

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

// POST/PUT REQUEST: Update Case Status
if ($method === 'POST' || $method === 'PUT') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        if (!$input) {
            $input = $_POST;
        }

        $caseId = isset($input['case_id']) ? intval($input['case_id']) : null;
        $newStatus = isset($input['status']) ? trim($input['status']) : null;

        $validStatuses = ['Pending', 'In Progress', 'Resolved'];

        if (!$caseId || !in_array($newStatus, $validStatuses, true)) {
            http_response_code(400);
            echo json_encode([
                'success' => false,
                'error' => 'Invalid parameters. Valid case_id and status (Pending, In Progress, Resolved) are required.'
            ]);
            exit();
        }

        $updateStmt = $db->prepare("
            UPDATE cases
            SET status = :status, updated_at = NOW()
            WHERE id = :id
        ");
        $updateStmt->execute([
            ':status' => $newStatus,
            ':id' => $caseId
        ]);

        echo json_encode([
            'success' => true,
            'message' => "Case #{$caseId} status updated to '{$newStatus}' successfully.",
            'data' => [
                'case_id' => $caseId,
                'status' => $newStatus
            ]
        ]);
        exit();

    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => $e->getMessage()]);
        exit();
    }
}

// Fallback for unsupported methods
http_response_code(405);
echo json_encode(['success' => false, 'error' => 'Method Not Allowed']);
