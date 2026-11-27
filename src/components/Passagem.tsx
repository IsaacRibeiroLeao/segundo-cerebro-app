import { useState } from "react";
import { Text, View } from "react-native";
import { versiculo } from "../lib/cerebro";
import type { Versiculos } from "../lib/types";
import { serif, useCores } from "../theme";
import { Entra, Pensando, Toque } from "./anim";

// Chip de passagem; ao tocar mostra o texto do versículo.
export function Passagem({ rotulo, sugerida, motivo }: { rotulo: string; sugerida?: boolean; motivo?: string }) {
  const c = useCores();
  const [aberto, setAberto] = useState(false);
  const [texto, setTexto] = useState<Versiculos | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setLoading] = useState(false);

  async function alternar() {
    const novo = !aberto;
    setAberto(novo);
    if (novo && !texto && !carregando) {
      setLoading(true);
      setErro(null);
      try {
        setTexto(await versiculo(rotulo));
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Couldn't load the text.");
      }
      setLoading(false);
    }
  }

  return (
    <View style={{ alignSelf: "flex-start", maxWidth: "100%" }}>
      <Toque
        onPress={alternar}
        accessibilityRole="button"
        accessibilityState={{ expanded: aberto }}
        style={{
          flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999,
          borderWidth: 1, borderStyle: sugerida ? "dashed" : "solid",
          borderColor: sugerida ? c.sage : c.accent, backgroundColor: sugerida ? "transparent" : c.accentSoft,
        }}
      >
        <Text style={{ color: sugerida ? c.sage : c.accent, fontSize: 14 }}>
          {sugerida ? "✦ " : "❖ "}{rotulo}{sugerida ? "  sugerida" : ""}  {aberto ? "▴" : "▾"}
        </Text>
      </Toque>
      {aberto && (
        <Entra style={{ marginTop: 8, borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 16, padding: 14 }}>
          {sugerida && motivo ? <Text style={{ color: c.muted, fontSize: 13, marginBottom: 8 }}>{motivo}</Text> : null}
          {carregando && <Pensando texto="Buscando o texto" />}
          {erro && <Text style={{ color: c.muted }}>{erro}</Text>}
          {texto && (
            <Text style={{ fontFamily: serif, color: c.ink, fontSize: 16, lineHeight: 25 }}>
              {texto.versiculos.map((v) => (
                <Text key={v.n}>
                  <Text style={{ color: c.accent, fontSize: 11 }}>{v.n} </Text>
                  {v.texto}{" "}
                </Text>
              ))}
              {texto.truncado ? `\n(first verses of ${texto.total})` : ""}
            </Text>
          )}
        </Entra>
      )}
    </View>
  );
}
