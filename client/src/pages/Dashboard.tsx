import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  FolderKanban,
  CheckSquare,
  TrendingUp,
  Clock,
  Target,
  BarChart2,
  Users,
  Loader2,
  Bell,
  X,
  Calendar,
  AlertCircle,
  MoreHorizontal,
  ArrowUpCircle,
  ListTodo,
  AlertTriangle,
  Menu
} from "lucide-react";

import type { Project, Task, User, Notification } from "@shared/schema";

// --- 1. Inline Utility Functions ---

const startOfDay = (date: Date) => {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const isSameDay = (date1: Date, date2: Date) => {
  return startOfDay(date1).getTime() === startOfDay(date2).getTime();
};

const isBeforeDay = (date1: Date, date2: Date) => {
  return startOfDay(date1).getTime() < startOfDay(date2).getTime();
};

const isDateInRange = (target: Date, start: Date | null, end: Date | null) => {
  const targetTime = startOfDay(target).getTime();
  const startTime = start ? startOfDay(start).getTime() : -Infinity;
  const endTime = end ? startOfDay(end).getTime() : Infinity;
  return targetTime >= startTime && targetTime <= endTime;
};

const formatDateTime = (dateStr: string | Date | null) => {
  if (!dateStr) return "";
  return new Date(dateStr).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const getCurrentUserId = () => {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem("userId")) || 0;
};

const isAssignedToUser = (task: Task, userId: number) => {
  if (!userId) return false;
  if (task.assigneeId === userId) return true;
  return (task.assignedUsers || []).includes(userId);
};

const getPriorityWeight = (priority?: string) => {
  switch (priority?.toLowerCase()) {
    case 'high': return 3;
    case 'medium': return 2;
    case 'low': return 1;
    default: return 0;
  }
};

const sortTasksByPriority = (a: Task, b: Task) => {
  // @ts-ignore 
  const weightA = getPriorityWeight(a.priority);
  // @ts-ignore
  const weightB = getPriorityWeight(b.priority);
  return weightB - weightA;
};

// --- 2. Sub-Components (Mobile Optimized) ---

const PipelineTaskCard = ({ task }: { task: Task }) => {
  return (
    <div className="group relative p-3 bg-white rounded-lg border border-slate-200 shadow-[0_1px_2px_rgba(0,0,0,0.02)] hover:shadow-md transition-all duration-200 cursor-default active:scale-[0.99] touch-manipulation">
      {/* Uniform Left Strip */}
      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-lg bg-slate-100 group-hover:bg-slate-300 transition-colors" />

      <div className="pl-2.5 flex flex-col gap-2">
        <div className="flex justify-between items-start gap-2">
          <p className="text-sm md:text-xs font-semibold text-slate-700 line-clamp-2 leading-snug group-hover:text-slate-900">
            {task.title}
          </p>
          {/* @ts-ignore */}
          {task.priority === 'high' && (
            <ArrowUpCircle className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
          )}
        </div>

        <div className="flex items-center justify-between">
          <span className="text-xs md:text-[10px] text-slate-500 font-medium flex items-center gap-1.5 md:gap-1">
            <Clock className="w-3 h-3 md:w-2.5 md:h-2.5 text-slate-400" />
            {task.dueDate ? new Date(task.dueDate).toLocaleDateString(undefined, { month: 'numeric', day: 'numeric' }) : '--'}
          </span>

          <div className="flex items-center gap-1.5">
            <span className={`w-1.5 h-1.5 rounded-full ${task.status === 'in_progress' ? 'bg-indigo-500' : 'bg-slate-300'}`} />
            <span className="text-[10px] md:text-[9px] uppercase font-bold text-slate-400 tracking-wider">
              {task.status === 'in_progress' ? 'WIP' : 'Todo'}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}

const MyFocusTaskItem = ({
  task,
  isOverdue = false,
  tag
}: {
  task: Task;
  isOverdue?: boolean;
  tag: 'My Day' | 'Overdue';
}) => (
  <div className="group flex items-start gap-3 p-2.5 rounded-lg border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-sm transition-all cursor-pointer active:bg-slate-50 touch-manipulation">

    <div className={`mt-0.5 w-4 h-4 md:w-3.5 md:h-3.5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${isOverdue ? "border-rose-300 group-hover:border-rose-500" : "border-slate-300 group-hover:border-indigo-500"
      }`}>
      {isOverdue && <div className="w-2 h-2 md:w-1.5 md:h-1.5 rounded-full bg-rose-500" />}
    </div>

    <div className="min-w-0 flex-1">
      <div className="flex justify-between items-start gap-2 "> {/* Added gap-2 for safety */}

        {/* REMOVED 'w-full', ADDED 'min-w-0' to ensure truncation works */}
        <p className="font-semibold text-sm md:text-xs text-slate-800 truncate leading-tight w-[20vw] overflow-hidden">
          {task.title}
        </p>

        <span className={`text-[10px] md:text-[9px] font-bold px-1.5 py-0.5 rounded-md leading-tight shrink-0 ${tag === 'Overdue'
          ? 'text-rose-700 bg-rose-50'
          : 'text-blue-700 bg-blue-50'
          }`}>
          {tag === 'My Day' ? 'Today' : 'Late'}
        </span>
      </div>

      <div className="flex items-center gap-2 mt-1.5 md:mt-1">
        <span className="text-xs md:text-[10px] text-slate-400">Project Task</span>
        <span className="text-slate-300 text-[10px]">•</span>
        <span className={`text-xs md:text-[10px] capitalize ${task.status === 'in_progress' ? 'text-indigo-600 font-medium' : 'text-slate-500'}`}>
          {task.status.replace('_', ' ')}
        </span>
      </div>
    </div>
  </div>
);

const NotificationSidebar = ({
  isOpen,
  onClose,
  notifications,
  taskById
}: {
  isOpen: boolean;
  onClose: () => void;
  notifications: Notification[];
  taskById: Map<number, Task>;
}) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-900/40 z-50 backdrop-blur-sm"
          />
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed inset-y-0 right-0 z-[60] w-full max-w-xs sm:max-w-sm bg-white shadow-2xl border-l border-slate-200 flex flex-col"
          >
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-white safe-area-top">
              <h3 className="font-semibold text-sm text-slate-900 flex items-center gap-2">
                <Bell className="w-4 h-4 text-slate-500" />
                Notifications
              </h3>
              <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 text-slate-400 hover:text-slate-600">
                <X className="w-4 h-4" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1 bg-slate-50/50 safe-area-bottom">
              {notifications.length === 0 ? (
                <div className="h-64 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <Bell className="w-8 h-8 opacity-20" />
                  <p className="text-sm font-medium">No new notifications</p>
                </div>
              ) : (
                notifications.map((n) => {
                  const taskTitle = n.taskId ? taskById.get(n.taskId)?.title : null;
                  return (
                    <div key={n.id} className="text-sm p-3 rounded-lg bg-white border border-slate-200 hover:shadow-sm transition-all">
                      <div className="flex justify-between items-start mb-1">
                        <span className="font-medium text-slate-700 capitalize flex items-center gap-2 text-xs">
                          <span className={`w-1.5 h-1.5 rounded-full ${n.type === 'completion' ? 'bg-emerald-500' : 'bg-blue-500'}`} />
                          {n.type.replace('_', ' ')}
                        </span>
                        <span className="text-[10px] text-slate-400">
                          {formatDateTime(n.createdAt)}
                        </span>
                      </div>
                      <p className="text-xs text-slate-600 mt-1 line-clamp-2">
                        {taskTitle ? `Task: ${taskTitle}` : `Task #${n.taskId}`}
                      </p>
                    </div>
                  );
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// --- 3. Main Dashboard ---

const Dashboard = () => {
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const currentUserId = getCurrentUserId();
  const currentUserRole = typeof localStorage === "undefined" ? null : localStorage.getItem("userRole");
  const pipelinePreviewCount = 6;

  // Data Fetching
  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({ queryKey: ["/api/projects"] });
  const { data: tasks = [], isLoading: tasksLoading } = useQuery<Task[]>({ queryKey: ["/api/tasks"] });
  const { data: users = [], isLoading: usersLoading } = useQuery<User[]>({ queryKey: ["/api/users"] });
  const { data: notifications = [], isLoading: notifLoading } = useQuery<Notification[]>({ queryKey: ["/api/notifications"] });

  const isLoading = projectsLoading || tasksLoading || usersLoading || notifLoading;

  const myTodoTasks = useMemo(
    () => {
      if (!currentUserId || currentUserRole === "Admin") return tasks;
      return tasks.filter((task) => isAssignedToUser(task, currentUserId));
    },
    [tasks, currentUserId, currentUserRole],
  );

  // Logic & Derived State
  const { stats, pipeline, myFocus, taskById, totalPipelineTasks } = useMemo(() => {
    const today = startOfDay(new Date());
    const completed = tasks.filter((t) => t.status === "completed");

    // Stats
    const efficiency = tasks.length > 0 ? Math.round((completed.length / tasks.length) * 100) : 0;
    const pendingIssues = tasks.filter((t) => t.status !== "completed" && t.dueDate && isBeforeDay(new Date(t.dueDate), today));

    // Pipeline Logic
    const _today: Task[] = [];
    const _pending: Task[] = [];
    const _overdue: Task[] = [];
    const _taskMap = new Map<number, Task>();

    tasks.forEach(task => {
      _taskMap.set(task.id, task);
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

    const totalPipelineTasks = _today.length + _pending.length + _overdue.length;

    // My Focus Logic
    const _myToday = myTodoTasks
      .filter((task) => {
        if (task.status === "completed") return false;
        const startDate = task.startDate ? new Date(task.startDate) : null;
        const dueDate = task.dueDate ? new Date(task.dueDate) : null;
        return isDateInRange(today, startDate, dueDate);
      })
      .sort(sortTasksByPriority);

    const _myOverdue = myTodoTasks
      .filter((task) => {
        if (!task.dueDate) return false;
        return task.status !== "completed" && isBeforeDay(new Date(task.dueDate), today);
      })
      .sort(sortTasksByPriority);

    return {
      stats: { completed, efficiency, pendingIssues },
      pipeline: { today: _today, pending: _pending, overdue: _overdue },
      myFocus: { today: _myToday, overdue: _myOverdue },
      taskById: _taskMap,
      totalPipelineTasks
    };
  }, [tasks, myTodoTasks]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-50">
        <Loader2 className="w-8 h-8 animate-spin text-slate-400 mb-2" />
        <p className="text-slate-500 text-sm font-medium">Loading workspace...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] font-sans text-slate-900 pb-10">

      {/* --- Mobile-Ready Header --- */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-30 px-4 py-3 lg:px-8 lg:py-4 shadow-sm">
        <div className="max-w-[1600px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Mobile Menu Trigger Placeholder */}
            <button className="lg:hidden p-1 -ml-1 text-slate-500">
              <Menu className="w-6 h-6" />
            </button>
            <div>
              <h1 className="text-lg md:text-xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
                Dashboard
              </h1>
              <p className="hidden md:block text-slate-500 text-xs mt-0.5">
                Overview of workspace metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-md text-xs font-medium text-slate-600">
              <Calendar className="w-3.5 h-3.5 text-slate-400" />
              {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>

            <button
              onClick={() => setIsNotifOpen(true)}
              className="relative p-2 bg-white hover:bg-slate-50 border border-slate-200 rounded-full md:rounded-md transition-all active:scale-95"
            >
              <Bell className="w-5 h-5 md:w-4 md:h-4 text-slate-500" />
              {notifications.length > 0 && (
                <span className="absolute top-1.5 right-2 md:top-1 md:right-1.5 w-2 h-2 bg-rose-500 rounded-full border border-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto p-4 lg:p-8 space-y-6">

        {/* --- KPI Cards (Responsive Grid) --- */}
        {/* Mobile: 1 col, Tablet: 2 cols, Desktop: 4 cols */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: "Active Projects", value: projects.length, icon: FolderKanban, color: "text-blue-600", bg: "bg-blue-50" },
            { label: "Total Tasks", value: tasks.length, icon: CheckSquare, color: "text-indigo-600", bg: "bg-indigo-50" },
            { label: "Efficiency", value: `${stats.efficiency}%`, icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
            { label: "Critical Issues", value: stats.pendingIssues.length, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
          ].map((stat, i) => (
            <Card key={i} className="border-slate-200 shadow-sm bg-white hover:border-slate-300 transition-all">
              <CardContent className="p-4 md:p-5 flex items-center justify-between">
                <div>
                  <p className="text-[11px] md:text-xs font-bold text-slate-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5 md:mt-1">{stat.value}</p>
                </div>
                <div className={`p-2.5 md:p-3 rounded-xl ${stat.bg} ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* --- MAIN CONTENT GRID (Responsive Ratio) --- */}
        {/* Mobile: Stacked, Desktop: 2:1 Ratio */}
        <div className="grid grid-cols-1 lg:grid-cols-[7fr_3fr] gap-6 items-start">

          {/* 1. Operational Pipeline */}
          <Card className="border-slate-200 shadow-sm h-full flex flex-col bg-white overflow-hidden">
            <CardHeader className="pb-3 border-b border-slate-100 px-4 pt-4 md:px-5 md:pt-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-slate-400" />
                    Operational Pipeline
                  </CardTitle>
                  <div className="h-4 w-[1px] bg-slate-200 hidden sm:block" />
                  <span className="text-xs font-medium text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-100">
                    {totalPipelineTasks} Pending
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-slate-400">
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pt-5 px-4 md:px-5 flex-1">
              {/* Mobile: Vertical Stack (gap-8), Desktop: 3 Cols (gap-4) */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-4 h-full">

                {/* Column: Today */}
                <div className="flex flex-col h-full">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Today</h4>
                    <span className="text-[10px] font-bold bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded border border-blue-100">
                      {pipeline.today.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pipeline.today.length === 0 ? (
                      <div className="p-4 md:p-6 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                        <span className="text-xs text-slate-400">No tasks due today</span>
                      </div>
                    ) : (
                      pipeline.today.slice(0, pipelinePreviewCount).map((task) => (
                        <PipelineTaskCard key={task.id} task={task} />
                      ))
                    )}
                  </div>
                </div>

                {/* Column: Pending */}
                <div className="flex flex-col h-full md:border-l border-slate-100 md:pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Pending</h4>
                    <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded border border-slate-200">
                      {pipeline.pending.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pipeline.pending.length === 0 ? (
                      <div className="p-4 md:p-6 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                        <span className="text-xs text-slate-400">Pending clear</span>
                      </div>
                    ) : (
                      pipeline.pending.slice(0, pipelinePreviewCount).map((task) => (
                        <PipelineTaskCard key={task.id} task={task} />
                      ))
                    )}
                  </div>
                </div>

                {/* Column: Overdue */}
                <div className="flex flex-col h-full md:border-l border-slate-100 md:pl-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Overdue</h4>
                    <span className="text-[10px] font-bold bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded border border-rose-100">
                      {pipeline.overdue.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {pipeline.overdue.length === 0 ? (
                      <div className="p-4 md:p-6 border border-dashed border-slate-200 rounded-lg text-center bg-slate-50/50">
                        <span className="text-xs text-slate-400">No overdue tasks</span>
                      </div>
                    ) : (
                      pipeline.overdue.slice(0, pipelinePreviewCount).map((task) => (
                        <PipelineTaskCard key={task.id} task={task} />
                      ))
                    )}
                  </div>
                </div>

              </div>
            </CardContent>
          </Card>

          {/* 2. My Focus */}
          <Card className="border-slate-200 shadow-sm flex flex-col h-full bg-white">
            <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/30 px-4 pt-4">
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-bold text-slate-900 flex items-center gap-2">
                    <Target className="w-4 h-4 text-indigo-600" />
                    My Focus
                  </CardTitle>
                  <Link href="/todo">
                    <Button variant="outline" size="sm" className="h-7 text-xs bg-white px-3 border-slate-200 hover:bg-slate-50">
                      View All
                    </Button>
                  </Link>
                </div>
                {myFocus.overdue.length > 0 && (
                  <div className="flex items-center gap-1.5 mt-1 bg-rose-50/50 p-1.5 rounded-md border border-rose-100/50 w-fit">
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
                    <span className="text-xs font-medium text-rose-600">
                      <span className="font-bold">{myFocus.overdue.length} overdue</span> tasks require attention.
                    </span>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="pt-4 px-4 flex-1">
              {myFocus.today.length === 0 && myFocus.overdue.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-center py-12 border-2 border-dashed border-slate-100 rounded-lg bg-slate-50/20">
                  <ListTodo className="w-8 h-8 text-slate-300 mb-2" />
                  <p className="text-xs font-medium text-slate-500">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-4 max-h-[500px] md:max-h-[600px] overflow-y-auto pr-1 custom-scrollbar">

                  {/* Section 1: My Day */}
                  {myFocus.today.length > 0 && (
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 pl-1">My Day</h5>
                      {myFocus.today.map((t) => (
                        <Link
                          key={`today-${t.id}`}
                          href={`/todo?taskId=${t.id}`}
                          className="block"
                        >
                          <MyFocusTaskItem task={t} tag="My Day" />
                        </Link>
                      ))}
                    </div>
                  )}

                  {/* Section 2: Overdue */}
                  {myFocus.overdue.length > 0 && (
                    <div className="space-y-1.5">
                      <h5 className="text-[10px] uppercase tracking-wider font-bold text-slate-400 pl-1">Outstanding</h5>
                      {myFocus.overdue.map((t) => (
                        <Link
                          key={`overdue-${t.id}`}
                          href={`/todo?taskId=${t.id}`}
                          className="block"
                        >
                          <MyFocusTaskItem task={t} isOverdue tag="Overdue" />
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

        </div>

        {/* --- Global Stats Footer --- */}
        <div className="bg-white border border-slate-200 rounded-lg p-4 md:p-6 shadow-sm flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-8">
          <div className="flex-1 w-full">
            <div className="flex items-center justify-between mb-2">
              <div>
                <span className="text-sm font-bold text-slate-900">Workspace Efficiency</span>
                <span className="mx-2 text-slate-300 hidden sm:inline">|</span>
                <span className="text-xs text-slate-500 hidden sm:inline">Based on task completion velocity</span>
              </div>
              <span className="text-lg font-bold text-slate-900">{stats.efficiency}%</span>
            </div>
            <Progress value={stats.efficiency} className="h-2 bg-slate-100 [&>*]:bg-slate-900" />
          </div>

          <div className="flex w-full md:w-auto justify-between md:justify-start gap-8 text-sm pt-4 md:pt-0 border-t md:border-t-0 border-slate-100">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-blue-50 text-blue-600">
                <CheckSquare className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-slate-900 font-bold">{tasks.filter(t => t.status === "in_progress").length}</span>
                <span className="text-slate-500 text-xs">Active</span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-indigo-50 text-indigo-600">
                <Users className="w-4 h-4" />
              </div>
              <div>
                <span className="block text-slate-900 font-bold">{users.length}</span>
                <span className="text-slate-500 text-xs">Members</span>
              </div>
            </div>
          </div>
        </div>

      </div>

      <NotificationSidebar
        isOpen={isNotifOpen}
        onClose={() => setIsNotifOpen(false)}
        notifications={notifications}
        taskById={taskById}
      />
    </div>
  );
};

export default Dashboard;
