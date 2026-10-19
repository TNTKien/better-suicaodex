import { intlFormat, parseISO } from "date-fns"

const locale = { locale: "vi-VN" }
const dateOptions = {
  day: "2-digit",
  month: "2-digit",
  timeZone: "Asia/Ho_Chi_Minh",
  year: "numeric",
} as const

export function formatVietnamDate(value: string) {
  return intlFormat(parseISO(value), dateOptions, locale)
}

export function formatVietnamDateTime(value: string) {
  const date = parseISO(value)
  const time = intlFormat(
    date,
    {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    },
    locale
  )
  return `${time} - ${intlFormat(date, dateOptions, locale)}`
}

export function formatVietnamDateTimeInline(value: string) {
  const date = parseISO(value)
  const time = intlFormat(
    date,
    {
      hour: "2-digit",
      hourCycle: "h23",
      minute: "2-digit",
      timeZone: "Asia/Ho_Chi_Minh",
    },
    locale
  )
  return `${intlFormat(date, dateOptions, locale)} ${time}`
}
