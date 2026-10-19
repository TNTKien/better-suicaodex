const maxConcurrentTransforms = 2
const maxQueuedTransforms = 8
let activeTransforms = 0
const transformQueue: Array<() => void> = []

export class ImageTransformBusyError extends Error {}

export async function withImageTransformSlot<T>(operation: () => Promise<T>) {
  if (activeTransforms >= maxConcurrentTransforms) {
    if (transformQueue.length >= maxQueuedTransforms)
      throw new ImageTransformBusyError("The image processor is busy")
    await new Promise<void>((resolve) => transformQueue.push(resolve))
  } else activeTransforms++

  try {
    return await operation()
  } finally {
    const next = transformQueue.shift()
    if (next) next()
    else activeTransforms--
  }
}
