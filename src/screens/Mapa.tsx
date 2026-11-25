import { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import Svg, { Circle, G, Line, Text as SvgText } from "react-native-svg";
import { formatarData } from "../lib/cerebro";
import { useDados } from "../lib/dados";
import { calcularLayout, corDoTema } from "../lib/grafo";
import { type Abas, type Conexao, GRUPO, type GrupoConexao, NOMES_LIVROS, type Nota, passagemPrincipal } from "../lib/types";
import { serif, useCores } from "../theme";
import { Vazio } from "../components/Vazio";
import { Entra, Pensando, Toque } from "../components/anim";
import { NOME_GRUPO, useCorGrupo } from "../components/Conexoes";
import { Passagem } from "../components/Passagem";

const L = 900;
const A = 640;
const AnimCircle = Animated.createAnimatedComponent(Circle);

type No = { nota: Nota; x: number; y: number; r: number; cor: string; grau: number; etiqueta: string };
type Aresta = { chave: string; a: string; b: string; conexoes: Conexao[]; peso: number; grupo: GrupoConexao };
const PRIORIDADE: GrupoConexao[] = ["passagem", "sentido", "tema"];
const PERIODOS = [{ id: "30", nome: "30 dias", dias: 30 }, { id: "90", nome: "90 dias", dias: 90 }, { id: "365", nome: "1 ano", dias: 365 }, { id: "tudo", nome: "Tudo", dias: 0 }];

function etiqueta(n: Nota) {
  const p = passagemPrincipal(n);
  if (p) return p.rotulo;
  const t = n.conteudo.replace(/\s+/g, " ").trim().split(" ").slice(0, 3).join(" ");
  return t.length > 22 ? `${t.slice(0, 21)}…` : t;
}

function Halo({ x, y, r, cor }: { x: number; y: number; r: number; cor: string }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1600, easing: Easing.out(Easing.quad), useNativeDriver: false }));
    l.start();
    return () => l.stop();
  }, [v]);
  return <AnimCircle cx={x} cy={y} r={v.interpolate({ inputRange: [0, 1], outputRange: [r + 2, r + 16] })} fill={cor} opacity={v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] })} />;
}

