import { and, eq, isNull, ne, notInArray } from "drizzle-orm"
import type { Database } from "../../db/client.js"
import {
  mangaGroup,
  organization,
  translationGroupProfile,
} from "../../db/schema.js"

// Leader membership and `inactive` are deliberately not reward eligibility.
// Inactive prevents new contributions; approved/published attribution remains.
export function coinGroupEligibility(excludedGroupIds: readonly string[] = []) {
  return and(
    eq(translationGroupProfile.approvalStatus, "approved"),
    eq(translationGroupProfile.publicationState, "published"),
    isNull(translationGroupProfile.deletedAt),
    ne(organization.slug, "system"),
    excludedGroupIds.length
      ? notInArray(organization.id, [...excludedGroupIds])
      : undefined
  )
}

export function eligibleCoinGroups(
  db: Pick<Database, "select">,
  mangaId: string,
  excludedGroupIds: readonly string[] = []
) {
  return db
    .select({ groupId: organization.id })
    .from(mangaGroup)
    .innerJoin(organization, eq(organization.id, mangaGroup.groupId))
    .innerJoin(
      translationGroupProfile,
      eq(translationGroupProfile.organizationId, organization.id)
    )
    .where(
      and(
        eq(mangaGroup.mangaId, mangaId),
        coinGroupEligibility(excludedGroupIds)
      )
    )
    .orderBy(organization.id)
}
