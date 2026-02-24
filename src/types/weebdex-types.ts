/**
 * TypeScript types generated from weebdexapi-docs.json (Swagger 2.0)
 * API base URL: https://api.weebdex.org
 * API version: 1.2.0
 */

// ─── Enums ──────────────────────────────────────────────────────────────────

export type ContentRating =
  | "safe"
  | "suggestive"
  | "erotica"
  | "pornographic";

export type Demographic =
  | "shounen"
  | "shoujo"
  | "josei"
  | "seinen"
  | "none";

export type PublicationStatus =
  | "ongoing"
  | "completed"
  | "hiatus"
  | "cancelled";

export type ReadingStatus =
  | "reading"
  | "plan_to_read"
  | "completed"
  | "on_hold"
  | "re_reading"
  | "dropped";

export type RelationType =
  | "main_story"
  | "side_story"
  | "prequel"
  | "sequel"
  | "adapted_from"
  | "spin_off"
  | "based_on"
  | "doujinshi"
  | "monochrome"
  | "colored"
  | "preserialization"
  | "serialization"
  | "alternate_story"
  | "alternate_version"
  | "same_franchise"
  | "shared_universe";

export type ReportStatus =
  | "refused"
  | "waiting"
  | "accepted"
  | "autoresolved";

export type TagNamespace =
  | "content"
  | "format"
  | "genre"
  | "theme"
  | "author"
  | "tag";

// ─── Core Models ────────────────────────────────────────────────────────────

export interface Page {
  name: string;
  dimensions?: number[];
}

export interface Chapter {
  id: string;
  chapter?: string;
  volume?: string;
  title?: string;
  language?: string;
  /** CDN node domain — use this as the base URL for image*/
  node?: string;
  data?: Page[];
  data_optimized?: Page[];
  source_id?: string;
  is_unavailable?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
  relationships?: ChapterRelationships;
}

export interface ChapterRelationships {
  manga?: Manga;
  groups?: ScanlationGroup[];
  uploader?: User;
  stats?: ChapterStats;
  thread?: Thread;
}

export interface ChapterStats {
  views?: number;
}

export interface Manga {
  id: string;
  title?: string;
  alt_titles?: Record<string, string[]>;
  description?: string;
  language?: string;
  content_rating?: string;
  demographic?: Demographic;
  status?: string;
  state?: string;
  last_chapter?: string;
  last_volume?: string;
  year?: number;
  locked?: boolean;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
  relationships?: MangaRelationships;
}

export interface MangaRelationships {
  authors?: Tag[];
  artists?: Tag[];
  tags?: Tag[];
  cover?: Cover;
  stats?: MangaStats;
  thread?: Thread;
  submitter?: User;
  relations?: Relation[];
  available_languages?: string[];
  available_groups?: string[];
  links?: Record<string, string>;
}

export interface MangaStats {
  views?: number;
  follows?: number;
  chapters?: number;
}

export interface Tag {
  id: string;
  name?: string;
  group?: TagNamespace;
}

export interface Cover {
  id: string;
  volume?: string;
  description?: string;
  language?: string;
  ext?: string;
  dimensions?: number[];
  created_at?: string;
  updated_at?: string;
  version?: number;
  relationships?: CoverRelationships;
}

export interface CoverRelationships {
  uploader?: User;
}

