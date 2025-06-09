// React API service for communicating with PHP backend
import type { Learner, LateQueueItem } from "./localDB";

const API_BASE_URL = "https://stpauls.ctecg.co.za/api";

// Authentication token management
let authToken: string | null = null;

// Interface for failed sync records
interface FailedSyncRecord {
  index: number;
  record: Record<string, unknown>;
  error: string;
}

// Interface for learner offences
export interface Offence {
  id: number;
  learner: {
    id: number;
    name: string;
    firstname: string;
    surname: string;
    grade: string;
    accession_number: string;
  };
  academic_year: {
    id: number;
    year_label: string;
  };
  description: string;
  image_path: string | null;
  recorded_at: string;
  recorded_by: {
    id: number;
    username: string;
  };
}

export interface OffencesResponse {
  success: boolean;
  data: Offence[];
  pagination: {
    total_count: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
  filters: {
    learner_id: number | null;
    academic_year_id: number;
  };
}

export interface RecordOffenceResponse {
  success: boolean;
  offence_id?: number;
  message: string;
  data?: {
    offence_id: number;
    learner_id: number;
    academic_year_id: number;
    description: string;
    image_path: string | null;
    recorded_by: number;
    recorded_at: string;
  };
}

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
  late_date?: string;
}): Promise<{ success: boolean; message?: string }> {
  try {
    // Ensure we have all required fields including user_id
    const requestData = {
      learner_id: data.learner_id,
      user_id: data.user_id,
      academic_year_id: data.academic_year_id,
      late_date: data.late_date || new Date().toISOString(),
    };

    const response = await fetch(`${API_BASE_URL}/late/mark.php`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(authToken && { Authorization: `Bearer ${authToken}` }),
      },
      body: JSON.stringify(requestData),
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
export async function syncLateRecords(lateRecords: LateQueueItem[]): Promise<{
  success: number;
  failed: number;
  errors: string[];
  failedRecords?: FailedSyncRecord[];
  totalProcessed?: number;
}> {
  try {
    console.log(`[API] Starting sync of ${lateRecords.length} late records`);

    if (lateRecords.length === 0) {
      console.log("[API] No records to sync");
      return { success: 0, failed: 0, errors: [] };
    } // Validate that all records have required fields including user_id
    const invalidRecords = lateRecords.filter(
      (record) =>
        !record.user_id || !record.learner_id || !record.academic_year_id
    );

    if (invalidRecords.length > 0) {
      console.error(
        "[API] Invalid records found - missing required fields:",
        invalidRecords
      );
      return {
        success: 0,
        failed: lateRecords.length,
        errors: [
          `${invalidRecords.length} records missing required fields (user_id, learner_id, or academic_year_id)`,
        ],
      };
    }
    const syncData = lateRecords.map((record, index) => ({
      index: index, // Add index to track which records succeed/fail
      learner_id: record.learner_id,
      user_id: record.user_id,
      academic_year_id: record.academic_year_id,
      late_date: record.late_date,
    }));

    console.log("[API] Sync data with user_id validation:", syncData);
    console.log("[API] Sample record user_id:", syncData[0]?.user_id);
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

    // Calculate records that were processed but not explicitly successful (likely duplicates)
    const totalSent = lateRecords.length;
    const explicitlySuccessful = data.successful_inserts || 0;
    const explicitlyFailed = data.failed_count || 0;
    const possibleDuplicates =
      totalSent - explicitlySuccessful - explicitlyFailed;

    console.log(
      `[API] Sync summary - Sent: ${totalSent}, Successful: ${explicitlySuccessful}, Failed: ${explicitlyFailed}, Possible duplicates: ${possibleDuplicates}`
    );

    // Map backend response fields to frontend expected format
    return {
      success: data.successful_inserts || 0,
      failed: data.failed_count || 0,
      errors: data.failed_records
        ? data.failed_records.map((record: FailedSyncRecord) => record.error)
        : [],
      failedRecords: data.failed_records || [], // Keep detailed failed record info
      totalProcessed: data.total_processed || 0,
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
  male: number;
  female: number;
  total: number;
  percentage: number;
  male_percentage: number;
  female_percentage: number;
}

export interface GenderWiseStats {
  gender: string;
  count: number;
  percentage: number;
}

// Enhanced interfaces for comprehensive behavioral data
export interface TrendData {
  period: string;
  count: number;
  unique_learners: number;
  percentage_of_total: number;
}

export interface BehavioralTrendData {
  period: number;
  period_display: string;
  period_type: string;
  late_arrivals: {
    period: number;
    period_display: string;
    period_type: string;
    total_late_count: number;
    unique_late_learners: number;
    percentage_of_total_students: number;
    variance_from_average: number;
  };
  offences: {
    period: number;
    period_display: string;
    period_type: string;
    total_offence_count: number;
    unique_offending_learners: number;
    percentage_of_total_students: number;
    variance_from_average: number;
  };
  total_behavioral_incidents: number;
  unique_affected_learners: number;
}

export interface TopLateLearner {
  id: number;
  name: string;
  firstname: string;
  surname: string;
  grade: string;
  gender: string;
  late_count: number;
}

export interface TopOffenceLearner {
  id: number;
  name: string;
  firstname: string;
  surname: string;
  grade: string;
  gender: string;
  offence_count: number;
}

export interface TopCombinedLearner {
  id: number;
  name: string;
  firstname: string;
  surname: string;
  grade: string;
  gender: string;
  late_count: number;
  offence_count: number;
  total_incidents: number;
}

export interface TrendStatistics {
  total_periods: number;
  total_late_count: number;
  total_offence_count: number;
  average_late_per_period: number;
  average_offence_per_period: number;
  total_enrolled_students: number;
  highest_late_period: {
    period: string;
    period_display: string;
    count: number;
  } | null;
  lowest_late_period: {
    period: string;
    period_display: string;
    count: number;
  } | null;
  highest_offence_period: {
    period: string;
    period_display: string;
    count: number;
  } | null;
  lowest_offence_period: {
    period: string;
    period_display: string;
    count: number;
  } | null;
}

export interface EnhancedTrendResponse {
  late_arrivals: {
    trends: TrendData[];
    top_performers: TopLateLearner[];
    statistics: {
      total_records: number;
      unique_learners: number;
      average_per_period: number;
      highest_period: { period: string; count: number } | null;
      lowest_period: { period: string; count: number } | null;
    };
  };
  offences: {
    trends: TrendData[];
    top_performers: TopOffenceLearner[];
    statistics: {
      total_records: number;
      unique_learners: number;
      average_per_period: number;
      highest_period: { period: string; count: number } | null;
      lowest_period: { period: string; count: number } | null;
    };
  };
  combined_behavioral_trends: BehavioralTrendData[];
  top_performers: {
    late_arrivals: TopLateLearner[];
    offences: TopOffenceLearner[];
    combined_behavioral_concerns: TopCombinedLearner[];
  };
  detailed_statistics: TrendStatistics;
  year_id: number;
  group_by: string;
  date_range: {
    start_date: string;
    end_date: string;
    filtered: boolean;
  };
}

// Legacy interface for backward compatibility
export interface LegacyTrendStatistics {
  total_periods: number;
  total_late_count: number;
  average_per_period: number;
  total_enrolled_students: number;
  highest_period: {
    period: string;
    count: number;
  } | null;
  lowest_period: {
    period: string;
    count: number;
  } | null;
}

export interface TrendResponse {
  trends: TrendData[];
  top_late_learners: TopLateLearner[];
  statistics: LegacyTrendStatistics;
  year_id: number;
  group_by: string;
  date_range: {
    start_date: string;
    end_date: string;
    filtered: boolean;
  };
}

// Backend response interfaces for enhanced trend data
interface BackendTrendItem {
  period: string;
  total_late_count: number;
  unique_late_learners: number;
  percentage_of_total_students: number;
  total_offence_count: number;
  unique_offending_learners: number;
}

// Backend response interfaces
interface BackendGradeStatsItem {
  grade: string;
  male: number;
  female: number;
  total: number;
  percentage: number;
  male_percentage: number;
  female_percentage: number;
}

interface BackendGenderStatsItem {
  gender: string;
  total_late_count: number;
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

    console.log("[getGradeWiseLateStats] Raw backend response:", data);

    if (data.status === "success" && Array.isArray(data.stats)) {
      const mappedData = data.stats.map((item: BackendGradeStatsItem) => ({
        grade: `Grade ${item.grade}`, // Convert grade to "Grade X"
        male: item.male,
        female: item.female,
        total: item.total,
        percentage: item.percentage,
        male_percentage: item.male_percentage,
        female_percentage: item.female_percentage,
      }));

      console.log("[getGradeWiseLateStats] Mapped data:", mappedData);
      return mappedData;
    }

    return [];
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

    const data = await response.json(); // ✅ Ensure data is mapped correctly
    if (data.success && Array.isArray(data.data)) {
      return data.data.map((item: BackendGenderStatsItem) => ({
        gender: item.gender,
        count: item.total_late_count,
        percentage: item.percentage_of_total ?? 0,
      }));
    }

    return [];
  } catch (error) {
    console.error("Failed to fetch gender-wise late stats:", error);
    throw error;
  }
}

/**
 * Get enhanced behavioral trend data with late arrivals and offences
 */
export async function getEnhancedTrendData(
  type: "daily" | "weekly" | "monthly",
  yearId: number = 1,
  weeks?: number
): Promise<EnhancedTrendResponse> {
  try {
    // Calculate date range based on type and weeks
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date();

    if (type === "weekly") {
      const weeksBack = weeks || 12;
      startDate.setDate(startDate.getDate() - weeksBack * 7);
    } else if (type === "monthly") {
      // Monthly - go back 12 months
      startDate.setMonth(startDate.getMonth() - 12);
    } else {
      // Daily - go back 30 days
      startDate.setDate(startDate.getDate() - 30);
    }

    const url = `${API_BASE_URL}/reports/late_trends.php?year_id=${yearId}&start_date=${
      startDate.toISOString().split("T")[0]
    }&end_date=${endDate}&group_by=${type}`;

    console.log("[getEnhancedTrendData] Fetching from URL:", url);

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
    console.log("[getEnhancedTrendData] Backend response:", data); // Handle the actual backend response structure
    if (
      data.success &&
      data.trend_data &&
      data.statistics &&
      data.top_performers
    ) {
      // Map late arrivals trends from the actual response structure
      const lateArrivalsTrends = (data.trend_data.late_arrivals_only || []).map(
        (item: BackendTrendItem) => ({
          period: item.period,
          count: item.total_late_count,
          unique_learners: item.unique_late_learners,
          percentage_of_total: item.percentage_of_total_students,
        })
      );

      // Map offences trends from the actual response structure
      const offencesTrends = (data.trend_data.offences_only || []).map(
        (item: BackendTrendItem) => ({
          period: item.period,
          count: item.total_offence_count,
          unique_learners: item.unique_offending_learners,
          percentage_of_total: item.percentage_of_total_students,
        })
      );

      return {
        late_arrivals: {
          trends: lateArrivalsTrends,
          top_performers: data.top_performers.late_arrivals || [],
          statistics: {
            total_records: data.statistics.late_arrivals?.total_late_count || 0,
            unique_learners:
              data.statistics.overall?.total_enrolled_students || 0,
            average_per_period:
              data.statistics.late_arrivals?.average_per_period || 0,
            highest_period:
              data.statistics.late_arrivals?.highest_period || null,
            lowest_period: data.statistics.late_arrivals?.lowest_period || null,
          },
        },
        offences: {
          trends: offencesTrends,
          top_performers: data.top_performers.offences || [],
          statistics: {
            total_records: data.statistics.offences?.total_offence_count || 0,
            unique_learners:
              data.statistics.overall?.total_enrolled_students || 0,
            average_per_period:
              data.statistics.offences?.average_per_period || 0,
            highest_period: data.statistics.offences?.highest_period || null,
            lowest_period: data.statistics.offences?.lowest_period || null,
          },
        },
        combined_behavioral_trends:
          data.trend_data.combined_behavioral_trends || [],
        top_performers: {
          late_arrivals: data.top_performers.late_arrivals || [],
          offences: data.top_performers.offences || [],
          combined_behavioral_concerns:
            data.top_performers.combined_behavioral_concerns || [],
        },
        detailed_statistics: {
          total_periods: data.statistics.late_arrivals?.total_periods || 0,
          total_late_count:
            data.statistics.late_arrivals?.total_late_count || 0,
          total_offence_count:
            data.statistics.offences?.total_offence_count || 0,
          average_late_per_period:
            data.statistics.late_arrivals?.average_per_period || 0,
          average_offence_per_period:
            data.statistics.offences?.average_per_period || 0,
          total_enrolled_students:
            data.statistics.overall?.total_enrolled_students || 0,
          highest_late_period:
            data.statistics.late_arrivals?.highest_period || null,
          lowest_late_period:
            data.statistics.late_arrivals?.lowest_period || null,
          highest_offence_period:
            data.statistics.offences?.highest_period || null,
          lowest_offence_period:
            data.statistics.offences?.lowest_period || null,
        },
        year_id: data.year_id || yearId,
        group_by: data.group_by || type,
        date_range: data.date_range || {
          start_date: startDate.toISOString().split("T")[0],
          end_date: endDate,
          filtered: true,
        },
      };
    }

    // Fallback to empty structure if data format is unexpected
    return {
      late_arrivals: {
        trends: [],
        top_performers: [],
        statistics: {
          total_records: 0,
          unique_learners: 0,
          average_per_period: 0,
          highest_period: null,
          lowest_period: null,
        },
      },
      offences: {
        trends: [],
        top_performers: [],
        statistics: {
          total_records: 0,
          unique_learners: 0,
          average_per_period: 0,
          highest_period: null,
          lowest_period: null,
        },
      },
      combined_behavioral_trends: [],
      top_performers: {
        late_arrivals: [],
        offences: [],
        combined_behavioral_concerns: [],
      },
      detailed_statistics: {
        total_periods: 0,
        total_late_count: 0,
        total_offence_count: 0,
        average_late_per_period: 0,
        average_offence_per_period: 0,
        total_enrolled_students: 0,
        highest_late_period: null,
        lowest_late_period: null,
        highest_offence_period: null,
        lowest_offence_period: null,
      },
      year_id: yearId,
      group_by: type,
      date_range: {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate,
        filtered: true,
      },
    };
  } catch (error) {
    console.error("Failed to fetch enhanced trend data:", error);
    throw error;
  }
}

/**
 * Get weekly or monthly trend data with top learners and statistics (Legacy)
 */
export async function getTrendData(
  type: "daily" | "weekly" | "monthly",
  yearId: number = 1,
  weeks?: number
): Promise<TrendResponse> {
  try {
    // Try to get enhanced data first
    const enhancedData = await getEnhancedTrendData(type, yearId, weeks);

    // Convert to legacy format for backward compatibility
    return {
      trends: enhancedData.late_arrivals.trends,
      top_late_learners: enhancedData.top_performers.late_arrivals,
      statistics: {
        total_periods: enhancedData.detailed_statistics.total_periods,
        total_late_count: enhancedData.detailed_statistics.total_late_count,
        average_per_period:
          enhancedData.detailed_statistics.average_late_per_period,
        total_enrolled_students:
          enhancedData.detailed_statistics.total_enrolled_students,
        highest_period: enhancedData.detailed_statistics.highest_late_period,
        lowest_period: enhancedData.detailed_statistics.lowest_late_period,
      },
      year_id: enhancedData.year_id,
      group_by: enhancedData.group_by,
      date_range: enhancedData.date_range,
    };
  } catch (error) {
    // Fallback to original implementation if enhanced API fails
    console.warn(
      "Enhanced API failed, falling back to legacy implementation:",
      error
    );

    // Calculate date range based on type and weeks
    const endDate = new Date().toISOString().split("T")[0];
    const startDate = new Date();

    if (type === "weekly") {
      const weeksBack = weeks || 12;
      startDate.setDate(startDate.getDate() - weeksBack * 7);
    } else if (type === "monthly") {
      // Monthly - go back 12 months
      startDate.setMonth(startDate.getMonth() - 12);
    } else {
      // Daily - go back 30 days
      startDate.setDate(startDate.getDate() - 30);
    }

    const url = `${API_BASE_URL}/reports/late_trends.php?year_id=${yearId}&start_date=${
      startDate.toISOString().split("T")[0]
    }&end_date=${endDate}&group_by=${type}`;

    console.log("[getTrendData] Fetching from URL:", url);

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
    console.log("[getTrendData] Backend response:", data);

    // Handle legacy response format
    const rawData = data.data || [];

    const trends = rawData.map(
      (item: {
        period: string;
        total_late_count: number;
        unique_late_learners: number;
        percentage_of_total_students: number;
      }) => ({
        period: item.period,
        count: item.total_late_count,
        unique_learners: item.unique_late_learners,
        percentage_of_total: item.percentage_of_total_students,
      })
    );

    console.log("[getTrendData] Mapped trends:", trends);

    // Return the full response structure with trends, top learners, and statistics
    return {
      trends,
      top_late_learners: data.top_late_learners || [],
      statistics: data.statistics || {
        total_periods: 0,
        total_late_count: 0,
        average_per_period: 0,
        total_enrolled_students: 0,
        highest_period: null,
        lowest_period: null,
      },
      year_id: data.year_id || yearId,
      group_by: data.group_by || type,
      date_range: data.date_range || {
        start_date: startDate.toISOString().split("T")[0],
        end_date: endDate,
        filtered: true,
      },
    };
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

/**
 * Offences API Functions
 */

/**
 * Get learner offences
 */
export async function getLearnerOffences(
  learnerId?: number,
  academicYearId?: number,
  limit: number = 50,
  offset: number = 0
): Promise<OffencesResponse> {
  try {
    const params = new URLSearchParams();

    if (learnerId) {
      params.append("learner_id", learnerId.toString());
    }

    if (academicYearId) {
      params.append("academic_year_id", academicYearId.toString());
    }

    params.append("limit", limit.toString());
    params.append("offset", offset.toString());

    const response = await fetch(
      `${API_BASE_URL}/learners/get_offences.php?${params.toString()}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to fetch offences");
    }

    return data;
  } catch (error) {
    console.error("Failed to get learner offences:", error);
    throw error;
  }
}

/**
 * Record a new learner offence
 */
export async function recordLearnerOffence(
  learnerId: number,
  academicYearId: number,
  description: string,
  recordedBy: number,
  image?: File
): Promise<RecordOffenceResponse> {
  try {
    const formData = new FormData();
    formData.append("learner_id", learnerId.toString());
    formData.append("academic_year_id", academicYearId.toString());
    formData.append("description", description);
    formData.append("recorded_by", recordedBy.toString());

    if (image) {
      formData.append("image", image);
    }

    const response = await fetch(
      `${API_BASE_URL}/learners/record_offence.php`,
      {
        method: "POST",
        body: formData, // Don't set Content-Type header for FormData
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.message || "Failed to record offence");
    }

    return data;
  } catch (error) {
    console.error("Failed to record learner offence:", error);
    throw error;
  }
}

/**
 * Download an offence image
 */
export async function downloadOffenceImage(
  offenceId: number,
  filename?: string
): Promise<void> {
  try {
    const downloadUrl = `${API_BASE_URL}/learners/download_image.php?offence_id=${offenceId}&type=download`;

    const response = await fetch(downloadUrl);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;

    // Try to get filename from Content-Disposition header
    let downloadFilename = filename || "offence-image.jpg";
    const contentDisposition = response.headers.get("Content-Disposition");

    if (contentDisposition) {
      const filenameMatch = contentDisposition.match(/filename="(.+)"/);
      if (filenameMatch) {
        downloadFilename = filenameMatch[1];
      }
    }

    link.download = downloadFilename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Failed to download offence image:", error);
    throw error;
  }
}

/**
 * Get print URL for an offence image
 */
export function getOffenceImagePrintUrl(offenceId: number): string {
  return `${API_BASE_URL}/learners/download_image.php?offence_id=${offenceId}&type=inline`;
}
