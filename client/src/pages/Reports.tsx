import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  Users,
  FolderKanban,
  Calendar,
  RefreshCw,
  Layers,
} from "lucide-react";
import type { Project, User } from "@shared/schema";

import ProjectReports from "@/components/reports/ProjectReports";
import UserReports from "@/components/reports/UserReports";
import DeadlineReports from "@/components/reports/DeadlineReports";
import BucketReports from "@/components/reports/BucketReports";

export default function Reports() {
  const [activeTab, setActiveTab] = useState("projects");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("");
  const [selectedUserId, setSelectedUserId] = useState<string>("");
  const [selectedBucketId, setSelectedBucketId] = useState<string>("");
  const [bucketProjectFilter, setBucketProjectFilter] = useState<string>("all");

  const userRole = localStorage.getItem("userRole") || "User";
  const currentUserId = Number(localStorage.getItem("userId")) || 0;
  const isAdmin = userRole === "Admin";

  const { data: projects = [], refetch: refetchProjects } = useQuery<Project[]>({
    queryKey: ["/api/projects"],
  });

  const { data: users = [], refetch: refetchUsers } = useQuery<User[]>({
    queryKey: ["/api/users"],
  });

  // Filter projects based on permissions
  const availableProjects = isAdmin
    ? projects
    : projects.filter((p) => {
      // Add your logic for non-admin user project access here if needed
      return true;
    });

  // Set default project selection
  useEffect(() => {
    if (availableProjects.length > 0 && !selectedProjectId) {
      setSelectedProjectId(String(availableProjects[0].id));
    }
  }, [availableProjects, selectedProjectId]);

  // Set default user selection
  useEffect(() => {
    if (!isAdmin && currentUserId && !selectedUserId) {
      setSelectedUserId(String(currentUserId));
    }
  }, [isAdmin, currentUserId, selectedUserId]);

  const handleRefresh = () => {
    refetchProjects();
    refetchUsers();
  };

  return (
    <div className="p-2 sm:p-6 space-y-4 sm:space-y-6 max-w-[100vw] overflow-x-hidden">
      {/* Header Section */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold flex items-center gap-2" data-testid="text-reports-title">
            <div className="p-2 bg-primary/10 rounded-lg">
              <BarChart3 className="h-6 w-6 text-primary" />
            </div>
            Reports
          </h1>
          <p className="text-sm text-muted-foreground mt-1 hidden sm:block">
            Comprehensive analytics dashboard for your projects and tasks
          </p>
        </div>
        <Button
          onClick={handleRefresh}
          variant="outline"
          size="sm"
          className="w-full sm:w-auto"
          data-testid="button-refresh-reports"
        >
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh Data
        </Button>
      </motion.div>

      {/* Main Content Area */}
      <Card className="border-0 sm:border shadow-none sm:shadow-sm bg-transparent sm:bg-card">
        <CardContent className="p-0 sm:p-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full space-y-4">
            {/* Responsive Tabs List: 2 cols on mobile, 4 cols on desktop */}
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-4 h-auto gap-2 bg-muted/50 p-1">
              <TabsTrigger value="projects" className="gap-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-projects">
                <FolderKanban className="h-4 w-4" />
                <span>Projects</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-users">
                <Users className="h-4 w-4" />
                <span>Users</span>
              </TabsTrigger>
              <TabsTrigger value="deadlines" className="gap-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-deadlines">
                <Calendar className="h-4 w-4" />
                <span>Deadlines</span>
              </TabsTrigger>
              <TabsTrigger value="buckets" className="gap-2 py-2 data-[state=active]:bg-background data-[state=active]:shadow-sm" data-testid="tab-buckets">
                <Layers className="h-4 w-4" />
                <span>Buckets</span>
              </TabsTrigger>
            </TabsList>

            <AnimatePresence mode="wait">
              <div className="min-h-[400px]">
                <TabsContent key="projects" value="projects" className="mt-0 focus-visible:ring-0">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <ProjectReports
                      selectedProjectId={selectedProjectId}
                      onProjectChange={setSelectedProjectId}
                      projects={availableProjects}
                      users={users}
                      isAdmin={isAdmin}
                    />
                  </motion.div>
                </TabsContent>

                <TabsContent key="users" value="users" className="mt-0 focus-visible:ring-0">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <UserReports
                      selectedUserId={selectedUserId}
                      onUserChange={setSelectedUserId}
                      users={users}
                      projects={availableProjects}
                      isAdmin={isAdmin}
                      currentUserId={currentUserId}
                    />
                  </motion.div>
                </TabsContent>

                <TabsContent key="deadlines" value="deadlines" className="mt-0 focus-visible:ring-0">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <DeadlineReports
                      projects={availableProjects}
                      users={users}
                      isAdmin={isAdmin}
                      currentUserId={currentUserId}
                    />
                  </motion.div>
                </TabsContent>

                <TabsContent key="buckets" value="buckets" className="mt-0 focus-visible:ring-0">
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ duration: 0.2 }}
                  >
                    <BucketReports
                      selectedBucketId={selectedBucketId}
                      onBucketChange={setSelectedBucketId}
                      selectedProjectFilter={bucketProjectFilter}
                      onProjectFilterChange={setBucketProjectFilter}
                      projects={availableProjects}
                      users={users}
                      isAdmin={isAdmin}
                      currentUserId={currentUserId}
                    />
                  </motion.div>
                </TabsContent>
              </div>
            </AnimatePresence>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}