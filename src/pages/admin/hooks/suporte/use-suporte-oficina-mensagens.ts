import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "@/lib/firebase/firebase";
import type { MensagemSuporte, SuporteChannel } from "@/lib/api/suporte";

function mapDoc(id: string, raw: Record<string, unknown>): MensagemSuporte | null {
  const channel = raw.channel;
  const sender = raw.sender;
  const text = raw.text;
  const createdAt = raw.createdAt;

  if (
    (channel !== "financeiro" && channel !== "ti") ||
    (sender !== "user" && sender !== "support") ||
    typeof text !== "string" ||
    typeof createdAt !== "string"
  ) {
    return null;
  }

  return {
    id,
    oficinaId: typeof raw.oficinaId === "string" ? raw.oficinaId : undefined,
    channel,
    sender,
    text,
    createdAt,
    readAt:
      raw.readAt === null || typeof raw.readAt === "string"
        ? (raw.readAt as string | null)
        : undefined,
    adminReadAt:
      raw.adminReadAt === null || typeof raw.adminReadAt === "string"
        ? (raw.adminReadAt as string | null)
        : undefined,
    autoReply: raw.autoReply === true,
  };
}

/**
 * Atualiza o chat em tempo real via Firestore (sem polling HTTP).
 * Usado só com a thread aberta no admin.
 */
export function useSuporteOficinaMensagensRealtime(
  oficinaId: string | null,
  channel: SuporteChannel | null,
  enabled: boolean,
) {
  const [mensagens, setMensagens] = useState<MensagemSuporte[] | null>(null);
  const [erroRealtime, setErroRealtime] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !oficinaId || !channel) {
      setMensagens(null);
      setErroRealtime(null);
      return;
    }

    const q = query(
      collection(db, "suporteMensagens"),
      where("oficinaId", "==", oficinaId),
      where("channel", "==", channel),
    );

    const unsub = onSnapshot(
      q,
      (snap) => {
        const lista = snap.docs
          .map((doc) => mapDoc(doc.id, doc.data() as Record<string, unknown>))
          .filter((m): m is MensagemSuporte => m != null)
          .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
        setMensagens(lista);
        setErroRealtime(null);
      },
      (err) => {
        console.error("suporte oficina onSnapshot:", err);
        setErroRealtime(err.message);
      },
    );

    return () => unsub();
  }, [oficinaId, channel, enabled]);

  return { mensagens, erroRealtime };
}
