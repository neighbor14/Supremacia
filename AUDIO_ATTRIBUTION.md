# Audio Attribution — Supremacia Digital

All sound effects used in this game are licensed under **Creative Commons Zero (CC0)** or equivalent permissive licenses, allowing free use in commercial and non-commercial projects without attribution requirement.

## Audio Sources

### Kenney UI Audio Pack
**Source:** https://github.com/Calinou/kenney-ui-audio  
**Original Creator:** Kenney (https://kenney.nl/)  
**License:** CC0 (Creative Commons Zero)  
**Files Used:**
- `button-click.ogg` — click1.wav (UI button interaction)
- `menu-open.ogg` — switch3.wav (menu/panel open)
- `menu-close.ogg` — switch7.wav (menu/panel close)
- `dice-roll.ogg` — rollover3.wav (dice/random event)

### rse/soundfx Pack
**Source:** https://github.com/rse/soundfx  
**Original Creator:** Ralf S. Engelschall  
**License:** CC0 (Creative Commons Zero)  
**Files Used:**
- `turn-start.ogg` — chime1.mp3 (turn/phase transition)
- `resource-gain.ogg` — bling1.mp3 (positive resource event)
- `resource-loss.ogg` — slide2.mp3 (negative resource event)
- `diplomacy-alert.ogg` — beep3.mp3 (diplomacy/notification)
- `combat-start.ogg` — cannon1.mp3 (combat initiation)
- `combat-hit.ogg` — punch1.mp3 (combat damage/hit)
- `missile-launch.ogg` — whoosh3.mp3 (missile/projectile launch)
- `explosion.ogg` — cannon2.mp3 (explosion/nuclear blast)
- `territory-conquered.ogg` — fanfare1.mp3 (victory/conquest)
- `error.ogg` — error1.mp3 (invalid action/error)
- `victory.ogg` — fanfare2.mp3 (game victory)
- `defeat.ogg` — resonance2.mp3 (game defeat)

## License Summary

All audio files have been:
1. Downloaded from their respective open-source repositories
2. Converted to OGG Vorbis format for web optimization
3. Compressed to reduce file size while maintaining quality
4. Used in compliance with CC0 license terms

**CC0 License Statement:**  
> "Creative Commons Zero (CC0) is a public dedication tool, which enables creators to give up their copyright and put their works into the worldwide public domain."

No attribution is legally required, but we acknowledge and thank:
- **Kenney** for the comprehensive UI audio pack
- **Ralf S. Engelschall** for the diverse soundfx collection

## Implementation

Audio files are stored in `/manus-storage/` and loaded dynamically by the game engine (`src/game/audio.ts`). The audio system includes:
- Global volume control (0-100%)
- Mute toggle
- Per-sound volume adjustment
- Preloading for instant playback
- LocalStorage persistence of user preferences

## Additional Notes

- All audio is used for non-commercial educational/prototype purposes
- The game respects user preferences (mute state, volume level)
- Audio can be disabled entirely by the user via the audio controls UI
- No audio is tracked, logged, or sent to external servers
