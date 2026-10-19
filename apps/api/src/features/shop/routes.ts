import type { OpenAPIHono } from "@hono/zod-openapi"
import { bodyLimit } from "hono/body-limit"
import { apiError } from "../../shared/contract.js"
import {
  isTrustedWebOrigin,
  type WebOrigins,
} from "../../shared/web-origins.js"
import type { Auth } from "../account/auth.js"
import { freshSessionUser } from "../account/guard.js"
import { groupFailure, requireGroupAdmin } from "../groups/service.js"
import type { CoinService } from "../coin/service.js"
import {
  personalShopCatalogRoute,
  personalShopHistoryRoute,
  personalShopPurchaseRoute,
  purchaseAvatarFrameRoute,
  shopCatalogRoute,
  shopFrameRoute,
  shopTopicsRoute,
} from "./contract.js"
import {
  getShopFrame,
  listShopFrames,
  listShopTopics,
  personalShopFrames,
  personalShopHistory,
  personalShopPurchase,
  purchaseAvatarFrame,
} from "./service.js"
import {
  getShopChest,
  getShopChestPool,
  listAdminChests,
  listShopChests,
  personalShopChest,
  updateShopChest,
  type GachaDependencies,
} from "./gacha-chests.js"
import {
  personalGachaHistory,
  personalGachaRoll,
  rollShopGacha,
} from "./gacha-rolls.js"
import {
  adminShopChestsRoute,
  personalGachaHistoryRoute,
  personalGachaRollRoute,
  personalShopChestRoute,
  rollShopGachaRoute,
  shopChestPoolRoute,
  shopChestRoute,
  shopChestsRoute,
  updateShopChestRoute,
} from "./gacha-contract.js"

export function registerShopRoutes(
  app: OpenAPIHono,
  deps: GachaDependencies & {
    auth?: Auth
    coin: CoinService
    webOrigin: WebOrigins
  }
) {
  app.use("/v1/shop/*", async (c, next) => {
    c.header("Cache-Control", "no-store")
    await next()
  })
  for (const path of ["/v1/me/shop/*", "/v1/admin/shop/*"])
    app.use(path, async (c, next) => {
      c.header("Cache-Control", "private, no-store")
      if (c.req.method !== "OPTIONS") {
        const identity = await freshSessionUser(deps.auth, c.req.raw.headers)
        if (!identity)
          groupFailure(401, "UNAUTHORIZED", "Authentication is required")
        if (c.req.path.startsWith("/v1/admin/"))
          await requireGroupAdmin(deps.database, identity.id)
        if (
          !["GET", "HEAD"].includes(c.req.method) &&
          !isTrustedWebOrigin(c.req.header("Origin"), deps.webOrigin)
        )
          groupFailure(403, "INVALID_ORIGIN", "A trusted origin is required")
        c.set("accountUserId", identity.id)
      }
      await next()
    })
  const smallBody = bodyLimit({
    maxSize: 16_384,
    onError: (c) =>
      c.json(
        apiError(
          "PAYLOAD_TOO_LARGE",
          "Request must not exceed 16 KiB",
          c.get("requestId")
        ),
        413
      ),
  })
  for (const path of [
    "/v1/me/shop/purchases",
    "/v1/me/shop/gacha-rolls",
    "/v1/admin/shop/chests/:chestId",
  ])
    app.use(path, smallBody)
  app.openapi(shopCatalogRoute, async (c) =>
    c.json(await listShopFrames(deps, c.req.valid("query")), 200)
  )
  app.openapi(shopFrameRoute, async (c) =>
    c.json(await getShopFrame(deps, c.req.valid("param").frameId), 200)
  )
  app.openapi(shopTopicsRoute, async (c) =>
    c.json(await listShopTopics(deps), 200)
  )
  app.openapi(personalShopCatalogRoute, async (c) =>
    c.json(
      await personalShopFrames(
        deps,
        c.get("accountUserId"),
        c.req.valid("query")
      ),
      200
    )
  )
  app.openapi(purchaseAvatarFrameRoute, async (c) =>
    c.json(
      {
        data: await purchaseAvatarFrame(
          deps,
          c.get("accountUserId"),
          c.req.valid("json")
        ),
      },
      200
    )
  )
  app.openapi(personalShopPurchaseRoute, async (c) =>
    c.json(
      await personalShopPurchase(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("param").operationId
      ),
      200
    )
  )
  app.openapi(personalShopHistoryRoute, async (c) =>
    c.json(
      await personalShopHistory(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("query")
      ),
      200
    )
  )
  app.openapi(shopChestsRoute, async (c) =>
    c.json(await listShopChests(deps, c.req.valid("query")), 200)
  )
  app.openapi(shopChestRoute, async (c) =>
    c.json(await getShopChest(deps, c.req.valid("param").chestId), 200)
  )
  app.openapi(shopChestPoolRoute, async (c) =>
    c.json(
      await getShopChestPool(
        deps,
        c.req.valid("param").chestId,
        c.req.valid("query")
      ),
      200
    )
  )
  app.openapi(personalShopChestRoute, async (c) =>
    c.json(
      await personalShopChest(
        deps,
        c.get("accountUserId"),
        c.req.valid("param").chestId
      ),
      200
    )
  )
  app.openapi(rollShopGachaRoute, async (c) =>
    c.json(
      {
        data: await rollShopGacha(
          deps,
          c.get("accountUserId"),
          c.req.valid("json")
        ),
      },
      200
    )
  )
  app.openapi(personalGachaRollRoute, async (c) =>
    c.json(
      await personalGachaRoll(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("param").operationId
      ),
      200
    )
  )
  app.openapi(personalGachaHistoryRoute, async (c) =>
    c.json(
      await personalGachaHistory(
        deps.database,
        c.get("accountUserId"),
        c.req.valid("query")
      ),
      200
    )
  )
  app.openapi(adminShopChestsRoute, async (c) =>
    c.json(
      await listAdminChests(deps, c.get("accountUserId"), c.req.valid("query")),
      200
    )
  )
  app.openapi(updateShopChestRoute, async (c) =>
    c.json(
      await updateShopChest(
        deps,
        c.get("accountUserId"),
        c.req.valid("param").chestId,
        c.req.valid("json")
      ),
      200
    )
  )
}
