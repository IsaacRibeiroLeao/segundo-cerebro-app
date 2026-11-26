import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useMemo, useState } from "react";
import { Modal, ScrollView, Share, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { capitulo as buscarCapitulo } from "../lib/cerebro";
import { useDados } from "../lib/dados";
import { useLeitura } from "../lib/leitura";
import { CAPITULOS, NOMES_LIVROS, TOTAL_CAPITULOS, proximoNaoLido, vizinho } from "../lib/livros";
import type { Abas, Versiculos } from "../lib/types";
import { serif, useCores } from "../theme";
import { Entra, Pensando, Toque } from "../components/anim";
import { CORES_GRIFO, useGrifos, type CorGrifo } from "../lib/grifos";

const PRIMEIRO_NT = 39;
const POS = "sc_biblia_pos_v1";
type Pos = { livro: number; capitulo: number };

export function Biblia() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const [pos, setPos] = useState<Pos | null>(null);
  const [texto, setTexto] = useState<Versiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [selecionados, setSelecionados] = useState<Set<number>>(new Set());
  const [escolhendo, setEscolhendo] = useState(false);
  const { notas } = useDados();
  const { lidos, alternar, erro: erroLeitura } = useLeitura();
  const { grifos, grifar, remover, erro: erroGrifo } = useGrifos(pos?.livro ?? 0, pos?.capitulo ?? 1);
  const [cor, setCor] = useState<CorGrifo>("ouro");

  useEffect(() => {
    AsyncStorage.getItem(POS).then((b) => {
      try {
        const p = b ? JSON.parse(b) : null;
        if (p && Number.isInteger(p.livro) && p.livro >= 0 && p.livro < CAPITULOS.length && p.capitulo >= 1 && p.capitulo <= CAPITULOS[p.livro]) { setPos(p); return; }
      } catch { /* posição ilegível */ }
      setPos({ livro: 0, capitulo: 1 });
    }).catch(() => setPos({ livro: 0, capitulo: 1 }));
  }, []);

  useEffect(() => {
    if (!pos) return;
    AsyncStorage.setItem(POS, JSON.stringify(pos)).catch(() => undefined);
    let vivo = true;
    setTexto(null); setErro(null); setSelecionados(new Set());
    buscarCapitulo(pos.livro, pos.capitulo)
      .then((t) => { if (vivo) setTexto(t); })
      .catch((e) => { if (vivo) setErro((e as Error).message); });
    return () => { vivo = false; };
  }, [pos]);

  const porLivro = useMemo(() => {
    const cont = new Array(CAPITULOS.length).fill(0) as number[];
    for (const k of lidos ?? []) cont[Number(k.split(":")[0])]++;
    return cont;
  }, [lidos]);
  const totalLidos = porLivro.reduce((s, n) => s + n, 0);
  const proximo = lidos ? proximoNaoLido(lidos) : null;

  const doCapitulo = useMemo(
    () => pos ? (notas ?? []).filter((n) => n.sc_nota_refs.some((r) => r.livro === pos.livro && r.capitulo === pos.capitulo)) : [],
    [notas, pos],
  );

  if (!pos) return <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }} />;

  const lido = lidos?.has(`${pos.livro}:${pos.capitulo}`) ?? false;
  const anterior = vizinho(pos.livro, pos.capitulo, -1);
  const seguinte = vizinho(pos.livro, pos.capitulo, 1);
  const nomeCap = `${NOMES_LIVROS[pos.livro]} ${pos.capitulo}`;

  function rotuloSelecao() {
    const v = [...selecionados].sort((a, b) => a - b);
    if (!v.length) return nomeCap;
    return v.length === 1 || v[v.length - 1] - v[0] === v.length - 1
      ? `${nomeCap}:${v[0]}${v.length > 1 ? `-${v[v.length - 1]}` : ""}`
      : `${nomeCap}:${v.join(",")}`;
  }
  const alternarVerso = (n: number) => setSelecionados((s) => { const x = new Set(s); if (x.has(n)) x.delete(n); else x.add(n); return x; });
  const botao = { borderWidth: 1, borderColor: c.line, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 } as const;

  const sel = [...selecionados];
  const todosGrifados = sel.length > 0 && sel.every((n) => grifos.has(n));
  async function aplicarGrifo() {
    if (todosGrifados) await remover(sel); else await grifar(sel, cor);
    setSelecionados(new Set());
  }
  function compartilhar() {
    const ver = texto?.versiculos.filter((v) => !selecionados.size || selecionados.has(v.n)) ?? [];
    Share.share({ message: `${ver.map((v) => `${v.n} ${v.texto}`).join(" ")}\n— ${rotuloSelecao()}` }).catch(() => undefined);
  }
  const novoTest = pos.livro >= PRIMEIRO_NT;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: selecionados.size ? 230 : 140 }}>
        <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink }}>Bíblia</Text>

        <View style={{ flexDirection: "row", alignSelf: "flex-start", marginTop: 14, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 4 }}>
          {([["Antigo Testamento", false], ["Novo Testamento", true]] as const).map(([nome, nt]) => {
            const ativo = novoTest === nt;
            return (
              <Toque key={nome} onPress={() => !ativo && setPos({ livro: nt ? PRIMEIRO_NT : 0, capitulo: 1 })}
                style={{ borderRadius: 12, paddingHorizontal: 12, paddingVertical: 7, backgroundColor: ativo ? c.accent : "transparent" }}>
                <Text style={{ fontSize: 13, fontWeight: ativo ? "700" : "500", color: ativo ? c.onAccent : c.muted }}>{nome}</Text>
              </Toque>
            );
          })}
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 12 }}>
          <Toque onPress={() => setEscolhendo(true)} style={[botao, { flex: 1, backgroundColor: c.card }]}>
            <Text style={{ color: c.ink, fontWeight: "600" }}>{nomeCap}  ▾</Text>
          </Toque>
          <Toque disabled={!anterior} onPress={() => anterior && setPos(anterior)} accessibilityLabel="Capítulo anterior" style={[botao, { opacity: anterior ? 1 : 0.3 }]}><Text style={{ color: c.ink }}>←</Text></Toque>
          <Toque disabled={!seguinte} onPress={() => seguinte && setPos(seguinte)} accessibilityLabel="Próximo capítulo" style={[botao, { opacity: seguinte ? 1 : 0.3 }]}><Text style={{ color: c.ink }}>→</Text></Toque>
        </View>

        <Text style={{ textAlign: "center", marginTop: 26, color: c.muted, fontSize: 12, letterSpacing: 2 }}>{NOMES_LIVROS[pos.livro].toUpperCase()}</Text>
        <Text style={{ textAlign: "center", fontFamily: serif, fontSize: 52, color: c.accent, lineHeight: 60 }}>{pos.capitulo}</Text>

        {!texto && !erro && <View style={{ marginTop: 24 }}><Pensando texto="Carregando" /></View>}
        {erro && <Text style={{ marginTop: 16, backgroundColor: c.accentSoft, color: c.ink, padding: 12, borderRadius: 12 }}>{erro}</Text>}
        {texto && (
          <Entra key={nomeCap} style={{ marginTop: 18 }}>
            <Text style={{ fontFamily: serif, fontSize: 19, lineHeight: 33, color: c.ink }}>
              {texto.versiculos.map((v) => {
                const g = grifos.get(v.n);
                const on = selecionados.has(v.n);
                return (
                  <Text key={v.n} onPress={() => alternarVerso(v.n)}
                    style={{ backgroundColor: on ? c.accentSoft : g ? CORES_GRIFO[g] : "transparent", textDecorationLine: on ? "underline" : "none", textDecorationColor: c.accent }}>
                    <Text style={{ color: c.accent, fontSize: 11, fontWeight: "700" }}>{v.n}{"\u00A0"}</Text>{v.texto}{" "}
                  </Text>
                );
              })}
            </Text>
            {!selecionados.size && <Text style={{ textAlign: "center", color: c.muted, fontSize: 12, marginTop: 18 }}>Toque num versículo para grifar, anotar ou compartilhar.</Text>}
          </Entra>
        )}

        <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 10, marginTop: 24 }}>
          <Toque disabled={!lidos} onPress={() => alternar(pos.livro, pos.capitulo)}
            style={{ borderRadius: 12, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: lido ? "transparent" : c.accent, borderWidth: 1, borderColor: c.accent }}>
            <Text style={{ color: lido ? c.accent : c.onAccent, fontWeight: "600" }}>{lido ? "✓ Capítulo lido" : "Marcar como lido"}</Text>
          </Toque>
          {seguinte && <Toque onPress={() => setPos(seguinte)} style={[botao, { paddingVertical: 11 }]}><Text style={{ color: c.ink }}>Próximo capítulo →</Text></Toque>}
        </View>
        {(erroLeitura || erroGrifo) && <Text style={{ color: c.muted, fontSize: 12, marginTop: 8, textAlign: "center" }}>Não consegui salvar: {erroGrifo ?? erroLeitura}</Text>}

        {doCapitulo.length > 0 && (
          <View style={{ marginTop: 26 }}>
            <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8, marginBottom: 8 }}>SUAS NOTAS NESTE CAPÍTULO</Text>
            {doCapitulo.map((n) => (
              <Toque key={n.id} onPress={() => nav.navigate("Notas", { notaId: n.id })} style={{ backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12, marginBottom: 8 }}>
                <Text numberOfLines={2} style={{ fontFamily: serif, color: c.ink }}>{n.conteudo}</Text>
              </Toque>
            ))}
          </View>
        )}

        <View style={{ marginTop: 30, backgroundColor: c.card, borderWidth: 1, borderColor: c.line, borderRadius: 16, padding: 16 }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
            <Text style={{ fontFamily: serif, fontSize: 20, color: c.ink }}>Seu progresso</Text>
            <Text style={{ color: c.muted, fontSize: 13 }}>{totalLidos} de {TOTAL_CAPITULOS} capítulos</Text>
          </View>
          <View style={{ height: 8, borderRadius: 999, backgroundColor: c.accentSoft, marginTop: 12, overflow: "hidden" }}>
            <View style={{ height: 8, borderRadius: 999, backgroundColor: c.accent, width: `${(totalLidos / TOTAL_CAPITULOS) * 100}%` }} />
          </View>
          {proximo && (
            <Toque onPress={() => setPos(proximo)} style={{ marginTop: 12 }}>
              <Text style={{ color: c.accent }}>Continuar em {NOMES_LIVROS[proximo.livro]} {proximo.capitulo} →</Text>
            </Toque>
          )}
        </View>
      </ScrollView>

      {selecionados.size > 0 && (
        <View style={{ position: "absolute", left: 12, right: 12, bottom: 92, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 20, padding: 12, gap: 10, elevation: 12, shadowColor: "#000", shadowOpacity: 0.3, shadowRadius: 14, shadowOffset: { width: 0, height: 6 } }}>
          <Text style={{ textAlign: "center", color: c.muted, fontSize: 12 }}>{rotuloSelecao()}</Text>
          <View style={{ flexDirection: "row", justifyContent: "center", gap: 12 }}>
            {(Object.keys(CORES_GRIFO) as CorGrifo[]).map((k) => (
              <Toque key={k} onPress={() => setCor(k)} accessibilityLabel={`Cor ${k}`}
                style={{ width: 30, height: 30, borderRadius: 15, backgroundColor: CORES_GRIFO[k], borderWidth: cor === k ? 2.5 : 1, borderColor: cor === k ? c.accent : c.line }}><View /></Toque>
            ))}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 8 }}>
            <Toque onPress={aplicarGrifo} style={{ backgroundColor: c.accent, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 9 }}>
              <Text style={{ color: c.onAccent, fontWeight: "700" }}>{todosGrifados ? "Remover grifo" : "Grifar"}</Text>
            </Toque>
            <Toque onPress={() => nav.navigate("Hoje", { refs: rotuloSelecao() })} style={botao}><Text style={{ color: c.ink }}>Anotar</Text></Toque>
            <Toque onPress={compartilhar} style={botao}><Text style={{ color: c.ink }}>Compartilhar</Text></Toque>
            <Toque onPress={() => setSelecionados(new Set())} accessibilityLabel="Limpar seleção" style={{ paddingHorizontal: 8, paddingVertical: 9 }}><Text style={{ color: c.muted }}>✕</Text></Toque>
          </View>
        </View>
      )}

      <Modal visible={escolhendo} animationType="slide" onRequestClose={() => setEscolhendo(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: 20 }}>
            <Text style={{ fontFamily: serif, fontSize: 24, color: c.ink }}>Ir para…</Text>
            <Toque onPress={() => setEscolhendo(false)}><Text style={{ color: c.accent, fontSize: 16 }}>Fechar</Text></Toque>
          </View>
          <Seletor pos={pos} porLivro={porLivro} aoEscolher={(p) => { setPos(p); setEscolhendo(false); }} />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

