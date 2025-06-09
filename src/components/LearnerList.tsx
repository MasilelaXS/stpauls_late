import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { User } from "lucide-react";
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
  const navigate = useNavigate();

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
      <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-gray-200 border-t-blue-600 mx-auto"></div>
        <p className="mt-4 text-gray-600 font-medium">Loading learners...</p>
      </div>
    );
  }

  if (displayLearners.length === 0) {
    return (
      <div className="p-8 text-center bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <User className="h-8 w-8 text-gray-400" />
        </div>
        <p className="text-gray-600 font-medium">
          {showSearchResults
            ? "No learners found matching your search."
            : "No learners found. Add some learners to get started."}
        </p>
      </div>
    );
  } // Avatar component for initials
  const Avatar = ({ name }: { name: string }) => {
    const initials = name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);

    // Generate a subtle color based on the name
    const colors = [
      "bg-blue-100 text-blue-700",
      "bg-green-100 text-green-700",
      "bg-purple-100 text-purple-700",
      "bg-orange-100 text-orange-700",
      "bg-pink-100 text-pink-700",
      "bg-indigo-100 text-indigo-700",
      "bg-teal-100 text-teal-700",
      "bg-red-100 text-red-700",
    ];
    const colorIndex = name.charCodeAt(0) % colors.length;

    return (
      <div
        className={`w-12 h-12 rounded-full ${colors[colorIndex]} flex items-center justify-center font-semibold text-sm flex-shrink-0`}
      >
        {initials}
      </div>
    );
  };
  return (
    <div className="h-full flex flex-col bg-white border border-gray-200 rounded-lg shadow-sm">
      {showSearchResults && (
        <div className="flex-shrink-0 px-6 py-4 bg-gray-50/50 border-b border-gray-200 rounded-t-lg">
          <p className="text-sm font-medium text-gray-700">
            {displayLearners.length} result
            {displayLearners.length !== 1 ? "s" : ""} found
          </p>
        </div>
      )}
      {/* Clean flat list */}
      <div className="flex-1 overflow-y-auto">
        <div className="divide-y divide-gray-100">
          {displayLearners.map((learner) => {
            const fullName = `${learner.first_name} ${learner.last_name}`;
            const isInQueue = isLearnerInQueue?.(learner.id!) || false;
            const isDisabled =
              !learner.id || markingLate === learner.id || isInQueue;

            return (
              <div
                key={learner.id}
                className="px-6 py-4 hover:bg-gray-50/50 transition-all duration-200"
              >
                <div className="flex items-center justify-between">
                  {/* Left: Avatar and Info */}
                  <div className="flex items-center space-x-4 flex-1 min-w-0">
                    <Avatar name={fullName} />

                    {/* Info */}
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900 text-base leading-tight">
                        {fullName}
                      </h3>
                      <p className="text-sm text-gray-500 italic mt-1">
                        ID: {learner.student_number}
                      </p>
                      <div className="flex items-center space-x-6 mt-2">
                        <span className="text-sm text-gray-600">
                          Grade {learner.grade}
                        </span>
                        <span className="text-sm text-gray-600">
                          {learner.gender}
                        </span>
                      </div>
                    </div>
                  </div>{" "}
                  {/* Right: Actions */}
                  <div className="flex items-center space-x-3 flex-shrink-0">
                    <button
                      onClick={() => navigate(`/learner/${learner.id}`)}
                      className="text-sm text-gray-600 hover:text-blue-600 px-3 py-2 rounded-lg hover:bg-blue-50 transition-all duration-200 font-medium"
                      title="View details"
                    >
                      View
                    </button>

                    <button
                      onClick={() => handleMarkLate(learner.id!)}
                      disabled={isDisabled}
                      className={`text-sm px-4 py-2 rounded-lg font-medium transition-all duration-200 ${
                        isInQueue
                          ? "text-gray-400 bg-gray-100 cursor-not-allowed"
                          : "text-red-600 hover:text-white hover:bg-red-600 border border-red-200 hover:border-red-600"
                      }`}
                      title={isInQueue ? "Already marked" : "Mark as late"}
                    >
                      {markingLate === learner.id ? (
                        <span className="flex items-center space-x-1">
                          <div className="w-3 h-3 border border-current border-t-transparent rounded-full animate-spin"></div>
                          <span>Marking...</span>
                        </span>
                      ) : isInQueue ? (
                        "Pending"
                      ) : (
                        "Mark Late"
                      )}
                    </button>
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
