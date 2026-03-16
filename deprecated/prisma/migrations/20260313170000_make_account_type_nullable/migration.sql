-- Better Auth does not write legacy Account.type. Keep column for compatibility but make it nullable.
ALTER TABLE "Account" ALTER COLUMN "type" DROP NOT NULL;
