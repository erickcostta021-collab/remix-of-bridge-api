import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";

interface GroupCommandsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const commands = [
  {
    command: "#criargrupo",
    description: "Cria um novo grupo no WhatsApp",
    format: "nome|+55...|descrição|urldafoto",
    context: "Global",
    notes: "Descrição e foto são opcionais",
  },
  {
    command: "#addnogrupo",
    description: "Adiciona participante ao grupo",
    format: "+55...",
    context: "Dentro do grupo",
  },
  {
    command: "#removerdogrupo",
    description: "Remove participante do grupo",
    format: "+55...",
    context: "Dentro do grupo",
  },
  {
    command: "#promoveradmin",
    description: "Promove participante a admin",
    format: "+55...",
    context: "Dentro do grupo",
  },
  {
    command: "#revogaradmin",
    description: "Revoga admin de um participante",
    format: "+55...",
    context: "Dentro do grupo",
  },
  {
    command: "#attfotogrupo",
    description: "Atualiza a foto do grupo",
    format: "url_da_foto",
    context: "Dentro do grupo",
  },
  {
    command: "#attnomegrupo",
    description: "Atualiza o nome do grupo",
    format: "novo nome",
    context: "Dentro do grupo",
  },
  {
    command: "#attdescricao",
    description: "Atualiza a descrição do grupo",
    format: "nova descrição",
    context: "Dentro do grupo",
  },
  {
    command: "#somenteadminmsg",
    description: "Apenas admins enviam mensagens",
    format: "",
    context: "Dentro do grupo",
  },
  {
    command: "#msgliberada",
    description: "Todos podem enviar mensagens",
    format: "",
    context: "Dentro do grupo",
  },
  {
    command: "#somenteadminedit",
    description: "Apenas admins editam dados do grupo",
    format: "",
    context: "Dentro do grupo",
  },
  {
    command: "#editliberado",
    description: "Todos podem editar dados do grupo",
    format: "",
    context: "Dentro do grupo",
  },
  {
    command: "#linkgrupo",
    description: "Obtém o link de convite do grupo",
    format: "",
    context: "Dentro do grupo",
    notes: "Formato global: #linkgrupo ID|TELEFONE",
  },
  {
    command: "#sairgrupo",
    description: "Sai do grupo (remove a instância)",
    format: "",
    context: "Dentro do grupo",
  },
];

export function GroupCommandsDialog({ open, onOpenChange }: GroupCommandsDialogProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = (cmd: typeof commands[0]) => {
    const fullCommand = cmd.format
      ? `${cmd.command} ${cmd.format}`
      : cmd.command;
    navigator.clipboard.writeText(fullCommand);
    setCopiedCommand(cmd.command);
    toast.success("Comando copiado!");
    setTimeout(() => setCopiedCommand(null), 2000);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Comandos de Grupo do WhatsApp</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Envie esses comandos pelo chat do GoHighLevel para gerenciar grupos do WhatsApp.
          </p>
        </DialogHeader>

        <div className="mt-4 rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted/50 border-b border-border">
                <th className="text-left px-4 py-3 font-semibold text-foreground">Comando</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground hidden sm:table-cell">Descrição</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground">Formato</th>
                <th className="text-left px-4 py-3 font-semibold text-foreground hidden md:table-cell">Contexto</th>
                <th className="px-3 py-3 w-10"></th>
              </tr>
            </thead>
            <tbody>
              {commands.map((cmd, i) => (
                <tr
                  key={cmd.command}
                  className={i % 2 === 0 ? "bg-background" : "bg-muted/20"}
                >
                  <td className="px-4 py-3 font-mono text-primary font-medium whitespace-nowrap">
                    {cmd.command}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground hidden sm:table-cell">
                    {cmd.description}
                  </td>
                  <td className="px-4 py-3">
                    {cmd.format ? (
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded text-foreground">
                        {cmd.format}
                      </code>
                    ) : (
                      <span className="text-muted-foreground text-xs">Sem parâmetros</span>
                    )}
                    {cmd.notes && (
                      <p className="text-xs text-muted-foreground mt-1">{cmd.notes}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <Badge
                      variant={cmd.context === "Global" ? "default" : "secondary"}
                      className="text-xs"
                    >
                      {cmd.context}
                    </Badge>
                  </td>
                  <td className="px-3 py-3">
                    <button
                      onClick={() => handleCopy(cmd)}
                      className="p-1.5 rounded-md hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
                      title="Copiar comando"
                    >
                      {copiedCommand === cmd.command ? (
                        <Check className="h-4 w-4 text-primary" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-4 p-3 rounded-lg bg-muted/30 border border-border">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Dica:</strong> Comandos com contexto "Dentro do grupo" devem ser enviados de dentro da conversa do grupo no CRM.
            O comando <code className="text-primary">#criargrupo</code> pode ser enviado de qualquer conversa.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
