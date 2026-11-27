import { useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { conversar, processarNota, prosear } from "../lib/cerebro";
import { supabase } from "../lib/supabase";
import type { Mensagem, Percepcao } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { ListaFontes, TextoComCitacoes } from "../components/Citacoes";
import { Digitando, Entra } from "../components/anim";
import { Avatar } from "../components/Avatar";

const SUGESTOES = [
  "O que mais se repete nas minhas anotações?",
  "Quais temas Deus tem tratado comigo ultimamente?",
  "Como o que escrevi sobre fé se liga ao que escrevi sobre obediência?",
  "Onde eu vejo tensão ou contradição nas minhas notas?",
];

const CHAVE = "sc_chat_v1";
const CHAVE_PROSA = "sc_prosa_v1";
const CHAVE_MODO = "sc_chat_modo_v1";
const ABERTURAS = ["Estou aqui. O que ficou no seu coração hoje?", "Sobre o que você está pensando ultimamente?", "Teve algo na leitura que não saiu da sua cabeça?"];
type Modo = "conversa" | "notas";

export function Conversar() {
  const c = useCores();
  const lista = useRef<FlatList<Mensagem>>(null);
  const [modo, setModo] = useState<Modo>("conversa");
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE_MODO)
      .then(async (m) => {
        const atual: Modo = m === "notas" ? "notas" : "conversa";
        setModo(atual);
        const salvo = await AsyncStorage.getItem(atual === "notas" ? CHAVE : CHAVE_PROSA);
        if (salvo) setMsgs(JSON.parse(salvo));
      })
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  useEffect(() => {
    if (!pronto) return;
    AsyncStorage.setItem(modo === "notas" ? CHAVE : CHAVE_PROSA, JSON.stringify(msgs.slice(-40))).catch(() => {});
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs, pronto, modo]);

  async function trocarModo(novo: Modo) {
    if (novo === modo) return;
    await AsyncStorage.setItem(CHAVE_MODO, novo).catch(() => {});
    const salvo = await AsyncStorage.getItem(novo === "notas" ? CHAVE : CHAVE_PROSA).catch(() => null);
    setMsgs(salvo ? JSON.parse(salvo) : []);
    setErro(null);
    setModo(novo);
  }

  async function decidirPercepcao(i: number, p: Percepcao, guardar: boolean) {
    if (guardar) {
      const { data, error } = await supabase
        .from("sc_notas")
        .insert({ conteudo: `Percepção numa conversa: ${p.texto}`, referencias: p.passagem ? [p.passagem] : [], tags: ["percepção"] })
        .select("id")
        .single();
      if (error || !data) { setErro(error?.message ?? "Não foi possível guardar."); return; }
      void processarNota(data.id).catch(() => undefined);
    }
    setMsgs((m) => m.map((x, j) => (j === i && x.percepcao ? { ...x, percepcao: { ...x.percepcao, estado: guardar ? "guardada" : "dispensada" } } : x)));
  }

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setEnviando(true);
    try {
      if (modo === "conversa") {
        const r = await prosear(q, historico);
        setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes, percepcao: r.percepcao }]);
      } else {
        const r = await conversar(q, historico);
        setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes }]);
      }
    } catch (e) {
      setErro((e as Error).message);
    }
    setEnviando(false);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
        <FlatList
          ref={lista}
          data={msgs}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ padding: 20, paddingBottom: 12, gap: 14 }}
          keyboardShouldPersistTaps="handled"
          ListHeaderComponent={
            <View style={{ marginBottom: 6 }}>
              <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
                <Text style={{ fontFamily: serif, fontSize: 30, color: c.ink }}>Conversar</Text>
                {msgs.length > 0 && (
                  <Pressable onPress={() => setMsgs([])}>
                    <Text style={{ color: c.muted }}>Nova conversa</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: "row", alignSelf: "flex-start", marginTop: 10, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 3 }}>
                {([["conversa", "Conversa"], ["notas", "Perguntar às notas"]] as const).map(([k, nome]) => (
                  <Pressable key={k} onPress={() => trocarModo(k)} style={{ borderRadius: 11, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: modo === k ? c.accent : "transparent" }}>
                    <Text style={{ fontSize: 13, fontWeight: modo === k ? "700" : "500", color: modo === k ? c.onAccent : c.muted }}>{nome}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: c.muted, marginTop: 8 }}>{modo === "conversa" ? "Converse como com um amigo. Se eu perceber algo, aviso." : "Pense junto com as suas anotações."}</Text>
              {msgs.length === 0 && pronto && (
                <View style={{ marginTop: 18, gap: 8 }}>
                  {(modo === "conversa" ? ABERTURAS : SUGESTOES).map((s) => (
                    <Pressable
                      key={s}
                      onPress={() => enviar(s)}
                      style={{
                        backgroundColor: c.card,
                        borderColor: c.line,
                        borderWidth: 1,
                        borderRadius: 16,
                        padding: 14,
                      }}
                    >
                      <Text style={{ color: c.ink }}>{s}</Text>
                    </Pressable>
                  ))}
                  <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>
                    {modo === "conversa"
                      ? "Eu escuto, lembro do que você já escreveu e, de vez em quando, devolvo uma percepção. Ela é uma hipótese para você levar em oração; quem discerne é você."
                      : "Eu respondo com base no que você escreveu, e levanto conexões e perguntas. A interpretação continua sendo sua."}
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item: m, index: i }) =>
            m.role === "user" ? (
              <Entra style={{ alignSelf: "flex-end", maxWidth: "90%", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flexShrink: 1, backgroundColor: c.accent, borderRadius: 18, borderBottomRightRadius: 5, padding: 13 }}>
                  <Text style={{ color: c.onAccent, fontSize: 16, lineHeight: 23 }}>{m.content}</Text>
                </View>
                <Avatar tamanho={30} />
              </Entra>
            ) : (
              <Entra style={{ alignSelf: "flex-start", maxWidth: "96%", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <Image source={require("../../assets/logo.png")} style={{ width: 30, height: 30, borderRadius: 15 }} />
                <View style={{ flexShrink: 1, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, borderBottomLeftRadius: 5, padding: 13 }}>
                  <TextoComCitacoes texto={m.content} fontes={m.fontes ?? []} />
                  <ListaFontes fontes={(m.fontes ?? []).filter((f) => m.content.includes(`[${f.n}]`))} />
                  {m.percepcao && m.percepcao.estado !== "dispensada" ? (
                    <View style={{ marginTop: 10, backgroundColor: c.accentSoft, borderColor: c.accent, borderWidth: 1, borderRadius: 12, padding: 11 }}>
                      <Text style={{ color: c.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>✦ PERCEBI ALGO</Text>
                      <Text style={{ fontFamily: serif, color: c.ink, fontSize: 15, lineHeight: 22, marginTop: 4 }}>{m.percepcao.texto}</Text>
                      {m.percepcao.passagem ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{m.percepcao.passagem}</Text> : null}
                      {m.percepcao.estado === "guardada" ? (
                        <Text style={{ color: c.accent, fontSize: 12, marginTop: 8 }}>✓ Guardada nas suas notas</Text>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                          <Pressable onPress={() => decidirPercepcao(i, m.percepcao!, true)}><Text style={{ color: c.accent, fontWeight: "700" }}>Guardar como nota</Text></Pressable>
                          <Pressable onPress={() => decidirPercepcao(i, m.percepcao!, false)}><Text style={{ color: c.muted }}>Dispensar</Text></Pressable>
                        </View>
                      )}
                    </View>
                  ) : null}
                </View>
              </Entra>
            )
          }
          ListFooterComponent={
            <View>
              {enviando && (
                <Entra style={{ flexDirection: "row", alignItems: "flex-end", gap: 8, marginTop: 8 }}>
                  <Image source={require("../../assets/logo.png")} style={{ width: 30, height: 30, borderRadius: 15 }} />
                  <View style={{ backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, borderBottomLeftRadius: 5, paddingHorizontal: 16, paddingVertical: 16 }}>
                    <Digitando />
                  </View>
                </Entra>
              )}
              {erro && (
                <Text style={{ color: c.ink, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12, marginTop: 8 }}>
                  {erro}
                </Text>
              )}
            </View>
          }
        />
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 90 }}>
          <Campo
            value={texto}
            onChangeText={setTexto}
            placeholder={modo === "conversa" ? "Conte o que está no seu coração…" : "Pergunte algo sobre suas notas…"}
            estilo={{ flex: 1 }}
            onSubmitEditing={() => enviar(texto)}
            returnKeyType="send"
          />
          <Botao titulo="Enviar" onPress={() => enviar(texto)} desabilitado={enviando || !texto.trim()} />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
