import { useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// Ditado por voz (reconhecimento do próprio Android), em português do Brasil.
export function useDitado(aoFinalizarTrecho: (texto: string) => void) {
  const [ativo, setAtivo] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const cb = useRef(aoFinalizarTrecho);
  cb.current = aoFinalizarTrecho;

  useSpeechRecognitionEvent("result", (ev) => {
    if (ev.isFinal) {
      const t = ev.results?.[0]?.transcript?.trim();
      if (t) cb.current(t);
    }
  });
  useSpeechRecognitionEvent("end", () => setAtivo(false));
  useSpeechRecognitionEvent("error", (ev) => {
    setAtivo(false);
    if (ev.error !== "aborted" && ev.error !== "no-speech") setErro("Não consegui ouvir agora. Tente de novo.");
  });

  async function alternar() {
    if (ativo) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    setErro(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setErro("Permita o microfone nas configurações do aparelho.");
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: "pt-BR", interimResults: false, continuous: true });
    setAtivo(true);
  }

  return { ativo, erro, alternar };
}
