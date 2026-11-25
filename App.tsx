import { useEffect, useState } from "react";
import { ActivityIndicator, AppState, View, useColorScheme } from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { DarkTheme, DefaultTheme, NavigationContainer } from "@react-navigation/native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import type { Abas } from "./src/lib/types";
import { useCores } from "./src/theme";
import { Icon } from "./src/components/Icon";
import { Login } from "./src/screens/Login";
import { Hoje } from "./src/screens/Hoje";
import { Notas } from "./src/screens/Notas";
import { Conversar } from "./src/screens/Conversar";
import { Mapa } from "./src/screens/Mapa";
import { Tempo } from "./src/screens/Tempo";
import { sincronizar } from "./src/lib/fila";

const Tab = createBottomTabNavigator<Abas>();

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
          tabBarStyle: { backgroundColor: c.paper, borderTopColor: c.line },
          animation: "shift",
        }}
      >
        <Tab.Screen
          name="Hoje"
          component={Hoje}
          options={{ tabBarIcon: ({ color }) => <Icon nome="hoje" cor={color} /> }}
        />
        <Tab.Screen
          name="Notas"
          component={Notas}
          options={{ tabBarIcon: ({ color }) => <Icon nome="notas" cor={color} /> }}
        />
        <Tab.Screen
          name="Conversar"
          component={Conversar}
          options={{ tabBarIcon: ({ color }) => <Icon nome="conversar" cor={color} /> }}
        />
        <Tab.Screen
          name="Mapa"
          component={Mapa}
          options={{ tabBarIcon: ({ color }) => <Icon nome="mapa" cor={color} /> }}
        />
        <Tab.Screen
          name="Tempo"
          component={Tempo}
          options={{ tabBarIcon: ({ color }) => <Icon nome="tempo" cor={color} /> }}
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
          <ActivityIndicator color={c.accent} />
        </View>
      ) : session ? (
        <Navegacao />
      ) : (
        <Login />
      )}
    </SafeAreaProvider>
  );
}
