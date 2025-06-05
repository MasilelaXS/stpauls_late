import { useEffect, useState } from "react";
import {
  Wifi,
  WifiOff,
  RefreshCw,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { startSyncManager, stopSyncManager } from "../services/syncManager";

interface SyncStatusProps {
  queueLength?: number;
  isOnline?: boolean;
  lastSync?: Date | null;
  onSyncNow?: () => Promise<void>;
  isSyncing?: boolean;
  compact?: boolean; // New prop for compact display
}

const SyncStatus: React.FC<SyncStatusProps> = ({
  queueLength: parentQueueLength,
  isOnline: parentIsOnline,
  lastSync: parentLastSync,
  onSyncNow: parentOnSyncNow,
  isSyncing: parentIsSyncing,
  compact = false,
}) => {
  // Remove the duplicate useOfflineQueue hook call
  // const { queueItems, isLoading, isSyncing, syncQueue } = useOfflineQueue();
  const [nextSyncTime, setNextSyncTime] = useState<Date | null>(null);
  const [networkStatus, setNetworkStatus] = useState<boolean>(navigator.onLine);

  // Use parent props if provided, otherwise use local state
  const currentQueueLength = parentQueueLength || 0;
  const currentIsOnline =
    parentIsOnline !== undefined ? parentIsOnline : networkStatus;
  const currentLastSync = parentLastSync;
  const currentIsSyncing =
    parentIsSyncing !== undefined ? parentIsSyncing : false;

  // Calculate the next sync time (10:00 or 14:00)
  const updateNextSyncTime = () => {
    const now = new Date();
    const nextSync = new Date(now);

    if (now.getHours() < 10) {
      nextSync.setHours(10, 0, 0, 0);
    } else if (now.getHours() < 14) {
      nextSync.setHours(14, 0, 0, 0);
    } else {
      nextSync.setDate(nextSync.getDate() + 1);
      nextSync.setHours(10, 0, 0, 0);
    }

    setNextSyncTime(nextSync);
  };
  // Handle manual sync
  const handleManualSync = async () => {
    if (parentOnSyncNow) {
      await parentOnSyncNow();
    } else {
      // If no parent sync function is provided, this component can't sync
      console.warn("No sync function provided to SyncStatus component");
    }
  };

  // Format time for display
  const formatTime = (date: Date | null) => {
    if (!date) return "Never";
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  };

  // Initialize sync manager on component mount
  useEffect(() => {
    // Start the sync manager when component mounts
    startSyncManager();

    // Calculate next sync time (10:00 or 14:00)
    updateNextSyncTime();

    // Update next sync time every minute
    const intervalId = setInterval(updateNextSyncTime, 60 * 1000);

    // Clean up when component unmounts
    return () => {
      stopSyncManager();
      clearInterval(intervalId);
    };
  }, []);

  // Listen for online/offline events
  useEffect(() => {
    const handleOnline = () => setNetworkStatus(true);
    const handleOffline = () => setNetworkStatus(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []); // Determine sync status message and styling
  const getSyncStatus = (): {
    message: string;
    className: string;
    icon: React.ReactNode;
  } => {
    if (!currentIsOnline) {
      return {
        message: "Offline",
        className: "text-red-500",
        icon: <WifiOff className="h-4 w-4" />,
      };
    }

    if (currentIsSyncing && currentQueueLength > 0) {
      return {
        message: "Syncing...",
        className: "text-red-600",
        icon: <RefreshCw className="h-4 w-4 animate-spin" />,
      };
    }

    if (currentQueueLength === 0) {
      return {
        message: "All data synced",
        className: "text-green-500",
        icon: <CheckCircle className="h-4 w-4" />,
      };
    }

    return {
      message: `${currentQueueLength} pending`,
      className: "text-amber-500",
      icon: <Clock className="h-4 w-4" />,
    };
  };

  const statusInfo = getSyncStatus(); // Compact version for header/sidebar
  if (compact) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 rounded">
        <span className="text-sm">{statusInfo.icon}</span>
        <span className={`text-sm font-medium ${statusInfo.className}`}>
          {statusInfo.message}
        </span>{" "}
        {currentQueueLength > 0 && currentIsOnline && (
          <button
            onClick={handleManualSync}
            disabled={currentIsSyncing}
            className="ml-auto text-xs px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:opacity-50 transition-colors flex items-center gap-1"
          >
            {currentIsSyncing ? (
              <RefreshCw className="h-3 w-3 animate-spin" />
            ) : (
              <RefreshCw className="h-3 w-3" />
            )}
            {currentIsSyncing ? "..." : "Sync"}
          </button>
        )}
      </div>
    );
  } // Full version for sidebar
  return (
    <div className="sync-status p-4 border border-gray-200 rounded shadow-sm bg-white">
      {/* Header with primary status */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Sync Status</h3>
        <div className="flex items-center gap-2">
          <span className="text-lg">{statusInfo.icon}</span>
          <span className={`font-medium ${statusInfo.className}`}>
            {statusInfo.message}
          </span>
        </div>
      </div>
      {/* Detailed information */}
      <div className="space-y-2 mb-4">
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Network:</span>
          <div className="flex items-center gap-1">
            {currentIsOnline ? (
              <Wifi className="h-3 w-3 text-green-500" />
            ) : (
              <WifiOff className="h-3 w-3 text-red-500" />
            )}
            <span
              className={currentIsOnline ? "text-green-500" : "text-red-500"}
            >
              {currentIsOnline ? "Online" : "Offline"}
            </span>
          </div>
        </div>{" "}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Pending records:</span>
          <span className="font-medium text-gray-900">
            {currentQueueLength}
          </span>
        </div>
        {currentLastSync && (
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Last sync:</span>
            <span className="text-gray-900">{formatTime(currentLastSync)}</span>
          </div>
        )}
        <div className="flex justify-between text-sm">
          <span className="text-gray-600">Next scheduled:</span>
          <span className="text-gray-900">{formatTime(nextSyncTime)}</span>
        </div>
      </div>{" "}
      {/* Status message and sync button */}
      <div className="space-y-3">
        {!currentIsOnline && (
          <p className="text-sm text-red-600 bg-red-50 p-2 rounded flex items-center gap-2">
            <AlertCircle className="h-4 w-4" />
            You're offline. Records will sync when connection is restored.
          </p>
        )}
        {currentQueueLength > 0 && currentIsOnline && (
          <p className="text-sm text-amber-600 bg-amber-50 p-2 rounded flex items-center gap-2">
            <Clock className="h-4 w-4" />
            {currentQueueLength} record{currentQueueLength !== 1 ? "s" : ""}{" "}
            waiting to sync.
          </p>
        )}
        {currentQueueLength === 0 && currentIsOnline && (
          <p className="text-sm text-green-600 bg-green-50 p-2 rounded flex items-center gap-2">
            <CheckCircle className="h-4 w-4" />
            All records are synchronized.
          </p>
        )}{" "}
        <button
          onClick={handleManualSync}
          disabled={
            currentIsSyncing || currentQueueLength === 0 || !currentIsOnline
          }
          className="w-full px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
        >
          {currentIsSyncing ? (
            <>
              <RefreshCw className="h-4 w-4 animate-spin" />
              Syncing...
            </>
          ) : (
            <>
              <RefreshCw className="h-4 w-4" />
              Sync Now
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SyncStatus;
