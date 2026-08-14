import { ArrowLeft, Bomb, CircleDollarSign, Copy, Crown, Dices, Flame, History, ShieldCheck, Sparkles, TimerReset, UsersRound, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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

type GameId = "dice" | "roulette" | "craps" | "dont-splode";
type SplodePhase = "lobby" | "armed" | "running" | "sploded";
type SplodePlayer = {
  id: string;
  name: string;
  active: boolean;
  isLocal?: boolean;
};

type FairnessRound = {
  id: string;
  commitment: string;
  serverSeed: string;
  crashPoint: number;
  pot: number;
  passes: number;
  eliminated: string;
};

type LoungeProps = {
  telegramProfile: TelegramProfile | null;
  onBack: () => void;
};

const SPL0DE_BUY_IN = 100;
const SPL0DE_PASS_FEE = 5;

const GAME_OPTIONS: Array<{
  id: GameId;
  title: string;
  eyebrow: string;
  description: string;
  accent: string;
  icon: typeof Dices;
}> = [
  {
    id: "dont-splode",
    title: "DON’T SPLODE",
    eyebrow: "TABLE 99 / PVP FUSE",
    description: "Hold the bomb, pass the blame, and pray the math likes someone else.",
    accent: "danger",
    icon: Bomb,
  },
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

function makeSplodeLobby() {
  return [
    { id: "carlo", name: "Carlo.exe", active: true },
    { id: "moon", name: "Moonboy", active: true },
  ];
}

function nextSplodeHolder(players: SplodePlayer[], currentId: string) {
  const currentIndex = players.findIndex((player) => player.id === currentId);
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(currentIndex + offset) % players.length];
    if (candidate?.active) return candidate.id;
  }
  return currentId;
}

