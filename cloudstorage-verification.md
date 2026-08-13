# CloudStorage Persistence Verification

The live ordinary-browser preview was tested with a clean profile. The lounge loaded the default 250 virtual chips, one simulated dice play updated the balance to 235 and the visible ledger to `1 PLAYS / VIRTUAL ONLY`, and leaving and re-entering the lounge restored the same 235-chip balance and one-play statistic from localStorage.

The stored JSON included the normalized `chips` value and per-game statistics, including one dice loss and a `lastPlayedAt` timestamp. In Telegram, the same bridge uses `Telegram.WebApp.CloudStorage` under the `degen_vegas_profile_v1` key and falls back to localStorage only if CloudStorage is unavailable or returns an error.
