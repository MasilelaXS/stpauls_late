<?php
/*
Get comprehensive overall late records statistics
GET /api/reports/overall_stats.php?year_id=1&start_date=2024-01-01&end_date=2024-01-31
Return comprehensive dashboard statistics for late arrivals

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
    
    // Build base conditions
    $date_condition = '';
    $params = [':year_id' => $year_id];
    
    if (!empty($start_date) && !empty($end_date)) {
        $date_condition = ' AND DATE(ll.late_date) BETWEEN :start_date AND :end_date';
        $params[':start_date'] = $start_date;
        $params[':end_date'] = $end_date;
    }
    
    // 1. Overall totals
    $total_query = "
        SELECT 
            COUNT(*) as total_late_records,
            COUNT(DISTINCT ll.learner_id) as unique_late_learners,
            COUNT(DISTINCT DATE(ll.late_date)) as days_with_lates,
            MIN(DATE(ll.late_date)) as first_late_date,
            MAX(DATE(ll.late_date)) as last_late_date
        FROM late_log ll
        WHERE ll.academic_year_id = :year_id $date_condition
    ";
      $stmt = $pdo->prepare($total_query);
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value, $param === ':year_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $totals = $stmt->fetch(PDO::FETCH_ASSOC);
    
    // Get total enrolled learners for the academic year
    $total_learners_query = "
        SELECT COUNT(*) as total_enrolled_learners
        FROM learners l
        WHERE l.academic_year_id = :year_id
    ";
    
    $stmt = $pdo->prepare($total_learners_query);
    $stmt->bindValue(':year_id', $year_id, PDO::PARAM_INT);
    $stmt->execute();
    $total_learners_result = $stmt->fetch(PDO::FETCH_ASSOC);
    $total_enrolled_learners = (int)$total_learners_result['total_enrolled_learners'];
      // 2. Top 5 learners with most late arrivals
    $top_learners_query = "
        SELECT 
            l.firstname,
            l.surname,
            l.grade,
            l.gender,
            COUNT(*) as late_count
        FROM late_log ll
        INNER JOIN learners l ON ll.learner_id = l.id
        WHERE ll.academic_year_id = :year_id $date_condition
        GROUP BY ll.learner_id, l.firstname, l.surname, l.grade, l.gender
        ORDER BY late_count DESC
        LIMIT 5
    ";
    
    $stmt = $pdo->prepare($top_learners_query);
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value, $param === ':year_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $top_learners = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 3. Grade breakdown
    $grade_query = "
        SELECT 
            l.grade,
            COUNT(*) as count,
            COUNT(DISTINCT ll.learner_id) as unique_learners
        FROM late_log ll
        INNER JOIN learners l ON ll.learner_id = l.id
        WHERE ll.academic_year_id = :year_id $date_condition
        GROUP BY l.grade
        ORDER BY l.grade ASC
    ";
    
    $stmt = $pdo->prepare($grade_query);
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value, $param === ':year_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $grade_breakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 4. Gender breakdown
    $gender_query = "
        SELECT 
            l.gender,
            COUNT(*) as count,
            COUNT(DISTINCT ll.learner_id) as unique_learners
        FROM late_log ll
        INNER JOIN learners l ON ll.learner_id = l.id
        WHERE ll.academic_year_id = :year_id $date_condition
        GROUP BY l.gender
        ORDER BY l.gender ASC
    ";
    
    $stmt = $pdo->prepare($gender_query);
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value, $param === ':year_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $gender_breakdown = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 5. Daily averages and patterns
    $daily_stats_query = "
        SELECT 
            DAYNAME(ll.late_date) as day_name,
            DAYOFWEEK(ll.late_date) as day_number,
            COUNT(*) as total_count,
            COUNT(DISTINCT DATE(ll.late_date)) as occurrence_days,
            ROUND(COUNT(*) / COUNT(DISTINCT DATE(ll.late_date)), 1) as avg_per_day
        FROM late_log ll
        WHERE ll.academic_year_id = :year_id $date_condition
        GROUP BY DAYOFWEEK(ll.late_date), DAYNAME(ll.late_date)
        ORDER BY day_number ASC
    ";
    
    $stmt = $pdo->prepare($daily_stats_query);
    foreach ($params as $param => $value) {
        $stmt->bindValue($param, $value, $param === ':year_id' ? PDO::PARAM_INT : PDO::PARAM_STR);
    }
    $stmt->execute();
    $daily_patterns = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // 6. Recent activity (last 7 days from end_date or current date)
    $recent_end_date = !empty($end_date) ? $end_date : date('Y-m-d');
    $recent_start_date = date('Y-m-d', strtotime($recent_end_date . ' -6 days'));
    
    $recent_query = "
        SELECT 
            DATE(ll.late_date) as date,
            COUNT(*) as count
        FROM late_log ll
        WHERE ll.academic_year_id = :year_id
        AND DATE(ll.late_date) BETWEEN :recent_start AND :recent_end
        GROUP BY DATE(ll.late_date)
        ORDER BY DATE(ll.late_date) DESC
    ";
    
    $stmt = $pdo->prepare($recent_query);
    $stmt->bindValue(':year_id', $year_id, PDO::PARAM_INT);
    $stmt->bindValue(':recent_start', $recent_start_date, PDO::PARAM_STR);
    $stmt->bindValue(':recent_end', $recent_end_date, PDO::PARAM_STR);
    $stmt->execute();
    $recent_activity = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    // Calculate percentages for breakdowns
    $total_records = (int)$totals['total_late_records'];
    
    // Format grade breakdown with percentages
    $formatted_grade_breakdown = [];
    foreach ($grade_breakdown as $grade) {
        $formatted_grade_breakdown[] = [
            'grade' => $grade['grade'],
            'count' => (int)$grade['count'],
            'unique_learners' => (int)$grade['unique_learners'],
            'percentage' => $total_records > 0 ? round(($grade['count'] / $total_records) * 100, 1) : 0
        ];
    }
    
    // Format gender breakdown with percentages
    $formatted_gender_breakdown = [];
    foreach ($gender_breakdown as $gender) {
        $formatted_gender_breakdown[] = [
            'gender' => $gender['gender'],
            'count' => (int)$gender['count'],
            'unique_learners' => (int)$gender['unique_learners'],
            'percentage' => $total_records > 0 ? round(($gender['count'] / $total_records) * 100, 1) : 0
        ];
    }
      // Format top learners
    $formatted_top_learners = [];
    foreach ($top_learners as $learner) {
        $formatted_top_learners[] = [
            'name' => $learner['firstname'] . ' ' . $learner['surname'],
            'grade' => $learner['grade'],
            'gender' => $learner['gender'],
            'late_count' => (int)$learner['late_count']
        ];
    }
    
    // Format daily patterns
    $formatted_daily_patterns = [];
    foreach ($daily_patterns as $pattern) {
        $formatted_daily_patterns[] = [
            'day_name' => $pattern['day_name'],
            'total_count' => (int)$pattern['total_count'],
            'occurrence_days' => (int)$pattern['occurrence_days'],
            'average_per_day' => (float)$pattern['avg_per_day'],
            'percentage' => $total_records > 0 ? round(($pattern['total_count'] / $total_records) * 100, 1) : 0
        ];
    }
    
    // Format recent activity
    $formatted_recent_activity = [];
    foreach ($recent_activity as $activity) {
        $formatted_recent_activity[] = [
            'date' => $activity['date'],
            'count' => (int)$activity['count']
        ];
    }
    
    echo json_encode([
        'status' => 'success',
        'overview' => [
            'year_id' => $year_id,
            'date_range' => [
                'start_date' => $start_date ?: $totals['first_late_date'],
                'end_date' => $end_date ?: $totals['last_late_date'],
                'filtered' => !empty($start_date) && !empty($end_date)
            ],            'totals' => [
                'total_late_records' => (int)$totals['total_late_records'],
                'unique_late_learners' => (int)$totals['unique_late_learners'],
                'total_enrolled_learners' => $total_enrolled_learners,
                'days_with_lates' => (int)$totals['days_with_lates'],
                'first_late_date' => $totals['first_late_date'],
                'last_late_date' => $totals['last_late_date']
            ]
        ],
        'breakdowns' => [
            'by_grade' => $formatted_grade_breakdown,
            'by_gender' => $formatted_gender_breakdown,
            'by_day_of_week' => $formatted_daily_patterns
        ],
        'top_performers' => [
            'most_late_learners' => $formatted_top_learners
        ],
        'recent_activity' => [
            'period' => $recent_start_date . ' to ' . $recent_end_date,
            'daily_counts' => $formatted_recent_activity
        ]
    ]);
    
} catch (PDOException $e) {
    error_log("Database error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Database error' . $e->getMessage()]);
} catch (Exception $e) {
    error_log("Overall stats error: " . $e->getMessage());
    echo json_encode(['status' => 'fail', 'message' => 'Server error' ]);
}
?>