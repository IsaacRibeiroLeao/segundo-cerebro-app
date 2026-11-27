import { useRef, useState } from "react";
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from "expo-speech-recognition";

// Ditado por voz (reconhecimento do próprio Android), em inglês ou português.
export function useDitado(aoFinalizarTrecho: (texto: string) => void, idioma = "en-US") {
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
    if (ev.error !== "aborted" && ev.error !== "no-speech") setErro("I couldn't hear you just now. Try again.");
  });

  async function alternar() {
    if (ativo) {
      ExpoSpeechRecognitionModule.stop();
      return;
    }
    setErro(null);
    const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!perm.granted) {
      setErro("Allow the microphone in your device settings.");
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: idioma, interimResults: false, continuous: true });
    setAtivo(true);
  }

  return { ativo, erro, alternar };
}
