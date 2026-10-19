import { createAccountClient as createSharedClient } from "@workspace/account/client"

import { getApiBaseUrl } from "@/lib/api-url"

export {
  socialSignInOptions,
  type SocialProvider,
} from "@workspace/account/client"

export function createAccountClient() {
  return createSharedClient(getApiBaseUrl())
}
