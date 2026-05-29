import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { getMoeGroupHref, getMoePrimaryGroup } from "@/lib/moetruyen/group-url";

void describe("MoeTruyen group URLs", () => {
  void it("builds the internal group detail URL with a generated slug", () => {
    assert.equal(
      getMoeGroupHref({
        id: 107,
        name: "Lữ đoàn bóng ma (uploader)",
      }),
      "/moetruyen/group/107/lu-doan-bong-ma-uploader",
    );
  });

  void it("uses the first resolved group as the primary group", () => {
    const primaryGroup = getMoePrimaryGroup([
      { id: 8, name: "IA Translation" },
      { id: 107, name: "Lữ đoàn bóng ma (uploader)" },
    ]);

    assert.deepEqual(primaryGroup, { id: 8, name: "IA Translation" });
  });
});
