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

export interface TCGPApiResponse<T = any> {
  success: boolean;
  message: string;
  data: T | null;
  error: {
    code: string;
    details?: Array<{ field?: string; message: string }>;
  } | null;
}

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

export async function fetchPacks(): Promise<Pack[]> {
  const response = await pkmAxiosInstance.get<TCGPApiResponse<Pack[]>>(
    "/packs"
  );

  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to fetch packs");
  }

  return response.data.data as Pack[];
}


export async function openPack(packname: string): Promise<Card[]> {
  const response = await pkmAxiosInstance.get<TCGPApiResponse<Card[]>>(
    `/pull?pack=${encodeURIComponent(packname)}`
  );
  if (!response.data.success) {
    throw new Error(response.data.message || "Failed to open pack");
  }
  return response.data.data as Card[];
}