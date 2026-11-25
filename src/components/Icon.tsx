import { Image } from "react-native";
import Svg, { Path } from "react-native-svg";

export type NomeIcone = "hoje" | "notas" | "conversar" | "mapa" | "sair" | "apagar" | "editar";

const imagens = {
  hoje: require("../../assets/icons/tab-hoje.png"),
  notas: require("../../assets/icons/tab-notas.png"),
  conversar: require("../../assets/icons/tab-conversar.png"),
  mapa: require("../../assets/icons/tab-mapa.png"),
} as const;

const tracos = {
  sair: "M10 4H5v16h5M15 8l4 4-4 4M19 12H9",
  apagar: "M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13",
  editar: "M4 20l1-5L16 4l4 4L9 19z",
} as const;

export function Icon({ nome, cor, tamanho = 22 }: { nome: NomeIcone; cor: string; tamanho?: number }) {
  if (nome in imagens) {
    const fonte = imagens[nome as keyof typeof imagens];
    return <Image source={fonte} style={{ width: tamanho + 4, height: tamanho + 4, tintColor: cor }} resizeMode="contain" />;
  }
  return (
    <Svg
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke={cor}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d={tracos[nome as keyof typeof tracos]} />
    </Svg>
  );
}
