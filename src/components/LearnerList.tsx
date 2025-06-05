import { useState, useMemo } from "react";
import { Clock, User } from "lucide-react";
import { type Learner } from "../services/localDB";

interface LearnerListProps {
  searchResults?: Learner[];
  showSearchResults?: boolean;
  allLearners?: Learner[];
  isLoading?: boolean;
  onMarkLate: (learnerId: number) => Promise<void>; // now required
  isLearnerInQueue?: (learnerId: number) => boolean; // check if learner is in queue
}

const LearnerList: React.FC<LearnerListProps> = ({
  searchResults = [],
  showSearchResults = false,
  allLearners = [],
  isLoading = false,
  onMarkLate,
  isLearnerInQueue,
}) => {
  const [markingLate, setMarkingLate] = useState<number | null>(null);

  // Determine which learners to display using useMemo to prevent unnecessary re-renders
  const displayLearners = useMemo(() => {
    return showSearchResults ? searchResults : allLearners;
  }, [showSearchResults, searchResults, allLearners]);

  const handleMarkLate = async (learnerId: number) => {
    if (!learnerId || markingLate === learnerId) {
      return;
    }

    setMarkingLate(learnerId);

    try {
      await onMarkLate(learnerId);
    } catch (error) {
      console.error("Error marking learner as late:", error);
    } finally {
      setMarkingLate(null);
    }
  };
  if (isLoading) {
    return (
      <div className="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-300 mx-auto"></div>
        <p className="mt-2 text-gray-600">Loading learners...</p>
      </div>
    );
  }
  if (displayLearners.length === 0) {
    return (
      <div className="p-4 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <User className="h-12 w-12 text-gray-400 mx-auto mb-2" />
        <p className="text-gray-600">
          {showSearchResults
            ? "No learners found matching your search."
            : "No learners found. Add some learners to get started."}
        </p>
      </div>
    );
  }
  // Avatar component for initials
  const Avatar = ({ name }: { name: string }) => {
    const initials = name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Generate a consistent color based on the name using grey palette
    const colors = [
      "bg-gray-400",
      "bg-slate-400",
      "bg-zinc-400",
      "bg-neutral-400",
      "bg-gray-500",
      "bg-slate-500",
      "bg-zinc-500",
      "bg-neutral-500",
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;

    return (
      <div
        className={`w-12 h-12 rounded-full ${colors[colorIndex]} flex items-center justify-center text-white font-medium text-sm flex-shrink-0`}
      >
        {initials}
      </div>
    );
  };
  return (
    <div className="h-full flex flex-col rounded-lg border border-gray-200 bg-white shadow-sm">
      {showSearchResults && (
        <div className="flex-shrink-0 p-2 bg-gray-100 border-b border-gray-200">
          <p className="text-sm text-gray-700">
            Showing {displayLearners.length} search result
            {displayLearners.length !== 1 ? "s" : ""}
          </p>
        </div>
      )}
      {/* WhatsApp-style list for all screen sizes */}
      <div className="flex-1 overflow-y-auto min-h-0 hide-scrollbar">
        <div className="divide-y divide-gray-100">
          {displayLearners.map((learner) => {
            const fullName = `${learner.first_name} ${learner.last_name}`;
            const isInQueue = isLearnerInQueue?.(learner.id!) || false;
            const isDisabled =
              !learner.id || markingLate === learner.id || isInQueue;
            return (
              <div
                key={learner.id}
                className="bg-white border-b border-gray-100 last:border-b-0 p-3 hover:bg-gray-50 transition-all duration-200"
              >
                <div className="flex items-center space-x-3">
                  {/* Avatar */}
                  <Avatar name={fullName} />

                  {/* Learner Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-medium text-gray-900 truncate text-lg">
                        {fullName}
                      </h3>
                      <div className="hidden sm:flex items-center space-x-2 text-sm text-gray-600">
                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                          Grade {learner.grade}
                        </span>
                        <span className="bg-gray-100 px-2 py-1 rounded text-gray-700">
                          {learner.gender}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-1">
                      <div className="flex flex-col sm:flex-row sm:items-center sm:space-x-4">
                        <p className="text-sm text-gray-600">
                          ID: {learner.student_number}
                        </p>
                        <div className="sm:hidden flex items-center space-x-2 mt-1">
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                            Grade {learner.grade}
                          </span>
                          <span className="text-xs bg-gray-100 px-2 py-1 rounded text-gray-700">
                            {learner.gender}
                          </span>
                        </div>
                      </div>{" "}
                      {/* Action Button */}
                      <button
                        onClick={() => handleMarkLate(learner.id!)}
                        className={`px-4 py-2 text-sm font-medium rounded-lg focus:outline-none focus:ring-2 focus:ring-offset-1 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap flex items-center gap-2 ${
                          isInQueue
                            ? "bg-gray-300 text-gray-600"
                            : "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500"
                        }`}
                        disabled={isDisabled}
                        title={
                          isInQueue
                            ? "Already marked late (pending sync)"
                            : "Mark learner as late"
                        }
                      >
                        <Clock className="h-4 w-4" />
                        {markingLate === learner.id
                          ? "Marking..."
                          : isInQueue
                          ? "Pending"
                          : "Mark Late"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default LearnerList;
