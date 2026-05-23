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
// O 3º argumento ("default") é o id do banco nomeado deste projeto — sem ele o
// SDK aponta para o "(default)" inexistente e retorna 5 NOT_FOUND.
export const db = initializeFirestore(
  app,
  {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  import.meta.env.VITE_ENVIRONMENT === "production" ? "(default)" : "default",
);
export const storage = getStorage(app);
export default app;
