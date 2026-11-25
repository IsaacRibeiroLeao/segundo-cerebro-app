import { Image, Text } from "react-native";
import { useCores } from "../theme";
import { Entra, Flutua } from "./anim";

// Tela vazia com a ilustração: surge suave e flutua devagar.
export function Vazio({ texto }: { texto: string }) {
  const c = useCores();
  return (
    <Entra style={{ alignItems: "center", marginTop: 12 }}>
      <Flutua><Image source={require("../../assets/icons/ilustracao-vazio.png")} style={{ width: 180, height: 180 }} /></Flutua>
      <Text style={{ color: c.muted, textAlign: "center", marginTop: 4 }}>{texto}</Text>
    </Entra>
  );
}
