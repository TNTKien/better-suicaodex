"use client";

import { Expansion, fetchExpansions } from "@/lib/suicaodex/pkm-tcgp";
import useSWR from "swr";

// interface PokemonTCGPProps {
//   expansions: Expansion[];
// }

export default function PokemonTCGP() {
  const { data, isLoading, error } = useSWR<Expansion[]>(
    "/expansions",
    fetchExpansions
  );

  return (
    <div>
      <h1>Pokemon TCG Gacha Simulator - SuicaoDex</h1>
      <ul>
        {data?.map((expansion) => (
          <li key={expansion.id}>{expansion.name}</li>
        ))}
      </ul>
    </div>
  );
}
