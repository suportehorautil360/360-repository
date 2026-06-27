import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from "firebase/firestore";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
// Persistência offline (PWA): mantém leituras em IndexedDB e enfileira escritas
// feitas offline, sincronizando ao voltar a internet. persistentMultipleTabManager
// permite o app aberto em várias abas compartilhando o mesmo cache.
// 3º argumento = id do banco Firestore. DEVE bater com o `FIREBASE_DATABASE_ID`
// do backend NO MESMO AMBIENTE, senão o front lê um banco diferente do que tem
// os dados (o login do operador — única auth que lê o Firestore direto do front
// — volta "não encontrado").
//   - homolog (horautil-homolog): banco nomeado "default"
//   - produção (horautil360):     banco padrão "(default)"
// Prefira o env EXPLÍCITO (VITE_FIREBASE_DATABASE_ID). O fallback pelo
// VITE_ENVIRONMENT existe só por compatibilidade — é frágil: se essa var não
// chega ao build, vira "default" silenciosamente e prod lê o banco errado.
// Atenção: vars VITE_* são embutidas NO BUILD; defina no Render antes de buildar.
const FIRESTORE_DB_ID =
  (import.meta.env.VITE_FIREBASE_DATABASE_ID as string | undefined) ||
  (import.meta.env.VITE_ENVIRONMENT === "production" ? "(default)" : "default");
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  FIRESTORE_DB_ID,
);
export const storage = getStorage(app);
export default app;
