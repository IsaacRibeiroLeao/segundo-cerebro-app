import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { supabase } from "./supabase";
import { lerFila, ouvirFila } from "./fila";
import { COLUNAS_NOTA, type Conexao, type Nota } from "./types";

const CHAVE_CACHE = "sc_cache_v2";

export function useDados() {
  const [notas, setNotas] = useState<Nota[] | null>(null);
  const [conexoes, setConexoes] = useState<Conexao[]>([]);
  const [offline, setOffline] = useState(false);
  const [pendentes, setPendentes] = useState(0);

  const recarregar = useCallback(async () => {
    const fila = await lerFila();
    setPendentes(fila.length);
    const locais: Nota[] = fila.map((f) => ({
      local: true, id: f.id, conteudo: f.conteudo, referencias: f.referencias, tags: f.tags, tags_sugeridas: [],
      reflexao: null, reflexao_fontes: null, passagem_ia: null, processada_em: null, created_at: f.created_at, sc_nota_refs: [],
    }));
    const [n, c] = await Promise.all([
      supabase.from("sc_notas").select(COLUNAS_NOTA).order("created_at", { ascending: false }),
      supabase.from("sc_conexoes").select("id, a, b, tipo, peso, motivo"),
    ]);
    if (n.error) {
      // Sem conexão: mostra o que ficou guardado no aparelho.
      try {
        const bruto = await AsyncStorage.getItem(CHAVE_CACHE);
        const cache = bruto ? (JSON.parse(bruto) as { notas: Nota[]; conexoes: Conexao[] }) : { notas: [], conexoes: [] };
        setNotas([...locais, ...cache.notas.filter((x) => !locais.some((l) => l.id === x.id))]);
        setConexoes(cache.conexoes);
      } catch {
        setNotas(locais);
      }
      setOffline(true);
      return;
    }
    const lista = (n.data ?? []) as unknown as Nota[];
    const con = (c.data ?? []) as Conexao[];
    setOffline(false);
    setNotas([...locais.filter((l) => !lista.some((x) => x.id === l.id)), ...lista]);
    setConexoes(con);
    AsyncStorage.setItem(CHAVE_CACHE, JSON.stringify({ notas: lista, conexoes: con })).catch(() => undefined);
  }, []);

  useFocusEffect(
    useCallback(() => {
      recarregar();
    }, [recarregar]),
  );
  useEffect(() => ouvirFila(() => { recarregar(); }), [recarregar]);

  return { notas, conexoes, offline, pendentes, recarregar };
}

export function exportarMarkdown(notas: Nota[]) {
  return [...notas]
    .sort((a, b) => a.created_at.localeCompare(b.created_at))
    .map((n) => {
      const data = new Date(n.created_at).toLocaleDateString("pt-BR");
      const refs = n.sc_nota_refs.map((r) => (r.origem === "ia" ? `${r.rotulo} (sugerida)` : r.rotulo)).join(", ");
      const tags = n.tags.map((t) => `#${t}`).join(" ");
      return [`## ${data}${refs ? ` — ${refs}` : ""}`, tags, "", n.conteudo, n.reflexao ? `\n> Reflexão: ${n.reflexao}` : ""]
        .filter((l) => l !== "")
        .join("\n");
    })
    .join("\n\n---\n\n");
}
