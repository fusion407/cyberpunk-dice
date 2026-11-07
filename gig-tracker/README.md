# Gig Tracker

A mobile-first, offline-ready tabletop companion for Cyberpunk TCG. No framework, accounts, database, API keys, or dependency installation required.

## Run

With Node.js 22 or newer:

```sh
npm start
```

Open `http://localhost:4173`. For a phone on the same Wi-Fi, use the computer’s LAN IP with port 4173. The production site works over HTTPS. Offline caching and standalone installation require HTTPS or localhost.

```sh
npm test
npm run check
```

## Playing

- Each player starts with six Fixer dice and zero Gigs. Use **New match** to choose names and first player.
- **Roll in a Gig** rolls one D6, moves it from Fixer into the active player’s Gig area, and records the face. It is available once per turn.
- If you rolled physically, **End turn** lets you record the physical die before passing. A separate skip option handles exceptional table states.
- **Steal 1** transfers one die from the rival without changing the total in play. **+ / −** manually adjust Gigs; they do not consume Fixer dice.
- **Quick roll** rolls one to six D6 without affecting the match.
- On mobile (up to 600px wide), tap the central **VS** button to switch to **face-to-face table view**. Player Two faces the opposite end of the phone. Each half has its own turn progress, Gig controls, free D6 roller, and end-turn button. Tap **VS** again to restore the standard layout. This preference is saved separately from the match; switching views does not affect Gigs, turns, or undo. Desktop keeps the standard layout.
- **Undo** reverses match actions, including a victory or new match. Match state and undo history are saved on the device; two tabs synchronize through browser storage events.
- **Match settings** can correct Fixer reserves for card effects or record a concession/deck-out. **Export** downloads the last 100 match events.

## Victory rules

Checked against the [official comprehensive rules](https://cyberpunktcg.com/comprehensive-rules), §§1.10–1.14, on November 7, 2026:

1. During regulation, holding seven or more Gig dice wins at the **beginning of that player’s turn**, before the Start Phase and its new Gig.
2. Overtime begins **after two consecutive turns whose players each began their turn with an empty Fixer**. With six starting Fixer dice rolled in normally, this is after the second player completes their seventh turn. The engine tracks empty starts instead of assuming a fixed turn cutoff, so card effects on Fixer can be represented.
3. When overtime begins, check **both existing Gig totals before handing off the turn**. Seven or more wins immediately. Simultaneous qualification is a draw.
4. During overtime, all Gig count changes immediately check both players for victory.

This is a companion, not a full card simulator. Players must report physical table changes and resolve card-specific alternate win conditions. A die’s face does not change its value of one Gig.

## Files and hosting

- `dist/`: directly deployable static application, manifest, SVG icon, and service worker.
- `dist/game.js`: pure, independently tested match engine.
- `dist/app.js`: interface, secure dice randomness, local saves, undo, export, and dialogs.
- `server.mjs`: local static preview server. Production hosting serves `dist/` directly.
- `.openai/hosting.json`: private Sites project identity and static output declaration.

Fonts use Google Fonts when online and fall back to system fonts. The application itself uses no remote scripts or services. Unofficial fan tool; not affiliated with Cyberpunk TCG or its publisher.
