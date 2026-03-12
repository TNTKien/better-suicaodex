-- Better Auth stores OAuth state payload in Verification.value.
-- This payload can exceed VARCHAR(191), which causes intermittent OAuth failures.

ALTER TABLE `Verification`
  DROP INDEX `Verification_identifier_value_key`;

ALTER TABLE `Verification`
  MODIFY `value` TEXT NOT NULL;

CREATE INDEX `Verification_identifier_idx` ON `Verification`(`identifier`);
