import Abydos from "#/images/logo/abydos.webp";
import Arius from "#/images/logo/arius.webp";
import Gehenna from "#/images/logo/gehenna.webp";
import Millennium from "#/images/logo/millennium.webp";
import RedWinter from "#/images/logo/redwinter.webp";
import ShanHaiJing from "#/images/logo/shanhaijing.webp";
import SRT from "#/images/logo/srt.webp";
import Trinity from "#/images/logo/trinity.webp";
import Valkyrie from "#/images/logo/valkyrie.webp";
import SuicaoDex from "#/suicaodex.webp";
import SCDex from "#/SCDex-lite.webp";
import SuicaoMoe from "#/suicaomoe.webp";
import SCMoe from "#/scmoe-lite.webp";

export const logos = {
  abydos: Abydos,
  arius: Arius,
  gehenna: Gehenna,
  millennium: Millennium,
  redwinter: RedWinter,
  shanhaijing: ShanHaiJing,
  srt: SRT,
  trinity: Trinity,
  valkyrie: Valkyrie,
  suicaodex: SuicaoDex,
  scdex: SCDex,
  suicaomoe: SuicaoMoe,
  scmoe: SCMoe,
};

export const getLogo = (name: string) => {
  return logos[name as keyof typeof logos] || null;
};
