# Binairo

A local Binairo (Takuzu) puzzle. One Expo app runs in the browser and as a phone binary. Before the first board you pick Junior, Medium, Intermediate, or Advanced, or the daily board. Back returns to that list and leaves the board where it was. Each tier keeps its own board on the device. The daily board is separate: the same puzzle for a local calendar day on every device, derived from the date. Finishing it shows one shareable line with the time, the hints used, and whether the solve was clean. That line does not include the board. The tier list shows the daily streak. It increases when the first board you finish on a local day is the day after the previous one. A daily board and a tier board both count. The same day does not add another, and a missed day brings it back to 1 on the next finish. Each campaign lesson can earn three stars: a clean finish, a finish at or under the move par, and a finish with no hint. Replaying can add a missing star. It does not take one away. Campaign lessons teach the rules on fixed boards. Practice deals a new board at the lesson you are on. Points and streaks stay on the device. There is no account or score server.

Hint costs are provisional: Junior 0, Medium 10, Intermediate 25, Advanced 40. Hints on the daily board are free, and the result line counts how many were used. A hint that fills a cell says, in one sentence, why that cell was forced, naming no-triple, balance, or uniqueness. A hint that finds nothing is free and gives no explanation. Points never go below 0.

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

The hosted game is [https://maher-reven.github.io/binairo/](https://maher-reven.github.io/binairo/). Every push to `main` exports the web app and publishes that folder with GitHub Actions. The workflow sets `EXPO_BASE_URL=/binairo`, so the scripts and images load from that Pages path. A local `npm run build:web` leaves the base path empty and is meant for a server root.

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

The tests cover the rules, rejection reasons, unique solutions, a junior board that the technique solver finishes without guessing, which board a tier starts on, that each tier keeps its own board, that the daily board is the same puzzle for a date, that a daily finish and a tier finish share one daily streak, and that a lesson keeps stars it has earned. They do not need a simulator.
