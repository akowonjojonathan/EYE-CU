import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  Building2,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import type { CampusPlace } from "@/constants/campus";
import {
  INDOOR_DIRECTION_DETAILS,
  IndoorDirectionIconView,
} from "@/components/IndoorDirectionIconView";
import { triggerHaptic } from "@/lib/haptics";

type IndoorGuideOverlayProps = {
  place: CampusPlace;
  stepIndex: number;
  onChangeStep: (nextIndex: number) => void;
  onComplete: () => void;
  onClose: () => void;
};

export function IndoorGuideOverlay({
  place,
  stepIndex,
  onChangeStep,
  onComplete,
  onClose,
}: IndoorGuideOverlayProps) {
  const steps = place.indoorSteps ?? [];
  const safeIndex = Math.max(0, Math.min(stepIndex, Math.max(0, steps.length - 1)));
  const activeStep = steps[safeIndex];
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [speechNotice, setSpeechNotice] = useState<string | null>(null);
  const [imgLoaded, setImgLoaded] = useState(false);

  const stopSpeech = () => {
    try {
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    } catch {
      // Ignore synthesis cancel errors
    }
    setIsSpeaking(false);
  };

  useEffect(() => {
    stopSpeech();
    setImgLoaded(false);
    return () => stopSpeech();
  }, [safeIndex, place.id]);

  if (!activeStep || steps.length === 0) return null;

  const meta = INDOOR_DIRECTION_DETAILS[activeStep.directionIcon];
  const progressPct = Math.round(((safeIndex + 1) / steps.length) * 100);
  const isLastStep = safeIndex >= steps.length - 1;

  const handleGoStep = (nextIndex: number) => {
    const clamped = Math.max(0, Math.min(steps.length - 1, nextIndex));
    if (clamped !== safeIndex) {
      triggerHaptic("step");
      onChangeStep(clamped);
    }
  };

  const handleSpeakDirections = () => {
    setSpeechNotice(null);
    triggerHaptic("tap");
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      typeof SpeechSynthesisUtterance === "undefined"
    ) {
      setSpeechNotice("Voice directions are not supported in this browser.");
      return;
    }

    if (isSpeaking) {
      stopSpeech();
      return;
    }

    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(
        `Step ${safeIndex + 1} of ${steps.length}. ${meta.cue}. ${activeStep.instructionText}`,
      );
      utterance.rate = 0.96;
      utterance.pitch = 1;
      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } catch {
      setIsSpeaking(false);
      setSpeechNotice("Could not play voice directions on this device.");
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="indoor-overlay-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label={`Indoor directions for ${place.name}`}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          stopSpeech();
          onClose();
        }
      }}
    >
      <motion.section
        initial={{ opacity: 0, y: 36, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 24, scale: 0.96 }}
        transition={{ type: "spring", stiffness: 340, damping: 28 }}
        className="indoor-guide-card glass-modal"
      >
        <div className="indoor-guide-head">
          <div className="indoor-guide-kicker-row">
            <span className="indoor-guide-kicker">
              <Building2 size={13} />
              <span>
                {place.parentBuildingName
                  ? `Inside ${place.parentBuildingName}`
                  : "Indoor Step-by-Step Guide"}
              </span>
            </span>
            <span className="indoor-guide-step-count tabular-nums">
              Step {safeIndex + 1} of {steps.length}
            </span>
          </div>
          <button
            type="button"
            aria-label="Close indoor guide"
            onClick={() => {
              triggerHaptic("tap");
              stopSpeech();
              onClose();
            }}
            className="close-modal-btn"
          >
            <X size={18} />
          </button>
        </div>

        <h2 className="indoor-guide-place-title">{place.name}</h2>

        <div
          className="indoor-progress-track"
          role="progressbar"
          aria-valuenow={progressPct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <motion.div
            className="indoor-progress-fill"
            initial={false}
            animate={{ width: `${progressPct}%` }}
            transition={{ type: "spring", stiffness: 280, damping: 28 }}
          />
        </div>

        <div className="indoor-step-dots">
          {steps.map((s, idx) => (
            <button
              key={`dot-${s.stepNumber}-${idx}`}
              type="button"
              onClick={() => handleGoStep(idx)}
              className={`indoor-step-dot${idx === safeIndex ? " is-current" : idx < safeIndex ? " is-done" : ""}`}
              aria-label={`Go to step ${idx + 1}`}
            >
              {idx + 1}
            </button>
          ))}
        </div>

        <motion.div
          key={`${place.id}-step-${safeIndex}`}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.22}
          onDragEnd={(_, info) => {
            if (info.offset.x < -55 && safeIndex < steps.length - 1) {
              handleGoStep(safeIndex + 1);
            } else if (info.offset.x > 55 && safeIndex > 0) {
              handleGoStep(safeIndex - 1);
            }
          }}
          initial={{ opacity: 0, x: 14 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ type: "spring", stiffness: 360, damping: 30 }}
          className="indoor-active-step-panel is-swipeable"
        >
          <div
            className="indoor-active-icon-box"
            style={{ backgroundColor: meta.bg, color: meta.color }}
          >
            <IndoorDirectionIconView icon={activeStep.directionIcon} size={32} />
          </div>
          <div className="indoor-active-copy">
            <span
              className="indoor-active-cue"
              style={{ color: meta.color }}
            >
              {meta.cue}
            </span>
            <p className="indoor-active-instruction">
              {activeStep.instructionText}
            </p>
            {steps.length > 1 ? (
              <span className="indoor-swipe-hint">
                Swipe card left or right for steps
              </span>
            ) : null}
          </div>
        </motion.div>

        {activeStep.landmarkImageUrl ? (
          <div className={`indoor-landmark-frame${!imgLoaded ? " is-shimmering" : ""}`}>
            <img
              src={activeStep.landmarkImageUrl}
              alt={`Landmark for step ${safeIndex + 1}`}
              className={`indoor-landmark-img${imgLoaded ? " is-loaded" : ""}`}
              onLoad={() => setImgLoaded(true)}
            />
          </div>
        ) : null}

        <div className="indoor-speech-row">
          <button
            type="button"
            onClick={handleSpeakDirections}
            className={`indoor-speak-btn${isSpeaking ? " is-speaking" : ""}`}
          >
            {isSpeaking ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{isSpeaking ? "Stop Voice" : "Speak Directions"}</span>
          </button>
          {speechNotice ? (
            <span className="indoor-speech-notice">{speechNotice}</span>
          ) : null}
        </div>

        <div className="indoor-nav-footer">
          <motion.button
            type="button"
            whileTap={{ scale: 0.96 }}
            disabled={safeIndex === 0}
            onClick={() => handleGoStep(safeIndex - 1)}
            className="secondary-cta"
            style={{ flex: 1 }}
          >
            <ChevronLeft size={16} />
            <span>Previous</span>
          </motion.button>

          {!isLastStep ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => handleGoStep(safeIndex + 1)}
              className="primary-cta"
              style={{ flex: 1.3 }}
            >
              <span>Next Step</span>
              <ChevronRight size={16} />
            </motion.button>
          ) : (
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => {
                triggerHaptic("arrive");
                stopSpeech();
                onComplete();
              }}
              className="primary-cta"
              style={{ flex: 1.3 }}
            >
              <CheckCircle2 size={16} />
              <span>I&apos;m Here! Finish</span>
            </motion.button>
          )}
        </div>
      </motion.section>
    </motion.div>
  );
}
