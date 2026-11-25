import { Text, View } from "react-native";
import { GRUPO, type Conexao, type GrupoConexao, type Nota } from "../lib/types";
import { useCores } from "../theme";
import { Entra, Toque } from "./anim";

export const NOME_GRUPO: Record<GrupoConexao, string> = { sentido: "Sentido", passagem: "Passagem", tema: "Tema" };

export function useCorGrupo() {
  const c = useCores();
  return (g: GrupoConexao) => (g === "sentido" ? c.accent : g === "passagem" ? c.sage : c.muted);
}

// "Por que está ligada": cada conexão com o motivo.
export function ListaConexoes({ notaId, conexoes, notas, aoAbrir }: { notaId: string; conexoes: Conexao[]; notas: Nota[]; aoAbrir: (id: string) => void }) {
  const c = useCores();
  const cor = useCorGrupo();
  const lista = conexoes
    .filter((x) => x.a === notaId || x.b === notaId)
    .map((x) => ({ ...x, outro: x.a === notaId ? x.b : x.a }))
    .sort((x, y) => y.peso - x.peso);
  if (!lista.length) return <Text style={{ color: c.muted, fontSize: 14 }}>Ainda sem conexões com outras notas.</Text>;
  const porId = new Map(notas.map((n) => [n.id, n]));
  return (
    <View style={{ gap: 8 }}>
      {lista.map((x, i) => {
        const g = GRUPO[x.tipo];
        const outra = porId.get(x.outro);
        return (
          <Entra key={x.id} delay={i * 40}>
            <Toque onPress={() => aoAbrir(x.outro)} style={{ borderWidth: 1, borderColor: c.line, backgroundColor: c.card, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10 }}>
              <Text style={{ color: cor(g), fontSize: 11, fontWeight: "700", letterSpacing: 0.6 }}>{NOME_GRUPO[g].toUpperCase()}</Text>
              <Text style={{ color: c.ink, fontSize: 14, marginTop: 2 }}>{x.motivo}</Text>
              {outra ? <Text numberOfLines={1} style={{ color: c.muted, fontSize: 13, marginTop: 2 }}>{outra.conteudo}</Text> : null}
            </Toque>
          </Entra>
        );
      })}
    </View>
  );
}
