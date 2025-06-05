// Utility for managing login session
// Store: user_id (number), optional username
// Methods: setSession, getSession, clearSession, isLoggedIn, isOfflineMode

import { setAuthToken, clearAuthToken } from "./api";

// Session data interface
export interface SessionData {
  user_id: number;
  username?: string;
  login_time?: string;
  last_activity?: string;
}

// Storage keys
const STORAGE_KEYS = {
  USER_ID: "user_id",
  USERNAME: "username",
  LOGIN_TIME: "login_time",
  LAST_ACTIVITY: "last_activity",
  AUTH_TOKEN: "authToken",
  CURRENT_USER: "currentUser",
} as const;

/**
 * Set user session data
 * @param userId - The user ID (required)
 * @param username - Optional username
 * @param authToken - Optional authentication token
 */
export function setSession(
  userId: number,
  username?: string,
  authToken?: string
): void {
  try {
    const now = new Date().toISOString();

    // Store core session data
    localStorage.setItem(STORAGE_KEYS.USER_ID, userId.toString());
    localStorage.setItem(STORAGE_KEYS.LOGIN_TIME, now);
    localStorage.setItem(STORAGE_KEYS.LAST_ACTIVITY, now);

    // Store optional username
    if (username) {
      localStorage.setItem(STORAGE_KEYS.USERNAME, username);
    } else {
      localStorage.removeItem(STORAGE_KEYS.USERNAME);
    }

    // Store auth token if provided
    if (authToken) {
      localStorage.setItem(STORAGE_KEYS.AUTH_TOKEN, authToken);
      setAuthToken(authToken);

      // Store current user object for compatibility
      const userObject = {
        id: userId,
        username: username || "",
      };
      localStorage.setItem(
        STORAGE_KEYS.CURRENT_USER,
        JSON.stringify(userObject)
      );
    }

    console.log(
      "[Session] Session set successfully for user:",
      userId,
      username || ""
    );
  } catch (error) {
    console.error("[Session] Failed to set session:", error);
    throw new Error("Failed to save session data");
  }
}

/**
 * Get current session data
 * @returns SessionData object or null if no session
 */
export function getSession(): SessionData | null {
  try {
    const userIdStr = localStorage.getItem(STORAGE_KEYS.USER_ID);

    if (!userIdStr) {
      return null;
    }

    const userId = parseInt(userIdStr, 10);
    if (isNaN(userId)) {
      console.warn("[Session] Invalid user ID in storage, clearing session");
      clearSession();
      return null;
    }

    return {
      user_id: userId,
      username: localStorage.getItem(STORAGE_KEYS.USERNAME) || undefined,
      login_time: localStorage.getItem(STORAGE_KEYS.LOGIN_TIME) || undefined,
      last_activity:
        localStorage.getItem(STORAGE_KEYS.LAST_ACTIVITY) || undefined,
    };
  } catch (error) {
    console.error("[Session] Failed to get session:", error);
    return null;
  }
}

/**
 * Clear all session data
 */
export function clearSession(): void {
  try {
    // Remove all session-related data
    Object.values(STORAGE_KEYS).forEach((key) => {
      localStorage.removeItem(key);
    });

    // Clear auth token from memory
    clearAuthToken();

    console.log("[Session] Session cleared successfully");
  } catch (error) {
    console.error("[Session] Failed to clear session:", error);
  }
}

/**
 * Check if user is currently logged in
 * @returns true if user has valid session
 */
export function isLoggedIn(): boolean {
  const session = getSession();
  return session !== null && session.user_id > 0;
}

/**
 * Check if app is in offline mode
 * @returns true if navigator reports offline status
 */
export function isOfflineMode(): boolean {
  return !navigator.onLine;
}

/**
 * Update last activity timestamp for session
 */
export function updateActivity(): void {
  try {
    if (isLoggedIn()) {
      localStorage.setItem(
        STORAGE_KEYS.LAST_ACTIVITY,
        new Date().toISOString()
      );
    }
  } catch (error) {
    console.error("[Session] Failed to update activity:", error);
  }
}

