export const siteConfig = {
  name: "SuicaoDex",
  url: "https://suicaodex.com",
  ogImage: "https://suicaodex.com/og-image.png",
  description: "SuicaoDex - Trang web truyện tranh đầu hàng VN",
  links: {
    discord: "https://discord.gg/dongmoe",
    github: "https://github.com/TNTKien/better-suicaodex",
    facebook: "https://facebook.com/suicaodex",
  },
  suicaodex: {
    domain: "https://suicaodex.com",
    mato_domain: "https://mato.suicaodex.com",
    apiURL: "https://api2.suicaodex.com", //pls use your own proxy server; or use built-in proxy, see /lib/axios.ts
  },
  weebdex: {
    domain: "https://weebdex.org",
    ogURL: "https://og.weebdex.org",
    proxyURL: "https://i.suicaodex.com",
  },
  moetruyen: {
    domain: "https://moetruyen.net",
    apiURL: "https://moe.suicaodex.com",
  },
};

export type SiteConfig = typeof siteConfig;

export const META_THEME_COLORS = {
  light: "#ffffff",
  dark: "#09090b",
};
