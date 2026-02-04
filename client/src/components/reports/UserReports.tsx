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
  Legend,
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
  CheckCircle2,
  Clock,
  TrendingUp,
  AlertTriangle,
  ListTodo,
  Download,
  Search,
  FilterX,
  ArrowUpDown,
} from "lucide-react";
import type { User as UserType, Task, Project, Bucket } from "@shared/schema";
import { format } from "date-fns";

const COLORS = ["#4f46e5", "#22d3ee", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

const formatDate = (value?: string | Date | null) => {
  if (!value) return "";
  return format(new Date(value), "yyyy-MM-dd");
};

interface UserReportsProps {
  selectedUserId: string;
  onUserChange: (userId: string) => void;
  users: UserType[];
  projects: Project[];
  isAdmin: boolean;
  currentUserId: number;
}

type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export default function UserReports({
  selectedUserId,
  onUserChange,
  users,
  projects,
  isAdmin,
  currentUserId,
}: UserReportsProps) {
  // --- State ---
  const [searchQuery, setSearchQuery] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterPriority, setFilterPriority] = useState<string>("all");
  const [sortConfig, setSortConfig] = useState<SortConfig>(null);

  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<Bucket[]>({
    queryKey: ["/api/buckets"],
  });

  // --- Derived Data & Lookups ---
  const availableUsers = isAdmin ? users : users.filter((u) => u.id === currentUserId);
  const selectedUser = users.find((u) => String(u.id) === selectedUserId);

  const userNameById = useMemo(() => new Map(users.map((user) => [user.id, user.name])), [users]);
  const projectNameById = useMemo(() => new Map(projects.map((p) => [p.id, p.name])), [projects]);
  const projectCustomerById = useMemo(() => new Map(
    projects.map((p) => [
      p.id,
      p.ownerId && userNameById.get(p.ownerId) ? userNameById.get(p.ownerId)! : "",
    ])
  ), [projects, userNameById]);

  const bucketNameById = useMemo(() => new Map(buckets.map((b) => [b.id, b.title || "Unnamed"])), [buckets]);

  const userTasks = useMemo(() => tasks.filter((t) => {
    const assignedUsers = t.assignedUsers || [];
    return assignedUsers.includes(Number(selectedUserId)) || t.assigneeId === Number(selectedUserId);
  }), [tasks, selectedUserId]);

  // --- Stats Calculation ---
  const totalAssigned = userTasks.length;
  const completedTasks = userTasks.filter((t) => t.status === "completed").length;
  const pendingTasks = userTasks.filter((t) => t.status !== "completed").length;
  const inProgressTasks = userTasks.filter((t) => t.status === "in_progress").length;

  const overdueTasks = userTasks.filter((t) => {
    if (!t.dueDate || t.status === "completed") return false;
    return new Date(t.dueDate) < new Date();
  }).length;

  const onTimeTasks = userTasks.filter((t) => {
    if (t.status !== "completed" || !t.dueDate) return false;
    return true;
  }).length;

  const completionRate = totalAssigned > 0 ? Math.round((completedTasks / totalAssigned) * 100) : 0;

  const estimatedMinutes = userTasks.reduce((sum, t) => {
    return sum + (t.estimateHours || 0) * 60 + (t.estimateMinutes || 0);
  }, 0);
  const estimatedHours = Math.round(estimatedMinutes / 60);

  const statusData = [
    { status: "Not Started", count: userTasks.filter((t) => t.status === "todo").length },
    { status: "In Progress", count: inProgressTasks },
    { status: "Completed", count: completedTasks },
  ];

  const priorityData = [
    { priority: "High", count: userTasks.filter((t) => t.priority === "high").length },
    { priority: "Medium", count: userTasks.filter((t) => t.priority === "medium").length },
    { priority: "Low", count: userTasks.filter((t) => t.priority === "low").length },
  ];

  const selectedUserName = selectedUser?.name || "User";
  const isLoading = tasksLoading || bucketsLoading;

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

  // --- Table Data Processing ---
  const processedTableData = useMemo(() => {
    let data = userTasks.map((task) => ({
      id: task.id,
      taskName: task.title || "Untitled Task",
      customer: projectCustomerById.get(task.projectId) || "",
      projectName: projectNameById.get(task.projectId) || `Project ${task.projectId}`,
      projectId: task.projectId,
      bucket: bucketNameById.get(Number(task.bucketId)) || "Unassigned",
      assignees: formatAssignees(task),
      status: task.status,
      priority: task.priority || "normal",
      startDate: task.startDate,
      dueDate: task.dueDate,
    }));

    // 1. Filter
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
      data = data.filter(
        (t) =>
          t.taskName.toLowerCase().includes(lowerQuery) ||
          t.projectName.toLowerCase().includes(lowerQuery) ||
          t.customer.toLowerCase().includes(lowerQuery)
      );
    }

    // 2. Sort
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
  }, [userTasks, projectCustomerById, projectNameById, bucketNameById, userNameById, filterProject, filterStatus, filterPriority, searchQuery, sortConfig]);

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
    if (!selectedUserId || isLoading) return;

    const reportHeaders = [
      "User", "Task", "Customer", "Project", "Bucket", "Assignees", "Status", "Priority", "Due Date"
    ];

    const reportRows = processedTableData.map((row) => [
      selectedUserName,
      row.taskName,
      row.customer,
      row.projectName,
      row.bucket,
      row.assignees,
      row.status,
      row.priority,
      formatDate(row.dueDate),
    ]);

    downloadCsvSections(`user-report-${selectedUserName}`, [
      { headers: reportHeaders, rows: reportRows },
    ]);
  };

  if (!selectedUserId || selectedUserId === "") {
    return (
      <div className="space-y-4 sm:space-y-6">
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="space-y-2 w-full sm:w-auto">
                <label className="text-sm font-medium text-muted-foreground">Select User</label>
                <Select value={selectedUserId} onValueChange={onUserChange}>
                  <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-user-report">
                    <SelectValue placeholder="Choose a user..." />
                  </SelectTrigger>
                  <SelectContent>
                    {availableUsers.map((user) => (
                      <SelectItem key={user.id} value={String(user.id)}>
                        {user.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
        <div className="flex items-center justify-center h-48 sm:h-64 text-sm sm:text-base text-muted-foreground bg-accent/20 rounded-lg border border-dashed">
          {isAdmin ? "Please select a user to view reports" : "Loading your report..."}
        </div>
      </div>
    );
  }

  // Get unique projects for the filter dropdown
  const userProjectIds = Array.from(new Set(userTasks.map(t => t.projectId)));
  const userProjects = projects.filter(p => userProjectIds.includes(p.id));

  return (
    <div className="space-y-4 sm:space-y-6 pb-10">
      <Card>
        <CardContent className="p-4 sm:pt-6">
          <div className="flex flex-col sm:flex-row items-end justify-between gap-4">
            <div className="space-y-2 w-full sm:w-auto">
              <label className="text-xs sm:text-sm font-medium text-muted-foreground">Select User</label>
              <Select value={selectedUserId} onValueChange={onUserChange}>
                <SelectTrigger className="w-full sm:w-[250px]" data-testid="select-user-report">
                  <SelectValue placeholder="Choose a user..." />
                </SelectTrigger>
                <SelectContent>
                  {availableUsers.map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleDownload}
              disabled={!selectedUserId || isLoading}
              data-testid="button-user-report-download"
              className="w-full sm:w-auto"
            >
              <Download className="h-4 w-4 mr-2" />
              Export
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
                  Tasks Assigned
                </CardTitle>
                <ListTodo className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{totalAssigned}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  {completedTasks} completed
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Completion Rate
                </CardTitle>
                <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-emerald-500" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{completionRate}%</div>
                <Progress value={completionRate} className="mt-2 h-1.5 sm:h-2" />
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
                <div className="text-lg sm:text-2xl font-bold text-destructive">{overdueTasks}</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  {onTimeTasks} on-time
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
                <CardTitle className="text-[10px] sm:text-sm font-medium text-muted-foreground">
                  Est. Hours
                </CardTitle>
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-accent" />
              </CardHeader>
              <CardContent className="p-3 sm:p-4 pt-1 sm:pt-0">
                <div className="text-lg sm:text-2xl font-bold">{estimatedHours}h</div>
                <p className="text-[9px] sm:text-xs text-muted-foreground mt-1">
                  Total workload
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="grid gap-4 sm:gap-6 grid-cols-1 xl:grid-cols-2">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
            >
              <Card className="h-full">
                <CardHeader className="p-4 sm:p-6">
                  <CardTitle className="flex items-center gap-2 text-sm sm:text-base">
                    <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5" />
                    Task Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <div className="h-[220px] sm:h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart margin={{ top: 0, left: 0, right: 0, bottom: 0 }}>
                        <Pie
                          data={statusData}
                          cx="50%"
                          cy="45%"
                          outerRadius="70%"
                          innerRadius="40%"
                          fill="#8884d8"
                          dataKey="count"
                          nameKey="status"
                          paddingAngle={2}
                        >
                          {statusData.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        {/* LEGEND ADDED BACK HERE */}
                        <Legend
                          verticalAlign="bottom"
                          height={36}
                          iconType="circle"
                          iconSize={8}
                          wrapperStyle={{ fontSize: "10px", paddingTop: "10px" }}
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
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
                    <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5" />
                    Priority Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-2 sm:p-6">
                  <div className="h-[220px] sm:h-[250px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="priority" tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                        <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip cursor={{ fill: 'transparent' }} contentStyle={{ borderRadius: '8px', fontSize: '12px' }} />
                        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                          {priorityData.map((entry, index) => {
                            let color = "#10b981"; // Low (green)
                            if (entry.priority.toLowerCase() === 'high') color = "#ef4444";
                            if (entry.priority.toLowerCase() === 'medium') color = "#f59e0b";
                            return <Cell key={`cell-${index}`} fill={color} />
                          })}
                        </Bar>
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
              <CardTitle className="text-base sm:text-lg">User Tasks</CardTitle>
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
                      {userProjects.map(p => (
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
              {/* Table Wrapper for Horizontal Scroll */}
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
                        Due <ArrowUpDown className="inline h-3 w-3 ml-1" />
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
                Showing {processedTableData.length} of {totalAssigned} tasks
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}