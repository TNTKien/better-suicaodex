-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Category" AS ENUM ('FOLLOWING', 'READING', 'PLAN', 'COMPLETED', 'DROPPED', 'RE_READING');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "username" TEXT,
    "email" TEXT NOT NULL,
    "emailVerified" TIMESTAMP(3),
    "image" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerAccountId" TEXT NOT NULL,
    "refresh_token" TEXT,
    "access_token" TEXT,
    "expires_at" INTEGER,
    "token_type" TEXT,
    "scope" TEXT,
    "id_token" TEXT,
    "session_state" TEXT,
    "refresh_token_expires_in" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "sessionToken" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VerificationToken" (
    "identifier" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expires" TIMESTAMP(3) NOT NULL
);

-- CreateTable
CREATE TABLE "Library" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Library_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Manga" (
    "mangadexId" TEXT NOT NULL,
    "latestChapterId" TEXT,
    "title" VARCHAR(512),
    "coverId" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Manga_pkey" PRIMARY KEY ("mangadexId")
);

-- CreateTable
CREATE TABLE "LibraryManga" (
    "id" TEXT NOT NULL,
    "libraryId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "category" "Category" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LibraryManga_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MangaComment" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "userId" TEXT NOT NULL,
    "mangaId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MangaComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chapter" (
    "mangadexId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Chapter_pkey" PRIMARY KEY ("mangadexId")
);

-- CreateTable
CREATE TABLE "ChapterComment" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(255) NOT NULL DEFAULT '',
    "content" TEXT NOT NULL,
    "isEdited" BOOLEAN NOT NULL DEFAULT false,
    "reactions" INTEGER NOT NULL DEFAULT 0,
    "chapterNumber" TEXT NOT NULL DEFAULT 'Oneshot',
    "userId" TEXT NOT NULL,
    "chapterId" TEXT NOT NULL,
    "parentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChapterComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notify" (
    "id" SERIAL NOT NULL,
    "toUserId" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notify_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Account_userId_idx" ON "Account"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "Account_provider_providerAccountId_key" ON "Account"("provider", "providerAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "Session_sessionToken_key" ON "Session"("sessionToken");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VerificationToken_identifier_token_key" ON "VerificationToken"("identifier", "token");

-- CreateIndex
CREATE UNIQUE INDEX "Library_userId_key" ON "Library"("userId");

-- CreateIndex
CREATE INDEX "Library_userId_idx" ON "Library"("userId");

-- CreateIndex
CREATE INDEX "idx_library_category_time" ON "LibraryManga"("libraryId", "category", "updatedAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "uq_library_manga_composite" ON "LibraryManga"("libraryId", "mangaId");

-- CreateIndex
CREATE INDEX "MangaComment_userId_idx" ON "MangaComment"("userId");

-- CreateIndex
CREATE INDEX "MangaComment_parentId_idx" ON "MangaComment"("parentId");

-- CreateIndex
CREATE INDEX "MangaComment_mangaId_createdAt_idx" ON "MangaComment"("mangaId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "ChapterComment_userId_idx" ON "ChapterComment"("userId");

-- CreateIndex
CREATE INDEX "ChapterComment_parentId_idx" ON "ChapterComment"("parentId");

-- CreateIndex
CREATE INDEX "ChapterComment_chapterId_createdAt_idx" ON "ChapterComment"("chapterId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "Notify_toUserId_isRead_idx" ON "Notify"("toUserId", "isRead");

-- CreateIndex
CREATE INDEX "Notify_toUserId_createdAt_idx" ON "Notify"("toUserId", "createdAt" DESC);

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Library" ADD CONSTRAINT "Library_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryManga" ADD CONSTRAINT "fk_library_manga_library_cascade" FOREIGN KEY ("libraryId") REFERENCES "Library"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LibraryManga" ADD CONSTRAINT "fk_library_manga_manga_cascade" FOREIGN KEY ("mangaId") REFERENCES "Manga"("mangadexId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaComment" ADD CONSTRAINT "MangaComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaComment" ADD CONSTRAINT "MangaComment_mangaId_fkey" FOREIGN KEY ("mangaId") REFERENCES "Manga"("mangadexId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MangaComment" ADD CONSTRAINT "MangaComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "MangaComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterComment" ADD CONSTRAINT "ChapterComment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterComment" ADD CONSTRAINT "ChapterComment_chapterId_fkey" FOREIGN KEY ("chapterId") REFERENCES "Chapter"("mangadexId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChapterComment" ADD CONSTRAINT "ChapterComment_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "ChapterComment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notify" ADD CONSTRAINT "Notify_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
