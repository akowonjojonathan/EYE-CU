import React, { useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Building2,
  ImagePlus,
  Plus,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import {
  INDOOR_DIRECTION_OPTIONS,
  type IndoorDirectionIcon,
  type IndoorStep,
} from "@/constants/campus";
import { IndoorDirectionIconView } from "@/components/IndoorDirectionIconView";

type IndoorStepBuilderProps = {
  isIndoor: boolean;
  onToggleIndoor: (next: boolean) => void;
  parentBuildingName: string;
  onChangeParentBuildingName: (value: string) => void;
  steps: IndoorStep[];
  onChangeSteps: (next: IndoorStep[]) => void;
  buildingSuggestions: string[];
};

const MAX_STEPS = 15;
const MAX_DATA_URL_LENGTH = 38000;

async function compressImageToDataUrl(file: File): Promise<string> {
  const objectUrl = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not load selected image."));
      el.src = objectUrl;
    });

    const maxDim = 480;
    const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
    const width = Math.max(1, Math.round(img.width * scale));
    const height = Math.max(1, Math.round(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas image processing is unavailable.");
    ctx.drawImage(img, 0, 0, width, height);

    for (const quality of [0.72, 0.56, 0.42]) {
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      if (dataUrl.length <= MAX_DATA_URL_LENGTH) {
        return dataUrl;
      }
    }
    throw new Error(
      "Photo is still too detailed after compression. Try a smaller image or paste a photo URL.",
    );
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

function renumber(steps: IndoorStep[]): IndoorStep[] {
  return steps.map((step, idx) => ({
    ...step,
    stepNumber: idx + 1,
  }));
}

export function IndoorStepBuilder({
  isIndoor,
  onToggleIndoor,
  parentBuildingName,
  onChangeParentBuildingName,
  steps,
  onChangeSteps,
  buildingSuggestions,
}: IndoorStepBuilderProps) {
  const [uploadError, setUploadError] = useState<string | null>(null);

  const addStep = (icon: IndoorDirectionIcon = "straight") => {
    if (steps.length >= MAX_STEPS) return;
    onChangeSteps(
      renumber([
        ...steps,
        {
          stepNumber: steps.length + 1,
          directionIcon: icon,
          instructionText: "",
        },
      ]),
    );
  };

  const loadSampleSteps = () => {
    onChangeSteps([
      {
        stepNumber: 1,
        directionIcon: "straight",
        instructionText: "Enter through the main ground-floor glass entrance and walk past the notice board.",
      },
      {
        stepNumber: 2,
        directionIcon: "stairs-up",
        instructionText: "Take the central staircase up one floor to the corridor.",
      },
      {
        stepNumber: 3,
        directionIcon: "left",
        instructionText: "Turn left along the hallway and pass two lecture rooms.",
      },
      {
        stepNumber: 4,
        directionIcon: "door",
        instructionText: "Your destination door is directly on the right.",
      },
    ]);
  };

  const updateStep = (index: number, patch: Partial<IndoorStep>) => {
    const next = steps.map((s, i) => (i === index ? { ...s, ...patch } : s));
    onChangeSteps(renumber(next));
  };

  const moveStep = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= steps.length) return;
    const next = [...steps];
    const [item] = next.splice(index, 1);
    if (!item) return;
    next.splice(target, 0, item);
    onChangeSteps(renumber(next));
  };

  const removeStep = (index: number) => {
    onChangeSteps(renumber(steps.filter((_, i) => i !== index)));
  };

  const handlePhotoUpload = async (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploadError(null);
    try {
      const dataUrl = await compressImageToDataUrl(file);
      updateStep(index, { landmarkImageUrl: dataUrl });
    } catch (err) {
      setUploadError(
        err instanceof Error ? err.message : "Could not process selected photo.",
      );
    }
  };

  return (
    <div className="indoor-builder-card">
      <div className="indoor-builder-header">
        <div className="indoor-builder-title-wrap">
          <Building2 size={16} color="var(--primary)" />
          <div>
            <div className="indoor-builder-title">Indoor Location</div>
            <div className="indoor-builder-sub">
              Add step-by-step directions inside a building once the user arrives outside.
            </div>
          </div>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={isIndoor}
          onClick={() => onToggleIndoor(!isIndoor)}
          className={`indoor-switch-btn${isIndoor ? " is-on" : ""}`}
        >
          <span className="indoor-switch-thumb" />
        </button>
      </div>

      {isIndoor ? (
        <div className="indoor-builder-body">
          <div className="field-group">
            <label htmlFor="parent-building-name" className="field-label">
              Parent Building / Wing Name
            </label>
            <input
              id="parent-building-name"
              type="text"
              list="eyecu-building-suggestions"
              value={parentBuildingName}
              onChange={(e) => onChangeParentBuildingName(e.target.value)}
              placeholder="e.g. Block B - Central University"
              maxLength={100}
              className="field-input"
            />
            <datalist id="eyecu-building-suggestions">
              {buildingSuggestions.map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>

          <div className="indoor-steps-head">
            <span className="field-label">
              Indoor Steps ({steps.length}/{MAX_STEPS})
            </span>
            <div className="indoor-steps-actions">
              {steps.length === 0 ? (
                <button
                  type="button"
                  onClick={loadSampleSteps}
                  className="json-mini-btn"
                >
                  <Sparkles size={12} />
                  <span>Load Example</span>
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => addStep(steps.length === 0 ? "straight" : "door")}
                disabled={steps.length >= MAX_STEPS}
                className="json-mini-btn"
              >
                <Plus size={12} />
                <span>Add Step</span>
              </button>
            </div>
          </div>

          {uploadError ? <div className="form-error">{uploadError}</div> : null}

          {steps.length === 0 ? (
            <div className="indoor-empty-hint">
              No indoor steps added yet. Click <strong>Add Step</strong> or{" "}
              <strong>Load Example</strong> to build the hallway &amp; stair guide.
            </div>
          ) : (
            <div className="indoor-step-editor-list">
              {steps.map((step, index) => (
                <div key={`step-${index}`} className="indoor-step-editor-item">
                  <div className="indoor-step-editor-top">
                    <span className="indoor-step-num-badge">
                      Step {index + 1}
                    </span>
                    <div className="indoor-step-reorder">
                      <button
                        type="button"
                        aria-label={`Move step ${index + 1} up`}
                        disabled={index === 0}
                        onClick={() => moveStep(index, -1)}
                        className="indoor-mini-icon-btn"
                        title="Move up"
                      >
                        <ArrowUp size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Move step ${index + 1} down`}
                        disabled={index === steps.length - 1}
                        onClick={() => moveStep(index, 1)}
                        className="indoor-mini-icon-btn"
                        title="Move down"
                      >
                        <ArrowDown size={13} />
                      </button>
                      <button
                        type="button"
                        aria-label={`Delete step ${index + 1}`}
                        onClick={() => removeStep(index)}
                        className="indoor-mini-icon-btn is-danger"
                        title="Delete step"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div
                    className="indoor-icon-picker"
                    role="group"
                    aria-label={`Direction icon for step ${index + 1}`}
                  >
                    {INDOOR_DIRECTION_OPTIONS.map((opt) => {
                      const active = step.directionIcon === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() =>
                            updateStep(index, { directionIcon: opt.value })
                          }
                          className={`indoor-icon-choice${active ? " is-active" : ""}`}
                          title={opt.label}
                        >
                          <IndoorDirectionIconView icon={opt.value} size={14} />
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <input
                    type="text"
                    value={step.instructionText}
                    onChange={(e) =>
                      updateStep(index, { instructionText: e.target.value })
                    }
                    placeholder="e.g. Turn left past the notice board and climb to Floor 2"
                    maxLength={240}
                    className="field-input"
                  />

                  <div className="indoor-photo-row">
                    <input
                      type="text"
                      value={
                        step.landmarkImageUrl?.startsWith("data:")
                          ? ""
                          : step.landmarkImageUrl || ""
                      }
                      onChange={(e) =>
                        updateStep(index, { landmarkImageUrl: e.target.value })
                      }
                      placeholder="Optional landmark photo URL (https://...)"
                      className="field-input"
                      style={{ flex: 1, minHeight: 36, fontSize: 12 }}
                    />
                    <label className="json-mini-btn" style={{ minHeight: 36 }}>
                      <ImagePlus size={13} />
                      <span>Upload</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => void handlePhotoUpload(index, e)}
                        style={{ display: "none" }}
                      />
                    </label>
                    {step.landmarkImageUrl ? (
                      <button
                        type="button"
                        aria-label="Remove landmark photo"
                        onClick={() =>
                          updateStep(index, { landmarkImageUrl: undefined })
                        }
                        className="indoor-mini-icon-btn"
                        title="Remove photo"
                      >
                        <X size={13} />
                      </button>
                    ) : null}
                  </div>

                  {step.landmarkImageUrl ? (
                    <img
                      src={step.landmarkImageUrl}
                      alt={`Step ${index + 1} landmark preview`}
                      className="indoor-editor-thumb"
                    />
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
