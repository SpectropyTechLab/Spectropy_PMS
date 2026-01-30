import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ScrollText,
  Plus,
  Trash2,
  FolderKanban,
  CheckSquare,
  User,
  Loader2,
  Clock,
  RotateCcw,
} from "lucide-react";
import { motion } from "framer-motion";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { ActivityLog, Project, Bucket } from "@shared/schema";

export default function Logs() {
  const { toast } = useToast();
  const { data: logs = [], isLoading } = useQuery<ActivityLog[]>({
    queryKey: ["/api/logs"],
    refetchInterval: 5000,
  });
  const { data: projects = [] } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const { data: buckets = [] } = useQuery<Bucket[]>({
    queryKey: ["/api/buckets"],
    queryFn: async () => {
      const res = await fetch("/api/buckets");
      return res.json();
    },
  });
  const [actionFilter, setActionFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const actionOptions = useMemo(() => {
    return Array.from(new Set(logs.map((log) => log.action))).sort();
  }, [logs]);

  const userOptions = useMemo(() => {
    return Array.from(
      new Set(logs.map((log) => log.performedByName || "System")),
    ).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (actionFilter !== "all" && log.action !== actionFilter) return false;
      const performer = log.performedByName || "System";
      if (userFilter !== "all" && performer !== userFilter) return false;
      if (startDate) {
        if (!log.createdAt) return false;
        const start = new Date(`${startDate}T00:00:00`);
        if (new Date(log.createdAt) < start) return false;
      }
      if (endDate) {
        if (!log.createdAt) return false;
        const end = new Date(`${endDate}T23:59:59`);
        if (new Date(log.createdAt) > end) return false;
      }
      return true;
    });
  }, [logs, actionFilter, userFilter, startDate, endDate]);

  const projectNameById = useMemo(() => {
    const map = new Map<number, string>();
    projects.forEach((project) => {
      map.set(project.id, project.name);
    });
    return map;
  }, [projects]);

  const bucketNameById = useMemo(() => {
    const map = new Map<number, string>();
    buckets.forEach((bucket) => {
      map.set(bucket.id, bucket.title);
    });
    return map;
  }, [buckets]);

  const restoreMutation = useMutation({
    mutationFn: async (payload: { entityType: "project" | "task"; deletedId: number }) => {
      const endpoint =
        payload.entityType === "project"
          ? `/api/deleted/projects/${payload.deletedId}/restore`
          : `/api/deleted/tasks/${payload.deletedId}/restore`;
      const res = await apiRequest("POST", endpoint);
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/logs"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/tasks"] });
      queryClient.invalidateQueries({ queryKey: ["/api/buckets"] });
      toast({
        title: "Restored",
        description:
          variables.entityType === "project"
            ? "Project restored successfully."
            : "Task restored successfully.",
      });
    },
    onError: (error: Error) => {
      let message = error.message || "Unable to restore item.";
      const jsonStart = message.indexOf("{");
      if (jsonStart >= 0) {
        try {
          const parsed = JSON.parse(message.slice(jsonStart));
          if (parsed?.message) {
            message = parsed.message;
          }
        } catch {
          // keep original message
        }
      }
      toast({
        title: "Restore failed",
        description: message,
        variant: "destructive",
      });
    },
  });

  const getActionIcon = (action: string) => {
    switch (action) {
      case "created":
        return <Plus className="h-4 w-4 text-emerald-500" />;
      case "deleted":
        return <Trash2 className="h-4 w-4 text-red-500" />;
      case "restored":
        return <RotateCcw className="h-4 w-4 text-sky-500" />;
      default:
        return <Clock className="h-4 w-4 text-slate-400" />;
    }
  };

  const getEntityIcon = (entityType: string) => {
    switch (entityType) {
      case "project":
        return <FolderKanban className="h-4 w-4 text-primary" />;
      case "task":
        return <CheckSquare className="h-4 w-4 text-accent" />;
      case "user":
        return <User className="h-4 w-4 text-slate-500" />;
      default:
        return <ScrollText className="h-4 w-4 text-slate-400" />;
    }
  };

  const getActionBadgeVariant = (action: string) => {
    switch (action) {
      case "created":
        return "default";
      case "deleted":
        return "destructive";
      case "restored":
        return "outline";
      case "updated":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-700">
      <div className="space-y-1">
        <h2
          className="text-3xl font-display font-bold text-slate-900 tracking-tight flex items-center gap-3"
          data-testid="text-logs-title"
        >
          <ScrollText className="w-8 h-8 text-primary" />
          Activity Logs
        </h2>
        <p className="text-slate-500">
          Track all project and task activities, including delete and restore
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <Card>
          <CardHeader className="flex flex-col gap-4 pb-4">
            <div className="flex flex-row items-center justify-between gap-2">
              <CardTitle className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-primary" />
                Recent Activity
              </CardTitle>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/logs"] })}
                  className="h-8"
                >
                  Refresh
                </Button>
                <Badge variant="outline" className="font-normal">
                  {filteredLogs.length} entries
                </Badge>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Action</span>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All actions" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All actions</SelectItem>
                    {actionOptions.map((action) => (
                      <SelectItem key={action} value={action}>
                        {action}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">User</span>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All users" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All users</SelectItem>
                    {userOptions.map((user) => (
                      <SelectItem key={user} value={user}>
                        {user}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">Start date</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">End date</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9"
                />
              </div>
            </div>
            <div className="flex justify-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionFilter("all");
                  setUserFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="h-8"
              >
                Clear filters
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {filteredLogs.length === 0 ? (
              <div className="text-center py-12 text-slate-500">
                <ScrollText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                <p>No activity logs yet</p>
              </div>
            ) : (
              <ScrollArea className="h-[600px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[180px]">Date & Time</TableHead>
                      <TableHead className="w-[120px]">Action</TableHead>
                      <TableHead className="w-[120px]">Entity Type</TableHead>
                      <TableHead>Entity Name</TableHead>
                      <TableHead className="w-[180px]">Project</TableHead>
                      <TableHead className="w-[160px]">Bucket</TableHead>
                      <TableHead className="w-[150px]">Performed By</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredLogs.map((log) => {
                      const payload = log.payload as
                        | {
                            deletedProjectId?: number;
                            deletedTaskId?: number;
                            projectId?: number | null;
                            bucketId?: number | null;
                            projectName?: string | null;
                            bucketName?: string | null;
                          }
                        | null;
                      const deletedProjectId = payload?.deletedProjectId;
                      const deletedTaskId = payload?.deletedTaskId;
                      const canRestore =
                        log.action === "deleted" &&
                        ((log.entityType === "project" && typeof deletedProjectId === "number") ||
                          (log.entityType === "task" && typeof deletedTaskId === "number"));

                      const projectName =
                        log.entityType === "task"
                          ? payload?.projectName ||
                            (payload?.projectId
                              ? projectNameById.get(payload.projectId) || "-"
                              : "-")
                          : "-";
                      const bucketName =
                        log.entityType === "task"
                          ? payload?.bucketName ||
                            (payload?.bucketId
                              ? bucketNameById.get(payload.bucketId) || "-"
                              : "-")
                          : "-";

                      return (
                      <TableRow key={log.id} data-testid={`row-log-${log.id}`}>
                        <TableCell className="text-slate-500 text-sm">
                          {log.createdAt
                            ? format(new Date(log.createdAt), "MMM d, yyyy h:mm:ss a")
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getActionIcon(log.action)}
                            <Badge variant={getActionBadgeVariant(log.action)} className="capitalize">
                              {log.action}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getEntityIcon(log.entityType)}
                            <span className="capitalize text-slate-700">
                              {log.entityType}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium text-slate-900">
                          {log.entityName || "-"}
                        </TableCell>
                        <TableCell className="text-slate-700">{projectName}</TableCell>
                        <TableCell className="text-slate-700">{bucketName}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <User className="h-4 w-4 text-slate-400" />
                            <span className="text-slate-600">
                              {log.performedByName || "System"}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell>
                          {canRestore ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8"
                              onClick={() => {
                                if (log.entityType === "project" && deletedProjectId) {
                                  restoreMutation.mutate({ entityType: "project", deletedId: deletedProjectId });
                                }
                                if (log.entityType === "task" && deletedTaskId) {
                                  restoreMutation.mutate({ entityType: "task", deletedId: deletedTaskId });
                                }
                              }}
                              disabled={restoreMutation.isPending}
                            >
                              {restoreMutation.isPending ? "Restoring..." : "Restore"}
                            </Button>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                      </TableRow>
                    )})}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
