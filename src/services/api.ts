// React API service for communicating with PHP backend
import type { Learner, LateQueueItem } from "./localDB";

const API_BASE_URL = "https://stpauls.ctecg.co.za/api";

// Authentication token management
let authToken: string | null = null;

export function setAuthToken(token: string): void {
  authToken = token;
}

export function getAuthToken(): string | null {
  return authToken;
}

export function clearAuthToken(): void {
  authToken = null;
}

/**
 * Login to the system
 */
export async function login(
  username: string,
  password: string
): Promise<{
  success: boolean;
  token?: string;
  user?: { id: number; username: string };
  message?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/auth/login.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username, password }),
    });

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get response text first to check if it's valid JSON
    const responseText = await response.text(); // Log the raw response for debugging
    console.log("Raw login API response:", responseText);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", responseText);
      throw new Error(
        `Invalid JSON response: ${responseText.substring(0, 100)}...`
      );
    } // Backend returns { success: true, token: '...', user: {...} } or { success: false, message: '...' }
    // Convert to our expected format
    const result = {
      success: data.success === true,
      token: data.token,
      user: data.user,
      message: data.message,
    };

    if (result.success && result.token) {
      setAuthToken(result.token);
    }

    return result;
  } catch (error) {
    console.error("Login failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Check if a user exists and if they have a password set
 */
export async function checkUser(username: string): Promise<{
  success: boolean;
  exists: boolean;
  hasPassword: boolean;
  message?: string;
}> {
  try {
    const url = `${API_BASE_URL}/auth/check_user.php`;
    console.log("Making request to:", url);
    console.log("Request payload:", { username });

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username }),
    });

    console.log("Response status:", response.status);
    console.log(
      "Response headers:",
      Object.fromEntries(response.headers.entries())
    );

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get response text first to check if it's valid JSON
    const responseText = await response.text();

    // Log the raw response for debugging
    console.log("Raw API response:", responseText);

    // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", responseText);
      throw new Error(
        `Invalid JSON response: ${responseText.substring(0, 100)}...`
      );
    } // Backend returns: { success: true, exists: true, hasPassword: true/false, user_id: 1 } or { success: true, exists: false }
    // Convert to our expected format
    if (data.success) {
      return {
        success: true,
        exists: data.exists,
        hasPassword: data.hasPassword || false,
      };
    }

    return {
      success: false,
      exists: false,
      hasPassword: false,
      message: data.message || "Invalid response format",
    };
  } catch (error) {
    console.error("Check user failed:", error);
    return {
      success: false,
      exists: false,
      hasPassword: false,
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Set password for a user (first-time login)
 */
export async function setPassword(
  username: string,
  password: string
): Promise<{
  success: boolean;
  token?: string;
  user?: { id: number; username: string };
  message?: string;
}> {
  try {
    // Backend expects username and password directly
    const response = await fetch(`${API_BASE_URL}/auth/set_password.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        username,
        password,
      }),
    });

    // Check if response is ok
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Get response text first to check if it's valid JSON
    const responseText = await response.text();

    // Log the raw response for debugging
    console.log("Raw setPassword API response:", responseText); // Try to parse as JSON
    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Response text:", responseText);
      throw new Error(
        `Invalid JSON response: ${responseText.substring(0, 100)}...`
      );
    } // Backend returns {"success":true,"message":"Password set successfully","token":"...","user":{...}}
    // Now the backend provides token and user data directly
    if (data.success) {
      if (data.token) {
        setAuthToken(data.token);
      }
      return {
        success: true,
        token: data.token,
        user: data.user,
        message: data.message,
      };
    } else {
      return {
        success: false,
        message: data.message || "Failed to set password",
      };
    }
  } catch (error) {
    console.error("Set password failed:", error);
    return {
      success: false,
      message: error instanceof Error ? error.message : "Network error",
    };
  }
}

/**
 * Get all learners for a specific academic year
 */
export async function getAllLearners(yearId: number = 1): Promise<Learner[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/learners/get_all.php?year_id=${yearId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      }
    );
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.learners || [];
  } catch (error) {
    console.error("Failed to fetch learners:", error);
    throw error;
  }
}

/**
 * Search for learners by name
 */
export async function searchLearners(query: string): Promise<Learner[]> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/learners/search.php?q=${encodeURIComponent(query)}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.learners || [];
  } catch (error) {
    console.error("Failed to search learners:", error);
    throw error;
  }
}

/**
 * Mark a learner as late
 */
export async function markLearnerLate(data: {
  learner_id: number;
  user_id: number;
  academic_year_id: number;
  late_date: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/learners/mark.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Failed to mark learner late:", error);
    return { success: false, message: "Network error" };
  }
}

/**
 * Sync multiple late records to the backend
 */
export async function syncLateRecords(
  lateRecords: LateQueueItem[]
): Promise<{ success: number; failed: number; errors: string[] }> {
  try {
    console.log(`[API] Starting sync of ${lateRecords.length} late records`);

    if (lateRecords.length === 0) {
      console.log("[API] No records to sync");
      return { success: 0, failed: 0, errors: [] };
    }

    const syncData = lateRecords.map((record) => ({
      learner_id: record.learner_id,
      user_id: record.user_id,
      academic_year_id: record.academic_year_id,
      late_date: record.late_date,
    }));

    console.log("[API] Sync data:", syncData);
    console.log("[API] Auth token:", authToken ? "Present" : "Missing");

    const url = `${API_BASE_URL}/late/sync.php`;
    console.log("[API] Sync URL:", url);

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ records: syncData }),
    });

    console.log(`[API] Sync response status: ${response.status}`);
    console.log(
      `[API] Sync response headers:`,
      Object.fromEntries(response.headers.entries())
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(
        `[API] Sync failed with status ${response.status}:`,
        errorText
      );
      throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
    }

    const responseText = await response.text();
    console.log("[API] Raw sync response:", responseText);

    if (!responseText.trim()) {
      throw new Error("Empty response from server");
    }

    const data = JSON.parse(responseText);
    console.log("[API] Parsed sync response:", data);

    return {
      success: data.success || 0,
      failed: data.failed || 0,
      errors: data.errors || [],
    };
  } catch (error) {
    console.error("[API] Sync error details:", error);

    // Check if it's a network error
    if (error instanceof TypeError && error.message.includes("fetch")) {
      console.error(
        "[API] Network error - check internet connection and CORS settings"
      );
    }

    return {
      success: 0,
      failed: lateRecords.length,
      errors: [error instanceof Error ? error.message : "Network error"],
    };
  }
}

/**
 * Get learner's late history for a specific academic year
 */
export async function getLearnerHistory(
  learnerId: number,
  yearId: number = 1
): Promise<{
  learner?: Learner;
  history: Array<{
    id: number;
    late_date: string;
    recorded_at: string;
    recorded_by: number;
  }>;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/learners/history.php?learner_id=${learnerId}&year_id=${yearId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return {
      learner: data.learner,
      history: data.history || [],
    };
  } catch (error) {
    console.error("Failed to fetch learner history:", error);
    throw error;
  }
}

/**
 * Check API status
 */
export async function checkApiStatus(): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE_URL}/status/status.php`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });
    return response.ok;
  } catch (error) {
    console.error("API status check failed:", error);
    return false;
  }
}

/**
 * Get all academic years
 */
export async function getAllYears(): Promise<
  Array<{
    id: number;
    year_name: string;
    is_current: boolean;
  }>
> {
  try {
    const response = await fetch(`${API_BASE_URL}/year/get_all.php`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.years || [];
  } catch (error) {
    console.error("Failed to fetch years:", error);
    throw error;
  }
}

/**
 * Set current academic year
 */
export async function setCurrentYear(
  yearId: number
): Promise<{ success: boolean; message?: string }> {
  try {
    const response = await fetch(`${API_BASE_URL}/year/set_current.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ year_id: yearId }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Failed to set current year:", error);
    return { success: false, message: "Network error" };
  }
}

/**
 * Import learners from CSV
 */
export async function importLearners(
  csvData: string,
  yearId: number
): Promise<{
  success: boolean;
  imported: number;
  errors: string[];
  message?: string;
}> {
  try {
    const response = await fetch(`${API_BASE_URL}/learners/import.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify({ csv_data: csvData, year_id: yearId }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Failed to import learners:", error);
    return {
      success: false,
      imported: 0,
      errors: [error instanceof Error ? error.message : "Network error"],
      message: "Network error",
    };
  }
}

/**
 * Report Data API Functions
 */

export interface ReportStats {
  date: string;
  count: number;
}

export interface GradeWiseStats {
  grade: string;
  count: number;
  percentage: number;
}

export interface GenderWiseStats {
  gender: string;
  count: number;
  percentage: number;
}

export interface TrendData {
  period: string;
  period_start: string;
  period_end: string;
  count: number;
  unique_learners: number;
  percentage_of_total: number;
}

/**
 * Get late records statistics by date range
 */
export async function getLateStatsByDateRange(
  startDate: string,
  endDate: string,
  yearId: number = 1
): Promise<ReportStats[]> {
  try {
    console.log("startDate:", startDate);
    console.log("endDate:", endDate);
    const response = await fetch(
      `${API_BASE_URL}/reports/late_by_date.php?start_date=${startDate}&end_date=${endDate}&year_id=${yearId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.stats || [];
  } catch (error) {
    console.error("Failed to fetch late stats by date:", error);
    throw error;
  }
}

/**
 * Get grade-wise late statistics
 */
export async function getGradeWiseLateStats(
  startDate?: string,
  endDate?: string,
  yearId: number = 1
): Promise<GradeWiseStats[]> {
  try {
    let url = `${API_BASE_URL}/reports/late_by_grade.php?year_id=${yearId}`;
    if (startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.stats || [];
  } catch (error) {
    console.error("Failed to fetch grade-wise late stats:", error);
    throw error;
  }
}

/**
 * Get gender-wise late statistics
 */
export async function getGenderWiseLateStats(
  startDate?: string,
  endDate?: string,
  yearId: number = 1
): Promise<GenderWiseStats[]> {
  try {
    let url = `${API_BASE_URL}/reports/late_by_gender.php?year_id=${yearId}`;
    if (startDate && endDate) {
      url += `&start_date=${startDate}&end_date=${endDate}`;
    }

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.stats || [];
  } catch (error) {
    console.error("Failed to fetch gender-wise late stats:", error);
    throw error;
  }
}

/**
 * Get weekly or monthly trend data
 */
export async function getTrendData(
  type: "weekly" | "monthly",
  yearId: number = 1,
  weeks?: number
): Promise<TrendData[]> {
  try {
    // Calculate date range based on type and weeks
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date();

    if (type === "weekly") {
      const weeksBack = weeks || 12;
      startDate.setDate(startDate.getDate() - weeksBack * 7);
    } else {
      // Monthly - go back 12 months
      startDate.setMonth(startDate.getMonth() - 12);
    }

    const groupBy = type === "weekly" ? "week" : "month";
    const url = `${API_BASE_URL}/reports/late_trends.php?year_id=${yearId}&start_date=${
      startDate.toISOString().split("T")[0]
    }&end_date=${endDate}&group_by=${groupBy}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data.trends || [];
  } catch (error) {
    console.error("Failed to fetch trend data:", error);
    throw error;
  }
}

/**
 * Get overall statistics summary
 */
export async function getOverallStats(yearId: number = 1): Promise<{
  totalLearners: number;
  totalLateRecords: number;
  uniqueLateStudents: number;
  averageLateDays: number;
  mostLateGrade: string;
  thisWeekLate: number;
  lastWeekLate: number;
}> {
  try {
    const response = await fetch(
      `${API_BASE_URL}/reports/overall_stats.php?year_id=${yearId}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(authToken && { Authorization: `Bearer ${authToken}` }),
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    // Extract data from the complex backend response structure
    const overview = data.overview || {};
    const totals = overview.totals || {};
    const gradeBreakdown = data.breakdowns?.by_grade || [];
    const recentActivity = data.recent_activity?.daily_counts || [];
    // Calculate most late grade
    let mostLateGrade = "";
    if (gradeBreakdown.length > 0) {
      const topGrade = gradeBreakdown.reduce(
        (
          max: { count: number; grade: string },
          current: { count: number; grade: string }
        ) => (current.count > max.count ? current : max)
      );
      mostLateGrade = `Grade ${topGrade.grade}`;
    }

    // Calculate this week and last week stats from recent activity
    const today = new Date();
    const startOfThisWeek = new Date(
      today.setDate(today.getDate() - today.getDay())
    );
    const startOfLastWeek = new Date(
      startOfThisWeek.getTime() - 7 * 24 * 60 * 60 * 1000
    );

    let thisWeekLate = 0;
    let lastWeekLate = 0;

    recentActivity.forEach((activity: { date: string; count: number }) => {
      const activityDate = new Date(activity.date);
      if (activityDate >= startOfThisWeek) {
        thisWeekLate += activity.count;
      } else if (activityDate >= startOfLastWeek) {
        lastWeekLate += activity.count;
      }
    });
    return {
      totalLearners: totals.total_enrolled_learners || 0, // Use actual enrolled learners count
      totalLateRecords: totals.total_late_records || 0,
      uniqueLateStudents: totals.unique_late_learners || 0,
      averageLateDays: totals.days_with_lates || 0, // Using days with lates as proxy
      mostLateGrade,
      thisWeekLate,
      lastWeekLate,
    };
  } catch (error) {
    console.error("Failed to fetch overall stats:", error);
    return {
      totalLearners: 0,
      totalLateRecords: 0,
      uniqueLateStudents: 0,
      averageLateDays: 0,
      mostLateGrade: "",
      thisWeekLate: 0,
      lastWeekLate: 0,
    };
  }
}
