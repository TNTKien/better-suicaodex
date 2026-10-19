// ponytail: one global lock is enough for bootstrap imports; split it if write throughput grows.
export const CONTENT_WRITE_LOCK = "suicaodex-redive:content-write"
