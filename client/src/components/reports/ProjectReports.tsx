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
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  FolderKanban,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ListTodo,
  Download,
  Search,
  ArrowUpDown,
  FilterX,
} from "lucide-react";
import type { Project, Task, User } from "@shared/schema";
import { format } from "date-fns";

const COLORS = [
  "#4f46e5",
  "#22d3ee",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
];

const formatDate = (value?: string | Date | null) => {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd");
};

// Helper to truncate long bucket names for charts
const truncateLabel = (label: string, maxLength: number = 15) => {
  if (label.length > maxLength) return label.substring(0, maxLength) + "...";
  return label;
};

interface ProjectReportsProps {
  selectedProjectId: string;
  onProjectChange: (projectId: string) => void;
  projects: Project[];
  users: User[];
  isAdmin: boolean;
}

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export default function ProjectReports({
  selectedProjectId,
  onProjectChange,
  projects,
  users,
}: ProjectReportsProps) {
  // --- State for Filters and Sorting ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [filterBucket, setFilterBucket] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: buckets = [] } = useQuery<
    { id: number; title: string; name: string; projectId: number }[]
  >({
    queryKey: ["/api/buckets"],
  });

  // --- Derived Data Calculation ---
  const selectedProject = projects.find(
    (p) => String(p.id) === selectedProjectId
  );

  // Memoize basic lookups
  const projectTasks = useMemo(() =>
    tasks.filter((t) => String(t.projectId) === selectedProjectId),
    [tasks, selectedProjectId]);

  const projectBuckets = useMemo(() =>
    buckets.filter((b) => Number(b.projectId) === Number(selectedProjectId)),
    [buckets, selectedProjectId]);

  const bucketNameById = useMemo(() =>
    new Map<number, string>(projectBuckets.map((b) => [b.id, b.title || "Unnamed"])),
    [projectBuckets]);

  const userNameById = useMemo(() =>
    new Map<number, string>(users.map((u) => [u.id, u.name])),
    [users]);

  // --- Stats Calculation ---
  const totalTasks = projectTasks.length;
  const completedTasks = projectTasks.filter((t) => t.status === "completed").length;
  const pendingTasks = projectTasks.filter((t) => t.status !== "completed").length;
  const overdueTasks = projectTasks.filter((t) => {
    if (!t.dueDate || t.status === "completed") return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const completionPercentage = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  const estimatedMinutes = projectTasks.reduce((sum, t) => {
    return sum + (t.estimateHours || 0) * 60 + (t.estimateMinutes || 0);
  }, 0);
  const estimatedHours = Math.round(estimatedMinutes / 60);

  // --- Chart Data ---
  const bucketDistribution = projectBuckets
    .map((bucket) => ({
      name: bucket.title || "Unnamed",
      displayName: truncateLabel(bucket.title || "Unnamed", 12),
      count: projectTasks.filter((t) => Number(t.bucketId) === Number(bucket.id)).length,
    }))
    .filter((b) => b.count > 0);

  const statusData = [
    { status: "Not Started", count: projectTasks.filter((t) => t.status === "todo").length },
    { status: "In Progress", count: projectTasks.filter((t) => t.status === "in_progress").length },
    { status: "Completed", count: completedTasks },
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

  const formatEstimateHours = (task: Task) => {
    const total = (task.estimateHours || 0) + (task.estimateMinutes || 0) / 60;
    return total.toFixed(2);
  };

  // --- Table Data Processing (Filter & Sort) ---
  const processedTableData = useMemo(() => {
    let data = projectTasks.map((task) => ({
      id: task.id,
      taskName: task.title || "Untitled Task",
      project: selectedProject?.name || "Project",
      customer: selectedProject?.ownerId && userNameById.get(selectedProject.ownerId) ? userNameById.get(selectedProject.ownerId)! : "",
      bucket: bucketNameById.get(Number(task.bucketId)) || "Unassigned",
      bucketId: task.bucketId,
      assignees: formatAssignees(task),
      status: task.status,
      priority: task.priority || "normal",
      startDate: task.startDate,
      dueDate: task.dueDate,
      estimate: Number(formatEstimateHours(task)),
    }));

    // 1. Filter
    if (filterStatus !== "all") {
      data = data.filter((t) => t.status === filterStatus);
    }
    if (filterPriority !== "all") {
      data = data.filter((t) => t.priority === filterPriority);
    }
    if (filterBucket !== "all") {
      data = data.filter((t) => String(t.bucketId) === filterBucket);
    }
    if (searchQuery) {
      const lowerQuery = searchQuery.toLowerCase();
      data = data.filter(
        (t) =>
          t.taskName.toLowerCase().includes(lowerQuery) ||
          t.assignees.toLowerCase().includes(lowerQuery) ||
          t.customer.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Sort
    if (sortConfig) {
      data.sort((a, b) => {
        // @ts-ignore - dynamic key access
        const aValue = a[sortConfig.key];
        // @ts-ignore
        const bValue = b[sortConfig.key];

        if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
        if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
        return 0;
      });
    }

    return data;
  }, [projectTasks, selectedProject, bucketNameById, userNameById, filterStatus, filterPriority, filterBucket, searchQuery, sortConfig]);

  const handleSort = (key: string) => {
    setSortConfig((current) => {
      if (current?.key === key) {
        return { key, direction: current.direction === "asc" ? "desc" : "asc" };
      }
      return { key, direction: "asc" };
    });
  };

  const handleDownload = () => {
    if (!selectedProjectId || tasksLoading) return;

    const reportHeaders = [
      "Task", "Project", "Customer", "Bucket", "Assignees", "Status", "Priority", "Start Date", "Due Date", "Estimate (hrs)"
    ];

    const reportRows = processedTableData.map((row) => [
      row.taskName,
      row.project,
      row.customer,
      row.bucket,
      row.assignees,
      row.status,
      row.priority,
      formatDate(row.startDate),
      formatDate(row.dueDate),
      row.estimate.toString(),
    ]);

    downloadCsvSections(`project-report-${selectedProject?.name || "export"}`, [
      { headers: reportHeaders, rows: reportRows },
    ]);
  };

  const clearFilters = () => {
    setSearchQuery("");
    setFilterStatus("all");
    setFilterPriority("all");
    setFilterBucket("all");
  };

  if (!selectedProjectId || selectedProjectId === "") {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-muted-foreground">Select Project</label>
                <Select value={selectedProjectId} onValueChange={onProjectChange}>
                  <SelectTrigger className="w-full sm:w-[250px]">
                    <SelectValue placeholder="Choose a project..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-center h-48 sm:h-64 text-sm sm:text-base text-muted-foreground bg-accent/20 rounded-lg border border-dashed">
          Please select a project to view reports
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      {/* Header & Controls */}
      <Card>
        <CardContent className="p-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">Select Project</label>
              <Select value={selectedProjectId} onValueChange={onProjectChange}>
                <SelectTrigger className="w-full sm:w-[250px]">
                  <SelectValue placeholder="Choose a project..." />
                </SelectTrigger>
                <SelectContent>
                  {projects.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!selectedProjectId || tasksLoading}
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </CardContent>
      </Card>

      {tasksLoading ? (
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-[100px] sm:h-[120px]" />)}
        </div>
      ) : (
        <>
          {/* Stats Cards - Compact Grid */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="grid gap-3 sm:gap-4 grid-cols-2 md:grid-cols-4"
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">Completion</CardTitle>
                <CheckCircle2 className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{completionPercentage}%</div>
                <Progress value={completionPercentage} className="mt-2 h-1.5 sm:h-2" />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">Total Tasks</CardTitle>
                <ListTodo className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{totalTasks}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  {completedTasks} done
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">Overdue</CardTitle>
                <AlertTriangle className="h-3 w-3 sm:h-4 sm:w-4 text-destructive" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold text-destructive">{overdueTasks}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">Attention</p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">Est. Time</CardTitle>
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{estimatedHours}h</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">Total</p>
              </CardContent>
            </Card>
          </motion.div>

          {/* Charts Section */}
          <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 }}>
              <Card className="h-full">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <FolderKanban className="h-4 w-4 sm:h-5 sm:w-5" /> Bucket Distribution
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  {bucketDistribution.length === 0 ? (
                    <div className="h-[200px] sm:h-[250px] flex items-center justify-center text-muted-foreground text-xs sm:text-sm">No bucket data</div>
                  ) : (
                    <div className="h-[220px] sm:h-[250px] w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
                          <Pie
                            data={bucketDistribution}
                            cx="50%" cy="45%"
                            outerRadius="70%"
                            innerRadius="40%"
                            fill="#8884d8"
                            dataKey="count"
                            nameKey="displayName"
                            paddingAngle={2}
                          >
                            {bucketDistribution.map((_, index) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          {/* Tooltip handles the "onclick" / "hover" label */}
                          <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                          {/* Legend Removed as per request */}
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>

            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3 }}>
              <Card className="h-full">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <ListTodo className="h-4 w-4 sm:h-5 sm:w-5" /> Task Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <div className="h-[220px] sm:h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="status" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} interval={0} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {statusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>

          {/* Advanced Table with Filters */}
          <Card>
            <CardHeader className="p-4 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Task Details</CardTitle>
              {/* Filters Toolbar */}
              <div className="flex flex-col xl:flex-row gap-2 sm:gap-4 mt-2 sm:mt-4">
                <div className="relative flex-1">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Search..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-8 h-9 text-xs sm:text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 sm:flex sm:flex-row gap-2">
                  <Select value={filterBucket} onValueChange={setFilterBucket}>
                    <SelectTrigger className="w-full sm:w-[130px] h-9 text-xs sm:text-sm">
                      <SelectValue placeholder="Bucket" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Buckets</SelectItem>
                      {projectBuckets.map(b => (
                        <SelectItem key={b.id} value={String(b.id)}>{b.title}</SelectItem>
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
              <div className="border-t sm:border sm:rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[100px] sm:w-[200px] h-9 px-2 sm:px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("taskName")}>
                        Task <ArrowUpDown className="inline h-3 w-3 ml-0.5 sm:ml-1" />
                      </TableHead>
                      {/* Bucket Column Visible on Mobile now */}
                      <TableHead className="h-9 px-2 sm:px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("bucket")}>
                        Bucket
                      </TableHead>
                      <TableHead className="h-9 px-2 sm:px-4 text-xs sm:text-sm cursor-pointer" onClick={() => handleSort("status")}>
                        Status
                      </TableHead>
                      <TableHead className="h-9 px-2 sm:px-4 text-xs sm:text-sm cursor-pointer hidden md:table-cell" onClick={() => handleSort("priority")}>
                        Priority
                      </TableHead>
                      <TableHead className="h-9 px-2 sm:px-4 text-xs sm:text-sm cursor-pointer text-right" onClick={() => handleSort("dueDate")}>
                        Due <ArrowUpDown className="inline h-3 w-3 ml-0.5 sm:ml-1" />
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
                          <TableCell className="font-medium px-2 py-1.5 sm:p-4 text-xs sm:text-sm">
                            <div className="flex flex-col max-w-[100px] sm:max-w-none">
                              <span className="truncate">{row.taskName}</span>
                              <span className="text-[10px] text-muted-foreground sm:hidden truncate">{row.assignees}</span>
                            </div>
                          </TableCell>

                          {/* Bucket visible on mobile, truncated to fit */}
                          <TableCell className="px-2 py-1.5 sm:p-4 text-[10px] sm:text-sm max-w-[80px] sm:max-w-none truncate">
                            {row.bucket}
                          </TableCell>

                          <TableCell className="px-2 py-1.5 sm:p-4">
                            <Badge
                              variant={row.status === 'completed' ? 'default' : row.status === 'in_progress' ? 'secondary' : 'outline'}
                              className="px-1.5 py-0 h-5 text-[10px] sm:text-xs sm:h-auto sm:px-2.5 sm:py-0.5 whitespace-nowrap"
                            >
                              {row.status === 'in_progress' ? 'In Prog' : row.status === 'todo' ? 'Todo' : 'Done'}
                            </Badge>
                          </TableCell>

                          <TableCell className="hidden md:table-cell">
                            {row.priority && (
                              <Badge variant="outline" className={
                                row.priority === 'urgent' ? 'border-red-500 text-red-500' :
                                  row.priority === 'high' ? 'border-orange-500 text-orange-500' : 'border-slate-400'
                              }>
                                {row.priority}
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell className="text-right whitespace-nowrap px-2 py-1.5 sm:p-4 text-xs sm:text-sm">
                            <span className={new Date(row.dueDate || "") < new Date() && row.status !== 'completed' ? "text-red-500 font-bold" : ""}>
                              {formatDate(row.dueDate)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="text-[10px] sm:text-xs text-muted-foreground mt-4 px-2 sm:px-0">
                Showing {processedTableData.length} of {totalTasks} tasks
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}