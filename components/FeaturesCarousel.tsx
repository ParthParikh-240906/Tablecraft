"use client";

import { useState, useEffect, useRef } from "react";

export interface CarouselFeature {
  icon?: string;
  title: string;
  subtitle: string;
  description: string;
  color: string;
  image: string;
}

interface FeaturesCarouselProps {
  features: CarouselFeature[];
}

export function FeaturesCarousel({ features }: FeaturesCarouselProps) {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useRef(false);

  useEffect(() => {
    prefersReducedMotion.current =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (prefersReducedMotion.current || !isVisible) return;
    if (isPaused) return;
    const timer = setInterval(
      () => setCurrent((c) => (c + 1) % features.length),
      4000
    );
    return () => clearInterval(timer);
  }, [isVisible, isPaused, features.length]);

  const prev = () =>
    setCurrent((c) => (c - 1 + features.length) % features.length);
  const next = () => setCurrent((c) => (c + 1) % features.length);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function circularOffset(index: number, current: number, n: number): number {
    let offset = index - current;
    while (offset > Math.floor(n / 2)) offset -= n;
    while (offset < -Math.floor(n / 2)) offset += n;
    return offset;
  }

  const getCardStyle = (index: number): React.CSSProperties => {
    const offset = circularOffset(index, current, features.length);
    const absOffset = Math.abs(offset);
    if (absOffset > 1) return { opacity: 0, pointerEvents: "none" as const };
    if (offset === 0)
      return {
        transform: "scale(1) rotate(0deg) translateX(0)",
        opacity: 1,
        zIndex: 10,
      };
    const side = offset < 0 ? -1 : 1;
    const isFar = absOffset === 2;
    const scale = isFar ? 0.8 : 0.82;
    const translateX = side * (isFar ? 120 : 60);
    const rotate = side * (isFar ? 4 : 3);
    return {
      transform: `scale(${scale}) rotate(${rotate}deg) translateX(${translateX}%)`,
      opacity: isFar ? 0.3 : 0.5,
      zIndex: 5,
      pointerEvents: "none" as const,
    };
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="relative h-[460px] overflow-hidden">
        {features.map((f, i) => (
          <div
            key={f.title}
            className="absolute inset-0 flex items-center justify-center transition-all duration-500 ease-in-out"
            style={getCardStyle(i)}
          >
            <div className="bg-[var(--paper-raised)] border border-[var(--rule)] rounded-sm p-6 flex flex-col gap-1 w-[92%] max-w-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <div className="relative h-[220px] overflow-y-auto overflow-x-hidden rounded-sm">
                <img src={f.image} alt={f.title} className="w-full object-contain object-top" />
              </div>
              <div>
                <p className="text-xs text-[var(--accent)] font-semibold tracking-widest uppercase mb-1">
                  {f.subtitle}
                </p>
                <h3 className="font-display text-xl text-[var(--ink)] mb-2">
                  {f.title}
                </h3>
                <p className="text-sm text-[var(--ink-soft)] leading-relaxed">
                  {f.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 mt-6">
        <button
          type="button"
          onClick={prev}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink)] bg-[var(--paper-overlay)] border border-[var(--rule)] hover:bg-[var(--rule-strong)] transition-colors"
          aria-label="Previous"
        >
          ‹
        </button>
        <div className="flex gap-2">
          {features.map((_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setCurrent(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === current
                  ? "w-6 bg-[var(--accent)]"
                  : "w-1.5 bg-[var(--ink-faint)] hover:bg-[var(--ink-soft)]"
              }`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={next}
          className="h-8 w-8 rounded-full flex items-center justify-center text-[var(--ink)] bg-[var(--paper-overlay)] border border-[var(--rule)] hover:bg-[var(--rule-strong)] transition-colors"
          aria-label="Next"
        >
          ›
        </button>
      </div>
    </div>
  );
}
