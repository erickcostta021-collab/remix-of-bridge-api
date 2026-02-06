import { Sidebar } from "./Sidebar";
import { DashboardHeader } from "./DashboardHeader";
import { InteractiveGrid } from "./InteractiveGrid";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <div className="flex flex-col min-h-screen bg-background relative">
      <InteractiveGrid />

      <DashboardHeader />
      <div className="flex flex-1 overflow-hidden relative z-10">
        <Sidebar />
        <main className="flex-1 overflow-auto">
          <div className="container max-w-7xl mx-auto p-4 lg:p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
