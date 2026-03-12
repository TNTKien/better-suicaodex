import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../prisma/generated/client";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required");
}

const adapter = new PrismaPg(
  new Pool({
    connectionString: process.env.DATABASE_URL,
    max: 5,
  }),
);

const prisma = new PrismaClient({ adapter });

const formatMetric = (label, value) => `${label}: ${value}`;

const fail = (message) => {
  console.error(`\n[FAIL] ${message}`);
  process.exitCode = 1;
};

const warn = (message) => {
  console.warn(`\n[WARN] ${message}`);
};

const ok = (message) => {
  console.log(`\n[OK] ${message}`);
};

try {
  const [
    userCount,
    nullDisplayNameCount,
    legacyVerifiedUsers,
    mappedVerifiedUsers,
    legacyVerificationCount,
    betterVerificationCount,
    legacyAccountExpiryCount,
    mappedAccountExpiryCount,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { displayName: "" } }),
    prisma.user.count({ where: { emailVerified: { not: null } } }),
    prisma.user.count({ where: { betterEmailVerified: true } }),
    prisma.verificationToken.count(),
    prisma.verification.count(),
    prisma.account.count({ where: { expires_at: { not: null } } }),
    prisma.account.count({ where: { accessTokenExpiresAt: { not: null } } }),
  ]);

  console.log("Auth migration integrity report");
  console.log("=============================");
  console.log(formatMetric("Users", userCount));
  console.log(
    formatMetric("Users with empty displayName", nullDisplayNameCount),
  );
  console.log(
    formatMetric(
      "Legacy verified users (emailVerified != null)",
      legacyVerifiedUsers,
    ),
  );
  console.log(
    formatMetric(
      "Mapped verified users (betterEmailVerified = true)",
      mappedVerifiedUsers,
    ),
  );
  console.log(
    formatMetric("Legacy verification tokens", legacyVerificationCount),
  );
  console.log(
    formatMetric("Better Auth verification rows", betterVerificationCount),
  );
  console.log(
    formatMetric(
      "Legacy account rows with expires_at",
      legacyAccountExpiryCount,
    ),
  );
  console.log(
    formatMetric(
      "Mapped account rows with accessTokenExpiresAt",
      mappedAccountExpiryCount,
    ),
  );

  if (nullDisplayNameCount > 0) {
    fail("Some users still have empty displayName.");
  } else {
    ok("All users have displayName values.");
  }

  if (mappedVerifiedUsers < legacyVerifiedUsers) {
    fail(
      "Some legacy verified users were not mapped to betterEmailVerified=true.",
    );
  } else {
    ok("Verified-user mapping looks consistent.");
  }

  if (betterVerificationCount < legacyVerificationCount) {
    fail("Verification rows appear to be missing after migration.");
  } else {
    ok("Verification tokens were preserved.");
  }

  if (mappedAccountExpiryCount < legacyAccountExpiryCount) {
    warn(
      "Some account expiry timestamps were not converted. Check expires_at values.",
    );
  } else {
    ok("Account expiry timestamps were migrated.");
  }
} catch (error) {
  console.error("Migration verification failed:", error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
