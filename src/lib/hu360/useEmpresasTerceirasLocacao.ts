import { useCallback, useEffect, useState } from "react";
import type { EmpresaTerceiraLocacao } from "./types";
import { useHU360 } from "./useHU360";

export interface EmpresaTerceiraEntrada {
  nome: string;
  cnpj?: string;
  contato?: string;
  observacoes?: string;
}

function novoIdEmpresaTerceira(pid: string): string {
  return `emp-terc-${pid}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export interface UseEmpresasTerceirasLocacao {
  lista: EmpresaTerceiraLocacao[];
  adicionar: (entrada: EmpresaTerceiraEntrada) => { ok: boolean; msg: string };
  remover: (empresaId: string) => void;
}

export function useEmpresasTerceirasLocacao(
  prefeituraId: string | undefined,
  moduloRefreshKey?: number,
): UseEmpresasTerceirasLocacao {
  const { obterDadosPrefeitura, salvarDadosPrefeitura } = useHU360();
  const tick = moduloRefreshKey ?? 0;

  const [lista, setLista] = useState<EmpresaTerceiraLocacao[]>(() => {
    if (!prefeituraId) return [];
    const dados = obterDadosPrefeitura(prefeituraId);
    return dados.prefeituraModulo?.empresasTerceirasLocacao ?? [];
  });

  useEffect(() => {
    if (!prefeituraId) {
      setLista([]);
      return;
    }
    const dados = obterDadosPrefeitura(prefeituraId);
    setLista(dados.prefeituraModulo?.empresasTerceirasLocacao ?? []);
  }, [prefeituraId, obterDadosPrefeitura, tick]);

  const persistir = useCallback(
    (nova: EmpresaTerceiraLocacao[]) => {
      if (!prefeituraId) return;
      const dados = obterDadosPrefeitura(prefeituraId);
      const pm = { ...(dados.prefeituraModulo ?? {}) };
      pm.empresasTerceirasLocacao = nova;
      salvarDadosPrefeitura(prefeituraId, { ...dados, prefeituraModulo: pm });
      setLista(nova);
    },
    [prefeituraId, obterDadosPrefeitura, salvarDadosPrefeitura],
  );

  const adicionar = useCallback(
    (entrada: EmpresaTerceiraEntrada): { ok: boolean; msg: string } => {
      if (!prefeituraId) return { ok: false, msg: "Cliente não selecionado." };
      const nome = entrada.nome.trim();
      if (!nome) return { ok: false, msg: "Informe o nome da empresa." };
      const dupe = lista.some((x) => x.nome.trim().toLowerCase() === nome.toLowerCase());
      if (dupe) return { ok: false, msg: "Já existe uma empresa com esse nome." };
      const row: EmpresaTerceiraLocacao = {
        id: novoIdEmpresaTerceira(prefeituraId),
        nome,
        cnpj: entrada.cnpj?.trim() || undefined,
        contato: entrada.contato?.trim() || undefined,
        observacoes: entrada.observacoes?.trim() || undefined,
        criadoEm: new Date().toISOString().slice(0, 16).replace("T", " "),
      };
      persistir([...lista, row]);
      return { ok: true, msg: "Empresa cadastrada." };
    },
    [prefeituraId, lista, persistir],
  );

  const remover = useCallback(
    (empresaId: string) => {
      persistir(lista.filter((x) => x.id !== empresaId));
    },
    [lista, persistir],
  );

  return { lista, adicionar, remover };
}
