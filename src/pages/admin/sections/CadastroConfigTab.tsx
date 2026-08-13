import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { useChecklistLoginConfig } from '../hooks/access/use-checklist-login-config';

export function CadastroConfigTab({ clienteId }: { clienteId: string }) {
  const cfg = useChecklistLoginConfig(clienteId);
  const nenhum = !cfg.cpfSenha && !cfg.chassi;

  async function handleSalvar() {
    const r = await cfg.salvar();
    if (r.ok) toast.success('Configurações salvas');
    else toast.error(r.error ?? 'Erro ao salvar');
  }

  if (cfg.carregando) return <p className="p-4">Carregando…</p>;

  return (
    <section className="p-4 space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Login do Checklist</h3>
        <p className="text-sm text-muted-foreground">Quais modos os operadores podem usar pra entrar.</p>
      </div>

      <div className="flex items-start gap-3">
        <Switch id="cpfSenha" checked={cfg.cpfSenha} onCheckedChange={cfg.setCpfSenha} />
        <div>
          <label htmlFor="cpfSenha" className="font-medium">CPF / Login + Senha</label>
          <p className="text-sm text-muted-foreground">Operador cadastrado usa CPF ou login + senha.</p>
        </div>
      </div>

      <div className="flex items-start gap-3">
        <Switch id="chassi" checked={cfg.chassi} onCheckedChange={cfg.setChassi} />
        <div>
          <label htmlFor="chassi" className="font-medium">Chassi da máquina</label>
          <p className="text-sm text-muted-foreground">Qualquer pessoa entra digitando o chassi (pede o nome depois).</p>
        </div>
      </div>

      {nenhum && (
        <div role="alert" className="text-sm text-destructive">
          Pelo menos um modo precisa estar ativo — senão nenhum operador consegue logar.
        </div>
      )}

      <Button onClick={handleSalvar} disabled={nenhum || cfg.salvando}>
        {cfg.salvando ? 'Salvando…' : 'Salvar configurações'}
      </Button>
    </section>
  );
}
