import { Image, Text, View } from "react-native";
import { usePerfil } from "../lib/perfil";
import { serif, useCores } from "../theme";

export function Avatar({ tamanho = 40 }: { tamanho?: number }) {
  const c = useCores();
  const { perfil } = usePerfil();
  const base = { width: tamanho, height: tamanho, borderRadius: tamanho / 2, borderWidth: 2, borderColor: c.card };
  if (perfil?.avatar) return <Image source={{ uri: perfil.avatar }} style={base} accessibilityLabel="Your profile photo" />;
  const inicial = (perfil?.nome ?? "").trim().charAt(0).toUpperCase();
  return (
    <View style={[base, { backgroundColor: c.accentSoft, alignItems: "center", justifyContent: "center" }]} accessibilityLabel="Profile">
      <Text style={{ fontFamily: serif, color: c.accent, fontSize: tamanho * 0.42 }}>{inicial || "·"}</Text>
    </View>
  );
}
