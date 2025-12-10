"use client";

import { Hover3DCard } from "@/components/ui/hover-3d-card";
import { fetchPacks } from "@/lib/suicaodex/pkm-tcgp";
import useSWR from "swr";

// interface PokemonTCGPProps {
//   expansions: Expansion[];
// }

export default function PokemonTCGP() {
  const { data: packData, isLoading, error } = useSWR("packs", fetchPacks);

  return (
    <div>
      <h1>Pokemon TCG Gacha Simulator - SuicaoDex</h1>
      <div className="w-full grid grid-cols-6 gap-2">
        {isLoading && <p>Loading packs...</p>}
        {error && <p>Error loading packs: {error.message}</p>}
        {packData &&
          packData.map((pack) => (
            <div key={pack.id} className="border p-2 rounded">
              <Hover3DCard imageSrc={pack.image} alt={pack.name} className="" />
              <h2 className="text-lg font-bold">{pack.name}</h2>
            </div>
          ))}
      </div>
    </div>
  );
}
