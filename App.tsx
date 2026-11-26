import { useEffect, useRef, useState } from "react";
import { Animated, AppState, Image, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import type { Abas } from "./src/lib/types";
import { useCores } from "./src/theme";
import { Icon, type NomeIcone } from "./src/components/Icon";
import { Login } from "./src/screens/Login";
import { Hoje } from "./src/screens/Hoje";
import { Notas } from "./src/screens/Notas";
import { Conversar } from "./src/screens/Conversar";
import { Mapa } from "./src/screens/Mapa";
import { Tempo } from "./src/screens/Tempo";
import { Perfil } from "./src/screens/Perfil";
import { sincronizar } from "./src/lib/fila";

const Tab = createBottomTabNavigator<Abas>();

// Ícone da aba: cresce um pouco e ganha um ponto quando está ativo.
function IconeAba({ nome, cor, focado }: { nome: NomeIcone; cor: string; focado: boolean }) {
  const v = useRef(new Animated.Value(focado ? 1 : 0)).current;
  useEffect(() => {
    Animated.spring(v, { toValue: focado ? 1 : 0, friction: 6, tension: 140, useNativeDriver: true }).start();
  }, [focado, v]);
  return (
    <View style={{ alignItems: "center" }}>
      <Animated.View style={{ transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] }) }, { translateY: v.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) }] }}>
        <Icon nome={nome} cor={cor} />
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
          tabBarLabelStyle: { fontSize: 11, fontWeight: "600", marginBottom: 6 },
          tabBarStyle: {
            position: "absolute", left: 12, right: 12, bottom: 12, height: 64, paddingTop: 6,
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
          component={Notas}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="notas" cor={color} focado={focused} /> }}
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
          name="Tempo"
          component={Tempo}
          options={{ tabBarIcon: ({ color, focused }) => <IconeAba nome="tempo" cor={color} focado={focused} /> }}
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
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s));
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
