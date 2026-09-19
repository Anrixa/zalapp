# @zal/mobile

Zal for iOS and Android — Expo Router on React Native.

## Running it

```bash
pnpm --filter @zal/mobile start      # then press i / a, or scan the QR
```

On a physical phone, `localhost` means the phone, so point the app at your
machine instead:

```bash
EXPO_PUBLIC_API_URL=http://192.168.1.10:4000/api pnpm --filter @zal/mobile start
```

With no override the app uses the packager's own host, which is the machine
running the API — so on a simulator, and usually on a device over the same
Wi-Fi, it just works.

## Two dependencies that look out of place

- **`query-string`** — `expo-router@4.0.22` imports it in
  `build/fork/getPathFromState.js` without declaring it, and current
  `@react-navigation` no longer drags it in. Under a hoisting package manager
  it happened to be present anyway; here it has to be asked for. Remove it once
  Expo Router declares it.
- **`@babel/runtime`** — the transpiled output references its helpers at
  runtime, and nothing in the Expo stack declares it either.

Both exist so `expo export` resolves. Neither is imported by our own code.

## Fonts

Fraunces and Plus Jakarta Sans are installed from `@expo-google-fonts/*` rather
than fetched at runtime, so the first launch renders in the brand faces with no
network and no flash of a fallback.
