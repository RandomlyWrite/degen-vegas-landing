/*
 * Telegram WebApp profile bridge.
 * The official Telegram script is loaded from client/index.html. In a normal
 * browser preview, this helper returns null and the lounge shows a visitor
 * fallback instead of blocking the experience.
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

type TelegramWebApp = {
  ready: () => void;
  expand: () => void;
  enableClosingConfirmation?: () => void;
  setHeaderColor?: (color: string) => void;
  setBackgroundColor?: (color: string) => void;
  initData?: string;
  initDataUnsafe?: { user?: TelegramUser };
};

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
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

export function telegramDisplayName(profile: TelegramProfile | null) {
  if (!profile) return "Visitor";
  if (profile.username) return `@${profile.username}`;
  return [profile.firstName, profile.lastName].filter(Boolean).join(" ") || "Telegram player";
}

export function telegramInitials(profile: TelegramProfile | null) {
  if (!profile) return "DV";
  return `${profile.firstName[0] ?? ""}${profile.lastName?.[0] ?? ""}`.toUpperCase() || "DV";
}
