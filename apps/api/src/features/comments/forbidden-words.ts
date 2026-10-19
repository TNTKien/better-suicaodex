import { asc, eq } from "drizzle-orm"

import type { Database } from "../../db/client.js"
import { forbiddenWord } from "../../db/schema.js"

type Reader = Pick<Database, "select">

export const FORBIDDEN_WORD_MAX_LENGTH = 80

export function normalizeForbiddenWord(value: string) {
  const word = value.replace(/\s+/gu, " ").trim()
  return { word, normalizedWord: word.toLocaleLowerCase("vi") }
}

export function censorForbiddenWords(body: string, words: string[]) {
  const patterns = [...new Set(words.filter(Boolean))]
    .sort((left, right) => right.length - left.length)
    .map((word) => word.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&"))
  if (patterns.length === 0) return body
  return body.replace(new RegExp(patterns.join("|"), "giu"), "***")
}

export async function censorCommentBody(database: Reader, body: string) {
  const words = await database
    .select({ word: forbiddenWord.word })
    .from(forbiddenWord)
  return censorForbiddenWords(
    body,
    words.map(({ word }) => word)
  )
}

export async function listForbiddenWords(database: Database) {
  return database
    .select({
      id: forbiddenWord.id,
      word: forbiddenWord.word,
      createdAt: forbiddenWord.createdAt,
    })
    .from(forbiddenWord)
    .orderBy(asc(forbiddenWord.normalizedWord), asc(forbiddenWord.id))
}

export async function addForbiddenWords(database: Database, values: string[]) {
  const unique = new Map<string, ReturnType<typeof normalizeForbiddenWord>>()
  for (const value of values) {
    const item = normalizeForbiddenWord(value)
    if (!unique.has(item.normalizedWord)) unique.set(item.normalizedWord, item)
  }
  return database
    .insert(forbiddenWord)
    .values([...unique.values()])
    .onConflictDoNothing({ target: forbiddenWord.normalizedWord })
    .returning({
      id: forbiddenWord.id,
      word: forbiddenWord.word,
      createdAt: forbiddenWord.createdAt,
    })
}

export async function deleteForbiddenWord(database: Database, id: string) {
  const [deleted] = await database
    .delete(forbiddenWord)
    .where(eq(forbiddenWord.id, id))
    .returning({
      id: forbiddenWord.id,
      word: forbiddenWord.word,
      createdAt: forbiddenWord.createdAt,
    })
  return deleted ?? null
}
