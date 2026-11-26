import AsyncStorage from "@react-native-async-storage/async-storage";
import { limparPerfil } from "./perfil";

// Tudo que fica no aparelho e pertence a quem estava logado. A fila de notas offline fica de fora:
// ela é enviada antes de sair (ver Perfil) para não perder nada.
const CHAVES_LOCAIS = ["sc_chat_v1", "sc_rascunho_v1", "sc_cache_v2"];

export async function limparDadosLocais() {
  await AsyncStorage.multiRemove(CHAVES_LOCAIS).catch(() => undefined);
  await limparPerfil();
}
