<?php
/*
Get late records trends and patterns
GET /api/reports/late_trends.php?year_id=1&start_date=2024-01-01&end_date=2024-01-31&group_by=week
Return trend analysis for late arrivals

Parameters:
- year_id: Academic year ID (integer, required)
- start_date: Date in YYYY-MM-DD format (e.g., 2025-05-06, required)
- end_date: Date in YYYY-MM-DD format (e.g., 2025-05-06, required)
- group_by: Grouping period: 'day', 'week', 'month' (optional, default: 'week')
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
    $group_by = isset($_GET['group_by']) ? $_GET['group_by'] : 'week';
    
    // Validate year_id
    if ($year_id <= 0) {
        echo json_encode(['status' => 'fail', 'message' => 'year_id must be a positive integer']);
        exit;
    }
    
    // Validate required date parameters
    if (empty($start_date) || empty($end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'start_date and end_date parameters are required']);
        exit;
    }
    
    // Validate date format
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start_date) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid date format, expected YYYY-MM-DD']);
        exit;
    }
    
    // Validate that dates are actually valid
    if (!DateTime::createFromFormat('Y-m-d', $start_date) || !DateTime::createFromFormat('Y-m-d', $end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'Invalid date values provided']);
        exit;
    }
    
    // Ensure start_date is not after end_date
    if (strtotime($start_date) > strtotime($end_date)) {
        echo json_encode(['status' => 'fail', 'message' => 'start_date cannot be after end_date']);
        exit;
    }
    
    // Validate group_by parameter
    $allowed_grouping = ['day', 'week', 'month'];
    if (!in_array($group_by, $allowed_grouping)) {
        echo json_encode(['status' => 'fail', 'message' => 'group_by must be one of: day, week, month']);
        exit;
    }
    
    // Include database configuration
    require_once '../config.php';
    
    // Build query based on grouping
    $date_format = '';
    $date_group = '';
    
    switch ($group_by) {
        case 'day':
            $date_format = '%Y-%m-%d';
            $date_group = 'DATE(ll.late_date)';
            break;
        case 'week':
            $date_format = '%Y-W%u';
            $date_group = 'YEAR(ll.late_date), WEEK(ll.late_date, 1)';
            break;
        case 'month':
            $date_format = '%Y-%m';
            $date_group = 'YEAR(ll.late_date), MONTH(ll.late_date)';
            break;
    }
    
    $query = "
        SELECT 
            DATE_FORMAT(ll.late_date, ?) as period,
            COUNT(*) as count,
            COUNT(DISTINCT ll.learner_id) as unique_learners,
            MIN(DATE(ll.late_date)) as period_start,
            MAX(DATE(ll.late_date)) as period_end
        FROM late_log ll
        WHERE ll.academic_year_id = ?
        AND DATE(ll.late_date) BETWEEN ? AND ?
        GROUP BY $date_group
        ORDER BY period_start ASC
    ";
    
    $stmt = $pdo->prepare($query);
    $stmt->bindValue(1, $date_format, PDO::PARAM_STR);
    $stmt->bindValue(2, $year_id, PDO::PARAM_INT);
    $stmt->bindValue(3, $start_date, PDO::PARAM_STR);
    $stmt->bindValue(4, $end_date, PDO::PARAM_STR);
    $stmt->execute();
    
    $trends = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate additional statistics
    $total_records = array_sum(array_column($trends, 'count'));
    $total_unique_learners = 0;
    $avg_per_period = 0;
    $peak_period = null;
    $lowest_period = null;
    $max_count = 0;
    $min_count = PHP_INT_MAX;
    
    if (!empty($trends)) {
        // Calculate averages and find peaks
        $avg_per_period = round($total_records / count($trends), 1);
        
        foreach ($trends as $trend) {
            $count = (int)$trend['count'];
            if ($count > $max_count) {
                $max_count = $count;
                $peak_period = $trend;
            }
            if ($count < $min_count) {
                $min_count = $count;
                $lowest_period = $trend;
            }
        }
        
        // Get total unique learners across all periods
        $unique_query = "
            SELECT COUNT(DISTINCT ll.learner_id) as total_unique
            FROM late_log ll
            WHERE ll.academic_year_id = ?
            AND DATE(ll.late_date) BETWEEN ? AND ?
        ";
        $unique_stmt = $pdo->prepare($unique_query);
        $unique_stmt->bindValue(1, $year_id, PDO::PARAM_INT);
        $unique_stmt->bindValue(2, $start_date, PDO::PARAM_STR);
        $unique_stmt->bindValue(3, $end_date, PDO::PARAM_STR);
        $unique_stmt->execute();
        $unique_result = $unique_stmt->fetch(PDO::FETCH_ASSOC);
        $total_unique_learners = (int)$unique_result['total_unique'];
    }
    
    // Format results
    $result = [];
    foreach ($trends as $trend) {
        $result[] = [
            'period' => $trend['period'],
            'period_start' => $trend['period_start'],
            'period_end' => $trend['period_end'],
            'count' => (int)$trend['count'],
            'unique_learners' => (int)$trend['unique_learners'],
            'percentage_of_total' => $total_records > 0 ? round(($trend['count'] / $total_records) * 100, 1) : 0
        ];
    }
    
    echo json_encode([
        'status' => 'success',
        'trends' => $result,
        'summary' => [
            'year_id' => $year_id,
            'start_date' => $start_date,
            'end_date' => $end_date,
            'group_by' => $group_by,
            'total_periods' => count($trends),
            'total_late_records' => $total_records,
            'total_unique_learners' => $total_unique_learners,
            'average_per_period' => $avg_per_period,
            'peak_period' => $peak_period ? [
                'period' => $peak_period['period'],
                'count' => (int)$peak_period['count'],
                'date_range' => $peak_period['period_start'] . ' to ' . $peak_period['period_end']
            ] : null,
            'lowest_period' => $lowest_period ? [
                'period' => $lowest_period['period'],
                'count' => (int)$lowest_period['count'],
                'date_range' => $lowest_period['period_start'] . ' to ' . $lowest_period['period_end']
            ] : null
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Database error']);
} catch (Exception $e) {
    error_log("Late trends error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Server error']);
}
?>