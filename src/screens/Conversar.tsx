import { useEffect, useRef, useState } from "react";
import { FlatList, KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { conversar } from "../lib/cerebro";
import type { Mensagem } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { ListaFontes, TextoComCitacoes } from "../components/Citacoes";
import { Entra, Pensando } from "../components/anim";

const SUGESTOES = [
  "O que mais se repete nas minhas anotações?",
  "Quais temas Deus tem tratado comigo ultimamente?",
  "Como o que escrevi sobre fé se liga ao que escrevi sobre obediência?",
  "Onde eu vejo tensão ou contradição nas minhas notas?",
];

const CHAVE = "sc_chat_v1";

export function Conversar() {
  const c = useCores();
  const lista = useRef<FlatList<Mensagem>>(null);
  const [msgs, setMsgs] = useState<Mensagem[]>([]);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(CHAVE)
      .then((s) => {
        if (s) setMsgs(JSON.parse(s));
      })
      .catch(() => {})
      .finally(() => setPronto(true));
  }, []);

  useEffect(() => {
    if (!pronto) return;
    AsyncStorage.setItem(CHAVE, JSON.stringify(msgs.slice(-40))).catch(() => {});
    setTimeout(() => lista.current?.scrollToEnd({ animated: true }), 100);
  }, [msgs, pronto]);

  async function enviar(pergunta: string) {
    const q = pergunta.trim();
    if (!q || enviando) return;
    setErro(null);
    setTexto("");
    const historico = msgs.map((m) => ({ role: m.role, content: m.content }));
    setMsgs((m) => [...m, { role: "user", content: q }]);
    setEnviando(true);
    try {
      const r = await conversar(q, historico);
      setMsgs((m) => [...m, { role: "assistant", content: r.resposta, fontes: r.fontes }]);
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
              <Text style={{ color: c.muted, marginTop: 2 }}>Pense junto com as suas anotações.</Text>
              {msgs.length === 0 && pronto && (
                <View style={{ marginTop: 18, gap: 8 }}>
                  {SUGESTOES.map((s) => (
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
                    Eu respondo com base no que você escreveu, e levanto conexões e perguntas. A interpretação
                    continua sendo sua.
                  </Text>
                </View>
              )}
            </View>
          }
          renderItem={({ item: m }) =>
            m.role === "user" ? (
              <View
                style={{
                  alignSelf: "flex-end",
                  maxWidth: "85%",
                  backgroundColor: c.accent,
                  borderRadius: 18,
                  borderBottomRightRadius: 5,
                  padding: 13,
                }}
              >
                <Text style={{ color: c.onAccent, fontSize: 16, lineHeight: 23 }}>{m.content}</Text>
              </View>
            ) : (
              <View
                style={{
                  alignSelf: "flex-start",
                  maxWidth: "94%",
                  backgroundColor: c.card,
                  borderColor: c.line,
                  borderWidth: 1,
                  borderRadius: 18,
                  borderBottomLeftRadius: 5,
                  padding: 13,
                }}
              >
                <TextoComCitacoes texto={m.content} fontes={m.fontes ?? []} />
                <ListaFontes fontes={(m.fontes ?? []).filter((f) => m.content.includes(`[${f.n}]`))} />
              </View>
            )
          }
          ListFooterComponent={
            <View>
              {enviando && <View style={{ marginTop: 8 }}><Pensando texto="Pensando junto com você" /></View>}
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
            placeholder="Pergunte algo sobre suas notas…"
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
