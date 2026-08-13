import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export function NomeOperadorDialog({
  open,
  onConfirmar,
  onCancelar,
}: {
  open: boolean;
  onConfirmar: (nome: string) => void;
  onCancelar: () => void;
}) {
  const [nome, setNome] = useState("");
  const podeConfirmar = nome.trim().length > 0;

  const handleConfirmar = () => {
    if (podeConfirmar) {
      onConfirmar(nome.trim());
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && podeConfirmar) {
      handleConfirmar();
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancelar(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Como podemos te chamar?</DialogTitle>
          <p className="text-sm text-muted-foreground">
            Vamos usar seu nome pra assinar os checklists.
          </p>
        </DialogHeader>
        <Input
          autoFocus
          placeholder="Ex.: João Silva"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <DialogFooter>
          <Button disabled={!podeConfirmar} onClick={handleConfirmar}>
            Entrar no checklist
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
