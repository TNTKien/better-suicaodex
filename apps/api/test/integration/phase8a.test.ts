import {
  afterAll,
  beforeAll,
  describe,
  expect,
  setDefaultTimeout,
  test,
} from "bun:test"
import { randomUUID } from "node:crypto"
import { fileURLToPath } from "node:url"
import { and, eq, inArray, sql } from "drizzle-orm"
import { migrate } from "drizzle-orm/node-postgres/migrator"

import { createApp } from "../../src/app"
import {
  account as authAccount,
  member as members,
  moderationAction,
  organization as groups,
  translationGroupProfile as groupProfiles,
  user,
  userProfile,
} from "../../src/db/schema"
import { createAdministrator } from "../../src/features/account/administrator"
import {
  GroupInputSchema,
  MyGroupSchema,
} from "../../src/features/groups/contract"
import {
  auditGroup,
  groupWrite,
  lockGroup,
  memberDefaults,
  noPermissions,
  setAdministrator,
} from "../../src/features/groups/service"
import { createRuntime, type Runtime } from "../../src/runtime"
import { parseRuntimeEnv } from "../../src/shared/env"

setDefaultTimeout(120_000)
const noop = () => undefined
const root = "/v1/contribution/groups"
const origin = "http://localhost:3000"
const accounts: { id: string; cookie: string }[] = []
const groupIds: string[] = []
let runtime: Runtime
let app: ReturnType<typeof createApp>
let admin: (typeof accounts)[number]
const migrationsFolder = fileURLToPath(
  new URL("../../drizzle", import.meta.url)
)
async function constraint(operation: PromiseLike<unknown>, name: string) {
  let actual: unknown
  try {
    await operation
  } catch (error) {
    actual = (error as { cause?: { constraint?: string } }).cause?.constraint
  }
  expect(actual).toBe(name)
}

