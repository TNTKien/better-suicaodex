const MOETRUYEN_HOSTNAME = "moetruyen.net";

export interface MoetruyenCoverParams {
  w?: number;
  q?: number;
}

export const MOETRUYEN_DEFAULT_COVER_PARAMS = {
  thumbnail: { w: 512, q: 90 },
  banner: { w: 512, q: 95 },
} as const;

function toPositiveIntegerString(value: number | undefined): string | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }

  const normalized = Math.round(value);

  if (normalized <= 0) {
    return null;
  }

  return String(normalized);
}

function applyMoetruyenCoverParams(
  url: string,
  params: MoetruyenCoverParams,
): string {
  if (!url || url.startsWith("/")) {
    return url;
  }

  try {
    const parsed = new URL(url);

    if (!parsed.hostname.endsWith(MOETRUYEN_HOSTNAME)) {
      return url;
    }

    const width = toPositiveIntegerString(params.w);
    const quality = toPositiveIntegerString(params.q);

    if (width) {
      parsed.searchParams.set("w", width);
    }

    if (quality) {
      parsed.searchParams.set("q", quality);
    }

    return parsed.toString();
  } catch {
    return url;
  }
}

export function getMoetruyenCoverUrl(
  url: string,
  params: MoetruyenCoverParams = {},
): string {
  return applyMoetruyenCoverParams(url, params);
}

export function getMoetruyenThumbnailCoverUrl(
  url: string,
  params: MoetruyenCoverParams = {},
): string {
  return applyMoetruyenCoverParams(url, {
    w: params.w ?? MOETRUYEN_DEFAULT_COVER_PARAMS.thumbnail.w,
    q: params.q ?? MOETRUYEN_DEFAULT_COVER_PARAMS.thumbnail.q,
  });
}

export function getMoetruyenBannerCoverUrl(
  url: string,
  params: MoetruyenCoverParams = {},
): string {
  return applyMoetruyenCoverParams(url, {
    w: params.w ?? MOETRUYEN_DEFAULT_COVER_PARAMS.banner.w,
    q: params.q ?? MOETRUYEN_DEFAULT_COVER_PARAMS.banner.q,
  });
}
