import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildMoeReaderLoadQueues } from "@/lib/moetruyen/reader-queue";

void describe("MoeTruyen reader load queues", () => {
  void it("keeps a small urgent window around the current page before background pages", () => {
    const queues = buildMoeReaderLoadQueues({
      total: 10,
      currentIndex: 2,
      preloadForward: 3,
      preloadBackward: 1,
    });

    assert.deepEqual(queues.urgent, [2, 3, 4, 5, 1]);
    assert.deepEqual(queues.background, [0, 6, 7, 8, 9]);
  });

  void it("filters out pages that cannot start loading", () => {
    const queues = buildMoeReaderLoadQueues({
      total: 7,
      currentIndex: 3,
      preloadForward: 2,
      preloadBackward: 2,
      canStart: (index) => index !== 4 && index !== 1,
    });

    assert.deepEqual(queues.urgent, [3, 5, 2]);
    assert.deepEqual(queues.background, [0, 6]);
  });
});
