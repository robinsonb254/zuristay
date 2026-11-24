"use client";

import { useEffect, useRef, useState } from "react";

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
  const containerRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const node = containerRef.current;
    if (!node) return;
    if (!("IntersectionObserver" in window)) {
      setShouldLoad(true);
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) {
        setShouldLoad(true);
        observer.disconnect();
      }
    }, { rootMargin: "700px" });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    let active = true;
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch(
          `/api/location-photos?location=${encodeURIComponent(location)}`,
          { signal: controller.signal, cache: "force-cache" }
        );
        if (!response.ok) throw new Error("Destination photo lookup failed");
        const result = await response.json();
        if (active && Array.isArray(result.photos) && result.photos.length) {
          setPhotos(result.photos);
          setPhotoIndex(0);
        }
      } catch {
        // Keep the accessible placeholder if the photo service is unavailable.
      } finally {
        if (active) setLoaded(true);
      }
    }
    load();
    return () => {
      active = false;
      controller.abort();
    };
  }, [location, shouldLoad]);

  const photo = photos[photoIndex];

  return (
    <div
      ref={containerRef}
      className={`relative overflow-hidden bg-gradient-to-br from-[#e7e2d6] to-[#cbd8ce] ${className}`}
    >
      {photo ? (
        <img
          src={photo.imageUrl}
          alt={`${location} — ${photo.title}`}
          loading={shouldLoad ? "eager" : "lazy"}
          decoding="async"
          fetchPriority="high"
          onError={() => {
            if (photoIndex + 1 < photos.length) setPhotoIndex((index) => index + 1);
            else setPhotos([]);
          }}
          className="h-full w-full object-cover"
        />
      ) : (
        <div className="flex h-full min-h-20 items-center justify-center p-3 text-center text-xs font-semibold text-[#496457]">
          {!shouldLoad || !loaded
            ? `Finding a photo of ${location}…`
            : `Photo for ${location} coming soon`}
        </div>
      )}
    </div>
  );
}
