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
    { url: `${siteUrl}/contact`, changeFrequency: "monthly", priority: 0.6 },
    { url: `${siteUrl}/terms-and-conditions`, changeFrequency: "yearly", priority: 0.4 },
    { url: `${siteUrl}/cancellation-refund-policy`, changeFrequency: "yearly", priority: 0.5 },
  ];
}
