import { useEffect, useMemo, useRef, useState } from "react";
import { Alert, LayoutAnimation, FlatList, KeyboardAvoidingView, Platform, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { buscar, formatarData, parseLista, processarNota } from "../lib/cerebro";
import { exportarMarkdown, useDados } from "../lib/dados";
import type { Abas, Conexao, Nota, Reflexao } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { limparCitacoes } from "../lib/texto";
import { TextoComCitacoes } from "../components/Citacoes";
import { Vazio } from "../components/Vazio";
import { Entra, Pensando, Toque } from "../components/anim";
import { Icon } from "../components/Icon";
import { ListaConexoes } from "../components/Conexoes";
import { Passagem } from "../components/Passagem";
import { TagsSugeridas } from "../components/TagsSugeridas";

const ORIGEM: Record<Reflexao["origem"], string> = { auto: "On save", edicao: "After editing", manual: "Requested by you" };


function Cartao({ nota, notas, conexoes, aberta, destaque, indice, aoAlternar, aoAbrirOutra, aoApagar, recarregar }: {
  nota: Nota; notas: Nota[]; conexoes: Conexao[]; aberta: boolean; destaque: boolean; indice: number;
  aoAlternar: () => void; aoAbrirOutra: (id: string) => void; aoApagar: () => void; recarregar: () => Promise<void>;
}) {
  const c = useCores();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [ocupado, setOcupado] = useState<null | "salvando" | "refletindo">(null);
  const [erro, setErro] = useState<string | null>(null);
  const [versoes, setVersoes] = useState<Reflexao[] | null>(null);

  const nConexoes = conexoes.filter((x) => x.a === nota.id || x.b === nota.id).length;
  const refsIa = nota.sc_nota_refs.filter((r) => r.origem === "ia");
  const refsUsuario = nota.sc_nota_refs.filter((r) => r.origem === "usuario");

  // Os campos são preenchidos ao abrir a edição, com o que a nota tem agora (tags confirmadas inclusive).
  function abrirEdicao() {
    setTexto(nota.conteudo);
    setRefs(nota.referencias.join(", "));
    setTags(nota.tags.join(", "));
    setEditando(true);
  }

  async function carregarVersoes() {
    const { data } = await supabase.from("sc_reflexoes").select("id, texto, origem, created_at, fontes").eq("nota_id", nota.id).order("created_at", { ascending: false });
    setVersoes((data ?? []) as Reflexao[]);
  }

  async function salvarEdicao() {
    if (!texto.trim()) return;
    setErro(null);
    setOcupado("salvando");
    const { error } = await supabase.from("sc_notas")
      .update({ conteudo: texto.trim(), referencias: parseLista(refs), tags: parseLista(tags, true), processada_em: null }).eq("id", nota.id);
    if (error) { setErro(error.message); setOcupado(null); return; }
    setEditando(false);
    setOcupado("refletindo");
    try { await processarNota(nota.id, "edicao"); } catch (e) { setErro(`Changes saved, but the new reflection failed: ${(e as Error).message}`); }
    setVersoes(null);
    await recarregar();
    setOcupado(null);
  }

  async function novaReflexao() {
    setErro(null);
    setOcupado("refletindo");
    try { await processarNota(nota.id, "manual"); setVersoes(null); } catch (e) { setErro((e as Error).message); }
    await recarregar();
    setOcupado(null);
  }

  function apagar() {
    Alert.alert("Delete this note?", "You'll have a few seconds to undo.", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: aoApagar },
    ]);
  }

  const rotulo = (t: string) => <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 6 }}>{t.toUpperCase()}</Text>;

  return (
    <Entra delay={Math.min(indice, 8) * 40} style={{ marginBottom: 12 }}>
      <View style={{ backgroundColor: c.card, borderRadius: 16, borderWidth: destaque ? 2 : 1, borderColor: destaque ? c.accent : c.line }}>
        <Toque onPress={aoAlternar} accessibilityRole="button" accessibilityState={{ expanded: aberta }} style={{ padding: 14 }}>
          <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 6 }}>
            <Text style={{ color: c.muted, fontSize: 12 }}>{formatarData(nota.created_at)}</Text>
            {refsUsuario.map((r) => <Text key={r.rotulo} style={{ color: c.accent, backgroundColor: c.accentSoft, fontSize: 12, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, overflow: "hidden" }}>{r.rotulo}</Text>)}
            {refsIa.map((r) => <Text key={r.rotulo} style={{ color: c.sage, borderColor: c.sage, borderWidth: 1, borderStyle: "dashed", fontSize: 12, paddingHorizontal: 8, paddingVertical: 1, borderRadius: 999 }}>✦ {r.rotulo}</Text>)}
            {nota.local ? <Text style={{ color: c.muted, fontSize: 12 }}>· aguardando envio</Text> : nConexoes > 0 ? <Text style={{ color: c.muted, fontSize: 12, marginLeft: "auto" }}>{nConexoes} {nConexoes === 1 ? "connection" : "connections"}</Text> : null}
          </View>
          <Text numberOfLines={aberta ? undefined : 3} style={{ marginTop: 8, color: c.ink, fontFamily: serif, fontSize: 16, lineHeight: 24 }}>{nota.conteudo}</Text>
          {nota.tags.length > 0 && <Text style={{ marginTop: 8, color: c.muted, fontSize: 12 }}>{nota.tags.map((t) => `#${t}`).join("  ")}</Text>}
        </Toque>

        {aberta && !nota.local && (
          <Entra style={{ borderTopWidth: 1, borderTopColor: c.line, padding: 14, gap: 18 }}>
            {editando ? (
              <View style={{ gap: 8 }}>
                <Campo multiline value={texto} onChangeText={setTexto} style={{ minHeight: 110, textAlignVertical: "top", fontFamily: serif, fontSize: 16 }} />
                <Campo value={refs} onChangeText={setRefs} placeholder="Passage (optional)" />
                <Campo value={tags} onChangeText={setTags} placeholder="Tags" />
                <Botao titulo="Save and redo reflection" onPress={salvarEdicao} carregando={ocupado === "salvando"} desabilitado={!texto.trim() || ocupado !== null} />
                <Toque onPress={() => setEditando(false)} style={{ alignItems: "center", padding: 8 }}><Text style={{ color: c.muted }}>Cancel</Text></Toque>
              </View>
            ) : (
              <>
                {(refsUsuario.length > 0 || refsIa.length > 0) && (
                  <View>
                    {rotulo("Passage and context")}
                    <View style={{ gap: 8 }}>
                      {refsUsuario.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} />)}
                      {refsIa.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} sugerida motivo={nota.passagem_ia?.motivo} />)}
                    </View>
                  </View>
                )}
                <TagsSugeridas nota={nota} aoMudar={recarregar} />
                <View>
                  {rotulo("Reflection")}
                  {ocupado === "refletindo" ? <Pensando texto="Thinking again about this note" /> : (
                    nota.reflexao && nota.reflexao_fontes?.length
                      ? <TextoComCitacoes texto={nota.reflexao} fontes={nota.reflexao_fontes} />
                      : <Text style={{ color: nota.reflexao ? c.ink : c.muted, fontSize: 15, lineHeight: 23 }}>{nota.reflexao ? limparCitacoes(nota.reflexao) : "No reflection yet."}</Text>
                  )}
                  <View style={{ flexDirection: "row", gap: 18, marginTop: 10 }}>
                    <Toque onPress={novaReflexao} disabled={ocupado !== null} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                      <Icon nome="refazer" cor={c.accent} tamanho={16} /><Text style={{ color: c.accent }}>Generate new reflection</Text>
                    </Toque>
                    <Toque onPress={() => (versoes ? setVersoes(null) : carregarVersoes())}><Text style={{ color: c.muted }}>{versoes ? "Hide versions" : "See versions"}</Text></Toque>
                  </View>
                  {versoes && (
                    <Entra style={{ marginTop: 10, gap: 8 }}>
                      {versoes.length === 0 && <Text style={{ color: c.muted }}>No saved versions yet.</Text>}
                      {versoes.map((v, i) => (
                        <View key={v.id} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.paper, borderRadius: 12, padding: 10 }}>
                          <Text style={{ color: c.muted, fontSize: 12 }}>{i === 0 ? "Current · " : ""}{ORIGEM[v.origem]} · {formatarData(v.created_at)}</Text>
                          {v.fontes?.length ? <TextoComCitacoes texto={v.texto} fontes={v.fontes} /> : <Text style={{ color: c.ink, marginTop: 4, lineHeight: 21 }}>{limparCitacoes(v.texto)}</Text>}
                        </View>
                      ))}
                    </Entra>
                  )}
                </View>
                <View>
                  {rotulo("Why it's linked to other notes")}
                  <ListaConexoes notaId={nota.id} conexoes={conexoes} notas={notas} aoAbrir={aoAbrirOutra} />
                </View>
                <View style={{ flexDirection: "row", gap: 22, borderTopWidth: 1, borderTopColor: c.line, paddingTop: 12 }}>
                  <Toque onPress={abrirEdicao} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Icon nome="editar" cor={c.muted} tamanho={16} /><Text style={{ color: c.muted }}>Edit</Text></Toque>
                  <Toque onPress={apagar} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}><Icon nome="apagar" cor={c.muted} tamanho={16} /><Text style={{ color: c.muted }}>Delete</Text></Toque>
                </View>
              </>
            )}
            {erro ? <Text style={{ color: c.ink, backgroundColor: c.accentSoft, padding: 10, borderRadius: 10 }}>{erro}</Text> : null}
          </Entra>
        )}
      </View>
    </Entra>
  );
}

