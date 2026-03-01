import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
import { vi as locale } from "date-fns/locale";

import { siteConfig } from "@/config/site";
import slugify from "slugify";
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const formatDistanceLocale = {
  lessThanXSeconds: "vừa xong",
  xSeconds: "vừa xong",
  halfAMinute: "vừa xong",
  lessThanXMinutes: "{{count}} phút",
  xMinutes: "{{count}} phút",
  aboutXHours: "{{count}} giờ",
  xHours: "{{count}} giờ",
  xDays: "{{count}} ngày",
  aboutXWeeks: "{{count}} tuần",
  xWeeks: "{{count}} tuần",
  aboutXMonths: "{{count}} tháng",
  xMonths: "{{count}} tháng",
  aboutXYears: "{{count}} năm",
  xYears: "{{count}} năm",
  overXYears: "{{count}} năm",
  almostXYears: "{{count}} năm",
};

function formatDistance(token: string, count: number, options?: any): string {
  options = options || {};

  const result = formatDistanceLocale[
    token as keyof typeof formatDistanceLocale
  ].replace("{{count}}", count.toString());

  if (options.addSuffix) {
    if (options.comparison > 0) {
      return "Khoảng " + result;
    } else {
      if (result === "vừa xong") return result;

      return result + " trước";
    }
  }

  return result;
}

export function formatTimeToNow(date: Date | number): string {
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: {
      ...locale,
      formatDistance,
    },
  });
}

// Format time in short form: 2s, 5m, 3h, 1d, 2w, 3mo, 1y
const formatDistanceShort = {
  lessThanXSeconds: "{{count}}s",
  xSeconds: "{{count}}s",
  halfAMinute: "30s",
  lessThanXMinutes: "{{count}}m",
  xMinutes: "{{count}}m",
  aboutXHours: "{{count}}h",
  xHours: "{{count}}h",
  xDays: "{{count}}d",
  aboutXWeeks: "{{count}}w",
  xWeeks: "{{count}}w",
  aboutXMonths: "{{count}}mo",
  xMonths: "{{count}}mo",
  aboutXYears: "{{count}}y",
  xYears: "{{count}}y",
  overXYears: "{{count}}y",
  almostXYears: "{{count}}y",
};

function formatDistanceShortFn(token: string, count: number): string {
  return formatDistanceShort[token as keyof typeof formatDistanceShort].replace(
    "{{count}}",
    count.toString(),
  );
}

export function formatShortTime(date: Date | number): string {
  return formatDistanceToNowStrict(date, {
    addSuffix: false,
    locale: {
      ...locale,
      formatDistance: formatDistanceShortFn,
    },
  });
}

let currentImageProxyUrl: string | null = null;

export function getCurrentImageProxyUrl(): string {
  return currentImageProxyUrl || siteConfig.suicaodex.apiURL;
}

export function getCoverImageUrl(
  mangaId: string,
  fileName: string,
  size: string = "",
): string {
  // Dùng image proxy URL thay vì API URL
  const apiUrl = getCurrentImageProxyUrl();

  if (size === "full") {
    return `${apiUrl}/covers/${mangaId}/${fileName}`;
  }

  const sizeStr = size ? `.${size}` : "";
  return `${apiUrl}/covers/${mangaId}/${fileName}${sizeStr}.jpg`;
}

export function formatNumber(num: number): string {
  const f = Intl.NumberFormat("en", {
    notation: "compact",
    compactDisplay: "short",
  });
  return f.format(num);
}

export function generateSlug(title: string): string {
  if (!title) return "";
  const titleWithDash = title.replace(/\//g, "-");
  return slugify(titleWithDash, {
    lower: true,
    locale: "vi",
    remove: /[*+~.,()'"!?:@\[\]]/g,
  });
}

export function formatChapterTitle(
  chapter: { chapter?: string | null; title?: string | null },
  includeTitle: boolean = true,
): string {
  if (!chapter.chapter) {
    return "Oneshot";
  }
  if (!includeTitle) {
    return `Ch. ${chapter.chapter}`;
  }
  return chapter.title
    ? `Ch. ${chapter.chapter} - ${chapter.title}`
    : `Ch. ${chapter.chapter}`;
}
