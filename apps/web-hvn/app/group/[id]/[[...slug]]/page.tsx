import { Suspense } from "react"
import {
  GroupPageContent,
  type GroupPageProps,
} from "@/modules/groups/group-page"
import { GroupSkeleton } from "@/modules/groups/group-skeleton"

export { groupMetadata as generateMetadata } from "@/modules/groups/group-page"

export default function GroupPage(props: GroupPageProps) {
  return (
    <Suspense fallback={<GroupSkeleton />}>
      <GroupPageContent {...props} />
    </Suspense>
  )
}
