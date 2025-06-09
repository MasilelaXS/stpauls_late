import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  User,
  Phone,
  TrendingUp,
  Clock,
  Award,
  MessageSquare,
  Paperclip,
  Send,
  Image as ImageIcon,
  Download,
  Printer,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useAuth } from "../contexts/AuthContext";
import {
  getLearnerOffences,
  recordLearnerOffence,
  downloadOffenceImage,
  getOffenceImagePrintUrl,
  type Offence,
} from "../services/api";
import {
  optimizeImage,
  formatFileSize,
  isValidImageFile,
  isFileSizeAcceptable,
} from "../utils/imageOptimization";

interface LearnerInfo {
  id: number;
  name: string;
  firstname: string;
  surname: string;
  grade: string;
  gender: string;
  accession_number: string;
  phone_home: string;
  phone_emergency: string;
  year_label: string;
}

interface LateStatistics {
  total_late_count: number;
  rank_among_peers: number;
  total_enrolled_students: number;
  attendance_rating: string;
  class_average: number;
  performance_vs_class: string;
  better_than_count: number;
  worse_than_count: number;
  first_late_date: string | null;
  last_late_date: string | null;
  time_statistics: {
    total_records: number;
    earliest_record: string;
    latest_record: string;
  };
}

interface MonthlyTrend {
  month: string;
  late_count: number;
}

interface RecentArrival {
  date: string;
  recorded_at: string;
  recorded_by: number;
}

interface OffenceStatistics {
  total_offence_count: number;
  behavioral_rating: string;
  class_offence_average: number;
  behavioral_performance: string;
}

interface OverallAssessment {
  overall_rating: string;
  attendance_rating: string;
  behavioral_rating: string;
  combined_rank: number;
}

interface RecentOffence {
  id: number;
  description: string;
  image_urls: {
    preview: string;
    download: string;
  };
  recorded_at: string;
}

interface LearnerSummary {
  success: boolean;
  learner_id: number;
  year_id: number;
  learner_info: LearnerInfo;
  late_statistics: LateStatistics;
  offence_statistics: OffenceStatistics;
  overall_assessment: OverallAssessment;
  monthly_trends: MonthlyTrend[];
  recent_late_arrivals: RecentArrival[];
  recent_offences: RecentOffence[];
}

const LearnerDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [learnerData, setLearnerData] = useState<LearnerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Offences state
  const [offences, setOffences] = useState<Offence[]>([]);
  const [offencesLoading, setOffencesLoading] = useState(false);
  const [newOffence, setNewOffence] = useState("");
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [submittingOffence, setSubmittingOffence] = useState(false);
  const [optimizingImage, setOptimizingImage] = useState(false);
  const [selectedImagePreview, setSelectedImagePreview] = useState<
    string | null
  >(null);
  const [currentOffenceId, setCurrentOffenceId] = useState<number | null>(null);
  const [imageDialogOpen, setImageDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchLearnerData = async () => {
      if (!id) {
        setError("No learner ID provided");
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `https://stpauls.ctecg.co.za/api/learners/summary.php?learner_id=${id}&year_id=1`
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data: LearnerSummary = await response.json();

        if (data.success) {
          setLearnerData(data);
        } else {
          setError("Failed to fetch learner data");
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : "An error occurred while fetching data"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchLearnerData();
  }, [id]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-ZA", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const formatDateTime = (dateTimeString: string) => {
    return new Date(dateTimeString).toLocaleString("en-ZA", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((word) => word.charAt(0))
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };
  const getPerformanceColor = (rating: string) => {
    switch (rating.toLowerCase()) {
      case "excellent":
        return "text-green-600 bg-green-50 border-green-200";
      case "good":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "average":
        return "text-yellow-600 bg-yellow-50 border-yellow-200";
      case "poor":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "very poor":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };
  // Fetch offences for the learner
  const fetchOffences = useCallback(async () => {
    if (!id || !learnerData?.year_id) return;

    setOffencesLoading(true);
    try {
      const response = await getLearnerOffences(
        parseInt(id),
        learnerData.year_id,
        50,
        0
      );
      setOffences(response.data);
    } catch (err) {
      console.error("Failed to fetch offences:", err);
    } finally {
      setOffencesLoading(false);
    }
  }, [id, learnerData?.year_id]); // Handle file selection with optimization
  const handleFileSelect = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];
    if (file) {
      // Validate file using utility functions
      if (!isValidImageFile(file)) {
        alert("Please select a valid image file (JPEG, PNG, GIF, or WebP)");
        return;
      }

      if (!isFileSizeAcceptable(file)) {
        alert("File size must be less than 10MB");
        return;
      }

      try {
        setOptimizingImage(true);

        console.log(`Original file: ${file.name}`);
        console.log(`Original file size: ${formatFileSize(file.size)}`);

        // Optimize the image using our utility function
        const result = await optimizeImage(file);

        console.log(
          `Optimized file size: ${formatFileSize(result.optimizedSize)}`
        );
        console.log(
          `Compression ratio: ${result.compressionRatio.toFixed(1)}%`
        );

        setSelectedImage(result.optimizedFile);
      } catch (error) {
        console.error("Error optimizing image:", error);
        alert("Failed to optimize image. Using original file.");
        setSelectedImage(file);
      } finally {
        setOptimizingImage(false);
      }
    }
  };

  // Submit new offence
  const handleSubmitOffence = async () => {
    if (!newOffence.trim() || !id || !learnerData?.year_id || !user?.id) return;

    setSubmittingOffence(true);
    try {
      await recordLearnerOffence(
        parseInt(id),
        learnerData.year_id,
        newOffence.trim(),
        parseInt(user.id),
        selectedImage || undefined
      );

      // Clear form
      setNewOffence("");
      setSelectedImage(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }

      // Refresh offences
      await fetchOffences();
    } catch (err) {
      console.error("Failed to record offence:", err);
      alert("Failed to record offence. Please try again.");
    } finally {
      setSubmittingOffence(false);
    }
  }; // Handle image preview
  const handleImageClick = (imagePath: string, offenceId: number) => {
    setSelectedImagePreview(`https://stpauls.ctecg.co.za/${imagePath}`);
    setCurrentOffenceId(offenceId);
    setImageDialogOpen(true);
  }; // Handle image download
  const handleDownloadImage = async () => {
    if (!currentOffenceId) return;

    try {
      await downloadOffenceImage(currentOffenceId);
    } catch (error) {
      console.error("Error downloading image:", error);
      alert("Failed to download image. Please try again.");
    }
  }; // Handle image print
  const handlePrintImage = () => {
    if (!currentOffenceId) return;

    const printWindow = window.open("", "_blank");
    if (printWindow) {
      const imageUrl = getOffenceImagePrintUrl(currentOffenceId);

      printWindow.document.write(`
        <html>
          <head>
            <title>Print Offence Image</title>
            <style>
              body {
                margin: 0;
                padding: 20px;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background: white;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
              }
              @media print {
                body {
                  padding: 0;
                }
                img {
                  width: 100%;
                  height: auto;
                }
              }
            </style>
          </head>
          <body>
            <img src="${imageUrl}" alt="Offence Evidence" onload="window.print(); window.close();" />
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  }; // Fetch offences when learner data is loaded
  useEffect(() => {
    if (learnerData && id) {
      fetchOffences();
    }
  }, [learnerData, id, fetchOffences]);
  // Auto-scroll to bottom when offences change
  useEffect(() => {
    if (messagesContainerRef.current && messagesEndRef.current) {
      messagesContainerRef.current.scrollTop =
        messagesContainerRef.current.scrollHeight;
    }
  }, [offences]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-2 border-gray-200 border-t-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">
            Loading learner details...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <User className="h-8 w-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            Error Loading Data
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button
            onClick={() => navigate(-1)}
            className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Go Back
          </button>
        </div>
      </div>
    );
  }

  if (!learnerData) {
    return null;
  }
  const {
    learner_info,
    late_statistics,
    offence_statistics,
    overall_assessment,
    monthly_trends,
    recent_late_arrivals,
    recent_offences,
  } = learnerData;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => navigate(-1)}
              className="inline-flex items-center text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="h-5 w-5 mr-2" />
              Back
            </button>
            <h1 className="text-xl font-semibold text-gray-900">
              Learner Details
            </h1>
            <div></div>
          </div>
        </div>
      </div>
      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Card */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              {/* Learner Header */}
              <div className="flex items-center space-x-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-lg">
                  {getInitials(learner_info.name)}
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-gray-900">
                    {learner_info.name}
                  </h2>
                  <p className="text-gray-600 italic">
                    ID: {learner_info.accession_number}
                  </p>
                  <div className="flex items-center space-x-4 mt-2">
                    <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                      Grade {learner_info.grade}
                    </span>
                    <span className="text-sm bg-gray-100 px-3 py-1 rounded-full">
                      {learner_info.gender === "M" ? "Male" : "Female"}
                    </span>
                    <span className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                      {learner_info.year_label}
                    </span>
                  </div>
                </div>
              </div>
              {/* Contact Info */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-gray-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Home Phone
                    </p>
                    <p className="text-gray-600">
                      {learner_info.phone_home || "Not provided"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3 p-4 bg-gray-50 rounded-lg">
                  <Phone className="h-5 w-5 text-red-500" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      Emergency Phone
                    </p>
                    <p className="text-gray-600">
                      {learner_info.phone_emergency || "Not provided"}
                    </p>
                  </div>
                </div>
              </div>{" "}
              {/* Late Statistics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <div className="text-2xl font-bold text-blue-600">
                    {late_statistics.total_late_count}
                  </div>
                  <div className="text-sm text-blue-700 font-medium">
                    Total Late
                  </div>
                </div>
                <div
                  className={`text-center p-4 rounded-lg border ${getPerformanceColor(
                    late_statistics.attendance_rating
                  )}`}
                >
                  <div className="text-2xl font-bold">
                    #{late_statistics.rank_among_peers}
                  </div>
                  <div className="text-sm font-medium">Rank</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-lg font-bold text-gray-600">
                    {late_statistics.attendance_rating}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">
                    Rating
                  </div>
                </div>                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-2xl font-bold text-purple-600">
                    {late_statistics.total_enrolled_students}
                  </div>
                  <div className="text-sm text-purple-700 font-medium">
                    Total Students
                  </div>
                </div>{" "}
              </div>
            </div>

            {/* Offence Statistics Grid */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-gray-500" />
                Behavioral Statistics
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center p-4 bg-orange-50 rounded-lg border border-orange-200">
                  <div className="text-2xl font-bold text-orange-600">
                    {offence_statistics.total_offence_count}
                  </div>
                  <div className="text-sm text-orange-700 font-medium">
                    Total Offences
                  </div>
                </div>
                <div
                  className={`text-center p-4 rounded-lg border ${getPerformanceColor(
                    offence_statistics.behavioral_rating
                  )}`}
                >
                  <div className="text-lg font-bold">
                    {offence_statistics.behavioral_rating}
                  </div>
                  <div className="text-sm font-medium">Rating</div>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="text-2xl font-bold text-gray-600">
                    {offence_statistics.class_offence_average.toFixed(1)}
                  </div>
                  <div className="text-sm text-gray-700 font-medium">
                    Class Average
                  </div>
                </div>
                <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="text-lg font-bold text-indigo-600">
                    {offence_statistics.behavioral_performance}
                  </div>
                  <div className="text-sm text-indigo-700 font-medium">
                    Performance
                  </div>
                </div>
              </div>
            </div>

            {/* Overall Assessment */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2 text-gray-500" />
                Overall Assessment
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div
                  className={`text-center p-4 rounded-lg border ${getPerformanceColor(
                    overall_assessment.overall_rating
                  )}`}
                >
                  <div className="text-xl font-bold">
                    {overall_assessment.overall_rating}
                  </div>
                  <div className="text-sm font-medium">Overall</div>
                </div>
                <div
                  className={`text-center p-4 rounded-lg border ${getPerformanceColor(
                    overall_assessment.attendance_rating
                  )}`}
                >
                  <div className="text-xl font-bold">
                    {overall_assessment.attendance_rating}
                  </div>
                  <div className="text-sm font-medium">Attendance</div>
                </div>
                <div
                  className={`text-center p-4 rounded-lg border ${getPerformanceColor(
                    overall_assessment.behavioral_rating
                  )}`}
                >
                  <div className="text-xl font-bold">
                    {overall_assessment.behavioral_rating}
                  </div>
                  <div className="text-sm font-medium">Behavior</div>
                </div>
                <div className="text-center p-4 bg-purple-50 rounded-lg border border-purple-200">
                  <div className="text-xl font-bold text-purple-600">
                    #{overall_assessment.combined_rank.toFixed(1)}
                  </div>
                  <div className="text-sm text-purple-700 font-medium">
                    Combined Rank
                  </div>
                </div>
              </div>
            </div>

            {/* Performance Comparison */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-gray-500" />
                Performance vs Class
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-indigo-50 rounded-lg border border-indigo-200">
                  <div className="text-2xl font-bold text-indigo-600">
                    {late_statistics.class_average.toFixed(1)}
                  </div>
                  <div className="text-sm text-indigo-700 font-medium">
                    Class Average
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg border border-green-200">
                  <div className="text-2xl font-bold text-green-600">
                    {late_statistics.better_than_count}
                  </div>
                  <div className="text-sm text-green-700 font-medium">
                    Better Than
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="text-2xl font-bold text-red-600">
                    {late_statistics.worse_than_count}
                  </div>
                  <div className="text-sm text-red-700 font-medium">
                    Worse Than
                  </div>
                </div>
              </div>
              <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700 font-medium">
                  Performance Summary:
                </p>
                <p className="text-gray-600 mt-1">
                  {late_statistics.performance_vs_class}
                </p>
              </div>
            </div>

            {/* Recent Late Arrivals */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mt-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Clock className="h-5 w-5 mr-2 text-gray-500" />
                Recent Late Arrivals
              </h3>
              {recent_late_arrivals.length > 0 ? (
                <div className="space-y-3">
                  {recent_late_arrivals.map((arrival, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div>
                        <p className="font-medium text-gray-900">
                          {formatDate(arrival.date)}
                        </p>
                        <p className="text-sm text-gray-600">
                          Recorded: {formatDateTime(arrival.recorded_at)}
                        </p>
                      </div>
                      <div className="text-sm text-gray-500">
                        By User #{arrival.recorded_by}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No late arrivals recorded
                </p>
              )}
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Performance Summary */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <Award className="h-5 w-5 mr-2 text-gray-500" />
                Performance Summary
              </h3>
              <div className="space-y-4">
                {late_statistics.first_late_date && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      First Late Date
                    </p>
                    <p className="text-gray-600">
                      {formatDate(late_statistics.first_late_date)}
                    </p>
                  </div>
                )}
                {late_statistics.last_late_date && (
                  <div>
                    <p className="text-sm font-medium text-gray-700">
                      Last Late Date
                    </p>
                    <p className="text-gray-600">
                      {formatDate(late_statistics.last_late_date)}
                    </p>
                  </div>
                )}                <div>
                  <p className="text-sm font-medium text-gray-700">
                    Total Records
                  </p>
                  <p className="text-gray-600">
                    {late_statistics.time_statistics.total_records}
                  </p>
                </div>
              </div>{" "}
            </div>

            {/* Recent Offences */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2 text-gray-500" />
                Recent Offences
              </h3>
              {recent_offences && recent_offences.length > 0 ? (
                <div className="space-y-3">
                  {recent_offences.map((offence) => (
                    <div
                      key={offence.id}
                      className="flex items-start space-x-3 p-3 bg-gray-50 rounded-lg"
                    >                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 line-clamp-3 overflow-hidden">
                          {offence.description}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          {formatDateTime(offence.recorded_at)}
                        </p>
                      </div>
                      {offence.image_urls && (
                        <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                          <ImageIcon className="h-4 w-4 text-gray-500" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No recent offences recorded
                </p>
              )}
            </div>

            {/* Offences Panel */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="p-4 border-b border-gray-200">
                <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                  <MessageSquare className="h-5 w-5 mr-2 text-gray-500" />
                  Offences
                </h3>
              </div>{" "}
              {/* Messages Container */}
              <div
                ref={messagesContainerRef}
                className="h-64 overflow-y-auto p-4 space-y-3 bg-gray-50"
              >
                {offencesLoading ? (
                  <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-6 w-6 border-2 border-gray-200 border-t-blue-600 mx-auto"></div>
                    <p className="text-sm text-gray-500 mt-2">
                      Loading offences...
                    </p>
                  </div>
                ) : offences.length > 0 ? (
                  <>
                    {offences
                      .slice()
                      .reverse()
                      .map((offence) => (
                        <div
                          key={offence.id}
                          className="bg-white rounded-lg p-3 shadow-sm"
                        >
                          {/* User info and timestamp */}
                          <div className="flex items-start justify-between mb-2">
                            <div className="flex items-center space-x-2">
                              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center">
                                <span className="text-xs font-medium text-blue-600">
                                  {offence.recorded_by.username
                                    .charAt(0)
                                    .toUpperCase()}
                                </span>
                              </div>
                              <span className="text-xs font-medium text-gray-700">
                                {offence.recorded_by.username}
                              </span>
                            </div>
                            <span className="text-xs text-gray-500">
                              {formatDateTime(offence.recorded_at)}
                            </span>
                          </div>

                          {/* Instagram-style layout: Image on top, then description */}
                          {offence.image_path && (
                            <div className="mb-3">
                              <AspectRatio
                                ratio={16 / 9}
                                className="bg-gray-100 rounded-lg overflow-hidden"
                              >
                                <img
                                  src={`https://stpauls.ctecg.co.za/${offence.image_path}`}
                                  alt="Offence evidence"
                                  className="w-full h-full object-cover cursor-pointer hover:opacity-80 transition-opacity"
                                  onClick={() =>
                                    handleImageClick(
                                      offence.image_path!,
                                      offence.id
                                    )
                                  }
                                />
                              </AspectRatio>
                            </div>
                          )}

                          {/* Description at bottom */}
                          <p className="text-sm text-gray-900">
                            {offence.description}
                          </p>
                        </div>
                      ))}
                    <div ref={messagesEndRef} />
                  </>
                ) : (
                  <div className="text-center py-8">
                    <MessageSquare className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">
                      No offences recorded
                    </p>
                  </div>
                )}
              </div>{" "}
              {/* Input Area */}
              <div className="p-4 border-t border-gray-200 bg-white">
                <div className="flex items-end space-x-2">
                  <div className="flex-1">
                    <textarea
                      value={newOffence}
                      onChange={(e) => setNewOffence(e.target.value)}
                      placeholder="Record an offence..."
                      className="w-full p-3 border rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      rows={2}
                      disabled={submittingOffence || optimizingImage}
                    />{" "}
                    {selectedImage && (
                      <div className="mt-2 flex items-center justify-between bg-gray-100 p-2 rounded">
                        <div className="flex items-center space-x-2">
                          <ImageIcon className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700">
                            {" "}
                            {selectedImage.name}
                            {selectedImage.size && (
                              <span className="text-xs text-gray-500 ml-1">
                                ({formatFileSize(selectedImage.size)})
                              </span>
                            )}
                          </span>
                        </div>
                        <button
                          onClick={() => setSelectedImage(null)}
                          className="text-red-500 hover:text-red-700"
                        >
                          ×
                        </button>
                      </div>
                    )}
                    {optimizingImage && (
                      <div className="mt-2 flex items-center space-x-2 bg-blue-50 p-2 rounded">
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-blue-200 border-t-blue-600"></div>
                        <span className="text-sm text-blue-700">
                          Optimizing image...
                        </span>
                      </div>
                    )}
                  </div>
                  <div className="flex space-x-1">
                    <input
                      type="file"
                      ref={fileInputRef}
                      onChange={handleFileSelect}
                      accept="image/*"
                      className="hidden"
                    />{" "}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                      disabled={submittingOffence || optimizingImage}
                      title={
                        optimizingImage ? "Optimizing image..." : "Attach image"
                      }
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <button
                      onClick={handleSubmitOffence}
                      disabled={
                        !newOffence.trim() ||
                        submittingOffence ||
                        optimizingImage
                      }
                      className="p-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {submittingOffence ? (
                        <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Monthly Trends */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <TrendingUp className="h-5 w-5 mr-2 text-gray-500" />
                Monthly Trends
              </h3>
              {monthly_trends.length > 0 ? (
                <div className="space-y-3">
                  {monthly_trends.map((trend, index) => (
                    <div
                      key={index}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <span className="font-medium text-gray-900">
                        {new Date(trend.month + "-01").toLocaleDateString(
                          "en-ZA",
                          {
                            year: "numeric",
                            month: "long",
                          }
                        )}
                      </span>
                      <span className="font-bold text-blue-600">
                        {trend.late_count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">
                  No trend data available
                </p>
              )}{" "}
            </div>
          </div>
        </div>
      </div>{" "}
      {/* Image Preview Dialog */}
      <Dialog open={imageDialogOpen} onOpenChange={setImageDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 border-b border-gray-200">
            <DialogTitle>Image Preview</DialogTitle>
          </DialogHeader>{" "}
          <div className="px-4 pb-4">
            {selectedImagePreview && (
              <>
                <img
                  src={selectedImagePreview}
                  alt="Offence evidence"
                  className="w-full h-auto max-h-[70vh] object-contain rounded mb-4"
                />
                <div className="flex items-center justify-center space-x-2">
                  <button
                    onClick={() => handleDownloadImage()}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Download Image"
                  >
                    <Download className="h-5 w-5" />
                  </button>
                  <button
                    onClick={() => handlePrintImage()}
                    className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Print Image"
                  >
                    <Printer className="h-5 w-5" />
                  </button>
                </div>
              </>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default LearnerDetails;
