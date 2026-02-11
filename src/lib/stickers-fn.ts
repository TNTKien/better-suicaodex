// Sticker definitions for comment system
// Format: :sticker_name: will be replaced with the image

export interface StickerCategory {
  id: string;
  name: string;
}

export interface Sticker {
  title: string;
  url: string;
  category?: StickerCategory["id"];
}

// Sticker categories with display names
export const stickerCategories: StickerCategory[] = [
  { id: "bluearchive", name: "Blue Archive" },
  { id: "bocchi", name: "Bocchi The Rock" },
  { id: "doro", name: "Doro" },
  { id: "michos", name: "HoYoverse" },
  { id: "princonne", name: "Princess Connect! Re:Dive" },
  { id: "others", name: "Khác" },
];

export const stickers: Sticker[] = [
  // Blue Archive
  {
    title: "ba-hoshino-xamloz",
    url: "/images/stickers/bluearchive/ba-hoshino-xamloz.webp",
    category: "bluearchive",
  },
  {
    title: "ba-koharu",
    url: "/images/stickers/bluearchive/ba-koharu.webp",
    category: "bluearchive",
  },
  {
    title: "ba-shiroko",
    url: "/images/stickers/bluearchive/ba-shiroko.webp",
    category: "bluearchive",
  },

  // Bocchi
  {
    title: "bocchi-kita",
    url: "/images/stickers/bocchi/bocchi-kita.webp",
    category: "bocchi",
  },
  {
    title: "bocchi-nijikagay",
    url: "/images/stickers/bocchi/bocchi-nijikagay.webp",
    category: "bocchi",
  },
  {
    title: "bocchi-rto",
    url: "/images/stickers/bocchi/bocchi-rto.webp",
    category: "bocchi",
  },
  {
    title: "bocchi-shake",
    url: "/images/stickers/bocchi/bocchi-shake.gif",
    category: "bocchi",
  },

  // Doro
  {
    title: "doro-cinema",
    url: "/images/stickers/doro/doro-cinema.webp",
    category: "doro",
  },
  {
    title: "doro-fire",
    url: "/images/stickers/doro/doro-fire.gif",
    category: "doro",
  },
  {
    title: "doro-hard",
    url: "/images/stickers/doro/doro-hard.gif",
    category: "doro",
  },
  {
    title: "doro-origin",
    url: "/images/stickers/doro/doro-origin.webp",
    category: "doro",
  },
  {
    title: "doro-think",
    url: "/images/stickers/doro/doro-think.gif",
    category: "doro",
  },

  // Michos (Hoyo games)
  {
    title: "hi3-bronya",
    url: "/images/stickers/michos/hi3-bronya.webp",
    category: "michos",
  },
  {
    title: "hsr-hanbi",
    url: "/images/stickers/michos/hsr-hanbi.webp",
    category: "michos",
  },
  {
    title: "hsr-danheng",
    url: "/images/stickers/michos/hsr-danheng.gif",
    category: "michos",
  },
  {
    title: "zzz-boo",
    url: "/images/stickers/michos/zzz-boo.gif",
    category: "michos",
  },

  // Princess Connect (Kyaru)
  {
    title: "kyaru-cafe",
    url: "/images/stickers/princonne/kyaru-cafe.png",
    category: "princonne",
  },
  {
    title: "kyaru-suc",
    url: "/images/stickers/princonne/kyaru-suc.gif",
    category: "princonne",
  },
  {
    title: "kyaru-tail",
    url: "/images/stickers/princonne/kyaru-tail.gif",
    category: "princonne",
  },
  {
    title: "kyaru-uhm",
    url: "/images/stickers/princonne/kyaru-uhm.webp",
    category: "princonne",
  },
  {
    title: "kyaru-vuong",
    url: "/images/stickers/princonne/kyaru-vuong.webp",
    category: "princonne",
  },

  // Others
  {
    title: "cunny",
    url: "/images/stickers/others/cunny.gif",
    category: "others",
  },
  { title: "gay", url: "/images/stickers/others/gay.webp", category: "others" },
  {
    title: "lau-chat",
    url: "/images/stickers/others/lau-chat.gif",
    category: "others",
  },
  { title: "mau", url: "/images/stickers/others/mau.webp", category: "others" },
  {
    title: "meo-xamloz",
    url: "/images/stickers/others/meo-xamloz.webp",
    category: "others",
  },
  {
    title: "nikke-shifty",
    url: "/images/stickers/others/nikke-shifty.gif",
    category: "others",
  },
  {
    title: "pepe-sieu-long",
    url: "/images/stickers/others/pepe-sieu-long.webp",
    category: "others",
  },
  {
    title: "woman",
    url: "/images/stickers/others/woman.webp",
    category: "others",
  },
];

// Helper function to get sticker by name
export function getStickerByName(name: string): Sticker | undefined {
  return stickers.find((s) => s.title === name);
}

// Helper function to get all stickers by category
export function getStickersByCategory(category: string): Sticker[] {
  return stickers.filter((s) => s.category === category);
}

// Get all categories
export function getCategories(): string[] {
  return stickerCategories.map((c) => c.id);
}

// Get category display name
export function getCategoryName(categoryId: string): string {
  return stickerCategories.find((c) => c.id === categoryId)?.name ?? categoryId;
}
