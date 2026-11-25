import AsyncStorage from "@react-native-async-storage/async-storage";
import { supabase } from "./supabase";
import { processarNota } from "./cerebro";

// Notas escritas sem internet ficam aqui até a sincronização.
export type NotaPendente = { id: string; conteudo: string; referencias: string[]; tags: string[]; created_at: string };

const CHAVE_FILA = "sc_fila_v1";
const ouvintes = new Set<() => void>();
let sincronizando = false;

export function novoId() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (ch) => {
    const r = (Math.random() * 16) | 0;
    return (ch === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function ouvirFila(cb: () => void) {
  ouvintes.add(cb);
  return () => {
    ouvintes.delete(cb);
  };
}
const avisar = () => ouvintes.forEach((cb) => cb());

export async function lerFila(): Promise<NotaPendente[]> {
  try {
    const bruto = await AsyncStorage.getItem(CHAVE_FILA);
    return bruto ? (JSON.parse(bruto) as NotaPendente[]) : [];
  } catch {
    return [];
  }
}

async function gravarFila(f: NotaPendente[]) {
  await AsyncStorage.setItem(CHAVE_FILA, JSON.stringify(f));
  avisar();
}

export async function guardarNaFila(n: Omit<NotaPendente, "id" | "created_at">) {
  const nova: NotaPendente = { ...n, id: novoId(), created_at: new Date().toISOString() };
  await gravarFila([...(await lerFila()), nova]);
  return nova;
}

// Envia as notas pendentes (o id é gerado no aparelho, então reenviar não duplica).
export async function sincronizar(): Promise<{ enviadas: number; restantes: number }> {
  if (sincronizando) return { enviadas: 0, restantes: (await lerFila()).length };
  sincronizando = true;
  let enviadas = 0;
  try {
    const { data } = await supabase.auth.getSession();
    if (!data.session) return { enviadas: 0, restantes: (await lerFila()).length };
    for (const n of await lerFila()) {
      const { error } = await supabase
        .from("sc_notas")
        .upsert(
          { id: n.id, conteudo: n.conteudo, referencias: n.referencias, tags: n.tags, created_at: n.created_at },
          { onConflict: "id", ignoreDuplicates: true },
        );
      if (error) break; // sem rede ou erro: tenta de novo mais tarde
      await gravarFila((await lerFila()).filter((x) => x.id !== n.id));
      enviadas++;
      processarNota(n.id).catch(() => undefined); // se falhar, a análise é refeita depois
    }
  } finally {
    sincronizando = false;
  }
  return { enviadas, restantes: (await lerFila()).length };
}
