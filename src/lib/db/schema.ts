import { relations } from "drizzle-orm";
import {
  type AnyPgColumn,
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import { randomUUID } from "node:crypto";

const createTextId = () => randomUUID();

export const categoryValues = [
  "FOLLOWING",
  "READING",
  "PLAN",
  "COMPLETED",
  "DROPPED",
  "RE_READING",
] as const;

export type Category = (typeof categoryValues)[number];

export const categoryEnum = pgEnum("Category", categoryValues);

export const users = pgTable(
  "User",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    name: varchar("name", { length: 191 }),
    displayName: varchar("displayName", { length: 191 }).notNull().default(""),
    username: varchar("username", { length: 191 }),
    email: varchar("email", { length: 191 }).notNull(),
    emailVerified: timestamp("emailVerified", {
      mode: "date",
      precision: 3,
    }),
    betterEmailVerified: boolean("betterEmailVerified")
      .notNull()
      .default(false),
    image: varchar("image", { length: 191 }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("User_username_key").on(table.username),
    uniqueIndex("User_email_key").on(table.email),
  ],
);

export const accounts = pgTable(
  "Account",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    userId: varchar("userId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 191 }),
    provider: varchar("provider", { length: 191 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 191 }).notNull(),
    refresh_token: text("refresh_token"),
    access_token: text("access_token"),
    expires_at: integer("expires_at"),
    accessTokenExpiresAt: timestamp("accessTokenExpiresAt", {
      mode: "date",
      precision: 3,
    }),
    refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt", {
      mode: "date",
      precision: 3,
    }),
    token_type: varchar("token_type", { length: 191 }),
    scope: varchar("scope", { length: 191 }),
    id_token: text("id_token"),
    password: varchar("password", { length: 191 }),
    session_state: varchar("session_state", { length: 191 }),
    refresh_token_expires_in: integer("refresh_token_expires_in"),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("Account_userId_idx").on(table.userId),
    uniqueIndex("Account_provider_providerAccountId_key").on(
      table.provider,
      table.providerAccountId,
    ),
  ],
);

export const sessions = pgTable(
  "Session",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    sessionToken: varchar("sessionToken", { length: 191 }).notNull(),
    userId: varchar("userId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date", precision: 3 }).notNull(),
    ipAddress: varchar("ipAddress", { length: 191 }),
    userAgent: text("userAgent"),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("Session_sessionToken_key").on(table.sessionToken),
    index("Session_userId_idx").on(table.userId),
  ],
);

export const verificationTokens = pgTable(
  "VerificationToken",
  {
    identifier: varchar("identifier", { length: 191 }).notNull(),
    token: varchar("token", { length: 191 }).notNull(),
    expires: timestamp("expires", { mode: "date", precision: 3 }).notNull(),
  },
  (table) => [
    uniqueIndex("VerificationToken_identifier_token_key").on(
      table.identifier,
      table.token,
    ),
  ],
);

export const verifications = pgTable(
  "Verification",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    identifier: varchar("identifier", { length: 191 }).notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expiresAt", { mode: "date", precision: 3 }).notNull(),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [index("Verification_identifier_idx").on(table.identifier)],
);

export const libraries = pgTable(
  "Library",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    userId: varchar("userId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("Library_userId_key").on(table.userId),
    index("Library_userId_idx").on(table.userId),
  ],
);

export const mangas = pgTable("Manga", {
  id: varchar("mangadexId", { length: 191 }).primaryKey(),
  latestChapterId: varchar("latestChapterId", { length: 191 }),
  title: varchar("title", { length: 512 }),
  coverId: varchar("coverId", { length: 255 }),
  createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const libraryMangas = pgTable(
  "LibraryManga",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    libraryId: varchar("libraryId", { length: 191 })
      .notNull()
      .references(() => libraries.id, { onDelete: "cascade" }),
    mangaId: varchar("mangaId", { length: 191 })
      .notNull()
      .references(() => mangas.id, { onDelete: "cascade" }),
    category: categoryEnum("category").notNull(),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uq_library_manga_composite").on(
      table.libraryId,
      table.mangaId,
    ),
    index("idx_library_category_time").on(
      table.libraryId,
      table.category,
      table.updatedAt.desc(),
    ),
    index("fk_library_manga_manga_cascade_idx").on(table.mangaId),
  ],
);

