/**
 * Permissões cargo → grupos da sidebar da prefeitura.
 * Defaults alinhados ao admin; mapa por município vem da API.
 */
import { useEffect, useState } from "react";
import { api } from "../api/client";
import { CARGOS } from "../funcionarios/cargos";

export const GRUPO_FROTA = "Gestão de Frota";
export const GRUPO_MANUTENCAO = "Manutenção";
export const GRUPO_PESSOAS = "Pessoas / RH";
export const GRUPO_ABASTECIMENTO = "Abastecimento";
export const GRUPO_QUALIDADE = "Qualidade e Segurança";

/** Grupos operacionais configuráveis no admin. */
export const GRUPOS_MENU = [
  GRUPO_ABASTECIMENTO,
  GRUPO_FROTA,
  GRUPO_MANUTENCAO,
  GRUPO_PESSOAS,
  GRUPO_QUALIDADE,
] as const;

export type GrupoMenu = (typeof GRUPOS_MENU)[number];

export type PorCargo = Record<string, string[]>;

export interface AcessoUsuario {
  perfil?: string;
  cargo?: string;
}

const GRUPOS_SEMPRE_LIBERADOS = new Set(["Principal", "Sistema"]);

/** Aliases de cargos antigos → chave canônica normalizada. */
const CARGO_ALIASES: Record<string, string> = {
  operador: "operador de manutenção",
  supervisor: "supervisor de rh",
};

export function normalizarCargo(v: string | undefined): string {
  const base = (v ?? "").trim().toLowerCase();
  if (!base) return "";
  return CARGO_ALIASES[base] ?? base;
}

export const DEFAULT_POR_CARGO: PorCargo = {
  "operador de manutenção": [GRUPO_MANUTENCAO],
  operador: [GRUPO_MANUTENCAO],
  mecânico: [GRUPO_MANUTENCAO],
  mecanico: [GRUPO_MANUTENCAO],
  motorista: [GRUPO_FROTA],
  comboista: [GRUPO_FROTA],
  "supervisor de rh": [GRUPO_PESSOAS],
  supervisor: [GRUPO_PESSOAS],
};

export function normalizarPorCargo(raw: unknown): PorCargo {
  if (!raw || typeof raw !== "object") return {};
  const out: PorCargo = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    const chave = normalizarCargo(k);
    if (!chave) continue;
    const grupos = Array.isArray(v)
      ? v.filter((g): g is string => typeof g === "string" && g.trim() !== "")
      : [];
    out[chave] = grupos;
  }
  return out;
}

export function resolverPorCargo(raw: PorCargo | undefined | null): PorCargo {
  return { ...DEFAULT_POR_CARGO, ...normalizarPorCargo(raw) };
}

/**
 * Matriz cargo × grupo para a UI do admin (só cargos oficiais, sem aliases).
 */
export function matrizCargosGrupos(mapa: PorCargo): Record<string, string[]> {
  const resolved = resolverPorCargo(mapa);
  const out: Record<string, string[]> = {};
  for (const cargo of CARGOS) {
    if (cargo === "Outro") {
      out[cargo] = [];
      continue;
    }
    const chave = normalizarCargo(cargo);
    out[cargo] = [...(resolved[chave] ?? [])];
  }
  return out;
}

export function gruposLiberadosDoCargo(
  cargo: string | undefined,
  mapa?: PorCargo,
): string[] {
  const chave = normalizarCargo(cargo);
  if (!chave) return [...GRUPOS_MENU];
  const resolved = resolverPorCargo(mapa);
  return resolved[chave] ?? [];
}

export function podeAcessarGrupo(
  groupLabel: string,
  acesso: AcessoUsuario | undefined,
  mapa?: PorCargo,
): boolean {
  if (GRUPOS_SEMPRE_LIBERADOS.has(groupLabel)) return true;

  const perfil = (acesso?.perfil ?? "").trim().toLowerCase();
  if (perfil === "admin") return true;

  const cargo = normalizarCargo(acesso?.cargo);
  if (!cargo) return true;

  const resolved = resolverPorCargo(mapa);
  const permitidos = resolved[cargo];
  if (!permitidos) return false;

  return permitidos.includes(groupLabel);
}

export const cargosPermissaoApi = {
  async obter(prefeituraId: string): Promise<PorCargo> {
    const r = await api.get<{ data: { porCargo?: PorCargo } }>(
      `/cargos-permissao/${prefeituraId}`,
    );
    return resolverPorCargo(r.data?.porCargo);
  },

  async salvar(prefeituraId: string, porCargo: PorCargo): Promise<PorCargo> {
    const r = await api.post<{ data: PorCargo }>("/cargos-permissao", {
      prefeituraId,
      porCargo: normalizarPorCargo(porCargo),
    });
    return resolverPorCargo(r.data);
  },
};

function chaveCache(prefeituraId: string) {
  return `hu360-cargos-perm:${prefeituraId}`;
}

function lerCache(prefeituraId: string): PorCargo | null {
  try {
    const raw = localStorage.getItem(chaveCache(prefeituraId));
    return raw ? (JSON.parse(raw) as PorCargo) : null;
  } catch {
    return null;
  }
}

function gravarCache(prefeituraId: string, mapa: PorCargo) {
  try {
    localStorage.setItem(chaveCache(prefeituraId), JSON.stringify(mapa));
  } catch {
    /* cota */
  }
}

/** Stale-while-revalidate do mapa cargo→grupos por município. */
export function useCargosPermissao(prefeituraId: string | undefined) {
  const [porCargo, setPorCargo] = useState<PorCargo>(() =>
    resolverPorCargo({}),
  );
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    let vivo = true;
    if (!prefeituraId) {
      setPorCargo(resolverPorCargo({}));
      setCarregando(false);
      return;
    }
    const cache = lerCache(prefeituraId);
    if (cache) {
      setPorCargo(resolverPorCargo(cache));
      setCarregando(false);
    } else {
      setPorCargo(resolverPorCargo({}));
      setCarregando(true);
    }
    cargosPermissaoApi
      .obter(prefeituraId)
      .then((mapa) => {
        gravarCache(prefeituraId, mapa);
        if (vivo) setPorCargo(mapa);
      })
      .catch(() => {
        /* offline: mantém cache/defaults */
      })
      .finally(() => {
        if (vivo) setCarregando(false);
      });
    return () => {
      vivo = false;
    };
  }, [prefeituraId]);

  return { porCargo, carregando, setPorCargo };
}
