-- AlterTable MangaComment: add parentId for replies
ALTER TABLE `MangaComment` ADD COLUMN `parentId` VARCHAR(191) NULL;

-- AlterTable ChapterComment: add parentId for replies
ALTER TABLE `ChapterComment` ADD COLUMN `parentId` VARCHAR(191) NULL;

-- CreateIndex for MangaComment parentId
CREATE INDEX `MangaComment_parentId_idx` ON `MangaComment`(`parentId`);

-- CreateIndex for ChapterComment parentId
CREATE INDEX `ChapterComment_parentId_idx` ON `ChapterComment`(`parentId`);

-- AddForeignKey for MangaComment self-relation
ALTER TABLE `MangaComment` ADD CONSTRAINT `MangaComment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `MangaComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey for ChapterComment self-relation
ALTER TABLE `ChapterComment` ADD CONSTRAINT `ChapterComment_parentId_fkey` FOREIGN KEY (`parentId`) REFERENCES `ChapterComment`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
