import { useRef, useState } from "react";
import { ActivityIndicator, Animated, StyleProp, Text, TextInput, TextInputProps, View, ViewStyle } from "react-native";
import { Icon, type NomeIcone } from "./Icon";
import { useCores } from "../theme";
import { Toque } from "./anim";

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
    <Toque
      onPress={onPress}
      disabled={off}
      style={[
        {
          backgroundColor: c.accent,
          borderRadius: 16,
          paddingVertical: 14,
          paddingHorizontal: 20,
          alignItems: "center",
          opacity: off ? 0.5 : 1,
          elevation: off ? 0 : 5,
          shadowColor: c.accent,
          shadowOpacity: 0.35,
          shadowRadius: 10,
          shadowOffset: { width: 0, height: 5 },
        },
        estilo,
      ]}
    >
      {carregando ? (
        <ActivityIndicator color={c.onAccent} />
      ) : (
        <Text style={{ color: c.onAccent, fontWeight: "600", fontSize: 15 }}>{titulo}</Text>
      )}
    </Toque>
  );
}

export function Campo(props: TextInputProps & { estilo?: StyleProp<ViewStyle>; icone?: NomeIcone; direita?: React.ReactNode }) {
  const c = useCores();
  const { estilo, style, icone, direita, onFocus, onBlur, ...resto } = props;
  const foco = useRef(new Animated.Value(0)).current;
  const [dentro, setDentro] = useState(false);
  const mover = (a: number) => Animated.timing(foco, { toValue: a, duration: 180, useNativeDriver: false }).start();
  return (
    <Animated.View
      style={[
        {
          flexDirection: "row",
          alignItems: "center",
          gap: 10,
          borderWidth: 1.5,
          borderColor: foco.interpolate({ inputRange: [0, 1], outputRange: [c.line, c.accent] }),
          backgroundColor: c.card,
          borderRadius: 16,
          paddingHorizontal: 14,
          transform: [{ scale: foco.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) }],
        },
        estilo,
      ]}
    >
      {icone ? <View style={{ opacity: dentro ? 1 : 0.6 }}><Icon nome={icone} cor={c.accent} tamanho={20} /></View> : null}
      <TextInput
        placeholderTextColor={c.muted}
        {...resto}
        onFocus={(e) => { setDentro(true); mover(1); onFocus?.(e); }}
        onBlur={(e) => { setDentro(false); mover(0); onBlur?.(e); }}
        style={[{ flex: 1, color: c.ink, paddingVertical: 13, fontSize: 15 }, style]}
      />
      {direita}
    </Animated.View>
  );
}
