import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import { useEffect, useState } from "react";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { supabase } from "../lib/supabase";
import { usePerfil } from "../lib/perfil";
import { sincronizar } from "../lib/fila";
import type { Abas } from "../lib/types";
import { serif, useCores } from "../theme";
import { Avatar } from "../components/Avatar";
import { Icon } from "../components/Icon";
import { Botao, Campo } from "../components/ui";
import { Entra, Pop, Toque } from "../components/anim";
import { useDados } from "../lib/dados";
import { useLeitura } from "../lib/leitura";

export function Perfil() {
  const c = useCores();
  const nav = useNavigation<BottomTabNavigationProp<Abas>>();
  const { perfil, salvar } = usePerfil();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [ocupado, setOcupado] = useState(false);
  const [ok, setOk] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const { notas } = useDados();
  const { lidos } = useLeitura();
  const [desde, setDesde] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? "");
      if (data.user?.created_at) setDesde(new Date(data.user.created_at).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }));
    });
  }, []);
  useEffect(() => { if (perfil) setNome(perfil.nome ?? ""); }, [perfil]);

  async function trocarFoto() {
    setErro(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setErro("Permita o acesso às fotos para escolher uma imagem."); return; }
      const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: "images", allowsEditing: true, aspect: [1, 1], quality: 1 });
      if (r.canceled || !r.assets[0]) return;
      setOcupado(true);
      const ref = await ImageManipulator.manipulate(r.assets[0].uri).resize({ width: 256 }).renderAsync();
      const img = await ref.saveAsync({ compress: 0.8, format: SaveFormat.JPEG, base64: true });
      await salvar({ avatar: `data:image/jpeg;base64,${img.base64}` });
    } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  }

  async function guardarNome() {
    setErro(null);
    setOcupado(true);
    try { await salvar({ nome: nome.trim() || null }); setOk(true); setTimeout(() => setOk(false), 1800); } catch (e) { setErro((e as Error).message); }
    setOcupado(false);
  }

  return (
    <SafeAreaView edges={["top"]} style={{ flex: 1, backgroundColor: c.paper }}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 110 }} keyboardShouldPersistTaps="handled">
        <Entra style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
          <Text style={{ fontFamily: serif, fontSize: 32, color: c.ink }}>Perfil</Text>
          <Toque onPress={() => nav.navigate("Hoje")}><Text style={{ color: c.muted }}>Fechar ✕</Text></Toque>
        </Entra>

        <Entra delay={60} style={{ marginTop: 18, alignItems: "center", backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 28, padding: 24 }}>
          <Toque onPress={trocarFoto} accessibilityLabel="Trocar foto de perfil">
            <Pop><Avatar tamanho={112} /></Pop>
            <View style={{ position: "absolute", right: 0, bottom: 0, backgroundColor: c.accent, borderRadius: 16, padding: 7 }}>
              <Icon nome="editar" cor={c.onAccent} tamanho={16} />
            </View>
          </Toque>
          <Text style={{ color: c.muted, marginTop: 10 }}>{ocupado ? "Salvando…" : "Toque na foto para trocar"}</Text>
          {perfil?.avatar ? <Toque onPress={() => salvar({ avatar: null }).catch((e) => setErro((e as Error).message))} style={{ padding: 6 }}><Text style={{ color: c.muted, fontSize: 12 }}>Remover foto</Text></Toque> : null}

          <View style={{ alignSelf: "stretch", flexDirection: "row", gap: 10, marginTop: 18 }}>
            {([["Notas", notas ? notas.length : "–"], ["Capítulos lidos", lidos ? lidos.size : "–"]] as const).map(([r, v]) => (
              <View key={r} style={{ flex: 1, backgroundColor: c.paper, borderColor: c.line, borderWidth: 1, borderRadius: 16, padding: 12 }}>
                <Text style={{ fontFamily: serif, fontSize: 24, color: c.accent }}>{v}</Text>
                <Text style={{ color: c.muted, fontSize: 12 }}>{r}</Text>
              </View>
            ))}
          </View>
          {desde ? <Text style={{ color: c.muted, fontSize: 12, marginTop: 10 }}>Membro desde {desde}</Text> : null}

          <View style={{ alignSelf: "stretch", marginTop: 18, gap: 8 }}>
            <Text style={{ color: c.muted }}>Como devo te chamar?</Text>
            <Campo value={nome} onChangeText={setNome} placeholder="Seu nome" maxLength={60} />
            <Text style={{ color: c.muted, fontSize: 12 }}>{email}</Text>
          </View>
          <Botao titulo={ok ? "Salvo ✓" : "Salvar"} onPress={guardarNome} carregando={ocupado} estilo={{ marginTop: 16, alignSelf: "stretch" }} />
        </Entra>

        {erro ? <Entra style={{ marginTop: 14, backgroundColor: c.accentSoft, padding: 12, borderRadius: 12 }}><Text style={{ color: c.ink }}>{erro}</Text></Entra> : null}

        <Entra delay={120}>
          <Toque onPress={async () => { await sincronizar().catch(() => undefined); await supabase.auth.signOut(); }} style={{ flexDirection: "row", alignItems: "center", gap: 8, marginTop: 24 }}>
            <Icon nome="sair" cor={c.muted} />
            <Text style={{ color: c.muted }}>Sair da conta</Text>
          </Toque>
        </Entra>
      </ScrollView>
    </SafeAreaView>
  );
}
