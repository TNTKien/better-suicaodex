import type { Metadata } from "next"

import { AccountDetails } from "@/modules/account/account-details"
import { ProfileLayout } from "@/modules/account/profile"

export const metadata: Metadata = {
  title: "Tài khoản",
}

export default function AccountPage() {
  return (
    <ProfileLayout title="Tài khoản">
      <AccountDetails />
    </ProfileLayout>
  )
}
