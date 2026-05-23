import type { MetadataRoute } from "next";

const SITE_URL = "https://comal.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      lastModified: new Date(),
      priority: 1,
      url: SITE_URL,
    },
  ];
}
