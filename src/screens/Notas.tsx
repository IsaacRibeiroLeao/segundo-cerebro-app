import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { RouteProp, useFocusEffect, useRoute } from "@react-navigation/native";
import { supabase } from "../lib/supabase";
import { formatarData, parseLista, processarNota, reprocessarPendentes } from "../lib/cerebro";
import { Abas, COLUNAS_NOTA, Fonte, Nota } from "../lib/types";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { Icon } from "../components/Icon";
import { ListaFontes } from "../components/Citacoes";

export function Notas() {
  const c = useCores();
  const route = useRoute<RouteProp<Abas, "Notas">>();
  const notaId = route.params?.notaId;
  const lista = useRef<FlatList<Nota>>(null);
  const [notas, setNotas] = useState<Nota[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [busca, setBusca] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [pendentes, setPendentes] = useState(0);
  const [rodando, setRodando] = useState(false);

  const carregar = useCallback(async () => {
    const [{ data }, { count }] = await Promise.all([
      supabase.from("sc_notas").select(COLUNAS_NOTA).order("created_at", { ascending: false }),
      supabase.from("sc_notas").select("id", { count: "exact", head: true }).is("embedding", null),
    ]);
    setNotas((data ?? []) as Nota[]);
    setPendentes(count ?? 0);
    setCarregando(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      carregar();
    }, [carregar]),
  );

  const todasTags = useMemo(() => {
    const cont = new Map<string, number>();
    notas.forEach((n) => n.tags.forEach((t) => cont.set(t, (cont.get(t) ?? 0) + 1)));
    return [...cont.entries()].sort((a, b) => b[1] - a[1]).map(([t]) => t);
  }, [notas]);

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return notas.filter(
      (n) =>
        (!tag || n.tags.includes(tag)) &&
        (!q ||
          n.conteudo.toLowerCase().includes(q) ||
          n.referencias.some((r) => r.toLowerCase().includes(q)) ||
          n.tags.some((t) => t.toLowerCase().includes(q))),
    );
  }, [notas, busca, tag]);

  useEffect(() => {
    if (!notaId || carregando) return;
    const i = filtradas.findIndex((n) => n.id === notaId);
    if (i >= 0) setTimeout(() => lista.current?.scrollToIndex({ index: i, animated: true }), 150);
  }, [notaId, carregando, filtradas]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <FlatList
        ref={lista}
        data={filtradas}
        keyExtractor={(n) => n.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        onScrollToIndexFailed={() => {}}
        ListHeaderComponent={
          <View>
            <Text style={{ fontFamily: serif, fontSize: 30, color: c.ink }}>Notas</Text>
            <Text style={{ color: c.muted, marginTop: 2 }}>{notas.length} anotações</Text>
            <Campo
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por palavra, versículo ou tag…"
              estilo={{ marginTop: 14 }}
            />
            {todasTags.length > 0 && (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 12 }}>
                {todasTags.map((t) => (
                  <Pressable
                    key={t}
                    onPress={() => setTag(tag === t ? null : t)}
                    style={{
                      backgroundColor: tag === t ? c.accent : c.accentSoft,
                      borderRadius: 99,
                      paddingHorizontal: 12,
                      paddingVertical: 5,
                    }}
                  >
                    <Text style={{ color: tag === t ? c.onAccent : c.accent }}>#{t}</Text>
                  </Pressable>
                ))}
              </View>
            )}
            {pendentes > 0 && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: c.accentSoft,
                  borderRadius: 12,
                  padding: 12,
                  flexDirection: "row",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <Text style={{ color: c.ink, flex: 1 }}>{pendentes} nota(s) sem conexões.</Text>
                <Botao
                  titulo="Conectar"
                  carregando={rodando}
                  onPress={async () => {
                    setRodando(true);
                    try {
                      await reprocessarPendentes();
                      await carregar();
                    } catch {
                      /* tenta depois */
                    }
                    setRodando(false);
                  }}
                  estilo={{ paddingVertical: 8, paddingHorizontal: 14 }}
                />
              </View>
            )}
            <View style={{ height: 8 }} />
          </View>
        }
        ListEmptyComponent={
          <Text style={{ color: c.muted, marginTop: 24 }}>
            {carregando ? "Carregando…" : "Nenhuma nota encontrada."}
          </Text>
        }
        renderItem={({ item }) => <NotaCard nota={item} destacada={item.id === notaId} aoMudar={carregar} />}
      />
    </SafeAreaView>
  );
}

