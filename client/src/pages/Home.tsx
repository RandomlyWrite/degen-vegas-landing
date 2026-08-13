import { Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useState } from "react";
import Lounge from "@/pages/Lounge";
import { connectWallet, readWalletSnapshot, type WalletSnapshot } from "@/lib/wallet";

const REFERENCE_ARTWORK = "/manus-storage/degen-vegas-reference_3873d095.png";
const REFERENCE_VIDEO = "/manus-storage/_users_01912768-4157-4192-a5b0-0f6e69c96add_generated_e7395394-fd94-4575-b269-50289fb74e2e_generated_video_a082a15c.mp4";

type DialogKind = "fairness" | null;

export default function Home() {
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [transitioning, setTransitioning] = useState(false);
  const [inLounge, setInLounge] = useState(false);
  const [wallet, setWallet] = useState<WalletSnapshot | null>(null);
  const [walletError, setWalletError] = useState("");

  useEffect(() => {
    void readWalletSnapshot().then(setWallet).catch(() => setWallet(null));

    const provider = typeof window !== "undefined" ? window.ethereum : undefined;
    if (!provider?.on) return;

    const handleAccountsChanged = (accounts: unknown) => {
      if (!Array.isArray(accounts) || !accounts[0]) {
        setWallet(null);
        return;
      }
      void readWalletSnapshot().then(setWallet).catch(() => setWallet(null));
    };
    const handleChainChanged = () => {
      void readWalletSnapshot().then(setWallet).catch(() => setWallet(null));
    };

    provider.on("accountsChanged", handleAccountsChanged);
    provider.on("chainChanged", handleChainChanged);
    return () => {
      provider.removeListener?.("accountsChanged", handleAccountsChanged);
      provider.removeListener?.("chainChanged", handleChainChanged);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDialog(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const handleConnectWallet = async () => {
    setWalletError("");
    try {
      const snapshot = await connectWallet();
      setWallet(snapshot);
    } catch (error) {
      setWalletError(error instanceof Error ? error.message : "Wallet connection was cancelled.");
    }
  };

  const handleEnterLounge = () => {
    setDialog(null);
    setTransitioning(true);
  };

  const handleVideoEnded = () => {
    setTransitioning(false);
    setInLounge(true);
  };

  if (inLounge) {
    return (
      <Lounge
        wallet={wallet}
        onBack={() => {
          setInLounge(false);
          setTransitioning(false);
        }}
        onConnect={handleConnectWallet}
        onDisconnect={() => setWallet(null)}
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
        <div className="transition-overlay" role="presentation">
          <video
            className="transition-video"
            src={REFERENCE_VIDEO}
            autoPlay
            playsInline
            muted={!soundEnabled}
            onEnded={handleVideoEnded}
          />
          <div className="transition-caption">
            <span>ENTERING THE LOUNGE…</span>
            <button type="button" onClick={handleVideoEnded}>SKIP</button>
          </div>
        </div>
      )}

      {walletError && (
        <div className="wallet-toast" role="status">
          <span>{walletError}</span>
          <button type="button" onClick={() => setWalletError("")} aria-label="Dismiss wallet error"><X size={15} /></button>
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

export { REFERENCE_ARTWORK, REFERENCE_VIDEO };
