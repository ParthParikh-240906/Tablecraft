"use client";

interface CanvasHeightControlProps {
  previewHeight: number;
  setPreviewHeight: (height: number | ((prev: number) => number)) => void;
}

export function CanvasHeightControl({
  previewHeight,
  setPreviewHeight,
}: CanvasHeightControlProps) {
  const multiplier = Math.min(5, Math.max(1, Math.round((previewHeight / 640) * 2) / 2));
  const nextMultiplier = multiplier >= 5 ? 1 : multiplier + 0.5;

  const handleStep = () => {
    const nextHeight = Math.round(nextMultiplier * 640);
    setPreviewHeight(nextHeight);
    try {
      localStorage.setItem("tablecraft_preview_height", String(nextHeight));
    } catch {}
  };

  const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    const nextHeight = Math.round(val * 640);
    setPreviewHeight(nextHeight);
    try {
      localStorage.setItem("tablecraft_preview_height", String(nextHeight));
    } catch {}
  };

  const atMax = multiplier >= 5;

  return (
    <div className="space-y-2 mb-3">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleStep}
          aria-label={
            atMax
              ? "Reset preview height to 1×"
              : `Set preview height to ${nextMultiplier}×`
          }
          className="btn btn-outline text-xs px-2.5 py-1"
        >
          {atMax
            ? "Preview height (1×)"
            : `Preview height (${nextMultiplier}×)`}
        </button>
        <span className="text-[10px] text-[var(--ink-faint)] font-mono">
          {previewHeight}px ({multiplier}×)
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] text-[var(--ink-soft)] font-medium">1×</span>
        <input
          type="range"
          min={1}
          max={5}
          step={0.5}
          value={multiplier}
          onChange={handleSliderChange}
          aria-label="Preview height"
          className="w-full accent-[var(--accent)] cursor-pointer h-1.5 bg-[var(--rule)] rounded-lg"
        />
        <span className="text-[10px] text-[var(--ink-soft)] font-medium">5×</span>
      </div>
      <p className="text-[10px] text-[var(--ink-faint)]">
        Changes preview size only — not your live site.
      </p>
    </div>
  );
}
