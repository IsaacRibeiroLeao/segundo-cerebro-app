import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { formatarData, parseLista, processarNota, reprocessarPendentes, type ResultadoProcesso } from "../lib/cerebro";
import { useDados } from "../lib/dados";
import { guardarNaFila, sincronizar } from "../lib/fila";
import { type Abas, passagemPrincipal } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { Avatar } from "../components/Avatar";
import { usePerfil } from "../lib/perfil";
import { Vazio } from "../components/Vazio";
import { Entra, Pensando, Respira, Toque } from "../components/anim";
import { Icon } from "../components/Icon";
import { ListaFontes, TextoComCitacoes } from "../components/Citacoes";
import { Passagem } from "../components/Passagem";
import { RevisaoCard } from "../components/RevisaoCard";
import { TagsSugeridas } from "../components/TagsSugeridas";
import { useDitado } from "../components/useDitado";
import { Tile } from "../components/Tile";
import { useLeitura } from "../lib/leitura";
import { NOMES_LIVROS, TOTAL_CAPITULOS, proximoNaoLido } from "../lib/livros";

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

const RASCUNHO = "sc_rascunho_v1";

// Dias seguidos (até hoje ou ontem) com ao menos uma nota, e notas dos últimos 7 dias.
function estatisticas(datas: string[]) {
  const dia = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
  const set = new Set(datas.map((d) => dia(new Date(d))));
  const cur = new Date();
  if (!set.has(dia(cur))) cur.setDate(cur.getDate() - 1);
  let sequencia = 0;
  while (set.has(dia(cur))) { sequencia++; cur.setDate(cur.getDate() - 1); }
  const agora = new Date().getTime();
  return { sequencia, semana: datas.filter((d) => agora - new Date(d).getTime() < 7 * 864e5).length };
}

