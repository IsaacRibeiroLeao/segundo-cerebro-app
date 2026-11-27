import { useEffect, useRef, useState } from "react";
import { AudioQuality, IOSOutputFormat, RecordingOptions, requestRecordingPermissionsAsync, setAudioModeAsync, useAudioRecorder } from "expo-audio";

const MAX_SEGUNDOS = 90;

// AAC (ADTS) mono: formato que o Gemini entende e que fica pequeno.
const OPCOES: RecordingOptions = {
  extension: ".aac",
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 32000,
  android: { extension: ".aac", outputFormat: "aac_adts", audioEncoder: "aac" },
  ios: { outputFormat: IOSOutputFormat.MPEG4AAC, audioQuality: AudioQuality.MEDIUM, linearPCMBitDepth: 16, linearPCMIsBigEndian: false, linearPCMIsFloat: false },
  web: { mimeType: "audio/webm", bitsPerSecond: 32000 },
};

async function paraBase64(uri: string): Promise<string> {
  const blob = await (await fetch(uri)).blob();
  return await new Promise((ok, falha) => {
    const fr = new FileReader();
    fr.onerror = () => falha(new Error("read"));
    fr.onloadend = () => ok(String(fr.result).split(",")[1] ?? "");
    fr.readAsDataURL(blob);
  });
}

// Grava a voz e entrega o áudio (AAC, base64) para transcrição no servidor.
export function useGravador(aoTerminar: (base64: string, mime: string) => void | Promise<void>) {
  const rec = useAudioRecorder(OPCOES);
  const [gravando, setGravando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const cb = useRef(aoTerminar);
  cb.current = aoTerminar;
  const encerrando = useRef(false);

  function parouTimer() {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
  }

  async function finalizar(enviar: boolean) {
    if (encerrando.current) return;
    encerrando.current = true;
    parouTimer();
    setGravando(false);
    try {
      await rec.stop();
      await setAudioModeAsync({ allowsRecording: false });
      if (enviar && rec.uri) await cb.current(await paraBase64(rec.uri), "audio/aac");
    } catch {
      setErro("Couldn't process the recording.");
    }
    encerrando.current = false;
  }

  async function iniciar() {
    setErro(null);
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted) {
        setErro("Allow the microphone in your device settings.");
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await rec.prepareToRecordAsync();
      rec.record();
      setSegundos(0);
      setGravando(true);
      timer.current = setInterval(() => {
        setSegundos((x) => {
          if (x + 1 >= MAX_SEGUNDOS) void finalizar(true);
          return x + 1;
        });
      }, 1000);
    } catch {
      parouTimer();
      setGravando(false);
      setErro("Couldn't start recording.");
    }
  }

  useEffect(() => () => parouTimer(), []);
  return { gravando, segundos, erro, iniciar, parar: () => finalizar(true), cancelar: () => finalizar(false) };
}
