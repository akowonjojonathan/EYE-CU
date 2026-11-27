import React, { useState } from "react";
import { Download, Share, X } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";

type PWAInstallButtonProps = {
  compact?: boolean;
};

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) {
    return null;
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className="pwa-install-btn"
        title="Install EYE-CU on your phone or desktop"
        aria-label="Install EYE-CU app"
        data-testid="pwa-install-btn"
      >
        <Download size={compact ? 14 : 15} />
        <span>{compact ? "Install" : "Install App"}</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className="pwa-install-btn is-ios"
          title="Add EYE-CU to your iPhone or iPad Home Screen"
          aria-label="Install EYE-CU on iOS"
          data-testid="pwa-ios-install-btn"
        >
          <Download size={compact ? 14 : 15} />
          <span>Install</span>
        </button>

        {showIOSGuide ? (
          <div
            className="admin-backdrop"
            role="presentation"
            onClick={(e) => {
              if (e.target === e.currentTarget) setShowIOSGuide(false);
            }}
          >
            <section
              className="admin-modal"
              aria-label="Install EYE-CU on iPhone or iPad"
              style={{ maxWidth: 400 }}
            >
              <div className="admin-modal-head">
                <div>
                  <p className="admin-modal-kicker">EYE-CU · Offline App</p>
                  <h2 className="admin-modal-title">Install on iPhone / iPad</h2>
                </div>
                <button
                  type="button"
                  aria-label="Close install instructions"
                  onClick={() => setShowIOSGuide(false)}
                  className="close-modal-btn"
                >
                  <X size={18} />
                </button>
              </div>
              <div className="admin-info-box" style={{ marginBottom: 14 }}>
                <Share size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                <span>
                  1. Tap the <strong>Share</strong> button in Safari&apos;s
                  toolbar.
                  <br />
                  2. Scroll down and tap <strong>Add to Home Screen</strong>.
                  <br />
                  3. Open <strong>EYE-CU</strong> from your home screen even when
                  offline on campus.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="primary-cta"
              >
                Got It
              </button>
            </section>
          </div>
        ) : null}
      </>
    );
  }

  return null;
};
