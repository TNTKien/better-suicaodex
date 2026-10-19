import { formatISO } from "date-fns"

export type LogLevel = "info" | "warn" | "error"

export type Logger = (
  level: LogLevel,
  event: string,
  fields?: Record<string, boolean | number | string | null>
) => void

export const logger: Logger = (level, event, fields = {}) => {
  const output = JSON.stringify({
    timestamp: formatISO(new Date()),
    level,
    event,
    ...fields,
  })

  if (level === "error") console.error(output)
  else if (level === "warn") console.warn(output)
  else console.info(output)
}

export function errorFields(error: unknown, production: boolean) {
  if (!(error instanceof Error)) return { errorType: "unknown" }

  return {
    errorType: error.name,
    ...(production ? {} : { errorMessage: error.message }),
  }
}
