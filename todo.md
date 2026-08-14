# Telegram WebApp Integration Checklist

- [x] Add the Telegram WebApp SDK script and TypeScript declarations.
- [x] Bootstrap Telegram WebApp readiness and theme expansion in the React app.
- [x] Read the current Telegram user handle and profile photo with ordinary-browser fallback.
- [x] Display the Telegram profile in the lounge header and wallet/player panel.
- [x] Verify the preview flow, build, and Telegram-aware behavior.
- [x] Save a project checkpoint and deliver the updated version.

## CloudStorage Persistence

- [x] Add CloudStorage key and normalized player-progress data model.
- [x] Load and save chips and per-game statistics through Telegram CloudStorage.
- [x] Add localStorage fallback for ordinary browser previews.
- [x] Verify balance and statistics restore after leaving and re-entering the lounge.
- [x] Save a project checkpoint and deliver the persistent stats update.

## Telegram CloudStorage Compatibility Fix

- [x] Guard CloudStorage access behind the Telegram WebApp version capability check.
- [x] Prevent unsupported getter access from throwing during page initialization.
- [x] Preserve localStorage fallback for Telegram clients below Bot API 6.9 and browser previews.
- [x] Validate the unsupported-version path and production build.
- [x] Save a project checkpoint and deliver the fix.

## Priority Lounge and Entrance Refactor

- [ ] Remove all wallet connection UI and wallet-specific copy from the lounge.
- [ ] Refactor the lounge header around Telegram identity, virtual chips, and refill cooldown.
- [ ] Add a free virtual-chip refill action with a visible cooldown.
- [ ] Split the entrance into independently fading layers and target the doors during the push-in.
- [ ] Verify wallet removal, refill state, transition timing, and responsive behavior.
- [ ] Save a project checkpoint and deliver the refactor.
