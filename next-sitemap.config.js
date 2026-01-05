const url = process.env.SITEMAP_URL || 'https://suicaodex.net';

/** @type {import('next-sitemap').IConfig} */
module.exports = {
  siteUrl: url,
  generateRobotsTxt: true,
  sitemapSize: 100,
  robotsTxtOptions: {
    additionalSitemaps: [
      `${url}/manga-sitemap.xml`,
      // `${url}/chapter-sitemap.xml`,
    ],
  },
};