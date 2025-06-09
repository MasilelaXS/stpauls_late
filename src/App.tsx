import { useEffect } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Home from "@/pages/Home";
import Login from "@/pages/Login";
import ViewReport from "@/pages/ViewReport";
import LearnerDetails from "@/pages/LearnerDetails";
import ProtectedRoute from "@/components/ProtectedRoute";
import PWAUpdateNotification from "@/components/PWAUpdateNotification";
import { Toaster } from "@/components/ui/sonner";
import { useAuth } from "./contexts/AuthContext";
import { startSyncManager, stopSyncManager } from "./services/syncManager";
import { isLoggedIn } from "./services/session";

function App() {
  const { isLoading } = useAuth();

  // Check if user is logged in using session management
  const userLoggedIn = isLoggedIn();

  // Initialize sync manager at the app level
  useEffect(() => {
    // Only start sync manager if user is authenticated
    if (userLoggedIn) {
      startSyncManager();
    }

    // Clean up when app unmounts or user logs out
    return () => {
      stopSyncManager();
    };
  }, [userLoggedIn]);

  // Show loading spinner while checking authentication
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Routes>
        {/* Login route - redirect to home if already logged in */}
        <Route
          path="/login"
          element={userLoggedIn ? <Navigate to="/" replace /> : <Login />}
        />

        {/* Protected home route - show home if logged in (online or offline), else redirect to login */}
        <Route
          path="/"
          element={
            userLoggedIn ? (
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Protected reports route - only accessible when logged in */}
        <Route
          path="/reports"
          element={
            userLoggedIn ? (
              <ProtectedRoute>
                <ViewReport />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Protected learner details route - only accessible when logged in */}
        <Route
          path="/learner/:id"
          element={
            userLoggedIn ? (
              <ProtectedRoute>
                <LearnerDetails />
              </ProtectedRoute>
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* Catch all route - redirect based on login status */}
        <Route
          path="*"
          element={<Navigate to={userLoggedIn ? "/" : "/login"} replace />}
        />
      </Routes>

      <PWAUpdateNotification />
      <Toaster />
    </div>
  );
}

export default App;