export function Hoje() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const rota = useRoute<RouteProp<Abas, "Hoje">>();
  const { perfil } = usePerfil();
  const nomeUsuario = perfil?.nome?.split(" ")[0];
  const { notas, offline, pendentes, recarregar } = useDados();
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [fase, setFase] = useState<"livre" | "guardando">("livre");
  const [conectando, setConectando] = useState(false);
  const rascunhoPronto = useRef(false);

  // Rascunho: o que está sendo escrito sobrevive a trocar de aba ou fechar o app.
  useEffect(() => {
    AsyncStorage.getItem(RASCUNHO).then((b) => {
      if (b) { try { const r = JSON.parse(b); setConteudo(r.conteudo ?? ""); setRefs((x) => x || r.refs || ""); setTags(r.tags ?? ""); } catch { /* ilegível */ } }
      rascunhoPronto.current = true;
    }).catch(() => { rascunhoPronto.current = true; });
  }, []);
  // Vindo da Bíblia: preenche a passagem do que está sendo lido.
  const refsPedidas = rota.params?.refs;
  useEffect(() => {
    if (!refsPedidas) return;
    setRefs(refsPedidas);
    nav.setParams({ refs: undefined });
  }, [refsPedidas, nav]);
  useEffect(() => {
    if (!rascunhoPronto.current) return;
    const t = setTimeout(() => {
      if (conteudo || refs || tags) AsyncStorage.setItem(RASCUNHO, JSON.stringify({ conteudo, refs, tags })).catch(() => undefined);
      else AsyncStorage.removeItem(RASCUNHO).catch(() => undefined);
    }, 400);
    return () => clearTimeout(t);
  }, [conteudo, refs, tags]);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [pendenteId, setPendenteId] = useState<string | null>(null);
  const [resultado, setResultado] = useState<(ResultadoProcesso & { notaId: string }) | null>(null);
  const [analisando, setAnalisando] = useState(false);
  const tentou = useRef(false);

  const ditado = useDitado((t) => setConteudo((x) => (x ? `${x} ${t}` : t)));

  // Envia o que ficou guardado sem internet e analisa notas antigas sem análise.
  const semAnalise = notas?.filter((n) => !n.local && !n.processada_em && n.id !== pendenteId).length ?? 0;
  useEffect(() => {
    if (offline || tentou.current) return;
    if (!pendentes && !semAnalise) return;
    tentou.current = true;
    setAnalisando(true);
    (async () => {
      if (pendentes) await sincronizar();
      await reprocessarPendentes().catch(() => undefined);
      await recarregar();
      setAnalisando(false);
    })();
  }, [offline, pendentes, semAnalise, recarregar]);

  async function conectar(notaId: string) {
    setConectando(true);
    setResultado(null);
    try {
      const r = await processarNota(notaId);
      setResultado({ ...r, notaId });
      setPendenteId(null);
    } catch (e) {
      setPendenteId(notaId);
      setErro(`Note saved, but the analysis failed: ${(e as Error).message}`);
    }
    await recarregar();
    setConectando(false);
  }

  async function salvar() {
    if (!conteudo.trim() || fase !== "livre") return;
    setErro(null);
    setAviso(null);
    setResultado(null);
    setFase("guardando");
    const nova = { conteudo: conteudo.trim(), referencias: parseLista(refs), tags: parseLista(tags, true) };
    const { data, error } = await supabase.from("sc_notas").insert(nova).select("id").single();
    if (error || !data) {
      const semRede = !error?.code || /network|fetch|timeout|failed/i.test(error?.message ?? "");
      if (semRede) {
        await guardarNaFila(nova);
        setConteudo(""); setRefs(""); setTags("");
        setAviso("No internet right now. The note is saved on your device and will be sent and connected when the connection returns.");
      } else {
        setErro(error?.message ?? "Couldn't save.");
      }
      setFase("livre");
      return;
    }
    setConteudo(""); setRefs(""); setTags("");
    AsyncStorage.removeItem(RASCUNHO).catch(() => undefined);
    // Libera o formulário já: a análise chega em seguida, sem prender a pessoa.
    setFase("livre");
    void conectar(data.id);
  }

  const notaResultado = resultado ? notas?.find((n) => n.id === resultado.notaId) : undefined;
  const recentes = notas?.slice(0, 4) ?? [];
  const { lidos } = useLeitura();
  const { semana, sequencia } = estatisticas(notas?.map((n) => n.created_at) ?? []);
  const proximo = lidos ? proximoNaoLido(lidos) : null;

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
          <Entra style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {new Date().toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink, marginTop: 2 }}>{saudacao()}{nomeUsuario ? `, ${nomeUsuario}` : ""}.</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>What did you read or feel today?</Text>
            </View>
            <Toque onPress={() => nav.navigate("Perfil")} accessibilityLabel="Open profile" style={{ shadowColor: "#3c2814", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, borderRadius: 24 }}>
              <Avatar tamanho={48} />
            </Toque>
          </Entra>

          {(offline || pendentes > 0) && (
            <Entra style={{ marginTop: 12, backgroundColor: c.accentSoft, borderRadius: 12, padding: 10 }}>
              <Text style={{ color: c.ink, fontSize: 13 }}>
                {offline ? "You're offline. " : ""}
                {pendentes > 0 ? `${pendentes} ${pendentes === 1 ? "nota aguarda" : "notas aguardam"} envio.` : "You can still write: your notes are kept here."}
              </Text>
            </Entra>
          )}

          {lidos && notas ? (
            <Entra delay={60} style={{ marginTop: 16, backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 1, borderRadius: 18, padding: 14 }}>
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontFamily: serif, fontSize: 18, color: c.ink }}>Your journey continues</Text>
                  <Text style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>
                    {lidos.size} of {TOTAL_CAPITULOS} chapters · {semana} {semana === 1 ? "note" : "notes"} this week · {sequencia}-day streak
                  </Text>
                </View>
                <Tile nome="biblia" tamanho={42} ativo />
              </View>
              <View style={{ height: 6, borderRadius: 999, backgroundColor: c.line, marginTop: 12, overflow: "hidden" }}>
                <View style={{ height: 6, borderRadius: 999, backgroundColor: c.accent, width: `${Math.max(1, (lidos.size / TOTAL_CAPITULOS) * 100)}%` }} />
              </View>
              {proximo ? (
                <Toque onPress={() => nav.navigate("Biblia")} style={{ marginTop: 10 }}>
                  <Text style={{ color: c.accent, fontWeight: "600" }}>Continue in {NOMES_LIVROS[proximo.livro]} {proximo.capitulo} →</Text>
                </Toque>
              ) : null}
            </Entra>
          ) : null}

          <Entra delay={80} style={{ marginTop: 18, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 14 }}>
            <View>
              <Campo
                multiline
                value={conteudo}
                onChangeText={setConteudo}
                accessibilityLabel="Your note" placeholder="Write what the Holy Spirit spoke to your heart…"
                estilo={{ borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0, alignItems: "flex-start" }}
                style={{ minHeight: 120, textAlignVertical: "top", fontFamily: serif, fontSize: 17, lineHeight: 25, paddingRight: 44 }}
              />
              <View style={{ position: "absolute", right: 0, top: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Respira ativo={ditado.ativo} cor={c.accent} tamanho={36} />
                <Toque
                  onPress={ditado.alternar}
                  accessibilityRole="button"
                  accessibilityLabel={ditado.ativo ? "Stop listening" : "Dictate by voice"}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ditado.ativo ? c.accent : "transparent" }}
                >
                  <Icon nome="microfone" cor={ditado.ativo ? c.onAccent : c.muted} tamanho={20} />
                </Toque>
              </View>
            </View>
            {ditado.erro ? <Text style={{ color: c.muted, fontSize: 12 }}>{ditado.erro}</Text> : null}
            <Campo value={refs} onChangeText={setRefs} accessibilityLabel="Bible passage" placeholder="Passage (optional): João 15:5, Sl 23" estilo={{ marginTop: 8 }} />
            <Campo value={tags} onChangeText={setTags} accessibilityLabel="Tags" placeholder="Tags (optional): faith, obedience" estilo={{ marginTop: 8 }} />
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>No passage? I'll suggest one for context.</Text>
            <Botao
              titulo="Save and connect"
              onPress={salvar}
              carregando={fase === "guardando"}
              desabilitado={!conteudo.trim()}
              estilo={{ marginTop: 10 }}
            />
          </Entra>

          {conectando && <View style={{ marginTop: 16 }}><Pensando texto="Looking for links to what you've already written" /></View>}
          {analisando && !conectando && <View style={{ marginTop: 16 }}><Pensando texto="Updating your notes" /></View>}
          {aviso && <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}><Text style={{ color: c.ink }}>{aviso}</Text></Entra>}
          {erro && (
            <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}>
              <Text style={{ color: c.ink }}>{erro}</Text>
              {pendenteId ? (
                <Toque onPress={() => { setErro(null); conectar(pendenteId); }} style={{ marginTop: 8 }}>
                  <Text style={{ color: c.accent, fontWeight: "700" }}>Try again</Text>
                </Toque>
              ) : null}
            </Entra>
          )}

          {resultado && (
            <Entra style={{ marginTop: 18, backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 }}>
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>✓ NOTE SAVED AND CONNECTED</Text>
              {resultado.passagem && (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: c.muted, fontSize: 12 }}>To give your note context:</Text>
                  <Passagem rotulo={resultado.passagem.ref} sugerida motivo={resultado.passagem.motivo} />
                </View>
              )}
              <View>
                <TextoComCitacoes texto={resultado.reflexao} fontes={resultado.fontes} />
                <ListaFontes fontes={resultado.fontes.filter((f) => f.motivo)} />
              </View>
              {notaResultado ? <TagsSugeridas nota={notaResultado} aoMudar={recarregar} /> : null}
              <Toque onPress={() => nav.navigate("Conversar")}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>I want to think more about this →</Text>
              </Toque>
            </Entra>
          )}

          <RevisaoCard />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 32 }}>
            <Text style={{ fontFamily: serif, fontSize: 21, color: c.ink }}>Latest notes</Text>
            <Toque onPress={() => nav.navigate("Notas")}><Text style={{ color: c.muted }}>See all</Text></Toque>
          </View>
          {notas && recentes.length === 0 ? (
            <Vazio texto="Your first note starts here." />
          ) : (
            recentes.map((n, i) => {
              const p = passagemPrincipal(n);
              return (
                <Entra key={n.id} delay={i * 60} style={{ marginTop: 12 }}>
                  <Toque onPress={() => nav.navigate("Notas", { notaId: n.id })} style={{ flexDirection: "row", gap: 12, alignItems: "flex-start", backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                    <Tile nome="notas" tamanho={38} />
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: c.muted, fontSize: 12 }}>
                        {formatarData(n.created_at)}
                        {p ? ` · ${p.sugerida ? "✦ " : ""}${p.rotulo}` : ""}
                        {n.local ? " · aguardando envio" : ""}
                      </Text>
                      <Text numberOfLines={3} style={{ marginTop: 4, color: c.ink, fontFamily: serif, fontSize: 16 }}>{n.conteudo}</Text>
                    </View>
                  </Toque>
                </Entra>
              );
            })
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
