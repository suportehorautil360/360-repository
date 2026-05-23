// Cria um usuário na coleção `users` do Firestore, compatível com o login do app.
//
// Uso:
//   node scripts/criar-usuario.mjs --usuario admin --senha 1234 --type admin --nome "Administrador"
//
// Flags:
//   --usuario      (obrigatório) login digitado na tela
//   --senha        (obrigatório) senha em texto puro; é gravada em hash SHA-256
//   --type         admin | prefeitura | posto | oficina | locacao   (padrão: admin)
//   --nome         nome de exibição                                  (padrão: igual a --usuario)
//   --prefeituraId id do cliente vinculado (obrigatório p/ prefeitura/posto/oficina/locacao)
//   --postoId      opcional
//   --officinaId   opcional
//
// Lê as credenciais do Firebase do arquivo .env (mesmas VITE_FIREBASE_*).

import { readFileSync } from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { initializeApp } from "firebase/app";
import {
  getFirestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
} from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, "..");

// --- parse do .env (apenas as chaves VITE_FIREBASE_*) ---
function loadEnv() {
  const env = {};
  const raw = readFileSync(resolve(rootDir, ".env"), "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  }
  return env;
}

// --- parse dos argumentos --flag valor ---
function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    if (argv[i].startsWith("--")) {
      const key = argv[i].slice(2);
      const val = argv[i + 1]?.startsWith("--") ? "" : argv[++i];
      args[key] = val ?? "";
    }
  }
  return args;
}

// Mesmo algoritmo de src/utils/hashSenha.ts (SHA-256 em hex).
function hashSenha(senha) {
  return createHash("sha256").update(senha, "utf8").digest("hex");
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const usuario = (args.usuario || "").trim();
  const senha = (args.senha || "").trim();
  const type = (args.type || "admin").trim();
  const nome = (args.nome || usuario).trim();

  if (!usuario || !senha) {
    console.error("ERRO: --usuario e --senha são obrigatórios.");
    process.exit(1);
  }
  const tiposValidos = ["admin", "prefeitura", "posto", "oficina", "locacao"];
  if (!tiposValidos.includes(type)) {
    console.error(`ERRO: --type inválido. Use um de: ${tiposValidos.join(", ")}`);
    process.exit(1);
  }
  if (type !== "admin" && !args.prefeituraId) {
    console.error(
      `ERRO: --prefeituraId é obrigatório para type="${type}" (o login redireciona usando esse id).`,
    );
    process.exit(1);
  }

  const env = loadEnv();
  const firebaseConfig = {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: env.VITE_FIREBASE_APP_ID,
  };

  const app = initializeApp(firebaseConfig);
  // Banco nomeado "default" (não o "(default)" padrão do SDK).
  const db = getFirestore(app, "default");

  console.log(`Projeto Firebase: ${firebaseConfig.projectId}`);

  // Evita login duplicado, igual ao app faz.
  const dup = await getDocs(
    query(collection(db, "users"), where("usuario", "==", usuario)),
  );
  if (!dup.empty) {
    console.error(`ERRO: já existe um usuário com o login "${usuario}".`);
    process.exit(1);
  }

  const docData = {
    nome,
    usuario,
    senha: hashSenha(senha),
    perfil: type === "admin" ? "admin" : "gestor",
    type,
    vinculo: type,
    ...(args.prefeituraId ? { prefeituraId: args.prefeituraId } : {}),
    ...(args.postoId ? { postoId: args.postoId } : {}),
    ...(args.officinaId ? { officinaId: args.officinaId } : {}),
    id: randomUUID(),
    createdAt: new Date().toISOString(),
  };

  const ref = await addDoc(collection(db, "users"), docData);

  console.log("\n✅ Usuário criado com sucesso!");
  console.log(`   doc id   : ${ref.id}`);
  console.log(`   usuario  : ${usuario}`);
  console.log(`   senha    : ${senha}  (digite essa na tela de login)`);
  console.log(`   type     : ${type}`);
  console.log("\nLembrete: o login usa o campo 'usuario', não e-mail.");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nFalha ao criar usuário:", err?.message || err);
  console.error(
    "\nSe o erro for de permissão (PERMISSION_DENIED), as Security Rules do Firestore",
    "estão bloqueando escrita na coleção 'users'. Nesse caso, crie o usuário pelo Console.",
  );
  process.exit(1);
});
