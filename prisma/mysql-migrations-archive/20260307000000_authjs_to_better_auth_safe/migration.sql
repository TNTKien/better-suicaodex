-- Add Better Auth compatibility columns without dropping Auth.js data.
-- NOTE: Take a DB backup before applying this migration in production.

ALTER TABLE `User`
  ADD COLUMN `displayName` VARCHAR(191) NOT NULL DEFAULT '',
  ADD COLUMN `betterEmailVerified` BOOLEAN NOT NULL DEFAULT false;

UPDATE `User`
SET
  `displayName` = CASE
    WHEN `name` IS NOT NULL AND TRIM(`name`) <> '' THEN `name`
    ELSE SUBSTRING_INDEX(`email`, '@', 1)
  END,
  `betterEmailVerified` = (`emailVerified` IS NOT NULL)
WHERE `displayName` = '' OR `betterEmailVerified` = false;

ALTER TABLE `Session`
  ADD COLUMN `ipAddress` VARCHAR(191) NULL,
  ADD COLUMN `userAgent` TEXT NULL;

ALTER TABLE `Account`
  ADD COLUMN `accessTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `refreshTokenExpiresAt` DATETIME(3) NULL,
  ADD COLUMN `password` VARCHAR(191) NULL;

UPDATE `Account`
SET `accessTokenExpiresAt` = FROM_UNIXTIME(`expires_at`)
WHERE `expires_at` IS NOT NULL
  AND `accessTokenExpiresAt` IS NULL;

CREATE TABLE `Verification` (
  `id` VARCHAR(191) NOT NULL,
  `identifier` VARCHAR(191) NOT NULL,
  `value` VARCHAR(191) NOT NULL,
  `expiresAt` DATETIME(3) NOT NULL,
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,

  UNIQUE INDEX `Verification_identifier_value_key`(`identifier`, `value`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Preserve existing tokens by copying them into the Better Auth verification table.
INSERT INTO `Verification` (`id`, `identifier`, `value`, `expiresAt`, `createdAt`, `updatedAt`)
SELECT
  REPLACE(UUID(), '-', ''),
  `identifier`,
  `token`,
  `expires`,
  NOW(3),
  NOW(3)
FROM `VerificationToken`
WHERE NOT EXISTS (
  SELECT 1
  FROM `Verification` v
  WHERE v.`identifier` = `VerificationToken`.`identifier`
    AND v.`value` = `VerificationToken`.`token`
);
