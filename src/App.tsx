import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { usePausedCheck } from "@/hooks/usePausedCheck";
import { Loader2 } from "lucide-react";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Settings from "./pages/Settings";
import SubaccountSettings from "./pages/SubaccountSettings";
import EmbedInstances from "./pages/EmbedInstances";
import OAuthCallback from "./pages/OAuthCallback";
import OAuthSuccess from "./pages/OAuthSuccess";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { isPaused, checking } = usePausedCheck();

  if (loading || checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || isPaused) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/login" element={<Login />} />
          <Route
            path="/dashboard"
            element={
              <ProtectedRoute>
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/settings"
            element={
              <ProtectedRoute>
                <Settings />
              </ProtectedRoute>
            }
          />
          <Route
            path="/subaccount/:id/settings"
            element={
              <ProtectedRoute>
                <SubaccountSettings />
              </ProtectedRoute>
            }
          />
          {/* Public embed route - no auth required */}
          <Route path="/embed/:embedToken" element={<EmbedInstances />} />
          {/* OAuth routes - public for GHL */}
          <Route path="/oauth/callback" element={<OAuthCallback />} />
          <Route path="/oauth/success/:locationId" element={<OAuthSuccess />} />
          <Route path="/oauth/success" element={<OAuthSuccess />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