async function account() {
  const response = await app.request("/api/auth/sign-up/email", {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json" },
    body: JSON.stringify({
      email: `phase8a-${randomUUID()}@example.com`,
      name: "8A fixture",
      password: "phase8a-fixture-password",
    }),
  })
  expect(response.status).toBe(200)
  const result = {
    id: ((await response.json()) as { user: { id: string } }).user.id,
    cookie: response.headers.get("set-cookie")!.split(";", 1)[0]!,
  }
  accounts.push(result)
  return result
}
function request(
  actor: (typeof accounts)[number],
  path: string,
  method = "GET",
  body?: unknown,
  requestOrigin = origin
) {
  return app.request(path, {
    method,
    headers: {
      Cookie: actor.cookie,
      Origin: requestOrigin,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  })
}
type GroupNotification = {
  id: string
  type:
    | "group_join_requested"
    | "group_join_approved"
    | "group_join_rejected"
    | "group_member_removed"
    | "group_member_left"
    | "group_approved"
    | "group_rejected"
    | "group_leader_assigned"
  readAt: string | null
  group: { id: string; name: string }
  actor: { id: string; name: string } | null
}
async function notificationList(actor: (typeof accounts)[number]) {
  const response = await request(actor, "/v1/me/notifications")
  expect(response.status).toBe(200)
  return (await response.json()) as {
    data: GroupNotification[]
    meta: { unreadCount: number }
  }
}
async function group(leader: (typeof accounts)[number], approved = true) {
  const input = {
    name: `Group ${randomUUID().slice(0, 8)}`,
    description: "Fixture",
  }
  const response = await request(
    approved ? admin : leader,
    approved ? "/v1/admin/groups" : root,
    "POST",
    approved ? { ...input, leaderUserId: leader.id } : input
  )
  expect(response.status).toBe(200)
  const body = (await response.json()) as { data: { id: string } }
  groupIds.push(body.data.id)
  return body.data.id
}
async function approvedMember(groupId: string) {
  const member = await account()
  expect(
    (await request(member, `${root}/${groupId}/requests`, "POST")).status
  ).toBe(204)
  expect(
    (
      await request(admin, `${root}/${groupId}/requests/${member.id}`, "PUT", {
        action: "approve",
      })
    ).status
  ).toBe(204)
  return member
}

describe.serial("Phase 8A group workflow", () => {
  beforeAll(async () => {
    const url = process.env.TEST_DATABASE_URL
    if (!url || url === process.env.DATABASE_URL)
      throw new Error("A dedicated TEST_DATABASE_URL is required")
    runtime = await createRuntime(
      parseRuntimeEnv({
        ...process.env,
        NODE_ENV: "test",
        WEB_ORIGIN: origin,
        DATABASE_URL: url,
        REDIS_CACHE_ENABLED: "false",
      }),
      noop
    )
    await migrate(runtime.database, { migrationsFolder })
    // Earlier catalog suites clean their System fixture; each suite owns its prerequisites.
    const createdSystem = await runtime.database
      .insert(groups)
      .values({
        id: randomUUID(),
        slug: "system",
        name: "System",
        createdAt: new Date(),
      })
      .onConflictDoNothing({ target: groups.slug })
      .returning({ id: groups.id })
    groupIds.push(...createdSystem.map(({ id }) => id))
    if (createdSystem[0])
      await runtime.database.insert(groupProfiles).values({
        organizationId: createdSystem[0].id,
        publicationState: "published",
      })
    app = createApp({
      account: { database: runtime.database },
      auth: runtime.auth,
      webOrigin: origin,
      logger: noop,
      catalog: {
        database: runtime.database,
        cache: runtime.cache,
        assetBaseUrl: "http://localhost:9000/",
      },
    })
    admin = await account()
    await runtime.database
      .update(user)
      .set({ role: "admin" })
      .where(eq(user.id, admin.id))
  })
  afterAll(async () => {
    if (!runtime) return
    if (groupIds.length)
      await runtime.database.delete(groups).where(inArray(groups.id, groupIds))
    if (accounts.length) {
      await runtime.database.delete(moderationAction).where(
        inArray(
          moderationAction.actorUserId,
          accounts.map(({ id }) => id)
        )
      )
      await runtime.database.delete(user).where(
        inArray(
          user.id,
          accounts.map(({ id }) => id)
        )
      )
    }
    await runtime.close()
  })

  test("uses Better Auth admin and organization as the identity core", async () => {
    const result = await runtime.database.execute(sql`
      select table_name
      from information_schema.tables
      where table_schema = 'public'
        and table_name in (
          'organization',
          'member',
          'invitation',
          'translation_group_profile',
          'translation_group_member_profile',
          'translation_group_application',
          'translation_group',
          'translation_group_member',
          'application_admin'
        )
    `)
    expect(new Set(result.rows.map(({ table_name }) => table_name))).toEqual(
      new Set([
        "organization",
        "member",
        "invitation",
        "translation_group_profile",
        "translation_group_member_profile",
        "translation_group_application",
      ])
    )

    const userColumns = await runtime.database.execute(sql`
      select column_name
      from information_schema.columns
      where table_schema = 'public'
        and table_name = 'user'
        and column_name in ('role', 'banned', 'ban_reason', 'ban_expires')
    `)
    expect(
      new Set(userColumns.rows.map(({ column_name }) => column_name))
    ).toEqual(new Set(["role", "banned", "ban_reason", "ban_expires"]))
    expect(
      (
        await request(admin, "/api/auth/organization/create", "POST", {
          name: "Bypass",
          slug: "bypass",
        })
      ).status
    ).toBe(404)
    expect(
      (
        await request(admin, "/api/auth/admin/set-role", "POST", {
          userId: admin.id,
          role: "user",
        })
      ).status
    ).toBe(404)
    expect(await (await request(admin, "/v1/me")).json()).toMatchObject({
      user: { role: "admin" },
    })
  })

  test("notifies the group leader when an administrator reviews a creation request", async () => {
    const approvedLeader = await account()
    const approvedGroupId = await group(approvedLeader, false)
    expect(
      (
        await request(
          admin,
          `/v1/admin/groups/${approvedGroupId}/review`,
          "PUT",
          {
            action: "approve",
          }
        )
      ).status
    ).toBe(204)
    const approvedNotifications = await notificationList(approvedLeader)
    expect(approvedNotifications).toMatchObject({
      data: [
        {
          type: "group_approved",
          readAt: null,
          group: { id: approvedGroupId },
          actor: null,
        },
      ],
      meta: { unreadCount: 1 },
    })
    expect(
      await (
        await request(
          approvedLeader,
          `/v1/me/notifications/${approvedNotifications.data[0]!.id}/read`,
          "POST"
        )
      ).json()
    ).toMatchObject({ meta: { unreadCount: 0 } })

    const rejectedLeader = await account()
    const rejectedGroupId = await group(rejectedLeader, false)
    expect(
      (
        await request(
          admin,
          `/v1/admin/groups/${rejectedGroupId}/review`,
          "PUT",
          {
            action: "reject",
          }
        )
      ).status
    ).toBe(204)
    expect(await notificationList(rejectedLeader)).toMatchObject({
      data: [
        {
          type: "group_rejected",
          readAt: null,
          group: { id: rejectedGroupId },
          actor: null,
        },
      ],
      meta: { unreadCount: 1 },
    })
    expect(
      await (
        await request(rejectedLeader, "/v1/me/notifications/read-all", "POST")
      ).json()
    ).toMatchObject({ data: { updated: 1 }, meta: { unreadCount: 0 } })
  })

  test("notifies both sides of join requests and resolves the leader notification", async () => {
    const leader = await account()
    const groupId = await group(leader)

    const approved = await account()
    expect(
      (await request(approved, `${root}/${groupId}/requests`, "POST")).status
    ).toBe(204)
    expect(await notificationList(leader)).toMatchObject({
      data: [
        {
          type: "group_join_requested",
          readAt: null,
          group: { id: groupId },
          actor: { id: approved.id },
        },
      ],
      meta: { unreadCount: 1 },
    })
    expect(
      (
        await request(
          leader,
          `${root}/${groupId}/requests/${approved.id}`,
          "PUT",
          { action: "approve" }
        )
      ).status
    ).toBe(204)
    expect(await notificationList(approved)).toMatchObject({
      data: [
        {
          type: "group_join_approved",
          readAt: null,
          group: { id: groupId },
          actor: null,
        },
      ],
      meta: { unreadCount: 1 },
    })
    expect(await notificationList(leader)).toMatchObject({
      data: [{ type: "group_join_requested", readAt: expect.any(String) }],
      meta: { unreadCount: 0 },
    })

    const rejected = await account()
    expect(
      (await request(rejected, `${root}/${groupId}/requests`, "POST")).status
    ).toBe(204)
    expect(
      (
        await request(
          leader,
          `${root}/${groupId}/requests/${rejected.id}`,
          "PUT",
          { action: "reject" }
        )
      ).status
    ).toBe(204)
    expect(await notificationList(rejected)).toMatchObject({
      data: [{ type: "group_join_rejected", group: { id: groupId } }],
      meta: { unreadCount: 1 },
    })

    const cancelled = await account()
    expect(
      (await request(cancelled, `${root}/${groupId}/requests`, "POST")).status
    ).toBe(204)
    expect((await notificationList(leader)).meta.unreadCount).toBe(1)
    expect(
      (await request(cancelled, `${root}/${groupId}/requests/me`, "DELETE"))
        .status
    ).toBe(204)
    expect((await notificationList(leader)).meta.unreadCount).toBe(0)
  })

  test("notifies the leader when a member leaves and the member when removed", async () => {
    const leader = await account()
    const groupId = await group(leader)

    const leaving = await approvedMember(groupId)
    expect(
      (await request(leaving, `${root}/${groupId}/membership`, "DELETE")).status
    ).toBe(204)
    expect((await notificationList(leader)).data[0]).toMatchObject({
      type: "group_member_left",
      readAt: null,
      group: { id: groupId },
      actor: { id: leaving.id },
    })

    const removed = await approvedMember(groupId)
    expect(
      (
        await request(
          leader,
          `${root}/${groupId}/members/${removed.id}`,
          "DELETE"
        )
      ).status
    ).toBe(204)
    expect((await notificationList(removed)).data[0]).toMatchObject({
      type: "group_member_removed",
      readAt: null,
      group: { id: groupId },
      actor: null,
    })
  })

  test("user creates pending group; admin approves; join approval grants default chapter permissions", async () => {
    const leader = await account()
    const groupId = await group(leader, false)
    expect((await app.request(`/v1/groups/${groupId}`)).status).toBe(404)
    expect(
      (await request(admin, `${root}/${groupId}/members?status=approved`))
        .status
    ).toBe(200)
    const state = await request(leader, "/v1/me/groups")
    expect(state.headers.get("cache-control")).toBe("private, no-store")
    const body = MyGroupSchema.parse(await state.json())
    expect(body.data!.group.approvalStatus).toBe("pending")
    expect(body.data!.membership.role).toBe("leader")
    expect(body.data!.membership.permissions).toEqual(noPermissions)
    expect(await (await request(leader, "/v1/me")).json()).toMatchObject({
      user: { role: "user" },
    })
    expect(
      (await request(leader, root, "POST", { name: "Another" })).status
    ).toBe(409)
    expect(
      (
        await request(leader, `/v1/admin/groups/${groupId}/review`, "PUT", {
          action: "approve",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await request(admin, `/v1/admin/groups/${groupId}/review`, "PUT", {
          action: "approve",
        })
      ).status
    ).toBe(204)
    expect((await app.request(`/v1/groups/${groupId}`)).status).toBe(200)
    expect(await (await request(leader, "/v1/me")).json()).toMatchObject({
      user: { role: "leader" },
    })
    const member = await account()
    expect(
      (await request(member, `${root}/${groupId}/requests`, "POST")).status
    ).toBe(204)
    expect(
      (await request(member, `${root}/${groupId}/requests`, "POST")).status
    ).toBe(409)
    expect(
      (await request(member, `${root}/${groupId}/members?status=pending`))
        .status
    ).toBe(403)
    expect(
      (
        await request(
          leader,
          `${root}/${groupId}/requests/${member.id}`,
          "PUT",
          { action: "approve" }
        )
      ).status
    ).toBe(204)
    const memberState = MyGroupSchema.parse(
      await (await request(member, "/v1/me/groups")).json()
    )
    expect(memberState.data!.membership.permissions).toEqual(memberDefaults)
    expect(JSON.stringify(memberState)).not.toContain("@example.com")
    expect(await (await request(member, "/v1/me")).json()).toMatchObject({
      user: { role: "member" },
    })
    const memberList = await request(
      member,
      `${root}/${groupId}/members?status=approved`
    )
    expect(memberList.status).toBe(200)
    expect(
      (
        (await memberList.json()) as {
          data: Array<{ userId: string }>
        }
      ).data.map(({ userId }) => userId)
    ).toEqual(expect.arrayContaining([leader.id, member.id]))
    expect(
      (await request(member, `${root}/${groupId}/members?status=pending`))
        .status
    ).toBe(403)
    expect(
      (await request(leader, `${root}/${groupId}/membership`, "DELETE")).status
    ).toBe(403)
  })

  test("admin searches every status with creator details and soft-deletes groups", async () => {
    const leader = await account()
    const name = `Searchable ${randomUUID().slice(0, 8)}`
    const created = await request(leader, root, "POST", {
      name,
      description: "Admin listing fixture",
    })
    expect(created.status).toBe(200)
    const groupId = ((await created.json()) as { data: { id: string } }).data.id
    groupIds.push(groupId)

    const query = new URLSearchParams({ q: name.toLowerCase(), limit: "10" })
    const listed = await request(admin, `/v1/admin/groups?${query}`)
    expect(listed.status).toBe(200)
    const list = (await listed.json()) as {
      data: Array<{
        id: string
        approvalStatus: string
        creator: { id: string; name: string } | null
      }>
    }
    expect(list.data).toEqual([
      expect.objectContaining({
        id: groupId,
        approvalStatus: "pending",
        creator: { id: leader.id, name: "8A fixture" },
      }),
    ])

    const updatedName = `${name} updated`
    const updated = await request(admin, `${root}/${groupId}`, "PUT", {
      name: updatedName,
      description: "Updated by admin",
      links: { discord: "suicaodex" },
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      id: groupId,
      name: updatedName,
      description: "Updated by admin",
    })

    expect(
      (await request(admin, `/v1/admin/groups/${groupId}`, "DELETE")).status
    ).toBe(204)
    const [deleted] = await runtime.database
      .select({
        deletedAt: groupProfiles.deletedAt,
        deletedByUserId: groupProfiles.deletedByUserId,
        deleteReason: groupProfiles.deleteReason,
      })
      .from(groupProfiles)
      .where(eq(groupProfiles.organizationId, groupId))
    expect(deleted).toMatchObject({
      deletedByUserId: admin.id,
      deleteReason: null,
    })
    expect(deleted?.deletedAt).toBeInstanceOf(Date)
    expect(
      (
        (await (await request(admin, `/v1/admin/groups?${query}`)).json()) as {
          data: unknown[]
        }
      ).data
    ).toHaveLength(0)
    const replacement = await request(leader, root, "POST", {
      name: `Replacement ${randomUUID().slice(0, 8)}`,
    })
    expect(replacement.status).toBe(200)
    groupIds.push(
      ((await replacement.json()) as { data: { id: string } }).data.id
    )
  })

  test("permissions, leadership transfer and revocation are transactional and scope checked", async () => {
    const leader = await account()
    const groupId = await group(leader)
    const member = await approvedMember(groupId)
    const other = await approvedMember(groupId)
    const path = `${root}/${groupId}`
    expect(
      (
        await request(
          member,
          `${path}/members/${other.id}/permissions`,
          "PUT",
          memberDefaults
        )
      ).status
    ).toBe(403)
    expect(
      (
        await request(
          leader,
          `${path}/members/${member.id}/permissions`,
          "PUT",
          noPermissions
        )
      ).status
    ).toBe(204)
    expect(
      MyGroupSchema.parse(await (await request(member, "/v1/me/groups")).json())
        .data!.membership.permissions
    ).toEqual(noPermissions)
    const transfers = await Promise.all(
      [member, other].map((target) =>
        request(leader, `${path}/leader`, "POST", { userId: target.id })
      )
    )
    expect(transfers.map((response) => response.status).sort()).toEqual([
      204, 403,
    ])
    const leaders = await runtime.database
      .select()
      .from(members)
      .where(
        and(eq(members.organizationId, groupId), eq(members.role, "owner"))
      )
    expect(leaders).toHaveLength(1)
    expect(
      (await request(leader, `${path}/members/${other.id}`, "DELETE")).status
    ).toBe(403)
    expect((await request(leader, `${path}/membership`, "DELETE")).status).toBe(
      204
    )
    expect((await request(leader, path)).status).toBe(404)
    const currentLeader = [member, other].find(
      (actor) => actor.id === leaders[0]!.userId
    )!
    expect((await notificationList(currentLeader)).data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          type: "group_leader_assigned",
          readAt: null,
          group: { id: groupId, name: expect.any(String) },
          actor: { id: leader.id, name: expect.any(String) },
        }),
      ])
    )
    const remaining = currentLeader.id === member.id ? other : member
    expect(
      (
        await request(
          currentLeader,
          `${path}/members/${remaining.id}`,
          "DELETE"
        )
      ).status
    ).toBe(204)
    expect(
      (
        await request(
          remaining,
          `${path}/members/${currentLeader.id}/permissions`,
          "PUT",
          memberDefaults
        )
      ).status
    ).toBe(403)
  })

  test("administrator assigns an ungrouped user as leader atomically", async () => {
    const previousLeader = await account()
    const replacement = await account()
    const groupId = await group(previousLeader)

    expect(
      (
        await request(admin, `${root}/${groupId}/leader`, "POST", {
          userId: replacement.id,
        })
      ).status
    ).toBe(204)

    const rows = await runtime.database
      .select({ role: members.role, userId: members.userId })
      .from(members)
      .where(eq(members.organizationId, groupId))
    expect(rows).toEqual(
      expect.arrayContaining([
        { role: "member", userId: previousLeader.id },
        { role: "owner", userId: replacement.id },
      ])
    )
    expect(rows).toHaveLength(2)
    expect(await notificationList(replacement)).toMatchObject({
      data: [
        {
          type: "group_leader_assigned",
          readAt: null,
          group: { id: groupId },
          actor: { id: admin.id },
        },
      ],
      meta: { unreadCount: 1 },
    })
  })

  test("one live membership across groups survives concurrent requests and database writes", async () => {
    const firstLeader = await account()
    const first = await group(firstLeader)
    const second = await group(await account())
    const applicant = await account()
    const results = await Promise.all(
      [first, second].map((id) =>
        request(applicant, `${root}/${id}/requests`, "POST")
      )
    )
    expect(results.map((response) => response.status).sort()).toEqual([
      204, 409,
    ])
    const own = MyGroupSchema.parse(
      await (await request(applicant, "/v1/me/groups")).json()
    ).data!
    await constraint(
      runtime.database.insert(members).values({
        id: randomUUID(),
        organizationId: second,
        userId: firstLeader.id,
        role: "member",
        createdAt: new Date(),
      }),
      "member_user_uidx"
    )
    expect(
      (
        await request(
          applicant,
          `${root}/${own.group.id}/requests/me`,
          "DELETE"
        )
      ).status
    ).toBe(204)
    expect(
      (await request(applicant, `${root}/${second}/requests`, "POST")).status
    ).toBe(204)
  })

  test("cancel creation and rejection free membership; pending review cannot resurrect a cancelled request", async () => {
    const owner = await account()
    const cancelled = await group(owner, false)
    expect(
      (await request(owner, `${root}/${cancelled}/requests/me`, "DELETE"))
        .status
    ).toBe(204)
    expect(
      (
        await request(admin, `/v1/admin/groups/${cancelled}/review`, "PUT", {
          action: "approve",
        })
      ).status
    ).toBe(404)
    const rejected = await group(owner, false)
    expect(
      (
        await request(admin, `/v1/admin/groups/${rejected}/review`, "PUT", {
          action: "reject",
        })
      ).status
    ).toBe(204)
    expect(
      MyGroupSchema.parse(await (await request(owner, "/v1/me/groups")).json())
        .data!.group
    ).not.toHaveProperty("rejectionReason")
    const target = await group(await account())
    expect(
      (await request(owner, `${root}/${target}/requests`, "POST")).status
    ).toBe(204)
    expect(
      (
        await request(admin, `${root}/${target}/requests/${owner.id}`, "PUT", {
          action: "reject",
        })
      ).status
    ).toBe(204)
    expect(
      (await request(owner, `${root}/${target}/requests`, "POST")).status
    ).toBe(204)
    expect(
      (
        await request(admin, `${root}/${target}/requests/${owner.id}`, "PUT", {
          action: "approve",
        })
      ).status
    ).toBe(204)
  })

  test("System identity survives migrations and cannot be claimed, renamed or joined", async () => {
    const [system] = await runtime.database
      .select()
      .from(groups)
      .where(eq(groups.slug, "system"))
    expect(system).toBeDefined()
    await migrate(runtime.database, { migrationsFolder })
    const rows = await runtime.database
      .select()
      .from(groups)
      .where(eq(groups.slug, "system"))
    expect(rows.map(({ id }) => id)).toEqual([system!.id])
    const applicant = await account()
    expect(
      (await request(applicant, `${root}/${system!.id}/requests`, "POST"))
        .status
    ).toBe(403)
    expect(
      (await request(applicant, root, "POST", { name: "System" })).status
    ).toBe(403)
    const updated = await request(admin, `${root}/${system!.id}`, "PUT", {
      name: system!.name,
      description: "Nội dung nhập từ hệ thống cũ",
      links: { discord: "suicaodex" },
    })
    expect(updated.status).toBe(200)
    expect((await updated.json()).data).toMatchObject({
      id: system!.id,
      name: system!.name,
      slug: "system",
      description: "Nội dung nhập từ hệ thống cũ",
      links: { discord: "https://discord.gg/suicaodex" },
    })
    expect(
      (
        await request(admin, `${root}/${system!.id}`, "PUT", {
          name: "Renamed",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await request(admin, `${root}/${system!.id}/members`, "POST", {
          userId: applicant.id,
        })
      ).status
    ).toBe(403)
  })

  test("inactive groups keep public attribution and management but block join and effective capabilities", async () => {
    const leader = await account()
    const groupId = await group(leader)
    expect(
      (
        await request(admin, `/v1/admin/groups/${groupId}/activity`, "PUT", {
          inactive: true,
        })
      ).status
    ).toBe(204)
    expect(
      (await request(await account(), `${root}/${groupId}/requests`, "POST"))
        .status
    ).toBe(409)
    const publicGroup = (await (
      await app.request(`/v1/groups/${groupId}`)
    ).json()) as { inactive: boolean }
    expect(publicGroup.inactive).toBe(true)
    expect(
      MyGroupSchema.parse(await (await request(leader, "/v1/me/groups")).json())
        .data!.membership.permissions
    ).toEqual(noPermissions)
    expect((await request(leader, `${root}/${groupId}/members`)).status).toBe(
      200
    )
    expect(
      (
        await request(leader, `${root}/${groupId}`, "PUT", {
          name: "Changed name",
          links: { facebook: "https://facebook.com/team", discord: "sample" },
        })
      ).status
    ).toBe(200)
    const detail = (await (
      await app.request(`/v1/groups/${groupId}`)
    ).json()) as { links: { key: string }[] }
    expect(detail.links.map(({ key }) => key).sort()).toEqual([
      "discord",
      "facebook",
    ])
  })

  test("guest, origin, restricted account, input and cross-group boundaries fail closed", async () => {
    const leader = await account()
    const groupId = await group(leader)
    const outsider = await account()
    expect((await app.request(root, { method: "POST" })).status).toBe(401)
    expect(
      (
        await app.request(root, {
          method: "POST",
          headers: {
            Cookie: outsider.cookie,
            Origin: origin,
            "Content-Type": "application/json",
          },
          body: "{",
        })
      ).status
    ).toBe(400)
    expect(
      (
        await request(
          leader,
          `${root}/${groupId}`,
          "PUT",
          { name: "Bad origin" },
          "https://evil.example"
        )
      ).status
    ).toBe(403)
    expect((await request(outsider, `${root}/${groupId}`)).status).toBe(404)
    expect(
      (
        await request(outsider, `${root}/${groupId}`, "PUT", {
          name: "Takeover",
        })
      ).status
    ).toBe(403)
    expect(
      (
        await request(outsider, root, "POST", {
          name: "Unsafe",
          publicationState: "published",
        })
      ).status
    ).toBe(400)
    expect(
      GroupInputSchema.safeParse({
        name: "Unsafe",
        links: { website: "javascript:alert(1)" },
      }).success
    ).toBe(false)
    expect(
      GroupInputSchema.safeParse({
        name: "Unsafe",
        links: { facebook: "https://facebook.com.evil.example/team" },
      }).success
    ).toBe(false)
    expect(GroupInputSchema.safeParse({ name: "x".repeat(81) }).success).toBe(
      false
    )
    await runtime.database
      .update(userProfile)
      .set({
        status: "suspended",
        moderatedAt: new Date(),
        moderationReason: "Fixture restriction",
      })
      .where(eq(userProfile.userId, leader.id))
    expect(
      (
        await request(leader, `${root}/${groupId}`, "PUT", {
          name: "Suspended write",
        })
      ).status
    ).toBe(403)
    expect(
      (await request(leader, `${root}/${groupId}/membership`, "DELETE")).status
    ).toBe(403)
    expect(
      MyGroupSchema.parse(await (await request(leader, "/v1/me/groups")).json())
        .data!.membership.permissions
    ).toEqual(noPermissions)
  })

  test("audit failure rolls back the group mutation and duplicate leader is rejected by DB", async () => {
    const leader = await account()
    const groupId = await group(leader)
    const extra = await account()
    await constraint(
      runtime.database.insert(members).values({
        id: randomUUID(),
        organizationId: groupId,
        userId: extra.id,
        role: "owner",
        createdAt: new Date(),
      }),
      "member_owner_organization_uidx"
    )
    const [before] = await runtime.database
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
    await constraint(
      groupWrite(runtime.database, leader.id, async (tx) => {
        await lockGroup(tx, groupId)
        await tx
          .update(groups)
          .set({ name: "Must rollback" })
          .where(eq(groups.id, groupId))
        await auditGroup(tx, leader.id, groupId, "updated", " ", null, null)
      }),
      "moderation_action_reason_check"
    )
    const [after] = await runtime.database
      .select()
      .from(groups)
      .where(eq(groups.id, groupId))
    expect(after!.name).toBe(before!.name)
    const audits = await runtime.database
      .select()
      .from(moderationAction)
      .where(eq(moderationAction.targetId, groupId))
    expect(audits.map(({ action }) => action)).toContain("group.created")
  })

  test("admin access requires an active administrator and has audited grant/revoke", async () => {
    const candidate = await account()
    const unauthorized = await setAdministrator(
      runtime.database,
      candidate.id,
      "grant",
      candidate.id
    ).then(
      () => null,
      (error: unknown) => error
    )
    expect(unauthorized).toHaveProperty("status", 403)
    await setAdministrator(runtime.database, candidate.id, "grant", admin.id)
    expect((await request(candidate, "/v1/admin/groups")).status).toBe(200)
    await setAdministrator(runtime.database, candidate.id, "revoke", admin.id)
    expect((await request(candidate, "/v1/admin/groups")).status).toBe(403)
  })

  test("operator creates a verified credential administrator with an audit trail", async () => {
    const email = `phase8a-admin-${randomUUID()}@example.com`
    const created = await createAdministrator(runtime.database, runtime.auth, {
      email,
      name: "Credential administrator",
      password: "phase8a-admin-password",
      actorUserId: admin.id,
    })
    accounts.push({ id: created.id, cookie: "" })

    const [credential] = await runtime.database
      .select({ providerId: authAccount.providerId })
      .from(authAccount)
      .where(eq(authAccount.userId, created.id))
    const [createdUser] = await runtime.database
      .select({ emailVerified: user.emailVerified, role: user.role })
      .from(user)
      .where(eq(user.id, created.id))
    const [profile] = await runtime.database
      .select({ userId: userProfile.userId })
      .from(userProfile)
      .where(eq(userProfile.userId, created.id))
    const [audit] = await runtime.database
      .select({ action: moderationAction.action })
      .from(moderationAction)
      .where(eq(moderationAction.targetId, created.id))

    expect(credential?.providerId).toBe("credential")
    expect(createdUser).toEqual({ emailVerified: true, role: "user,admin" })
    expect(profile?.userId).toBe(created.id)
    expect(audit?.action).toBe("admin.grant")

    const response = await app.request("/api/auth/sign-in/email", {
      method: "POST",
      headers: { Origin: origin, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "phase8a-admin-password" }),
    })
    expect(response.status).toBe(200)
  })

  test("OpenAPI exposes typed private operations and membership index is usable", async () => {
    const document = (await (await app.request("/openapi.json")).json()) as {
      paths: Record<string, unknown>
      components: { schemas: Record<string, unknown> }
    }
    expect(document.paths).toHaveProperty(
      "/v1/contribution/groups/{groupId}/leader"
    )
    expect(document.components.schemas).toHaveProperty("GroupPermissions")
    const plan = await runtime.database.transaction(async (tx) => {
      await tx.execute(sql`set local enable_seqscan = off`)
      return tx.execute(
        sql`explain select organization_id from member where user_id = ${admin.id}`
      )
    })
    // Both user-leading indexes are valid; cost estimates can choose either.
    expect(JSON.stringify(plan.rows)).toMatch(/member_user(?:Id_idx|_uidx)/)
  })
})
