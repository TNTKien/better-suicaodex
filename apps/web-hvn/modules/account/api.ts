import {
  currentAccountOptions as sharedCurrentAccountOptions,
  type AccountIdentity,
} from "@workspace/account/api"

import type { components } from "@/src/lib/generated/api"

export {
  AccountApiError,
  loginHref,
  safeReturnTo,
} from "@workspace/account/api"

export type CurrentAccount = components["schemas"]["CurrentAccount"]

export function currentAccountOptions(
  apiBaseUrl: string,
  identity: AccountIdentity | null
) {
  return sharedCurrentAccountOptions<CurrentAccount>(apiBaseUrl, identity)
}
