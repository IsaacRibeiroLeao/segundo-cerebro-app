import { useRef, useState } from "react";
import { Animated, Image, KeyboardAvoidingView, Platform, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";
import { Entra, Flutua, Toque } from "../components/anim";
import { FundoNos } from "../components/FundoNos";

const CADASTRO_ABERTO = process.env.EXPO_PUBLIC_CADASTRO === "1";
const URL_SITE = "https://segundo-cerebro-web-psi.vercel.app";

export function Login() {
  const c = useCores();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [ver, setVer] = useState(false);
  const tremor = useRef(new Animated.Value(0)).current;

  function tremer() {
    tremor.setValue(0);
    Animated.sequence([-9, 8, -6, 4, 0].map((x) => Animated.timing(tremor, { toValue: x, duration: 60, useNativeDriver: true }))).start();
  }

  async function esqueci() {
    setErro(null);
    setAviso(null);
    if (!email.trim()) { setErro("Enter your email above and tap again."); return; }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: URL_SITE });
    if (error) setErro(error.message);
    else setAviso("If that email has an account, we sent a link to set a new password (it opens on the website).");
  }

  async function enviar() {
    setErro(null);
    setAviso(null);
    setEnviando(true);
    if (criando) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
      if (error) { setErro(error.message); tremer(); }
      else if (!data.session) setAviso("Account created. Confirm the email we sent, then sign in.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) { setErro("Incorrect email or password."); tremer(); }
    }
    setEnviando(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper }}>
      <FundoNos />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: 22 }} keyboardShouldPersistTaps="handled">
          <Animated.View style={{ transform: [{ translateX: tremor }], backgroundColor: c.card + "ee", borderColor: c.line, borderWidth: 1, borderRadius: 28, padding: 24, elevation: 8, shadowColor: "#3c2814", shadowOpacity: 0.2, shadowRadius: 24, shadowOffset: { width: 0, height: 12 } }}>
            <View style={{ alignItems: "center" }}>
              <Entra>
                <Flutua>
                  <Image source={require("../../assets/logo.png")} style={{ width: 92, height: 92, borderRadius: 24 }} />
                </Flutua>
              </Entra>
              <Entra delay={100}><Text style={{ fontFamily: serif, fontSize: 30, color: c.ink, marginTop: 18 }}>Second Brain</Text></Entra>
              <Entra delay={170}><Text style={{ color: c.muted, marginTop: 4, marginBottom: 24 }}>Your notes, connected.</Text></Entra>
            </View>

            <Entra delay={240}>
              <Campo icone="hoje" value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" autoComplete="email" keyboardType="email-address" accessibilityLabel="Email" />
            </Entra>
            <Entra delay={300} style={{ marginTop: 12 }}>
              <Campo
                icone="notas"
                value={senha}
                onChangeText={setSenha}
                placeholder="Password"
                secureTextEntry={!ver}
                autoCapitalize="none"
                autoComplete={criando ? "new-password" : "current-password"}
                accessibilityLabel="Password"
                onSubmitEditing={enviar}
                direita={<Toque onPress={() => setVer(!ver)} accessibilityLabel={ver ? "Hide password" : "Show password"}><Text style={{ color: c.muted, fontSize: 12 }}>{ver ? "ocultar" : "ver"}</Text></Toque>}
              />
            </Entra>

            {erro && <Entra><Text style={{ color: c.danger, marginTop: 12 }}>{erro}</Text></Entra>}
            {aviso && <Entra><Text style={{ color: c.sage, marginTop: 12 }}>{aviso}</Text></Entra>}

            <Entra delay={360}>
              <Botao titulo={criando ? "Create account" : "Entrar"} onPress={enviar} carregando={enviando} desabilitado={!email || senha.length < 6} estilo={{ marginTop: 22 }} />
            </Entra>
            {!criando && (
              <Toque onPress={esqueci} style={{ marginTop: 16, alignItems: "center", padding: 6 }}>
                <Text style={{ color: c.muted }}>Forgot my password</Text>
              </Toque>
            )}
            {CADASTRO_ABERTO && (
              <Toque onPress={() => { setCriando(!criando); setErro(null); }} style={{ marginTop: 4, alignItems: "center", padding: 6 }}>
                <Text style={{ color: c.muted }}>{criando ? "I already have an account" : "First time? Create account"}</Text>
              </Toque>
            )}
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
