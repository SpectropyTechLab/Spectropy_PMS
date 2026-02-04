import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import {
  Calendar as CalendarIcon,
  CheckCircle2,
  Clock,
  Infinity as AllIcon,
  Plus,
  Sun,
  AlertCircle,
  FileText,
  Menu, // Imported Menu icon
  X,    // Imported Close icon
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { apiRequest, queryClient } from "@/lib/queryClient";
import type { Attachment, ChecklistItem, Task, User } from "@shared/schema";
import { TaskDialog } from "@/components/project-board/TaskDialog";
import { useUpload } from "@/hooks/use-upload";
import { format } from "date-fns";

type TodoView = "my-day" | "today" | "overdue" | "upcoming" | "all";

// --- Date Helpers ---
const getStartOfDay = (date: Date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

const isSameDay = (date1: Date, date2: Date) =>
  getStartOfDay(date1).getTime() === getStartOfDay(date2).getTime();

const isBeforeDay = (date1: Date, date2: Date) =>
  getStartOfDay(date1).getTime() < getStartOfDay(date2).getTime();

const isAfterDay = (date1: Date, date2: Date) =>
  getStartOfDay(date1).getTime() > getStartOfDay(date2).getTime();

const isDateInRange = (target: Date, start: Date | null, end: Date | null) => {
  const targetTime = getStartOfDay(target).getTime();
  const startTime = start ? getStartOfDay(start).getTime() : -Infinity;
  const endTime = end ? getStartOfDay(end).getTime() : Infinity;
  return targetTime >= startTime && targetTime <= endTime;
};

// --- Configuration ---
const viewOptions: { id: TodoView; label: string; icon: any; color: string }[] = [
  { id: "my-day", label: "My Day", icon: Sun, color: "text-amber-500" },
  { id: "today", label: "Created Today", icon: FileText, color: "text-purple-500" },
  { id: "overdue", label: "Overdue", icon: AlertCircle, color: "text-red-500" },
  { id: "upcoming", label: "Upcoming", icon: CalendarIcon, color: "text-blue-500" },
  { id: "all", label: "All Tasks", icon: AllIcon, color: "text-slate-500" },
];

const getCurrentUserId = () => {
  if (typeof localStorage === "undefined") return 0;
  return Number(localStorage.getItem("userId")) || 0;
};

const isAssignedToUser = (task: Task, userId: number) => {
  if (!userId) return false;
  if (task.assigneeId === userId) return true;
  return (task.assignedUsers || []).includes(userId);
};

export default function TodoPage() {
  const [location] = useLocation();
  const [activeView, setActiveView] = useState<TodoView>("my-day");
  const [isSidebarOpen, setIsSidebarOpen] = useState(false); // New state for mobile menu

  // Edit Task State
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  // Form State
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskAssignees, setEditTaskAssignees] = useState<number[]>([]);
  const [editTaskStatus, setEditTaskStatus] = useState("todo");
  const [editTaskStartDate, setEditTaskStartDate] = useState("");
  const [editTaskEndDate, setEditTaskEndDate] = useState("");
  const [editTaskEstimateHours, setEditTaskEstimateHours] = useState(0);
  const [editTaskEstimateMinutes, setEditTaskEstimateMinutes] = useState(0);
  const [editTaskChecklist, setEditTaskChecklist] = useState<ChecklistItem[]>([]);
  const [editTaskAttachments, setEditTaskAttachments] = useState<Attachment[]>([]);
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const currentUserId = getCurrentUserId();
  const { data: tasks = [], isLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks"],
  });
  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });
  const { uploadFile, isUploading } = useUpload();

  const updateTask = useMutation({
    mutationFn: async ({ id, updates }: { id: number; updates: Partial<Task> }) => {
      const res = await apiRequest("PATCH", `/api/tasks/${id}`, updates);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
    },
  });

  const assignedTasks = useMemo(
    () => tasks.filter((task) => isAssignedToUser(task, currentUserId)),
    [tasks, currentUserId],
  );

  const today = useMemo(() => getStartOfDay(new Date()), []);
  const [openedTaskFromQuery, setOpenedTaskFromQuery] = useState(false);

  const getTaskIdFromLocation = (value: string) => {
    const query = value.split("?")[1];
    if (!query) return null;
    const params = new URLSearchParams(query);
    const id = Number(params.get("taskId"));
    return Number.isFinite(id) && id > 0 ? id : null;
  };

  const filteredTasks = useMemo(() => {
    const sortTasks = (taskList: Task[]) => {
      return taskList.sort((a, b) => {
        if (a.status === 'completed' && b.status !== 'completed') return 1;
        if (a.status !== 'completed' && b.status === 'completed') return -1;
        const dateA = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
        const dateB = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
        return dateA - dateB;
      });
    };

    switch (activeView) {
      case "my-day":
        return sortTasks(assignedTasks.filter((task) => {
          if (task.status === "completed") return false;
          const startDate = task.startDate ? new Date(task.startDate) : null;
          const dueDate = task.dueDate ? new Date(task.dueDate) : null;
          return isDateInRange(today, startDate, dueDate);
        }));

      case "today":
        return sortTasks(assignedTasks.filter((task) => {
          if (!task.createdAt) return false;
          return isSameDay(new Date(task.createdAt), today);
        }));

      case "overdue":
        return sortTasks(assignedTasks.filter((task) => {
          if (!task.dueDate) return false;
          return isBeforeDay(new Date(task.dueDate), today) && task.status !== "completed";
        }));

      case "upcoming":
        return sortTasks(assignedTasks.filter((task) => {
          if (!task.dueDate) return false;
          return isAfterDay(new Date(task.dueDate), today);
        }));

      case "all":
      default:
        return sortTasks(assignedTasks);
    }
  }, [activeView, assignedTasks, today]);

  const counts = useMemo(() => {
    return {
      "my-day": assignedTasks.filter(t => {
        if (t.status === "completed") return false;
        const start = t.startDate ? new Date(t.startDate) : null;
        const end = t.dueDate ? new Date(t.dueDate) : null;
        return isDateInRange(today, start, end);
      }).length,
      "today": assignedTasks.filter(t => t.createdAt && isSameDay(new Date(t.createdAt), today)).length,
      "overdue": assignedTasks.filter(t => t.dueDate && isBeforeDay(new Date(t.dueDate), today) && t.status !== "completed").length,
      "upcoming": assignedTasks.filter(t => t.dueDate && isAfterDay(new Date(t.dueDate), today)).length,
      "all": assignedTasks.length,
    };
  }, [assignedTasks, today]);

  // --- Handlers ---
  const createHistoryEntry = (action: string) => ({
    action,
    userId: currentUserId,
    userName: localStorage.getItem("userName") || "Unknown",
    timestamp: new Date().toISOString(),
  });

  const handleToggleComplete = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    const completed = task.status === "completed";
    const nextStatus = completed ? "todo" : "completed";
    updateTask.mutate({
      id: task.id,
      updates: {
        status: nextStatus,
        history: [...(task.history || []), createHistoryEntry(completed ? "Marked incomplete" : "Completed")],
      },
    });
  };

  const addChecklistItem = (item: string, setItem: any, setList: any) => {
    if (!item.trim()) return;
    setList((prev: any) => [...prev, { id: crypto.randomUUID(), title: item, completed: false }]);
    setItem("");
  };
  const toggleChecklistItem = (id: string, setList: any) => {
    setList((prev: any) => prev.map((i: any) => i.id === id ? { ...i, completed: !i.completed } : i));
  };
  const removeChecklistItem = (id: string, setList: any) => {
    setList((prev: any) => prev.filter((i: any) => i.id !== id));
  };
  const removeAttachment = (id: string, setAtt: any) => setAtt((prev: any) => prev.filter((a: any) => a.id !== id));
  const toggleAssignee = (id: number, current: number[], setIds: any) => {
    setIds(current.includes(id) ? current.filter(i => i !== id) : [...current, id]);
  };
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setAtt: any) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const res = await uploadFile(file);
    if (res) setAtt((prev: any) => [...prev, { id: crypto.randomUUID(), name: res.metadata.name, url: res.objectPath, type: res.metadata.contentType, size: res.metadata.size, uploadedAt: new Date().toISOString() }]);
  };

  const handleOpenTask = (task: Task) => {
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || "");
    setEditTaskPriority(task.priority);
    setEditTaskAssignees(task.assignedUsers || (task.assigneeId ? [task.assigneeId] : []));
    setEditTaskStatus(task.status || "todo");
    setEditTaskStartDate(task.startDate ? new Date(task.startDate).toISOString().split("T")[0] : "");
    setEditTaskEndDate(task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "");
    setEditTaskEstimateHours(task.estimateHours || 0);
    setEditTaskEstimateMinutes(task.estimateMinutes || 0);
    setEditTaskChecklist(task.checklist || []);
    setEditTaskAttachments(task.attachments || []);
    setIsEditTaskOpen(true);
  };

  useEffect(() => {
    if (openedTaskFromQuery) return;
    const taskId = getTaskIdFromLocation(location);
    if (!taskId) return;
    const match = assignedTasks.find((task) => task.id === taskId);
    if (!match) return;
    handleOpenTask(match);
    setOpenedTaskFromQuery(true);
  }, [assignedTasks, getTaskIdFromLocation, handleOpenTask, location, openedTaskFromQuery]);

  const handleSaveEditTask = () => {
    if (!editingTask || !editTaskTitle.trim()) return;
    updateTask.mutate({
      id: editingTask.id,
      updates: {
        title: editTaskTitle,
        description: editTaskDescription,
        priority: editTaskPriority,
        assigneeId: editTaskAssignees[0] || null,
        assignedUsers: editTaskAssignees,
        status: editTaskStatus,
        startDate: editTaskStartDate ? new Date(editTaskStartDate + "T12:00:00") : null,
        dueDate: editTaskEndDate ? new Date(editTaskEndDate + "T12:00:00") : null,
        estimateHours: editTaskEstimateHours,
        estimateMinutes: editTaskEstimateMinutes,
        checklist: editTaskChecklist,
        attachments: editTaskAttachments,
        history: [...(editingTask.history || []), createHistoryEntry("Updated")],
      },
    });
    setIsEditTaskOpen(false);
    setEditingTask(null);
  };

  const activeViewObj = viewOptions.find((v) => v.id === activeView);

  return (
    // Changed height to h-dvh (dynamic viewport height) for mobile browsers
    // Removed rounded corners and borders on mobile for full-screen feel
    <div className="flex h-dvh md:h-[calc(100vh-2rem)] bg-white overflow-hidden md:rounded-2xl md:shadow-sm md:border border-slate-100">

      {/* Mobile Overlay (Backdrop) */}
      {isSidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar - Responsive Drawer */}
      <div className={cn(
        "fixed inset-y-0 left-0 z-40 w-72 bg-white border-r border-slate-100 flex flex-col pt-4 md:pt-8 pb-4 transition-transform duration-300 ease-in-out md:static md:translate-x-0 shadow-xl md:shadow-none",
        isSidebarOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="px-6 mb-6 md:mb-8 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800 tracking-tight flex items-center gap-2">
            <CheckCircle2 className="w-6 h-6 text-primary" />
            Tasks
          </h2>
          {/* Mobile Close Button */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden text-slate-400"
            onClick={() => setIsSidebarOpen(false)}
          >
            <X className="w-5 h-5" />
          </Button>
        </div>

        <nav className="flex-1 px-3 space-y-1">
          {viewOptions.map((view) => {
            const Icon = view.icon;
            const isActive = activeView === view.id;
            return (
              <button
                key={view.id}
                onClick={() => {
                  setActiveView(view.id);
                  setIsSidebarOpen(false); // Close sidebar on mobile selection
                }}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 md:py-2.5 rounded-lg text-sm transition-all duration-200",
                  isActive
                    ? "bg-slate-50 text-slate-900 font-semibold shadow-sm ring-1 ring-slate-200"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                )}
              >
                <div className="flex items-center gap-3">
                  <Icon className={cn("w-5 h-5 md:w-4 md:h-4", isActive ? view.color : "text-slate-400")} />
                  <span className="text-base md:text-sm">{view.label}</span>
                </div>
                {counts[view.id] > 0 && (
                  <span className={cn(
                    "text-xs px-2 py-0.5 rounded-full",
                    isActive ? "bg-white text-slate-700 font-bold shadow-sm" : "bg-slate-100 text-slate-500"
                  )}>
                    {counts[view.id]}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col bg-white relative w-full">

        {/* Mobile Header (Only visible on small screens) */}
        <div className="md:hidden flex items-center px-4 py-3 border-b border-slate-100 bg-white">
          <Button variant="ghost" size="icon" className="-ml-2 mr-2" onClick={() => setIsSidebarOpen(true)}>
            <Menu className="w-6 h-6 text-slate-600" />
          </Button>
          <span className="font-semibold text-lg text-slate-800">{activeViewObj?.label}</span>
        </div>

        {/* Desktop Header (Hidden on Mobile, replaced by simpler one above or integrated below) */}
        <div className="px-4 md:px-8 pt-6 md:pt-10 pb-4 md:pb-6">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-slate-800">
              {activeViewObj?.label}
            </h1>
            <span className="text-slate-400 text-lg md:text-2xl font-light hidden sm:inline-block">
              {activeView === 'my-day' && format(new Date(), "EEEE, MMMM d")}
            </span>
          </div>
          <p className="text-slate-500 text-xs md:text-sm font-medium">
            {isLoading ? "Syncing..." : `${filteredTasks.length} tasks`}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-8 pb-8">
          <div className="space-y-3 max-w-4xl">
            {filteredTasks.length === 0 && !isLoading && (
              <div className="flex flex-col items-center justify-center h-64 text-slate-400">
                <div className="h-16 w-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 opacity-20" />
                </div>
                <p>No tasks found.</p>
              </div>
            )}

            {filteredTasks.map((task) => (
              <div
                key={task.id}
                onClick={() => handleOpenTask(task)}
                className={cn(
                  "group flex items-start gap-3 p-3 md:p-4 rounded-xl transition-all duration-200 cursor-pointer",
                  "bg-slate-50 hover:bg-slate-100",
                  task.status === "completed"
                    ? "opacity-60 bg-white border border-slate-100"
                    : "shadow-sm"
                )}
              >
                <button
                  onClick={(e) => handleToggleComplete(task, e)}
                  className={cn(
                    "mt-0.5 flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all flex items-center justify-center",
                    task.status === "completed"
                      ? "bg-primary border-primary text-white scale-100"
                      : "border-slate-300 bg-transparent active:scale-95 md:group-hover:border-primary/50 md:group-hover:scale-110"
                  )}
                >
                  {task.status === "completed" && <CheckCircle2 className="w-4 h-4" />}
                </button>

                <div className="flex-1 min-w-0 py-0.5">
                  <p className={cn(
                    "text-sm md:text-base font-medium text-slate-800 break-words leading-tight",
                    task.status === "completed" && "line-through text-slate-400"
                  )}>
                    {task.title}
                  </p>

                  {/* Metadata Row - Flex wrap for mobile */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-2">
                    {task.dueDate && (
                      <div className={cn(
                        "flex items-center gap-1 text-xs font-medium",
                        isBeforeDay(new Date(task.dueDate), today) && task.status !== 'completed'
                          ? "text-red-600 bg-red-100/50 px-2 py-0.5 rounded-md"
                          : "text-slate-500"
                      )}>
                        <CalendarIcon className="w-3 h-3" />
                        {format(new Date(task.dueDate), "EEE, MMM d")}
                      </div>
                    )}

                    {activeView === 'today' && (
                      <div className="flex items-center gap-1 text-xs font-medium text-purple-600 bg-purple-100/50 px-2 py-0.5 rounded-md">
                        <FileText className="w-3 h-3" />
                        Created Today
                      </div>
                    )}

                    {task.description && (
                      <span className="hidden sm:inline-block text-xs text-slate-400 truncate max-w-[200px] border-l border-slate-200 pl-3">
                        {task.description}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 max-w-4xl pb-16 md:pb-0">
            <Button
              variant="ghost"
              className="w-full justify-start h-12 md:h-14 text-slate-500 hover:text-primary hover:bg-slate-50 pl-2 gap-3 rounded-xl transition-all"
              onClick={() => {
                setEditingTask(null);
                setEditTaskTitle("");
                setIsEditTaskOpen(true);
              }}
            >
              <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-primary group-hover:bg-white">
                <Plus className="w-5 h-5" />
              </div>
              <span className="text-base font-medium">Add a task</span>
            </Button>
          </div>
        </div>
      </div>

      <TaskDialog
        mode="edit"
        open={isEditTaskOpen}
        onOpenChange={setIsEditTaskOpen}
        status={editTaskStatus}
        setStatus={setEditTaskStatus}
        title={editTaskTitle}
        setTitle={setEditTaskTitle}
        description={editTaskDescription}
        setDescription={setEditTaskDescription}
        priority={editTaskPriority}
        setPriority={setEditTaskPriority}
        assignees={editTaskAssignees}
        setAssignees={setEditTaskAssignees}
        startDate={editTaskStartDate}
        setStartDate={setEditTaskStartDate}
        endDate={editTaskEndDate}
        setEndDate={setEditTaskEndDate}
        estimateHours={editTaskEstimateHours}
        setEstimateHours={setEditTaskEstimateHours}
        estimateMinutes={editTaskEstimateMinutes}
        setEstimateMinutes={setEditTaskEstimateMinutes}
        checklist={editTaskChecklist}
        newChecklistItem={newChecklistItem}
        setNewChecklistItem={setNewChecklistItem}
        attachments={editTaskAttachments}
        users={users}
        toggleAssignee={toggleAssignee}
        onToggleChecklistItem={(id) => toggleChecklistItem(id, setEditTaskChecklist)}
        onRemoveChecklistItem={(id) => removeChecklistItem(id, setEditTaskChecklist)}
        onAddChecklistItem={() => addChecklistItem(newChecklistItem, setNewChecklistItem, setEditTaskChecklist)}
        onRemoveAttachment={(id) => removeAttachment(id, setEditTaskAttachments)}
        onFileUpload={(e) => handleFileUpload(e, setEditTaskAttachments)}
        isUploading={isUploading}
        onSubmit={handleSaveEditTask}
        isSubmitting={updateTask.isPending}
      />
    </div>
  );
}
