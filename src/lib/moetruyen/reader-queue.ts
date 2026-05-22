export interface BuildMoeReaderLoadQueuesOptions {
  total: number;
  currentIndex: number;
  preloadForward?: number;
  preloadBackward?: number;
  canStart?: (index: number) => boolean;
}

export interface MoeReaderLoadQueues {
  urgent: number[];
  background: number[];
}

function clampPageIndex(index: number, total: number): number {
  if (total <= 0) return 0;
  return Math.max(0, Math.min(total - 1, Math.floor(index)));
}

function toPositiveInteger(
  value: number | undefined,
  fallback: number,
): number {
  const numberValue = Number(value);
  return Number.isFinite(numberValue)
    ? Math.max(0, Math.floor(numberValue))
    : fallback;
}

export function buildMoeReaderLoadQueues({
  total,
  currentIndex,
  preloadForward = 5,
  preloadBackward = 3,
  canStart = () => true,
}: BuildMoeReaderLoadQueuesOptions): MoeReaderLoadQueues {
  const safeTotal = Math.max(0, Math.floor(total));
  const center = clampPageIndex(currentIndex, safeTotal);
  const forward = toPositiveInteger(preloadForward, 5);
  const backward = toPositiveInteger(preloadBackward, 3);
  const seen = new Set<number>();
  const urgent: number[] = [];
  const background: number[] = [];

  const tryAdd = (target: number, bucket: number[]) => {
    if (target < 0 || target >= safeTotal || seen.has(target)) return;

    seen.add(target);

    if (canStart(target)) {
      bucket.push(target);
    }
  };

  tryAdd(center, urgent);

  for (let step = 1; step <= forward; step += 1) {
    tryAdd(center + step, urgent);
  }

  for (let step = 1; step <= backward; step += 1) {
    tryAdd(center - step, urgent);
  }

  for (let index = 0; index < safeTotal; index += 1) {
    tryAdd(index, background);
  }

  return { urgent, background };
}
