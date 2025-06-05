import React, { useState, useEffect, useCallback } from "react";
import { Search, X } from "lucide-react";
import { searchLearners } from "../services/api";
import type { Learner } from "../services/localDB";

interface SearchBarProps {
  onSearchResults?: (results: Learner[]) => void;
  onLoading?: (loading: boolean) => void;
  onError?: (error: string) => void;
  onClearSearch?: () => void; // New prop for handling clear
  localLearners?: Learner[];
  useLocalSearch?: boolean;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearchResults,
  onLoading,
  onError,
  onClearSearch,
  localLearners = [],
  useLocalSearch = false,
}) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [isSearching, setIsSearching] = useState(false);

  // Local search function with useCallback to prevent unnecessary re-renders
  const performLocalSearch = useCallback(
    (term: string): Learner[] => {
      if (!term.trim()) return [];

      const searchTermLower = term.toLowerCase().trim();
      return localLearners.filter((learner) => {
        const fullName =
          `${learner.first_name} ${learner.last_name}`.toLowerCase();
        const reverseName =
          `${learner.last_name} ${learner.first_name}`.toLowerCase();
        const studentNumber =
          learner.student_number?.toString().toLowerCase() || "";

        return (
          learner.first_name.toLowerCase().includes(searchTermLower) ||
          learner.last_name.toLowerCase().includes(searchTermLower) ||
          fullName.includes(searchTermLower) ||
          reverseName.includes(searchTermLower) ||
          studentNumber.includes(searchTermLower)
        );
      });
    },
    [localLearners]
  ); // Handle real-time local search as user types
  useEffect(() => {
    if (!useLocalSearch) return;

    // Only trigger search if there's actually a search term
    if (!searchTerm.trim()) {
      return;
    }

    const timeoutId = setTimeout(() => {
      const results = performLocalSearch(searchTerm);
      onSearchResults?.(results);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchTerm, useLocalSearch, onSearchResults, performLocalSearch]);

  // Clear search results when search term becomes empty
  useEffect(() => {
    if (!useLocalSearch) return;

    if (!searchTerm.trim()) {
      // Don't trigger onSearchResults when clearing - let the parent handle this
      // onSearchResults?.([]);
    }
  }, [searchTerm, useLocalSearch]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!searchTerm.trim()) {
      onError?.("Please enter a search term");
      return;
    }

    // If using local search, perform immediate local search
    if (useLocalSearch) {
      setIsSearching(true);
      onLoading?.(true);

      try {
        const results = performLocalSearch(searchTerm);
        onSearchResults?.(results);
        onError?.(""); // Clear any previous errors
      } catch (error) {
        console.error("Local search failed:", error);
        onError?.("Search failed. Please try again.");
      } finally {
        setIsSearching(false);
        onLoading?.(false);
      }
      return;
    }

    // Original API search functionality
    setIsSearching(true);
    onLoading?.(true);

    try {
      const results = await searchLearners(searchTerm.trim());
      onSearchResults?.(results);
      onError?.(""); // Clear any previous errors
    } catch (error) {
      console.error("Search failed:", error);
      onError?.(
        error instanceof Error
          ? error.message
          : "Search failed. Please try again."
      );
    } finally {
      setIsSearching(false);
      onLoading?.(false);
    }
  };
  const handleClear = () => {
    setSearchTerm("");
    // Call the clear callback instead of setting empty search results
    onClearSearch?.();
    onError?.("");
  };
  return (
    <div className="space-y-2">
      {" "}
      <form onSubmit={handleSearch} className="flex gap-2">
        <div className="flex-grow relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={
              useLocalSearch
                ? "Search locally by name or student number..."
                : "Search by name or student number..."
            }
            className="w-full pl-10 pr-4 py-2 border border-gray-300 bg-white rounded focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 text-gray-900 placeholder-gray-500"
            disabled={isSearching}
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-300 disabled:opacity-50 transition-colors flex items-center gap-2"
          disabled={isSearching || !searchTerm.trim()}
        >
          <Search className="h-4 w-4" />
          {isSearching ? "Searching..." : "Search"}
        </button>
        {searchTerm && (
          <button
            type="button"
            onClick={handleClear}
            className="px-4 py-2 bg-gray-500 text-white rounded hover:bg-gray-600 disabled:opacity-50 transition-colors flex items-center gap-2"
            disabled={isSearching}
          >
            <X className="h-4 w-4" />
            Clear
          </button>
        )}
      </form>{" "}
      {/* Search mode indicator */}
      {useLocalSearch && (
        <div className="text-xs text-gray-500 flex items-center">
          <span className="inline-block w-2 h-2 bg-green-500 rounded-full mr-2"></span>
          Local search mode - searching {localLearners.length} cached learners
        </div>
      )}
    </div>
  );
};

export default SearchBar;
