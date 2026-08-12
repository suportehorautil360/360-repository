import { renderHook, act } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useChecklistLoginConfig } from './use-checklist-login-config';
import { clientesApi } from '../../../../lib/api/clientes';

vi.mock('../../../../lib/api/clientes', () => ({
  clientesApi: {
    obter: vi.fn().mockResolvedValue({ id: 'cli', checklistLogin: { cpfSenha: true, chassi: false } }),
    atualizarChecklistLoginConfig: vi.fn().mockResolvedValue(undefined),
  },
}));

afterEach(() => vi.clearAllMocks());

/** Aguarda o useEffect de carga inicial terminar. */
async function waitForLoad() {
  await act(() => new Promise((r) => setTimeout(r, 0)));
}

describe('useChecklistLoginConfig', () => {
  it('carrega estado inicial do cliente', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await waitForLoad();
    expect(result.current.cpfSenha).toBe(true);
    expect(result.current.chassi).toBe(false);
  });

  it('salvar chama a API e retorna ok=true', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await waitForLoad();
    await act(async () => { result.current.setChassi(true); });
    const r = await act(() => result.current.salvar());
    expect(r).toEqual({ ok: true });
    expect(clientesApi.atualizarChecklistLoginConfig).toHaveBeenCalledWith('cli', { cpfSenha: true, chassi: true });
  });

  it('salvar com nenhum modo ativo retorna erro', async () => {
    const { result } = renderHook(() => useChecklistLoginConfig('cli'));
    await waitForLoad();
    await act(async () => { result.current.setCpfSenha(false); result.current.setChassi(false); });
    const r = await act(() => result.current.salvar());
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/pelo menos um/i);
  });
});
