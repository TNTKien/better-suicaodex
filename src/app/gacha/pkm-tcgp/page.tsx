import PokemonTCGP from "@/components/Pages/Gacha/TCGP";
import { Metadata } from "next";

export function generateMetadata(): Metadata {
  return {
    title: "Pokemon TCGP Simulator - SuicaoDex",
    description: "SuicaoDex88 - Nhà cái đầu hàng Vi En",
    keywords: ["Gacha", "SuicaoDex", "Blue Archive", "Pokemon TCG", "Honkai Star Rail"],
  };
}

export default function Page() {
  return <PokemonTCGP />;
}
