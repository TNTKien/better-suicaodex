import type { Metadata } from "next"
import { Suspense } from "react"
import {
  PublicProfileDetails,
  type ProfilePageProps,
} from "@/modules/account/profile-page"
import { ProfileSkeleton } from "@/modules/account/profile-skeleton"

export const metadata: Metadata = { title: "Trang cá nhân" }

export default function ProfilePage(props: ProfilePageProps) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <PublicProfileDetails {...props} />
    </Suspense>
  )
}
