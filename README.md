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

Press `w` for web, or scan the QR code with Expo Go on a phone.

## Tests

```bash
npm test
```

The tests cover the rules, rejection reasons, unique solutions, and a junior board that the technique solver finishes without guessing. They do not need a simulator.