function createServerSeed() {
  const values = new Uint32Array(4);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(values);
    return Array.from(values, (value) => value.toString(16).padStart(8, "0")).join("");
  }
  return `${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
}

function createCrashPoint() {
  return Math.round((1.45 + Math.random() * 4.8) * 100) / 100;
}

function formatCooldown(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

async function createCommitment(seed: string, crashPoint: number) {
  const payload = `${seed}:${crashPoint.toFixed(2)}`;
  if (globalThis.crypto?.subtle) {
    const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
    return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  }
  return `preview-${payload.slice(0, 12)}`;
}

export default function Lounge({ telegramProfile, onBack }: LoungeProps) {
  const [selectedGame, setSelectedGame] = useState<GameId>("dont-splode");
  const [progress, setProgress] = useState<PlayerProgress>(() => createDefaultPlayerProgress());
  const [hydrating, setHydrating] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [showChipLedger, setShowChipLedger] = useState(false);
  const [lastResult, setLastResult] = useState("Table 99 is accepting bad decisions.");
  const [diceCall, setDiceCall] = useState<"high" | "low">("high");
  const [rouletteColor, setRouletteColor] = useState<"red" | "black">("red");
  const [history, setHistory] = useState<string[]>(["You walked in with 250 demo chips."]);

  const [splodePhase, setSplodePhase] = useState<SplodePhase>("lobby");
  const [splodePlayers, setSplodePlayers] = useState<SplodePlayer[]>(() => makeSplodeLobby());
  const [splodeLobbySeconds, setSplodeLobbySeconds] = useState(60);
  const [splodeHolderId, setSplodeHolderId] = useState("carlo");
  const [splodeMultiplier, setSplodeMultiplier] = useState(1);
  const [splodePot, setSplodePot] = useState(SPL0DE_BUY_IN * 2);
  const [splodePasses, setSplodePasses] = useState(0);
  const [splodeLocalPasses, setSplodeLocalPasses] = useState(0);
  const [splodeSeed, setSplodeSeed] = useState<string | null>(null);
  const [splodeCommitment, setSplodeCommitment] = useState<string | null>(null);
  const [splodeCrashPoint, setSplodeCrashPoint] = useState<number | null>(null);
  const [splodeEliminated, setSplodeEliminated] = useState<SplodePlayer | null>(null);
  const [fairnessHistory, setFairnessHistory] = useState<FairnessRound[]>([]);
  const [isFairnessDrawerOpen, setFairnessDrawerOpen] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("fairness") === "history";
  });
  const [roundVerification, setRoundVerification] = useState<Record<string, "checking" | "valid" | "invalid" | "error">>({});
  const [copiedProof, setCopiedProof] = useState<string | null>(null);
  const [copyProofError, setCopyProofError] = useState<string | null>(null);

  const currentGame = useMemo(
    () => GAME_OPTIONS.find((game) => game.id === selectedGame) ?? GAME_OPTIONS[0],
    [selectedGame],
  );
  const splodeHolder = useMemo(
    () => splodePlayers.find((player) => player.id === splodeHolderId) ?? splodePlayers[0],
    [splodeHolderId, splodePlayers],
  );
  const splodeLocalJoined = splodePlayers.some((player) => player.isLocal);
  const splodeActivePlayers = splodePlayers.filter((player) => player.active);
  const displayedSplodePot = splodePhase === "lobby" ? splodePlayers.length * SPL0DE_BUY_IN : splodePot;
  const localName = telegramProfile ? telegramDisplayName(telegramProfile) : "You";
  const playerId = telegramProfile?.username ? `@${telegramProfile.username}` : localName;
  const refillRemaining = getRefillRemainingMs(progress, now);
  const refillReady = canClaimFreeRefill(progress, now);

  useEffect(() => {
    let cancelled = false;
    setHydrating(true);
    void loadPlayerProgress().then((saved) => {
      if (cancelled) return;
      setProgress(saved);
      setLastResult(saved.stats.totalPlays > 0 ? `Welcome back. ${saved.stats.totalPlays} plays logged.` : "Table 99 is accepting bad decisions.");
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
    if (typeof window === "undefined") return;
    if (new URLSearchParams(window.location.search).get("fairness") === "history") {
      setFairnessDrawerOpen(true);
    }
  }, []);

  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, []);

  const addHistory = (message: string) => {
    setHistory((items) => [message, ...items].slice(0, 4));
  };

  const verifyFairnessRound = async (round: FairnessRound) => {
    setRoundVerification((states) => ({ ...states, [round.id]: "checking" }));
    try {
      const recomputed = await createCommitment(round.serverSeed, round.crashPoint);
      setRoundVerification((states) => ({ ...states, [round.id]: recomputed === round.commitment ? "valid" : "invalid" }));
    } catch {
      setRoundVerification((states) => ({ ...states, [round.id]: "error" }));
    }
  };

  const copyFairnessProof = async (round: FairnessRound) => {
    const proof = [
      "DON’T SPLODE — TABLE 99 FAIRNESS PROOF",
      `Commitment (SHA-256 seed:crash): ${round.commitment}`,
      `Server seed: ${round.serverSeed}`,
      `Crash point: ${round.crashPoint.toFixed(2)}x`,
      `Pot: ${round.pot} ⬡`,
      `Passes: ${round.passes}`,
      `Eliminated: ${round.eliminated}`,
      "Verification payload: server_seed:crash_point",
    ].join("\n");

    setCopyProofError(null);
    try {
      if (!navigator.clipboard?.writeText) throw new Error("Clipboard access is unavailable.");
      await navigator.clipboard.writeText(proof);
      setCopiedProof(round.id);
      window.setTimeout(() => setCopiedProof((id) => id === round.id ? null : id), 1800);
    } catch {
      setCopyProofError("Clipboard unavailable — select the proof details manually.");
    }
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

  const commitGameResult = (game: GameKey, won: boolean, delta: number, result: string) => {
    const next = applyGameResult(progress, game, won, delta);
    setProgress(next);
    void savePlayerProgress(next);
    setLastResult(result);
    const gameLabel = game === "dontSplode" ? "DON’T SPLODE" : game.toUpperCase();
    addHistory(`${gameLabel}: ${result} (${delta > 0 ? "+" : ""}${delta} chips)`);
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

  const armDontSplode = useCallback(async () => {
    if (splodePhase !== "lobby") return;
    const seed = createServerSeed();
    const crashPoint = createCrashPoint();
    const commitment = await createCommitment(seed, crashPoint);
    const localPlayer = splodePlayers.find((player) => player.isLocal);
    setSplodeSeed(seed);
    setSplodeCrashPoint(crashPoint);
    setSplodeCommitment(commitment);
    setSplodePot(splodePlayers.length * SPL0DE_BUY_IN);
    setSplodeMultiplier(1);
    setSplodePasses(0);
    setSplodeLocalPasses(0);
    setSplodeEliminated(null);
    setSplodeHolderId(localPlayer?.id ?? splodePlayers[0]?.id ?? "carlo");
    setSplodePhase("armed");
    setLastResult("Commitment sealed. The bomb already knows something you do not.");
  }, [splodePhase, splodePlayers]);

  const joinDontSplode = () => {
    if (splodePhase !== "lobby" || splodeLocalJoined) return;
    if (progress.chips < SPL0DE_BUY_IN) {
      setLastResult("You need 100 demo chips to buy a ticket to regret.");
      return;
    }
    setSplodePlayers((players) => [...players, { id: "local", name: localName, active: true, isLocal: true }]);
    setLastResult("Seat saved. The fuse is pretending not to notice you.");
  };

  const resetDontSplode = () => {
    setSplodePhase("lobby");
    setSplodePlayers(makeSplodeLobby());
    setSplodeLobbySeconds(60);
    setSplodeHolderId("carlo");
    setSplodeMultiplier(1);
    setSplodePot(SPL0DE_BUY_IN * 2);
    setSplodePasses(0);
    setSplodeLocalPasses(0);
    setSplodeSeed(null);
    setSplodeCommitment(null);
    setSplodeCrashPoint(null);
    setSplodeEliminated(null);
    setLastResult("Fresh fuse. Same poor instincts.");
  };

  const passDontSplode = () => {
    if (splodePhase !== "running" || splodeHolderId !== "local") return;
    const nextHolder = nextSplodeHolder(splodePlayers, splodeHolderId);
    setSplodeHolderId(nextHolder);
    setSplodePot((pot) => pot + SPL0DE_PASS_FEE);
    setSplodePasses((passes) => passes + 1);
    setSplodeLocalPasses((passes) => passes + 1);
    setLastResult(`You paid ${SPL0DE_PASS_FEE} chips to make this ${nextHolder === "carlo" ? "Carlo.exe" : "Moonboy"}'s problem.`);
  };

  useEffect(() => {
    if (selectedGame !== "dont-splode" || splodePhase !== "lobby") return;
    if (splodeLobbySeconds <= 0) {
      void armDontSplode();
      return;
    }
    const timer = window.setTimeout(() => setSplodeLobbySeconds((seconds) => Math.max(0, seconds - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [armDontSplode, selectedGame, splodeLobbySeconds, splodePhase]);

  useEffect(() => {
    if (splodePhase !== "armed") return;
    const timer = window.setTimeout(() => setSplodePhase((phase) => phase === "armed" ? "running" : phase), 950);
    return () => window.clearTimeout(timer);
  }, [splodePhase]);

  useEffect(() => {
    if (splodePhase !== "running" || !splodeCrashPoint) return;
    const ticker = window.setTimeout(() => {
      setSplodeMultiplier((multiplier) => Math.min(
        splodeCrashPoint,
        Math.round((multiplier + 0.17 + Math.random() * 0.15) * 100) / 100,
      ));
    }, 1650);
    return () => window.clearTimeout(ticker);
  }, [splodeCrashPoint, splodeMultiplier, splodePhase]);

  useEffect(() => {
    if (splodePhase !== "running" || splodeHolderId === "local") return;
    const botTurn = window.setTimeout(() => {
      const player = splodePlayers.find((candidate) => candidate.id === splodeHolderId);
      const nextHolder = nextSplodeHolder(splodePlayers, splodeHolderId);
      setSplodeHolderId(nextHolder);
      setSplodePot((pot) => pot + SPL0DE_PASS_FEE);
      setSplodePasses((passes) => passes + 1);
      setLastResult(`${player?.name ?? "A panicked degen"} paid ${SPL0DE_PASS_FEE} chips and shoved the bomb onward.`);
    }, 1050);
    return () => window.clearTimeout(botTurn);
  }, [splodeHolderId, splodePhase, splodePlayers]);

  useEffect(() => {
    if (splodePhase !== "running" || !splodeCrashPoint || splodeMultiplier < splodeCrashPoint) return;
    const eliminated = splodePlayers.find((player) => player.id === splodeHolderId);
    const localWasEliminated = eliminated?.isLocal ?? false;
    const survivorCount = Math.max(1, splodeActivePlayers.length - 1);
    const localPayout = Math.floor(splodePot / survivorCount) - SPL0DE_BUY_IN - splodeLocalPasses * SPL0DE_PASS_FEE;
    const localLoss = -SPL0DE_BUY_IN - splodeLocalPasses * SPL0DE_PASS_FEE;
    setSplodePlayers((players) => players.map((player) => player.id === splodeHolderId ? { ...player, active: false } : player));
    setSplodeEliminated(eliminated ?? null);
    setSplodePhase("sploded");
    if (splodeCommitment && splodeSeed) {
      setFairnessHistory((rounds) => [{
        id: splodeCommitment,
        commitment: splodeCommitment,
        serverSeed: splodeSeed,
        crashPoint: splodeCrashPoint,
        pot: splodePot,
        passes: splodePasses,
        eliminated: eliminated?.isLocal ? "You" : eliminated?.name ?? "Unknown player",
      }, ...rounds].slice(0, 8));
    }
    if (splodeLocalJoined) {
      const result = localWasEliminated
        ? `KABOOM — you were holding it at ${splodeCrashPoint.toFixed(2)}x.`
        : `KABOOM — ${eliminated?.name ?? "someone else"} ate the fuse. You survived.`;
      commitGameResult("dontSplode", !localWasEliminated, localWasEliminated ? localLoss : localPayout, result);
    } else {
      setLastResult(`KABOOM — ${eliminated?.name ?? "someone"} was holding it at ${splodeCrashPoint.toFixed(2)}x.`);
      addHistory(`DON’T SPLODE: ${eliminated?.name ?? "A spectator"} found the crash point.`);
    }
  }, [splodeActivePlayers.length, splodeCommitment, splodeCrashPoint, splodeHolderId, splodeLocalJoined, splodeLocalPasses, splodeMultiplier, splodePasses, splodePhase, splodePlayers, splodePot, splodeSeed]);

  const formatLobbyTimer = `${String(Math.floor(splodeLobbySeconds / 60)).padStart(2, "0")}:${String(splodeLobbySeconds % 60).padStart(2, "0")}`;

  return (
    <main className="lounge-page">
      <div className="lounge-noise" aria-hidden="true" />
      <header className="lounge-header">
        <button className="lounge-back" type="button" onClick={onBack}>
          <ArrowLeft size={16} /> LEAVE THE DOOR
        </button>
        <div className="lounge-brand">
          <span className="lounge-brand__corner" aria-hidden="true">Q♣</span>
          <span className="lounge-brand__wordmark">DEGEN <i>VEGAS</i></span>
          <small>THE LOUNGE / PLAYER TABLES</small>
        </div>
        <div className="lounge-account">
          <div className="lounge-player" title={telegramDisplayName(telegramProfile)}>
            {telegramProfile?.photoUrl ? (
              <img src={telegramProfile.photoUrl} alt="" className="lounge-player-avatar" />
            ) : (
              <span className="lounge-player-avatar lounge-player-avatar--fallback">{telegramInitials(telegramProfile)}</span>
            )}
            <span className="lounge-player-copy">
              <strong>{telegramDisplayName(telegramProfile)}</strong>
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
        </div>
      </header>

      <section className="lounge-hero">
        <div>
          <p className="lounge-kicker">AFTER HOURS / 00:13 AM</p>
          <h1>THE LOUNGE</h1>
          <p className="lounge-copy">Four tables. One questionable decision at a time.</p>
        </div>
        <div className="lounge-stat-block">
          <span>DEMO CHIP STACK</span>
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
          <div className="section-label"><span>OPEN TABLES</span><span>{String(GAME_OPTIONS.length).padStart(2, "0")} ACTIVE</span></div>
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
                  if (game.id !== "dont-splode") setLastResult("The dealer resets the table.");
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
            <span className="console-live"><i /> {selectedGame === "dont-splode" ? "SINGLE-MESSAGE MODE" : "LIVE DEMO TABLE"}</span>
          </div>
          <div className="console-title-row">
            <div>
              <p className="console-kicker">HOUSE RULES / {selectedGame === "dont-splode" ? "PASS THE BOMB. DON’T PASS AWAY." : selectedGame === "dice" ? "CALL IT BEFORE THE ROLL" : selectedGame === "roulette" ? "THE WHEEL DOES NOT APOLOGIZE" : "THE HOUSE ALWAYS WINS"}</p>
              <h2>{currentGame.title}</h2>
            </div>
            {selectedGame === "dont-splode" ? <Flame size={24} /> : <ShieldCheck size={24} />}
          </div>

          <div className="game-stage">
            {selectedGame === "dont-splode" && (
              <div className={`splode-stage splode-stage--${splodePhase}`}>
                <div className="splode-proof-row">
                  <span><ShieldCheck size={13} /> {splodeCommitment ? "CRASH COMMIT SEALED" : "FAIRNESS COMMIT PENDING"}</span>
                  <div className="splode-proof-actions">
                    <strong>{splodeCommitment ? `${splodeCommitment.slice(0, 14)}…${splodeCommitment.slice(-8)}` : "LOCKS WITH THE FUSE"}</strong>
                    <button className="splode-history-trigger" type="button" onClick={() => setFairnessDrawerOpen(true)} aria-haspopup="dialog">
                      <History size={12} /> HISTORY {fairnessHistory.length ? `(${fairnessHistory.length})` : ""}
                    </button>
                  </div>
                </div>

                <div className="splode-arena">
                  <div className="splode-fuse-line" aria-hidden="true" />
                  <div className="splode-gremlin" aria-hidden="true">
                    <span>◉</span><span>◉</span><i>⌣</i>
                  </div>
                  <div className={`splode-bomb ${splodePhase === "sploded" ? "splode-bomb--gone" : ""}`} aria-hidden="true">
                    <span className="splode-spark">✦</span>
                    <Bomb size={44} strokeWidth={1.45} />
                  </div>
                  <div className="splode-meter">
                    <span>{splodePhase === "lobby" ? "POT" : splodePhase === "sploded" ? "CRASHED" : "FUSE"}</span>
                    <strong>{splodePhase === "lobby" ? `${displayedSplodePot} ⬡` : `${splodeMultiplier.toFixed(2)}x`}</strong>
                  </div>
                  <div className="splode-seats" aria-label="Current Don’t Splode players">
                    {splodePlayers.map((player) => (
                      <span className={`splode-seat ${player.id === splodeHolderId && splodePhase !== "lobby" ? "splode-seat--holder" : ""} ${!player.active ? "splode-seat--out" : ""}`} key={player.id}>
                        {player.isLocal ? "YOU" : player.name}
                      </span>
                    ))}
                  </div>
                </div>

                {splodePhase === "lobby" && (
                  <div className="splode-lobby-copy">
                    <span><UsersRound size={15} /> {splodePlayers.length}/6 DEGENS IN THE BLAST RADIUS</span>
                    <strong>Lobby locks in {formatLobbyTimer}</strong>
                    <p>One message, zero chat clutter. The commitment posts before the fuse moves.</p>
                    <div className="splode-action-row">
                      <button className="splode-join-button" type="button" onClick={joinDontSplode} disabled={splodeLocalJoined || hydrating}>
                        {splodeLocalJoined ? "SEAT SAVED" : `JOIN · ${SPL0DE_BUY_IN} ⬡`}
                      </button>
                      {splodeLocalJoined && <button className="splode-ghost-button" type="button" onClick={() => void armDontSplode()}>LIGHT FUSE</button>}
                    </div>
                  </div>
                )}

                {splodePhase === "armed" && (
                  <div className="splode-status-copy">
                    <TimerReset size={17} />
                    <strong>Commitment live. Fuse lighting…</strong>
                    <p>The crash point is fixed. Your alibi is not.</p>
                  </div>
                )}

                {splodePhase === "running" && (
                  <div className="splode-status-copy splode-status-copy--live">
                    <span className="splode-holder-line">💣 {splodeHolder?.isLocal ? "YOU HOLD THE BOMB" : `${splodeHolder?.name ?? "Someone"} HOLDS THE BOMB`}</span>
                    <p>Each pass costs {SPL0DE_PASS_FEE} ⬡ and fattens the pot. {splodePasses} passes so far.</p>
                    <button className="splode-pass-button" type="button" onClick={passDontSplode} disabled={splodeHolderId !== "local"}>
                      {splodeHolderId === "local" ? `PASS IT · ${SPL0DE_PASS_FEE} ⬡` : "WAIT FOR THE BOMB"}
                    </button>
                  </div>
                )}

                {splodePhase === "sploded" && (
                  <div className="splode-reveal">
                    <strong>KABOOM. {splodeEliminated?.isLocal ? "YOU SPLODED." : `${splodeEliminated?.name ?? "A degen"} SPLODED.`}</strong>
                    <p>Server seed: <code>{splodeSeed}</code></p>
                    <p>Crash point: <code>{splodeCrashPoint?.toFixed(2)}x</code> · SHA-256(seed:crash): <code>{splodeCommitment}</code></p>
                    <button className="splode-join-button" type="button" onClick={resetDontSplode}>RUN IT BACK</button>
                  </div>
                )}
              </div>
            )}

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
          {selectedGame !== "dont-splode" && (
            <button className="roll-button" type="button" onClick={playCurrentGame} disabled={hydrating}>
              <CircleDollarSign size={18} /> PLAY FOR DEMO CHIPS
            </button>
          )}
        </section>
      </section>

      <footer className="lounge-footer">
        <div className="history-strip">
          <span className="history-label">TABLE TAPE</span>
          {history.map((item, index) => <span key={`${item}-${index}`}>{item}</span>)}
        </div>
        <button className="copy-button" type="button" onClick={() => navigator.clipboard?.writeText(playerId) }>
          <Copy size={13} /> COPY PLAYER ID
        </button>
      </footer>

      {isFairnessDrawerOpen && (
        <div className="fairness-drawer-backdrop" role="presentation" onClick={() => setFairnessDrawerOpen(false)}>
          <aside className="fairness-drawer" role="dialog" aria-modal="true" aria-labelledby="fairness-history-title" onClick={(event) => event.stopPropagation()}>
            <div className="fairness-drawer__header">
              <div>
                <p>TABLE 99 / RECEIPT BOOK</p>
                <h2 id="fairness-history-title">FAIRNESS HISTORY</h2>
              </div>
              <button className="fairness-drawer__close" type="button" onClick={() => setFairnessDrawerOpen(false)} aria-label="Close fairness history"><X size={16} /></button>
            </div>
            <p className="fairness-drawer__intro">Every completed round exposes the values that were committed before the fuse moved. Keep the receipt; blame the bomb.</p>

            {fairnessHistory.length === 0 ? (
              <div className="fairness-empty-state">
                <ShieldCheck size={24} />
                <strong>NO RECEIPTS YET.</strong>
                <p>Finish one round and its commitment, server seed, and crash point will land here.</p>
              </div>
            ) : (
              <ol className="fairness-round-list">
                {fairnessHistory.map((round, index) => (
                  <li className="fairness-round" key={round.id}>
                    <div className="fairness-round__topline">
                      <span>ROUND {String(fairnessHistory.length - index).padStart(2, "0")}</span>
                      <strong>{round.crashPoint.toFixed(2)}x</strong>
                    </div>
                    <p><b>{round.eliminated}</b> found the crash point after {round.passes} pass{round.passes === 1 ? "" : "es"}. Pot: <b>{round.pot} ⬡</b>.</p>
                    <dl>
                      <div><dt>SHA-256 COMMITMENT</dt><dd>{round.commitment}</dd></div>
                      <div><dt>SERVER SEED</dt><dd>{round.serverSeed}</dd></div>
                      <div><dt>CRASH POINT</dt><dd>{round.crashPoint.toFixed(2)}x</dd></div>
                    </dl>
                    <div className="fairness-round__actions">
                      <button className="fairness-verify-button" type="button" onClick={() => void verifyFairnessRound(round)} disabled={roundVerification[round.id] === "checking"}>
                        <ShieldCheck size={13} /> {roundVerification[round.id] === "checking" ? "CHECKING…" : "VERIFY HASH"}
                      </button>
                      <button className="fairness-copy-proof" type="button" onClick={() => void copyFairnessProof(round)}>
                        <Copy size={13} /> {copiedProof === round.id ? "PROOF COPIED" : "COPY PROOF"}
                      </button>
                    </div>
                    {roundVerification[round.id] === "valid" && <p className="fairness-verdict fairness-verdict--valid">VERIFIED — recomputed SHA-256 matches the pre-fuse commitment.</p>}
                    {roundVerification[round.id] === "invalid" && <p className="fairness-verdict fairness-verdict--invalid">MISMATCH — the revealed values do not reproduce this commitment.</p>}
                    {roundVerification[round.id] === "error" && <p className="fairness-verdict fairness-verdict--invalid">VERIFY FAILED — this client could not recompute the hash.</p>}
                  </li>
                ))}
              </ol>
            )}
            {copyProofError && <p className="fairness-copy-error" role="status">{copyProofError}</p>}
          </aside>
        </div>
      )}
    </main>
  );
}
