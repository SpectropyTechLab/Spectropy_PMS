import { useState, type Dispatch, type SetStateAction } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  Plus,
  MoreHorizontal,
  Clock,
  Calendar,
  CheckCircle2,
  Paperclip,
  ListChecks,
  History,
  Trash2,
  Edit,
  Copy,
} from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type {
  Project,
  Bucket,
  Task,
  User,
  ChecklistItem,
  Attachment,
  HistoryEntry,
} from "@shared/schema";
import { motion } from "framer-motion";
import { useUpload } from "@/hooks/use-upload";
import { usePermissions } from "@/hooks/use-permissions";
import { useToast } from "@/hooks/use-toast";
import { NewTaskDialog } from "@/components/project-board/NewTaskDialog";
import { EditTaskDialog } from "@/components/project-board/EditTaskDialog";
import { TaskHistoryDialog } from "@/components/project-board/TaskHistoryDialog";

interface BucketWithTasks extends Bucket {
  tasks: Task[];
}

export default function ProjectBoard() {
  const { id } = useParams<{ id: string }>();
  const [, navigate] = useLocation();
  const projectId = Number(id);
  const { toast } = useToast();
  const {
    canCreateTask,
    canUpdateTask,
    canCompleteTask,
    canDeleteTask,
    isAdmin,
  } = usePermissions();

  const currentUserId = Number(localStorage.getItem("userId")) || null;
  const currentUserName = localStorage.getItem("userName") || "Unknown";

  const createHistoryEntry = (action: string): HistoryEntry => ({
    action,
    userId: currentUserId,
    userName: currentUserName,
    timestamp: new Date().toISOString(),
  });

  const [draggedTask, setDraggedTask] = useState<Task | null>(null);
  const [isNewTaskOpen, setIsNewTaskOpen] = useState(false);
  const [isNewBucketOpen, setIsNewBucketOpen] = useState(false);
  const [isEditTaskOpen, setIsEditTaskOpen] = useState(false);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [historyTask, setHistoryTask] = useState<Task | null>(null);
  const [selectedBucketId, setSelectedBucketId] = useState<number | null>(null);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [newTaskDescription, setNewTaskDescription] = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [newTaskAssignees, setNewTaskAssignees] = useState<number[]>([]);
  const [newTaskStartDate, setNewTaskStartDate] = useState("");
  const [newTaskEndDate, setNewTaskEndDate] = useState("");
  const [newTaskEstimateHours, setNewTaskEstimateHours] = useState(0);
  const [newTaskEstimateMinutes, setNewTaskEstimateMinutes] = useState(0);
  const [newBucketTitle, setNewBucketTitle] = useState("");
  const [editingBucketId, setEditingBucketId] = useState<number | null>(null);
  const [editingBucketTitle, setEditingBucketTitle] = useState("");
  const [editTaskTitle, setEditTaskTitle] = useState("");
  const [editTaskDescription, setEditTaskDescription] = useState("");
  const [editTaskPriority, setEditTaskPriority] = useState("medium");
  const [editTaskAssignees, setEditTaskAssignees] = useState<number[]>([]);
  const [editTaskStatus, setEditTaskStatus] = useState("todo");
  const [editTaskStartDate, setEditTaskStartDate] = useState("");
  const [editTaskEndDate, setEditTaskEndDate] = useState("");
  const [editTaskEstimateHours, setEditTaskEstimateHours] = useState(0);
  const [editTaskEstimateMinutes, setEditTaskEstimateMinutes] = useState(0);
  const [editTaskChecklist, setEditTaskChecklist] = useState<ChecklistItem[]>(
    [],
  );
  const [editTaskAttachments, setEditTaskAttachments] = useState<Attachment[]>(
    [],
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");

  const { uploadFile, isUploading } = useUpload({
    onSuccess: (response) => {
      if (editingTask) {
        const newAttachment: Attachment = {
          id: crypto.randomUUID(),
          name: response.metadata.name,
          url: response.objectPath,
          type: response.metadata.contentType,
          size: response.metadata.size,
          uploadedAt: new Date().toISOString(),
        };
        setEditTaskAttachments([...editTaskAttachments, newAttachment]);
      }
    },
  });

  const { data: project, isLoading: projectLoading } = useQuery<Project>({
    queryKey: ["/api/projects", projectId],
  });

  const { data: buckets = [], isLoading: bucketsLoading } = useQuery<Bucket[]>({
    queryKey: ["/api/buckets", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/buckets?projectId=${projectId}`);
      return res.json();
    },
  });

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: ["/api/tasks", projectId],
    queryFn: async () => {
      const res = await fetch(`/api/tasks?projectId=${projectId}`);
      return res.json();
    },
  });

  const { data: users = [] } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  const createTaskMutation = useMutation({
    mutationFn: async (data: Partial<Task>) => {
      const res = await apiRequest("POST", "/api/tasks", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", projectId] });
      setIsNewTaskOpen(false);
      resetNewTaskForm();
    },
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: number }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", projectId] });
    },
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/tasks/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", projectId] });
    },
  });

  const createBucketMutation = useMutation({
    mutationFn: async (data: Partial<Bucket>) => {
      return apiRequest("POST", "/api/buckets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buckets", projectId] });
      setIsNewBucketOpen(false);
      setNewBucketTitle("");
    },
  });

  const updateBucketMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Bucket> & { id: number }) => {
      return apiRequest("PATCH", `/api/buckets/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buckets", projectId] });
      setEditingBucketId(null);
      setEditingBucketTitle("");
    },
  });

  const deleteBucketMutation = useMutation({
    mutationFn: async (id: number) => {
      return apiRequest("DELETE", `/api/buckets/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/buckets", projectId] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", projectId] });
      toast({
        title: "Bucket deleted",
        description: "The bucket and all its tasks have been removed",
      });
    },
  });

  const resetNewTaskForm = () => {
    setNewTaskTitle("");
    setNewTaskDescription("");
    setNewTaskPriority("medium");
    setNewTaskAssignees([]);
    setNewTaskStartDate("");
    setNewTaskEndDate("");
    setNewTaskEstimateHours(0);
    setNewTaskEstimateMinutes(0);
  };

  const handleSaveBucketTitle = (bucketId: number) => {
    if (!editingBucketTitle.trim()) {
      setEditingBucketId(null);
      return;
    }
    updateBucketMutation.mutate({ id: bucketId, title: editingBucketTitle });
  };

  const handleDeleteBucket = (bucket: BucketWithTasks) => {
    if (!canDeleteTask) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to delete buckets",
        variant: "destructive",
      });
      return;
    }
    const taskCount = bucket.tasks.length;
    const message = taskCount > 0
      ? `Are you sure you want to delete "${bucket.title}" and its ${taskCount} task${taskCount > 1 ? 's' : ''}?`
      : `Are you sure you want to delete "${bucket.title}"?`;

    if (confirm(message)) {
      deleteBucketMutation.mutate(bucket.id);
    }
  };

  const bucketsWithTasks: BucketWithTasks[] = buckets.map((bucket) => ({
    ...bucket,
    tasks: tasks
      .filter((task) => task.bucketId === bucket.id)
      .sort((a, b) => a.position - b.position),
  }));

  const handleDragStart = (task: Task) => {
    setDraggedTask(task);
  };

  const handleDragEnd = () => {
    setDraggedTask(null);
  };

  const handleDrop = (bucketId: number, targetPosition: number) => {
    if (!draggedTask) return;

    updateTaskMutation.mutate({
      id: draggedTask.id,
      bucketId,
      position: targetPosition,
      history: [
        ...(draggedTask.history || []),
        createHistoryEntry(
          `Moved to ${buckets.find((b) => b.id === bucketId)?.title}`,
        ),
      ],
    });
    setDraggedTask(null);
  };

  const handleAddTask = () => {
    if (!newTaskTitle.trim() || !selectedBucketId) return;

    const bucketTasks = tasks.filter((t) => t.bucketId === selectedBucketId);
    const maxPosition = Math.max(...bucketTasks.map((t) => t.position), -1);

    createTaskMutation.mutate({
      title: newTaskTitle,
      description: newTaskDescription,
      priority: newTaskPriority,
      projectId,
      bucketId: selectedBucketId,
      assigneeId: newTaskAssignees[0] || undefined,
      assignedUsers: newTaskAssignees,
      position: maxPosition + 1,
      status: "todo",
      startDate: newTaskStartDate
        ? new Date(newTaskStartDate + "T12:00:00")
        : null,
      dueDate: newTaskEndDate ? new Date(newTaskEndDate + "T12:00:00") : null,
      estimateHours: newTaskEstimateHours,
      estimateMinutes: newTaskEstimateMinutes,
      history: [createHistoryEntry("Created")],
      checklist: [],
      attachments: [],
    });
  };

  const handleAddBucket = () => {
    if (!newBucketTitle.trim()) return;

    const maxPosition = Math.max(...buckets.map((b) => b.position), -1);
    createBucketMutation.mutate({
      title: newBucketTitle,
      projectId,
      position: maxPosition + 1,
    });
  };

  const handleOpenEditTask = (task: Task) => {
    if (!canUpdateTask && !canCompleteTask) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to edit tasks",
        variant: "destructive",
      });
      return;
    }
    setEditingTask(task);
    setEditTaskTitle(task.title);
    setEditTaskDescription(task.description || "");
    setEditTaskPriority(task.priority);
    setEditTaskAssignees(
      task.assignedUsers || (task.assigneeId ? [task.assigneeId] : []),
    );
    setEditTaskStatus(task.status || "todo");
    setEditTaskStartDate(
      task.startDate
        ? new Date(task.startDate).toISOString().split("T")[0]
        : "",
    );
    setEditTaskEndDate(
      task.dueDate ? new Date(task.dueDate).toISOString().split("T")[0] : "",
    );
    setEditTaskEstimateHours(task.estimateHours || 0);
    setEditTaskEstimateMinutes(task.estimateMinutes || 0);
    setEditTaskChecklist(task.checklist || []);
    setEditTaskAttachments(task.attachments || []);
    setIsEditTaskOpen(true);
  };

  const handleSaveEditTask = () => {
    if (!editingTask || !editTaskTitle.trim()) return;

    updateTaskMutation.mutate({
      id: editingTask.id,
      title: editTaskTitle,
      description: editTaskDescription,
      priority: editTaskPriority,
      assigneeId: editTaskAssignees[0] || null,
      assignedUsers: editTaskAssignees,
      status: editTaskStatus,
      startDate: editTaskStartDate
        ? new Date(editTaskStartDate + "T12:00:00")
        : null,
      dueDate: editTaskEndDate ? new Date(editTaskEndDate + "T12:00:00") : null,
      estimateHours: editTaskEstimateHours,
      estimateMinutes: editTaskEstimateMinutes,
      checklist: editTaskChecklist,
      attachments: editTaskAttachments,
      history: [...(editingTask.history || []), createHistoryEntry("Updated")],
    });
    setIsEditTaskOpen(false);
    setEditingTask(null);
  };

  const handleDeleteTask = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canDeleteTask) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to delete tasks",
        variant: "destructive",
      });
      return;
    }
    if (confirm("Are you sure you want to delete this task?")) {
      deleteTaskMutation.mutate(task.id);
    }
  };

  const handleViewHistory = (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    setHistoryTask(task);
    setIsHistoryOpen(true);
  };

  const handleCloneTask = async (task: Task, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!canCreateTask) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to create tasks",
        variant: "destructive",
      });
      return;
    }

    const bucketTasks = tasks.filter((t) => t.bucketId === task.bucketId);
    const maxPosition = Math.max(...bucketTasks.map((t) => t.position), -1);

    try {
      const newTask = await createTaskMutation.mutateAsync({
        title: `${task.title} (Copy)`,
        description: task.description,
        priority: task.priority,
        projectId: task.projectId,
        bucketId: task.bucketId,
        assigneeId: task.assigneeId,
        assignedUsers: task.assignedUsers || [],
        position: maxPosition + 1,
        status: "todo",
        startDate: task.startDate,
        dueDate: task.dueDate,
        estimateHours: task.estimateHours || 0,
        estimateMinutes: task.estimateMinutes || 0,
        history: [createHistoryEntry(`Cloned from "${task.title}"`)],
        checklist: task.checklist?.map((item) => ({
          ...item,
          id: crypto.randomUUID(),
          completed: false,
        })) || [],
        attachments: [],
      });

      toast({
        title: "Task cloned",
        description: `"${task.title}" has been duplicated - edit panel opened`,
      });

      handleOpenEditTask(newTask);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to clone task",
        variant: "destructive",
      });
    }
  };

  const handleToggleChecklistItemOnCard = (task: Task, itemId: string) => {
    if (!canUpdateTask && !canCompleteTask) {
      return;
    }

    const updatedChecklist = task.checklist?.map((item) =>
      item.id === itemId ? { ...item, completed: !item.completed } : item
    ) || [];

    updateTaskMutation.mutate({
      id: task.id,
      checklist: updatedChecklist,
    });
  };

  const isAssignedToTask = (task: Task): boolean => {
    if (!currentUserId) return false;
    return (
      task.assigneeId === currentUserId ||
      Boolean(task.assignedUsers && task.assignedUsers.includes(currentUserId))
    );
  };

  const handleStatusChange = async (task: Task, newStatus: string) => {
    const isCompletion = newStatus === "completed";
    const canComplete = canCompleteTask || isAssignedToTask(task);

    if (isCompletion && !canComplete) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to mark tasks as complete",
        variant: "destructive",
      });
      return;
    }

    if (!canUpdateTask && !canComplete) {
      toast({
        title: "Permission denied",
        description: "You do not have permission to update task status",
        variant: "destructive",
      });
      return;
    }

    const statusLabel =
      newStatus === "todo"
        ? "Not Started"
        : newStatus === "in_progress"
          ? "In Progress"
          : "Completed";

    updateTaskMutation.mutate({
      id: task.id,
      status: newStatus,
      history: [
        ...(task.history || []),
        createHistoryEntry(`Status changed to ${statusLabel}`),
      ],
    });

    if (newStatus === "completed" && buckets) {
      const currentBucketIndex = buckets.findIndex(
        (b) => b.id === task.bucketId,
      );
      const nextBucket = buckets[currentBucketIndex + 1];

      if (nextBucket) {
        const newTaskData = {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          projectId: task.projectId,
          bucketId: nextBucket.id,
          assigneeId: task.assigneeId,
          assignedUsers: task.assignedUsers || [],
          startDate: task.startDate,
          dueDate: task.dueDate,
          estimateHours: task.estimateHours || 0,
          estimateMinutes: task.estimateMinutes || 0,
          checklist: [],
          attachments: [],
          history: [
            createHistoryEntry(
              `Auto-created from completed task in ${buckets[currentBucketIndex]?.title || "previous bucket"}`,
            ),
          ],
        };

        createTaskMutation.mutate(newTaskData);
      }
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "todo":
        return "Not Started";
      case "in_progress":
        return "In Progress";
      case "completed":
        return "Completed";
      default:
        return "Not Started";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "todo":
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
      case "in_progress":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400";
      case "completed":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300";
    }
  };

  const handleToggleTaskComplete = async (
    task: Task,
    completed: boolean,
    e: React.MouseEvent,
  ) => {
    e.stopPropagation();

    const canComplete = canCompleteTask || isAssignedToTask(task);
    if (!canComplete) {
      toast({
        title: "Permission denied",
        description:
          "You do not have permission to mark tasks as complete/incomplete",
        variant: "destructive",
      });
      return;
    }

    updateTaskMutation.mutate({
      id: task.id,
      status: completed ? "completed" : "todo",
      history: [
        ...(task.history || []),
        createHistoryEntry(
          completed ? "Marked as completed" : "Marked as incomplete",
        ),
      ],
    });

    if (completed && buckets) {
      const currentBucketIndex = buckets.findIndex(
        (b) => b.id === task.bucketId,
      );
      const nextBucket = buckets[currentBucketIndex + 1];

      if (nextBucket) {
        const newTaskData = {
          title: task.title,
          description: task.description || "",
          priority: task.priority,
          projectId: task.projectId,
          bucketId: nextBucket.id,
          assigneeId: task.assigneeId,
          assignedUsers: task.assignedUsers || [],
          startDate: task.startDate,
          dueDate: task.dueDate,
          estimateHours: task.estimateHours || 0,
          estimateMinutes: task.estimateMinutes || 0,
          checklist: [],
          attachments: [],
          history: [
            createHistoryEntry(
              `Auto-created from completed task in ${buckets[currentBucketIndex]?.title || "previous bucket"}`,
            ),
          ],
        };

        createTaskMutation.mutate(newTaskData);
      }
    }
  };

  const handleAddChecklistItem = () => {
    if (!newChecklistItem.trim()) return;
    const item: ChecklistItem = {
      id: crypto.randomUUID(),
      title: newChecklistItem,
      completed: false,
    };
    setEditTaskChecklist([...editTaskChecklist, item]);
    setNewChecklistItem("");
  };

  const handleToggleChecklistItem = (itemId: string) => {
    setEditTaskChecklist(
      editTaskChecklist.map((item) =>
        item.id === itemId ? { ...item, completed: !item.completed } : item,
      ),
    );
  };

  const handleRemoveChecklistItem = (itemId: string) => {
    setEditTaskChecklist(
      editTaskChecklist.filter((item) => item.id !== itemId),
    );
  };

  const handleRemoveAttachment = (attachmentId: string) => {
    setEditTaskAttachments(
      editTaskAttachments.filter((att) => att.id !== attachmentId),
    );
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      alert("File size exceeds 10MB limit");
      return;
    }

    await uploadFile(file);
    e.target.value = "";
  };

  const toggleAssignee = (
    userId: number,
    assignees: number[],
    setAssignees: Dispatch<SetStateAction<number[]>>,
  ) => {
    if (assignees.includes(userId)) {
      setAssignees(assignees.filter((id) => id !== userId));
    } else {
      setAssignees([...assignees, userId]);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
      case "medium":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400";
      case "low":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const getAssignees = (task: Task) => {
    const assigneeIds = task.assignedUsers?.length
      ? task.assignedUsers
      : task.assigneeId
        ? [task.assigneeId]
        : [];
    return users.filter((u) => assigneeIds.includes(u.id));
  };

  const getChecklistProgress = (checklist: ChecklistItem[] | null) => {
    if (!checklist || checklist.length === 0) return null;
    const completed = checklist.filter((item) => item.completed).length;
    return {
      completed,
      total: checklist.length,
      percentage: Math.round((completed / checklist.length) * 100),
    };
  };

  if (projectLoading || bucketsLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Project not found</p>
        <Button
          variant="outline"
          onClick={() => navigate("/projects")}
          className="mt-4"
        >
          Back to Projects
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 md:p-4 border-b bg-white dark:bg-slate-900">
        <div className="flex items-center gap-2 md:gap-3 min-w-0">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/projects")}
            data-testid="button-back-to-projects"
            className="flex-shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="min-w-0">
            <h1
              className="text-lg md:text-xl font-semibold truncate"
              data-testid="text-project-name"
            >
              {project.name}
            </h1>
            <p className="text-xs md:text-sm text-muted-foreground truncate">
              {project.description || "No description"}
            </p>
          </div>
        </div>

        <Dialog open={isNewBucketOpen} onOpenChange={setIsNewBucketOpen}>
          <DialogTrigger asChild>
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              data-testid="button-add-bucket"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Bucket
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Bucket</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <Input
                placeholder="Bucket title..."
                value={newBucketTitle}
                onChange={(e) => setNewBucketTitle(e.target.value)}
                data-testid="input-bucket-title"
              />
            </div>
            <DialogFooter>
              <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button
                onClick={handleAddBucket}
                disabled={createBucketMutation.isPending}
                data-testid="button-submit-bucket"
              >
                Add Bucket
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 overflow-x-auto p-2 md:p-4 ">
        <div
          className="flex gap-3 md:gap-4 h-full pb-4"
          style={{ minWidth: "max-content" }}
        >
          {bucketsWithTasks.map((bucket) => (
            <motion.div
              key={bucket.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex flex-col w-72 md:w-80 bg-slate-50 dark:bg-slate-800/50 rounded-lg flex-shrink-0"
              data-testid={`bucket-column-${bucket.id}`}
            >
              <div className="flex items-center justify-between gap-2 p-3 border-b border-slate-200 dark:border-slate-700">
                <div className="flex items-center gap-2">
                  {editingBucketId === bucket.id ? (
                    <Input
                      value={editingBucketTitle}
                      onChange={(e) => setEditingBucketTitle(e.target.value)}
                      onBlur={() => handleSaveBucketTitle(bucket.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveBucketTitle(bucket.id);
                        else if (e.key === "Escape") {
                          setEditingBucketId(null);
                          setEditingBucketTitle("");
                        }
                      }}
                      autoFocus
                      className="h-7 w-40 text-sm font-medium"
                      data-testid={`input-edit-bucket-title-${bucket.id}`}
                    />
                  ) : (
                    <h3
                      className="font-medium cursor-pointer hover:text-primary transition-colors"
                      onClick={() => {
                        setEditingBucketId(bucket.id);
                        setEditingBucketTitle(bucket.title);
                      }}
                      data-testid={`text-bucket-title-${bucket.id}`}
                    >
                      {bucket.title}
                    </h3>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    {bucket.tasks.length}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => {
                      if (!canCreateTask) {
                        toast({
                          title: "Permission denied",
                          description:
                            "You do not have permission to create tasks",
                          variant: "destructive",
                        });
                        return;
                      }
                      setSelectedBucketId(bucket.id);
                      setIsNewTaskOpen(true);
                    }}
                    disabled={!canCreateTask}
                    data-testid={`button-add-task-${bucket.id}`}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        data-testid={`button-bucket-menu-${bucket.id}`}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        onClick={() => {
                          setEditingBucketId(bucket.id);
                          setEditingBucketTitle(bucket.title);
                        }}
                      >
                        <Edit className="h-4 w-4 mr-2" />
                        Rename Bucket
                      </DropdownMenuItem>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDeleteBucket(bucket)}
                        data-testid={`button-delete-bucket-${bucket.id}`}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Bucket
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>

              <div
                className="flex-1 p-2 space-y-2 overflow-y-auto min-h-[200px]"
                onDragOver={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.add(
                    "bg-slate-100",
                    "dark:bg-slate-700/50",
                  );
                }}
                onDragLeave={(e) => {
                  e.currentTarget.classList.remove(
                    "bg-slate-100",
                    "dark:bg-slate-700/50",
                  );
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove(
                    "bg-slate-100",
                    "dark:bg-slate-700/50",
                  );
                  handleDrop(bucket.id, bucket.tasks.length);
                }}
              >
                {bucket.tasks.map((task) => {
                  const assignees = getAssignees(task);
                  const checklistProgress = getChecklistProgress(
                    task.checklist,
                  );
                  const attachmentCount = task.attachments?.length || 0;

                  return (
                    <motion.div
                      key={task.id}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      draggable
                      onDragStart={() => handleDragStart(task)}
                      onDragEnd={handleDragEnd}
                      className={`cursor-grab active:cursor-grabbing ${draggedTask?.id === task.id ? "opacity-50" : ""
                        }`}
                      data-testid={`task-card-${task.id}`}
                    >
                      <Card
                        className={`p-3 bg-white dark:bg-slate-800 shadow-sm hover-elevate ${task.status === "completed" ? "opacity-60" : ""
                          }`}
                      >
                        <div className="flex items-start gap-2">
                          <Checkbox
                            checked={task.status === "completed"}
                            onCheckedChange={(checked) => {
                              handleStatusChange(
                                task,
                                checked ? "completed" : "todo",
                              );
                            }}
                            onClick={(e) => e.stopPropagation()}
                            className="mt-1 flex-shrink-0"
                            data-testid={`checkbox-task-${task.id}`}
                          />
                          <div
                            className="flex-1 min-w-0"
                            onClick={() => handleOpenEditTask(task)}
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p
                                className={`font-medium text-sm truncate ${task.status === "completed"
                                  ? "line-through text-muted-foreground"
                                  : ""
                                  }`}
                                data-testid={`text-task-title-${task.id}`}
                              >
                                {task.title}
                              </p>
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 flex-shrink-0"
                                  >
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenEditTask(task);
                                    }}
                                  >
                                    <Edit className="h-4 w-4 mr-2" />
                                    Edit Task
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => handleViewHistory(task, e)}
                                  >
                                    <History className="h-4 w-4 mr-2" />
                                    View History
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => handleCloneTask(task, e)}
                                    data-testid={`button-clone-task-${task.id}`}
                                  >
                                    <Copy className="h-4 w-4 mr-2" />
                                    Clone Task
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={(e) => handleDeleteTask(task, e)}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" />
                                    Delete Task
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>

                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                {task.description}
                              </p>
                            )}

                            <div className="flex items-center gap-2 mt-2 flex-wrap">
                              <DropdownMenu>
                                <DropdownMenuTrigger
                                  asChild
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <Button
                                    variant="secondary"
                                    className={`text-xs h-6 px-2 rounded-md border-0 ${getStatusColor(task.status)} no-default-hover-elevate no-default-active-elevate hover:brightness-95 transition-all`}
                                    data-testid={`badge-status-${task.id}`}
                                  >
                                    {task.status === "completed" && (
                                      <CheckCircle2 className="h-3 w-3 mr-1" />
                                    )}
                                    {task.status === "in_progress" && (
                                      <Clock className="h-3 w-3 mr-1" />
                                    )}
                                    {getStatusLabel(task.status)}
                                    <ChevronDown className="h-3 w-3 ml-1" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="start">
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task, "todo");
                                    }}
                                    className={
                                      task.status === "todo" ? "bg-accent" : ""
                                    }
                                  >
                                    Not Started
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task, "in_progress");
                                    }}
                                    className={
                                      task.status === "in_progress"
                                        ? "bg-accent"
                                        : ""
                                    }
                                  >
                                    In Progress
                                  </DropdownMenuItem>
                                  <DropdownMenuItem
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleStatusChange(task, "completed");
                                    }}
                                    className={
                                      task.status === "completed"
                                        ? "bg-accent"
                                        : ""
                                    }
                                  >
                                    Completed
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                              <Badge
                                variant="secondary"
                                className={`text-xs ${getPriorityColor(task.priority)}`}
                              >
                                {task.priority}
                              </Badge>
                              {(task.estimateHours || task.estimateMinutes) && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Clock className="h-3 w-3" />
                                  {task.estimateHours}h {task.estimateMinutes}m
                                </span>
                              )}
                              {attachmentCount > 0 && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Paperclip className="h-3 w-3" />
                                  {attachmentCount}
                                </span>
                              )}
                              {checklistProgress && (
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <ListChecks className="h-3 w-3" />
                                  {checklistProgress.completed}/
                                  {checklistProgress.total}
                                </span>
                              )}
                            </div>

                            {checklistProgress && (
                              <Progress
                                value={checklistProgress.percentage}
                                className="h-1 mt-2"
                              />
                            )}

                            {task.checklist && task.checklist.length > 0 && (
                              <div
                                className="mt-2 space-y-1"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {task.checklist.slice(0, 3).map((item) => (
                                  <div
                                    key={item.id}
                                    className="flex items-center gap-2"
                                    data-testid={`checklist-item-card-${item.id}`}
                                  >
                                    <Checkbox
                                      checked={item.completed}
                                      onCheckedChange={() =>
                                        handleToggleChecklistItemOnCard(task, item.id)
                                      }
                                      className="h-3.5 w-3.5"
                                      data-testid={`checkbox-checklist-${item.id}`}
                                    />
                                    <span
                                      className={`text-xs truncate ${item.completed
                                        ? "line-through text-muted-foreground"
                                        : ""
                                        }`}
                                    >
                                      {item.title}
                                    </span>
                                  </div>
                                ))}
                                {task.checklist.length > 3 && (
                                  <span className="text-xs text-muted-foreground">
                                    +{task.checklist.length - 3} more items
                                  </span>
                                )}
                              </div>
                            )}

                            {(task.startDate || task.dueDate) && (
                              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-2">
                                <Calendar className="h-3 w-3" />
                                {task.startDate &&
                                  new Date(task.startDate).toLocaleDateString()}
                                {task.startDate && task.dueDate && " - "}
                                {task.dueDate &&
                                  new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            )}

                            {assignees.length > 0 && (
                              <div className="flex items-center gap-1 mt-2">
                                <div className="flex -space-x-2">
                                  {assignees.slice(0, 3).map((assignee) => (
                                    <Avatar
                                      key={assignee.id}
                                      className="h-5 w-5 border-2 border-white dark:border-slate-800"
                                    >
                                      <AvatarImage
                                        src={assignee.avatar || undefined}
                                      />
                                      <AvatarFallback className="text-xs">
                                        {assignee.name.charAt(0)}
                                      </AvatarFallback>
                                    </Avatar>
                                  ))}
                                  {assignees.length > 3 && (
                                    <div className="h-5 w-5 rounded-full bg-muted flex items-center justify-center text-xs border-2 border-white dark:border-slate-800">
                                      +{assignees.length - 3}
                                    </div>
                                  )}
                                </div>
                                <span className="text-xs text-muted-foreground ml-1">
                                  {assignees.length === 1
                                    ? assignees[0].name
                                    : `${assignees.length} assignees`}
                                </span>
                              </div>
                            )}
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>
            </motion.div>
          ))}

          <div
            className="flex items-center justify-center w-80 min-h-[200px] border-2 border-dashed border-slate-300 dark:border-slate-600 rounded-lg hover-elevate cursor-pointer"
            onClick={() => setIsNewBucketOpen(true)}
            data-testid="button-add-new-bucket"
          >
            <div className="text-center text-muted-foreground">
              <Plus className="h-8 w-8 mx-auto mb-2" />
              <p>Add Bucket</p>
            </div>
          </div>
        </div>
      </div>

      <NewTaskDialog
        open={isNewTaskOpen}
        onOpenChange={setIsNewTaskOpen}
        newTaskTitle={newTaskTitle}
        setNewTaskTitle={setNewTaskTitle}
        newTaskDescription={newTaskDescription}
        setNewTaskDescription={setNewTaskDescription}
        newTaskPriority={newTaskPriority}
        setNewTaskPriority={setNewTaskPriority}
        newTaskAssignees={newTaskAssignees}
        setNewTaskAssignees={setNewTaskAssignees}
        newTaskStartDate={newTaskStartDate}
        setNewTaskStartDate={setNewTaskStartDate}
        newTaskEndDate={newTaskEndDate}
        setNewTaskEndDate={setNewTaskEndDate}
        newTaskEstimateHours={newTaskEstimateHours}
        setNewTaskEstimateHours={setNewTaskEstimateHours}
        newTaskEstimateMinutes={newTaskEstimateMinutes}
        setNewTaskEstimateMinutes={setNewTaskEstimateMinutes}
        users={users}
        toggleAssignee={toggleAssignee}
        onSubmit={handleAddTask}
        isSubmitting={createTaskMutation.isPending}
      />

      <EditTaskDialog
        open={isEditTaskOpen}
        onOpenChange={setIsEditTaskOpen}
        editTaskStatus={editTaskStatus}
        setEditTaskStatus={setEditTaskStatus}
        editTaskTitle={editTaskTitle}
        setEditTaskTitle={setEditTaskTitle}
        editTaskDescription={editTaskDescription}
        setEditTaskDescription={setEditTaskDescription}
        editTaskPriority={editTaskPriority}
        setEditTaskPriority={setEditTaskPriority}
        editTaskAssignees={editTaskAssignees}
        setEditTaskAssignees={setEditTaskAssignees}
        editTaskStartDate={editTaskStartDate}
        setEditTaskStartDate={setEditTaskStartDate}
        editTaskEndDate={editTaskEndDate}
        setEditTaskEndDate={setEditTaskEndDate}
        editTaskEstimateHours={editTaskEstimateHours}
        setEditTaskEstimateHours={setEditTaskEstimateHours}
        editTaskEstimateMinutes={editTaskEstimateMinutes}
        setEditTaskEstimateMinutes={setEditTaskEstimateMinutes}
        editTaskChecklist={editTaskChecklist}
        newChecklistItem={newChecklistItem}
        setNewChecklistItem={setNewChecklistItem}
        editTaskAttachments={editTaskAttachments}
        users={users}
        toggleAssignee={toggleAssignee}
        onToggleChecklistItem={handleToggleChecklistItem}
        onRemoveChecklistItem={handleRemoveChecklistItem}
        onAddChecklistItem={handleAddChecklistItem}
        onRemoveAttachment={handleRemoveAttachment}
        onFileUpload={handleFileUpload}
        isUploading={isUploading}
        onSave={handleSaveEditTask}
        isSaving={updateTaskMutation.isPending}
      />

      <TaskHistoryDialog
        open={isHistoryOpen}
        onOpenChange={setIsHistoryOpen}
        historyTask={historyTask}
      />
    </div>
  );
}
