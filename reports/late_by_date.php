<?php
/*
Get late records statistics by date range
GET /api/reports/late_by_date.php?start_date=2024-01-01&end_date=2024-01-31&year_id=1
Return daily statistics for the specified date range

Parameters:
- start_date: Date in YYYY-MM-DD format (e.g., 2025-05-06)
- end_date: Date in YYYY-MM-DD format (e.g., 2025-05-06)
- year_id: Academic year ID (integer)
*/

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');

// Handle preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// Only allow GET requests
if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    http_response_code(405);
    echo json_encode(['status' => 'fail', 'message' => 'Method not allowed']);
    exit;
}

try {
    // Get parameters
    $start_date = isset($_GET['start_date']) ? $_GET['start_date'] : '';
    $end_date = isset($_GET['end_date']) ? $_GET['end_date'] : '';
    $year_id = isset($_GET['year_id']) ? (int)$_GET['year_id'] : 1;
    
    // Validate parameters
    if (empty($start_date) || empty($end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'start_date and end_date parameters are required']);
        exit;
    }
    
    if ($year_id <= 0) {
        echo json_encode(['status' => 'fail', 'message' => 'year_id must be a positive integer']);
        exit;
    }
      // Validate date format (YYYY-MM-DD) and ensure dates are valid
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid date format, expected YYYY-MM-DD']);
        exit;
    }
    
    // Validate that the dates are actually valid dates
    if (!DateTime::createFromFormat('Y-m-d', $start_date) || !DateTime::createFromFormat('Y-m-d', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid date values provided']);
        exit;
    }
    
    // Ensure start_date is not after end_date
    if (strtotime($start_date) > strtotime($end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'start_date cannot be after end_date']);
        exit;
    }
    
    // Include database configuration
    require_once '../config.php';
    
    // Query to get late records count by date within the range
    $stmt = $pdo->prepare("
        SELECT 
            DATE(ll.late_date) as date,
            COUNT(*) as count
        FROM late_log ll
        WHERE ll.academic_year_id = :year_id
        AND DATE(ll.late_date) BETWEEN :start_date AND :end_date
        GROUP BY DATE(ll.late_date)
        ORDER BY DATE(ll.late_date) ASC
    ");
    
    $stmt->bindParam(':year_id', $year_id, PDO::PARAM_INT);
    $stmt->bindParam(':start_date', $start_date);
    $stmt->bindParam(':end_date', $end_date);
    $stmt->execute();
    
    $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Fill in missing dates with zero count
    $result = [];
    $current_date = new DateTime($start_date);
    $end_date_obj = new DateTime($end_date);
    
    // Create array indexed by date for quick lookup
    $stats_by_date = [];
    foreach ($stats as $stat) {
        $stats_by_date[$stat['date']] = (int)$stat['count'];
    }
    
    // Fill in all dates in range
    while ($current_date <= $end_date_obj) {
        $date_str = $current_date->format('Y-m-d');
        $result[] = [
            'date' => $date_str,
            'count' => isset($stats_by_date[$date_str]) ? $stats_by_date[$date_str] : 0
        ];
        $current_date->add(new DateInterval('P1D'));
    }
    
    echo json_encode([
        'status' => 'success',
        'stats' => $result,
        'start_date' => $start_date,
        'end_date' => $end_date,
        'year_id' => $year_id,
        'count' => count($result)
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("Late by date error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Server error']);
}
?>
