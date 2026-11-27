import { useEffect, useRef, useState } from "react";
import { FlatList, Image, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { conversar, processarNota, prosear, transcrever } from "../lib/cerebro";
import { supabase } from "../lib/supabase";
import type { Mensagem, Percepcao } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { ListaFontes, TextoComCitacoes } from "../components/Citacoes";
import { Digitando, Entra } from "../components/anim";
import { Avatar } from "../components/Avatar";
import { useDitado } from "../components/useDitado";
import { useGravador } from "../components/useGravador";

const SUGESTOES = [
  "What repeats the most in my notes?",
  "What themes has God been dealing with me about lately?",
  "How does what I wrote about faith connect to what I wrote about obedience?",
  "Where do I see tension or contradiction in my notes?",
];

const CHAVE = "sc_chat_v1";
const CHAVE_PROSA = "sc_prosa_v1";
const CHAVE_MODO = "sc_chat_modo_v1";
const ABERTURAS = ["I'm here. What's been on your heart today?", "What have you been thinking about lately?", "Was there something in your reading that stayed with you?"];
type Modo = "conversa" | "notas";

export function Conversar() {
  const c = useCores();
  const lista = useRef<FlatList<Mensagem>>(null);
  const [modo, setModo] = useState<Modo>("conversa");
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [idioma, setIdioma] = useState<"en-US" | "pt-BR">("en-US");
  const [transcrevendo, setTranscrevendo] = useState(false);
  const ditado = useDitado((t) => setTexto((x) => (x ? `${x} ${t}` : t)), idioma);
  const gravador = useGravador(async (b64, mime) => {
    setTranscrevendo(true);
    setErro(null);
    try {
      const { texto: falado } = await transcrever(b64, mime);
      await enviar(falado, true);
    } catch (e) {
      setErro((e as Error).message);
    }
    setTranscrevendo(false);
  });
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
        .insert({ conteudo: `Insight from a conversation: ${p.texto}`, referencias: p.passagem ? [p.passagem] : [], tags: ["insight"] })
        .select("id")
        .single();
      if (error || !data) { setErro(error?.message ?? "Couldn't save."); return; }
      void processarNota(data.id).catch(() => undefined);
    }
    setMsgs((m) => m.map((x, j) => (j === i && x.percepcao ? { ...x, percepcao: { ...x.percepcao, estado: guardar ? "guardada" : "dispensada" } } : x)));
  }

  async function enviar(pergunta: string, voz = false) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    if (ditado.ativo) void ditado.alternar();
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q, voz }]);
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
                <Text style={{ fontFamily: serif, fontSize: 30, color: c.ink }}>Chat</Text>
                {msgs.length > 0 && (
                  <Pressable onPress={() => setMsgs([])}>
                    <Text style={{ color: c.muted }}>New conversation</Text>
                  </Pressable>
                )}
              </View>
              <View style={{ flexDirection: "row", alignSelf: "flex-start", marginTop: 10, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 3 }}>
                {([["conversa", "Talk"], ["notas", "Ask my notes"]] as const).map(([k, nome]) => (
                  <Pressable key={k} onPress={() => trocarModo(k)} style={{ borderRadius: 11, paddingHorizontal: 11, paddingVertical: 6, backgroundColor: modo === k ? c.accent : "transparent" }}>
                    <Text style={{ fontSize: 13, fontWeight: modo === k ? "700" : "500", color: modo === k ? c.onAccent : c.muted }}>{nome}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: c.muted, marginTop: 8 }}>{modo === "conversa" ? "Talk like you would with a friend. If I notice something, I'll tell you." : "Think alongside your notes."}</Text>
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
                      ? "I listen, remember what you've already written and, now and then, offer an insight. It's a hypothesis to take to prayer; you are the one who discerns."
                      : "I answer based on what you wrote, and raise connections and questions. The interpretation is still yours."}
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item: m, index: i }) =>
            m.role === "user" ? (
              <Entra style={{ alignSelf: "flex-end", maxWidth: "90%", flexDirection: "row", alignItems: "flex-end", gap: 8 }}>
                <View style={{ flexShrink: 1, backgroundColor: c.accent, borderRadius: 18, borderBottomRightRadius: 5, padding: 13 }}>
                  <Text style={{ color: c.onAccent, fontSize: 16, lineHeight: 23 }}>{m.voz ? "🎤 " : ""}{m.content}</Text>
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
                      <Text style={{ color: c.accent, fontSize: 11, fontWeight: "700", letterSpacing: 0.8 }}>✦ I NOTICED SOMETHING</Text>
                      <Text style={{ fontFamily: serif, color: c.ink, fontSize: 15, lineHeight: 22, marginTop: 4 }}>{m.percepcao.texto}</Text>
                      {m.percepcao.passagem ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 4 }}>{m.percepcao.passagem}</Text> : null}
                      {m.percepcao.estado === "guardada" ? (
                        <Text style={{ color: c.accent, fontSize: 12, marginTop: 8 }}>✓ Saved to your notes</Text>
                      ) : (
                        <View style={{ flexDirection: "row", gap: 16, marginTop: 8 }}>
                          <Pressable onPress={() => decidirPercepcao(i, m.percepcao!, true)}><Text style={{ color: c.accent, fontWeight: "700" }}>Save as note</Text></Pressable>
                          <Pressable onPress={() => decidirPercepcao(i, m.percepcao!, false)}><Text style={{ color: c.muted }}>Dismiss</Text></Pressable>
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
              {(erro ?? gravador.erro ?? ditado.erro) && (
                <Text style={{ color: c.ink, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12, marginTop: 8 }}>
                  {erro ?? gravador.erro ?? ditado.erro}
                </Text>
              )}
            </View>
          }
        />
        <View style={{ flexDirection: "row", gap: 8, padding: 12, paddingBottom: 90, alignItems: "center" }}>
          {gravador.gravando ? (
            <View style={{ flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "space-between", backgroundColor: c.card, borderColor: c.accent, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 13 }}>
              <Text style={{ color: c.ink }}>🔴 Recording… {Math.floor(gravador.segundos / 60)}:{String(gravador.segundos % 60).padStart(2, "0")}</Text>
              <Pressable onPress={gravador.cancelar}><Text style={{ color: c.muted }}>Cancel</Text></Pressable>
            </View>
          ) : (
            <Campo
              value={texto}
              onChangeText={setTexto}
              placeholder={transcrevendo ? "Transcribing your voice message…" : ditado.ativo ? "Listening… speak now" : modo === "conversa" ? "Tell me what's on your heart…" : "Ask something about your notes…"}
              estilo={{ flex: 1 }}
              onSubmitEditing={() => enviar(texto)}
              returnKeyType="send"
            />
          )}
          {!gravador.gravando && (
            <>
              <Pressable onPress={() => setIdioma((x) => (x === "en-US" ? "pt-BR" : "en-US"))} disabled={ditado.ativo} accessibilityLabel="Dictation language" style={{ paddingHorizontal: 8, paddingVertical: 12, opacity: ditado.ativo ? 0.5 : 1 }}>
                <Text style={{ color: c.muted, fontWeight: "700", fontSize: 12 }}>{idioma === "en-US" ? "EN" : "PT"}</Text>
              </Pressable>
              <Pressable onPress={() => void ditado.alternar()} accessibilityLabel="Dictate: speech becomes text" style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: ditado.ativo ? c.accent : c.line, backgroundColor: ditado.ativo ? c.accentSoft : c.card }}>
                <Text style={{ fontSize: 18 }}>⌨️</Text>
              </Pressable>
            </>
          )}
          <Pressable onPress={gravador.gravando ? gravador.parar : gravador.iniciar} disabled={enviando || transcrevendo} accessibilityLabel={gravador.gravando ? "Stop and send voice message" : "Record a voice message"} style={{ width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: gravador.gravando ? c.accent : c.card, borderWidth: 1, borderColor: gravador.gravando ? c.accent : c.line, opacity: enviando || transcrevendo ? 0.5 : 1 }}>
            <Text style={{ fontSize: 18 }}>{gravador.gravando ? "⏹" : "🎙️"}</Text>
          </Pressable>
          {!gravador.gravando && <Botao titulo="Send" onPress={() => enviar(texto)} desabilitado={enviando || transcrevendo || !texto.trim()} />}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
