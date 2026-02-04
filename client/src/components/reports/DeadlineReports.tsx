import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { downloadCsvSections } from "@/lib/csv";
import {
  Calendar,
  CheckCircle2,
  Clock,
  AlertTriangle,
  TrendingUp,
  Download,
  Search,
  FilterX,
  ArrowUpDown,
} from "lucide-react";
import type { Task, Project, User, Bucket } from "@shared/schema";
import { format, isWithinInterval, parseISO, differenceInDays } from "date-fns";

const COLORS = ["#4f46e5", "#22d3ee", "#10b981", "#f59e0b", "#ef4444"];

interface DeadlineReportsProps {
  projects: Project[];
  users: User[];
  isAdmin: boolean;
  currentUserId: number;
}

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export default function DeadlineReports({
  projects,
  users,
  isAdmin,
  currentUserId,
}: DeadlineReportsProps) {
  // --- Date Range State ---
  const today = new Date();
  const thirtyDaysAgo = new Date(today);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [startDate, setStartDate] = useState(format(thirtyDaysAgo, "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(format(today, "yyyy-MM-dd"));

  // --- Filter & Sort State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  // --- Data Fetching ---
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<Bucket[]>({
    queryKey: ["/api/buckets"],
  });

  const isLoading = tasksLoading || bucketsLoading;

  // --- Lookups ---
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const bucketNameById = useMemo(() => new Map(buckets.map((b) => [b.id, b.title || "Unnamed"])), [buckets]);
  const userNameById = useMemo(() => new Map(users.map((u) => [u.id, u.name])), [users]);

  // --- Base Filtering (Date Range + Permission) ---
  const dateRangeTasks = useMemo(() => {
    return tasks.filter((t) => {
      // Permission Check
      if (!isAdmin) {
        const assignedUsers = t.assignedUsers || [];
        if (!assignedUsers.includes(currentUserId) && t.assigneeId !== currentUserId) {
          return false;
        }
      }
      // Date Check
      if (!t.dueDate) return false;
      const dueDate = new Date(t.dueDate);
      const start = parseISO(startDate);
      const end = parseISO(endDate);
      // isWithinInterval throws if dates are invalid, basic check:
      if (!isValidDate(start) || !isValidDate(end)) return false;

      return isWithinInterval(dueDate, { start, end });
    });
  }, [tasks, isAdmin, currentUserId, startDate, endDate]);

  // --- Stats Calculation (Based on Date Range) ---
  const totalTasksInRange = dateRangeTasks.length;
  const overdueTasksCount = dateRangeTasks.filter((t) => {
    if (t.status === "completed") return false;
    return new Date(t.dueDate!) < new Date();
  }).length;

  const onTimeCompletions = dateRangeTasks.filter((t) => t.status === "completed").length; // Simplified on-time logic
  const onTimeRate = totalTasksInRange > 0 ? Math.round((onTimeCompletions / totalTasksInRange) * 100) : 0;

  const delays = dateRangeTasks
    .filter((t) => t.status !== "completed" && t.dueDate && new Date(t.dueDate) < new Date())
    .map((t) => differenceInDays(new Date(), new Date(t.dueDate!)));

  const avgDelay = delays.length > 0 ? Math.round(delays.reduce((a, b) => a + b, 0) / delays.length) : 0;

  // --- Chart Data Preparation ---
  const trendData = useMemo(() => {
    const data: { date: string; due: number; completed: number }[] = [];
    const start = parseISO(startDate);
    const end = parseISO(endDate);
    if (!isValidDate(start) || !isValidDate(end)) return [];

    const daysDiff = differenceInDays(end, start);
    const interval = Math.max(1, Math.floor(daysDiff / 7)); // Roughly 7-10 points

    for (let i = 0; i <= daysDiff; i += interval) {
      const currentDate = new Date(start);
      currentDate.setDate(currentDate.getDate() + i);
      const dateStr = format(currentDate, "MMM dd");
      const compareStr = format(currentDate, "yyyy-MM-dd");

      const dueOnDate = dateRangeTasks.filter((t) => {
        return format(new Date(t.dueDate!), "yyyy-MM-dd") === compareStr;
      }).length;

      const completedOnDate = dateRangeTasks.filter((t) => {
        if (t.status !== "completed") return false;
        // Assuming completedDate exists or using dueDate as proxy for visual
        return format(new Date(t.dueDate!), "yyyy-MM-dd") === compareStr;
      }).length;

      data.push({ date: dateStr, due: dueOnDate, completed: completedOnDate });
    }
    return data;
  }, [startDate, endDate, dateRangeTasks]);

  const statusBreakdown = [
    { status: "Completed", count: onTimeCompletions },
    { status: "Overdue", count: overdueTasksCount },
    { status: "Pending", count: dateRangeTasks.filter((t) => t.status !== "completed" && (!t.dueDate || new Date(t.dueDate) >= new Date())).length },
  ];

  // --- Helper Functions ---
  const formatAssignees = (task: Task) => {
    const ids = new Set<number>();
    if (task.assigneeId) ids.add(task.assigneeId);
    (task.assignedUsers || []).forEach((id) => ids.add(id));
    if (ids.size === 0) return "Unassigned";
    return Array.from(ids)
      .map((id) => userNameById.get(id) || `User ${id}`)
      .join(", ");
  };

  const formatDateValue = (value?: string | Date | null) => {
    if (!value) return "";
    return format(new Date(value), "yyyy-MM-dd");
  };

  function isValidDate(d: Date) {
    return d instanceof Date && !isNaN(d.getTime());
  }

  // --- Table Data (Filtered & Sorted) ---
  const processedTableData = useMemo(() => {
    let data = dateRangeTasks.map((task) => ({
      id: task.id,
      taskName: task.title || "Untitled",
      projectName: projectNameById.get(task.projectId) || `Project ${task.projectId}`,
      projectId: task.projectId,
      bucket: bucketNameById.get(Number(task.bucketId)) || "Unassigned",
      assignees: formatAssignees(task),
      status: task.status,
      priority: task.priority || "normal",
      startDate: task.startDate,
      dueDate: task.dueDate,
    }));

    // 1. UI Filters
    if (filterProject !== "all") {
      data = data.filter((t) => String(t.projectId) === filterProject);
    }
    if (filterStatus !== "all") {
      data = data.filter((t) => t.status === filterStatus);
    }
    if (filterPriority !== "all") {
      data = data.filter((t) => t.priority === filterPriority);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter((t) =>
        t.taskName.toLowerCase().includes(lowerQuery) ||
        t.assignees.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Sorting
    if (sortConfig) {
      data.sort((a, b) => {
        // @ts-ignore
        const aValue = a[sortConfig.key];
        // @ts-ignore
        const bValue = b[sortConfig.key];
        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [dateRangeTasks, projectNameById, bucketNameById, filterProject, filterStatus, filterPriority, searchQuery, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterProject("all");
    setFilterStatus("all");
    setFilterPriority("all");
  };

  const handleDownload = () => {
    if (isLoading) return;

    const reportHeaders = ["Task", "Project", "Bucket", "Assignees", "Status", "Priority", "Start Date", "Due Date"];
    const reportRows = processedTableData.map((row) => [
      row.taskName,
      row.projectName,
      row.bucket,
      row.assignees,
      row.status,
      row.priority,
      formatDateValue(row.startDate),
      formatDateValue(row.dueDate),
    ]);

    downloadCsvSections(`deadline-report-${startDate}-to-${endDate}`, [
      { headers: reportHeaders, rows: reportRows },
    ]);
  };

  if (!startDate || !endDate) {
    return (
      <div className="space-y-6">
        {/* ... (Same as initial empty state, simplified for brevity in this response) ... */}
        <div className="flex items-center justify-center h-64 text-muted-foreground">
          Please select a date range.
        </div>
      </div>
    );
  }

  // Projects available for filter dropdown
  const uniqueProjectIds = Array.from(new Set(dateRangeTasks.map(t => t.projectId)));
  const filterProjectsList = projects.filter(p => uniqueProjectIds.includes(p.id));

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* Date Range Selection Card */}
      <Card>
        <CardContent className="p-4 sm:pt-6">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
            <div className="grid grid-cols-2 gap-4 w-full lg:w-auto">
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">Start Date</label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full sm:w-[180px]"
                  data-testid="input-deadline-start"
                />
              </div>
              <div className="space-y-2">
                <label className="text-xs sm:text-sm font-medium text-muted-foreground">End Date</label>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full sm:w-[180px]"
                  data-testid="input-deadline-end"
                />
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={isLoading}
              data-testid="button-deadline-report-download"
              className="w-full lg:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Filtered
            </Button>
          </div>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px] sm:h-[120px]" />)}
        </div>
      ) : (
        <>
          {/* Stats Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Tasks in Range
                </CardTitle>
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{totalTasksInRange}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  Deadlines in period
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Overdue
                </CardTitle>
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-destructive">{overdueTasksCount}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  Past deadline
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  On-Time Rate
                </CardTitle>
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{onTimeRate}%</div>
                <Progress value={onTimeRate} className="mt-2 h-1.5 sm:h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Avg Delay
                </CardTitle>
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-amber-500" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{avgDelay}d</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  For overdue tasks
                </p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    Deadline Trend
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  {trendData.length === 0 ? (
                    <div className="h-[250px] flex items-center justify-center text-muted-foreground">
                      No data in this range
                    </div>
                  ) : (
                    <div className="h-[220px] sm:h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <LineChart data={trendData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                          <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                          <Legend wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }} />
                          <Line type="monotone" dataKey="due" stroke="#4f46e5" strokeWidth={2} name="Due" dot={false} />
                          <Line type="monotone" dataKey="completed" stroke="#10b981" strokeWidth={2} name="Done" dot={false} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.3 }}
            >
              <Card className="h-full">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Status Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <div className="h-[220px] sm:h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusBreakdown} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="count" fill="#10b981" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Table Section */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Detailed Report</CardTitle>
              {/* Filters Toolbar */}
              <div className="flex flex-col xl:flex-row gap-2 sm:gap-4 mt-2 sm:mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search tasks..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                  <Select value={filterProject} onValueChange={setFilterProject}>
                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Project" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Projects</SelectItem>
                      {filterProjectsList.map(p => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className="w-full sm:w-[110px] h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="todo">Not Started</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                    </SelectContent>
                  </Select>

                  <Select value={filterPriority} onValueChange={setFilterPriority}>
                    <SelectTrigger className="w-full sm:w-[110px] h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Priority" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Priority</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="urgent">Urgent</SelectItem>
                    </SelectContent>
                  </Select>

                  <Button variant="ghost" size="icon" onClick={clearFilters} title="Clear Filters" className="h-9 w-9">
                    <FilterX className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-0 sm:p-6">
              <div className="overflow-x-auto border-t sm:border sm:rounded-md">
                <Table className="min-w-full">
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap w-[200px] h-9 px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("taskName")}>
                        Task <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                      <TableHead className="whitespace-nowrap h-9 px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("projectName")}>
                        Project
                      </TableHead>
                      <TableHead className="whitespace-nowrap h-9 px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("status")}>
                        Status
                      </TableHead>
                      <TableHead className="whitespace-nowrap h-9 px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("priority")}>
                        Priority
                      </TableHead>
                      <TableHead className="whitespace-nowrap h-9 px-4 text-xs sm:text-sm cursor-pointer text-right" onClick={() => handleSort("dueDate")}>
                        Due Date <ArrowUpDown className="inline h-3 w-3 ml-1" />
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {processedTableData.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="h-24 text-center text-xs sm:text-sm">
                          No tasks found.
                        </TableCell>
                      </TableRow>
                    ) : (
                      processedTableData.map((row) => (
                        <TableRow key={row.id} className="h-10 sm:h-auto">
                          <TableCell className="font-medium whitespace-nowrap px-4 py-2 text-xs sm:text-sm">
                            <span title={row.taskName}>{row.taskName}</span>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-2 text-xs sm:text-sm">
                            {row.projectName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-2">
                            <Badge
                              variant={row.status === 'completed' ? 'default' : row.status === 'in_progress' ? 'secondary' : 'outline'}
                              className="px-2 py-0.5 h-auto text-xs whitespace-nowrap"
                            >
                              {row.status.replace('_', ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="whitespace-nowrap px-4 py-2">
                            {row.priority && (
                              <Badge variant="outline" className={
                                row.priority === 'urgent' ? 'border-red-500 text-red-500' :
                                  row.priority === 'high' ? 'border-orange-500 text-orange-500' : 'border-slate-400'
                              }>
                                {row.priority}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap px-4 py-2 text-xs sm:text-sm">
                            <span className={new Date(row.dueDate || "") < new Date() && row.status !== 'completed' ? "text-red-500 font-bold" : ""}>
                              {formatDateValue(row.dueDate)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-4 px-2 sm:px-0">
                Showing {processedTableData.length} of {totalTasksInRange} tasks
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}