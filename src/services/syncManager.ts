import { getLateQueue, clearLateQueue } from "./localDB";
import { syncLateRecords as apiSyncLateRecords } from "./api";

// Simple utility to check if we're online
const isOnline = (): boolean => {
  return navigator.onLine;
};

// Track sync in progress to prevent duplicate syncs
let isSyncInProgress = false;

/**
 * Synchronizes offline late records with the backend server
 * @returns Promise that resolves when sync is complete
 */
export async function syncLateRecords(): Promise<{
  success: number;
  failed: number;
}> {
  // If already syncing or offline, don't try to sync
  if (isSyncInProgress || !isOnline()) {
    console.log(
      "[SyncManager] Sync skipped - " +
        (isSyncInProgress ? "sync already in progress" : "offline")
    );
    return { success: 0, failed: 0 };
  }

  try {
    isSyncInProgress = true;
    console.log("[SyncManager] Starting sync of late records...");

    // Get all late records from the queue
    const lateRecords = await getLateQueue();

    if (lateRecords.length === 0) {
      console.log("[SyncManager] No late records to sync");
      return { success: 0, failed: 0 };
    }    console.log(`[SyncManager] Found ${lateRecords.length} records to sync`);
    
    // Validate that all records have user_id before syncing
    console.log("[SyncManager] Sample record:", lateRecords[0]);
    const recordsWithoutUserId = lateRecords.filter(record => !record.user_id);
    if (recordsWithoutUserId.length > 0) {
      console.error("[SyncManager] Records missing user_id:", recordsWithoutUserId);
    }

    // Use the bulk sync API instead of individual calls
    const syncResult = await apiSyncLateRecords(lateRecords);

    console.log(
      `[SyncManager] Sync completed: ${syncResult.success} successful, ${syncResult.failed} failed`
    );

    if (syncResult.errors.length > 0) {
      console.error("[SyncManager] Sync errors:", syncResult.errors);
    } // If all records were successfully synced, clear the queue
    if (syncResult.success === lateRecords.length) {
      await clearLateQueue();
      console.log("[SyncManager] Cleared late queue after successful sync");
    } else if (syncResult.success > 0) {
      // Partial success - we would need to track which records were synced
      // For now, we'll leave them in the queue and retry later
      console.log(
        "[SyncManager] Partial sync success - keeping records in queue for retry"
      );
    }

    // Dispatch a custom event to notify UI components that sync completed
    window.dispatchEvent(
      new CustomEvent("syncCompleted", {
        detail: { success: syncResult.success, failed: syncResult.failed },
      })
    );

    return { success: syncResult.success, failed: syncResult.failed };
  } catch (error) {
    console.error("[SyncManager] Sync error:", error);
    return { success: 0, failed: 0 };
  } finally {
    isSyncInProgress = false;
  }
}

/**
 * Schedule sync to run at specific hours
 * @returns Cleanup function to clear intervals
 */
export function scheduleSync(): () => void {
  console.log("[SyncManager] Setting up scheduled syncs");

  // Attempt immediate sync on startup if online
  if (isOnline()) {
    syncLateRecords().catch(console.error);
  }

  // Set up interval to check every minute if it's time to sync
  const intervalId = setInterval(() => {
    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    // Run at 10:00 and 14:00
    if ((hour === 10 || hour === 14) && minute === 0) {
      console.log(
        `[SyncManager] Scheduled sync at ${hour}:${minute
          .toString()
          .padStart(2, "0")}`
      );
      syncLateRecords().catch(console.error);
    }
  }, 60 * 1000); // Check every minute

  // Also sync when app regains focus/connectivity
  const handleVisibilityChange = () => {
    if (document.visibilityState === "visible" && isOnline()) {
      console.log("[SyncManager] App became visible while online, syncing...");
      syncLateRecords().catch(console.error);
    }
  };

  const handleOnline = () => {
    console.log("[SyncManager] Connection restored, syncing...");
    syncLateRecords().catch(console.error);
  };

  // Add event listeners
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("online", handleOnline);

  // Return cleanup function
  return () => {
    clearInterval(intervalId);
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("online", handleOnline);
  };
}

// Initialize sync manager
let cleanup: (() => void) | null = null;

/**
 * Start the sync manager
 */
export function startSyncManager(): void {
  if (!cleanup) {
    cleanup = scheduleSync();
  }
}

/**
 * Stop the sync manager and clean up resources
 */
export function stopSyncManager(): void {
  if (cleanup) {
    cleanup();
    cleanup = null;
  }
}
