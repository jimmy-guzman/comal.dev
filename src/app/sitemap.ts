import type { MetadataRoute } from "next";

const SITE_URL = "https://comal.dev";
const LAST_MODIFIED = new Date("2026-05-23");

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      changeFrequency: "weekly",
      lastModified: LAST_MODIFIED,
      priority: 1,
      url: SITE_URL,
    },
  ];
}
