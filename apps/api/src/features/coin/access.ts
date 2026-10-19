import { eq } from "drizzle-orm"
import { user, userProfile } from "../../db/schema.js"
import { groupFailure } from "../groups/service.js"
import type { CoinTransaction } from "./service.js"

// Hold both account state and role against moderation/admin changes until commit.
export async function lockActiveCoinUser(tx: CoinTransaction, id: string) {
  const [account] = await tx
    .select({
      id: user.id,
      status: userProfile.status,
      banned: user.banned,
      role: user.role,
    })
    .from(user)
    .innerJoin(userProfile, eq(userProfile.userId, user.id))
    .where(eq(user.id, id))
    .for("share")
  if (!account || account.status !== "active" || account.banned)
    groupFailure(
      403,
      "ACCOUNT_RESTRICTED",
      "This account cannot use SuicaoCoin"
    )
  return account
}