function NotaCard({ nota, destacada, aoMudar }: { nota: Nota; destacada: boolean; aoMudar: () => void }) {
  const c = useCores();
  const [editando, setEditando] = useState(false);
  const [texto, setTexto] = useState(nota.conteudo);
  const [refs, setRefs] = useState(nota.referencias.join(", "));
  const [tags, setTags] = useState(nota.tags.join(", "));
  const [parecidas, setParecidas] = useState<Fonte[] | null>(null);
  const [verReflexao, setVerReflexao] = useState(false);
  const [ocupado, setOcupado] = useState(false);

  async function salvar() {
    setOcupado(true);
    await supabase
      .from("sc_notas")
      .update({
        conteudo: texto.trim(),
        referencias: parseLista(refs),
        tags: parseLista(tags, true),
        embedding: null,
        reflexao: null,
      })
      .eq("id", nota.id);
    try {
      await processarNota(nota.id);
    } catch {
      /* fica pendente */
    }
    setEditando(false);
    setOcupado(false);
    aoMudar();
  }

  function apagar() {
    Alert.alert("Apagar nota", "Isso não pode ser desfeito.", [
      { text: "Cancelar", style: "cancel" },
      {
        text: "Apagar",
        style: "destructive",
        onPress: async () => {
          await supabase.from("sc_notas").delete().eq("id", nota.id);
          aoMudar();
        },
      },
    ]);
  }

  async function verParecidas() {
    setOcupado(true);
    try {
      const r = await processarNota(nota.id);
      setParecidas(r.fontes);
      aoMudar();
    } catch {
      setParecidas([]);
    }
    setOcupado(false);
  }

  return (
    <View
      style={{
        marginTop: 14,
        backgroundColor: c.card,
        borderColor: destacada ? c.accent : c.line,
        borderWidth: destacada ? 2 : 1,
        borderRadius: 18,
        padding: 16,
      }}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
        <Text style={{ color: c.muted, fontSize: 12, flex: 1 }}>
          {formatarData(nota.created_at)}
          {nota.referencias.length ? ` · ${nota.referencias.join(", ")}` : ""}
        </Text>
        <View style={{ flexDirection: "row", gap: 14 }}>
          <Pressable onPress={() => setEditando(!editando)} hitSlop={8}>
            <Icon nome="editar" cor={c.muted} tamanho={18} />
          </Pressable>
          <Pressable onPress={apagar} hitSlop={8}>
            <Icon nome="apagar" cor={c.muted} tamanho={18} />
          </Pressable>
        </View>
      </View>

      {editando ? (
        <View style={{ marginTop: 8, gap: 8 }}>
          <Campo
            multiline
            value={texto}
            onChangeText={setTexto}
            style={{ minHeight: 120, textAlignVertical: "top", fontFamily: serif, fontSize: 16 }}
          />
          <Campo value={refs} onChangeText={setRefs} placeholder="Referências" />
          <Campo value={tags} onChangeText={setTags} placeholder="Tags" />
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <Botao titulo="Salvar" onPress={salvar} carregando={ocupado} desabilitado={!texto.trim()} />
            <Pressable onPress={() => setEditando(false)}>
              <Text style={{ color: c.muted }}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <Text style={{ marginTop: 8, color: c.ink, fontFamily: serif, fontSize: 17, lineHeight: 25 }}>
          {nota.conteudo}
        </Text>
      )}

      {nota.tags.length > 0 && (
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 12 }}>
          {nota.tags.map((t) => (
            <Text
              key={t}
              style={{
                color: c.accent,
                backgroundColor: c.accentSoft,
                borderRadius: 99,
                paddingHorizontal: 10,
                paddingVertical: 2,
                fontSize: 12,
                overflow: "hidden",
              }}
            >
              #{t}
            </Text>
          ))}
        </View>
      )}

      {nota.reflexao && !editando && (
        <Pressable
          onPress={() => setVerReflexao(!verReflexao)}
          style={{ marginTop: 14, backgroundColor: c.paper, borderRadius: 12, padding: 12 }}
        >
          <Text style={{ color: c.sage, fontWeight: "600" }}>
            {verReflexao ? "▾" : "▸"} Reflexão do segundo cérebro
          </Text>
          {verReflexao && <Text style={{ color: c.muted, marginTop: 8, lineHeight: 21 }}>{nota.reflexao}</Text>}
        </Pressable>
      )}

      {!editando && (
        <View style={{ marginTop: 12 }}>
          <Pressable onPress={verParecidas} disabled={ocupado}>
            <Text style={{ color: c.accent, fontWeight: "600", opacity: ocupado ? 0.5 : 1 }}>
              {ocupado ? "Buscando…" : "Ver notas parecidas"}
            </Text>
          </Pressable>
          {parecidas &&
            (parecidas.length ? (
              <ListaFontes fontes={parecidas} />
            ) : (
              <Text style={{ color: c.muted, marginTop: 8 }}>Nenhuma conexão encontrada ainda.</Text>
            ))}
        </View>
      )}
    </View>
  );
}
