import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Loader2, Trash2, Users, RefreshCw, Pause, Play } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";

interface RegisteredUser {
  id: string;
  email: string;
  created_at: string;
  user_id: string;
  is_paused: boolean;
  paused_at: string | null;
}

export function RegisteredUsersPanel() {
  const queryClient = useQueryClient();
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const { data: users, isLoading, refetch, isRefetching } = useQuery({
    queryKey: ["registered-users"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, created_at, user_id, is_paused, paused_at")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data as RegisteredUser[];
    },
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { error: settingsError } = await supabase
        .from("user_settings")
        .delete()
        .eq("user_id", userId);

      if (settingsError) {
        console.error("Error deleting user settings:", settingsError);
      }

      const { error: instancesError } = await supabase
        .from("instances")
        .delete()
        .eq("user_id", userId);

      if (instancesError) {
        console.error("Error deleting instances:", instancesError);
      }

      const { error: subaccountsError } = await supabase
        .from("ghl_subaccounts")
        .delete()
        .eq("user_id", userId);

      if (subaccountsError) {
        console.error("Error deleting subaccounts:", subaccountsError);
      }

      const { error: profileError } = await supabase
        .from("profiles")
        .delete()
        .eq("user_id", userId);

      if (profileError) throw profileError;

      return userId;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["registered-users"] });
      toast.success("Usuário excluído com sucesso!");
      setDeletingId(null);
    },
    onError: (error) => {
      toast.error("Erro ao excluir usuário: " + error.message);
      setDeletingId(null);
    },
  });

  const togglePause = useMutation({
    mutationFn: async ({ userId, isPaused }: { userId: string; isPaused: boolean }) => {
      const { error } = await supabase
        .from("profiles")
        .update({
          is_paused: !isPaused,
          paused_at: !isPaused ? new Date().toISOString() : null,
        })
        .eq("user_id", userId);

      if (error) throw error;
      return { userId, newState: !isPaused };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["registered-users"] });
      toast.success(data.newState ? "Usuário pausado com sucesso!" : "Usuário reativado com sucesso!");
      setTogglingId(null);
    },
    onError: (error) => {
      toast.error("Erro ao alterar status: " + error.message);
      setTogglingId(null);
    },
  });

  const handleDelete = (userId: string) => {
    setDeletingId(userId);
    deleteUser.mutate(userId);
  };

  const handleTogglePause = (userId: string, isPaused: boolean) => {
    setTogglingId(userId);
    togglePause.mutate({ userId, isPaused });
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <CardTitle className="text-card-foreground">Usuários Cadastrados</CardTitle>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="border-border"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefetching ? "animate-spin" : ""}`} />
            Atualizar
          </Button>
        </div>
        <CardDescription>
          Lista de todos os usuários registrados na plataforma
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : users && users.length > 0 ? (
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border">
                  <TableHead className="text-muted-foreground">Email</TableHead>
                  <TableHead className="text-muted-foreground">Status</TableHead>
                  <TableHead className="text-muted-foreground">Cadastrado em</TableHead>
                  <TableHead className="text-muted-foreground w-[140px]">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id} className="border-border">
                    <TableCell className="font-medium text-foreground">
                      {user.email || "Email não definido"}
                    </TableCell>
                    <TableCell>
                      {user.is_paused ? (
                        <Badge variant="destructive" className="gap-1">
                          <Pause className="h-3 w-3" />
                          Pausado
                        </Badge>
                      ) : (
                        <Badge variant="default" className="gap-1 bg-green-600 hover:bg-green-700">
                          <Play className="h-3 w-3" />
                          Ativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {format(new Date(user.created_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Toggle Pause Button */}
                        <Button
                          variant="ghost"
                          size="icon"
                          className={`h-8 w-8 ${user.is_paused ? "text-green-600 hover:text-green-700 hover:bg-green-100" : "text-amber-600 hover:text-amber-700 hover:bg-amber-100"}`}
                          disabled={togglingId === user.user_id}
                          onClick={() => handleTogglePause(user.user_id, user.is_paused)}
                          title={user.is_paused ? "Reativar usuário" : "Pausar usuário"}
                        >
                          {togglingId === user.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : user.is_paused ? (
                            <Play className="h-4 w-4" />
                          ) : (
                            <Pause className="h-4 w-4" />
                          )}
                        </Button>

                        {/* Delete Button */}
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                              disabled={deletingId === user.user_id}
                            >
                              {deletingId === user.user_id ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-card border-border">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-foreground">
                                Excluir usuário?
                              </AlertDialogTitle>
                              <AlertDialogDescription>
                                Esta ação irá excluir o perfil do usuário <strong>{user.email}</strong> e todos os dados associados (instâncias, subcontas, configurações).
                                <br /><br />
                                <span className="text-destructive font-medium">Esta ação não pode ser desfeita.</span>
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="border-border">Cancelar</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleDelete(user.user_id)}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Excluir
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            Nenhum usuário cadastrado ainda.
          </div>
        )}
        
        {users && users.length > 0 && (
          <p className="text-xs text-muted-foreground mt-4">
            Total: {users.length} usuário{users.length !== 1 ? "s" : ""}
          </p>
        )}
      </CardContent>
    </Card>
  );
}