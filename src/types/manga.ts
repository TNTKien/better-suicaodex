type LocalizedString = Record<string, string>; // VD: { "en": "Value", "vi": "Giá trị" }

export interface MangaTagAttributes {
  name: LocalizedString;
  description: LocalizedString;
  group: "genre" | "format" | "theme" | "content";
  version: number;
}

export interface MangaTag {
  id: string;
  type: "tag";
  attributes: MangaTagAttributes;
  relationships: any[];
}

// Relationships (Author, Artist, Cover Art, etc.)
interface BaseRelationship {
  id: string;
  type: string;
}

export interface AuthorAttributes {
  name: string;
  imageUrl: string | null;
  biography: LocalizedString;
  twitter: string | null;
  pixiv: string | null;
  melonBook: string | null;
  fanBox: string | null;
  booth: string | null;
  namicomi: string | null;
  nicoVideo: string | null;
  skeb: string | null;
  fantia: string | null;
  tumblr: string | null;
  youtube: string | null;
  weibo: string | null;
  naver: string | null;
  website: string | null;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface CoverArtAttributes {
  description: string;
  volume: string;
  fileName: string;
  locale: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

// Union Type cho Relationship để hứng được nhiều loại
export type Relationship =
  | (BaseRelationship & {
      type: "author" | "artist";
      attributes?: AuthorAttributes;
    })
  | (BaseRelationship & { type: "cover_art"; attributes?: CoverArtAttributes })
  | (BaseRelationship & { type: "creator"; attributes?: never }) // Creator thường không có attributes kèm theo
  | (BaseRelationship & { type: string; attributes?: any }); // Fallback cho các type khác

// Manga Attributes
export interface MangaLinks {
  mu?: string; // MangaUpdates
  amz?: string; // Amazon
  mal?: string; // MyAnimeList
  raw?: string; // Raw Link
  engtl?: string;
  ap?: string; // AnimePlanet
  bw?: string; // BookWalker
  kt?: string; // Kitsu
  [key: string]: string | undefined; // Cho phép các key khác
}

export interface MangaAttributes {
  title: LocalizedString;
  altTitles: LocalizedString[]; // Đây là mảng các object { lang: title }
  description: LocalizedString;
  isLocked: boolean;
  links: MangaLinks | null;
  officialLinks: MangaLinks | null;
  originalLanguage: string;
  lastVolume: string | null;
  lastChapter: string | null;
  publicationDemographic: "shounen" | "shoujo" | "seinen" | "josei" | null;
  status: "ongoing" | "completed" | "hiatus" | "cancelled";
  year: number | null;
  contentRating: "safe" | "suggestive" | "erotica" | "pornographic";
  tags: MangaTag[];
  state: "published" | "draft" | "rejected" | "submitted";
  chapterNumbersResetOnNewVolume: boolean;
  createdAt: string; // ISO Date String
  updatedAt: string; // ISO Date String
  version: number;
  availableTranslatedLanguages: string[];
  latestUploadedChapter: string | null;
}

export interface MangaData {
  id: string;
  type: "manga";
  attributes: MangaAttributes;
  relationships: Relationship[];
}
