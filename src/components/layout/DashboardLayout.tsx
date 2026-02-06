import { Sidebar } from "./Sidebar";
import { useSidebarState } from "@/hooks/useSidebarState";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  const { collapsed } = useSidebarState();
  
  return (
    <div className="flex flex-col min-h-screen bg-background">
      {/* Top Header - Full Width Blue Bar */}
      <header className="h-12 bg-primary flex items-center justify-between px-4 w-full z-50">
        <span className="text-primary-foreground font-semibold text-sm">
          Bridge API
        </span>
      </header>
      
      <div className="flex flex-1">
        <Sidebar />
        <main className="flex-1 lg:ml-0 overflow-auto">
          <div className="container max-w-7xl mx-auto p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
