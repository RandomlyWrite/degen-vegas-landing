import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";

/**
 * DEGEN VEGAS — Reference-matched landing page
 * Design direction: rubber-hose noir, illustrated casino poster, card-frame composition.
 * The uploaded artwork is the visual ground truth; controls are layered as accessible HTML.
 */

const REFERENCE_ARTWORK = "/manus-storage/degen-vegas-reference_3873d095.png";

export default function Home() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dialog, setDialog] = useState<"fairness" | "lounge" | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

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
            onClick={() => setDialog("lounge")}
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
            <h2 id="dialog-title">{dialog === "fairness" ? "Verify the house." : "The lounge is waiting."}</h2>
            <p>
              {dialog === "fairness"
                ? "Fairness verification is staged here as the front-end entry point. Connect the game verifier when the lounge backend is ready."
                : "Lounge entry is wired as an interactive front-end state. Connect the Telegram mini app route when the game room is ready."}
            </p>
            <button className="dialog-action" type="button" onClick={() => setDialog(null)}>
              {dialog === "fairness" ? "BACK TO THE DOOR" : "KEEP ME OUTSIDE"}
            </button>
          </section>
        </div>
      )}
    </main>
  );
}

function _referenceAssetForBundlers() {
  return REFERENCE_ARTWORK;
}

void _referenceAssetForBundlers;

export { REFERENCE_ARTWORK };
export { Home };
