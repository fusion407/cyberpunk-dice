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

- Each player starts with exactly one D4, D6, D8, D10, D12 and D20 in Fixer. Use **New match** to choose names and first player.
- **Choose Gig** lets the active player select any remaining Fixer die once per turn. D20 stays locked until it is the only die left. Roll the selected die digitally or record its physical face; it moves from Fixer into the Gig area.
- Launching, resuming, starting a match, or handing off a turn keeps the board visible. The active card prompts **Roll your Gig**; tap **Choose Gig** to open the picker. Stealing is locked for both sides until the active player rolls or records that turn’s Gig. Free rolls, value edits, and restoring removed dice do not unlock it. Once Fixer is empty, no roll is required. Start-of-turn victory is checked before a new roll.
- **Street Cred** sums the faces of controlled Gigs. With no Gigs it reads **No Gigs yet**, rather than exposing the rules’ “Null” value. The separate Gig count stays **0**; each die counts as one Gig regardless of its face.
- **End turn** offers the same choice if a physical Gig has not yet been recorded. A separate skip option handles exceptional table states.
- **Steal** lets you select the exact opposing Gigs. All selected Gigs transfer together, preserving their IDs, original owners, types and rolled values. Duplicate die types from different owners remain distinct.
- Tap either player’s Gig to open a large **− / +** value editor for card effects. Each tap changes the draft face by one; the editor shows the change and resulting Street Cred. **Save face** applies it as one undoable action; closing cancels it. Faces stay between 1 and the die’s maximum. The editor also supports rerolls and Fixer returns. **−** on a player card removes a selected Gig; **+** restores a removed die or opens Fixer selection on the active player’s turn.
- **Quick roll** supports D4, D6, D8, D10, D12 and D20, with one to six dice per roll. It never changes the match. D20-last applies to rolling Gigs from Fixer; free D20 rolls remain available for setup and other purposes.
- On phones, tablets (up to 1200px wide), and larger touch screens, tap **VS** to switch to **face-to-face table view**. Player Two faces the opposite end of the device. Each half has turn progress, Gig controls, a polyhedral free roller, larger Street Cred totals, and an end-turn button. Tap **VS** again to restore the standard layout. The preference is separate from the match. The Gig editor faces the active player when editing either side; **Rotate editor** faces the other player for reactions. Wide desktops without touch keep the standard layout.
- **Undo** reverses match actions, including a victory or new match. Match state and undo history are saved on the device; two tabs synchronize through browser storage events.
- **Match settings** can assign the 12 physical dice to either player’s Fixer/Gig area or out of play, correct faces for card effects, or record a concession/deck-out. **Export** downloads typed dice, values, owners, and the last 100 match events.

Older saves and undo history retain their counts, faces and turns. A fresh match upgrades automatically. An in-progress D6-only save requires a one-time physical dice setup because its types and original owners were never recorded; the app does not guess them. Match controls resume after all 12 dice are identified.

Use the saved-dice banner’s **×** to discard the old match and start fresh with the same player names and first player. The banner stays dismissed after reload. **Undo** restores the old match and its setup prompt if dismissed accidentally.

## Sound and visual effects

Successful steals randomly pair a short-circuit sound with an electric border or a katana impact with red slashes on the player losing the Gigs. Gaining or restoring a Gig randomly uses a quickhack or braindance cue. Saving a changed face (including a reroll to a different face) plays the eddies money jingle. Multi-Gig steals play one cue. Cancelled edits, unchanged faces, rejected moves, undo, free rolls and save synchronization stay quiet.

Use the speaker button in the header or either face-to-face player half to mute. **Match settings → Sound & effects** includes saved volume, separate sound and visual toggles, and previews of all five clips. Preferences save immediately, independently of the match. Effects respect reduced-motion preferences. Audio stops when the app goes into the background, and a new cue replaces any previous cue.

All five clips work offline once the app has cached. No runtime connection to SoundDB is needed. [Sound credits and download links](dist/audio/README.md) list the exact SoundDB events and IDs; original Ogg files and level-matched WAV versions are included in `dist/audio/`.

## Victory rules

Checked against the [official comprehensive rules](https://cyberpunktcg.com/comprehensive-rules), §§1.10–1.14, on November 7, 2026:

Physical dice behavior was also checked against the supplied official PDF: §§6.1 and 7.2 (six die types), §8.6.5.1.1 (D20 last), and §11.5.1 (selected Gigs move together without changing values).

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
- Root `vercel.json`: production static hosting configuration. Optional local `.openai/hosting.json` metadata is excluded from GitHub.

Fonts use Google Fonts when online and fall back to system fonts. The application itself uses no remote scripts or services. Unofficial fan tool; not affiliated with Cyberpunk TCG or its publisher.
