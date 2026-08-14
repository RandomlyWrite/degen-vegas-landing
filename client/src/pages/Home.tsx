/*
 * DEGEN VEGAS Entrance — illustrated poster theater with an intentional,
 * door-focused push-in. Wallet state is not part of this product surface.
 */
import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import Lounge from "@/pages/Lounge";
import { initTelegram, type TelegramProfile } from "@/lib/telegram";

const REFERENCE_ARTWORK = "/manus-storage/degen-vegas-reference_3873d095.png";

type DialogKind = "fairness" | null;

export default function Home() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [inLounge, setInLounge] = useState(() => {
    if (typeof window === "undefined") return false;
    return new URLSearchParams(window.location.search).get("table") === "99";
  });
  const [telegramProfile, setTelegramProfile] = useState<TelegramProfile | null>(null);

  useEffect(() => {
    setTelegramProfile(initTelegram());
  }, []);

  useEffect(() => {
    if (!transitioning) return;
    const timer = window.setTimeout(() => {
      setTransitioning(false);
      setInLounge(true);
    }, 1050);
    return () => window.clearTimeout(timer);
  }, [transitioning]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleEnterLounge = () => {
    setDialog(null);
    setTransitioning(true);
  };

  if (inLounge) {
    return (
      <Lounge
        telegramProfile={telegramProfile}
        onBack={() => {
          setInLounge(false);
          setTransitioning(false);
        }}
      />
    );
  }

  return (
    <main className="dv-page">
      <div className="dv-atmosphere" aria-hidden="true" />
      <section className="poster-frame" aria-label="DEGEN VEGAS entrance">
        <img
          className="poster-art"
          src={REFERENCE_ARTWORK}
          alt="Illustrated DEGEN VEGAS casino entrance with live leaderboard, neon marquee, smoky doorway, and two action buttons"
          draggable={false}
        />

        <div className="poster-vignette" aria-hidden="true" />

        <button
          className="sound-toggle"
          type="button"
          aria-label={soundEnabled ? "Mute ambient sound" : "Enable ambient sound"}
          aria-pressed={soundEnabled}
          onClick={() => setSoundEnabled((enabled) => !enabled)}
        >
          {soundEnabled ? <Volume2 size={18} strokeWidth={1.8} /> : <VolumeX size={18} strokeWidth={1.8} />}
          <span>{soundEnabled ? "SOUND ON" : "SOUND OFF"}</span>
        </button>

        <div className="poster-actions" aria-label="Landing page actions">
          <button
            className="action-hotspot action-hotspot--verify"
            type="button"
            aria-label="Verify fairness"
            onClick={() => setDialog("fairness")}
          >
            <span className="sr-only">Verify fairness</span>
          </button>
          <button
            className="action-hotspot action-hotspot--enter"
            type="button"
            aria-label="Enter the lounge"
            onClick={handleEnterLounge}
          >
            <span className="sr-only">Enter the lounge</span>
          </button>
        </div>

        <div className="preview-hint" aria-hidden="true">
          <span className="preview-hint__chevrons">»»</span>
          <span>Tap &amp; hold for preview</span>
          <span className="preview-hint__chevrons">««</span>
        </div>
      </section>

      {transitioning && (
        <div className="transition-overlay transition-overlay--door-push" role="status" aria-live="polite" aria-label="Entering the lounge">
          <div className="transition-poster-layer transition-poster-layer--base" aria-hidden="true">
            <img src={REFERENCE_ARTWORK} alt="" draggable={false} />
          </div>
          <div className="transition-poster-layer transition-poster-layer--door" aria-hidden="true">
            <img src={REFERENCE_ARTWORK} alt="" draggable={false} />
          </div>
          <div className="transition-leaderboard-fade" aria-hidden="true" />
          <div className="transition-smoke-layer" aria-hidden="true" />
          <div className="transition-light-bloom" aria-hidden="true" />
          <span className="transition-caption">ENTERING…</span>
        </div>
      )}

      {dialog && (
        <div className="dialog-backdrop" role="presentation" onClick={() => setDialog(null)}>
          <section
            className="dialog-card"
            role="dialog"
            aria-modal="true"
            aria-labelledby="dialog-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button className="dialog-close" type="button" aria-label="Close dialog" onClick={() => setDialog(null)}>
              <X size={18} />
            </button>
            <p className="dialog-kicker">DEGEN VEGAS / MINI APP</p>
            <h2 id="dialog-title">VERIFY THE HOUSE.</h2>
            <p>Fairness verification is staged here as the front-end entry point. Connect the game verifier when the lounge backend is ready.</p>
            <button className="dialog-action" type="button" onClick={() => setDialog(null)}>
              BACK TO THE DOOR
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

export { REFERENCE_ARTWORK };
