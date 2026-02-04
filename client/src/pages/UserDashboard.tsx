import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FolderKanban,
  CheckSquare,
  Clock,
  TrendingUp,
  ArrowRight,
  Bell,
  BarChart2,
  Calendar,
  Target,
} from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
} from "recharts";
import type { Notification, Project, Task } from "@shared/schema";

const startOfDay = (value: Date) =>
  new Date(value.getFullYear(), value.getMonth(), value.getDate());

const isSameDay = (left: Date, right: Date) =>
  startOfDay(left).getTime() === startOfDay(right).getTime();

const isBeforeDay = (left: Date, right: Date) =>
  startOfDay(left).getTime() < startOfDay(right).getTime();

const isDateInRange = (target: Date, start: Date | null, end: Date | null) => {
  const targetTime = startOfDay(target).getTime();
  const startTime = start ? startOfDay(start).getTime() : -Infinity;
  const endTime = end ? startOfDay(end).getTime() : Infinity;
  return targetTime >= startTime && targetTime <= endTime;
};

export default function UserDashboard() {
  const userId = Number(localStorage.getItem("userId"));
  const userName = localStorage.getItem("userName") || "User";

  const { data: myTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { assigneeId: userId }],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?assigneeId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<
    Project[]
  >({
    queryKey: ["/api/projects"],
  });

  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ["/api/notifications"],
  });
  const completedTasks = myTasks.filter((task) => task.status === "completed");
  const pendingTasks = myTasks.filter((task) => task.status === "todo");
  const inProgressTasks = myTasks.filter(
    (task) => task.status === "in_progress",
  );
  const today = startOfDay(new Date());
  const pipelinePreviewCount = 4;

  const { pipeline, myFocus } = useMemo(() => {
    const _today: Task[] = [];
    const _pending: Task[] = [];
    const _overdue: Task[] = [];

    myTasks.forEach((task) => {
      if (task.status === "completed") return;

      if (!task.dueDate) {
        _pending.push(task);
        return;
      }

      const due = new Date(task.dueDate);
      if (isSameDay(due, today)) {
        _today.push(task);
      } else if (isBeforeDay(due, today)) {
        _overdue.push(task);
      } else {
        _pending.push(task);
      }
    });

    const _myDay = myTasks.filter((task) => {
      if (task.status === "completed") return false;
      const startDate = task.startDate ? new Date(task.startDate) : null;
      const dueDate = task.dueDate ? new Date(task.dueDate) : null;
      return isDateInRange(today, startDate, dueDate);
    });

    const _myOverdue = myTasks.filter((task) => {
      if (!task.dueDate) return false;
      return task.status !== "completed" && isBeforeDay(new Date(task.dueDate), today);
    });

    return {
      pipeline: { today: _today, pending: _pending, overdue: _overdue },
      myFocus: { today: _myDay, overdue: _myOverdue },
    };
  }, [myTasks, today]);

  const taskById = new Map(myTasks.map((task) => [task.id, task]));
  const recentNotifications = notifications.slice(0, 5);
  const formatNotification = (notification: Notification) => {
    const taskTitle = notification.taskId
      ? taskById.get(notification.taskId)?.title || `Task #${notification.taskId}`
      : "Task update";
    switch (notification.type) {
      case "assignment":
        return `Assigned: ${taskTitle}`;
      case "completion":
        return `Completed: ${taskTitle}`;
      case "update":
        return `Updated: ${taskTitle}`;
      default:
        return `Notification: ${taskTitle}`;
    }
  };

  const myProjectIds = Array.from(
    new Set(myTasks.map((task) => task.projectId)),
  );
  const myProjects = projects.filter((project) =>
    myProjectIds.includes(project.id),
  );

  const taskStatusData = [
    { name: "Completed", value: completedTasks.length, color: "#10b981" },
    { name: "In Progress", value: inProgressTasks.length, color: "#f59e0b" },
    { name: "Pending", value: pendingTasks.length, color: "#6366f1" },
  ];

  const projectProgressData = myProjects.map((project) => {
    const projectTasks = myTasks.filter((t) => t.projectId === project.id);
    const completed = projectTasks.filter(
      (t) => t.status === "completed",
    ).length;
    const total = projectTasks.length;
    return {
      name:
        project.name.length > 15
          ? project.name.substring(0, 15) + "..."
          : project.name,
      completed,
      pending: total - completed,
      percentage: total > 0 ? Math.round((completed / total) * 100) : 0,
    };
  });

  const totalEstimatedHours = myTasks.reduce((acc, task) => {
    return acc + (task.estimateHours || 0) + (task.estimateMinutes || 0) / 60;
  }, 0);

  if (tasksLoading || projectsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1
            className="text-3xl font-display font-bold text-slate-900"
            data-testid="text-welcome"
          >
            Welcome back, {userName}!
          </h1>
          <p className="text-muted-foreground mt-1">
            Here's an overview of your tasks and projects
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Assigned Projects
              </CardTitle>
              <FolderKanban className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-projects">
                {myProjects.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Active projects
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Total Tasks
              </CardTitle>
              <CheckSquare className="h-4 w-4 text-accent" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-total-tasks"
              >
                {myTasks.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Assigned to you
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Completed
              </CardTitle>
              <TrendingUp className="h-4 w-4 text-emerald-500" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold text-emerald-600"
                data-testid="stat-completed"
              >
                {completedTasks.length}
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                {myTasks.length > 0
                  ? Math.round((completedTasks.length / myTasks.length) * 100)
                  : 0}
                % completion rate
              </p>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="hover-elevate">
            <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Estimated Time
              </CardTitle>
              <Clock className="h-4 w-4 text-amber-500" />
            </CardHeader>
            <CardContent>
              <div
                className="text-2xl font-bold"
                data-testid="stat-estimated-time"
              >
                {totalEstimatedHours.toFixed(1)}h
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Total workload
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">
                Task Status Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              {myTasks.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      className="text-xs"
                      data={taskStatusData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="value"
                      label={({ name, percent }) =>
                        `${name} ${(percent * 100).toFixed(0)}%`
                      }
                    >
                      {taskStatusData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No tasks assigned yet
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Project Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {projectProgressData.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={projectProgressData} layout="vertical">
                    <XAxis type="number" />
                    <YAxis
                      dataKey="name"
                      type="category"
                      width={100}
                      tick={{ fontSize: 12 }}
                    />
                    <Tooltip />
                    <Legend />
                    <Bar
                      dataKey="completed"
                      stackId="a"
                      fill="#10b981"
                      name="Completed"
                    />
                    <Bar
                      dataKey="pending"
                      stackId="a"
                      fill="#e2e8f0"
                      name="Pending"
                    />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                  No projects assigned yet
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">My Projects</CardTitle>
              <Link href="/user/projects">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {myProjects.slice(0, 3).map((project) => {
                const projectTasks = myTasks.filter(
                  (t) => t.projectId === project.id,
                );
                const completed = projectTasks.filter(
                  (t) => t.status === "completed",
                ).length;
                const percentage =
                  projectTasks.length > 0
                    ? Math.round((completed / projectTasks.length) * 100)
                    : 0;

                return (
                  <Link key={project.id} href={`/user/projects/${project.id}`}>
                    <div className="p-3 rounded-lg border border-slate-200 hover-elevate cursor-pointer">
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <span className="font-medium text-sm truncate">
                          {project.name}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {project.status}
                        </Badge>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {completed}/{projectTasks.length} tasks completed
                      </p>
                    </div>
                  </Link>
                );
              })}
              {myProjects.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No projects assigned yet
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="text-lg">Recent Tasks</CardTitle>
              <Link href="/user/tasks">
                <Button variant="ghost" size="sm">
                  View All <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </Link>
            </CardHeader>
            <CardContent className="space-y-3">
              {myTasks.slice(0, 4).map((task) => (
                <div
                  key={task.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-slate-200"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">{task.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {task.estimateHours || 0}h {task.estimateMinutes || 0}m
                      estimated
                    </p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      task.status === "completed"
                        ? "bg-emerald-100 text-emerald-700"
                        : task.status === "in_progress"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-slate-100 text-slate-700"
                    }
                  >
                    {task.status === "in_progress"
                      ? "In Progress"
                      : task.status === "completed"
                        ? "Done"
                        : "Todo"}
                  </Badge>
                </div>
              ))}
              {myTasks.length === 0 && (
                <p className="text-muted-foreground text-center py-4">
                  No tasks assigned yet
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
        >
          <Card>
            <CardHeader className="pb-4 border-b border-slate-100">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart2 className="h-5 w-5 text-primary" />
                    Operational Pipeline
                  </CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Centralized view of today&apos;s workload and progress.
                  </p>
                </div>
                <div className="self-start md:self-auto bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
                    Total Pending
                  </p>
                  <p className="text-2xl font-bold text-slate-900 leading-tight">
                    {pipeline.pending.length}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                      Today&apos;s Tasks
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                      {pipeline.today.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pipeline.today.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/30">
                        No tasks due today.
                      </div>
                    )}
                    {pipeline.today.slice(0, pipelinePreviewCount).map((task) => (
                      <div key={task.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">{task.title}</p>
                          <span className="text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {task.status === "in_progress" ? "in progress" : "todo"}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                        </div>
                      </div>
                    ))}
                    {pipeline.today.length > pipelinePreviewCount && (
                      <p className="text-xs text-slate-500 text-center">
                        + {pipeline.today.length - pipelinePreviewCount} more tasks
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                      Pending Tasks
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                      {pipeline.pending.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pipeline.pending.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/30">
                        No pending tasks.
                      </div>
                    )}
                    {pipeline.pending.slice(0, pipelinePreviewCount).map((task) => (
                      <div key={task.id} className="p-3 rounded-xl border border-slate-100 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">{task.title}</p>
                          <span className="text-[10px] font-semibold uppercase text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">
                            {task.status === "in_progress" ? "in progress" : "todo"}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                        </div>
                      </div>
                    ))}
                    {pipeline.pending.length > pipelinePreviewCount && (
                      <p className="text-xs text-slate-500 text-center">
                        + {pipeline.pending.length - pipelinePreviewCount} more tasks
                      </p>
                    )}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs font-bold text-slate-700 uppercase tracking-wide">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      Due Tasks
                    </div>
                    <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded-full font-bold text-slate-600">
                      {pipeline.overdue.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {pipeline.overdue.length === 0 && (
                      <div className="text-center py-6 text-slate-400 text-xs border border-dashed border-slate-200 rounded-lg bg-slate-50/30">
                        No overdue tasks.
                      </div>
                    )}
                    {pipeline.overdue.slice(0, pipelinePreviewCount).map((task) => (
                      <div key={task.id} className="p-3 rounded-xl border border-rose-100 bg-white shadow-sm">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 line-clamp-2">{task.title}</p>
                          <span className="text-[10px] font-semibold uppercase text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">
                            {task.status === "in_progress" ? "in progress" : "todo"}
                          </span>
                        </div>
                        <div className="mt-2 text-[11px] text-slate-500 flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                        </div>
                      </div>
                    ))}
                    {pipeline.overdue.length > pipelinePreviewCount && (
                      <p className="text-xs text-slate-500 text-center">
                        + {pipeline.overdue.length - pipelinePreviewCount} more tasks
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.0 }}
        >
          <Card>
            <CardHeader className="pb-3 border-b border-slate-100">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Target className="h-5 w-5 text-primary" />
                  My Focus
                </CardTitle>
                <div className="flex items-center gap-2">
                  {myFocus.overdue.length > 0 && (
                    <Badge className="bg-rose-500 hover:bg-rose-600 shadow-sm">
                      {myFocus.overdue.length} Overdue
                    </Badge>
                  )}
                  <Link href="/todo">
                    <Button variant="outline" size="sm" className="h-8">
                      All Tasks
                    </Button>
                  </Link>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-4">
              {myFocus.today.length === 0 && myFocus.overdue.length === 0 ? (
                <div className="text-muted-foreground text-center py-6 border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/30">
                  No tasks in focus right now.
                </div>
              ) : (
                <div className="space-y-3 max-h-[420px] overflow-y-auto custom-scrollbar pr-1">
                  {myFocus.overdue.map((task) => (
                    <Link key={`overdue-${task.id}`} href={`/todo?taskId=${task.id}`}>
                      <a className="block">
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-rose-600 bg-rose-50 border border-rose-100 rounded-full px-2 py-0.5">
                            Overdue
                          </span>
                        </div>
                      </a>
                    </Link>
                  ))}
                  {myFocus.today.map((task) => (
                    <Link key={`today-${task.id}`} href={`/todo?taskId=${task.id}`}>
                      <a className="block">
                        <div className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">{task.title}</p>
                            <p className="text-xs text-muted-foreground">
                              Due {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "No date"}
                            </p>
                          </div>
                          <span className="text-[10px] font-semibold uppercase tracking-wide text-blue-700 bg-blue-50 border border-blue-100 rounded-full px-2 py-0.5">
                            My Day
                          </span>
                        </div>
                      </a>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.1 }}
      >
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              Notifications
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentNotifications.length === 0 ? (
              <div className="text-muted-foreground text-center py-6">
                No notifications yet.
              </div>
            ) : (
              recentNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border border-slate-200"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {formatNotification(notification)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notification.createdAt
                        ? new Date(notification.createdAt).toLocaleString()
                        : "Unknown time"}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs">
                    {notification.type}
                  </Badge>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
