# Sound effects and sources

Selected from [Cyberpunk 2077 SoundDB](https://sounddb.redmodding.org/) on November 7, 2026. Audio comes from Cyberpunk 2077 by CD PROJEKT RED; SoundDB is maintained by Zhincore with the Red Modding community.

| App trigger | SoundDB event and sound ID | Original download | App file |
| --- | --- | --- | --- |
| Steal: electric border on the player losing Gigs | [`quickhack_shortcircuit_mech` · 213913715](https://sounddb.redmodding.org/sfx/213913715) | [Ogg](https://static.zhincore.eu/cp/sfx/213913715.ogg) | `short-circuit.wav` |
| Steal: red slash on the player losing Gigs | [`w_melee_katana_impact_flesh` · 340855277](https://sounddb.redmodding.org/sfx/340855277) | [Ogg](https://static.zhincore.eu/cp/sfx/340855277.ogg) | `katana-slash.wav` |
| Gain or restore a Gig: quickhack variant | [`quickhack_ping` · 267319548](https://sounddb.redmodding.org/sfx/267319548) | [Ogg](https://static.zhincore.eu/cp/sfx/267319548.ogg) | `quickhack.wav` |
| Gain or restore a Gig: braindance variant | [`g_sc_bd_rewind_pause` / `g_sc_bd_rewind_pause_forced` · 161544332](https://sounddb.redmodding.org/sfx/161544332) | [Ogg](https://static.zhincore.eu/cp/sfx/161544332.ogg) | `braindance.wav` |
| Save a manually changed Gig face: eddies | [`ui_jingle_money` · 1071788574](https://sounddb.redmodding.org/sfx/1071788574) | [Ogg](https://static.zhincore.eu/cp/sfx/1071788574.ogg) | `eddies.wav` |
| Press VS to switch views, in either direction | [`sq027_sc_06_panam_press_button` · 228787330](https://sounddb.redmodding.org/sfx/228787330) | [Ogg](https://static.zhincore.eu/cp/sfx/228787330.ogg) | `vs-button.wav` |
| Digital Gig roll, Gig reroll, Quick roll, or battle-mode free roll | [`ui_hacking_access_granted` · 522533917](https://sounddb.redmodding.org/sfx/522533917) | [Ogg](https://static.zhincore.eu/cp/sfx/522533917.ogg) | `dice-reveal.wav` |
| Any roll containing at least one MAX FACE, including a recorded physical maximum | [`ui_jingle_technical_ability_skillcheck` · 422363277](https://sounddb.redmodding.org/sfx/422363277) | [Ogg](https://static.zhincore.eu/cp/sfx/422363277.ogg) | `max-face.wav` |

Max Face rolls use a compact 2.83-second technical-skill success stinger, selected on November 9, 2026. It replaces the normal roll/acquisition cue rather than layering over it, and plays once per reveal even if several dice show their maximum. A mixed roll qualifies if any die shows MAX FACE. The original full-length clip is preserved; its WAV playback version uses the same normalization and master volume as the other sounds. Sound mute, volume, and offline playback all apply.

The two steal variants have equal probability, as do the two acquisition variants. One cue plays per completed action, including a multi-Gig steal or a six-die free roll. Digital rolls and rerolls use the dice-reveal cue instead of the acquisition or eddies cue. Recorded physical dice retain the acquisition cue and show a static confirmation. No cues play for cancelled dialogs, unchanged saved faces, failed moves, undo, loading a save, cross-tab match synchronization, or administrative inventory corrections. When rolling a Gig and ending the turn together, the reveal faces the player who received the Gig. The dice-reveal clip was selected from SoundDB on November 9, 2026.

Original downloads are preserved as `.ogg` files beside their playable derivatives. The app uses mono 24 kHz, 16-bit PCM WAV versions resampled with the browser's OfflineAudioContext, then peak-normalized to 0.7 (about −3.1 dBFS). This keeps playback levels consistent and works on older iPhones without Ogg support. Clips retain their complete duration; a new cue stops the previous one. Default volume is 45%.

Every VS press restarts the short button click and a brief yellow/cyan ring pulse, including when switching back to standard view. The button is slightly larger and brighter. Muting suppresses its sound; disabling visual effects suppresses its pulse. Reduced motion uses a stationary highlight instead of expanding rings. View switching does not alter the match or undo history.

`sources.json` records original URLs, IDs, durations, and SHA-256 hashes for both formats. The app caches all eight WAV clips with its service worker and makes no SoundDB requests at runtime. Sound, volume and visual preferences are saved independently from the match. Visuals respect the system's reduced-motion preference and can be disabled independently from audio.