export function Mapa() {
  const c = useCores();
  const corGrupo = useCorGrupo();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const largura = useWindowDimensions().width - 24;
  const { notas, conexoes } = useDados();
  const [periodo, setPeriodo] = useState("tudo");
  const [tag, setTag] = useState<string | null>(null);
  const [grupos, setGrupos] = useState<Record<GrupoConexao, boolean>>({ sentido: true, passagem: true, tema: true });
  const [soConectadas, setSoConectadas] = useState(false);
  const [sel, setSel] = useState<{ tipo: "no" | "aresta"; id: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [reveladas, setReveladas] = useState(0);

  const todasTags = useMemo(() => {
    const f = new Map<string, number>();
    for (const n of notas ?? []) for (const t of n.tags) f.set(t, (f.get(t) ?? 0) + 1);
    return [...f.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10).map(([t]) => t);
  }, [notas]);

  const { nos, arestas, temas } = useMemo(() => {
    const dias = PERIODOS.find((p) => p.id === periodo)?.dias ?? 0;
    const corte = dias ? Date.now() - dias * 86400000 : 0;
    let base = (notas ?? []).filter((n) => !n.local && new Date(n.created_at).getTime() >= corte);
    if (tag) base = base.filter((n) => n.tags.includes(tag));
    const ids = new Set(base.map((n) => n.id));
    const porPar = new Map<string, Aresta>();
    for (const x of conexoes) {
      if (!grupos[GRUPO[x.tipo]] || !ids.has(x.a) || !ids.has(x.b)) continue;
      const chave = `${x.a}|${x.b}`;
      const at = porPar.get(chave) ?? { chave, a: x.a, b: x.b, conexoes: [], peso: 0, grupo: GRUPO[x.tipo] };
      at.conexoes.push(x);
      at.peso = Math.max(at.peso, x.peso);
      if (PRIORIDADE.indexOf(GRUPO[x.tipo]) < PRIORIDADE.indexOf(at.grupo)) at.grupo = GRUPO[x.tipo];
      porPar.set(chave, at);
    }
    const todas = [...porPar.values()];
    const grau = new Map<string, number>();
    for (const e of todas) { grau.set(e.a, (grau.get(e.a) ?? 0) + 1); grau.set(e.b, (grau.get(e.b) ?? 0) + 1); }
    if (soConectadas) base = base.filter((n) => grau.get(n.id));
    const idx = new Map(base.map((n, i) => [n.id, i]));
    const vis = todas.filter((e) => idx.has(e.a) && idx.has(e.b));
    const pos = calcularLayout(base.length, vis.map((e) => ({ a: idx.get(e.a)!, b: idx.get(e.b)!, s: e.peso })), L, A);
    const calc: No[] = base.map((n, i) => {
      const livro = n.sc_nota_refs[0] ? NOMES_LIVROS[n.sc_nota_refs[0].livro] : null;
      const tema = n.tags[0] ?? livro;
      const g = grau.get(n.id) ?? 0;
      return { nota: n, x: pos[i].x, y: pos[i].y, r: Math.min(30, 14 + 3.6 * Math.sqrt(g)), cor: corDoTema(tema), grau: g, etiqueta: etiqueta(n) };
    });
    const t = new Map<string, string>();
    for (const n of calc) { const k = n.nota.tags[0] ?? (n.nota.sc_nota_refs[0] ? NOMES_LIVROS[n.nota.sc_nota_refs[0].livro] : null); if (k && !t.has(k)) t.set(k, n.cor); }
    return { nos: calc, arestas: vis, temas: [...t.entries()].slice(0, 8) };
  }, [notas, conexoes, periodo, tag, grupos, soConectadas]);

  // Os pontos aparecem em sequência, um a um.
  useEffect(() => {
    setReveladas(0);
    if (!nos.length) return;
    const passo = Math.max(1, Math.ceil(nos.length / 24));
    const t = setInterval(() => setReveladas((r) => { if (r >= nos.length) { clearInterval(t); return r; } return r + passo; }), 35);
    return () => clearInterval(t);
  }, [nos]);

  const porId = useMemo(() => new Map(nos.map((n) => [n.nota.id, n])), [nos]);
  const noSel = sel?.tipo === "no" ? porId.get(sel.id) : undefined;
  const arestaSel = sel?.tipo === "aresta" ? arestas.find((e) => e.chave === sel.id) : undefined;
  const foco = sel?.tipo === "no" ? sel.id : null;
  const vizinhos = useMemo(() => {
    const s = new Set<string>();
    if (!foco) return s;
    s.add(foco);
    for (const e of arestas) { if (e.a === foco) s.add(e.b); if (e.b === foco) s.add(e.a); }
    return s;
  }, [foco, arestas]);
  const mostrarRotulos = nos.length <= 28;
  const w = L / zoom, h = A / zoom;
  const viewBox = `${(L - w) / 2} ${(A - h) / 2} ${w} ${h}`;
  const alturaSvg = (largura * A) / L;

  const chip = (ativo: boolean) => ({ borderWidth: 1, borderColor: ativo ? c.accent : c.line, backgroundColor: ativo ? c.accent : "transparent", borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6 });
  const conexoesDoNo = (id: string) => arestas.filter((e) => e.a === id || e.b === id).map((e) => ({ aresta: e, outro: e.a === id ? e.b : e.a })).sort((x, y) => y.aresta.peso - x.aresta.peso);
  const tracejado = (g: GrupoConexao) => (g === "passagem" ? "7 5" : g === "tema" ? "2 5" : undefined);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ padding: 12, paddingBottom: 110 }}>
        <View style={{ paddingHorizontal: 8 }}>
          <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink }}>Mapa</Text>
          <Text style={{ color: c.muted, marginTop: 2 }}>Toque numa ligação para ver por que as duas notas se conectam.</Text>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 12 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 8 }}>
          {PERIODOS.map((p) => <Toque key={p.id} onPress={() => setPeriodo(p.id)} style={chip(periodo === p.id)}><Text style={{ color: periodo === p.id ? c.onAccent : c.muted }}>{p.nome}</Text></Toque>)}
        </ScrollView>
        {todasTags.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 8 }}>
            <Toque onPress={() => setTag(null)} style={chip(!tag)}><Text style={{ color: !tag ? c.onAccent : c.muted }}>Todas as tags</Text></Toque>
            {todasTags.map((t) => <Toque key={t} onPress={() => setTag(tag === t ? null : t)} style={chip(tag === t)}><Text style={{ color: tag === t ? c.onAccent : c.muted }}>#{t}</Text></Toque>)}
          </ScrollView>
        )}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginTop: 8 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 8 }}>
          {(Object.keys(NOME_GRUPO) as GrupoConexao[]).map((g) => (
            <Toque key={g} onPress={() => setGrupos((s) => ({ ...s, [g]: !s[g] }))} accessibilityState={{ selected: grupos[g] }}
              style={{ flexDirection: "row", alignItems: "center", gap: 8, borderWidth: 1, borderColor: c.line, borderRadius: 999, paddingHorizontal: 12, paddingVertical: 6, opacity: grupos[g] ? 1 : 0.5 }}>
              <Svg width={26} height={8}><Line x1={1} y1={4} x2={25} y2={4} stroke={corGrupo(g)} strokeWidth={2.4} strokeDasharray={tracejado(g)} strokeLinecap="round" /></Svg>
              <Text style={{ color: c.ink }}>{NOME_GRUPO[g]}</Text>
            </Toque>
          ))}
          <Toque onPress={() => setSoConectadas((v) => !v)} style={chip(soConectadas)}><Text style={{ color: soConectadas ? c.onAccent : c.muted }}>Só conectadas</Text></Toque>
        </ScrollView>

        {!notas && <View style={{ marginTop: 24, paddingHorizontal: 8 }}><Pensando texto="Montando o mapa" /></View>}

        {notas && (
          <Entra style={{ marginTop: 12, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, overflow: "hidden" }}>
            {nos.length === 0 ? (
              <View style={{ padding: 24 }}><Vazio texto={notas.length === 0 ? "O mapa aparece quando você escrever suas primeiras notas." : "Nada neste recorte."} /></View>
            ) : (
              <View>
                <Svg width={largura} height={alturaSvg} viewBox={viewBox}>
                  <G>
                    {reveladas >= nos.length && arestas.map((e) => {
                      const a = porId.get(e.a)!, b = porId.get(e.b)!;
                      const ativa = sel?.tipo === "aresta" && sel.id === e.chave;
                      const dim = foco ? !(e.a === foco || e.b === foco) : sel?.tipo === "aresta" ? !ativa : false;
                      return (
                        <G key={e.chave} opacity={dim ? 0.12 : 1}>
                          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={corGrupo(e.grupo)} strokeDasharray={tracejado(e.grupo)} strokeLinecap="round" strokeWidth={(ativa ? 2 : 1) + 2.4 * e.peso} opacity={ativa ? 1 : 0.75} />
                          <Line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="transparent" strokeWidth={34} onPress={() => setSel({ tipo: "aresta", id: e.chave })} />
                          {e.conexoes.length > 1 && (
                            <G x={(a.x + b.x) / 2} y={(a.y + b.y) / 2}>
                              <Circle r={11} fill={c.card} stroke={corGrupo(e.grupo)} strokeWidth={1.5} />
                              <SvgText textAnchor="middle" y={4} fontSize={13} fill={c.ink}>{e.conexoes.length}</SvgText>
                            </G>
                          )}
                        </G>
                      );
                    })}
                  </G>
                  <G>
                    {nos.slice(0, reveladas).map((n) => {
                      const p = passagemPrincipal(n.nota);
                      const ativo = sel?.tipo === "no" && sel.id === n.nota.id;
                      const dim = foco ? !vizinhos.has(n.nota.id) : false;
                      const mostra = mostrarRotulos || vizinhos.has(n.nota.id) || ativo;
                      return (
                        <G key={n.nota.id} opacity={dim ? 0.25 : 1} onPress={() => setSel({ tipo: "no", id: n.nota.id })}>
                          {ativo && <Halo x={n.x} y={n.y} r={n.r} cor={n.cor} />}
                          {p?.sugerida && <Circle cx={n.x} cy={n.y} r={n.r + 5} fill="none" stroke={n.cor} strokeDasharray="3 3" strokeWidth={1.6} />}
                          <Circle cx={n.x} cy={n.y} r={n.r + 8} fill="transparent" />
                          <Circle cx={n.x} cy={n.y} r={n.r} fill={n.cor} stroke={c.card} strokeWidth={3} />
                          {p && <SvgText x={n.x} y={n.y + (n.r > 18 ? 6 : 5)} textAnchor="middle" fontSize={n.r > 18 ? 17 : 13} fill="#fffdf8">{p.sugerida ? "✦" : "❖"}</SvgText>}
                          {mostra && <SvgText x={n.x} y={n.y + n.r + 17} textAnchor="middle" fontSize={14} fill={c.ink} stroke={c.card} strokeWidth={3.5} strokeLinejoin="round">{n.etiqueta}</SvgText>}
                        </G>
                      );
                    })}
                  </G>
                </Svg>
                <View style={{ position: "absolute", right: 10, top: 10, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 12, overflow: "hidden" }}>
                  <Toque onPress={() => setZoom((z) => Math.min(2.2, z + 0.25))} accessibilityLabel="Aproximar" style={{ paddingHorizontal: 12, paddingVertical: 4 }}><Text style={{ color: c.ink, fontSize: 20 }}>+</Text></Toque>
                  <Toque onPress={() => setZoom((z) => Math.max(0.8, z - 0.25))} accessibilityLabel="Afastar" style={{ paddingHorizontal: 12, paddingVertical: 4, borderTopWidth: 1, borderTopColor: c.line }}><Text style={{ color: c.ink, fontSize: 20 }}>−</Text></Toque>
                </View>
              </View>
            )}
          </Entra>
        )}

        {(noSel || arestaSel) && (
          <Entra key={sel?.id} style={{ marginTop: 12, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 }}>
            <Toque onPress={() => setSel(null)} style={{ alignSelf: "flex-end" }}><Text style={{ color: c.muted }}>Fechar ✕</Text></Toque>
            {noSel && (
              <>
                <Text style={{ color: c.muted, fontSize: 12 }}>{formatarData(noSel.nota.created_at)}</Text>
                <Text style={{ color: c.ink, fontFamily: serif, fontSize: 16, lineHeight: 24 }}>{noSel.nota.conteudo}</Text>
                <View style={{ gap: 8 }}>
                  {noSel.nota.sc_nota_refs.map((r) => <Passagem key={r.rotulo} rotulo={r.rotulo} sugerida={r.origem === "ia"} motivo={noSel.nota.passagem_ia?.motivo} />)}
                </View>
                {noSel.nota.tags.length > 0 && <Text style={{ color: c.muted, fontSize: 12 }}>{noSel.nota.tags.map((t) => `#${t}`).join("  ")}</Text>}
                <View style={{ gap: 8 }}>
                  <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>POR QUE ESTÁ LIGADA</Text>
                  {conexoesDoNo(noSel.nota.id).length === 0 && <Text style={{ color: c.muted }}>Nenhuma conexão neste recorte.</Text>}
                  {conexoesDoNo(noSel.nota.id).map(({ aresta, outro }) => {
                    const o = porId.get(outro);
                    return (
                      <Toque key={aresta.chave} onPress={() => setSel({ tipo: "aresta", id: aresta.chave })} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 10 }}>
                        {aresta.conexoes.map((x) => (
                          <Text key={x.id} style={{ color: c.ink, fontSize: 14 }}>
                            <Text style={{ color: corGrupo(GRUPO[x.tipo]), fontSize: 11, fontWeight: "700" }}>{NOME_GRUPO[GRUPO[x.tipo]].toUpperCase()}  </Text>{x.motivo}
                          </Text>
                        ))}
                        {o ? <Text numberOfLines={1} style={{ color: c.muted, marginTop: 4 }}>{o.nota.conteudo}</Text> : null}
                      </Toque>
                    );
                  })}
                </View>
                <Toque onPress={() => nav.navigate("Notas", { notaId: noSel.nota.id })}><Text style={{ color: c.accent, fontWeight: "600" }}>Abrir nota →</Text></Toque>
              </>
            )}
            {arestaSel && (
              <>
                <Text style={{ color: c.muted, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>POR QUE ESTAS NOTAS SE LIGAM</Text>
                {arestaSel.conexoes.map((x) => (
                  <View key={x.id} style={{ backgroundColor: c.accentSoft, borderRadius: 12, padding: 12 }}>
                    <Text style={{ color: corGrupo(GRUPO[x.tipo]), fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>{NOME_GRUPO[GRUPO[x.tipo]].toUpperCase()}</Text>
                    <Text style={{ color: c.ink, marginTop: 2 }}>{x.motivo}</Text>
                  </View>
                ))}
                {[arestaSel.a, arestaSel.b].map((id) => {
                  const n = porId.get(id);
                  if (!n) return null;
                  return (
                    <Toque key={id} onPress={() => setSel({ tipo: "no", id })} style={{ borderWidth: 1, borderColor: c.line, borderRadius: 12, padding: 12 }}>
                      <Text style={{ color: c.muted, fontSize: 12 }}>{formatarData(n.nota.created_at)} · {n.etiqueta}</Text>
                      <Text numberOfLines={3} style={{ color: c.ink, fontFamily: serif, marginTop: 4 }}>{n.nota.conteudo}</Text>
                    </Toque>
                  );
                })}
              </>
            )}
          </Entra>
        )}

        {nos.length > 0 && (
          <Entra delay={200} style={{ marginTop: 12, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 16, padding: 14, gap: 4 }}>
            <Text style={{ color: c.ink, fontWeight: "600" }}>Como ler o mapa</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>❖ nota com passagem sua · ✦ passagem sugerida (anel tracejado)</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Tamanho = quantas ligações · Cor = tema principal (primeira tag ou livro)</Text>
            <Text style={{ color: c.muted, fontSize: 12 }}>Linha contínua = sentido · tracejada = passagem · pontilhada = tema</Text>
            {temas.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 }}>
                {temas.map(([t, cor]) => (
                  <View key={t} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: cor }} />
                    <Text style={{ color: c.muted, fontSize: 12 }}>{t}</Text>
                  </View>
                ))}
              </View>
            )}
          </Entra>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
