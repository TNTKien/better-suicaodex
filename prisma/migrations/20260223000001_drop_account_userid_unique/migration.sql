-- Drop stale unique constraint on Account.userId that prevents linking
-- multiple OAuth providers to the same user account.
-- The correct uniqueness is already enforced by Account_provider_providerAccountId_key.
ALTER TABLE `Account` DROP INDEX `Account_userId_key`;
