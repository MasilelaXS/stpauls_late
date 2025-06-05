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
  getLateStatsByDateRange,
  getGradeWiseLateStats,
  getGenderWiseLateStats,
  getTrendData,
  getOverallStats,
  type ReportStats,
  type GradeWiseStats,
  type GenderWiseStats,
  type TrendData,
} from "../services/api";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "../components/ui/chart";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Cell,
  LineChart as RechartsLineChart,
  Line,
  Area,
  AreaChart,
  Pie,
  Legend,
} from "recharts";

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

  // State for data
  const [dailyStats, setDailyStats] = useState<ReportStats[]>([]);
  const [gradeStats, setGradeStats] = useState<GradeWiseStats[]>([]);
  const [genderStats, setGenderStats] = useState<GenderWiseStats[]>([]);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [overallStats, setOverallStats] = useState({
    totalLearners: 0,
    totalLateRecords: 0,
    uniqueLateStudents: 0,
    averageLateDays: 0,
    mostLateGrade: "",
    thisWeekLate: 0,
    lastWeekLate: 0,
  });

  // State for controls
  const [dateRange, setDateRange] = useState({
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0], // 30 days ago
    end: new Date().toISOString().split("T")[0], // today
  });
  const [trendType, setTrendType] = useState<"weekly" | "monthly">("weekly");
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
      setError(null);

      // Load all data in parallel
      const [daily, grade, gender, trends, overall] = await Promise.allSettled([
        getLateStatsByDateRange(dateRange.start, dateRange.end),
        getGradeWiseLateStats(dateRange.start, dateRange.end),
        getGenderWiseLateStats(dateRange.start, dateRange.end),
        getTrendData(trendType),
        getOverallStats(),
      ]);

      if (daily.status === "fulfilled") setDailyStats(daily.value);
      if (grade.status === "fulfilled") setGradeStats(grade.value);
      if (gender.status === "fulfilled") setGenderStats(gender.value);
      if (trends.status === "fulfilled") setTrendData(trends.value);
      if (overall.status === "fulfilled") setOverallStats(overall.value);

      // Show errors for any failed requests
      const failures = [daily, grade, gender, trends, overall].filter(
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
  }, [isOnline, dateRange.start, dateRange.end, trendType]);
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
            </div>

            <select
              value={trendType}
              onChange={(e) =>
                setTrendType(e.target.value as "weekly" | "monthly")
              }
              className="px-3 py-1 border border-gray-300 rounded-md text-sm"
            >
              <option value="weekly">Weekly Trends</option>
              <option value="monthly">Monthly Trends</option>
            </select>
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
            </div>

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
              </Card>

              {/* Grade-wise Distribution */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-red-600" />
                    Late Records by Grade
                  </CardTitle>
                  <CardDescription>
                    Distribution across grade levels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    config={{
                      count: {
                        label: "Count",
                        color: "#dc2626",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={gradeStats} layout="horizontal">
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis type="number" stroke="#6b7280" fontSize={12} />
                        <YAxis
                          type="category"
                          dataKey="grade"
                          stroke="#6b7280"
                          fontSize={12}
                          width={60}
                        />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar
                          dataKey="count"
                          fill="#dc2626"
                          radius={[0, 4, 4, 0]}
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
                        </Pie>{" "}                        <Legend
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
                    {trendType === "weekly" ? "Weekly" : "Monthly"} Trends
                  </CardTitle>
                  <CardDescription>
                    Late arrival trends over time with percentage of total
                    students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {" "}
                  <ChartContainer
                    config={{
                      count: {
                        label: "Late Count",
                        color: "#dc2626",
                      },
                      percentage_of_total: {
                        label: "Percentage",
                        color: "#7f1d1d",
                      },
                    }}
                    className="h-[300px]"
                  >
                    <ResponsiveContainer width="100%" height="100%">
                      <RechartsLineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                        <XAxis
                          dataKey="period"
                          stroke="#6b7280"
                          fontSize={12}
                        />
                        <YAxis yAxisId="left" stroke="#6b7280" fontSize={12} />
                        <YAxis
                          yAxisId="right"
                          orientation="right"
                          stroke="#6b7280"
                          fontSize={12}
                        />
                        <ChartTooltip
                          content={({ active, payload, label }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="bg-white p-3 border border-gray-200 rounded-lg shadow-lg">
                                  <p className="font-medium">{label}</p>
                                  <p className="text-red-600">
                                    Count: {payload[0]?.value}
                                  </p>
                                  <p className="text-red-800">
                                    Percentage:{" "}
                                    {typeof payload[1]?.value === "number"
                                      ? payload[1].value.toFixed(1)
                                      : "0.0"}
                                    %
                                  </p>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />{" "}
                        <Line
                          yAxisId="left"
                          type="monotone"
                          dataKey="count"
                          stroke="#dc2626"
                          strokeWidth={3}
                          dot={{ fill: "#dc2626", strokeWidth: 2, r: 4 }}
                        />
                        <Line
                          yAxisId="right"
                          type="monotone"
                          dataKey="percentage_of_total"
                          stroke="#7f1d1d"
                          strokeWidth={2}
                          strokeDasharray="5 5"
                          dot={{ fill: "#7f1d1d", strokeWidth: 2, r: 3 }}
                        />
                      </RechartsLineChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ViewReport;
