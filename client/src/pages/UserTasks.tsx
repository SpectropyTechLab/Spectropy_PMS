import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CheckSquare, Clock, Calendar, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Task, Bucket, Project } from "@shared/schema";

export default function UserTasks() {
  const userId = Number(localStorage.getItem("userId"));
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");

  const { data: myTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { assigneeId: userId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks?assigneeId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: buckets = [] } = useQuery<Bucket[]>({
    queryKey: ["/api/buckets/all"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/buckets");
      return res.json();
    },
  });

  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const updateTaskMutation = useMutation({
    mutationFn: async ({ id, ...data }: Partial<Task> & { id: number }) => {
      return apiRequest("PATCH", `/api/tasks/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tasks", { assigneeId: userId }] });
      toast({
        title: "Task updated",
        description: "Task status has been updated successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update task status.",
        variant: "destructive",
      });
    },
  });

  const filteredTasks = myTasks.filter((task) => {
    const statusMatch = statusFilter === "all" || task.status === statusFilter;
    const priorityMatch = priorityFilter === "all" || task.priority === priorityFilter;
    return statusMatch && priorityMatch;
  });

  const getBucketName = (bucketId: number | null) => {
    if (!bucketId) return "—";
    const bucket = buckets.find((b) => b.id === bucketId);
    return bucket?.title || "—";
  };

  const getProjectName = (projectId: number | null) => {
    if (!projectId) return "—";
    const project = projects.find((p) => p.id === projectId);
    return project?.name || "—";
  };

  const handleStatusChange = (task: Task, newStatus: string) => {
    if (task.status === "completed") {
      toast({
        title: "Cannot modify",
        description: "Completed tasks cannot be modified.",
        variant: "destructive",
      });
      return;
    }

    const historyEntry =
      newStatus === "completed"
        ? `Marked as completed on ${new Date().toLocaleDateString()}`
        : newStatus === "in_progress"
        ? `Started on ${new Date().toLocaleDateString()}`
        : `Moved to ${newStatus} on ${new Date().toLocaleDateString()}`;

    updateTaskMutation.mutate({
      id: task.id,
      status: newStatus,
      history: [...(task.history || []), historyEntry],
    });
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "high":
        return "bg-red-100 text-red-700";
      case "medium":
        return "bg-amber-100 text-amber-700";
      case "low":
        return "bg-emerald-100 text-emerald-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-emerald-100 text-emerald-700";
      case "in_progress":
        return "bg-amber-100 text-amber-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  if (tasksLoading) {
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
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-2xl md:text-3xl font-display font-bold text-slate-900" data-testid="text-page-title">
            My Tasks
          </h1>
          <p className="text-muted-foreground mt-1 text-sm md:text-base">
            View and manage all your assigned tasks
          </p>
        </div>

        <div className="flex items-center gap-2 md:gap-3 flex-wrap w-full md:w-auto">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-full md:w-[150px]" data-testid="select-status-filter">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="todo">Todo</SelectItem>
              <SelectItem value="in_progress">In Progress</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>

          <Select value={priorityFilter} onValueChange={setPriorityFilter}>
            <SelectTrigger className="w-full md:w-[150px]" data-testid="select-priority-filter">
              <SelectValue placeholder="Priority" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Priority</SelectItem>
              <SelectItem value="high">High</SelectItem>
              <SelectItem value="medium">Medium</SelectItem>
              <SelectItem value="low">Low</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
      >
        <Card>
          <CardContent className="p-0">
            {filteredTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <CheckSquare className="h-12 w-12 text-slate-300 mb-4" />
                <h3 className="text-lg font-medium text-slate-600">No tasks found</h3>
                <p className="text-muted-foreground mt-1">
                  {statusFilter !== "all" || priorityFilter !== "all"
                    ? "Try changing the filters to see more tasks"
                    : "You haven't been assigned any tasks yet"}
                </p>
              </div>
            ) : (
              <>
                {/* Mobile Card View */}
                <div className="md:hidden divide-y divide-slate-200">
                  {filteredTasks.map((task) => (
                    <div key={task.id} className="p-4" data-testid={`card-task-${task.id}`}>
                      <div className="flex items-start justify-between gap-2 mb-3">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          {task.status === "completed" && (
                            <CheckSquare className="h-4 w-4 text-emerald-500 flex-shrink-0" />
                          )}
                          <span className={`font-medium truncate ${task.status === "completed" ? "line-through text-muted-foreground" : ""}`}>
                            {task.title}
                          </span>
                        </div>
                        <Badge variant="secondary" className={getPriorityColor(task.priority)}>
                          {task.priority}
                        </Badge>
                      </div>
                      
                      {task.description && (
                        <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                          {task.description}
                        </p>
                      )}
                      
                      <div className="flex flex-wrap gap-2 text-xs text-muted-foreground mb-3">
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{getProjectName(task.projectId)}</span>
                        <span className="bg-slate-100 dark:bg-slate-800 px-2 py-1 rounded">{getBucketName(task.bucketId)}</span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {task.estimateHours || 0}h {task.estimateMinutes || 0}m
                        </span>
                      </div>
                      
                      <div className="flex items-center justify-between gap-2">
                        {task.status === "completed" ? (
                          <Badge variant="secondary" className={getStatusColor(task.status)}>
                            Completed
                          </Badge>
                        ) : (
                          <Select
                            value={task.status}
                            onValueChange={(value) => handleStatusChange(task, value)}
                            disabled={updateTaskMutation.isPending}
                          >
                            <SelectTrigger className="w-[130px] h-8" data-testid={`select-task-status-mobile-${task.id}`}>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="todo">Todo</SelectItem>
                              <SelectItem value="in_progress">In Progress</SelectItem>
                              <SelectItem value="completed">Completed</SelectItem>
                            </SelectContent>
                          </Select>
                        )}
                        
                        {(task.startDate || task.dueDate) && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString() : "—"}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop Table View */}
                <div className="hidden md:block overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="min-w-[200px]">Title</TableHead>
                        <TableHead>Project</TableHead>
                        <TableHead>Bucket</TableHead>
                        <TableHead>Priority</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Estimate</TableHead>
                        <TableHead>Start Date</TableHead>
                        <TableHead>Due Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredTasks.map((task) => (
                        <TableRow key={task.id} data-testid={`row-task-${task.id}`}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {task.status === "completed" && (
                                <CheckSquare className="h-4 w-4 text-emerald-500" />
                              )}
                              <span className={task.status === "completed" ? "line-through text-muted-foreground" : ""}>
                                {task.title}
                              </span>
                            </div>
                            {task.description && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {task.description}
                              </p>
                            )}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {getProjectName(task.projectId)}
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {getBucketName(task.bucketId)}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary" className={getPriorityColor(task.priority)}>
                              {task.priority}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {task.status === "completed" ? (
                              <Badge variant="secondary" className={getStatusColor(task.status)}>
                                Completed
                              </Badge>
                            ) : (
                              <Select
                                value={task.status}
                                onValueChange={(value) => handleStatusChange(task, value)}
                                disabled={updateTaskMutation.isPending}
                              >
                                <SelectTrigger className="w-[130px] h-8" data-testid={`select-task-status-${task.id}`}>
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="todo">Todo</SelectItem>
                                  <SelectItem value="in_progress">In Progress</SelectItem>
                                  <SelectItem value="completed">Completed</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1 text-sm text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              {task.estimateHours || 0}h {task.estimateMinutes || 0}m
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.startDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.startDate).toLocaleDateString()}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {task.dueDate ? (
                              <div className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {new Date(task.dueDate).toLocaleDateString()}
                              </div>
                            ) : (
                              "—"
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4"
      >
        <Card className="bg-slate-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-slate-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{myTasks.filter((t) => t.status === "todo").length}</p>
              <p className="text-sm text-muted-foreground">Todo</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-200 flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{myTasks.filter((t) => t.status === "in_progress").length}</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-emerald-50">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-200 flex items-center justify-center">
              <CheckSquare className="h-5 w-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{myTasks.filter((t) => t.status === "completed").length}</p>
              <p className="text-sm text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
