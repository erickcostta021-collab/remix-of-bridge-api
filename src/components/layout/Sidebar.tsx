
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useSettings } from "@/hooks/useSettings";
import { useSubscription } from "@/hooks/useSubscription";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  LayoutDashboard,
  Settings,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";


// Admin emails are now handled in Settings.tsx

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

import { useSidebarState } from "@/hooks/useSidebarState";

export function Sidebar() {
  const { collapsed, toggle } = useSidebarState();
  const { getOAuthUrl } = useSettings();
  const { hasActiveSubscription } = useSubscription();
  const location = useLocation();

  const oauthUrl = getOAuthUrl();

  const handleInstallApp = () => {
    if (!oauthUrl) return;
    try {
      const url = new URL(oauthUrl);
      const state = url.searchParams.get("state");
      if (state) localStorage.setItem("ghl_oauth_state", state);
    } catch {
      // ignore
    }
    window.open(oauthUrl, "_blank");
  };

  return (
    <>
      {/* Mobile overlay */}
      {!collapsed && (
        <div
          className="fixed inset-0 top-16 bg-black/50 z-40 lg:hidden"
          onClick={toggle}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 top-16 lg:top-0 left-0 z-50 lg:z-auto flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          "lg:translate-x-0",
          collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Collapse toggle (desktop only) */}
        <div className="hidden lg:flex items-center justify-end h-12 px-2 border-b border-sidebar-border">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="text-sidebar-foreground hover:bg-sidebar-accent"
          >
            {collapsed ? <Menu className="h-5 w-5" /> : <X className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-2 space-y-1">
          {navItems.map((item) => {
            const isActive = location.pathname === item.to;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors",
                  isActive
                    ? "bg-sidebar-accent text-primary"
                    : "text-sidebar-foreground hover:bg-sidebar-accent"
                )}
              >
                <item.icon className="h-5 w-5 flex-shrink-0" />
                {!collapsed && <span>{item.label}</span>}
              </NavLink>
            );
          })}
          {/* Install App Button */}
          {oauthUrl && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={hasActiveSubscription ? handleInstallApp : undefined}
                    disabled={!hasActiveSubscription}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left",
                      hasActiveSubscription
                        ? "text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer"
                        : "text-sidebar-foreground/40 cursor-not-allowed"
                    )}
                  >
                    <ExternalLink className="h-5 w-5 flex-shrink-0" />
                    {!collapsed && <span>Instalar App</span>}
                  </button>
                </TooltipTrigger>
                {!hasActiveSubscription && (
                  <TooltipContent side="right">
                    <p>Assine um plano para instalar o app</p>
                  </TooltipContent>
                )}
              </Tooltip>
            </TooltipProvider>
          )}
        </nav>

        {/* Spacer at bottom */}
        <div className="p-2 border-t border-sidebar-border" />
      </aside>

    </>
  );
}
