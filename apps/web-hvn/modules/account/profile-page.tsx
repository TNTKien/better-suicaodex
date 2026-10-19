import "server-only"

import { io } from "next/cache"
import { notFound } from "next/navigation"
import { getPublicProfile } from "@workspace/account/api"
import type { components } from "@/src/lib/generated/api"
import { RecentComments } from "@/modules/home/recent-comments"
import { ProfileInfo } from "./profile-info"

type PublicProfile = components["schemas"]["PublicProfile"]
export type ProfilePageProps = { params: Promise<{ id: string }> }

export function ProfileView({
  id,
  profile,
}: {
  id: string
  profile: PublicProfile
}) {
  return (
    <div className="grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ProfileInfo id={id} profile={profile} />
      <RecentComments
        variant="profile"
        comments={profile.recentComments.map((comment) => ({
          ...comment,
          author: {
            id,
            name: profile.name,
            image: profile.image,
            avatarFrame: profile.avatarFrame,
          },
        }))}
      />
    </div>
  )
}

export async function PublicProfileDetails({ params }: ProfilePageProps) {
  const { id } = await params
  const profile = await getPublicProfile<PublicProfile>(
    process.env.API_URL ?? "http://localhost:3001",
    id
  )
  if (!profile) notFound()
  await io()
  return <ProfileView id={id} profile={profile} />
}
