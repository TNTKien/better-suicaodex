import { betterAuth } from "better-auth/minimal"
import { admin } from "better-auth/plugins/admin"
import { organization } from "better-auth/plugins/organization"

// This config exists only to make the pinned Better Auth schema reproducible.
// Runtime providers, cookies and trusted origins belong to Phase 3.
export const auth = betterAuth({
  baseURL: "http://localhost:3001",
  plugins: [
    admin(),
    organization({
      allowUserToCreateOrganization: false,
      disableOrganizationDeletion: true,
    }),
  ],
})
