# Telegram WebApp Integration Verification

In the ordinary browser preview, the official Telegram WebApp SDK is loaded as an optional global, but no Telegram context is present. The app correctly falls back to a local `DV` avatar, the label `Visitor`, and the status `BROWSER PREVIEW`.

The Enter the Lounge flow was simulated in the live preview. After skipping the cinematic entry video, the lounge rendered successfully with the player identity block visible, the profile avatar fallback present, and all existing wallet and mini-game controls intact.

When the same page is opened inside Telegram, `initDataUnsafe.user` is mapped into the lounge identity block as the Telegram handle (or first and last name) and `photo_url` is rendered as the circular profile image. The SDK bootstrap calls `ready()` and `expand()`, and applies the DEGEN VEGAS dark header/background colors.
