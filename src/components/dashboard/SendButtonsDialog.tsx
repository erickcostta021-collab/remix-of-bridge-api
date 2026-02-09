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

interface SendButtonsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const buttonCommands = [
  {
    command: "#pix",
    description: "Envia botão de pagamento PIX ao contato",
    format: "tipo|chave|nome",
    context: "Contato",
    notes: "Tipos: EVP, CPF, CNPJ, PHONE, EMAIL",
  },
  {
    command: "#botoes",
    description: "Envia mensagem com botões de resposta rápida",
    format: "texto|rodapé|botão1,botão2,botão3",
    context: "Contato",
    notes: "Máx. 3 botões separados por vírgula. Rodapé opcional (pode omitir).",
  },
  {
    command: "#lista",
    description: "Envia lista interativa com seções e itens",
    format: "texto|textoBotão|[Seção],item1,item2",
    context: "Contato",
    notes: "Use [Título] para seções. Itens: texto|id|descrição.",
  },
  {
    command: "#enquete",
    description: "Envia enquete/votação ao contato",
    format: "pergunta|opção1|opção2|opção3",
    context: "Contato",
    notes: "Mínimo 2 opções. Sem limite definido.",
  },
];

export function SendButtonsDialog({ open, onOpenChange }: SendButtonsDialogProps) {
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);

  const handleCopy = (cmd: typeof buttonCommands[0]) => {
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
          <DialogTitle className="text-xl">Enviar Botões</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Comandos para enviar botões interativos pelo chat do GoHighLevel.
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
              {buttonCommands.map((cmd, i) => (
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
                    <Badge variant="outline" className="text-xs">
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
            <strong className="text-foreground">Dica:</strong> Esses comandos devem ser enviados no chat de um contato individual no CRM.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
