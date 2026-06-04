import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { MoeChapterCard } from "@/app/(moetruyen)/moetruyen/(moe_home)/manga/_components/moe-manga-chapters-list";
import type { GetV2MangaByIdChapters200DataChaptersItem } from "@/lib/moetruyen/model/getV2MangaByIdChapters200DataChaptersItem";

void describe("MoeChapterCard", () => {
  function createChapter(
    access: GetV2MangaByIdChapters200DataChaptersItem["access"],
  ): GetV2MangaByIdChapters200DataChaptersItem {
    return {
      id: 126,
      number: 126,
      numberText: null,
      title: "Bất ổn định",
      date: null,
      pages: null,
      groupName: null,
      groups: [{ id: 1, name: "GTSCHUNDER" }],
      viewCount: 0,
      access,
    };
  }

  void it("shows locked chapters with the lock indicator", () => {
    const markup = renderToStaticMarkup(
      createElement(MoeChapterCard, { chapter: createChapter("locked") }),
    );

    assert.match(markup, /Đã khoá/);
    assert.match(markup, /lucide-lock/);
    assert.doesNotMatch(markup, /Có mật khẩu/);
    assert.doesNotMatch(markup, /lucide-key-square/);
  });

  void it("shows password-required chapters with the key indicator", () => {
    const markup = renderToStaticMarkup(
      createElement(MoeChapterCard, {
        chapter: createChapter("password_required"),
      }),
    );

    assert.match(markup, /Có mật khẩu/);
    assert.match(markup, /lucide-key-square/);
    assert.doesNotMatch(markup, /Đã khoá/);
    assert.doesNotMatch(markup, /lucide-eye-off/);
  });
});
