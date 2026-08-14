/*
 * Telegram WebApp profile and CloudStorage bridge.
 * Telegram mode persists virtual player progress per user through CloudStorage.
 * Ordinary browser previews fall back to localStorage under the same profile key.
 */

export type TelegramProfile = {
  id: number;
  firstName: string;
  lastName?: string;
  username?: string;
  languageCode?: string;
  photoUrl?: string;
};

type TelegramUser = {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
  photo_url?: string;
};

type StorageCallback = (error: unknown, value?: string | boolean) => void;

type TelegramCloudStorage = {
  setItem: (key: string, value: string, callback?: StorageCallback) => TelegramCloudStorage;
  getItem: (key: string, callback: (error: unknown, value?: string) => void) => TelegramCloudStorage;
};

type TelegramWebApp = {
  version?: string;
  isVersionAtLeast?: (version: string) => boolean;
  ready: () => void;
  expand: () => void;
  enableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser };
  CloudStorage?: TelegramCloudStorage;
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

export const PLAYER_STORAGE_KEY = "degen_vegas_profile_v1";
export const FREE_REFILL_AMOUNT = 250;
export const FREE_REFILL_COOLDOWN_MS = 2 * 60 * 60 * 1000;
export type GameKey = "dice" | "roulette" | "craps";

export type GameStat = {
  plays: number;
  wins: number;
  losses: number;
  netChips: number;
};

export type PlayerStats = {
  totalPlays: number;
  totalWins: number;
  totalLosses: number;
  lastPlayedAt: number | null;
  dice: GameStat;
  roulette: GameStat;
  craps: GameStat;
};

export type PlayerProgress = {
  chips: number;
  refillAvailableAt: number | null;
  stats: PlayerStats;
};

function freshGameStat(): GameStat {
  return { plays: 0, wins: 0, losses: 0, netChips: 0 };
}

export function createDefaultPlayerProgress(): PlayerProgress {
  return {
    chips: 250,
    refillAvailableAt: null,
    stats: {
      totalPlays: 0,
      totalWins: 0,
      totalLosses: 0,
      lastPlayedAt: null,
      dice: freshGameStat(),
      roulette: freshGameStat(),
      craps: freshGameStat(),
    },
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function normalizeGameStat(value: unknown): GameStat {
  const input = value && typeof value === "object" ? value as Partial<GameStat> : {};
  return {
    plays: isFiniteNumber(input.plays) ? Math.max(0, Math.floor(input.plays)) : 0,
    wins: isFiniteNumber(input.wins) ? Math.max(0, Math.floor(input.wins)) : 0,
    losses: isFiniteNumber(input.losses) ? Math.max(0, Math.floor(input.losses)) : 0,
    netChips: isFiniteNumber(input.netChips) ? Math.round(input.netChips) : 0,
  };
}

export function normalizePlayerProgress(value: unknown): PlayerProgress {
  const fallback = createDefaultPlayerProgress();
  const input = value && typeof value === "object" ? value as Partial<PlayerProgress> : {};
  const rawStats = input.stats && typeof input.stats === "object" ? input.stats as Partial<PlayerStats> : {};
  return {
    chips: isFiniteNumber(input.chips) ? Math.max(0, Math.round(input.chips)) : fallback.chips,
    refillAvailableAt: isFiniteNumber(input.refillAvailableAt) ? Math.max(0, Math.floor(input.refillAvailableAt)) : null,
    stats: {
      totalPlays: isFiniteNumber(rawStats.totalPlays) ? Math.max(0, Math.floor(rawStats.totalPlays)) : 0,
      totalWins: isFiniteNumber(rawStats.totalWins) ? Math.max(0, Math.floor(rawStats.totalWins)) : 0,
      totalLosses: isFiniteNumber(rawStats.totalLosses) ? Math.max(0, Math.floor(rawStats.totalLosses)) : 0,
      lastPlayedAt: isFiniteNumber(rawStats.lastPlayedAt) ? rawStats.lastPlayedAt : null,
      dice: normalizeGameStat(rawStats.dice),
      roulette: normalizeGameStat(rawStats.roulette),
      craps: normalizeGameStat(rawStats.craps),
    },
  };
}

function mapUser(user: TelegramUser): TelegramProfile {
  return {
    id: user.id,
    firstName: user.first_name,
    lastName: user.last_name,
    username: user.username,
    languageCode: user.language_code,
    photoUrl: user.photo_url,
  };
}

export function initTelegram(): TelegramProfile | null {
  if (typeof window === "undefined") return null;

  const webApp = window.Telegram?.WebApp;
  if (!webApp) return null;

  webApp.ready();
  webApp.expand();
  webApp.setHeaderColor?.("#0b0809");
  webApp.setBackgroundColor?.("#0b0809");

  const user = webApp.initDataUnsafe?.user;
  return user ? mapUser(user) : null;
}

function compareVersions(current: string | undefined, required: string) {
  if (!current) return false;
  const currentParts = current.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const requiredParts = required.split(".").map((part) => Number.parseInt(part, 10) || 0);
  const length = Math.max(currentParts.length, requiredParts.length);
  for (let index = 0; index < length; index += 1) {
    const currentPart = currentParts[index] ?? 0;
    const requiredPart = requiredParts[index] ?? 0;
    if (currentPart !== requiredPart) return currentPart > requiredPart;
  }
  return true;
}

function supportsTelegramCloudStorage(webApp: TelegramWebApp) {
  try {
    if (typeof webApp.isVersionAtLeast === "function") {
      return webApp.isVersionAtLeast("6.9");
    }
    return compareVersions(webApp.version, "6.9");
  } catch {
    return false;
  }
}

function getTelegramCloudStorage() {
  if (typeof window === "undefined") return null;
  const webApp = window.Telegram?.WebApp;
  if (!webApp || !supportsTelegramCloudStorage(webApp)) return null;

  // Telegram's SDK exposes CloudStorage through a guarded getter. Access it
  // only after the version check; older clients throw when it is read.
  try {
    return webApp.CloudStorage ?? null;
  } catch {
    return null;
  }
}

function readBrowserProgress(): PlayerProgress {
  if (typeof window === "undefined") return createDefaultPlayerProgress();
  try {
    const raw = window.localStorage.getItem(PLAYER_STORAGE_KEY);
    return raw ? normalizePlayerProgress(JSON.parse(raw)) : createDefaultPlayerProgress();
  } catch {
    return createDefaultPlayerProgress();
  }
}

function writeBrowserProgress(progress: PlayerProgress) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage can be unavailable in private browsing; the in-memory session still works.
  }
}

