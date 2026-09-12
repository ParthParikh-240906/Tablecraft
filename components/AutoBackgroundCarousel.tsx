"use client";

import { useEffect, useState } from "react";

/**
 * Full-bleed auto-advancing background carousel: images crossfade in one
 * direction every intervalMs, no arrow buttons. Used for hero backgrounds
 * (preview + public site) and background layers.
 */
export function AutoBackgroundCarousel({
  urls,
  intervalMs = 4000,
}: {
  urls: string[];
  intervalMs?: number;
}) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    if (urls.length <= 1) return;
    const timer = setInterval(() => setCurrent((c) => (c + 1) % urls.length), intervalMs);
    return () => clearInterval(timer);
  }, [urls, intervalMs]);

  if (urls.length === 0) return null;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {urls.map((u, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src={u}
          alt=""
          className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
            i === current ? "opacity-100" : "opacity-0"
          }`}
          draggable={false}
        />
      ))}
    </div>
  );
}