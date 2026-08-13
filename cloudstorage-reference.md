# Telegram CloudStorage Reference

Source: [Telegram Mini Apps documentation](https://core.telegram.org/bots/webapps#cloudstorage)

The official documentation defines `Telegram.WebApp.CloudStorage` for per-user cloud storage. It supports `setItem(key, value, callback)`, `getItem(key, callback)`, `getItems(keys, callback)`, `removeItem`, `removeItems`, and `getKeys`. Values are strings, so the implementation will serialize the player's chip balance and statistics as JSON.

The documented key constraints are 1–128 characters using letters, numbers, underscore, or hyphen. Values can contain up to 4096 characters, and each bot can store up to 1024 keys per user. The implementation will use one compact key, `degen_vegas_profile_v1`, for the virtual chip balance and game statistics.

The browser preview does not expose `Telegram.WebApp`, so the app will use `localStorage` under the same profile key as a fallback. No private keys, wallet secrets, payment data, or transaction state will be stored.
