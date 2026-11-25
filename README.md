# Segundo Cérebro (app Android)

App mobile (Expo / React Native) do Segundo Cérebro. Usa o mesmo Supabase do site: mesmas notas, mesmo login, mesma Edge Function de IA (`cerebro`).

## Rodar

```bash
cp .env.example .env     # preencha URL e chave publicável do Supabase
npm install
npx expo start           # abra no Expo Go (Android) ou emulador
```

## Gerar o APK para instalar no celular

```bash
npm install -g eas-cli
eas login
eas build -p android --profile preview
```

Ao terminar, o EAS gera um link para baixar o `.apk`.

## Ícones

Coloque os ícones finais em `assets/` (`icon.png`, `android-icon-foreground.png`, `android-icon-background.png`, `splash-icon.png`) e, se quiser trocar os ícones das abas, edite `src/components/Icon.tsx`.

## Estrutura

- `src/screens/`: Hoje, Notas, Conversar, Mapa e Login.
- `src/lib/cerebro.ts`: chamadas à Edge Function.
- `src/lib/grafo.ts`: cálculo do mapa de conexões.
