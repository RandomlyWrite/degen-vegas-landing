/*
 * DEGEN VEGAS Lounge — the entrance's smoky casino language with a clearer
 * operator surface: Telegram identity, virtual chips, and free refill state.
 */
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CircleDollarSign, Copy, Crown, Dices, ShieldCheck, Sparkles } from "lucide-react";
import {
  applyGameResult,
  canClaimFreeRefill,
  claimFreeRefill,
  createDefaultPlayerProgress,
  getRefillRemainingMs,
  loadPlayerProgress,
  savePlayerProgress,
  telegramDisplayName,
  telegramInitials,
  type GameKey,
  type PlayerProgress,
  type TelegramProfile,
} from "@/lib/telegram";

type GameId = "dice" | "roulette" | "craps";

type LoungeProps = {
  telegramProfile: TelegramProfile | null;
  onBack: () => void;
};

const GAME_OPTIONS: Array<{
  id: GameId;
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
  icon: typeof Dices;
}> = [
  {
    id: "dice",
    title: "HIGH / LOW DEGEN DICE",
    eyebrow: "TABLE 07 / FAST ROLL",
    description: "Call the side. Roll the bones. Pretend the math was on your side.",
    accent: "pink",
    icon: Dices,
  },
  {
    id: "roulette",
    title: "NEON ROULETTE",
    eyebrow: "TABLE 13 / LIGHTS OUT",
    description: "Pick red, black, or let the wheel make the bad decision for you.",
    accent: "amber",
    icon: Sparkles,
  },
  {
    id: "craps",
    title: "REKT CRAPS TABLE",
    eyebrow: "TABLE 21 / HOUSE FAVORITE",
    description: "A tiny craps loop with a short memory and a very long grudge.",
    accent: "teal",
    icon: Crown,
  },
];

