import { View } from "react-native";
import { useCores } from "../theme";
import { Icon, type NomeIcone } from "./Icon";

// Ícone dentro de um quadradinho com contorno dourado; "ativo" enche de ouro.
export function Tile({ nome, tamanho = 36, ativo = false }: { nome: NomeIcone; tamanho?: number; ativo?: boolean }) {
  const c = useCores();
  return (
    <View
      style={{
        width: tamanho, height: tamanho, borderRadius: tamanho * 0.32, alignItems: "center", justifyContent: "center",
        borderWidth: 1, borderColor: ativo ? c.accent : c.line, backgroundColor: ativo ? c.accent : c.accentSoft,
      }}
    >
      <Icon nome={nome} cor={ativo ? c.onAccent : c.accent} tamanho={Math.round(tamanho * 0.5)} />
    </View>
  );
}
