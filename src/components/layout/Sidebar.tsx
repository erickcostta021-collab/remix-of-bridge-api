import { useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { useSettings } from "@/hooks/useSettings";
import {
  LayoutDashboard,
  Settings,
  LogOut,
  Menu,
  X,
  ExternalLink,
} from "lucide-react";
import logo from "@/assets/logo.png";

// Admin emails are now handled in Settings.tsx

const navItems = [
  { to: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/settings", icon: Settings, label: "Configurações" },
];

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false);
  const { signOut } = useAuth();
  const { getOAuthUrl } = useSettings();
  const location = useLocation();

  const oauthUrl = getOAuthUrl();

  const handleSignOut = async () => {
    await signOut();
  };

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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setCollapsed(true)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 flex flex-col bg-sidebar border-r border-sidebar-border transition-all duration-300",
          collapsed ? "w-16" : "w-64",
          "lg:translate-x-0",
          collapsed ? "-translate-x-full lg:translate-x-0" : "translate-x-0"
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-sidebar-border">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <img src={logo} alt="Bridge API" className="h-10 w-10 object-contain" />
              <span className="font-semibold text-sidebar-foreground">Bridge API</span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
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
            <button
              onClick={handleInstallApp}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors w-full text-left",
                "text-sidebar-foreground hover:bg-sidebar-accent"
              )}
            >
              <ExternalLink className="h-5 w-5 flex-shrink-0" />
              {!collapsed && <span>Instalar App</span>}
            </button>
          )}
        </nav>

        {/* Footer */}
        <div className="p-2 border-t border-sidebar-border">
          <Button
            variant="ghost"
            onClick={handleSignOut}
            className={cn(
              "w-full justify-start gap-3 text-sidebar-foreground hover:bg-sidebar-accent hover:text-destructive",
              collapsed && "justify-center"
            )}
          >
            <LogOut className="h-5 w-5 flex-shrink-0" />
            {!collapsed && <span>Sair</span>}
          </Button>
        </div>
      </aside>

      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        onClick={() => setCollapsed(false)}
        className="fixed top-4 left-4 z-30 lg:hidden text-foreground"
      >
        <Menu className="h-6 w-6" />
      </Button>
    </>
  );
}
