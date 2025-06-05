<?php
/*
Get late records statistics by gender
GET /api/reports/late_by_gender.php?year_id=1&start_date=2024-01-01&end_date=2024-01-31
Return gender-wise late statistics

Parameters:
- year_id: Academic year ID (integer, required)
- start_date: Date in YYYY-MM-DD format (e.g., 2025-05-06, optional)
- end_date: Date in YYYY-MM-DD format (e.g., 2025-05-06, optional)
Note: If start_date and end_date are provided, both must be specified
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
    $year_id = isset($_GET['year_id']) ? (int)$_GET['year_id'] : 1;
    $start_date = isset($_GET['start_date']) ? $_GET['start_date'] : '';
    $end_date = isset($_GET['end_date']) ? $_GET['end_date'] : '';
    
    if ($year_id <= 0) {
        echo json_encode(['status' => 'fail', 'message' => 'year_id must be a positive integer']);
        exit;
    }
    
    // Validate date format if provided
    if (!empty($start_date) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid start_date format, expected YYYY-MM-DD']);
        exit;
    }
    
    if (!empty($end_date) && !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid end_date format, expected YYYY-MM-DD']);
        exit;
    }
    
    // Validate that dates are actually valid if provided
    if (!empty($start_date) && !DateTime::createFromFormat('Y-m-d', $start_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid start_date value provided']);
        exit;
    }
    
    if (!empty($end_date) && !DateTime::createFromFormat('Y-m-d', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid end_date value provided']);
        exit;
    }
    
    // If both dates are provided, ensure start_date is not after end_date
    if (!empty($start_date) && !empty($end_date) && strtotime($start_date) > strtotime($end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'start_date cannot be after end_date']);
        exit;
    }
    
    // If only one date is provided, require both
    if ((!empty($start_date) && empty($end_date)) || (empty($start_date) && !empty($end_date))) {
        echo json_encode(['status' => 'fail', 'message' => 'Both start_date and end_date must be provided together, or omit both for all records']);
        exit;
    }
    
    // Include database configuration
    require_once '../config.php';
    
    // Build query based on whether date range is provided
    $query = "
        SELECT 
            l.gender,
            COUNT(*) as count
        FROM late_log ll
        INNER JOIN learners l ON ll.learner_id = l.id
        WHERE ll.academic_year_id = :year_id
    ";
    
    $params = [':year_id' => $year_id];
    
    // Add date range filter if provided
    if (!empty($start_date) && !empty($end_date)) {
        $query .= " AND DATE(ll.late_date) BETWEEN :start_date AND :end_date";
        $params[':start_date'] = $start_date;
        $params[':end_date'] = $end_date;
    }
    
    $query .= " GROUP BY l.gender ORDER BY l.gender ASC";
    
    $stmt = $pdo->prepare($query);
    
    foreach ($params as $param => $value) {
        if ($param === ':year_id') {
            $stmt->bindValue($param, $value, PDO::PARAM_INT);
        } else {
            $stmt->bindValue($param, $value);
        }
    }
    
    $stmt->execute();
    $stats = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate total for percentages
    $total = array_sum(array_column($stats, 'count'));
    
    // Add percentage to each stat
    $result = [];
    foreach ($stats as $stat) {
        $result[] = [
            'gender' => $stat['gender'],
            'count' => (int)$stat['count'],
            'percentage' => $total > 0 ? round(($stat['count'] / $total) * 100, 1) : 0
        ];
    }
    
    echo json_encode([
        'status' => 'success',
        'stats' => $result,
        'year_id' => $year_id,
        'total_count' => $total,
        'start_date' => $start_date,
        'end_date' => $end_date,
        'count' => count($result)
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("Late by gender error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Server error']);
}
?>