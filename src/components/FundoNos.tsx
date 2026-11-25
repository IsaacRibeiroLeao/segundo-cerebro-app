import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from "react-native";
import Svg, { Circle, Line } from "react-native-svg";
import { useCores } from "../theme";

const NOS = [
  { x: 0.12, y: 0.1 }, { x: 0.8, y: 0.07 }, { x: 0.92, y: 0.38 }, { x: 0.72, y: 0.86 },
  { x: 0.2, y: 0.82 }, { x: 0.06, y: 0.45 }, { x: 0.5, y: 0.95 },
];
const LIGACOES: [number, number][] = [[0, 1], [1, 2], [2, 3], [3, 6], [6, 4], [4, 5], [5, 0], [0, 4], [1, 3]];

function Bolha({ cor, tamanho, style, duracao }: { cor: string; tamanho: number; style: object; duracao: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const l = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: duracao, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: duracao, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [v, duracao]);
  return (
    <Animated.View
      style={[{ position: "absolute", width: tamanho, height: tamanho, borderRadius: tamanho / 2, backgroundColor: cor, opacity: 0.22,
        transform: [{ translateX: v.interpolate({ inputRange: [0, 1], outputRange: [0, 24] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -20] }) }, { scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) }] }, style]}
    />
  );
}

// Fundo vivo: manchas suaves à deriva e uma pequena rede de pontos ligados que se desenha ao abrir.
export function FundoNos() {
  const c = useCores();
  const { width: w, height: h } = useWindowDimensions();
  const entrada = useRef(new Animated.Value(0)).current;
  const pulso = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(entrada, { toValue: 1, duration: 1400, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
    const l = Animated.loop(Animated.sequence([
      Animated.timing(pulso, { toValue: 1, duration: 1800, useNativeDriver: true }),
      Animated.timing(pulso, { toValue: 0, duration: 1800, useNativeDriver: true }),
    ]));
    l.start();
    return () => l.stop();
  }, [entrada, pulso]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Bolha cor={c.accent} tamanho={300} duracao={5200} style={{ top: -90, left: -80 }} />
      <Bolha cor={c.sage} tamanho={360} duracao={7000} style={{ bottom: -120, right: -90 }} />
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: Animated.multiply(entrada, pulso.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1] })) }]}>
        <Svg width={w} height={h}>
          {LIGACOES.map(([a, b], i) => (
            <Line key={i} x1={NOS[a].x * w} y1={NOS[a].y * h} x2={NOS[b].x * w} y2={NOS[b].y * h} stroke={c.accent} strokeOpacity={0.28} strokeWidth={1} />
          ))}
          {NOS.map((n, i) => <Circle key={i} cx={n.x * w} cy={n.y * h} r={5} fill={c.sage} fillOpacity={0.8} />)}
        </Svg>
      </Animated.View>
    </View>
  );
}

