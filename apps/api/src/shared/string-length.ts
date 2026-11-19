import { z } from "zod"

// Keep limits consistent with HTML maxLength and JavaScript string.length.
export function utf16MaxLength(maximum: number, message?: string) {
  return [
    z.maxLength(maximum, { error: message }),
    z.check<string>((context) => {
      if (context.issues.length === 0 && context.value.length > maximum)
        context.issues.push({
          code: "too_big",
          origin: "string",
          maximum,
          inclusive: true,
          input: context.value,
          message,
        })
    }),
  ] as const
}
