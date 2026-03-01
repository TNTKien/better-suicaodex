// import * as cheerio from "cheerio";
// import { defaultSchema } from "hast-util-sanitize";


// export function getPlainTextLength(html: string): number {
//   const temp = document.createElement("div");
//   temp.innerHTML = html;
//   const rawText = temp.textContent || temp.innerText || "";
//   const cleaned = rawText.replace(/[\n\t\r]/g, "");
//   return cleaned.length;
// }

// export function getPlainTextFromHTML(html: string): string {
//   if (!html) return "";
//   const $ = cheerio.load(html);
//   const text = $.text();
//   return text.replace(/\s+/g, " ").trim();
// }

// export function getContentLength(html: string): number {
//   const $ = cheerio.load(html);
//   const text = $.text().trim();
//   const textLength = text.length;
//   const imgCount = $("img").length;
//   return textLength + imgCount;
// }

// export function isFacebookUrl(url: string): boolean {
//   return /facebook\.com/.test(url);
// }

// export const customSchema = {
//   ...defaultSchema,
//   attributes: {
//     ...(defaultSchema.attributes || {}),
//     "*": [
//       ...((defaultSchema.attributes && defaultSchema.attributes["*"]) || []),
//       "style",
//       "className",
//     ],
//     div: [
//       ...((defaultSchema.attributes && defaultSchema.attributes["div"]) || []),
//       "style",
//       "className",
//     ],
//     span: [
//       ...((defaultSchema.attributes && defaultSchema.attributes["span"]) || []),
//       "style",
//       "className",
//     ],
//     p: [
//       ...((defaultSchema.attributes && defaultSchema.attributes["p"]) || []),
//       "style",
//       "className",
//     ],
//     u: [
//       ...((defaultSchema.attributes && defaultSchema.attributes["u"]) || []),
//       "style",
//       "className",
//     ],
//   },
//   tagNames: [
//     ...(defaultSchema.tagNames || []),
//     "div",
//     "span",
//     "p",
//     "u", // Cho phép thẻ <u>
//   ],
// };

// let currentWorkingApiUrl: string | null = null;


// export function getCurrentApiUrl(): string {
//   return currentWorkingApiUrl || siteConfig.suicaodex.apiURL;
// }

// export function setCurrentApiUrl(url: string): void {
//   currentWorkingApiUrl = url;
// }


// export function setCurrentImageProxyUrl(url: string): void {
//   currentImageProxyUrl = url;
// }


// const SUPPORTED_URL_PROTOCOLS = new Set([
//   "http:",
//   "https:",
//   "mailto:",
//   "sms:",
//   "tel:",
// ]);

// export function sanitizeUrl(url: string): string {
//   try {
//     const parsedUrl = new URL(url);
//     // eslint-disable-next-line no-script-url
//     if (!SUPPORTED_URL_PROTOCOLS.has(parsedUrl.protocol)) {
//       return "about:blank";
//     }
//   } catch {
//     return url;
//   }
//   return url;
// }

// Source: https://stackoverflow.com/a/8234912/2013580
// const urlRegExp = new RegExp( ... );
// export function validateUrl(url: string): boolean {
//   return url === "https://" || urlRegExp.test(url);
// }