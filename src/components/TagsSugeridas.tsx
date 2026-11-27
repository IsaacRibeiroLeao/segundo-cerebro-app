import { useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { reconectar } from "../lib/cerebro";
import type { Nota } from "../lib/types";
import { useCores } from "../theme";
import { Pop, Toque } from "./anim";

export function TagsSugeridas({ nota, aoMudar }: { nota: Nota; aoMudar: () => void }) {
  const c = useCores();
  const [ocupado, setOcupado] = useState(false);
  if (!nota.tags_sugeridas?.length || nota.local) return null;

  async function decidir(tag: string, aceitar: boolean) {
    setOcupado(true);
    const restantes = nota.tags_sugeridas.filter((t) => t !== tag);
    const tags = aceitar ? [...new Set([...nota.tags, tag])] : nota.tags;
    await supabase.from("sc_notas").update({ tags, tags_sugeridas: restantes }).eq("id", nota.id);
    if (aceitar) await reconectar(nota.id).catch(() => undefined);
    setOcupado(false);
    aoMudar();
  }

  return (
    <View style={{ flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
      <Text style={{ color: c.muted, fontSize: 13 }}>Suggested tags:</Text>
      {nota.tags_sugeridas.map((t, i) => (
        <Pop key={t} delay={i * 60}>
          <View style={{ flexDirection: "row", borderWidth: 1, borderStyle: "dashed", borderColor: c.sage, borderRadius: 999, overflow: "hidden" }}>
            <Toque disabled={ocupado} onPress={() => decidir(t, true)} style={{ paddingHorizontal: 10, paddingVertical: 6 }} accessibilityLabel={`Confirm tag ${t}`}>
              <Text style={{ color: c.sage, fontSize: 14 }}>+ #{t}</Text>
            </Toque>
            <Toque disabled={ocupado} onPress={() => decidir(t, false)} style={{ paddingHorizontal: 10, paddingVertical: 6, borderLeftWidth: 1, borderLeftColor: c.sage, borderStyle: "dashed" }} accessibilityLabel={`Dismiss tag ${t}`}>
              <Text style={{ color: c.sage, fontSize: 14 }}>×</Text>
            </Toque>
          </View>
        </Pop>
      ))}
    </View>
  );
}
