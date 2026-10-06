"use client";

import React, { useState } from "react";
import type { TextDesign } from "@/lib/design";

export function AnimationBuilder({
  design,
  onChange,
}: {
  design: TextDesign;
  onChange: (d: TextDesign) => void;
}) {
  const currentAnim = design.animation || { type: "none", duration: 0.5, delay: 0 };
  const currentShadow = design.shadow || { color: "#000000", direction: 90, length: 0, opacity: 0 };

  type AnimationType = NonNullable<TextDesign["animation"]>["type"];

  const updateAnimationType = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value as AnimationType;
    const next = { ...design, animation: { ...currentAnim, type: val } };
    onChange(next);
  };

  const updateAnimationDuration = (e: React.ChangeEvent<HTMLInputElement>) => {
    const next = { ...design, animation: { ...currentAnim, duration: parseFloat(e.target.value) } };
    onChange(next);
  };

  const updateShadow = (field: keyof typeof currentShadow, value: string | number) => {
    const nextShadow = { ...currentShadow, [field]: value };
    const nextShape = { ...design, shadow: nextShadow };
    onChange(nextShape);
  };

  return (
    <div className="space-y-4 pt-2 border-t border-[var(--rule)]">
      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          Animation
        </label>
        <div className="flex gap-2 mb-2">
          <select
            value={currentAnim.type}
            onChange={updateAnimationType}
            className="flex-1 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1 text-xs"
          >
            <option value="none">None</option>
            <option value="slideUp">Slide Up</option>
            <option value="scaleOut">Scale Out</option>
            <option value="fadeIn">Fade In</option>
          </select>
        </div>
        {currentAnim.type !== "none" && (
          <div className="flex items-center gap-2">
            <span className="text-[10px] uppercase text-[var(--ink-soft)] min-w-[40px]">Duration</span>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={currentAnim.duration}
              onChange={updateAnimationDuration}
              className="flex-1 accent-[var(--accent)]"
            />
            <span className="text-xs w-8 text-right">{currentAnim.duration}s</span>
          </div>
        )}
      </div>

      <div>
        <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--ink-soft)] mb-1">
          Drop Shadow
        </label>
        <div className="grid grid-cols-4 gap-2 text-xs">
          <div>
            <input
              type="color"
              value={currentShadow.color}
              onChange={(e) => updateShadow("color", e.target.value)}
              className="w-full h-6 px-1 bg-[var(--paper-overlay)] border border-[var(--rule)] rounded cursor-pointer"
            />
            <span className="text-[10px] text-[var(--ink-soft)] block text-center mt-1">Color</span>
          </div>
          <div>
            <input
              type="number"
              min="-360"
              max="360"
              value={currentShadow.direction}
              onChange={(e) => updateShadow("direction", parseInt(e.target.value) || 0)}
              className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1 text-center"
            />
            <span className="text-[10px] text-[var(--ink-soft)] block text-center mt-1">Angle</span>
          </div>
          <div>
            <input
              type="number"
              min="0"
              max="100"
              value={currentShadow.length}
              onChange={(e) => updateShadow("length", parseInt(e.target.value) || 0)}
              className="w-full bg-[var(--paper-overlay)] border border-[var(--rule)] rounded px-2 py-1 text-center"
            />
            <span className="text-[10px] text-[var(--ink-soft)] block text-center mt-1">Distance</span>
          </div>
          <div>
            <input
              type="range"
              min="0"
              max="100"
              value={(currentShadow.opacity ?? 0) * 100}
              onChange={(e) => updateShadow("opacity", parseInt(e.target.value) / 100)}
              className="w-full accent-[var(--accent)]"
            />
            <span className="text-[10px] text-[var(--ink-soft)] block text-center mt-1">
              Opacity {`${Math.round((currentShadow.opacity ?? 0) * 100)}%`}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
