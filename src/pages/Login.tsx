import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  login,
  checkUser,
  setPassword as setUserPassword,
  setAuthToken,
} from "../services/api";
import { setSession, isLoggedIn, isOfflineMode } from "../services/session";

type LoginStep = "username" | "password" | "setPassword";

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login: authLogin } = useAuth();
  // Form state
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  // UI state
  const [currentStep, setCurrentStep] = useState<LoginStep>("username");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  // Get the intended destination after login
  const from =
    (location.state as { from?: { pathname: string } })?.from?.pathname || "/";

  // Check offline status and existing session on mount
  useEffect(() => {
    const isOffline = isOfflineMode();
    const hasSession = isLoggedIn();

    if (isOffline) {
      if (hasSession) {
        // If offline but has valid session, redirect to home
        navigate(from, { replace: true });
      } else {
        // If offline and no session, show error
        setError(
          "You are offline and have no saved session. Please connect to the internet to log in."
        );
      }
    }
  }, [navigate, from]);
  const handleUsernameSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Check if offline
      if (isOfflineMode()) {
        throw new Error(
          "You are offline. Please connect to the internet to verify your username."
        );
      }

      if (!username.trim()) {
        throw new Error("Please enter your username");
      }
      const response = await checkUser(username.trim());

      if (response.success) {
        if (response.exists) {
          if (response.hasPassword) {
            setCurrentStep("password");
          } else {
            setCurrentStep("setPassword");
          }
        } else {
          throw new Error(
            "Username not found. Please contact your administrator."
          );
        }
      } else {
        throw new Error(response.message || "Unable to verify username");
      }
    } catch (error) {
      console.error("Username check failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to check username. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Check if offline
      if (isOfflineMode()) {
        throw new Error(
          "You are offline. Please connect to the internet to log in."
        );
      }

      if (!loginPassword) {
        throw new Error("Please enter your password");
      }
      const response = await login(username, loginPassword);
      if (response.success && response.token) {
        // Set the authentication token and session
        setAuthToken(response.token);

        // Use session management to store user data
        if (response.user?.id) {
          // Call setSession with user_id as requested
          setSession(
            response.user.id,
            response.user.username || username,
            response.token
          );

          // Use the auth context to set user state
          authLogin({
            id: response.user.id.toString(),
            username: response.user.username || username,
          });
        }

        console.log("Login successful:", response.user);

        // Navigate to intended destination or home
        navigate(from, { replace: true });
      } else {
        throw new Error(response.message || "Login failed");
      }
    } catch (error) {
      console.error("Login failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Login failed. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Check if offline
      if (isOfflineMode()) {
        throw new Error(
          "You are offline. Please connect to the internet to set your password."
        );
      }

      if (!password) {
        throw new Error("Please enter a password");
      }

      if (password.length < 6) {
        throw new Error("Password must be at least 6 characters long");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }
      const response = await setUserPassword(username, password);
      if (response.success && response.token) {
        // Set the authentication token and session
        setAuthToken(response.token);

        // Use session management to store user data
        if (response.user?.id) {
          // Call setSession with user_id as requested
          setSession(
            response.user.id,
            response.user.username || username,
            response.token
          );

          // Use the auth context to set user state
          authLogin({
            id: response.user.id.toString(),
            username: response.user.username || username,
          });
        }

        console.log("Password set and login successful:", response.user);

        // Navigate to intended destination or home
        navigate(from, { replace: true });
      } else {
        throw new Error(response.message || "Failed to set password");
      }
    } catch (error) {
      console.error("Set password failed:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Failed to set password. Please try again."
      );
    } finally {
      setIsLoading(false);
    }
  };
  const handleBack = () => {
    setCurrentStep("username");
    setError("");
    setLoginPassword("");
    setPassword("");
    setConfirmPassword("");
  };

  const renderUsernameStep = () => (
    <form onSubmit={handleUsernameSubmit}>
      <div className="mb-6">
        <label
          htmlFor="username"
          className="block text-gray-700 mb-2 font-medium"
        >
          Username
        </label>
        <input
          id="username"
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Enter your username"
          disabled={isLoading}
          required
          autoComplete="username"
        />{" "}
      </div>

      <button
        type="submit"
        className="w-full p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 font-medium transition-colors"
        disabled={isLoading}
      >
        {isLoading ? "Checking..." : "Continue"}
      </button>
    </form>
  );

  const renderPasswordStep = () => (
    <form onSubmit={handlePasswordLogin}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-gray-600">Username:</span>
          <span className="text-sm font-medium">{username}</span>
        </div>
      </div>
      <div className="mb-6">
        <label
          htmlFor="loginPassword"
          className="block text-gray-700 mb-2 font-medium"
        >
          Password
        </label>
        <input
          id="loginPassword"
          type="password"
          value={loginPassword}
          onChange={(e) => setLoginPassword(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Enter your password"
          disabled={isLoading}
          required
          autoComplete="current-password"
        />
      </div>{" "}
      <div className="space-y-3">
        <button
          type="submit"
          className="w-full p-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:bg-red-300 font-medium transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "Logging in..." : "Log In"}
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="w-full p-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
          disabled={isLoading}
        >
          Back
        </button>
      </div>
    </form>
  );
  const renderSetPasswordStep = () => (
    <form onSubmit={handleSetPassword}>
      <div className="mb-4">
        <div className="flex items-center justify-between mb-4">
          <span className="text-sm text-gray-600">Username:</span>
          <span className="text-sm font-medium">{username}</span>
        </div>{" "}
        <div className="p-3 bg-red-50 text-red-800 rounded-lg text-sm">
          <strong>Welcome!</strong> Please set a password for your account.
        </div>
      </div>

      <div className="mb-4">
        <label
          htmlFor="newPassword"
          className="block text-gray-700 mb-2 font-medium"
        >
          New Password
        </label>{" "}
        <input
          id="newPassword"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Enter a new password"
          disabled={isLoading}
          required
          minLength={6}
          autoComplete="new-password"
        />
        <p className="text-xs text-gray-500 mt-1">Minimum 6 characters</p>
      </div>

      <div className="mb-6">
        <label
          htmlFor="confirmPassword"
          className="block text-gray-700 mb-2 font-medium"
        >
          Confirm Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="w-full p-3 border rounded-lg focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
          placeholder="Confirm your password"
          disabled={isLoading}
          required
          minLength={6}
          autoComplete="new-password"
        />
      </div>

      <div className="space-y-3">
        <button
          type="submit"
          className="w-full p-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:bg-green-300 font-medium transition-colors"
          disabled={isLoading}
        >
          {isLoading ? "Setting Password..." : "Set Password & Continue"}
        </button>

        <button
          type="button"
          onClick={handleBack}
          className="w-full p-3 bg-gray-500 text-white rounded-lg hover:bg-gray-600 font-medium transition-colors"
          disabled={isLoading}
        >
          Back
        </button>
      </div>
    </form>
  );

  const getStepTitle = () => {
    switch (currentStep) {
      case "username":
        return "Sign In";
      case "password":
        return "Enter Password";
      case "setPassword":
        return "Set Your Password";
      default:
        return "Sign In";
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-100 px-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">
            St. Paul's School
          </h1>
          <p className="text-gray-600 mb-4">Attendance Management System</p>
          <h2 className="text-lg font-semibold text-gray-800">
            {getStepTitle()}
          </h2>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-100 text-red-700 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {currentStep === "username" && renderUsernameStep()}
        {currentStep === "password" && renderPasswordStep()}
        {currentStep === "setPassword" && renderSetPasswordStep()}

        <p className="mt-6 text-center text-gray-600 text-sm">
          © {new Date().getFullYear()} St. Paul's School
        </p>
      </div>
    </div>
  );
};

export default Login;
