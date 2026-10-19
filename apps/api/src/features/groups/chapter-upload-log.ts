import type { Logger } from "../../shared/logger.js"
import { errorFields } from "../../shared/logger.js"
import { GroupError } from "./service.js"

type Fields = NonNullable<Parameters<Logger>[2]>
type Stage =
  | "body_validation"
  | "authorize"
  | "transform"
  | "ledger"
  | "storage_put"
  | "storage_head"
  | "ready"
  | "preview"

export type ChapterPageUploadTrace = ReturnType<typeof chapterPageUploadTrace>

declare module "hono" {
  interface ContextVariableMap {
    chapterPageUploadTrace: ChapterPageUploadTrace
  }
}

export function chapterPageUploadTrace(
  log: Logger,
  context: Fields,
  clock = () => performance.now()
) {
  // Monotonic elapsed timings, not calendar arithmetic: immune to clock changes.
  const startedAt = clock()
  let stageStartedAt = startedAt
  let stage: Stage = "body_validation"
  const fields = { ...context }
  const timings: Fields = {}
  const elapsed = (from: number, to: number) =>
    Math.max(0, Math.round(to - from))
  log("info", "chapter.upload_page_started", { ...fields })
  return {
    annotate(next: Fields) {
      Object.assign(fields, next)
    },
    stage(next: Stage) {
      const now = clock()
      timings[stage + "Ms"] = elapsed(stageStartedAt, now)
      stageStartedAt = now
      stage = next
    },
    finish(status: number, error?: unknown) {
      const now = clock()
      timings[stage + "Ms"] = elapsed(stageStartedAt, now)
      log(
        status >= 500 ? "error" : status >= 400 ? "warn" : "info",
        "chapter.upload_page_finished",
        {
          ...fields,
          ...timings,
          status,
          stage,
          durationMs: elapsed(startedAt, now),
          ...(error ? errorFields(error, true) : {}),
          errorCode: error instanceof GroupError ? error.code : null,
        }
      )
    },
  }
}
