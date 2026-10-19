import type { OpenAPIHono } from "@hono/zod-openapi"
import type { Database } from "../../db/client.js"
import type { Auth } from "../account/auth.js"
import { freshSessionUser } from "../account/guard.js"
import { groupFailure } from "../groups/service.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import { CoinError } from "./contract.js"
import type { CoinService } from "./service.js"
import { lockActiveCoinUser } from "./access.js"
import {
  lockCoinGroupManager,
  readCoinHistory,
  readCoinWallet,
  transferGroupCoin,
} from "./wallet.js"
import {
  groupCoinHistoryRoute,
  groupWalletRoute,
  myCoinHistoryRoute,
  myWalletRoute,
  transferCoinRoute,
} from "./api-contract.js"

export function registerCoinRoutes(
  app: OpenAPIHono,
  deps: {
    database: Database
    auth?: Auth
    coin: CoinService
    excludedGroupIds: readonly string[]
    webOrigin: WebOrigins
  }
) {
  for (const path of [
    "/v1/me/coin-wallet/*",
    "/v1/contribution/groups/:groupId/coin-wallet/*",
  ]) {
    app.use(path, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      if (c.req.method === "OPTIONS") return next()
      const identity = await freshSessionUser(deps.auth, c.req.raw.headers)
      if (!identity)
        groupFailure(401, "UNAUTHORIZED", "Authentication is required")
      if (!deps.coin.enabled)
        throw new CoinError("COIN_DISABLED", 503, "SuicaoCoin is disabled")
      if (
        c.req.method !== "GET" &&
        !isTrustedWebOrigin(c.req.header("Origin"), deps.webOrigin)
      )
        groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
      c.set("accountUserId", identity.id)
      await next()
    })
  }
  app.openapi(myWalletRoute, async (c) =>
    c.json(
      await deps.database.transaction(async (tx) => {
        const id = c.get("accountUserId")
        await lockActiveCoinUser(tx, id)
        return readCoinWallet(tx, { kind: "user", id })
      }),
      200
    )
  )
  app.openapi(myCoinHistoryRoute, async (c) =>
    c.json(
      await deps.database.transaction(async (tx) => {
        const id = c.get("accountUserId")
        await lockActiveCoinUser(tx, id)
        return readCoinHistory(tx, { kind: "user", id }, c.req.valid("query"))
      }),
      200
    )
  )
  app.openapi(groupWalletRoute, async (c) =>
    c.json(
      await deps.database.transaction(async (tx) => {
        const { groupId } = c.req.valid("param")
        await lockCoinGroupManager(
          tx,
          c.get("accountUserId"),
          groupId,
          deps.excludedGroupIds
        )
        return readCoinWallet(tx, { kind: "group", id: groupId })
      }),
      200
    )
  )
  app.openapi(groupCoinHistoryRoute, async (c) =>
    c.json(
      await deps.database.transaction(async (tx) => {
        const { groupId } = c.req.valid("param")
        await lockCoinGroupManager(
          tx,
          c.get("accountUserId"),
          groupId,
          deps.excludedGroupIds
        )
        return readCoinHistory(
          tx,
          { kind: "group", id: groupId },
          c.req.valid("query")
        )
      }),
      200
    )
  )
  app.openapi(transferCoinRoute, async (c) =>
    c.json(
      await deps.database.transaction((tx) =>
        transferGroupCoin(
          tx,
          deps.coin,
          c.get("accountUserId"),
          c.req.valid("param").groupId,
          c.req.valid("json"),
          deps.excludedGroupIds
        )
      ),
      200
    )
  )
}
