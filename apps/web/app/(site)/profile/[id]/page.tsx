import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { getPublicProfile } from "@workspace/account/api"
import type { PublicProfile } from "@/modules/account/api"
import {
  ProfileLayout,
  PublicProfileSkeleton,
  ProfileSummary,
} from "@/modules/account/profile"

export const metadata: Metadata = { title: "Trang cá nhân" }

export default function ProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  return (
    <ProfileLayout title="Trang cá nhân">
      <Suspense fallback={<PublicProfileSkeleton />}>
        <PublicProfileDetails params={params} />
      </Suspense>
    </ProfileLayout>
  )
}

async function PublicProfileDetails({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const profile = await getPublicProfile<PublicProfile>(
    process.env.API_URL ?? "http://localhost:3001",
    id
  )
  if (!profile) notFound()
  await io()
  return <ProfileSummary profile={profile} />
}
