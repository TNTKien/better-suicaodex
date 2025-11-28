![StSuicaoDex](https://github.com/user-attachments/assets/3c8805d1-7a61-49d4-9aa6-4bfae337c550)

<a target="_blank" href="https://discord.gg/dongmoe"><img src="https://dcbadge.limes.pink/api/server/dongmoe" alt="" /></a>
[![wakatime](https://wakatime.com/badge/github/TNTKien/better-suicaodex.svg?style=for-the-badge)](https://wakatime.com/badge/github/TNTKien/better-suicaodex)

> [suicaodex](https://github.com/TNTKien/suicaodex) vốn dĩ là 1 đống hổ lốn, better-suicaodex sinh ra để giải quyết đống hổ lốn đó (hoặc không 🐧).

> SuicaoDex chỉ xây dựng giao diện, trừ một số chức năng liên quan đến tài khoản, mọi dữ liệu khác đều thuộc về MangaDex.

Như đã nói, SuicaoDex chỉ là 1 dự án "cho vui", phục vụ sở thích của cá nhân tôi, và tôi cũng chả cao siêu gì, nên nó sẽ không thể trọn vẹn như các web truyện chuyên nghiệp khác.

Tuy vậy, SuicaoDex sẽ luôn:
- Không quảng cáo & phi lợi nhuận.
- Tôn trọng nguồn dịch.
- Thân thiện với độc giả Việt Nam (cụ thể là tôi).

## Tiến độ
✅ Đã hoàn thành chuyển đổi từ suicaodex cũ sang better-suicaodex.

☑️ Chưa hoàn thiện 100%

❌ Loại bỏ

| Route | URL | suicaodex | better-suicaodex |
| --- | --- | :---: | :---: |
| Trang chủ | / | ✅ | ✅ |
| Tìm kiếm | | ✅ | ✅ |
| Tìm kiếm nâng cao | /advanced-search | ✅ | ✅ |
| Manga | /manga/:id | ✅ | ✅ |
| Chapter | /chapter/:id | ✅ | ✅ |
| Mới cập nhật | /latest | ✅ | ✅ |
| Lịch sử đọc | /history | ✅ | ✅ |
| Nhóm dịch | /groups | ✅ | ✅ |
| Chi tiết nhóm dịch | /group/:id | ✅ | ✅ |
| Tài khoản |  | ✅ | ✅ |
| Thư viện | /my-library | ✅ | ✅ |
| Thông báo | /notifications | ⬛ | ☑️ |
| Tác giả | /author | ⬛ | ✅ |
| Bình luận |  | ✅ | ☑️ |
| Built-in API | /api/mangadex/ | ✅ | ❌ |

> Bỏ built-in API vì tôi lười 👍

> Tạm bỏ chức năng Bình luận, lý do bên dưới.

> UPDATE: Đã thêm lại Bình luận, nhưng code như cc.

Ngoài ra còn cải thiện các chức năng cũ và thêm một số chức năng mới, sẽ cập nhật sau...

## Vài lỗi đã biết
- ~~Mất từ khóa khi nhấn enter trên thanh tìm kiếm nhanh~~
- Thứ tự truyện trong lịch sử đọc đang sắp xếp theo mốc thời gian của chính chương truyện, không phải theo thời điểm đọc truyện
- Thông báo bị đần, ngoài ra chưa có chỗ để xem danh sách các truyện đã đăng ký nhận thông báo
- Nhiều chỗ param bị đần hoặc méo có, mà giờ sửa thì lười vc 🐧, thôi thì cứ từ từ 🐧🐧

## Dự kiến
⬛ Hoàn thiện Thông báo.

✅ Trang thể loại truyện (thể loại hiện tại đang dùng ké tìm kiếm nâng cao)

☑️ Hoàn thiện bình luận:
1. ✅ Thêm bình luận từng chương.
2. ⬛ Chỉnh sửa/Trả lời
3. ⬛ Thả like
4. ✅ Sticker...
5. ✅ Richtext editor

⬛ Giả lập Gacha (tại sao lại không nhỉ? 🐧)

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

> Lưu ý: MangaDex API yêu cầu proxy, hãy tự tạo proxy mà dùng vì nếu bạn dùng của tôi thì tôi bị tốn thêm tiền.

>Bạn có thể tham khảo [simple-proxy](https://github.com/TNTKien/simple-proxy), [suicaodex-api](https://github.com/TNTKien/suicaodex-api) hoặc proxy tích hợp sẵn trong [suicaodex cũ](https://github.com/TNTKien/suicaodex/blob/main/app/api/mangadex/%5B...path%5D/route.ts) (không khuyến khích lắm).

> Khi đã có proxy, hãy chỉnh sửa lại `src/config/site.ts` và `src/lib/axios.ts` cho phù hợp (ngoài ra sẽ cần sửa thêm 1 số url ảnh truyện, ảnh  bìa).

> `.env`: SuicaoDex sử dụng [AuthJS](https://authjs.dev/), nhớ đọc kỹ docs để biết đường mà config, có thể tham khảo `example.env`.


Cài đặt các package cần thiết:
```bash
npm install
# or
yarn install
# or
pnpm install
# or
bun install
```

Chạy server dev:
```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Mở [http://localhost:3000](http://localhost:3000)
