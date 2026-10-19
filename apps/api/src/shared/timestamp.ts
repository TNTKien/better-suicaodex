import { tz } from "@date-fns/tz"
import { formatRFC3339 } from "date-fns"

export const formatTimestamp = (value: Date) =>
  formatRFC3339(value, { fractionDigits: 3, in: tz("UTC") })
