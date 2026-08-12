import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

vi.mock('../hooks/access/use-checklist-login-config', () => ({
  useChecklistLoginConfig: () => ({
    cpfSenha: true,
    chassi: false,
    setCpfSenha: vi.fn(),
    setChassi: vi.fn(),
    salvar: vi.fn().mockResolvedValue({ ok: true }),
    carregando: false,
    salvando: false,
  }),
}));

import { CadastroConfigTab } from './CadastroConfigTab';

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('CadastroConfigTab', () => {
  it('renderiza os 2 toggles e o botão salvar', () => {
    render(<CadastroConfigTab clienteId="cli" />);
    expect(screen.getByLabelText(/CPF.*Senha/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/Chassi/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /salvar/i })).toBeEnabled();
  });
});