export const mangaComments = pgTable(
  "MangaComment",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    title: varchar("title", { length: 255 }).notNull().default(""),
    content: text("content").notNull(),
    isEdited: boolean("isEdited").notNull().default(false),
    reactions: integer("reactions").notNull().default(0),
    userId: varchar("userId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    mangaId: varchar("mangaId", { length: 191 })
      .notNull()
      .references(() => mangas.id, { onDelete: "cascade" }),
    parentId: varchar("parentId", { length: 191 }).references(
      (): AnyPgColumn => mangaComments.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("MangaComment_userId_idx").on(table.userId),
    index("MangaComment_parentId_idx").on(table.parentId),
    index("MangaComment_mangaId_createdAt_idx").on(
      table.mangaId,
      table.createdAt.desc(),
    ),
  ],
);

export const chapters = pgTable("Chapter", {
  id: varchar("mangadexId", { length: 191 }).primaryKey(),
  createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
});

export const chapterComments = pgTable(
  "ChapterComment",
  {
    id: varchar("id", { length: 191 }).primaryKey().$defaultFn(createTextId),
    title: varchar("title", { length: 255 }).notNull().default(""),
    content: text("content").notNull(),
    isEdited: boolean("isEdited").notNull().default(false),
    reactions: integer("reactions").notNull().default(0),
    chapterNumber: varchar("chapterNumber", { length: 191 })
      .notNull()
      .default("Oneshot"),
    userId: varchar("userId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chapterId: varchar("chapterId", { length: 191 })
      .notNull()
      .references(() => chapters.id, { onDelete: "cascade" }),
    parentId: varchar("parentId", { length: 191 }).references(
      (): AnyPgColumn => chapterComments.id,
      { onDelete: "cascade" },
    ),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updatedAt", { mode: "date", precision: 3 })
      .notNull()
      .$defaultFn(() => new Date())
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("ChapterComment_userId_idx").on(table.userId),
    index("ChapterComment_parentId_idx").on(table.parentId),
    index("ChapterComment_chapterId_createdAt_idx").on(
      table.chapterId,
      table.createdAt.desc(),
    ),
  ],
);

export const notifications = pgTable(
  "Notify",
  {
    id: serial("id").primaryKey(),
    toUserId: varchar("toUserId", { length: 191 })
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: text("content").notNull(),
    isRead: boolean("isRead").notNull().default(false),
    createdAt: timestamp("createdAt", { mode: "date", precision: 3 })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("Notify_toUserId_isRead_idx").on(table.toUserId, table.isRead),
    index("Notify_toUserId_createdAt_idx").on(
      table.toUserId,
      table.createdAt.desc(),
    ),
  ],
);

export const usersRelations = relations(users, ({ many, one }) => ({
  accounts: many(accounts),
  sessions: many(sessions),
  library: one(libraries, {
    fields: [users.id],
    references: [libraries.userId],
  }),
  notifications: many(notifications, {
    relationName: "notificationsToUser",
  }),
  mangaComments: many(mangaComments),
  chapterComments: many(chapterComments),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, {
    fields: [accounts.userId],
    references: [users.id],
  }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const librariesRelations = relations(libraries, ({ many, one }) => ({
  user: one(users, {
    fields: [libraries.userId],
    references: [users.id],
  }),
  mangas: many(libraryMangas),
}));

export const mangasRelations = relations(mangas, ({ many }) => ({
  libraries: many(libraryMangas),
  comments: many(mangaComments),
}));

export const libraryMangasRelations = relations(libraryMangas, ({ one }) => ({
  library: one(libraries, {
    fields: [libraryMangas.libraryId],
    references: [libraries.id],
  }),
  manga: one(mangas, {
    fields: [libraryMangas.mangaId],
    references: [mangas.id],
  }),
}));

export const mangaCommentsRelations = relations(
  mangaComments,
  ({ many, one }) => ({
    user: one(users, {
      fields: [mangaComments.userId],
      references: [users.id],
    }),
    manga: one(mangas, {
      fields: [mangaComments.mangaId],
      references: [mangas.id],
    }),
    parent: one(mangaComments, {
      fields: [mangaComments.parentId],
      references: [mangaComments.id],
      relationName: "mangaCommentReplies",
    }),
    replies: many(mangaComments, {
      relationName: "mangaCommentReplies",
    }),
  }),
);

export const chaptersRelations = relations(chapters, ({ many }) => ({
  comments: many(chapterComments),
}));

export const chapterCommentsRelations = relations(
  chapterComments,
  ({ many, one }) => ({
    user: one(users, {
      fields: [chapterComments.userId],
      references: [users.id],
    }),
    chapter: one(chapters, {
      fields: [chapterComments.chapterId],
      references: [chapters.id],
    }),
    parent: one(chapterComments, {
      fields: [chapterComments.parentId],
      references: [chapterComments.id],
      relationName: "chapterCommentReplies",
    }),
    replies: many(chapterComments, {
      relationName: "chapterCommentReplies",
    }),
  }),
);

export const notificationsRelations = relations(notifications, ({ one }) => ({
  toUser: one(users, {
    fields: [notifications.toUserId],
    references: [users.id],
    relationName: "notificationsToUser",
  }),
}));

export type UserRow = typeof users.$inferSelect;
export type AccountRow = typeof accounts.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type LibraryRow = typeof libraries.$inferSelect;
export type MangaRow = typeof mangas.$inferSelect;
export type LibraryMangaRow = typeof libraryMangas.$inferSelect;
export type MangaCommentRow = typeof mangaComments.$inferSelect;
export type ChapterRow = typeof chapters.$inferSelect;
export type ChapterCommentRow = typeof chapterComments.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

export type NewLibrary = typeof libraries.$inferInsert;
export type NewManga = typeof mangas.$inferInsert;
export type NewLibraryManga = typeof libraryMangas.$inferInsert;
export type NewMangaComment = typeof mangaComments.$inferInsert;
export type NewChapterComment = typeof chapterComments.$inferInsert;

export const appSchema = {
  users,
  accounts,
  sessions,
  verificationTokens,
  verifications,
  libraries,
  mangas,
  libraryMangas,
  mangaComments,
  chapters,
  chapterComments,
  notifications,
};

export const betterAuthSchema = {
  user: users,
  session: sessions,
  account: accounts,
  verification: verifications,
};

export type AppSchema = typeof appSchema;