function readTelegramProgress(storage: TelegramCloudStorage) {
  return new Promise<PlayerProgress>((resolve, reject) => {
    storage.getItem(PLAYER_STORAGE_KEY, (error, value) => {
      if (error) {
        reject(error);
        return;
      }
      if (!value) {
        resolve(createDefaultPlayerProgress());
        return;
      }
      try {
        resolve(normalizePlayerProgress(JSON.parse(value)));
      } catch {
        resolve(createDefaultPlayerProgress());
      }
    });
  });
}

function writeTelegramProgress(storage: TelegramCloudStorage, progress: PlayerProgress) {
  return new Promise<void>((resolve, reject) => {
    storage.setItem(PLAYER_STORAGE_KEY, JSON.stringify(progress), (error, stored) => {
      if (error || stored === false) {
        reject(error ?? new Error("Telegram CloudStorage did not confirm the write."));
        return;
      }
      resolve();
    });
  });
}

export async function loadPlayerProgress(): Promise<PlayerProgress> {
  const cloudStorage = getTelegramCloudStorage();
  if (cloudStorage) {
    try {
      return await readTelegramProgress(cloudStorage);
    } catch {
      return readBrowserProgress();
    }
  }
  return readBrowserProgress();
}

export async function savePlayerProgress(progress: PlayerProgress): Promise<"telegram" | "browser"> {
  const normalized = normalizePlayerProgress(progress);
  const cloudStorage = getTelegramCloudStorage();
  if (cloudStorage) {
    try {
      await writeTelegramProgress(cloudStorage, normalized);
      return "telegram";
    } catch {
      writeBrowserProgress(normalized);
      return "browser";
    }
  }
  writeBrowserProgress(normalized);
  return "browser";
}

export function getRefillRemainingMs(progress: PlayerProgress, now = Date.now()) {
  if (!progress.refillAvailableAt) return 0;
  return Math.max(0, progress.refillAvailableAt - now);
}

export function canClaimFreeRefill(progress: PlayerProgress, now = Date.now()) {
  return getRefillRemainingMs(progress, now) === 0;
}

export function claimFreeRefill(progress: PlayerProgress, now = Date.now()): PlayerProgress | null {
  const normalized = normalizePlayerProgress(progress);
  if (!canClaimFreeRefill(normalized, now)) return null;
  return {
    ...normalized,
    chips: normalized.chips + FREE_REFILL_AMOUNT,
    refillAvailableAt: now + FREE_REFILL_COOLDOWN_MS,
  };
}

export function applyGameResult(progress: PlayerProgress, game: GameKey, won: boolean, delta: number): PlayerProgress {
  const next = normalizePlayerProgress(progress);
  const gameStats = next.stats[game];
  gameStats.plays += 1;
  gameStats.wins += won ? 1 : 0;
  gameStats.losses += won ? 0 : 1;
  gameStats.netChips += delta;
  next.stats.totalPlays += 1;
  next.stats.totalWins += won ? 1 : 0;
  next.stats.totalLosses += won ? 0 : 1;
  next.stats.lastPlayedAt = Date.now();
  next.chips = Math.max(0, next.chips + delta);
  return next;
}

export function telegramDisplayName(profile: TelegramProfile | null) {
  if (!profile) return "Visitor";
  if (profile.username) return `@${profile.username}`;
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Telegram player";
}

export function telegramInitials(profile: TelegramProfile | null) {
  if (!profile) return "DV";
  return `${profile.firstName[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "DV";
}