/**
 * Get session duration in minutes
 * @returns number of minutes since login, or 0 if no session
 */
export function getSessionDuration(): number {
  const session = getSession();
  if (!session?.login_time) {
    return 0;
  }

  try {
    const loginTime = new Date(session.login_time);
    const now = new Date();
    return Math.floor((now.getTime() - loginTime.getTime()) / (1000 * 60));
  } catch (error) {
    console.error("[Session] Failed to calculate session duration:", error);
    return 0;
  }
}

/**
 * Check if session has expired (optional session timeout)
 * @param timeoutMinutes - Session timeout in minutes (default: 8 hours = 480 minutes)
 * @returns true if session has expired
 */
export function isSessionExpired(timeoutMinutes: number = 480): boolean {
  const session = getSession();
  if (!session?.last_activity) {
    return true;
  }

  try {
    const lastActivity = new Date(session.last_activity);
    const now = new Date();
    const minutesSinceActivity = Math.floor(
      (now.getTime() - lastActivity.getTime()) / (1000 * 60)
    );

    return minutesSinceActivity > timeoutMinutes;
  } catch (error) {
    console.error("[Session] Failed to check session expiration:", error);
    return true;
  }
}

/**
 * Get user ID from session
 * @returns user ID or null if no session
 */
export function getUserId(): number | null {
  const session = getSession();
  return session?.user_id || null;
}

/**
 * Get username from session
 * @returns username or null if no session/username
 */
export function getUsername(): string | null {
  const session = getSession();
  return session?.username || null;
}

/**
 * Check network connectivity and update offline status
 * @returns Promise<boolean> - true if online, false if offline
 */
export async function checkConnectivity(): Promise<boolean> {
  try {
    // Try to fetch a small resource to verify connectivity
    const response = await fetch("/icon.svg", {
      method: "HEAD",
      cache: "no-cache",
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Session state for use in React components
 */
export interface SessionState {
  isLoggedIn: boolean;
  isOffline: boolean;
  userId: number | null;
  username: string | null;
  sessionDuration: number;
  isExpired: boolean;
}

/**
 * Get comprehensive session state
 * @returns SessionState object
 */
export function getSessionState(): SessionState {
  return {
    isLoggedIn: isLoggedIn(),
    isOffline: isOfflineMode(),
    userId: getUserId(),
    username: getUsername(),
    sessionDuration: getSessionDuration(),
    isExpired: isSessionExpired(),
  };
}

/**
 * Initialize session management with activity tracking
 * Call this once when the app starts
 */
export function initializeSession(): () => void {
  // Update activity on user interactions
  const events = [
    "mousedown",
    "mousemove",
    "keypress",
    "scroll",
    "touchstart",
    "click",
  ];

  const updateActivityHandler = () => {
    updateActivity();
  };

  // Add event listeners
  events.forEach((event) => {
    document.addEventListener(event, updateActivityHandler, true);
  });

  // Check for session expiration periodically
  const checkExpiration = () => {
    if (isLoggedIn() && isSessionExpired()) {
      console.log("[Session] Session expired, clearing session");
      clearSession();
      // Optionally trigger a logout event or redirect
      window.dispatchEvent(new CustomEvent("sessionExpired"));
    }
  };

  // Check every 5 minutes
  const intervalId = setInterval(checkExpiration, 5 * 60 * 1000);

  // Return cleanup function
  return () => {
    events.forEach((event) => {
      document.removeEventListener(event, updateActivityHandler, true);
    });
    clearInterval(intervalId);
  };
}

// Export for backward compatibility with existing AuthContext
export default {
  setSession,
  getSession,
  clearSession,
  isLoggedIn,
  isOfflineMode,
  updateActivity,
  getSessionDuration,
  isSessionExpired,
  getUserId,
  getUsername,
  checkConnectivity,
  getSessionState,
  initializeSession,
};
