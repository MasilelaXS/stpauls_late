import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Menu,
  BarChart3,
  Settings,
  FileText,
  Download,
  LogOut,
  Wifi,
  WifiOff,
  RefreshCw,
} from "lucide-react";
import SyncStatus from "@/components/SyncStatus";
import LearnerList from "@/components/LearnerList";
import SearchBar from "@/components/SearchBar";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { useAuth } from "../contexts/AuthContext";
import { useOfflineQueue } from "../hooks/useOfflineQueue";
import { type Learner, getLearners, cacheLearners } from "../services/localDB";
import { getAllLearners, checkApiStatus } from "../services/api";

const Home = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [searchResults, setSearchResults] = useState<Learner[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string>("");
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [allLearners, setAllLearners] = useState<Learner[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [lastSync, setLastSync] = useState<Date | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  // Use the offline queue hook
  const {
    queueLength,
    addLate,
    syncQueue,
    isSyncing,
    isLearnerInQueue,
    refreshQueue,
  } = useOfflineQueue();

  // Memoize allLearners to prevent unnecessary re-renders in child components
  const memoizedAllLearners = useMemo(() => allLearners, [allLearners]);

  const handleSearchResults = useCallback((results: Learner[]) => {
    setSearchResults(results);
    setShowSearchResults(true);
  }, []);

  const handleSearchLoading = useCallback((loading: boolean) => {
    setIsSearching(loading);
  }, []);

  const handleSearchError = useCallback((error: string) => {
    setSearchError(error);
    if (error) {
      setShowSearchResults(false);
    }
  }, []);
  const clearSearch = useCallback(() => {
    setSearchResults([]);
    setShowSearchResults(false);
    setSearchError("");
  }, []);

  // Function to refresh all data after sync
  const refreshAllData = useCallback(async () => {
    try {
      // Refresh the offline queue
      await refreshQueue();

      // Reload learners data
      setIsLoading(true);
      const apiOnline = await checkApiStatus();
      setIsOnline(apiOnline);

      if (apiOnline) {
        try {
          const apiLearners = await getAllLearners(1);
          await cacheLearners(apiLearners);
          setAllLearners(apiLearners);
          setLastSync(new Date());
          console.log(
            `Refreshed ${apiLearners.length} learners from API after sync`
          );
        } catch (apiError) {
          console.warn(
            "Failed to refresh from API, using local cache:",
            apiError
          );
          const localLearners = await getLearners();
          setAllLearners(localLearners);
        }
      } else {
        const localLearners = await getLearners();
        setAllLearners(localLearners);
      }
    } catch (error) {
      console.error("Failed to refresh data after sync:", error);
    } finally {
      setIsLoading(false);
    }
  }, [refreshQueue]);

  // Load learners data on mount
  useEffect(() => {
    const loadLearners = async () => {
      setIsLoading(true);
      try {
        // Check if we're online
        const apiOnline = await checkApiStatus();
        setIsOnline(apiOnline);

        if (apiOnline) {
          // Try to load from API first
          try {
            const apiLearners = await getAllLearners(1);
            await cacheLearners(apiLearners);
            setAllLearners(apiLearners);
            setLastSync(new Date());
            console.log(`Loaded ${apiLearners.length} learners from API`);
          } catch (apiError) {
            console.warn(
              "Failed to load from API, falling back to local cache:",
              apiError
            );
            // Fall back to local cache
            const localLearners = await getLearners();
            setAllLearners(localLearners);
          }
        } else {
          // Load from local cache when offline
          const localLearners = await getLearners();
          setAllLearners(localLearners);
          console.log(
            `Loaded ${localLearners.length} learners from local cache`
          );
        }

        // Reset search state when learners are loaded to prevent flashing
        setShowSearchResults(false);
        setSearchResults([]);
        setSearchError("");
      } catch (error) {
        console.error("Failed to load learners:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadLearners();
  }, []);
  // Listen for online/offline status changes
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    // Listen for automatic sync completion
    const handleSyncCompleted = (event: CustomEvent) => {
      console.log("Automatic sync completed:", event.detail);
      setLastSync(new Date());
      // Refresh all data after automatic sync
      refreshAllData();
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener(
      "syncCompleted",
      handleSyncCompleted as EventListener
    );

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener(
        "syncCompleted",
        handleSyncCompleted as EventListener
      );
    };
  }, [refreshAllData]);

  // Handle marking a learner as late
  const handleMarkLate = useCallback(
    async (learnerId: number) => {
      const success = await addLate(learnerId);
      if (success) {
        console.log(`Learner ${learnerId} marked as late and added to queue`);
        // You could add a toast notification here
      }
    },
    [addLate]
  );
  // Handle manual sync
  const handleSyncNow = async () => {
    const result = await syncQueue();
    if (result) {
      setLastSync(new Date());
      console.log(
        `Sync completed: ${result.success} successful, ${result.failed} failed`
      );

      // Refresh all data after sync to ensure UI is up to date
      await refreshAllData();

      // You could add a toast notification here
    }
  };
  return (
    <div className="h-screen flex flex-col overflow-hidden bg-gray-50">
      {/* Fixed Header - 60px fixed height for consistency */}
      <div className="bg-white border-b border-gray-200 h-[60px] flex-shrink-0 shadow-sm">
        <div className="container mx-auto px-4 h-full flex items-center justify-between">
          {/* App title and status */}
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900">
                St. Paul's Late Tracker
              </h1>
            </div>
          </div>

          {/* Right side - User info, menu button, and logout */}
          <div className="flex items-center gap-4">
            {" "}
            {/* Mobile Menu Button - Visible on medium and small screens */}
            <Dialog open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
              <DialogTrigger asChild>
                <button className="lg:hidden p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <Menu className="h-5 w-5 text-gray-700" />
                </button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md max-h-[80vh] flex flex-col bg-white border-gray-200">
                <DialogHeader className="flex-shrink-0">
                  <DialogTitle className="text-gray-900">
                    App Information
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-6 flex-1 overflow-y-auto pr-1">
                  {/* Status Information */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      {isOnline ? (
                        <Wifi className="h-4 w-4 text-green-600" />
                      ) : (
                        <WifiOff className="h-4 w-4 text-red-600" />
                      )}
                      <h3 className="font-semibold text-gray-900">Status</h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {isOnline ? "Online" : "Offline"} •{" "}
                        {memoizedAllLearners.length} learners loaded
                      </span>
                    </div>
                  </div>
                  {/* Sync Status */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <RefreshCw className="h-4 w-4 text-gray-700" />
                      <h3 className="font-semibold text-gray-900">
                        Sync Status
                      </h3>
                    </div>
                    <SyncStatus
                      queueLength={queueLength}
                      isOnline={isOnline}
                      lastSync={lastSync}
                      onSyncNow={handleSyncNow}
                      isSyncing={isSyncing}
                    />
                  </div>{" "}
                  {/* Quick Stats */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="h-4 w-4 text-gray-700" />
                      <h3 className="font-semibold text-gray-900">
                        Quick Stats
                      </h3>
                    </div>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Today's late arrivals:
                        </span>
                        <span className="font-medium text-gray-900">0</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          This week's late arrivals:
                        </span>
                        <span className="font-medium text-gray-900">0</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">
                          Pending sync:
                        </span>
                        <span
                          className={`font-medium ${
                            queueLength > 0
                              ? "text-amber-600"
                              : "text-green-600"
                          }`}
                        >
                          {queueLength} record{queueLength !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>{" "}
                  {/* Quick Actions */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Settings className="h-4 w-4 text-gray-700" />
                      <h3 className="font-semibold text-gray-900">
                        Quick Actions
                      </h3>
                    </div>{" "}
                    <div className="space-y-2">
                      <button
                        onClick={() => {
                          navigate("/reports");
                          setIsMobileMenuOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-2 text-gray-700"
                      >
                        <FileText className="h-4 w-4" />
                        View Late Report
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-2 text-gray-700">
                        <Download className="h-4 w-4" />
                        Export Data
                      </button>
                      <button className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded transition-colors flex items-center gap-2 text-gray-700">
                        <Settings className="h-4 w-4" />
                        Settings
                      </button>                    </div>
                  </div>
                  
                  {/* Powered by Dannel Web - Mobile Menu */}
                  <div className="text-center pt-4 border-t border-gray-200">
                    <a 
                      href="https://dannel.co.za" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                    >
                      Powered by Dannel Web
                    </a>
                  </div>
                </div>
              </DialogContent>
            </Dialog>{" "}
            <span className="hidden lg:block text-sm text-gray-600">
              Welcome, {user?.username || "User"}
            </span>
            <button
              onClick={() => {
                logout();
                navigate("/login");
              }}
              className="px-3 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </div>
      </div>{" "}
      {/* Main Content Area - flex-1 to fill remaining space */}
      <div className="flex-1 container mx-auto px-4 py-4 min-h-0 flex flex-col">
        <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 min-h-0">
          {/* Left Panel - takes up 2/3 of the width on large screens */}
          <div className="lg:col-span-2 flex flex-col min-h-0">
            {/* Search Bar - fixed height */}
            <div className="flex-shrink-0 mb-4">
              <SearchBar
                onSearchResults={handleSearchResults}
                onLoading={handleSearchLoading}
                onError={handleSearchError}
                onClearSearch={clearSearch}
                localLearners={memoizedAllLearners}
                useLocalSearch={!isOnline || memoizedAllLearners.length > 0}
              />
              {/* Search status and controls */}{" "}
              {showSearchResults && (
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-sm text-gray-600">
                    {isSearching
                      ? "Searching..."
                      : `Found ${searchResults.length} result(s)`}
                  </span>
                  <button
                    onClick={clearSearch}
                    className="text-sm text-red-600 hover:text-red-500 transition-colors"
                  >
                    Show All Learners
                  </button>
                </div>
              )}
              {/* Search error display */}
              {searchError && (
                <div className="mt-2 p-2 bg-red-50 border border-red-200 text-red-700 rounded text-sm">
                  {searchError}
                </div>
              )}
            </div>
            {/* Learner List Container - flex-1 to fill remaining space (scrollable) */}
            <div
              className="flex-1 min-h-0"
              style={{ height: "calc(100vh - 160px)" }}
            >
              <LearnerList
                searchResults={searchResults}
                showSearchResults={showSearchResults}
                allLearners={memoizedAllLearners}
                isLoading={isLoading}
                onMarkLate={handleMarkLate}
                isLearnerInQueue={isLearnerInQueue}
              />
            </div>
          </div>
          {/* Right Panel - takes up 1/3 of the width on large screens, hidden on medium and small */}
          <div className="hidden lg:flex lg:col-span-1 min-h-0 flex-col">
            {/* Accordion for collapsible sections */}
            <Accordion
              type="multiple"
              defaultValue={["sync"]}
              className="w-full h-full overflow-y-auto"
            >
              {" "}
              <AccordionItem
                value="sync"
                className="bg-white rounded-lg border border-gray-200 mb-2 shadow-sm"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-4 w-4 text-gray-700" />
                    <span className="text-lg font-semibold text-gray-900">
                      Sync Status
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <SyncStatus
                    queueLength={queueLength}
                    isOnline={isOnline}
                    lastSync={lastSync}
                    onSyncNow={handleSyncNow}
                    isSyncing={isSyncing}
                  />
                </AccordionContent>
              </AccordionItem>{" "}
              <AccordionItem
                value="stats"
                className="bg-white rounded-lg border border-gray-200 mb-2 shadow-sm"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-4 w-4 text-gray-700" />
                    <span className="text-lg font-semibold text-gray-900">
                      Quick Stats
                    </span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Today's late arrivals:
                      </span>
                      <span className="font-medium text-gray-900">0</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        This week's late arrivals:
                      </span>
                      <span className="font-medium text-gray-900">0</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-600">
                        Pending sync:
                      </span>
                      <span
                        className={`font-medium ${
                          queueLength > 0 ? "text-amber-600" : "text-green-600"
                        }`}
                      >
                        {queueLength} record{queueLength !== 1 ? "s" : ""}
                      </span>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>{" "}
              <AccordionItem
                value="actions"
                className="bg-white rounded-lg border border-gray-200 shadow-sm"
              >
                <AccordionTrigger className="px-4 py-3 hover:no-underline">
                  <div className="flex items-center gap-2">
                    <Settings className="h-4 w-4 text-gray-700" />
                    <span className="text-lg font-semibold text-gray-900">
                      Quick Actions
                    </span>
                  </div>
                </AccordionTrigger>{" "}
                <AccordionContent className="px-4 pb-4">
                  <div className="space-y-2">
                    <button
                      onClick={() => navigate("/reports")}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors flex items-center gap-2 text-gray-700"
                    >
                      <FileText className="h-4 w-4" />
                      View Late Report
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors flex items-center gap-2 text-gray-700">
                      <Download className="h-4 w-4" />
                      Export Data
                    </button>
                    <button className="w-full text-left px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded transition-colors flex items-center gap-2 text-gray-700">
                      <Settings className="h-4 w-4" />
                      Settings
                    </button>
                  </div>                </AccordionContent>
              </AccordionItem>
            </Accordion>
            
            {/* Powered by Dannel Web - Desktop */}
            <div className="mt-4 text-center">
              <a 
                href="https://dannel.co.za" 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
              >
                Powered by Dannel Web
              </a>
            </div>
          </div>
        </div>
      </div>
      
      {/* Powered by Dannel Web - Mobile (fixed at bottom) */}
      <div className="lg:hidden fixed bottom-4 left-0 right-0 text-center z-10">
        <a 
          href="https://dannel.co.za" 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-xs text-gray-500 hover:text-gray-700 transition-colors bg-white px-3 py-1 rounded-full shadow-sm border border-gray-200"
        >
          Powered by Dannel Web
        </a>
      </div>
    </div>
  );
};

export default Home;
