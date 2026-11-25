import { useCallback, useMemo, useState } from "react";
import { Pressable, ScrollView, Text, View, useWindowDimensions } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, G, Line } from "react-native-svg";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { formatarData } from "../lib/cerebro";
import { Aresta, calcularLayout, parseVetor, produto } from "../lib/grafo";
import type { Abas, NotaComVetor } from "../lib/types";
import { serif, useCores } from "../theme";

const NIVEIS = [
  { nome: "Mais conexões", limiar: 0.55 },
  { nome: "Equilibrado", limiar: 0.65 },
  { nome: "Só as fortes", limiar: 0.75 },
];

export function Mapa() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const { width } = useWindowDimensions();
  const L = width - 40;
  const A = Math.round(L * 1.05);
  const [notas, setNotas] = useState<NotaComVetor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [nivel, setNivel] = useState(1);
  const [sel, setSel] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from("sc_notas")
        .select("id, conteudo, referencias, tags, reflexao, created_at, embedding")
        .not("embedding", "is", null)
        .order("created_at", { ascending: false })
        .limit(150)
        .then(({ data }) => {
          setNotas((data ?? []) as NotaComVetor[]);
          setCarregando(false);
        });
    }, []),
  );

  const { pos, arestas } = useMemo(() => {
    const vet = notas.map((n) => parseVetor(n.embedding));
    const ar: Aresta[] = [];
    for (let i = 0; i < notas.length; i++) {
      for (let j = i + 1; j < notas.length; j++) {
        const a = vet[i];
        const b = vet[j];
        if (!a || !b) continue;
        const s = produto(a, b);
        if (s >= NIVEIS[nivel].limiar) ar.push({ a: i, b: j, s });
      }
    }
    return { pos: calcularLayout(notas.length, ar, L, A), arestas: ar };
  }, [notas, nivel, L, A]);

  const selecionada = notas.find((n) => n.id === sel);
  const ligadas = useMemo(() => {
    const set = new Set<string>();
    if (!sel) return set;
    arestas.forEach((e) => {
      if (notas[e.a].id === sel) set.add(notas[e.b].id);
      if (notas[e.b].id === sel) set.add(notas[e.a].id);
    });
    return set;
  }, [sel, arestas, notas]);

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <Text style={{ fontFamily: serif, fontSize: 30, color: c.ink }}>Mapa</Text>
        <Text style={{ color: c.muted, marginTop: 2 }}>
          Cada ponto é uma nota. Linhas ligam notas com sentido parecido.
        </Text>

        {carregando ? (
          <Text style={{ color: c.muted, marginTop: 24 }}>Carregando…</Text>
        ) : notas.length < 2 ? (
          <Text style={{ color: c.muted, marginTop: 24 }}>
            O mapa aparece quando você tiver pelo menos duas notas conectadas.
          </Text>
        ) : (
          <>
            <View style={{ flexDirection: "row", gap: 8, marginTop: 16 }}>
              {NIVEIS.map((n, i) => (
                <Pressable
                  key={n.nome}
                  onPress={() => setNivel(i)}
                  style={{
                    flex: 1,
                    alignItems: "center",
                    paddingVertical: 8,
                    borderRadius: 12,
                    backgroundColor: nivel === i ? c.accent : c.accentSoft,
                  }}
                >
                  <Text style={{ color: nivel === i ? c.onAccent : c.accent, fontSize: 12, fontWeight: "600" }}>
                    {n.nome}
                  </Text>
                </Pressable>
              ))}
            </View>

            <View
              style={{
                marginTop: 12,
                backgroundColor: c.card,
                borderColor: c.line,
                borderWidth: 1,
                borderRadius: 18,
                overflow: "hidden",
              }}
            >
              <Svg width={L} height={A}>
                {arestas.map((e, i) => {
                  const forte = sel && (notas[e.a].id === sel || notas[e.b].id === sel);
                  return (
                    <Line
                      key={i}
                      x1={pos[e.a].x}
                      y1={pos[e.a].y}
                      x2={pos[e.b].x}
                      y2={pos[e.b].y}
                      stroke={c.accent}
                      strokeOpacity={forte ? 0.9 : 0.25}
                      strokeWidth={forte ? 2 : 1 + e.s}
                    />
                  );
                })}
                {notas.map((n, i) => {
                  const ativo = n.id === sel;
                  const vizinho = ligadas.has(n.id);
                  return (
                    <G key={n.id} onPress={() => setSel(ativo ? null : n.id)}>
                      <Circle cx={pos[i].x} cy={pos[i].y} r={20} fill="transparent" />
                      <Circle
                        cx={pos[i].x}
                        cy={pos[i].y}
                        r={ativo ? 11 : 8}
                        fill={ativo || vizinho ? c.accent : c.sage}
                        fillOpacity={sel && !ativo && !vizinho ? 0.35 : 1}
                      />
                    </G>
                  );
                })}
              </Svg>
            </View>
            <Text style={{ color: c.muted, fontSize: 12, marginTop: 8 }}>
              {notas.length} notas · {arestas.length} conexões
            </Text>

            {selecionada && (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: c.accentSoft,
                  borderColor: c.accent,
                  borderWidth: 1,
                  borderRadius: 18,
                  padding: 14,
                }}
              >
                <Text style={{ color: c.muted, fontSize: 12 }}>
                  {formatarData(selecionada.created_at)}
                  {selecionada.referencias.length ? ` · ${selecionada.referencias.join(", ")}` : ""}
                </Text>
                <Text numberOfLines={5} style={{ marginTop: 4, color: c.ink, fontFamily: serif, fontSize: 16 }}>
                  {selecionada.conteudo}
                </Text>
                <Text style={{ color: c.muted, marginTop: 8 }}>{ligadas.size} conexão(ões) com outras notas</Text>
                <Pressable onPress={() => nav.navigate("Notas", { notaId: selecionada.id })} style={{ marginTop: 8 }}>
                  <Text style={{ color: c.accent, fontWeight: "600" }}>Abrir nota →</Text>
                </Pressable>
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
