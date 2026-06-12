/**
 * Prefetch do escopo do operador — torna o app realmente offline-first.
 *
 * O `persistentLocalCache` do Firestore só serve offline o que JÁ foi lido
 * online; ele não baixa coleções proativamente. Sem aquecer o cache, a busca
 * de chassi e a emergência falham sem rede (a query nunca foi cacheada).
 *
 * Aqui, com rede, disparamos as leituras do escopo do operador (a frota da
 * prefeitura + o doc do cliente). O SDK guarda no IndexedDB e passa a servir
 * tudo offline — sem banco local manual, sem fila de sync.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
} from "firebase/firestore";
import { db } from "../../lib/firebase/firebase";
import { funcionariosApi } from "../../lib/funcionarios/funcionarios";
import { provisionarCredenciaisPrefeitura } from "./credenciais-offline";

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/**
 * Aquece o cache offline com o escopo do operador e provisiona o login
 * offline da prefeitura. Com rede:
 * - baixa a frota da prefeitura → busca de chassi e emergência offline;
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
      getDocs(
        query(
          collection(db, "equipamentos"),
          where("prefeituraId", "==", prefeituraId),
        ),
      ),
      getDoc(doc(db, "clientes", prefeituraId)),
      funcionariosApi.listarCredenciaisOffline(prefeituraId),
    ]);
    provisionarCredenciaisPrefeitura(credenciais, empresa || prefeituraId);
  } catch {
    /* sem rede / indisponível — o cache fica como estava */
  }
}
