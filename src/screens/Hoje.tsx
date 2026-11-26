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

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

const RASCUNHO = "sc_rascunho_v1";

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
      setErro(`Nota guardada, mas a análise falhou: ${(e as Error).message}`);
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
        setAviso("Sem internet agora. A nota está guardada no aparelho e será enviada e conectada quando a conexão voltar.");
      } else {
        setErro(error?.message ?? "Não foi possível salvar.");
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

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
          <Entra style={{ flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ color: c.muted, fontSize: 13 }}>
                {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
              </Text>
              <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink, marginTop: 2 }}>{saudacao()}{nomeUsuario ? `, ${nomeUsuario}` : ""}.</Text>
              <Text style={{ color: c.muted, marginTop: 4 }}>O que você leu ou sentiu hoje?</Text>
            </View>
            <Toque onPress={() => nav.navigate("Perfil")} accessibilityLabel="Abrir perfil" style={{ shadowColor: "#3c2814", shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 4, borderRadius: 24 }}>
              <Avatar tamanho={48} />
            </Toque>
          </Entra>

          {(offline || pendentes > 0) && (
            <Entra style={{ marginTop: 12, backgroundColor: c.accentSoft, borderRadius: 12, padding: 10 }}>
              <Text style={{ color: c.ink, fontSize: 13 }}>
                {offline ? "Você está sem internet. " : ""}
                {pendentes > 0 ? `${pendentes} ${pendentes === 1 ? "nota aguarda" : "notas aguardam"} envio.` : "Você ainda pode escrever: suas notas ficam guardadas aqui."}
              </Text>
            </Entra>
          )}

          <Entra delay={80} style={{ marginTop: 18, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 14 }}>
            <View>
              <Campo
                multiline
                value={conteudo}
                onChangeText={setConteudo}
                accessibilityLabel="Sua anotação" placeholder="Escreva o que o Espírito Santo falou ao seu coração…"
                estilo={{ borderWidth: 0, backgroundColor: "transparent", paddingHorizontal: 0, alignItems: "flex-start" }}
                style={{ minHeight: 120, textAlignVertical: "top", fontFamily: serif, fontSize: 17, lineHeight: 25, paddingRight: 44 }}
              />
              <View style={{ position: "absolute", right: 0, top: 0, width: 40, height: 40, alignItems: "center", justifyContent: "center" }}>
                <Respira ativo={ditado.ativo} cor={c.accent} tamanho={36} />
                <Toque
                  onPress={ditado.alternar}
                  accessibilityRole="button"
                  accessibilityLabel={ditado.ativo ? "Parar de ouvir" : "Ditar por voz"}
                  style={{ width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center", backgroundColor: ditado.ativo ? c.accent : "transparent" }}
                >
                  <Icon nome="microfone" cor={ditado.ativo ? c.onAccent : c.muted} tamanho={20} />
                </Toque>
              </View>
            </View>
            {ditado.erro ? <Text style={{ color: c.muted, fontSize: 12 }}>{ditado.erro}</Text> : null}
            <Campo value={refs} onChangeText={setRefs} accessibilityLabel="Passagem bíblica" placeholder="Passagem (opcional): João 15:5, Sl 23" estilo={{ marginTop: 8 }} />
            <Campo value={tags} onChangeText={setTags} accessibilityLabel="Tags" placeholder="Tags (opcional): fé, obediência" estilo={{ marginTop: 8 }} />
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>Sem passagem? Eu sugiro uma para dar contexto.</Text>
            <Botao
              titulo="Guardar e conectar"
              onPress={salvar}
              carregando={fase === "guardando"}
              desabilitado={!conteudo.trim()}
              estilo={{ marginTop: 10 }}
            />
          </Entra>

          {conectando && <View style={{ marginTop: 16 }}><Pensando texto="Procurando ligações com o que você já escreveu" /></View>}
          {analisando && !conectando && <View style={{ marginTop: 16 }}><Pensando texto="Atualizando suas notas" /></View>}
          {aviso && <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}><Text style={{ color: c.ink }}>{aviso}</Text></Entra>}
          {erro && (
            <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}>
              <Text style={{ color: c.ink }}>{erro}</Text>
              {pendenteId ? (
                <Toque onPress={() => { setErro(null); conectar(pendenteId); }} style={{ marginTop: 8 }}>
                  <Text style={{ color: c.accent, fontWeight: "700" }}>Tentar de novo</Text>
                </Toque>
              ) : null}
            </Entra>
          )}

          {resultado && (
            <Entra style={{ marginTop: 18, backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 1, borderRadius: 18, padding: 16, gap: 14 }}>
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>✓ NOTA GUARDADA E CONECTADA</Text>
              {resultado.passagem && (
                <View style={{ gap: 6 }}>
                  <Text style={{ color: c.muted, fontSize: 12 }}>Para dar contexto à sua nota:</Text>
                  <Passagem rotulo={resultado.passagem.ref} sugerida motivo={resultado.passagem.motivo} />
                </View>
              )}
              <View>
                <TextoComCitacoes texto={resultado.reflexao} fontes={resultado.fontes} />
                <ListaFontes fontes={resultado.fontes.filter((f) => f.motivo)} />
              </View>
              {notaResultado ? <TagsSugeridas nota={notaResultado} aoMudar={recarregar} /> : null}
              <Toque onPress={() => nav.navigate("Conversar")}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>Quero pensar mais sobre isso →</Text>
              </Toque>
            </Entra>
          )}

          <RevisaoCard />

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 32 }}>
            <Text style={{ fontFamily: serif, fontSize: 21, color: c.ink }}>Últimas anotações</Text>
            <Toque onPress={() => nav.navigate("Notas")}><Text style={{ color: c.muted }}>Ver todas</Text></Toque>
          </View>
          {notas && recentes.length === 0 ? (
            <Vazio texto="Sua primeira anotação começa aqui." />
          ) : (
            recentes.map((n, i) => {
              const p = passagemPrincipal(n);
              return (
                <Entra key={n.id} delay={i * 60} style={{ marginTop: 12 }}>
                  <Toque onPress={() => nav.navigate("Notas", { notaId: n.id })} style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 14 }}>
                    <Text style={{ color: c.muted, fontSize: 12 }}>
                      {formatarData(n.created_at)}
                      {p ? ` · ${p.sugerida ? "✦ " : ""}${p.rotulo}` : ""}
                      {n.local ? " · aguardando envio" : ""}
                    </Text>
                    <Text numberOfLines={3} style={{ marginTop: 4, color: c.ink, fontFamily: serif, fontSize: 16 }}>{n.conteudo}</Text>
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
