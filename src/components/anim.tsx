import { ReactNode, useEffect, useRef } from "react";
import { Animated, Easing, Pressable, PressableProps, StyleProp, Text, View, ViewStyle } from "react-native";
import { useCores } from "../theme";

// Entrada curta: surge de baixo com fade. `delay` escalona listas.
export function Entra({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, { toValue: 1, duration: 340, delay: Math.min(delay, 400), easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [v, delay]);
  return (
    <Animated.View style={[{ opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }, style]}>
      {children}
    </Animated.View>
  );
}

// Surge com um pequeno "pulo" (chips, selos).
export function Pop({ children, delay = 0, style }: { children: ReactNode; delay?: number; style?: StyleProp<ViewStyle> }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: 1, delay: Math.min(delay, 400), friction: 5, tension: 120, useNativeDriver: true }).start();
  }, [v, delay]);
  return <Animated.View style={[{ opacity: v, transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }] }, style]}>{children}</Animated.View>;
}

// Pressable que afunda levemente ao toque.
export function Toque({ children, style, ...resto }: PressableProps & { style?: StyleProp<ViewStyle>; children: ReactNode }) {
  const v = useRef(new Animated.Value(1)).current;
  const para = (alvo: number) => Animated.spring(v, { toValue: alvo, speed: 40, bounciness: 4, useNativeDriver: true }).start();
  return (
    <Pressable {...resto} onPressIn={(e) => { para(0.97); resto.onPressIn?.(e); }} onPressOut={(e) => { para(1); resto.onPressOut?.(e); }}>
      <Animated.View style={[{ transform: [{ scale: v }] }, style]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Pensando({ texto = "Pensando" }: { texto?: string }) {
  const c = useCores();
  const pontos = useRef([0, 1, 2].map(() => new Animated.Value(0.25))).current;
  useEffect(() => {
    const loops = pontos.map((p, i) =>
      Animated.loop(Animated.sequence([
        Animated.delay(i * 150),
        Animated.timing(p, { toValue: 1, duration: 380, useNativeDriver: true }),
        Animated.timing(p, { toValue: 0.25, duration: 380, useNativeDriver: true }),
        Animated.delay(300 - i * 100),
      ])),
    );
    loops.forEach((l) => l.start());
    return () => loops.forEach((l) => l.stop());
  }, [pontos]);
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }} accessibilityRole="progressbar" accessibilityLabel={texto}>
      <Text style={{ color: c.muted, fontSize: 14 }}>{texto}</Text>
      <View style={{ flexDirection: "row", gap: 4 }}>
        {pontos.map((p, i) => (
          <Animated.View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: c.accent, opacity: p, transform: [{ translateY: p.interpolate({ inputRange: [0.25, 1], outputRange: [0, -3] }) }] }} />
        ))}
      </View>
    </View>
  );
}

// Halo que "respira" (microfone gravando).
export function Respira({ ativo, cor, tamanho }: { ativo: boolean; cor: string; tamanho: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!ativo) { v.setValue(0); return; }
    const l = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1400, easing: Easing.out(Easing.quad), useNativeDriver: true }));
    l.start();
    return () => l.stop();
  }, [ativo, v]);
  if (!ativo) return null;
  return (
    <Animated.View pointerEvents="none" style={{ position: "absolute", width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor, opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.45, 0] }), transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.8] }) }] }} />
  );
}

// Logo que flutua devagar.
export function Flutua({ children }: { children: ReactNode }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 2600, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [v]);
  return <Animated.View style={{ transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -8] }) }] }}>{children}</Animated.View>;
}
