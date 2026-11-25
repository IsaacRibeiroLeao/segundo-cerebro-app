import { ActivityIndicator, Pressable, StyleProp, Text, TextInput, TextInputProps, ViewStyle } from "react-native";
import { useCores } from "../theme";

export function Botao({
  titulo,
  onPress,
  desabilitado,
  carregando,
  estilo,
}: {
  titulo: string;
  onPress: () => void;
  desabilitado?: boolean;
  carregando?: boolean;
  estilo?: StyleProp<ViewStyle>;
}) {
  const c = useCores();
  const off = desabilitado || carregando;
  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={[
        {
          backgroundColor: c.accent,
          borderRadius: 14,
          paddingVertical: 13,
          paddingHorizontal: 20,
          alignItems: "center",
          opacity: off ? 0.5 : 1,
        },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Text style={{ color: c.onAccent, fontWeight: "600", fontSize: 15 }}>{titulo}</Text>
      )}
    </Pressable>
  );
}

export function Campo(props: TextInputProps & { estilo?: StyleProp<ViewStyle> }) {
  const c = useCores();
  const { estilo, style, ...resto } = props;
  return (
    <TextInput
      placeholderTextColor={c.muted}
      {...resto}
      style={[
        {
          borderWidth: 1,
          borderColor: c.line,
          backgroundColor: c.card,
          color: c.ink,
          borderRadius: 14,
          paddingHorizontal: 14,
          paddingVertical: 11,
          fontSize: 15,
        },
        estilo,
        style,
      ]}
    />
  );
}
