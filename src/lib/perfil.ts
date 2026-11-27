import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useSyncExternalStore } from "react";
import { supabase } from "./supabase";

export type Perfil = { nome: string | null; avatar: string | null };
const CHAVE = "sc_perfil_v1";

// Estado único compartilhado: trocar a foto atualiza todos os avatares ao mesmo tempo.
let estado: Perfil | null = null;
let carregando = false;
const ouvintes = new Set<() => void>();
const avisar = () => ouvintes.forEach((f) => f());

async function carregar() {
  if (carregando) return;
  carregando = true;
  try {
    const guardado = await AsyncStorage.getItem(CHAVE);
    if (guardado && !estado) { estado = JSON.parse(guardado) as Perfil; avisar(); }
  } catch { /* cache ilegível: segue para a rede */ }
  const { data, error } = await supabase.from("sc_perfil").select("nome, avatar").maybeSingle();
  if (!error) {
    estado = { nome: data?.nome ?? null, avatar: data?.avatar ?? null };
    AsyncStorage.setItem(CHAVE, JSON.stringify(estado)).catch(() => undefined);
    avisar();
  } else if (!estado) {
    estado = { nome: null, avatar: null };
    avisar();
  }
  carregando = false;
}

export async function limparPerfil() {
  estado = null;
  await AsyncStorage.removeItem(CHAVE).catch(() => undefined);
  avisar();
}

export function usePerfil() {
  const perfil = useSyncExternalStore(
    (f) => { ouvintes.add(f); return () => { ouvintes.delete(f); }; },
    () => estado,
  );
  useEffect(() => { if (!estado) carregar(); }, []);

  const salvar = useCallback(async (novo: Partial<Perfil>) => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw new Error("Session expired. Please sign in again.");
    const prox = { nome: estado?.nome ?? null, avatar: estado?.avatar ?? null, ...novo };
    const { error } = await supabase.from("sc_perfil").upsert({ user_id: u.user.id, ...prox, atualizado_em: new Date().toISOString() });
    if (error) throw new Error(error.message);
    estado = prox;
    AsyncStorage.setItem(CHAVE, JSON.stringify(prox)).catch(() => undefined);
    avisar();
  }, []);

  return { perfil, salvar };
}
