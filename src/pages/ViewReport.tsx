import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  TrendingUp,
  Users,
  UserCheck,
  AlertCircle,
  BarChart3,
  PieChart,
  LineChart,
} from "lucide-react";
import { toast } from "sonner";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart as RechartsLineChart,
  Line,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Legend,
} from "recharts";
import {
  getLateStatsByDateRange,
  getGradeWiseLateStats,
  getGenderWiseLateStats,
  getTrendData,
  getEnhancedTrendData,
  getOverallStats,
  type ReportStats,
  type GradeWiseStats,
  type GenderWiseStats,
  type TrendData,
  type BehavioralTrendData,
  type TopLateLearner,
  type TopOffenceLearner,
  type TopCombinedLearner,
  type EnhancedTrendResponse,
} from "../services/api";

// Interface for chart-compatible behavioral data structure
interface ChartBehavioralData {
  period: number;
  period_display: string;
  period_type: string;
  late_arrivals_count: number;
  offences_count: number;
  combined_count: number;
  unique_affected_learners: number;
}

// More distinct colors for better visibility
const GENDER_COLORS = [
  "#2563eb", // Blue for one gender
  "#dc2626", // Red for another gender
  "#059669", // Green for additional gender if any
  "#7c3aed", // Purple for additional gender if any
];

