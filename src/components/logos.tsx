export const logos = {
  abydos: "/images/logo/abydos.webp",
  arius: "/images/logo/arius.webp",
  gehenna: "/images/logo/gehenna.webp",
  millennium: "/images/logo/millennium.webp",
  redwinter: "/images/logo/redwinter.webp",
  shanhaijing: "/images/logo/shanhaijing.webp",
  srt: "/images/logo/srt.webp",
  trinity: "/images/logo/trinity.webp",
  valkyrie: "/images/logo/valkyrie.webp",
  suicaodex: "/suicaodex.webp",
  scdex: "/SCDex-lite.webp",
};

export const getLogo = (name: string) => {
  return logos[name as keyof typeof logos] || null;
};
