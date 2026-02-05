import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FolderKanban, Calendar, CheckCircle2 } from "lucide-react";
import { Link } from "wouter";
import { motion } from "framer-motion";
import type { Project, Task } from "@shared/schema";
import { apiRequest } from "@/lib/queryClient";

export default function UserProjects() {
  const userId = Number(localStorage.getItem("userId"));
  const [statusFilter, setStatusFilter] = useState<string>("all");

  const { data: myTasks = [], isLoading: tasksLoading } = useQuery<Task[]>({
    queryKey: ["/api/tasks", { assigneeId: userId }],
    queryFn: async () => {
      const res = await apiRequest("GET", `/api/tasks?assigneeId=${userId}`);
      return res.json();
    },
    enabled: !!userId,
  });

  const { data: projects = [], isLoading: projectsLoading } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });
  const myProjectIds = Array.from(new Set(myTasks.map((task) => task.projectId)));
  const myProjects = projects.filter((project) => myProjectIds.includes(project.id));

  const filteredProjects = myProjects.filter((project) => {
    if (statusFilter === "all") return true;
    return project.status === statusFilter;
  });

  const getProjectStats = (projectId: number) => {
    const projectTasks = myTasks.filter((t) => t.projectId === projectId);
    const completed = projectTasks.filter((t) => t.status === "completed").length;
    const total = projectTasks.length;
    const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;
    return { completed, total, percentage };
  };

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
        className="flex flex-col md:flex-row md:items-center justify-between gap-4"
      >
        <div>
          <h1 className="text-3xl font-display font-bold text-slate-900" data-testid="text-page-title">
            My Projects
          </h1>
          <p className="text-muted-foreground mt-1">
            View and manage your assigned projects
          </p>
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]" data-testid="select-status-filter">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Projects</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
            <SelectItem value="on_hold">On Hold</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {filteredProjects.length === 0 ? (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="flex flex-col items-center justify-center h-64 text-center border border-dashed border-slate-300 rounded-xl"
        >
          <FolderKanban className="h-12 w-12 text-slate-300 mb-4" />
          <h3 className="text-lg font-medium text-slate-600">No projects found</h3>
          <p className="text-muted-foreground mt-1">
            {statusFilter !== "all" 
              ? "Try changing the filter to see more projects" 
              : "You haven't been assigned to any projects yet"}
          </p>
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredProjects.map((project, index) => {
            const stats = getProjectStats(project.id);
            return (
              <motion.div
                key={project.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Link href={`/user/projects/${project.id}`}>
                  <Card className="hover-elevate cursor-pointer h-full" data-testid={`card-project-${project.id}`}>
                    <CardContent className="p-5">
                      <div className="flex items-start justify-between gap-2 mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                            <FolderKanban className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h3 className="font-semibold text-slate-900 line-clamp-1">
                              {project.name}
                            </h3>
                            <p className="text-xs text-muted-foreground line-clamp-1">
                              {project.description || "No description"}
                            </p>
                          </div>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            project.status === "completed"
                              ? "bg-emerald-100 text-emerald-700"
                              : project.status === "on_hold"
                              ? "bg-amber-100 text-amber-700"
                              : "bg-primary/10 text-primary"
                          }
                        >
                          {project.status}
                        </Badge>
                      </div>

                      <div className="space-y-3">
                        <div>
                          <div className="flex items-center justify-between text-sm mb-1">
                            <span className="text-muted-foreground">Progress</span>
                            <span className="font-medium">{stats.percentage}%</span>
                          </div>
                          <div className="w-full bg-slate-100 rounded-full h-2">
                            <div
                              className="bg-primary h-2 rounded-full transition-all"
                              style={{ width: `${stats.percentage}%` }}
                            />
                          </div>
                        </div>

                        <div className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-1 text-muted-foreground">
                            <CheckCircle2 className="h-4 w-4" />
                            <span>{stats.completed}/{stats.total} tasks</span>
                          </div>
                          {project.startDate && (
                            <div className="flex items-center gap-1 text-muted-foreground">
                              <Calendar className="h-4 w-4" />
                              <span>{new Date(project.startDate).toLocaleDateString()}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
