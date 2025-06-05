import { useState, useEffect, useCallback, useRef } from "react";
import {
  addLateRecord,
  getLateQueue,
  getLearnerById,
  type LateQueueItem,
} from "../services/localDB";
import { syncLateRecords, startSyncManager } from "../services/syncManager";

// Define enhanced queue item type
interface EnhancedQueueItem {
  id?: number;
  learner_id: number;
  learner_name?: string;
  late_date: string; // ISO string format
  recorded_at: string; // ISO string format
  academic_year_id: number;
  user_id: number;
}

/**
 * Hook for managing offline queue of late records
 * @returns Methods and state for working with offline queue
 */
export function useOfflineQueue() {
  const [queueItems, setQueueItems] = useState<EnhancedQueueItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const syncingRef = useRef<boolean>(false);
  // Load queue items
  const loadQueueItems = useCallback(async () => {
    setIsLoading(true);
    try {
      const items = await getLateQueue();

      // Enhance queue items with learner names
      const enhancedItems: EnhancedQueueItem[] = await Promise.all(
        items.map(async (item) => {
          const learner = await getLearnerById(item.learner_id);
          return {
            id: item.id,
            learner_id: item.learner_id,
            learner_name: learner
              ? `${learner.first_name} ${learner.last_name}`
              : "Unknown",
            late_date: item.late_date,
            recorded_at: item.recorded_at || new Date().toISOString(),
            academic_year_id: item.academic_year_id,
            user_id: item.user_id,
          };
        })
      );

      setQueueItems(enhancedItems);
    } catch (error) {
      console.error("Failed to load queue items:", error);
    } finally {
      setIsLoading(false);
    }
  }, []); // Empty dependency array since this function doesn't depend on any props or state

  // Add a learner to the late queue
  const addLearnerToLateQueue = useCallback(
    async (learnerId: number, lateDate: Date = new Date()) => {
      try {
        // Get current user from localStorage
        const currentUserStr = localStorage.getItem("currentUser");
        const currentUser = currentUserStr ? JSON.parse(currentUserStr) : null;

        // Get current academic year (defaulting to 1 for now)
        const currentAcademicYearId = 1;

        const lateRecord: Omit<LateQueueItem, "id"> = {
          learner_id: learnerId,
          late_date: lateDate.toISOString(),
          recorded_at: new Date().toISOString(),
          academic_year_id: currentAcademicYearId,
          user_id: currentUser?.id || 1, // Default to user ID 1 if not found
        };

        await addLateRecord(lateRecord);

        // Refresh the queue
        await loadQueueItems();

        // Show successful notification
        console.log("Success: Learner marked as late and added to queue");

        return true;
      } catch (error) {
        console.error("Failed to add learner to late queue:", error);
        return false;
      }
    },
    [loadQueueItems]
  ); // Sync queue with backend
  const syncQueue = useCallback(async () => {
    if (syncingRef.current) {
      console.log("[useOfflineQueue] Sync already in progress, skipping");
      return;
    }

    console.log("[useOfflineQueue] Starting sync...");
    syncingRef.current = true;
    setIsSyncing(true);
    try {
      const result = await syncLateRecords();
      console.log("[useOfflineQueue] Sync result:", result); // Always refresh the queue after sync attempt to ensure UI is up to date
      await loadQueueItems();

      if (result.success > 0 || result.failed > 0) {
        // Show notification (implement your own notification system)
        console.log(
          `Sync Complete: Synced ${result.success} records, ${result.failed} failed`
        );
      } else {
        console.log("Sync completed - no records processed");
      }

      // Dispatch sync completed event for UI components
      window.dispatchEvent(
        new CustomEvent("syncCompleted", {
          detail: {
            success: result.success,
            failed: result.failed,
            manual: true,
          },
        })
      );

      return result;
    } catch (error) {
      console.error("Failed to sync queue:", error);
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [loadQueueItems]);

  // Check if a learner is already in the queue (not synced yet)
  const isLearnerInQueue = useCallback(
    (learnerId: number): boolean => {
      return queueItems.some((item) => item.learner_id === learnerId);
    },
    [queueItems]
  );

  // Load queue items on mount and start automatic sync
  useEffect(() => {
    loadQueueItems();

    // Start automatic sync manager for scheduled syncing
    startSyncManager();
  }, [loadQueueItems]); // Now loadQueueItems has stable reference

  return {
    queueItems,
    isLoading,
    isSyncing,
    queueLength: queueItems.length,
    addLate: addLearnerToLateQueue,
    getQueue: () => queueItems,
    syncQueue,
    refreshQueue: loadQueueItems,
    isLearnerInQueue,
    // Legacy methods for backward compatibility
    addLearnerToLateQueue,
  };
}