const ViewReport: React.FC = () => {
  const navigate = useNavigate();
  const isOnline = useOnlineStatus();

  // Helper function to get Monday of the current week
  const getMondayOfCurrentWeek = () => {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // If Sunday, go back 6 days, otherwise go back to Monday
    const monday = new Date(today);
    monday.setDate(today.getDate() + mondayOffset);
    return monday.toISOString().split("T")[0];
  };

  // Helper function to get today's date
  const getTodayDate = () => {
    return new Date().toISOString().split("T")[0];
  };
  // State for data
  const [dailyStats, setDailyStats] = useState<ReportStats[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeWiseStats[]>([]);
  const [genderStats, setGenderStats] = useState<GenderWiseStats[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [topLateLearners, setTopLateLearners] = useState<TopLateLearner[]>([]);

  // Enhanced behavioral data state
  const [enhancedTrendData, setEnhancedTrendData] =
    useState<EnhancedTrendResponse | null>(null);
  const [behavioralTrends, setBehavioralTrends] = useState<
    ChartBehavioralData[]
  >([]);
  const [topOffenceLearners, setTopOffenceLearners] = useState<
    TopOffenceLearner[]
  >([]);
  const [topCombinedLearners, setTopCombinedLearners] = useState<
    TopCombinedLearner[]
  >([]);
  const [showBehavioralData, setShowBehavioralData] = useState(false);
  const [overallStats, setOverallStats] = useState({
    totalLearners: 0,
    totalLateRecords: 0,
    uniqueLateStudents: 0,
    averageLateDays: 0,
    mostLateGrade: "",
    thisWeekLate: 0,
    lastWeekLate: 0,
  });

  // State for controls - Initialize with Monday of current week to today
  const [dateRange, setDateRange] = useState({
    start: getMondayOfCurrentWeek(), // Monday of current week
    end: getTodayDate(), // Today
  });
  const [trendType, setTrendType] = useState<"daily" | "weekly" | "monthly">(
    "weekly"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Check online status and show notification
  useEffect(() => {
    if (!isOnline) {
      toast.error("You are offline. Reports are only available when online.", {
        duration: Infinity,
        dismissible: true,
      });
    } else {
      toast.dismiss(); // Dismiss any existing offline notifications
    }
  }, [isOnline]);

  // Prevent access when offline
  useEffect(() => {
    if (!isOnline) {
      const timer = setTimeout(() => {
        navigate("/");
      }, 3000); // Redirect after 3 seconds if offline

      return () => clearTimeout(timer);
    }
  }, [isOnline, navigate]);
  // Load data
  const loadReportData = useCallback(async () => {
    if (!isOnline) {
      setError("Cannot load reports while offline");
      return;
    }

    try {
      setLoading(true);
      setError(null); // Load all data in parallel
      console.log("[ViewReport] Starting to load all report data...");
      console.log("[ViewReport] Date range:", dateRange);
      console.log("[ViewReport] Trend type:", trendType);

      const [daily, grade, gender, trends, enhanced, overall] =
        await Promise.allSettled([
          getLateStatsByDateRange(dateRange.start, dateRange.end),
          getGradeWiseLateStats(dateRange.start, dateRange.end),
          getGenderWiseLateStats(dateRange.start, dateRange.end),
          getTrendData(trendType as "daily" | "weekly" | "monthly"),
          getEnhancedTrendData(trendType as "daily" | "weekly" | "monthly"),
          getOverallStats(),
        ]);

      console.log("[ViewReport] Daily stats result:", daily);
      console.log("[ViewReport] Grade stats result:", grade);
      console.log("[ViewReport] Gender stats result:", gender);
      console.log("[ViewReport] Trends result:", trends);
      console.log("[ViewReport] Enhanced trends result:", enhanced);
      console.log("[ViewReport] Overall stats result:", overall);

      if (daily.status === "fulfilled") {
        console.log("[ViewReport] Setting daily stats:", daily.value);
        setDailyStats(daily.value);
      } else {
        console.error("[ViewReport] Daily stats failed:", daily.reason);
      }

      if (grade.status === "fulfilled") {
        console.log("[ViewReport] Setting grade stats:", grade.value);
        setGradeStats(grade.value);
      } else {
        console.error("[ViewReport] Grade stats failed:", grade.reason);
      }

      if (gender.status === "fulfilled") {
        console.log("[ViewReport] Setting gender stats:", gender.value);
        setGenderStats(gender.value);
      } else {
        console.error("[ViewReport] Gender stats failed:", gender.reason);
      }
      if (trends.status === "fulfilled") {
        console.log("[ViewReport] Setting trend data:", trends.value);
        const trendResponse = trends.value;
        setTrendData(trendResponse.trends);
        setTopLateLearners(trendResponse.top_late_learners);
      } else {
        console.error("[ViewReport] Trends failed:", trends.reason);
      }
      if (enhanced.status === "fulfilled") {
        console.log(
          "[ViewReport] Setting enhanced trend data:",
          enhanced.value
        );
        const enhancedResponse = enhanced.value;
        setEnhancedTrendData(enhancedResponse);        // Transform the backend data to match chart expectations
        // The backend provides nested objects, but the chart expects flat properties
        const transformedTrends = enhancedResponse.combined_behavioral_trends.map((item: BehavioralTrendData) => ({
          period: item.period,
          period_display: item.period_display,
          period_type: item.period_type,
          late_arrivals_count: item.late_arrivals?.total_late_count || 0,
          offences_count: item.offences?.total_offence_count || 0,
          combined_count: item.total_behavioral_incidents || 0,
          unique_affected_learners: item.unique_affected_learners || 0,
        }));
        
        setBehavioralTrends(transformedTrends);

        console.log(
          "[ViewReport] Original behavioral trends data:",
          enhancedResponse.combined_behavioral_trends
        );
        console.log(
          "[ViewReport] Transformed behavioral trends data:",
          transformedTrends
        );
        setTopOffenceLearners(enhancedResponse.top_performers.offences);
        setTopCombinedLearners(
          enhancedResponse.top_performers.combined_behavioral_concerns
        );
        setShowBehavioralData(true);
      } else {
        console.warn(
          "[ViewReport] Enhanced trends failed, using legacy data:",
          enhanced.reason
        );
        setShowBehavioralData(false);
      }

      if (overall.status === "fulfilled") {
        console.log("[ViewReport] Setting overall stats:", overall.value);
        setOverallStats(overall.value);
      } else {
        console.error("[ViewReport] Overall stats failed:", overall.reason);
      } // Show errors for any failed requests
      const failures = [daily, grade, gender, trends, enhanced, overall].filter(
        (result) => result.status === "rejected"
      );
      if (failures.length > 0) {
        toast.error(`Failed to load ${failures.length} report section(s)`);
      }
    } catch (err) {
      console.error("Failed to load report data:", err);
      setError("Failed to load report data");
      toast.error("Failed to load report data");
    } finally {
      setLoading(false);
    }
  }, [isOnline, dateRange, trendType]);
  // Load data on mount and when dependencies change
  useEffect(() => {
    if (isOnline) {
      loadReportData();
    }
  }, [isOnline, loadReportData]);

  const handleBack = () => {
    navigate("/");
  };

  const handleDateRangeChange = (field: "start" | "end", value: string) => {
    setDateRange((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  // Show offline message
  if (!isOnline) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="h-16 w-16 text-red-600 mx-auto mb-4" />
            <CardTitle className="text-xl">Offline Mode</CardTitle>
            <CardDescription>
              Reports are only available when you're connected to the internet.
              You'll be redirected to the home page shortly.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <button
              onClick={handleBack}
              className="p-2 rounded-lg border border-gray-300 hover:bg-gray-100 transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Late Records Report
              </h1>
              <p className="text-gray-600">
                Comprehensive analytics and insights
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => handleDateRangeChange("start", e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
              <span className="text-gray-500">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => handleDateRangeChange("end", e.target.value)}
                className="px-3 py-1 border border-gray-300 rounded-md text-sm"
              />
            </div>{" "}
            <select
              value={trendType}
              onChange={(e) =>
                setTrendType(e.target.value as "daily" | "weekly" | "monthly")
              }
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="daily">Daily Trends</option>
              <option value="weekly">Weekly Trends</option>
              <option value="monthly">Monthly Trends</option>
            </select>{" "}
            {/* Behavioral Data Toggle */}
            {enhancedTrendData && (
              <div className="flex items-center gap-2 px-3 py-1 border border-gray-300 rounded-md bg-white">
                <input
                  type="checkbox"
                  id="show-behavioral"
                  checked={showBehavioralData}
                  onChange={(e) => setShowBehavioralData(e.target.checked)}
                  className="rounded"
                />
                <label
                  htmlFor="show-behavioral"
                  className="text-sm text-gray-700 cursor-pointer"
                >
                  Show Behavioral Data
                </label>
              </div>
            )}
          </div>
        </div>

        {loading && (
          <div className="text-center py-8">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
            <p className="mt-2 text-gray-600">Loading report data...</p>
          </div>
        )}

        {error && (
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <p>{error}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {!loading && !error && (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Total Learners
                  </CardTitle>
                  <Users className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overallStats.totalLearners}
                  </div>
                  <p className="text-xs text-gray-600">Enrolled this year</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Late Records
                  </CardTitle>
                  <AlertCircle className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overallStats.totalLateRecords}
                  </div>
                  <p className="text-xs text-gray-600">Total incidents</p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    Students Affected
                  </CardTitle>
                  <UserCheck className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overallStats.uniqueLateStudents}
                  </div>
                  <p className="text-xs text-gray-600">
                    {overallStats.totalLearners > 0
                      ? `${(
                          (overallStats.uniqueLateStudents /
                            overallStats.totalLearners) *
                          100
                        ).toFixed(1)}% of total`
                      : "No data"}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    This Week
                  </CardTitle>
                  <TrendingUp className="h-4 w-4 text-red-600" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {overallStats.thisWeekLate}
                  </div>
                  <p className="text-xs text-gray-600">
                    {overallStats.lastWeekLate !== undefined
                      ? overallStats.thisWeekLate > overallStats.lastWeekLate
                        ? `+${
                            overallStats.thisWeekLate -
                            overallStats.lastWeekLate
                          } from last week`
                        : overallStats.thisWeekLate < overallStats.lastWeekLate
                        ? `${
                            overallStats.thisWeekLate -
                            overallStats.lastWeekLate
                          } from last week`
                        : "Same as last week"
                      : "vs last week"}
                  </p>
                </CardContent>
              </Card>
            </div>{" "}
            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Daily Late Records */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-red-600" />
                    Daily Late Records
                  </CardTitle>
                  <CardDescription>
                    Late arrivals over the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      count: {
                        label: "Late Records",
                        color: "#dc2626",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={dailyStats}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="date"
                          stroke="#6b7280"
                          fontSize={12}
                          tickFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-GB", {
                              day: "2-digit",
                              month: "2-digit",
                            })
                          }
                        />
                        <YAxis stroke="#6b7280" fontSize={12} />
                        <ChartTooltip
                          content={<ChartTooltipContent />}
                          labelFormatter={(value) =>
                            new Date(value).toLocaleDateString("en-GB")
                          }
                        />
                        <Area
                          type="monotone"
                          dataKey="count"
                          stroke="#dc2626"
                          fill="#dc2626"
                          fillOpacity={0.2}
                          strokeWidth={2}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>{" "}
              {/* Grade-wise Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-red-600" />
                    Late Records by Grade
                  </CardTitle>{" "}
                  <CardDescription>
                    Distribution across grade levels with gender breakdown
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {" "}
                  <ChartContainer
                    config={{
                      male: {
                        label: "Male",
                        color: "#2563eb",
                      },
                      female: {
                        label: "Female",
                        color: "#dc2626",
                      },
                    }}
                    className="min-h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        accessibilityLayer
                        data={gradeStats}
                        margin={{
                          top: 20,
                          right: 30,
                          left: 20,
                          bottom: 20,
                        }}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="grade"
                          stroke="#6b7280"
                          fontSize={12}
                          tickFormatter={(value) =>
                            value.replace("Grade ", "Gr ")
                          }
                        />
                        <YAxis
                          stroke="#6b7280"
                          fontSize={12}
                          label={{
                            value: "Number of Learners",
                            angle: -90,
                            position: "insideLeft",
                          }}
                        />
                        <ChartTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900">
                                    {label}
                                  </p>
                                  <p className="text-blue-600">
                                    Male: {data.male} (
                                    {data.male_percentage?.toFixed(1) || 0}%)
                                  </p>
                                  <p className="text-red-600">
                                    Female: {data.female} (
                                    {data.female_percentage?.toFixed(1) || 0}%)
                                  </p>
                                  <p className="text-gray-700 border-t pt-1">
                                    Total: {data.total} (
                                    {data.percentage?.toFixed(1) || 0}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="male"
                          stackId="a"
                          fill="#2563eb"
                          radius={[0, 0, 0, 0]}
                        />
                        <Bar
                          dataKey="female"
                          stackId="a"
                          fill="#dc2626"
                          radius={[4, 4, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              {/* Gender Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PieChart className="h-5 w-5 text-red-600" />
                    Late Records by Gender
                  </CardTitle>
                  <CardDescription>
                    Gender distribution of late arrivals
                  </CardDescription>
                </CardHeader>{" "}
                <CardContent>
                  <ChartContainer
                    config={{
                      count: {
                        label: "Count",
                        color: "#dc2626",
                      },
                    }}
                    className="h-[350px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsPieChart>
                        {" "}
                        <Pie
                          data={genderStats}
                          cx="50%"
                          cy="45%"
                          innerRadius={50}
                          outerRadius={100}
                          paddingAngle={5}
                          dataKey="count"
                          nameKey="gender"
                          label={({ name, percentage }) =>
                            `${name}: ${percentage.toFixed(1)}%`
                          }
                          labelLine={false}
                        >
                          {genderStats.map((_, index) => (
                            <Cell
                              key={`cell-${index}`}
                              fill={GENDER_COLORS[index % GENDER_COLORS.length]}
                            />
                          ))}
                        </Pie>{" "}
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          formatter={(_, entry, index) => {
                            const genderData = genderStats[index];
                            return (
                              <span
                                style={{
                                  color: entry.color,
                                  fontWeight: "bold",
                                }}
                              >
                                {genderData?.gender}: {genderData?.count || 0}{" "}
                                records (
                                {genderData?.percentage?.toFixed(1) || 0}%)
                              </span>
                            );
                          }}
                        />
                        <ChartTooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const data = payload[0].payload;
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900">
                                    {data.gender}
                                  </p>
                                  <p
                                    style={{
                                      color:
                                        GENDER_COLORS[
                                          genderStats.findIndex(
                                            (stat) =>
                                              stat.gender === data.gender
                                          ) % GENDER_COLORS.length
                                        ],
                                    }}
                                  >
                                    {data.count} records (
                                    {data.percentage.toFixed(1)}%)
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                      </RechartsPieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
              {/* Trend Analysis */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <LineChart className="h-5 w-5 text-red-600" />
                    {trendType.charAt(0).toUpperCase() +
                      trendType.slice(1)}{" "}
                    Trends
                  </CardTitle>{" "}
                  <CardDescription>
                    Two metrics over time: total late records (solid red line)
                    and percentage of all students who were late (dashed red
                    line)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {" "}
                  <ChartContainer
                    config={{
                      count: {
                        label: "Number of Late Records",
                        color: "#dc2626",
                      },
                      percentage_of_total: {
                        label: "% of Total Students",
                        color: "#7f1d1d",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="period_display"
                          stroke="#6b7280"
                          fontSize={12}
                        />{" "}
                        <YAxis
                          yAxisId="left"
                          stroke="#dc2626"
                          fontSize={12}
                          label={{
                            value: "Late Records",
                            angle: -90,
                            position: "insideLeft",
                          }}
                          domain={[0, "dataMax"]}
                        />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#7f1d1d"
                          fontSize={12}
                          label={{
                            value: "% of Students",
                            angle: 90,
                            position: "insideRight",
                          }}
                          domain={[0, "dataMax"]}
                        />
                        <ChartTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              const countData = payload.find(
                                (p) => p.dataKey === "count"
                              );
                              const percentData = payload.find(
                                (p) => p.dataKey === "percentage_of_total"
                              );

                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium text-gray-900 mb-2">
                                    {label}
                                  </p>
                                  <div className="space-y-1">
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-0.5 bg-red-600"></div>
                                      <span className="text-sm">
                                        <span className="font-medium text-red-600">
                                          {countData?.value || 0}
                                        </span>
                                        <span className="text-gray-600">
                                          {" "}
                                          late records
                                        </span>
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <div className="w-3 h-0.5 bg-red-800 border-dashed border-t"></div>
                                      <span className="text-sm">
                                        <span className="font-medium text-red-800">
                                          {typeof percentData?.value ===
                                          "number"
                                            ? percentData.value.toFixed(1)
                                            : "0.0"}
                                          %
                                        </span>
                                        <span className="text-gray-600">
                                          {" "}
                                          of all students
                                        </span>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Legend
                          verticalAlign="top"
                          height={36}
                          iconType="line"
                          formatter={(value, entry) => (
                            <span style={{ color: entry.color }}>
                              {value === "count"
                                ? "Number of Late Records"
                                : "% of Total Students"}
                            </span>
                          )}
                        />
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          stroke="#dc2626"
                          strokeWidth={3}
                          dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
                          name="count"
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="percentage_of_total"
                          stroke="#7f1d1d"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "#7f1d1d", strokeWidth: 2, r: 3 }}
                          name="percentage_of_total"
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </ChartContainer>{" "}
                </CardContent>
              </Card>
              {/* Top Late Learners Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    Top 5 Late Learners
                  </CardTitle>
                  <CardDescription>
                    Learners with the most late arrivals in the selected period
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {topLateLearners.length > 0 ? (
                    <div className="space-y-3">
                      {topLateLearners.map((learner, index) => (
                        <div
                          key={learner.id}
                          className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full font-semibold text-sm">
                              {index + 1}
                            </div>
                            <div>
                              <p className="font-medium text-gray-900">
                                {learner.name}
                              </p>
                              <p className="text-sm text-gray-500">
                                {learner.grade} • {learner.gender}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-lg text-orange-600">
                              {learner.late_count}
                            </p>
                            <p className="text-xs text-gray-500">
                              {learner.late_count === 1 ? "time" : "times"} late
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-gray-500">
                      <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                      <p>
                        No late arrival data available for the selected period
                      </p>
                    </div>
                  )}{" "}
                </CardContent>{" "}
              </Card>
            </div>
            {/* Enhanced Behavioral Data Section */}
            {showBehavioralData && enhancedTrendData && (
              <>
                {/* Behavioral Statistics Summary */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6 mt-8">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Total Offences
                      </CardTitle>
                      <AlertCircle className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {
                          enhancedTrendData.detailed_statistics
                            .total_offence_count
                        }
                      </div>
                      <p className="text-xs text-gray-600">
                        Behavioral incidents
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Offence Rate
                      </CardTitle>
                      <TrendingUp className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {enhancedTrendData.detailed_statistics.average_offence_per_period.toFixed(
                          1
                        )}
                      </div>
                      <p className="text-xs text-gray-600">
                        Per {trendType.slice(0, -2)}
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Students with Offences
                      </CardTitle>
                      <Users className="h-4 w-4 text-orange-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {enhancedTrendData.offences.statistics.unique_learners}
                      </div>
                      <p className="text-xs text-gray-600">Unique learners</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">
                        Combined Issues
                      </CardTitle>
                      <AlertCircle className="h-4 w-4 text-red-600" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">
                        {topCombinedLearners.length}
                      </div>
                      <p className="text-xs text-gray-600">Late + Offences</p>
                    </CardContent>
                  </Card>
                </div>{" "}
                {/* Behavioral Trends Chart */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
                  {/* Combined Behavioral Trends */}
                  <Card className="lg:col-span-2">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <LineChart className="h-5 w-5 text-orange-600" />
                        Combined Behavioral Trends
                      </CardTitle>
                      <CardDescription>
                        Three metrics over time: late arrivals (solid red),
                        behavioral offences (solid orange), and combined
                        incidents (dashed brown)
                      </CardDescription>
                    </CardHeader>{" "}
                    <CardContent>
                      {" "}
                      {behavioralTrends && behavioralTrends.length > 0 ? (
                        <ChartContainer
                          config={{
                            late_arrivals_count: {
                              label: "Late Arrivals",
                              color: "#dc2626",
                            },
                            offences_count: {
                              label: "Offences",
                              color: "#ea580c",
                            },
                            combined_count: {
                              label: "Combined",
                              color: "#7c2d12",
                            },
                          }}
                          className="h-[300px]"
                        >
                          <ResponsiveContainer width="100%" height="100%">
                            <RechartsLineChart data={behavioralTrends}>
                              {/* Debug: Log the data being passed to chart */}
                              {console.log(
                                "[Chart] Behavioral trends data about to render:",
                                behavioralTrends
                              )}{" "}
                              <CartesianGrid
                                strokeDasharray="3 3"
                                stroke="#f3f4f6"
                              />{" "}
                              <XAxis
                                dataKey="period_display"
                                stroke="#6b7280"
                                fontSize={12}
                              />
                              <YAxis
                                stroke="#6b7280"
                                fontSize={12}
                                label={{
                                  value: "Number of Incidents",
                                  angle: -90,
                                  position: "insideLeft",
                                }}
                                domain={[0, "dataMax"]}
                              />
                              <ChartTooltip
                                content={({ active, payload, label }) => {
                                  if (active && payload && payload.length) {
                                    const lateData = payload.find(
                                      (p) => p.dataKey === "late_arrivals_count"
                                    );
                                    const offenceData = payload.find(
                                      (p) => p.dataKey === "offences_count"
                                    );
                                    const combinedData = payload.find(
                                      (p) => p.dataKey === "combined_count"
                                    );

                                    return (
                                      <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                        <p className="font-medium text-gray-900 mb-2">
                                          {label}
                                        </p>
                                        <div className="space-y-1">
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-0.5 bg-red-600"></div>
                                            <span className="text-sm">
                                              <span className="font-medium text-red-600">
                                                {lateData?.value || 0}
                                              </span>
                                              <span className="text-gray-600">
                                                {" "}
                                                late arrivals
                                              </span>
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-0.5 bg-orange-600"></div>
                                            <span className="text-sm">
                                              <span className="font-medium text-orange-600">
                                                {offenceData?.value || 0}
                                              </span>
                                              <span className="text-gray-600">
                                                {" "}
                                                offences
                                              </span>
                                            </span>
                                          </div>
                                          <div className="flex items-center gap-2">
                                            <div className="w-3 h-0.5 bg-amber-800 border-dashed border-t"></div>
                                            <span className="text-sm">
                                              <span className="font-medium text-amber-800">
                                                {combinedData?.value || 0}
                                              </span>
                                              <span className="text-gray-600">
                                                {" "}
                                                combined incidents
                                              </span>
                                            </span>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  }
                                  return null;
                                }}
                              />
                              <Legend
                                verticalAlign="top"
                                height={36}
                                iconType="line"
                                formatter={(value, entry) => (
                                  <span style={{ color: entry.color }}>
                                    {value === "late_arrivals_count"
                                      ? "Late Arrivals"
                                      : value === "offences_count"
                                      ? "Behavioral Offences"
                                      : "Combined Incidents"}
                                  </span>
                                )}
                              />
                              <Line
                                type="monotone"
                                dataKey="late_arrivals_count"
                                stroke="#dc2626"
                                strokeWidth={3}
                                dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
                                name="late_arrivals_count"
                              />
                              <Line
                                type="monotone"
                                dataKey="offences_count"
                                stroke="#ea580c"
                                strokeWidth={3}
                                dot={{ fill: "#ea580c", strokeWidth: 2, r: 4 }}
                                name="offences_count"
                              />
                              <Line
                                type="monotone"
                                dataKey="combined_count"
                                stroke="#7c2d12"
                                strokeWidth={2}
                                strokeDasharray="5 5"
                                dot={{ fill: "#7c2d12", strokeWidth: 2, r: 3 }}
                                name="combined_count"
                              />
                            </RechartsLineChart>
                          </ResponsiveContainer>
                        </ChartContainer>
                      ) : (
                        <div className="h-[300px] flex items-center justify-center text-gray-500">
                          <div className="text-center">
                            <LineChart className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                            <p className="text-lg font-medium">
                              No behavioral trends data available
                            </p>
                            <p className="text-sm">
                              Data will appear when behavioral incidents are
                              recorded over time
                            </p>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>{" "}
                </div>
                {/* Top Performers Section */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
                  {/* Top Offence Learners */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-orange-600" />
                        Top Offence Learners
                      </CardTitle>
                      <CardDescription>
                        Learners with the most behavioral incidents
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {topOffenceLearners.length > 0 ? (
                        <div className="space-y-3">
                          {topOffenceLearners
                            .slice(0, 5)
                            .map((learner, index) => (
                              <div
                                key={learner.id}
                                className="flex items-center justify-between p-3 bg-orange-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 bg-orange-100 text-orange-600 rounded-full font-semibold text-sm">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {learner.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {learner.grade} • {learner.gender}
                                    </p>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="font-semibold text-lg text-orange-600">
                                    {learner.offence_count}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    offences
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <Users className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p>No offence data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Top Combined Behavioral Concerns */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <AlertCircle className="h-5 w-5 text-red-600" />
                        Combined Concerns
                      </CardTitle>
                      <CardDescription>
                        Learners with both late arrivals and offences
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {topCombinedLearners.length > 0 ? (
                        <div className="space-y-3">
                          {topCombinedLearners
                            .slice(0, 5)
                            .map((learner, index) => (
                              <div
                                key={learner.id}
                                className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="flex items-center justify-center w-8 h-8 bg-red-100 text-red-600 rounded-full font-semibold text-sm">
                                    {index + 1}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">
                                      {learner.name}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      {learner.grade} • {learner.gender}
                                    </p>
                                  </div>
                                </div>{" "}
                                <div className="text-right">
                                  <p className="font-semibold text-lg text-red-600">
                                    {learner.total_incidents}
                                  </p>
                                  <p className="text-xs text-gray-500">
                                    {learner.late_count}L +{" "}
                                    {learner.offence_count}O
                                  </p>
                                </div>
                              </div>
                            ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-gray-500">
                          <AlertCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                          <p>No combined behavioral data available</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Behavioral Statistics Breakdown */}
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <BarChart3 className="h-5 w-5 text-purple-600" />
                        Statistics Summary
                      </CardTitle>
                      <CardDescription>Key behavioral metrics</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {" "}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Late Peak:
                          </span>
                          <span className="font-medium">
                            {enhancedTrendData.detailed_statistics
                              .highest_late_period?.period_display || "N/A"}
                          </span>
                        </div>{" "}
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Offence Peak:
                          </span>
                          <span className="font-medium">
                            {enhancedTrendData.detailed_statistics
                              .highest_offence_period?.period_display || "N/A"}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Total Periods:
                          </span>
                          <span className="font-medium">
                            {
                              enhancedTrendData.detailed_statistics
                                .total_periods
                            }
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">
                            Students Affected:
                          </span>
                          <span className="font-medium">
                            {
                              enhancedTrendData.detailed_statistics
                                .total_enrolled_students
                            }
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ViewReport;
