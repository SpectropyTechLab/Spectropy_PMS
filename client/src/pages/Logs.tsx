import { useMemo, useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
  Filter,
  X,
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
      const res = await apiRequest("GET", "/api/buckets");
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
    <div className="space-y-6 animate-in fade-in duration-700 h-full flex flex-col">
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
        className="flex-1"
      >
        <Card className="flex flex-col h-full shadow-md border-slate-200">
          <CardHeader className="flex flex-col gap-4 pb-6 bg-slate-50/50 border-b">
            <div className="flex flex-row items-center justify-between gap-2">
              <div className="space-y-1">
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5 text-primary" />
                  Filter Activity
                </CardTitle>
                <CardDescription>
                  Narrow down logs by user, action type, or date range.
                </CardDescription>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => queryClient.invalidateQueries({ queryKey: ["/api/logs"] })}
                  className="h-8"
                >
                  <RotateCcw className="w-3 h-3 mr-2" />
                  Refresh
                </Button>
                <Badge variant="outline" className="font-normal bg-white">
                  {filteredLogs.length} entries
                </Badge>
              </div>
            </div>

            {/* Improved Filter Layout */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3 items-end">
              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground ml-1">Action</span>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="h-9 bg-white">
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
                <span className="text-xs font-medium text-muted-foreground ml-1">User</span>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger className="h-9 bg-white">
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
                <span className="text-xs font-medium text-muted-foreground ml-1">Start Date</span>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(event) => setStartDate(event.target.value)}
                  className="h-9 bg-white"
                />
              </div>

              <div className="space-y-1">
                <span className="text-xs font-medium text-muted-foreground ml-1">End Date</span>
                <Input
                  type="date"
                  value={endDate}
                  onChange={(event) => setEndDate(event.target.value)}
                  className="h-9 bg-white"
                />
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setActionFilter("all");
                  setUserFilter("all");
                  setStartDate("");
                  setEndDate("");
                }}
                className="h-9 text-muted-foreground hover:text-destructive"
              >
                <X className="w-4 h-4 mr-2" />
                Clear Filters
              </Button>
            </div>
          </CardHeader>

          <CardContent className="p-0 flex-1">
            {filteredLogs.length === 0 ? (
              <div className="text-center py-20 text-slate-500 flex flex-col items-center justify-center">
                <div className="bg-slate-100 p-4 rounded-full mb-4">
                  <ScrollText className="h-8 w-8 text-slate-300" />
                </div>
                <h3 className="font-semibold text-lg text-slate-700">No activity logs found</h3>
                <p className="text-sm">Try adjusting your filters to see more results.</p>
              </div>
            ) : (
              // SCROLL IMPROVEMENT: Native div with overflow-auto handles X and Y scrolling reliably
              // Added max-height to constraint vertical size
              <div className="relative w-full h-[600px] overflow-auto rounded-b-lg">
                {/* Min-width ensures table doesn't squash columns on small screens */}
                <Table className="min-w-[1200px] relative">
                  <TableHeader className="sticky top-0 z-10 shadow-sm">
                    <TableRow className="bg-slate-50 hover:bg-slate-50 border-b-slate-200">
                      <TableHead className="w-[180px] font-semibold">Date & Time</TableHead>
                      <TableHead className="w-[140px] font-semibold">Action</TableHead>
                      <TableHead className="w-[140px] font-semibold">Entity Type</TableHead>
                      <TableHead className="font-semibold min-w-[200px]">Entity Name</TableHead>
                      <TableHead className="w-[180px] font-semibold">Project</TableHead>
                      <TableHead className="w-[160px] font-semibold">Bucket</TableHead>
                      <TableHead className="w-[150px] font-semibold">Performed By</TableHead>
                      <TableHead className="w-[140px] font-semibold text-right pr-6">Controls</TableHead>
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
                        <TableRow
                          key={log.id}
                          data-testid={`row-log-${log.id}`}
                          className="hover:bg-slate-50/50 transition-colors"
                        >
                          <TableCell className="text-slate-500 text-sm whitespace-nowrap">
                            {log.createdAt
                              ? format(new Date(log.createdAt), "MMM d, yyyy HH:mm")
                              : "-"}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getActionIcon(log.action)}
                              <Badge variant={getActionBadgeVariant(log.action)} className="capitalize shadow-none">
                                {log.action}
                              </Badge>
                            </div>
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              {getEntityIcon(log.entityType)}
                              <span className="capitalize text-slate-700 font-medium text-sm">
                                {log.entityType}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="font-medium text-slate-900 max-w-[250px] truncate" title={log.entityName || ""}>
                            {log.entityName || "-"}
                          </TableCell>
                          <TableCell className="text-slate-700 whitespace-nowrap max-w-[180px] truncate" title={projectName}>
                            {projectName}
                          </TableCell>
                          <TableCell className="text-slate-700 whitespace-nowrap max-w-[160px] truncate" title={bucketName}>
                            {bucketName}
                          </TableCell>
                          <TableCell className="whitespace-nowrap">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-slate-400" />
                              <span className="text-slate-600 text-sm">
                                {log.performedByName || "System"}
                              </span>
                            </div>
                          </TableCell>
                          <TableCell className="text-right pr-6">
                            {canRestore ? (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 px-3 text-xs bg-white hover:bg-slate-100 hover:text-primary border-slate-200"
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
                                {restoreMutation.isPending ? (
                                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                ) : (
                                  <RotateCcw className="h-3 w-3 mr-1" />
                                )}
                                {restoreMutation.isPending ? "Restoring" : "Restore"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground opacity-50 block w-full">-</span>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}