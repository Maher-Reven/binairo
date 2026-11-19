# Binairo

A local Binairo (Takuzu) puzzle. One Expo app runs in the browser and as a phone binary. Campaign lessons teach the rules on fixed boards. Practice deals a new board at the lesson you are on. Points and streaks stay on the device. There is no account, score server, share sheet, or leaderboard yet.

Hint costs are provisional: Junior 0, Medium 10, Intermediate 25, Advanced 40. A hint that finds nothing is free, and points never go below 0.

## Run the web build

```bash
npm install
npm run web
```

That starts the Expo dev server and opens the app in a browser. For a static export:

```bash
npm run build:web
```

The site is written to `dist/`. Serve that folder with any static file server.

## Start the Expo dev server

```bash
npm install
npm start
```

Press `w` for web. The same server is what Expo Go opens.

## Open in Expo Go

Install Expo Go for SDK 58 on a phone, then:

```bash
npm install
npm start
```

Scan the QR code in the terminal. Expo Go loads this project and shows the same board, coach, and pad as the web app. With an emulator already running, `npx expo start --android` or `npx expo start --ios` opens that same Expo Go UI.

The app id is `com.maherreven.binairo` on both platforms. The URL scheme is `binairo`.

## Local native binary

`android/` and `ios/` are generated from `app.json` and are not committed.

```bash
npm install
npm run prebuild
```

Compile a debug binary and install it on a connected device or emulator:

```bash
npm run android
```

```bash
npm run ios
```

`npm run android` needs a local Android SDK. `npm run ios` needs macOS and Xcode. A debug build uses the local debug keystore, or the Apple development certificate already on that Mac. This repo does not store Play or App Store signing secrets.

## Tests

```bash
npm test
```

The tests cover the rules, rejection reasons, unique solutions, and a junior board that the technique solver finishes without guessing. They do not need a simulator.
