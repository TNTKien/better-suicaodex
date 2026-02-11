export interface Tag {
  id: string;
  name: string;
  group: string;
}

export interface TagsGroup {
  group: string;
  name: string;
  tags: Tag[];
}

export interface Author {
  id: string;
  name: string;
}

export interface AuthorDetail {
  id: string;
  name: string;
  imageUrl: string | null;
  bio: string | null;
  social: {
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
  };
  mangas: string[];
}

export interface Artist {
  id: string;
  name: string;
}

export interface Group {
  id: string;
  name: string;
  description: string | null;
  website: string | null;
  discord: string | null;
  email: string | null;
  twitter: string | null;
  language: string[];
  leader?: {
    id: string;
    username: string;
  } | null;
  repliesCount?: number;
  totalUploaded?: number;
}

export interface GroupStats {
  repliesCount: number;
  totalUploaded: number;
}

export type ContentRating = "safe" | "suggestive" | "erotica" | "pornographic";
export type Status = "ongoing" | "completed" | "cancelled" | "hiatus";
export type OriginLanguge = "en" | "vi" | "ja" | "ko" | "zh";
export type Demosgraphic = "shounen" | "shoujo" | "jousei" | "seinen";
export type TranslatedLanguage = "en" | "vi";

export interface Manga {
  id: string;
  title: string;
  altTitle: string | null;
  altTitles: string[];
  tags: Tag[];
  cover: string;
  author: Author[];
  artist: Artist[];
  language: string[];
  description: {
    language: "en" | "vi";
    content: string;
  };
  contentRating: ContentRating;
  status: Status;
  raw?: string;
  firstChapter?: {
    en: string;
    vi: string;
  };
  finalChapter?: string;
  latestChapter?: string;
  stats?: MangaStats;
}

export interface MangaStats {
  rating: {
    bayesian: number;
    distribution: {
      "1": number;
      "2": number;
      "3": number;
      "4": number;
      "5": number;
      "6": number;
      "7": number;
      "8": number;
      "9": number;
      "10": number;
    };
    max: number;
  };
  follows: number;
  comments?: number;
}

export interface MangasStats {
  rating: {
    bayesian: number;
  };
  follows: number;
  comments?: number;
}

export interface Chapter {
  id: string;
  vol: string;
  chapter: string;
  title: string;
  updatedAt: string;
  externalUrl?: string;
  group: Group[];
  language: string;
  pages?: string[];
  manga: {
    id: string;
    title?: string;
    cover?: string;
  };
  isUnavailable?: boolean;
}

export interface ChapterVolume {
  chapters: Chapter[];
  total: number;
}
export interface ChapterGroup {
  chapter: string;
  group: Chapter[];
}
export interface Volume {
  vol: string;
  chapters: ChapterGroup[];
}

export interface LastestManga {
  info: Manga;
  lastestChap: Chapter[];
  total?: number;
}

export interface ChapterAggregate {
  vol: string;
  chapters: {
    id: string;
    chapter: string;
    other?: string[];
  }[];
}

export interface Cover {
  id: string;
  volume: string;
  description: string;
  locale: string;
  fileName: string;
}

export type LibraryType =
  | "none"
  | "following"
  | "reading"
  | "plan"
  | "completed";
