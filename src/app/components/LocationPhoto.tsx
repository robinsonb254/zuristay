"use client";

import { useEffect, useState } from "react";

type Photo = {
  title: string;
  imageUrl: string;
  sourceUrl: string;
  credit: string;
  license: string;
  licenseUrl: string;
};

export default function LocationPhoto({
  location,
  className = "",
  compact = false,
}: {
  location: string;
  className?: string;
  compact?: boolean;
}) {
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(`/api/location-photos?location=${encodeURIComponent(location)}`, { signal: controller.signal });
        const result = await response.json();
        if (active && result.photos?.length) setPhoto(result.photos[0]);
      } catch {
        // Keep the accessible location placeholder if the external source is unavailable.
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => { active = false; controller.abort(); };
  }, [location]);

  return (
    <div className={`relative overflow-hidden bg-gradient-to-br from-[#e7e2d6] to-[#cbd8ce] ${className}`}>
      {photo ? (
        <>
          <img src={photo.imageUrl} alt={`${location} — ${photo.title}`} loading="lazy" className="h-full w-full object-cover" />
        </>
      ) : (
        <div className="flex h-full min-h-20 items-center justify-center p-3 text-center text-xs font-semibold text-[#496457]">
          {loaded ? `Photo for ${location} coming soon` : `Finding a photo of ${location}…`}
        </div>
      )}
    </div>
  );
}