export function Notas() {
  const c = useCores();
  const rota = useRoute<RouteProp<Abas, "Notas">>();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const { notas, conexoes, offline, recarregar } = useDados();
  const [busca, setBusca] = useState("");
  const [achados, setAchados] = useState<{ ids: string[]; semantica: boolean } | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [tag, setTag] = useState<string | null>(null);
  const [aberta, setAberta] = useState<string | null>(null);
  const [destaque, setDestaque] = useState<string | null>(null);
  const lista$ = useRef<FlatList<Nota>>(null);
  const notasRef = useRef<Nota[] | null>(null);
  useEffect(() => { notasRef.current = notas; }, [notas]);

  // Apagar com desfazer: a nota some da lista na hora e só é apagada de verdade depois de 6 s.
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());
  const [desfazer, setDesfazer] = useState<string | null>(null);
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const recarregarRef = useRef(recarregar);
  useEffect(() => { recarregarRef.current = recarregar; }, [recarregar]);

  async function apagarDeVez(id: string) {
    timers.current.delete(id);
    const { error } = await supabase.from("sc_notas").delete().eq("id", id);
    if (error) Alert.alert("Couldn't delete", error.message);
    setOcultas((o) => { const n = new Set(o); n.delete(id); return n; });
    setDesfazer((d) => (d === id ? null : d));
    await recarregarRef.current();
  }
  function agendarExclusao(id: string) {
    setOcultas((o) => new Set(o).add(id));
    setDesfazer(id);
    timers.current.set(id, setTimeout(() => { apagarDeVez(id); }, 6000));
  }
  function desfazerExclusao(id: string) {
    const t = timers.current.get(id);
    if (t) clearTimeout(t);
    timers.current.delete(id);
    setOcultas((o) => { const n = new Set(o); n.delete(id); return n; });
    setDesfazer(null);
  }

  useEffect(() => {
    const q = busca.trim();
    if (q.length < 2) { setAchados(null); return; }
    const t = setTimeout(async () => {
      setBuscando(true);
      try {
        const r = await buscar(q);
        setAchados({ ids: r.resultados.map((x) => x.id), semantica: r.semantica });
      } catch {
        const min = q.toLowerCase();
        setAchados({ ids: (notasRef.current ?? []).filter((n) => n.conteudo.toLowerCase().includes(min)).map((n) => n.id), semantica: false });
      }
      setBuscando(false);
    }, 600);
    return () => clearTimeout(t);
  }, [busca]);

  const todasTags = useMemo(() => {
    const f = new Map<string, number>();
    for (const n of notas ?? []) for (const t of n.tags) f.set(t, (f.get(t) ?? 0) + 1);
    return [...f.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [notas]);

  const lista = useMemo(() => {
    let base = (notas ?? []).filter((n) => !ocultas.has(n.id));
    if (achados) {
      const ordem = new Map(achados.ids.map((id, i) => [id, i]));
      base = base.filter((n) => ordem.has(n.id)).sort((a, b) => ordem.get(a.id)! - ordem.get(b.id)!);
    }
    return tag ? base.filter((n) => n.tags.includes(tag)) : base;
  }, [notas, achados, tag, ocultas]);

  // Abre a nota pedida por outra tela.
  const alvo = rota.params?.notaId;
  useEffect(() => {
    if (!alvo || !notas) return;
    setBusca(""); setTag(null); setAberta(alvo); setDestaque(alvo);
    const i = notas.findIndex((n) => n.id === alvo);
    if (i >= 0) setTimeout(() => lista$.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.1 }), 250);
    const t = setTimeout(() => setDestaque(null), 2500);
    nav.setParams({ notaId: undefined });
    return () => clearTimeout(t);
  }, [alvo, notas, nav]);

  function abrirOutra(id: string) {
    setBusca(""); setTag(null); setAberta(id); setDestaque(id);
    const i = (notas ?? []).findIndex((n) => n.id === id);
    if (i >= 0) setTimeout(() => lista$.current?.scrollToIndex({ index: i, animated: true, viewPosition: 0.1 }), 200);
    setTimeout(() => setDestaque(null), 2500);
  }

  const chip = (ativo: boolean) => ({ borderWidth: 1, borderColor: ativo ? c.accent : c.line, backgroundColor: ativo ? c.accent : "transparent", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 });

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <FlatList
          ref={lista$}
          data={lista}
          keyExtractor={(n) => n.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ padding: 20, paddingBottom: 110 }}
          onScrollToIndexFailed={(info) => setTimeout(() => lista$.current?.scrollToOffset({ offset: info.averageItemLength * info.index, animated: true }), 100)}
          ListHeaderComponent={
            <View style={{ marginBottom: 14 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink }}>Notes</Text>
                <Toque disabled={!notas?.length} onPress={() => Share.share({ message: exportarMarkdown((notas ?? []).filter((n) => !n.local)), title: "Second Brain" })} style={{ flexDirection: "row", gap: 6, alignItems: "center" }}>
                  <Icon nome="baixar" cor={c.muted} tamanho={16} /><Text style={{ color: c.muted }}>Export</Text>
                </Toque>
              </View>
              {offline && <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>Offline: showing what's saved on your device.</Text>}
              <Campo value={busca} onChangeText={setBusca} placeholder="Search by word or by idea…" estilo={{ marginTop: 12 }} />
              {buscando && <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>searching…</Text>}
              {achados && !achados.semantica && <Text style={{ color: c.muted, fontSize: 12, marginTop: 6 }}>Searching by words only for now (search by meaning is unavailable at the moment).</Text>}
              {todasTags.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 10 }} contentContainerStyle={{ gap: 8 }}>
                  {todasTags.map((t) => (
                    <Toque key={t} onPress={() => setTag(tag === t ? null : t)} style={chip(tag === t)}><Text style={{ color: tag === t ? c.onAccent : c.muted }}>#{t}</Text></Toque>
                  ))}
                </ScrollView>
              )}
              {!notas && <View style={{ marginTop: 24 }}><Pensando texto="Loading" /></View>}
            </View>
          }
          ListEmptyComponent={notas ? <Vazio texto={notas.length === 0 ? "You haven't written any notes yet." : "Nothing found."} /> : undefined}
          renderItem={({ item, index }) => (
            <Cartao nota={item} notas={notas ?? []} conexoes={conexoes} indice={index} aberta={aberta === item.id} destaque={destaque === item.id}
              aoAlternar={() => { LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut); setAberta(aberta === item.id ? null : item.id); }} aoAbrirOutra={abrirOutra} aoApagar={() => agendarExclusao(item.id)} recarregar={recarregar} />
          )}
        />
      </KeyboardAvoidingView>
      {desfazer && (
        <View style={{ position: "absolute", left: 20, right: 20, bottom: 92, flexDirection: "row", justifyContent: "space-between", alignItems: "center", backgroundColor: c.ink, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 }}>
          <Text style={{ color: c.paper }}>Note deleted.</Text>
          <Toque onPress={() => desfazerExclusao(desfazer)}><Text style={{ color: c.accentSoft, fontWeight: "700" }}>Undo</Text></Toque>
        </View>
      )}
    </SafeAreaView>
  );
}