function formatCooldown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export default function Lounge({ telegramProfile, onBack }: LoungeProps) {
  const [selectedGame, setSelectedGame] = useState<GameId>("dice");
  const [progress, setProgress] = useState<PlayerProgress>(() => createDefaultPlayerProgress());
  const [hydrating, setHydrating] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [showChipLedger, setShowChipLedger] = useState(false);
  const [lastResult, setLastResult] = useState("The house is watching.");
  const [diceCall, setDiceCall] = useState<"high" | "low">("high");
  const [rouletteColor, setRouletteColor] = useState<"red" | "black">("red");
  const [history, setHistory] = useState<string[]>(["You walked in with 250 free chips."]);

  const currentGame = useMemo(
    () => GAME_OPTIONS.find((game) => game.id === selectedGame) ?? GAME_OPTIONS[0],
    [selectedGame],
  );
  const refillRemaining = getRefillRemainingMs(progress, now);
  const refillReady = canClaimFreeRefill(progress, now);
  const displayName = telegramDisplayName(telegramProfile);
  const playerId = telegramProfile?.username ? `@${telegramProfile.username}` : displayName;

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    void loadPlayerProgress().then((saved) => {
      if (cancelled) return;
      setProgress(saved);
      setLastResult(saved.stats.totalPlays > 0 ? `Welcome back. ${saved.stats.totalPlays} plays logged.` : "The house is watching.");
      setHistory((items) => [`Progress loaded: ${saved.stats.totalPlays} plays logged.`, ...items].slice(0, 4));
      setHydrating(false);
    }).catch(() => {
      if (!cancelled) setHydrating(false);
    });
    return () => {
      cancelled = true;
    };
  }, [telegramProfile?.id]);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const addHistory = (message: string) => {
    setHistory((items) => [message, ...items].slice(0, 4));
  };

  const commitGameResult = (game: GameKey, won: boolean, delta: number, result: string) => {
    const next = applyGameResult(progress, game, won, delta);
    setProgress(next);
    void savePlayerProgress(next);
    setLastResult(result);
    addHistory(`${game.toUpperCase()}: ${result} (${delta > 0 ? "+" : ""}${delta} chips)`);
  };

  const handleFreeRefill = () => {
    const next = claimFreeRefill(progress, now);
    if (!next) {
      setLastResult(`Refill locked. ${formatCooldown(refillRemaining)} until the house gets generous.`);
      return;
    }
    setProgress(next);
    void savePlayerProgress(next);
    setLastResult("FREE REFILL CLAIMED. IMAGINARY WEALTH RESTORED.");
    addHistory("REFILL: +250 free chips. The house pretends this is sustainable.");
  };

  const playDice = () => {
    const roll = 1 + Math.floor(Math.random() * 6) + (1 + Math.floor(Math.random() * 6));
    const won = diceCall === "high" ? roll >= 8 : roll <= 6;
    const delta = won ? 25 : -15;
    const result = `${roll} — ${won ? "YOU GOT LUCKY. DISGUSTING." : "THE HOUSE REMEMBERS."}`;
    commitGameResult("dice", won, delta, result);
  };

  const playRoulette = () => {
    const roll = Math.floor(Math.random() * 37);
    const isRed = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(roll);
    const color = roll === 0 ? "green" : isRed ? "red" : "black";
    const won = color === rouletteColor;
    const delta = won ? 40 : -20;
    const result = `${roll} / ${color.toUpperCase()} — ${won ? "THE WHEEL LIKES YOU." : "THE WHEEL HAS TASTE."}`;
    commitGameResult("roulette", won, delta, result);
  };

  const playCraps = () => {
    const roll = 2 + Math.floor(Math.random() * 11);
    const won = roll === 7 || roll === 11;
    const delta = won ? 35 : roll === 2 || roll === 12 ? -30 : -10;
    const result = `${roll} — ${won ? "NATURAL. THE TABLE IS OFFENDED." : "NO NATURAL. KEEP WALKING."}`;
    commitGameResult("craps", won, delta, result);
  };

  const playCurrentGame = () => {
    if (selectedGame === "dice") playDice();
    if (selectedGame === "roulette") playRoulette();
    if (selectedGame === "craps") playCraps();
  };

  return (
    <main className="lounge-page">
      <div className="lounge-noise" aria-hidden="true" />
      <header className="lounge-header">
        <button className="lounge-back" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> EXIT
        </button>
        <div className="lounge-brand">
          <span>DEGEN VEGAS</span>
          <small>THE LOUNGE / PLAYER TABLES</small>
        </div>
        <div className="lounge-account">
          <div className="lounge-player" title={displayName}>
            {telegramProfile?.photoUrl ? (
              <img src={telegramProfile.photoUrl} alt="" className="lounge-player-avatar" />
            ) : (
              <span className="lounge-player-avatar lounge-player-avatar--fallback">{telegramInitials(telegramProfile)}</span>
            )}
            <span className="lounge-player-copy">
              <strong>{displayName}</strong>
              <small>{telegramProfile ? "TELEGRAM PLAYER" : "BROWSER PREVIEW"}</small>
            </span>
          </div>
          <button
            className="chip-balance-pill"
            type="button"
            onClick={() => setShowChipLedger((visible) => !visible)}
            aria-expanded={showChipLedger}
            aria-controls="chip-ledger"
          >
            <span>CHIPS</span>
            <strong>{progress.chips}</strong>
          </button>
        </div>
        {showChipLedger && (
          <section className="chip-ledger" id="chip-ledger" aria-label="Virtual chip stack">
            <div className="chip-ledger__heading"><span>CHIP STACK</span><small>{playerId}</small></div>
            <div className="chip-ledger__row"><span>Balance</span><strong>{progress.chips}</strong></div>
            <div className="chip-ledger__row"><span>Total plays</span><strong>{progress.stats.totalPlays}</strong></div>
            <div className="chip-ledger__row"><span>Wins / losses</span><strong>{progress.stats.totalWins} / {progress.stats.totalLosses}</strong></div>
            <div className="chip-ledger__footer">
              <span>{refillReady ? "REFILL READY" : `NEXT REFILL ${formatCooldown(refillRemaining)}`}</span>
              <button type="button" onClick={handleFreeRefill} disabled={!refillReady || hydrating}>
                {refillReady ? "CLAIM +250" : "COOLDOWN"}
              </button>
            </div>
          </section>
        )}
      </header>

      <section className="lounge-hero">
        <div>
          <p className="lounge-kicker">AFTER HOURS / 00:13 AM</p>
          <h1>THE LOUNGE</h1>
          <p className="lounge-copy">Three tables. One questionable decision at a time.</p>
        </div>
        <div className="lounge-stat-block">
          <span>YOUR CHIP STACK</span>
          <strong>{progress.chips}</strong>
          <small>{hydrating ? "LOADING PLAYER LEDGER…" : `${progress.stats.totalPlays} PLAYS / VIRTUAL ONLY`}</small>
        </div>
      </section>

      <section className="chip-rail" aria-label="Free chip refill">
        <div className="chip-rail-icon"><CircleDollarSign size={22} /></div>
        <div>
          <strong>FREE CHIPS / VIRTUAL ONLY</strong>
          <p>{refillReady ? "The house is feeling charitable. Claim 250 chips before it regrets you." : `Next refill in ${formatCooldown(refillRemaining)}. No deposit. No withdrawal. No dignity.`}</p>
        </div>
        <button type="button" className="chip-rail-action" onClick={handleFreeRefill} disabled={!refillReady || hydrating}>
          {refillReady ? "CLAIM REFILL" : formatCooldown(refillRemaining)}
        </button>
      </section>

      <section className="table-layout">
        <div className="game-list" aria-label="Available game tables">
          <div className="section-label"><span>OPEN TABLES</span><span>03 ACTIVE</span></div>
          {GAME_OPTIONS.map((game) => {
            const Icon = game.icon;
            const isSelected = selectedGame === game.id;
            return (
              <button
                className={`game-card game-card--${game.accent} ${isSelected ? "game-card--selected" : ""}`}
                key={game.id}
                type="button"
                onClick={() => {
                  setSelectedGame(game.id);
                  setLastResult("The dealer resets the table.");
                }}
                aria-pressed={isSelected}
              >
                <span className="game-card-icon"><Icon size={20} /></span>
                <span className="game-card-copy">
                  <small>{game.eyebrow}</small>
                  <strong>{game.title}</strong>
                  <span>{game.description}</span>
                </span>
                <span className="game-card-arrow">↗</span>
              </button>
            );
          })}
        </div>

        <section className={`game-console game-console--${currentGame.accent}`} aria-live="polite">
          <div className="console-topline">
            <span>{currentGame.eyebrow}</span>
            <span className="console-live"><i /> LIVE DEMO TABLE</span>
          </div>
          <div className="console-title-row">
            <div>
              <p className="console-kicker">HOUSE RULES / {selectedGame === "dice" ? "CALL IT BEFORE THE ROLL" : selectedGame === "roulette" ? "THE WHEEL DOES NOT APOLOGIZE" : "THE HOUSE ALWAYS WINS"}</p>
              <h2>{currentGame.title}</h2>
            </div>
            <ShieldCheck size={24} />
          </div>

          <div className="game-stage">
            {selectedGame === "dice" && (
              <div className="dice-stage">
                <div className="dice-cube">{lastResult.match(/^\d+/)?.[0] ?? "?"}</div>
                <p>Choose your side, then roll two virtual dice.</p>
                <div className="choice-row">
                  <button className={diceCall === "high" ? "choice choice--active" : "choice"} type="button" onClick={() => setDiceCall("high")}>HIGH / 8—12</button>
                  <button className={diceCall === "low" ? "choice choice--active" : "choice"} type="button" onClick={() => setDiceCall("low")}>LOW / 2—6</button>
                </div>
              </div>
            )}

            {selectedGame === "roulette" && (
              <div className="roulette-stage">
                <div className="roulette-wheel"><span>0</span><span>7</span><span>19</span><span>32</span></div>
                <p>Select a color and let the wheel embarrass you.</p>
                <div className="choice-row">
                  <button className={rouletteColor === "red" ? "choice choice--red choice--active" : "choice choice--red"} type="button" onClick={() => setRouletteColor("red")}>RED</button>
                  <button className={rouletteColor === "black" ? "choice choice--black choice--active" : "choice choice--black"} type="button" onClick={() => setRouletteColor("black")}>BLACK</button>
                </div>
              </div>
            )}

            {selectedGame === "craps" && (
              <div className="craps-stage">
                <div className="craps-table">
                  <span>PASS LINE</span>
                  <strong>{lastResult.match(/^\d+/)?.[0] ?? "7"}</strong>
                  <span>DON'T ASK</span>
                </div>
                <p>One roll. No strategy. Maximum confidence.</p>
              </div>
            )}
          </div>

          <div className="console-result"><span>LAST CALL</span><strong>{lastResult}</strong></div>
          <button className="roll-button" type="button" onClick={playCurrentGame} disabled={hydrating}>
            <CircleDollarSign size={18} /> PLAY FOR DEMO CHIPS
          </button>
        </section>
      </section>

      <footer className="lounge-footer">
        <div className="history-strip">
          <span className="history-label">TABLE TAPE</span>
          {history.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
        <button className="copy-button" type="button" onClick={() => navigator.clipboard?.writeText(playerId)}>
          <Copy size={13} /> COPY PLAYER ID
        </button>
      </footer>
    </main>
  );
}
