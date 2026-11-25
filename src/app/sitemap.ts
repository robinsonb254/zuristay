import type { MetadataRoute } from "next";

const siteUrl = "https://zuristayworldwide.com";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: siteUrl,
      changeFrequency: "daily",
      priority: 1,
    },
    {
      url: `${siteUrl}/destinations`,
      changeFrequency: "weekly",
      priority: 0.9,
    },
  ];
}
