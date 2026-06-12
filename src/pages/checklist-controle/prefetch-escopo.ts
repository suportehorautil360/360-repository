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

function online(): boolean {
  return typeof navigator === "undefined" || navigator.onLine;
}

/**
 * Aquece o cache offline com os dados que o operador precisa para começar um
 * checklist sem rede. Best-effort: nunca lança (offline ou erro só significa
 * que o cache não foi atualizado agora).
 */
export async function prefetchEscopoOperador(
  prefeituraId: string,
): Promise<void> {
  if (!prefeituraId || !online()) return;
  try {
    await Promise.all([
      // Toda a frota da prefeitura → busca de chassi e emergência offline.
      getDocs(
        query(
          collection(db, "equipamentos"),
          where("prefeituraId", "==", prefeituraId),
        ),
      ),
      // Nome do cliente → some o "Prefeitura" genérico offline.
      getDoc(doc(db, "clientes", prefeituraId)),
    ]);
  } catch {
    /* sem rede / indisponível — o cache fica como estava */
  }
}
