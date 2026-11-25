import { useEffect, useRef, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { formatarData, parseLista, processarNota, reprocessarPendentes, type ResultadoProcesso } from "../lib/cerebro";
import { useDados } from "../lib/dados";
import { guardarNaFila, sincronizar } from "../lib/fila";
import { type Abas, passagemPrincipal } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
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

export function Hoje() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const { notas, offline, pendentes, recarregar } = useDados();
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [fase, setFase] = useState<"livre" | "guardando" | "conectando">("livre");
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
    setFase("conectando");
    try {
      const r = await processarNota(notaId);
      setResultado({ ...r, notaId });
      setPendenteId(null);
    } catch (e) {
      setPendenteId(notaId);
      setErro(`Nota guardada, mas a análise falhou: ${(e as Error).message}`);
    }
    await recarregar();
    setFase("livre");
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
    await conectar(data.id);
  }

  const notaResultado = resultado ? notas?.find((n) => n.id === resultado.notaId) : undefined;
  const recentes = notas?.slice(0, 4) ?? [];

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Entra>
            <Text style={{ color: c.muted, fontSize: 13 }}>
              {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
            </Text>
            <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink, marginTop: 2 }}>{saudacao()}.</Text>
            <Text style={{ color: c.muted, marginTop: 4 }}>O que você leu ou sentiu hoje?</Text>
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
                placeholder="Escreva o que o Espírito Santo falou ao seu coração…"
                style={{ minHeight: 120, textAlignVertical: "top", borderWidth: 0, backgroundColor: "transparent", fontFamily: serif, fontSize: 17, lineHeight: 25, paddingHorizontal: 0, paddingRight: 44 }}
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
            <Campo value={refs} onChangeText={setRefs} placeholder="Passagem (opcional): João 15:5, Sl 23" estilo={{ marginTop: 8 }} />
            <Campo value={tags} onChangeText={setTags} placeholder="Tags (opcional): fé, obediência" estilo={{ marginTop: 8 }} />
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>Sem passagem? Eu sugiro uma para dar contexto.</Text>
            <Botao
              titulo={fase === "conectando" ? "Conectando…" : "Guardar e conectar"}
              onPress={salvar}
              carregando={fase === "guardando"}
              desabilitado={!conteudo.trim() || fase === "conectando"}
              estilo={{ marginTop: 10 }}
            />
          </Entra>

          {fase === "conectando" && <View style={{ marginTop: 16 }}><Pensando texto="Procurando ligações com o que você já escreveu" /></View>}
          {analisando && fase === "livre" && <View style={{ marginTop: 16 }}><Pensando texto="Atualizando suas notas" /></View>}
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
            <Entra style={{ alignItems: "center", marginTop: 8 }}>
              <Image source={require("../../assets/icons/ilustracao-vazio.png")} style={{ width: 200, height: 200 }} />
              <Text style={{ color: c.muted }}>Sua primeira anotação começa aqui.</Text>
            </Entra>
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
