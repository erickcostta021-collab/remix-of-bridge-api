import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useProfile } from "@/hooks/useProfile";
import { useSubscription } from "@/hooks/useSubscription";
import { useSidebarState } from "@/hooks/useSidebarState";
import { PlansDialog } from "@/components/dashboard/PlansDialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Menu, KeyRound, LogOut, CreditCard } from "lucide-react";
import logo from "@/assets/logo.png";

export function DashboardHeader() {
  const { signOut } = useAuth();
  const { profile } = useProfile();
  const { hasActiveSubscription } = useSubscription();
  const { toggle, collapsed } = useSidebarState();
  const navigate = useNavigate();

  const getInitials = (name: string | null | undefined) => {
    if (!name) return "U";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return parts[0][0]?.toUpperCase() || "U";
  };

  const handleChangePassword = () => {
    navigate("/settings", { state: { openPasswordChange: true } });
  };

  const handleSignOut = async () => {
    await signOut();
  };

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 lg:px-8 bg-card/80 backdrop-blur-md border-b border-border">
      {/* Left: mobile menu + branding */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={toggle}
          className="lg:hidden text-foreground"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <div className="flex items-center gap-2 lg:hidden">
          <img src={logo} alt="Bridge API" className="h-8 w-8 rounded-full" />
          <span className="font-semibold text-foreground text-sm">Bridge API</span>
        </div>
      </div>

      {/* Right: plans + avatar */}
      <div className="flex items-center gap-3">
        {!hasActiveSubscription && (
          <PlansDialog>
            <Button size="sm" className="bg-primary hover:bg-primary/90 text-primary-foreground">
              <CreditCard className="h-4 w-4 mr-2" />
              Assinar Plano
            </Button>
          </PlansDialog>
        )}

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-primary/30 transition-all p-0.5">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary text-primary-foreground text-sm font-medium">
                  {getInitials(profile?.full_name)}
                </AvatarFallback>
              </Avatar>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-2 py-1.5">
              <p className="text-sm font-medium">{profile?.full_name || "Usuário"}</p>
              <p className="text-xs text-muted-foreground">{profile?.email}</p>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={handleChangePassword}>
              <KeyRound className="h-4 w-4 mr-2" />
              Alterar Senha
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleSignOut}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="h-4 w-4 mr-2" />
              Sair da Conta
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
