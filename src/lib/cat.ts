import z from "zod";

export const CATAAS_BASE = "https://cataas.com";

// export interface Cat {
//   id: string;
//   tags: string[];
//   created_at: string;
//   url?: string;
//   mimetype: string;
//   createdAt?: string;
// }

export const CatSchema = z.object({
  id: z.string(),
  tags: z.array(z.string()),
  url: z.string().optional(),
  mimetype: z.enum(["image/jpeg", "image/png"]),
  createdAt: z.iso.datetime(),
});

export type Cat = z.infer<typeof CatSchema>;

/**
 * Get a list of cats with pagination
 * @param skip - Number of cats to skip
 * @param limit - Number of cats to fetch (max 100)
 * @returns Array of cat objects
 */
export async function getCatsList(skip = 0, limit = 10): Promise<Cat[]> {
  try {
    const response = await fetch(
      `${CATAAS_BASE}/api/cats?skip=${skip}&limit=${limit}`,
    );
    if (!response.ok) {
      throw new Error("Failed to fetch cats");
    }
    const data = (await response.json()) as Cat;
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error fetching cats:", error);
    return [];
  }
}

/**
 * Get a random cat with metadata
 * @param options - Optional query parameters for image customization
 * @returns Random cat object with id, tags, url, etc.
 */
export async function getRandomCat(options?: {
  width?: number;
  height?: number;
}): Promise<Cat | null> {
  try {
    const params = new URLSearchParams();
    params.append("json", "true");
    if (options?.width) params.append("width", options.width.toString());
    if (options?.height) params.append("height", options.height.toString());

    const response = await fetch(`${CATAAS_BASE}/cat?${params.toString()}`);
    if (!response.ok) {
      throw new Error("Failed to fetch cat");
    }
    const data = (await response.json()) as Cat;
    return data;
  } catch (error) {
    console.error("Error fetching cat:", error);
    return null;
  }
}

/**
 * Get the total count of cats available in the cataas.com database
 * @returns Total number of cats
 */
export async function getCatCount(): Promise<number> {
  try {
    const response = await fetch(`${CATAAS_BASE}/api/count`);
    if (!response.ok) {
      throw new Error("Failed to fetch cat count");
    }
    const data = (await response.json()) as { count: string };
    return typeof data === "object" && data.count ? Number(data.count) : 0;
  } catch (error) {
    console.error("Error fetching cat count:", error);
    return 0;
  }
}

/**
 * Build a cat image URL with optional query parameters
 * @param catId - The cat ID from the API
 * @param options - Optional query parameters for image customization
 * @returns Full image URL
 */
export function getCatImageUrl(
  catId: string,
  options?: {
    width?: number;
    height?: number;
  },
): string {
  const url = `${CATAAS_BASE}/cat/${catId}`;

  const params = new URLSearchParams();
  if (options?.width) params.append("width", options.width.toString());
  if (options?.height) params.append("height", options.height.toString());

  const queryString = params.toString();
  return queryString ? `${url}?${queryString}` : url;
}
