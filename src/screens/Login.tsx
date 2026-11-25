import { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { serif, useCores } from "../theme";
import { Botao, Campo } from "../components/ui";

export function Login() {
  const c = useCores();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [criando, setCriando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);

  async function enviar() {
    setErro(null);
    setAviso(null);
    setEnviando(true);
    if (criando) {
      const { data, error } = await supabase.auth.signUp({ email: email.trim(), password: senha });
      if (error) setErro(error.message);
      else if (!data.session) setAviso("Conta criada. Confirme o email que enviamos e depois entre.");
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password: senha });
      if (error) setErro("Email ou senha incorretos.");
    }
    setEnviando(false);
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: c.paper, justifyContent: "center", padding: 24 }}>
      <Text style={{ fontFamily: serif, fontSize: 36, color: c.ink }}>Segundo Cérebro</Text>
      <Text style={{ color: c.muted, marginTop: 6, marginBottom: 28 }}>Suas anotações, conectadas.</Text>

      <Text style={{ color: c.muted, fontSize: 13, marginBottom: 4 }}>Email</Text>
      <Campo
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
      />
      <Text style={{ color: c.muted, fontSize: 13, marginTop: 14, marginBottom: 4 }}>Senha</Text>
      <Campo
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={criando ? "new-password" : "current-password"}
      />

      {erro && <Text style={{ color: c.danger, marginTop: 12 }}>{erro}</Text>}
      {aviso && <Text style={{ color: c.sage, marginTop: 12 }}>{aviso}</Text>}

      <Botao
        titulo={criando ? "Criar conta" : "Entrar"}
        onPress={enviar}
        carregando={enviando}
        desabilitado={!email || senha.length < 6}
        estilo={{ marginTop: 22 }}
      />
      <Pressable onPress={() => setCriando(!criando)} style={{ marginTop: 18, alignItems: "center" }}>
        <Text style={{ color: c.muted }}>{criando ? "Já tenho conta" : "Primeiro acesso? Criar conta"}</Text>
      </Pressable>
    </SafeAreaView>
  );
}
