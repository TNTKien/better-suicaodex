import { generateSlug } from "@/lib/utils";

export interface MoeGroupSummary {
  id: number;
  name: string;
}

export function getMoeGroupHref(group: MoeGroupSummary) {
  return `/moetruyen/group/${group.id}/${generateSlug(group.name)}`;
}

export function getMoePrimaryGroup(
  groups?: readonly MoeGroupSummary[] | null,
) {
  return groups?.[0] ?? null;
}
