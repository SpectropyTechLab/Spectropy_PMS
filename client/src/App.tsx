import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Layout } from "@/components/layout/Layout";
import Landing from "@/pages/Landing";
import Dashboard from "@/pages/Dashboard";
import Projects from "@/pages/Projects";
import ProjectBoard from "@/pages/ProjectBoard";
import Reports from "@/pages/Reports";
import TodoPage from "@/pages/Todo";
import Auth from "@/pages/Auth";
import UserDashboard from "@/pages/UserDashboard";
import UserProjects from "@/pages/UserProjects";
import UserTasks from "@/pages/UserTasks";
import Account from "@/pages/Account";
import Settings from "@/pages/Settings";
import UserManagement from "@/pages/UserManagement";
import AdminTasks from "@/pages/AdminTasks";
import Logs from "@/pages/Logs";
import NotFound from "@/pages/not-found";
import { ProtectedRoute } from "@/routes/ProtectedRoute";

function Router() {
  return (
    <Switch>
      <Route path="/" component={Landing} />
      <Route path="/auth" component={Auth} />
      
      {/* Protected Admin Routes */}
      <Route path="/dashboard">
        <ProtectedRoute role="Admin">
          <Layout>
            <Dashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/projects">
        <ProtectedRoute role="Admin">
          <Layout>
            <Projects />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/projects/:id">
        <ProtectedRoute role="Admin">
          <Layout fullWidth>
            <ProjectBoard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/reports">
        <ProtectedRoute role="Admin">
          <Layout>
            <Reports />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/todo">
        <ProtectedRoute>
          <Layout>
            <TodoPage />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/users">
        <ProtectedRoute role="Admin">
          <Layout>
            <UserManagement />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/tasks">
        <ProtectedRoute role="Admin">
          <Layout>
            <AdminTasks />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/logs">
        <ProtectedRoute role="Admin">
          <Layout>
            <Logs />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* Protected User Routes */}
      <Route path="/user/dashboard">
        <ProtectedRoute role="User">
          <Layout>
            <UserDashboard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/user/projects">
        <ProtectedRoute role="User">
          <Layout>
            <UserProjects />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/user/projects/:id">
        <ProtectedRoute role="User">
          <Layout fullWidth>
            <ProjectBoard />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/user/tasks">
        <ProtectedRoute role="User">
          <Layout>
            <UserTasks />
          </Layout>
        </ProtectedRoute>
      </Route>

      {/* Shared Account and Settings Routes */}
      <Route path="/account">
        <ProtectedRoute>
          <Layout>
            <Account />
          </Layout>
        </ProtectedRoute>
      </Route>
      <Route path="/settings">
        <ProtectedRoute>
          <Layout>
            <Settings />
          </Layout>
        </ProtectedRoute>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Router />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
