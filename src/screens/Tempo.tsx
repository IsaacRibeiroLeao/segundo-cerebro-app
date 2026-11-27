import { useEffect, useMemo, useState } from "react";
import { ScrollView, Switch, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { evolucao, formatarData, gerarRevisao } from "../lib/cerebro";
import { useDados } from "../lib/dados";
import { desligarLembrete, lembreteAtivo, ligarLembrete } from "../lib/lembrete";
import { type Abas, type Fonte, NOMES_LIVROS, passagemPrincipal, type Revisao } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao } from "../components/ui";
import { Vazio } from "../components/Vazio";
import { Entra, Pensando, Toque } from "../components/anim";
import { TextoComCitacoes } from "../components/Citacoes";
import { limparCitacoes } from "../lib/texto";

type Filtro = { tipo: "tag" | "livro"; valor: string | number } | null;
const mesAno = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "long", year: "numeric" });

export function Tempo() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const { notas } = useDados();
  const [aba, setAba] = useState<"notas" | "revisoes">("notas");
  const [filtro, setFiltro] = useState<Filtro>(null);
  const [evo, setEvo] = useState<{ texto: string; tema: string; fontes: Fonte[] } | null>(null);
  const [pensando, setPensando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [revisoes, setRevisoes] = useState<Revisao[] | null>(null);
  const [gerando, setGerando] = useState(false);
  const [lembrete, setLembrete] = useState(false);

  useEffect(() => { lembreteAtivo().then(setLembrete); }, []);
  useEffect(() => {
    if (aba !== "revisoes") return;
    supabase.from("sc_revisoes").select("id, inicio, fim, texto, created_at").order("created_at", { ascending: false }).then(({ data }) => setRevisoes((data ?? []) as Revisao[]));
  }, [aba]);

  const { tags, livros } = useMemo(() => {
    const t = new Map<string, number>();
    const l = new Map<number, number>();
    for (const n of notas ?? []) {
      for (const x of n.tags) t.set(x, (t.get(x) ?? 0) + 1);
      for (const r of new Set(n.sc_nota_refs.map((r) => r.livro))) l.set(r, (l.get(r) ?? 0) + 1);
    }
    return { tags: [...t.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([x]) => x), livros: [...l.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8).map(([x]) => x) };
  }, [notas]);

  const lista = useMemo(() => {
    const base = [...(notas ?? [])].filter((n) => !n.local).sort((a, b) => a.created_at.localeCompare(b.created_at));
    if (!filtro) return base;
    return base.filter((n) => (filtro.tipo === "tag" ? n.tags.includes(filtro.valor as string) : n.sc_nota_refs.some((r) => r.livro === filtro.valor)));
  }, [notas, filtro]);

  const grupos = useMemo(() => {
    const m = new Map<string, typeof lista>();
    for (const n of lista) { const k = mesAno(n.created_at); m.set(k, [...(m.get(k) ?? []), n]); }
    return [...m.entries()];
  }, [lista]);

  function escolher(f: Filtro) { setFiltro(f); setEvo(null); setErro(null); }

  async function contarEvolucao() {
    if (!filtro) return;
    setPensando(true); setErro(null);
    try { setEvo(await evolucao(filtro.tipo === "tag" ? { tag: filtro.valor as string } : { livro: filtro.valor as number })); } catch (e) { setErro((e as Error).message); }
    setPensando(false);
  }

  async function novaRevisao() {
    setGerando(true); setErro(null);
    try {
      const r = await gerarRevisao(7);
      setRevisoes((a) => [{ id: r.revisao.id ?? String(Date.now()), inicio: r.revisao.inicio, fim: r.revisao.fim, texto: r.revisao.texto, created_at: r.revisao.created_at ?? new Date().toISOString() }, ...(a ?? [])]);
    } catch (e) { setErro((e as Error).message); }
    setGerando(false);
  }

  async function alternarLembrete(v: boolean) {
    if (v) {
      const ok = await ligarLembrete();
      setLembrete(ok);
      if (!ok) setErro("To get the reminder, allow the app's notifications in your device settings.");
    } else {
      await desligarLembrete();
      setLembrete(false);
    }
  }

  const chip = (ativo: boolean) => ({ borderWidth: 1, borderColor: ativo ? c.accent : c.line, backgroundColor: ativo ? c.accent : "transparent", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }}>
        <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink }}>Timeline</Text>
        <Text style={{ color: c.muted, marginTop: 2 }}>See how each theme has grown over the months.</Text>

        <View style={{ flexDirection: "row", alignSelf: "flex-start", marginTop: 16, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 12, padding: 4 }}>
          {(["notas", "revisoes"] as const).map((a) => (
            <Toque key={a} onPress={() => setAba(a)} style={{ paddingHorizontal: 16, paddingVertical: 6, borderRadius: 9, backgroundColor: aba === a ? c.accent : "transparent" }}>
              <Text style={{ color: aba === a ? c.onAccent : c.muted }}>{a === "notas" ? "Notas" : "Reviews"}</Text>
            </Toque>
          ))}
        </View>

        {erro ? <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}><Text style={{ color: c.ink }}>{erro}</Text></Entra> : null}

        {aba === "notas" ? (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 14 }} contentContainerStyle={{ gap: 8 }}>
              <Toque onPress={() => escolher(null)} style={chip(!filtro)}><Text style={{ color: !filtro ? c.onAccent : c.muted }}>All</Text></Toque>
              {tags.map((t) => { const a = filtro?.tipo === "tag" && filtro.valor === t; return <Toque key={t} onPress={() => escolher({ tipo: "tag", valor: t })} style={chip(a)}><Text style={{ color: a ? c.onAccent : c.muted }}>#{t}</Text></Toque>; })}
              {livros.map((l) => { const a = filtro?.tipo === "livro" && filtro.valor === l; return <Toque key={l} onPress={() => escolher({ tipo: "livro", valor: l })} style={chip(a)}><Text style={{ color: a ? c.onAccent : c.muted }}>{NOMES_LIVROS[l]}</Text></Toque>; })}
            </ScrollView>

            {filtro && lista.length >= 2 && (
              <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                {pensando ? <Pensando texto="Tracing this theme's path" /> : evo ? (
                  <>
                    <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }}>HOW {evo.tema.toUpperCase()} EVOLVED</Text>
                    <TextoComCitacoes texto={evo.texto} fontes={evo.fontes} />
                  </>
                ) : (
                  <Toque onPress={contarEvolucao}><Text style={{ color: c.accent, fontWeight: "600" }}>How has this theme evolved? →</Text></Toque>
                )}
              </Entra>
            )}

            {!notas && <View style={{ marginTop: 24 }}><Pensando texto="Loading" /></View>}
            {notas && lista.length === 0 && <Vazio texto="No notes in this selection." />}

            <View style={{ marginTop: 22, marginLeft: 8, borderLeftWidth: 1, borderLeftColor: c.line, paddingLeft: 20 }}>
              {grupos.map(([mes, itens], gi) => (
                <View key={mes} style={{ marginBottom: 24 }}>
                  <Entra delay={gi * 60} style={{ flexDirection: "row", alignItems: "center", marginLeft: -29, marginBottom: 12, gap: 10 }}>
                    <View style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.accent, backgroundColor: c.paper }} />
                    <Text style={{ fontFamily: serif, fontSize: 18, color: c.ink, textTransform: "capitalize" }}>{mes}</Text>
                  </Entra>
                  {itens.map((n, i) => {
                    const p = passagemPrincipal(n);
                    return (
                      <Entra key={n.id} delay={gi * 60 + i * 40} style={{ marginBottom: 10 }}>
                        <Toque onPress={() => nav.navigate("Notas", { notaId: n.id })} style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                          <Text style={{ color: c.muted, fontSize: 12 }}>{formatarData(n.created_at)}{p ? ` · ${p.sugerida ? "✦ " : ""}${p.rotulo}` : ""}</Text>
                          <Text numberOfLines={3} style={{ color: c.ink, fontFamily: serif, fontSize: 16, marginTop: 4 }}>{n.conteudo}</Text>
                          {n.tags.length > 0 && <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>{n.tags.map((t) => `#${t}`).join("  ")}</Text>}
                        </Toque>
                      </Entra>
                    );
                  })}
                </View>
              ))}
            </View>
          </>
        ) : (
          <View style={{ marginTop: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 12 }}>
              <View style={{ flex: 1, paddingRight: 12 }}>
                <Text style={{ color: c.ink, fontWeight: "600" }}>Weekly reminder</Text>
                <Text style={{ color: c.muted, fontSize: 13 }}>Sunday at 6 pm, to do the review.</Text>
              </View>
              <Switch value={lembrete} onValueChange={alternarLembrete} trackColor={{ true: c.accent, false: c.line }} thumbColor={c.card} accessibilityLabel="Weekly review reminder" />
            </View>
            <Botao titulo="Generate review of the last 7 days" onPress={novaRevisao} carregando={gerando} estilo={{ marginTop: 14 }} />
            {gerando && <View style={{ marginTop: 12 }}><Pensando texto="Rereading your week" /></View>}
            {revisoes && revisoes.length === 0 && !gerando && <Vazio texto="No reviews yet." />}
            {(revisoes ?? []).map((r, i) => (
              <Entra key={r.id} delay={i * 50} style={{ marginTop: 12, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 16 }}>
                <Text style={{ color: c.muted, fontSize: 12 }}>{formatarData(r.inicio)} a {formatarData(r.fim)}</Text>
                <Text style={{ color: c.ink, fontSize: 16, lineHeight: 24, marginTop: 8 }}>{limparCitacoes(r.texto)}</Text>
              </Entra>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