// Livro primeiro; ao tocar, a grade de capítulos (os já lidos ficam marcados).
function Seletor({ pos, porLivro, aoEscolher }: { pos: Pos; porLivro: number[]; aoEscolher: (p: Pos) => void }) {
  const c = useCores();
  const [livro, setLivro] = useState<number | null>(null);
  const { lidos } = useLeitura();
  if (livro === null) {
    return (
      <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
        {NOMES_LIVROS.map((n, i) => (
          <Toque key={n} onPress={() => setLivro(i)} style={{ paddingVertical: 12, flexDirection: "row", justifyContent: "space-between", borderBottomWidth: 1, borderBottomColor: c.line }}>
            <Text style={{ color: i === pos.livro ? c.accent : c.ink, fontSize: 16 }}>{n}</Text>
            <Text style={{ color: porLivro[i] >= CAPITULOS[i] ? c.accent : c.muted, fontSize: 13 }}>
              {porLivro[i] >= CAPITULOS[i] ? "✓ completo" : porLivro[i] > 0 ? `${porLivro[i]} lidos` : ""}
            </Text>
          </Toque>
        ))}
      </ScrollView>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}>
      <Toque onPress={() => setLivro(null)} style={{ paddingBottom: 12 }}><Text style={{ color: c.accent }}>← {NOMES_LIVROS[livro]}</Text></Toque>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {Array.from({ length: CAPITULOS[livro] }, (_, i) => i + 1).map((n) => {
          const feito = lidos?.has(`${livro}:${n}`);
          return (
            <Toque key={n} onPress={() => aoEscolher({ livro, capitulo: n })}
              style={{ width: 52, height: 44, borderRadius: 10, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: feito ? c.accent : c.line, backgroundColor: feito ? c.accentSoft : c.card }}>
              <Text style={{ color: c.ink }}>{n}</Text>
            </Toque>
          );
        })}
      </View>
    </ScrollView>
  );
}
