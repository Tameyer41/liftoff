import { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://demo.useliftoff.com",
      lastModified: new Date(),
    },
    {
      url: "https://demo.useliftoff.com/demo",
      lastModified: new Date(),
    },
  ];
}
