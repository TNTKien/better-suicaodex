import { siteConfig } from "@/config/site";
import axios, { AxiosInstance } from "axios";

export const RARITIES = [
  "◊",
  "◊◊",
  "◊◊◊",
  "◊◊◊◊",
  "☆",
  "☆☆",
  "☆☆☆",
  "♕",
  "Promo",
] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_PROBABILITIES_BY_ROW = {
  // 1st - 3rd card in a pack
  "1-3 card": {
    "◊": 1,
    "◊◊": 0,
    "◊◊◊": 0,
    "◊◊◊◊": 0,
    "☆": 0,
    "☆☆": 0,
    "☆☆☆": 0,
    "♕": 0,
  },

  // 4th card in a pack
  "4 card": {
    "◊": 0,
    "◊◊": 0.9,
    "◊◊◊": 0.05,
    "◊◊◊◊": 0.01666,
    "☆": 0.02572,
    "☆☆": 0.005,
    "☆☆☆": 0.00222,
    "♕": 0.0004,
  },

  // 5th card in a pack
  "5 card": {
    "◊": 0,
    "◊◊": 0.6,
    "◊◊◊": 0.2,
    "◊◊◊◊": 0.06664,
    "☆": 0.10288,
    "☆☆": 0.02,
    "☆☆☆": 0.00888,
    "♕": 0.0016,
  },
} as const;

export type Pack = {
  id: string;
  name: string;
  image: string;
};

export type Expansion = {
  id: string;
  name: string;
  packs: Pack[];
};

export type Card = {
  id: string;
  name: string;
  rarity: Rarity;
  pack: string;
  health: string;
  image: string;
  fullArt: "Yes" | "No";
  ex: "Yes" | "No";
  artist: string;
  type: string;
};

const createAxiosInstance = (baseURL: string): AxiosInstance => {
  return axios.create({
    baseURL,
    headers: {
      "Content-Type": "application/json",
    },
  });
};

export const pkmAxiosInstance = createAxiosInstance(
  siteConfig.suicaodex.pkmURL + "/v4"
);

export async function fetchExpansions(): Promise<Expansion[]> {
  const response = await pkmAxiosInstance.get("/expansions");
  return response.data;
}