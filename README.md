![StSuicaoDex](https://github.com/user-attachments/assets/3c8805d1-7a61-49d4-9aa6-4bfae337c550)

<a target="_blank" href="https://discord.gg/dongmoe"><img src="https://dcbadge.limes.pink/api/server/dongmoe" alt="" /></a>
[![wakatime](https://wakatime.com/badge/github/TNTKien/better-suicaodex.svg?style=for-the-badge)](https://wakatime.com/badge/github/TNTKien/better-suicaodex)

> vinext-v kkkk

> [suicaodex](https://github.com/TNTKien/suicaodex) vốn dĩ là 1 đống hổ lốn, better-suicaodex sinh ra để giải quyết đống hổ lốn đó (hoặc không 🐧).

> SuicaoDex chỉ xây dựng giao diện, trừ một số chức năng liên quan đến tài khoản, mọi dữ liệu khác đều thuộc về ~~MangaDex~~ WeebDex.

Như đã nói, SuicaoDex chỉ là 1 dự án "cho vui", phục vụ sở thích của cá nhân tôi, và tôi cũng chả cao siêu gì, nên nó sẽ không thể trọn vẹn như các web truyện chuyên nghiệp khác.

Tuy vậy, SuicaoDex sẽ luôn:
- Không quảng cáo & phi lợi nhuận.
- Tôn trọng nguồn dịch.
- Thân thiện với độc giả Việt Nam (cụ thể là tôi).

## BREAKING CHANGES - 01/03/2026
- Chuyển sang dùng [WeebDex API](https://api.weebdex.org/docs), đa phần các config, code...liên quan đến MangaDex đã bị xóa hoặc đưa vào thư mục `deprecated`.
- Mapping giữa WeebDex và MangaDex chưa hoàn chỉnh ~~(thực ra là lười chưa làm 🐧)~~, dẫn đến 1 số chức năng bị ảnh hưởng (Thư viện, Lịch sử đọc...) → Tạm tắt hoặc sử dụng bị hạn chế, sẽ khắc phục trong tương lai.

## Vài lỗi đã biết
- Nút `Đọc ngay` hoạt động bất thường khi chuyển ngôn ngữ.
- ~~Thông báo bị đần, ngoài ra chưa có chỗ để xem danh sách các truyện đã đăng ký nhận thông báo~~ Tạm thời tắt chức năng này
- Nhiều chỗ param bị đần hoặc méo có, mà giờ sửa thì lười vc 🐧, thôi thì cứ từ từ 🐧🐧

## Dự kiến
☑️ Chuyển sang Weebdex API: Đã hoàn thành, tuy nhiên do sự khác biệt về dữ liệu giữa 2 API, một số chức năng sẽ bị ảnh hưởng, cụ thể như sau:

| Chức năng | Trạng thái | Chi tiết |
|---|---|---|
| Link | Tạm khắc phục | - Các link truyện uuid của MangaDex sẽ tự động được chuyển về url mới tương ứng (trừ truyện không có trên WeebDex).<br>Ví dụ: https://suicaodex.com/manga/e1e38166-20e4-4468-9370-187f985c550e → https://suicaodex.com/manga/bx5udigu0h/mato-seihei-no-slave <br>- Link chapter do không có map nên chịu, sẽ dẫn thẳng sang mangadex. |
| Thư viện | Tạm khắc phục | - Đối với thư viện lưu trên thiết bị trước ngày **02/03/2026** sẽ không hiển thị<br>- Đã khắc phục thư viện trong tài khoản, chức năng này hiện đã hoạt động bình thường, 1 số đầu truyện không có trên WeebDex thì chịu, có thể đợi có hoặc xóa cho rảnh nợ. |
| Lịch sử đọc | Hạn chế | Lịch sử đọc trước ngày **02/03/2026** sẽ không hiển thị. |
| Thông báo chương mới | Tạm tắt | Vốn dĩ từ trước đã không ổn, tiện thể tắt luôn để tìm giải pháp tối ưu hơn. |
| Truyện đề cử & Bảng xếp hạng | Tạm ẩn | WeebDex chỉ mới đi vào hoạt động gần đây, dữ liệu chưa có quá nhiều nên chưa thể tính toán được. |
| Bình luận | Tạm khắc phục | - Trừ 1 số truyện không/chưa có trên WeebDex, các bình luận **tại truyện** sẽ hiển thị bình thường.<br> - Bình luận trong chapter thì chịu, tạm chưa có giải pháp (vẫn sẽ hiển thị trong mục `Bình luận gần đây` cho đến khi nó trôi mất). |",


☑️ Làm lại reader: cơ bản đã xong, cần thử nghiệm thêm để cải thiện UI/UX

⬛ Fix layout trang chủ

⬛ Hoàn thiện Thông báo.

☑️ Hoàn thiện bình luận:
1. ✅ Thêm bình luận từng chương.
2. ✅ Chỉnh sửa/Trả lời
3. ⬛ Thả like
4. ✅ Sticker...
5. ~~✅ Richtext editor~~ bỏ đi vì không cần thiết


## Góp ý/Báo lỗi
Cần góp ý, thêm chức năng mới, báo lỗi hoặc bất cứ lý do gì bạn nghĩ ra được, hãy tìm tôi tại:

 <a target="_blank" href="https://www.facebook.com/suicaodex"><img src="https://img.shields.io/badge/SuicaoDex-1877F2?style=flat&logo=facebook&logoColor=white" alt="" /></a>
 ![](https://dcbadge.limes.pink/api/shield/559979358404608001?style=flat)

  hoặc tạo:

  <a target="_blank" href="https://github.com/TNTKien/better-suicaodex/pulls"><img src="https://img.shields.io/badge/Pull%20Request-%23121011.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1naXQtcHVsbC1yZXF1ZXN0LWFycm93LWljb24gbHVjaWRlLWdpdC1wdWxsLXJlcXVlc3QtYXJyb3ciPjxjaXJjbGUgY3g9IjUiIGN5PSI2IiByPSIzIi8+PHBhdGggZD0iTTUgOXYxMiIvPjxjaXJjbGUgY3g9IjE5IiBjeT0iMTgiIHI9IjMiLz48cGF0aCBkPSJtMTUgOS0zLTMgMy0zIi8+PHBhdGggZD0iTTEyIDZoNWEyIDIgMCAwIDEgMiAydjciLz48L3N2Zz4=&logoColor=white" alt="" /></a>
  <a target="_blank" href="https://github.com/TNTKien/better-suicaodex/pulls"><img src="https://img.shields.io/badge/Issue-%23121011.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1jaXJjbGUtZG90LWljb24gbHVjaWRlLWNpcmNsZS1kb3QiPjxjaXJjbGUgY3g9IjEyIiBjeT0iMTIiIHI9IjEwIi8+PGNpcmNsZSBjeD0iMTIiIGN5PSIxMiIgcj0iMSIvPjwvc3ZnPg==&logoColor=white" alt="" /></a>
  <a target="_blank" href="https://github.com/TNTKien/better-suicaodex/discussions"><img src="https://img.shields.io/badge/Discussion-%23121011.svg?logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMiIgc3Ryb2tlLWxpbmVjYXA9InJvdW5kIiBzdHJva2UtbGluZWpvaW49InJvdW5kIiBjbGFzcz0ibHVjaWRlIGx1Y2lkZS1tZXNzYWdlcy1zcXVhcmUtaWNvbiBsdWNpZGUtbWVzc2FnZXMtc3F1YXJlIj48cGF0aCBkPSJNMTQgOWEyIDIgMCAwIDEtMiAySDZsLTQgNFY0YTIgMiAwIDAgMSAyLTJoOGEyIDIgMCAwIDEgMiAyeiIvPjxwYXRoIGQ9Ik0xOCA5aDJhMiAyIDAgMCAxIDIgMnYxMWwtNC00aC02YTIgMiAwIDAgMS0yLTJ2LTEiLz48L3N2Zz4=&logoColor=white" alt="" /></a>

Tôi rất hoan nghênh và thậm chí là khuyến khích cmn luôn, làm một mình oải vcl thề 🐧.

## Cài đặt

> Lưu ý: [WeebDex API](https://api.weebdex.org/docs) tuy không cần proxy, nhưng vẫn có 1 số yêu cầu riêng, nói chung là vẫn cứ có proxy cho chăc.

>Bạn có thể tham khảo [simple-proxy](https://github.com/TNTKien/simple-proxy), [weebdex-api](https://github.com/TNTKien/weebdex-api). Khi đã có proxy, hãy chỉnh sửa lại `src/config/site.ts` và `.env` cho phù hợp.

> `.env`: SuicaoDex sử dụng [AuthJS](https://authjs.dev/), nhớ đọc kỹ docs để biết đường mà config. Ngoài ra còn 1 số biến môn trường khác, hãy xem trong `example.env`.

> Database: project hiện dùng **Neon Postgres** qua Prisma. Trong `.env`, cần cấu hình `DATABASE_URL` (pooled URL, có `-pooler`) và `DIRECT_URL` (direct URL cho Prisma CLI). Lần đầu setup database có thể chạy `bun prisma db push`.

> PWA: khi dùng vinext, Serwist chạy qua `@serwist/vite`. Mặc định để `NEXT_PUBLIC_ENABLE_PWA="false"` trong dev. Khi build PWA thì dùng `bun run build:vinext:pwa`.


Cài đặt các package cần thiết:
```bash
bun install
```

Gen API client:
```bash
bun run gen:api
```

Chạy server dev:
```bash
bun dev
```

Mở [http://localhost:3000](http://localhost:3000)

## Ít ⭐ nhưng nhìn nó hay hay

<a href="https://www.star-history.com/#TNTKien/better-suicaodex&type=date&legend=top-left">
 <picture>
   <source media="(prefers-color-scheme: dark)" srcset="https://api.star-history.com/svg?repos=TNTKien/better-suicaodex&type=date&theme=dark&legend=top-left" />
   <source media="(prefers-color-scheme: light)" srcset="https://api.star-history.com/svg?repos=TNTKien/better-suicaodex&type=date&legend=top-left" />
   <img alt="Star History Chart" src="https://api.star-history.com/svg?repos=TNTKien/better-suicaodex&type=date&legend=top-left" />
 </picture>
</a>
