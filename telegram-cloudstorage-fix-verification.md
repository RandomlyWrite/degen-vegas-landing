# Telegram CloudStorage Compatibility Fix Verification

The reported exception came from reading `Telegram.WebApp.CloudStorage` on a Telegram WebApp client reporting version 6.0. Telegram exposes CloudStorage from Bot API 6.9, and older clients throw from the SDK getter instead of returning `undefined`.

The implementation now checks `isVersionAtLeast("6.9")` first, falls back to the reported version string when that capability method is unavailable, and wraps the supported getter access in `try/catch`. Unsupported Telegram clients therefore use the existing localStorage persistence path without touching the throwing getter.

Validation completed successfully. TypeScript check and production build pass. The live preview loads without console output. A browser simulation using a version 6.0 WebApp and a getter that deliberately throws returned the saved local fallback profile and reported `getterAccessed: false` and `noException: true`.
