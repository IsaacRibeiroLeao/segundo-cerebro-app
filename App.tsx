import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Image, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer, useRoute, type RouteProp } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import type { Abas } from "./src/lib/types";
import { useCores } from "./src/theme";
import { Icon, type NomeIcone } from "./src/components/Icon";
import { Tile } from "./src/components/Tile";
import { Login } from "./src/screens/Login";
import { Hoje } from "./src/screens/Hoje";
import { Notas } from "./src/screens/Notas";
import { Biblia } from "./src/screens/Biblia";
import { Conversar } from "./src/screens/Conversar";
import { Mapa } from "./src/screens/Mapa";
import { Tempo } from "./src/screens/Tempo";
import { Toque } from "./src/components/anim";
import { Text } from "react-native";
import { Perfil } from "./src/screens/Perfil";
import { sincronizar } from "./src/lib/fila";
import { limparDadosLocais } from "./src/lib/sessao";

const Tab = createBottomTabNavigator<Abas>();

// Notas e Linha do tempo são duas visões da mesma coisa: um seletor no topo alterna entre elas.
function NotasETempo() {
  const c = useCores();
  const [modo, setModo] = useState<"lista" | "tempo">("lista");
  const rota = useRoute<RouteProp<Abas, "Notas">>();
  useEffect(() => { if (rota.params?.notaId) setModo("lista"); }, [rota.params?.notaId]);
  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <View style={{ alignSelf: "flex-start", marginLeft: 20, marginTop: 10, flexDirection: "row", backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 14, padding: 3 }}>
        {([["lista", "Lista"], ["tempo", "Linha do tempo"]] as const).map(([k, nome]) => (
          <Toque key={k} onPress={() => setModo(k)} style={{ borderRadius: 11, paddingHorizontal: 10, paddingVertical: 5, backgroundColor: modo === k ? c.accent : "transparent" }}>
            <Text style={{ fontSize: 12, fontWeight: modo === k ? "700" : "500", color: modo === k ? c.onAccent : c.muted }}>{nome}</Text>
          </Toque>
        ))}
      </View>
      {modo === "lista" ? <Notas /> : <Tempo />}
    </SafeAreaView>
  );
}

// Botão central da Bíblia: branco, maior e levantado em relação aos outros.
function BotaoBiblia({ onPress, focado }: { onPress?: () => void; focado: boolean }) {
  const c = useCores();
  return (
    <View style={{ flex: 1, alignItems: "center" }}>
      <Toque onPress={onPress} accessibilityLabel="Bíblia" style={{
        marginTop: -26, width: 66, height: 66, borderRadius: 33, backgroundColor: "#ffffff", alignItems: "center", justifyContent: "center",
        borderWidth: 3, borderColor: focado ? c.accent : c.paper, elevation: 12, shadowColor: "#000", shadowOpacity: 0.35, shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
      }}>
        <Icon nome="biblia" cor={c.accent} tamanho={32} />
      </Toque>
      <Text style={{ fontSize: 11, fontWeight: "600", marginTop: 3, color: focado ? c.accent : c.muted }}>Bíblia</Text>
    </View>
  );
}

// Ícone da aba: cresce um pouco e ganha um ponto quando está ativo.
function IconeAba({ nome, focado }: { nome: NomeIcone; cor?: string; focado: boolean }) {
  const v = useRef(new Animated.Value(focado ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: focado ? 1 : 0, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [focado, v]);
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.08] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}>
        <Tile nome={nome} tamanho={32} ativo={focado} />
      </Animated.View>
    </View>
  );
}

function Navegacao() {
  const c = useCores();
  const escuro = useColorScheme() === "dark";
  const base = escuro ? DarkTheme : DefaultTheme;
  return (
    <NavigationContainer
      theme={{
        ...base,
        colors: { ...base.colors, background: c.paper, card: c.paper, text: c.ink, border: c.line, primary: c.accent },
      }}
    >
      <Tab.Navigator
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: c.accent,
          tabBarInactiveTintColor: c.muted,
          tabBarShowLabel: true,
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 5 },
          tabBarStyle: {
            position: "absolute", left: 12, right: 12, bottom: 12, height: 68, paddingTop: 7,
            backgroundColor: c.card, borderTopWidth: 0, borderWidth: 1, borderColor: c.line, borderRadius: 24,
            elevation: 10, shadowColor: "#3c2814", shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 },
          },
          animation: "shift",
        }}
      >
        <Tab.Screen
          name="Hoje"
          component={Hoje}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="hoje" cor={color} focado={focused} /> }}
        />
        <Tab.Screen
          name="Notas"
          component={NotasETempo}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="notas" cor={color} focado={focused} /> }}
        />
        <Tab.Screen
          name="Biblia"
          component={Biblia}
          options={({ navigation }) => ({
            tabBarButton: () => <BotaoBiblia focado={navigation.isFocused()} onPress={() => navigation.navigate("Biblia")} />,
          })}
        />
        <Tab.Screen
          name="Conversar"
          component={Conversar}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="conversar" cor={color} focado={focused} /> }}
        />
        <Tab.Screen
          name="Mapa"
          component={Mapa}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="mapa" cor={color} focado={focused} /> }}
        />
        <Tab.Screen
          name="Perfil"
          component={Perfil}
          options={{ tabBarButton: () => null, tabBarItemStyle: { display: "none" } }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}

export default function App() {
  const c = useCores();
  const [session, setSession] = useState<Session | null>(null);
  const [carregando, setCarregando] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setCarregando(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((e, s) => {
      if (e === "SIGNED_OUT") limparDadosLocais();
      setSession(s);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Notas escritas sem internet são enviadas ao abrir o app, ao voltar para ele e de tempos em tempos.
  useEffect(() => {
    if (!session) return;
    sincronizar().catch(() => undefined);
    const sub = AppState.addEventListener("change", (e) => { if (e === "active") sincronizar().catch(() => undefined); });
    const t = setInterval(() => sincronizar().catch(() => undefined), 45000);
    return () => { sub.remove(); clearInterval(t); };
  }, [session]);

  return (
    <SafeAreaProvider>
      <StatusBar style="auto" />
      {carregando ? (
        <View style={{ flex: 1, backgroundColor: c.paper, alignItems: "center", justifyContent: "center" }}>
          <Image source={require("./assets/logo.png")} style={{ width: 72, height: 72, borderRadius: 18 }} />
        </View>
      ) : session ? (
        <Navegacao />
      ) : (
        <Login />
      )}
    </SafeAreaProvider>
  );
}
