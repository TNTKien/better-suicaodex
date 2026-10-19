import { execFileSync } from "node:child_process"
import { fileURLToPath } from "node:url"

const apiDirectory = fileURLToPath(new URL("../../api", import.meta.url))

function fixture(action: "setup" | "cleanup") {
  execFileSync(
    "bun",
    ["--env-file=.env", "test/helpers/browser-fixture.ts", action],
    { cwd: apiDirectory, stdio: "inherit" }
  )
}

export default function globalSetup() {
  fixture("setup")
  return () => fixture("cleanup")
}
