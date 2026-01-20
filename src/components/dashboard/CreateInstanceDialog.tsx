import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Plus, Loader2 } from "lucide-react";
import { useInstances } from "@/hooks/useInstances";

interface CreateInstanceDialogProps {
  subaccountId: string;
}

export function CreateInstanceDialog({ subaccountId }: CreateInstanceDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const { createInstance } = useInstances();

  const handleCreate = () => {
    if (!name.trim()) return;
    
    createInstance.mutate(
      { name: name.trim(), subaccountId },
      {
        onSuccess: () => {
          setOpen(false);
          setName("");
        },
      }
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="bg-primary hover:bg-primary/90" data-create-instance>
          <Plus className="h-4 w-4 mr-2" />
          Nova Instância
        </Button>
      </DialogTrigger>
      <DialogContent className="bg-card border-border">
        <DialogHeader>
          <DialogTitle className="text-card-foreground">Criar Nova Instância</DialogTitle>
          <DialogDescription>
            Crie uma nova instância UAZAPI para esta subconta
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="instance-name">Nome da Instância</Label>
            <Input
              id="instance-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: [CJ][01]"
              className="bg-secondary border-border"
            />
          </div>
        </div>
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => setOpen(false)} className="border-border">
            Cancelar
          </Button>
          <Button
            onClick={handleCreate}
            disabled={!name.trim() || createInstance.isPending}
          >
            {createInstance.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Criar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
