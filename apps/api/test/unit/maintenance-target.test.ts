import { expect, test } from "bun:test"
import { maintenanceTarget } from "../../src/shared/maintenance-target"
import { assertMaintenance } from "../../src/features/shop/catalog-maintenance"

test("maintenance identity excludes credentials and requires an explicit offline target", () => {
  const target = maintenanceTarget(
    "postgresql://fixture:secret@localhost/catalog_test"
  )
  expect(target).toEqual({
    host: "localhost",
    port: "5432",
    database: "catalog_test",
  })
  expect(
    maintenanceTarget("postgres://localhost:55439/catalog%20test").database
  ).toBe("catalog test")
  for (const url of [
    "invalid",
    "https://localhost/db",
    "postgres://localhost/",
    "postgres://localhost/%zz",
  ])
    expect(() => maintenanceTarget(url)).toThrow(
      "A valid PostgreSQL DATABASE_URL is required"
    )
  const options = {
    maintenance: true,
    confirmedDatabase: target.database,
    shopEnabled: false,
  }
  expect(() => assertMaintenance(target, options)).not.toThrow()
  for (const patch of [
    { maintenance: false },
    { confirmedDatabase: "another" },
    { shopEnabled: true },
  ])
    expect(() => assertMaintenance(target, { ...options, ...patch })).toThrow(
      "MAINTENANCE_REQUIRED"
    )
})
