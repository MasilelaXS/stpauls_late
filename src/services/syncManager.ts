import { getLateQueue, clearLateQueue, removeLateQueueItems } from "./localDB";
import { syncLateRecords as apiSyncLateRecords } from "./api";
import { toast } from "sonner";

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
    toast.info(
      isSyncInProgress ? "Sync already in progress" : "You are offline"
    );
    return { success: 0, failed: 0 };
  }

  try {
    isSyncInProgress = true;
    console.log("[SyncManager] Starting sync of late records...");

    // Get all late records from the queue
    const lateRecords = await getLateQueue();
    console.log(
      "[SyncManager] Retrieved late records from queue:",
      lateRecords
    );

    if (lateRecords.length === 0) {
      console.log("[SyncManager] No late records to sync");
      toast.info("No records to sync");
      return { success: 0, failed: 0 };
    }
    console.log(`[SyncManager] Found ${lateRecords.length} records to sync`);

    // Validate that all records have user_id before syncing
    console.log("[SyncManager] Sample record:", lateRecords[0]);
    const recordsWithoutUserId = lateRecords.filter(
      (record) => !record.user_id
    );
    if (recordsWithoutUserId.length > 0) {
      console.error(
        "[SyncManager] Records missing user_id:",
        recordsWithoutUserId
      );
    }

    // Use the bulk sync API instead of individual calls
    const syncResult = await apiSyncLateRecords(lateRecords);
    console.log(
      `[SyncManager] Sync completed: ${syncResult.success} successful, ${syncResult.failed} failed`
    );
    if (syncResult.errors.length > 0) {
      console.error("[SyncManager] Sync errors:", syncResult.errors);
    } // Calculate saved and duplicate records from backend response
    const totalSent = lateRecords.length;
    const explicitlySuccessful = syncResult.success;
    const explicitlyFailed = syncResult.failed;

    // Count duplicates by parsing error messages for "Already marked late" pattern
    const duplicates = (syncResult.errors || []).filter((error) =>
      error.includes("Already marked late for this date")
    ).length;

    // Other failures are genuine errors (validation, database issues, etc.)
    const otherFailures = explicitlyFailed - duplicates;
    console.log("[SyncManager] Sync breakdown:", {
      totalSent,
      explicitlySuccessful,
      explicitlyFailed,
      duplicates,
      otherFailures,
      syncResult,
    }); // Show comprehensive sync result notification
    if (totalSent > 0) {
      let message = "";
      if (explicitlySuccessful > 0) {
        message += `${explicitlySuccessful} learner${
          explicitlySuccessful === 1 ? "" : "s"
        } saved`;
      }
      if (duplicates > 0) {
        if (message) message += ". ";
        message += `${duplicates} ${
          duplicates === 1 ? "is a duplicate" : "are duplicates"
        }`;
      }
      if (otherFailures > 0) {
        if (message) message += ". ";
        message += `${otherFailures} failed to sync`;
      }

      // If we still don't have a message but had records to process, show a default message
      if (!message && totalSent > 0) {
        message = `${totalSent} record${totalSent === 1 ? "" : "s"} processed`;
      }

      console.log("[SyncManager] Toast message:", message);
      if (message) {
        // Use appropriate toast type based on results
        if (otherFailures > 0) {
          toast.error(message, {
            description: "Some records failed to sync",
            duration: 5000,
          });
        } else if (duplicates > 0 && explicitlySuccessful === 0) {
          toast.info(message, {
            description: "All records were already marked late",
            duration: 4000,
          });
        } else {
          toast.success(message, {
            description: "Sync completed successfully",
            duration: 4000,
          });
        }
      }
    } else {
      // No records to sync
      console.log("[SyncManager] No records to sync - showing info message");
      toast.info("No records to sync");
    } // Handle selective record removal based on sync results
    if (syncResult.success === lateRecords.length) {
      // All records were successfully synced, clear the entire queue
      await clearLateQueue();
      console.log(
        "[SyncManager] Cleared late queue after full successful sync"
      );
    } else if (
      syncResult.success > 0 ||
      (syncResult.failed === 0 && lateRecords.length > 0)
    ) {
      // Partial success OR no explicit failures (which could mean duplicates were skipped)
      console.log(
        "[SyncManager] Partial sync success or duplicates detected - removing processed records"
      );

      // The backend processes records in the same order they were sent
      // Failed records are reported with their index, so we can determine which ones succeeded or were skipped as duplicates
      const failedIndices = new Set(
        (syncResult.failedRecords || []).map((record) => record.index)
      );

      // Identify records that should be removed from queue:
      // 1. Successfully synced records (not in failed list)
      // 2. Records that were skipped as duplicates (also not in failed list)
      const recordsToRemove: number[] = [];
      lateRecords.forEach((record, index) => {
        if (!failedIndices.has(index) && record.id) {
          recordsToRemove.push(record.id);
        }
      });

      console.log(
        `[SyncManager] Removing ${recordsToRemove.length} processed records from queue (successful + duplicates)`
      );
      console.log(
        `[SyncManager] Backend reported ${syncResult.success} successful inserts, ${syncResult.failed} explicit failures`
      );

      if (recordsToRemove.length > 0) {
        await removeLateQueueItems(recordsToRemove);
        console.log(
          "[SyncManager] Successfully removed processed records from local queue"
        );
      }
    } else {
      console.log(
        "[SyncManager] No records were successfully processed - keeping all in queue for retry"
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
    toast.error("Sync failed", {
      description: "Unable to sync records. Please try again later.",
      duration: 5000,
    });
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
