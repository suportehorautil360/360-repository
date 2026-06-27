/**
 * Prefetch do escopo do operador — torna o app realmente offline-first.
 *
 * Com rede, aquecemos o escopo do operador para o uso offline em campo:
 * - a FROTA vem do backend NestJS (escopada por prefeitura no servidor) e é
 *   gravada num cache local por prefeitura — a busca de chassi funciona offline
 *   sem nunca ter tocado equipamento de outra empresa;
 * - o doc do cliente é lido do Firestore (o `persistentLocalCache` passa a
 *   servir o nome da prefeitura offline).
 */
import { doc, getDoc } from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { provisionarCredenciaisPrefeitura } from "./credenciais-offline";
import { carregarFrotaOperador } from "./frota-operador";

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/**
 * Aquece o cache offline com o escopo do operador e provisiona o login
 * offline da prefeitura. Com rede:
 * - carrega a frota da prefeitura (NestJS) → busca de chassi offline;
 * - baixa o cliente → nome correto da prefeitura offline;
 * - baixa as credenciais da prefeitura → qualquer operador loga offline,
 *   inclusive na 1ª vez dele neste aparelho.
 * Best-effort: nunca lança (offline/erro só significa cache não atualizado).
 */
export async function prefetchEscopoOperador(
  prefeituraId: string,
  empresa = "",
): Promise<void> {
  if (!prefeituraId || !online()) return;
  try {
    const [, , credenciais] = await Promise.all([
      // Frota via NestJS (escopo no servidor) → grava o cache local p/ offline.
      carregarFrotaOperador(prefeituraId),
      getDoc(doc(db, "clientes", prefeituraId)),
      funcionariosApi.listarCredenciaisOffline(prefeituraId),
    ]);
    provisionarCredenciaisPrefeitura(credenciais, empresa || prefeituraId);
  } catch {
    /* sem rede / indisponível — o cache fica como estava */
  }
}
