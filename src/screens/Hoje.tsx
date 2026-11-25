import { useCallback, useState } from "react";
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { formatarData, parseLista, processarNota } from "../lib/cerebro";
import { Abas, COLUNAS_NOTA, Fonte, Nota } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { ListaFontes, TextoComCitacoes } from "../components/Citacoes";

function saudacao() {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

export function Hoje() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const [conteudo, setConteudo] = useState("");
  const [refs, setRefs] = useState("");
  const [tags, setTags] = useState("");
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [reflexao, setReflexao] = useState<{ texto: string; fontes: Fonte[] } | null>(null);
  const [recentes, setRecentes] = useState<Nota[]>([]);

  const carregar = useCallback(async () => {
    const { data } = await supabase
      .from("sc_notas")
      .select(COLUNAS_NOTA)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecentes((data ?? []) as Nota[]);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  async function salvar() {
    if (!conteudo.trim()) return;
    setErro(null);
    setReflexao(null);
    setSalvando(true);
    const { data, error } = await supabase
      .from("sc_notas")
      .insert({ conteudo: conteudo.trim(), referencias: parseLista(refs), tags: parseLista(tags, true) })
      .select("id")
      .single();
    if (error || !data) {
      setErro(error?.message ?? "Não foi possível salvar.");
      setSalvando(false);
      return;
    }
    setConteudo("");
    setRefs("");
    setTags("");
    try {
      const r = await processarNota(data.id);
      setReflexao({ texto: r.reflexao, fontes: r.fontes });
    } catch (e) {
      setErro(`Nota guardada, mas não consegui conectar agora: ${(e as Error).message}`);
    }
    await carregar();
    setSalvando(false);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <Text style={{ color: c.muted, fontSize: 13 }}>
            {new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })}
          </Text>
          <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink, marginTop: 2 }}>{saudacao()}.</Text>
          <Text style={{ color: c.muted, marginTop: 4 }}>O que você leu ou sentiu hoje?</Text>

          <View
            style={{
              marginTop: 18,
              backgroundColor: c.card,
              borderColor: c.line,
              borderWidth: 1,
              borderRadius: 18,
              padding: 14,
            }}
          >
            <Campo
              multiline
              value={conteudo}
              onChangeText={setConteudo}
              placeholder="Escreva o que o Espírito Santo falou ao seu coração…"
              style={{
                minHeight: 120,
                textAlignVertical: "top",
                borderWidth: 0,
                backgroundColor: "transparent",
                fontFamily: serif,
                fontSize: 17,
                lineHeight: 25,
                paddingHorizontal: 0,
              }}
            />
            <Campo value={refs} onChangeText={setRefs} placeholder="Referências (João 15:5, Sl 23)" estilo={{ marginTop: 8 }} />
            <Campo value={tags} onChangeText={setTags} placeholder="Tags (fé, obediência)" estilo={{ marginTop: 8 }} />
            <Botao
              titulo="Guardar e conectar"
              onPress={salvar}
              carregando={salvando}
              desabilitado={!conteudo.trim()}
              estilo={{ marginTop: 12 }}
            />
          </View>

          {erro && (
            <Text style={{ marginTop: 14, color: c.ink, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}>
              {erro}
            </Text>
          )}

          {reflexao && (
            <View
              style={{
                marginTop: 18,
                backgroundColor: c.accentSoft,
                borderColor: c.accent,
                borderWidth: 1,
                borderRadius: 18,
                padding: 16,
              }}
            >
              <Text style={{ color: c.accent, fontSize: 12, fontWeight: "700", letterSpacing: 0.8 }}>CONEXÕES</Text>
              <View style={{ marginTop: 8 }}>
                <TextoComCitacoes texto={reflexao.texto} fontes={reflexao.fontes} />
              </View>
              <ListaFontes fontes={reflexao.fontes} />
              <Pressable onPress={() => nav.navigate("Conversar")} style={{ marginTop: 14 }}>
                <Text style={{ color: c.accent, fontWeight: "600" }}>Quero pensar mais sobre isso →</Text>
              </Pressable>
            </View>
          )}

          <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", marginTop: 32 }}>
            <Text style={{ fontFamily: serif, fontSize: 21, color: c.ink }}>Últimas anotações</Text>
            <Pressable onPress={() => nav.navigate("Notas")}>
              <Text style={{ color: c.muted }}>Ver todas</Text>
            </Pressable>
          </View>
          {recentes.length === 0 ? (
            <View style={{ alignItems: "center", marginTop: 8 }}>
              <Image source={require("../../assets/icons/ilustracao-vazio.png")} style={{ width: 200, height: 200 }} />
              <Text style={{ color: c.muted }}>Sua primeira anotação começa aqui.</Text>
            </View>
          ) : (
            recentes.map((n) => (
              <Pressable
                key={n.id}
                onPress={() => nav.navigate("Notas", { notaId: n.id })}
                style={{
                  marginTop: 12,
                  backgroundColor: c.card,
                  borderColor: c.line,
                  borderWidth: 1,
                  borderRadius: 16,
                  padding: 14,
                }}
              >
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {formatarData(n.created_at)}
                  {n.referencias.length ? ` · ${n.referencias.join(", ")}` : ""}
                </Text>
                <Text numberOfLines={3} style={{ marginTop: 4, color: c.ink, fontFamily: serif, fontSize: 16 }}>
                  {n.conteudo}
                </Text>
              </Pressable>
            ))
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
