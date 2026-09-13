"use client";

import { useState, useEffect } from "react";

export function RestaurantPhotoCarousel({
  photos,
  name,
  accent,
  intervalMs = 5000,
  showArrows = true,
}: {
  photos: string[] | null;
  name: string;
  accent: string;
  intervalMs?: number;
  showArrows?: boolean;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (!photos || photos.length <= 1) return;
    const timer = setInterval(() => {
      setCurrent((c) => (c + 1) % photos.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [photos, intervalMs]);

  if (!photos || photos.length === 0) return null;

  const prev = () => setCurrent((c) => (c - 1 + photos.length) % photos.length);
  const next = () => setCurrent((c) => (c + 1) % photos.length);

  return (
    <div className="relative w-full h-full">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photos[current]}
        alt={`${name} restaurant photo`}
        className="rounded-2xl shadow-2xl w-full h-full object-cover"
      />
      {photos.length > 1 && (
        <>
          {showArrows && (
            <>
              <button
                type="button"
                onClick={prev}
                className="absolute left-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-white shadow transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
                aria-label="Previous photo"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={next}
                className="absolute right-3 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full flex items-center justify-center text-white shadow transition-opacity hover:opacity-90"
                style={{ backgroundColor: accent }}
                aria-label="Next photo"
              >
                ›
              </button>
            </>
          )}
          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
            {photos.map((_, i) => (
              <span
                key={i}
                className="h-1.5 w-1.5 rounded-full transition-all"
                style={{
                  backgroundColor: i === current ? accent : "rgba(255,255,255,0.5)",
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