export interface Author {
  id: string;
  name?: string;
  description?: string;
  website?: string;
  twitter?: string;
  pixiv?: string;
  fanbox?: string;
  fantia?: string;
  skeb?: string;
  youtube?: string;
  locked?: boolean;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export interface ScanlationGroup {
  id: string;
  name?: string;
  description?: string;
  website?: string;
  discord?: string;
  twitter?: string;
  mangaupdates?: string;
  contact_email?: string;
  inactive?: boolean;
  locked?: boolean;
  created_at?: string;
  updated_at?: string;
  version?: number;
  relationships?: ScanlationGroupRelationships;
}

export interface ScanlationGroupRelationships {
  members?: ScanlationGroupMember[];
  stats?: ScanlationGroupStats;
  thread?: Thread;
}

export interface ScanlationGroupMember {
  id: string;
  name?: string;
  description?: string;
  discord?: string;
  twitter?: string;
  website?: string;
  roles?: string[];
  is_leader?: boolean;
  is_officer?: boolean;
  version?: number;
}

export interface ScanlationGroupStats {
  chapters?: number;
}

export interface User {
  id: string;
  name?: string;
  description?: string;
  discord?: string;
  twitter?: string;
  website?: string;
  roles?: string[];
  version?: number;
}

export interface UserStats {
  chapters?: number;
  messages?: number;
  points?: number;
}

export interface Thread {
  id: string;
  subject?: string;
  body?: string;
  locked?: boolean;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  relationships?: ThreadRelationships;
}

export interface ThreadRelationships {
  author?: User;
  user?: User;
  manga?: Manga;
  chapter?: Chapter;
  group?: ScanlationGroup;
  stats?: ThreadStats;
}

export interface ThreadStats {
  replies?: number;
  up?: number;
  down?: number;
}

export interface Reply {
  id?: number;
  reply_number?: number;
  body?: string;
  state?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
  relationships?: ReplyRelationships;
}

export interface ReplyRelationships {
  author?: User;
  stats?: ReplyStats;
  vote_state?: number;
}

export interface ReplyStats {
  up?: number;
  down?: number;
}

export interface Relation {
  id: string;
  title?: string;
  alt_titles?: Record<string, string[]>;
  description?: string;
  language?: string;
  content_rating?: string;
  demographic?: Demographic;
  status?: string;
  state?: string;
  last_chapter?: string;
  last_volume?: string;
  year?: number;
  locked?: boolean;
  type?: RelationType;
  published_at?: string;
  created_at?: string;
  updated_at?: string;
  deleted_at?: string;
  version?: number;
  relationships?: RelationRelationships;
}

export interface RelationRelationships {
  cover?: Cover;
  tags?: Tag[];
}

export interface Report {
  id: string;
  body?: string;
  notes?: string;
  status?: ReportStatus;
  created_at?: string;
  updated_at?: string;
  relationships?: ReportRelationships;
}

export interface ReportRelationships {
  submitter?: User;
  user?: User;
  manga?: Manga;
  chapter?: Chapter;
  group?: ScanlationGroup;
  author?: Tag;
  thread?: Thread;
  reply?: Reply;
  reason?: Reason;
}

export interface Reason {
  id: string;
  reason?: string;
  category?: string;
  details_required?: boolean;
}

export interface File {
  id: string;
  file_name?: string;
  original_file_name?: string;
  file_hash?: string;
  file_ext?: string;
  file_size?: number;
  error?: string;
}

export interface UploadSession {
  id: string;
  is_committed?: boolean;
  is_deleted?: boolean;
  is_processed?: boolean;
  created_at?: string;
  updated_at?: string;
  version?: number;
  relationships?: UploadSessionRelationships;
}

export interface UploadSessionRelationships {
  manga?: Manga;
  chapter?: Chapter;
  uploader?: User;
  groups?: ScanlationGroup[];
  files?: File[];
}

export interface Client {
  id: string;
  name?: string;
  key?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export interface ClientWithoutSecret {
  id: string;
  name?: string;
  created_at?: string;
  updated_at?: string;
  version?: number;
}

export interface MangaFollow extends Manga {
  followed_at?: string;
  reading_status?: ReadingStatus;
}

export interface GroupFollow extends ScanlationGroup {
  followed_at?: string;
}

export interface UserFollow extends User {
  followed_at?: string;
}

export interface UpdateChaptersHistoryBatchResponse {
  read_updated?: number;
  unread_updated?: number;
}

export interface GetUploadSessionResponse {
  id: string;
}

// ─── Feed / Pagination Responses ────────────────────────────────────────────

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  page: number;
}

export type ChapterFeedResponse = PaginatedResponse<Chapter>;
export type MangaFeedResponse = PaginatedResponse<Manga>;
export type TagFeedResponse = PaginatedResponse<Tag>;
export type ScanlationGroupFeedResponse = PaginatedResponse<ScanlationGroup>;
export type UserFeedResponse = PaginatedResponse<User>;
export type ReplyFeedResponse = PaginatedResponse<Reply>;
export type ReportFeedResponse = PaginatedResponse<Report>;
export type MangaFollowFeedResponse = PaginatedResponse<MangaFollow>;
export type GroupFollowFeedResponse = PaginatedResponse<GroupFollow>;
export type UserFollowFeedResponse = PaginatedResponse<UserFollow>;

export interface MappedChapterFeedResponse extends PaginatedResponse<Chapter> {
  map?: {
    manga?: Record<string, Manga>;
  };
}

export interface ChapterAggregateEntry {
  language?: number;
  groups?: number[];
  published_at?: string;
}

export interface ChapterAggregate {
  chapter?: string;
  volume?: string;
  entries?: Record<string, ChapterAggregateEntry>;
}

export interface ChapterAggregateResponse {
  chapters?: ChapterAggregate[];
  groups?: ScanlationGroup[];
  languages?: string[];
}
