import { Pressable, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import type { Abas, Fonte } from "../lib/types";
import { formatarData } from "../lib/cerebro";
import { serif, useCores } from "../theme";

type Nav = BottomTabNavigationProp<Abas>;

export function TextoComCitacoes({ texto, fontes }: { texto: string; fontes: Fonte[] }) {
  const c = useCores();
  const nav = useNavigation<Nav>();
  const partes = texto.split(/(\[\d+\])/g);
  return (
    <Text style={{ color: c.ink, fontSize: 16, lineHeight: 24 }}>
      {partes.map((p, i) => {
        const m = p.match(/^\[(\d+)\]$/);
        const fonte = m ? fontes.find((f) => f.n === Number(m[1])) : undefined;
        if (fonte) {
          return (
            <Text
              key={i}
              onPress={() => nav.navigate("Notas", { notaId: fonte.id })}
              style={{ color: c.accent, fontWeight: "700", backgroundColor: c.accentSoft }}
            >
              {` ${fonte.n} `}
            </Text>
          );
        }
        return <Text key={i}>{p}</Text>;
      })}
    </Text>
  );
}

export function ListaFontes({ fontes }: { fontes: Fonte[] }) {
  const c = useCores();
  const nav = useNavigation<Nav>();
  if (!fontes.length) return null;
  return (
    <View style={{ marginTop: 12, gap: 8 }}>
      {fontes.map((f) => (
        <Pressable
          key={f.id}
          onPress={() => nav.navigate("Notas", { notaId: f.id })}
          style={{ flexDirection: "row", gap: 8 }}
        >
          <Text
            style={{
              color: c.accent,
              backgroundColor: c.accentSoft,
              fontWeight: "700",
              fontSize: 12,
              minWidth: 22,
              textAlign: "center",
              paddingVertical: 2,
              borderRadius: 6,
              height: 22,
            }}
          >
            {f.n}
          </Text>
          <Text numberOfLines={2} style={{ color: c.muted, fontSize: 14, flex: 1 }}>
            {formatarData(f.created_at)}
            {f.referencias?.length ? ` · ${f.referencias.join(", ")}` : ""} — {f.trecho}
          </Text>
        </Pressable>
      ))}
    </View>
  );
}

export { serif };
