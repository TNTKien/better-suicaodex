import { Database } from "bun:sqlite"
import { getUnixTime, subHours } from "date-fns"

type Row = { png: Uint8Array }

export class ImageCache {
  private db: Database

  constructor(
    path: string,
    private maxBytes = 512 * 1024 * 1024
  ) {
    this.db = new Database(path, { create: true })
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS images (
        id TEXT PRIMARY KEY,
        fingerprint TEXT NOT NULL,
        png BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `)
  }

  get(id: string, fingerprint: string, now = new Date()) {
    const row = this.db
      .query<Row, [string, string, number]>(
        `
      SELECT png FROM images
      WHERE id = ? AND fingerprint = ? AND updated_at > ?
    `
      )
      .get(id, fingerprint, getUnixTime(subHours(now, 1)))
    return row ? Buffer.from(row.png) : null
  }

  put(id: string, fingerprint: string, png: Buffer, now = new Date()) {
    if (png.byteLength > this.maxBytes) return
    this.db.transaction(() => {
      this.db
        .query(
          `
        INSERT INTO images (id, fingerprint, png, updated_at) VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          fingerprint = excluded.fingerprint, png = excluded.png,
          updated_at = excluded.updated_at
      `
        )
        .run(id, fingerprint, png, getUnixTime(now))
      this.db
        .query(
          `
        DELETE FROM images WHERE id IN (
          SELECT id FROM (
            SELECT id, SUM(length(png)) OVER (ORDER BY updated_at DESC, id) AS bytes
            FROM images
          ) WHERE bytes > ?
        )
      `
        )
        .run(this.maxBytes)
    })()
  }

  close() {
    this.db.close()
  }
}
