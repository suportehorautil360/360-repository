import { useEffect, useState } from 'react';
import { clientesApi } from '../../../../lib/api/clientes';

export function useChecklistLoginConfig(clienteId: string) {
  const [cpfSenha, setCpfSenha] = useState(true);
  const [chassi, setChassi] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    (async () => {
      setCarregando(true);
      try {
        const c = await clientesApi.obter(clienteId);
        setCpfSenha(c?.checklistLogin?.cpfSenha ?? true);
        setChassi(c?.checklistLogin?.chassi ?? false);
      } finally {
        setCarregando(false);
      }
    })();
  }, [clienteId]);

  async function salvar(): Promise<{ ok: boolean; error?: string }> {
    if (!cpfSenha && !chassi) {
      return { ok: false, error: 'Pelo menos um modo precisa estar ativo.' };
    }
    setSalvando(true);
    try {
      await clientesApi.atualizarChecklistLoginConfig(clienteId, { cpfSenha, chassi });
      return { ok: true };
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : 'Erro ao salvar.' };
    } finally {
      setSalvando(false);
    }
  }

  return { cpfSenha, chassi, setCpfSenha, setChassi, carregando, salvando, salvar };
}
