import { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { supabase } from "../lib/supabase";
import { gerarRevisao } from "../lib/cerebro";
import type { Fonte, Revisao } from "../lib/types";
import { serif, useCores } from "../theme";
import { Entra, Pensando, Toque } from "./anim";
import { Botao } from "./ui";
import { limparCitacoes } from "../lib/texto";
import { TextoComCitacoes } from "./Citacoes";

const SETE_DIAS = 7 * 86400000;


export function RevisaoCard() {
  const c = useCores();
  const [revisao, setRevisao] = useState<Revisao | null>(null);
  const [fontes, setFontes] = useState<Fonte[]>([]);
  const [gerando, setGerando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [pronto, setPronto] = useState(false);

  useEffect(() => {
    supabase.from("sc_revisoes").select("id, inicio, fim, texto, created_at").order("created_at", { ascending: false }).limit(1)
      .then(({ data }) => { setRevisao((data?.[0] as Revisao | undefined) ?? null); setPronto(true); });
  }, []);

  async function gerar() {
    setGerando(true);
    setErro(null);
    try {
      const r = await gerarRevisao(7);
      setRevisao({ id: r.revisao.id ?? "nova", inicio: r.revisao.inicio, fim: r.revisao.fim, texto: r.revisao.texto, created_at: r.revisao.created_at ?? new Date().toISOString() });
      setFontes(r.fontes);
    } catch (e) {
      setErro((e as Error).message);
    }
    setGerando(false);
  }

  if (!pronto) return null;
  const recente = revisao && Date.now() - new Date(revisao.created_at).getTime() < SETE_DIAS;

  return (
    <Entra delay={140} style={{ marginTop: 22, backgroundColor: c.card, borderColor: c.line, borderWidth: 1, borderRadius: 18, padding: 16 }}>
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" }}>
        <Text style={{ fontFamily: serif, fontSize: 20, color: c.ink }}>Revisão da semana</Text>
        {revisao && !gerando ? (
          <Toque onPress={gerar}><Text style={{ color: c.muted, fontSize: 13 }}>Gerar de novo</Text></Toque>
        ) : null}
      </View>
      {gerando ? (
        <View style={{ marginTop: 12 }}><Pensando texto="Relendo a sua semana" /></View>
      ) : recente && revisao ? (
        <View style={{ marginTop: 10 }}>
          {fontes.length ? <TextoComCitacoes texto={revisao.texto} fontes={fontes} /> : <Text style={{ color: c.ink, fontSize: 16, lineHeight: 24 }}>{limparCitacoes(revisao.texto)}</Text>}
        </View>
      ) : (
        <View style={{ marginTop: 10 }}>
          <Text style={{ color: c.muted, fontSize: 14, lineHeight: 20 }}>Um resumo do que o Senhor tem falado com você nos últimos 7 dias, com temas, passagens e uma pergunta para a próxima semana.</Text>
          <Botao titulo="Gerar revisão" onPress={gerar} estilo={{ marginTop: 12, alignSelf: "flex-start" }} />
        </View>
      )}
      {erro ? <Text style={{ marginTop: 10, color: c.ink, backgroundColor: c.accentSoft, padding: 10, borderRadius: 10 }}>{erro}</Text> : null}
    </Entra>
  );
}
