import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatDistanceToNowStrict } from "date-fns";
import * as cheerio from "cheerio";
import { defaultSchema } from 'hast-util-sanitize';
import { siteConfig } from "@/config/site";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getPlainTextLength(html: string): number {
  const temp = document.createElement("div");
  temp.innerHTML = html;

  // Lấy text thuần và loại bỏ xuống dòng, tab
  const rawText = temp.textContent || temp.innerText || "";
  const cleaned = rawText.replace(/[\n\t\r]/g, "");

  return cleaned.length;
}

export function getPlainTextFromHTML(html: string): string {
  if (!html) return "";

  const $ = cheerio.load(html);
  const text = $.text(); // lấy toàn bộ text trong HTML
  return text.replace(/\s+/g, " ").trim();
}

export function getContentLength(html: string): number {
  const $ = cheerio.load(html);

  const text = $.text().trim();
  const textLength = text.length;

  const imgCount = $('img').length;

  const totalLength = textLength + imgCount;

  return totalLength;
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

export function isFacebookUrl(url: string): boolean {
  return /facebook\.com/.test(url);
}

export const customSchema = {
  ...defaultSchema,
  attributes: {
    ...(defaultSchema.attributes || {}),
    '*': [
      ...((defaultSchema.attributes && defaultSchema.attributes['*']) || []),
      'style',
      'className',
    ],
    div: [
      ...((defaultSchema.attributes && defaultSchema.attributes['div']) || []),
      'style',
      'className',
    ],
    span: [
      ...((defaultSchema.attributes && defaultSchema.attributes['span']) || []),
      'style',
      'className',
    ],
    p: [
      ...((defaultSchema.attributes && defaultSchema.attributes['p']) || []),
      'style',
      'className',
    ],
    u: [
      ...((defaultSchema.attributes && defaultSchema.attributes['u']) || []),
      'style',
      'className',
    ],
  },
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'div',
    'span',
    'p',
    'u',  // Cho phép thẻ <u>
  ],
};

let currentWorkingApiUrl: string | null = null;

export function getCurrentApiUrl(): string {
  return currentWorkingApiUrl || siteConfig.suicaodex.apiURL;
}

export function setCurrentApiUrl(url: string): void {
  currentWorkingApiUrl = url;
}

export function getCoverImageUrl(mangaId: string, fileName: string, size: string = ""): string {
  const apiUrl = getCurrentApiUrl();
  
  if (size === "full") {
    return `${apiUrl}/covers/${mangaId}/${fileName}`;
  }

  const sizeStr = size ? `.${size}` : "";
  return `${apiUrl}/covers/${mangaId}/${fileName}${sizeStr}.jpg`;
}

