![StSuicaoDex](https://github.com/user-attachments/assets/3c8805d1-7a61-49d4-9aa6-4bfae337c550)

<a target="_blank" href="https://discord.gg/dongmoe"><img src="https://dcbadge.limes.pink/api/server/dongmoe" alt="" /></a>
[![wakatime](https://wakatime.com/badge/github/TNTKien/better-suicaodex.svg?style=for-the-badge)](https://wakatime.com/badge/github/TNTKien/better-suicaodex)

> Đây là nhánh dùng [@cloudflare/vinext](https://github.com/cloudflare/vinext), mục đích để nghịch là chính, nhiều khả năng sẽ không được duy trì lâu dài, nên ai rảnh bẹn thì có thể nghịch thử.

> Live Demo: https://vinext.suicaodex.com

## Cài đặt
> Lưu ý: [WeebDex API](https://api.weebdex.org/docs) tuy không cần proxy, nhưng vẫn có 1 số yêu cầu riêng, nói chung là vẫn cứ có proxy cho chăc.

>Bạn có thể tham khảo [simple-proxy](https://github.com/TNTKien/simple-proxy), [weebdex-api](https://github.com/TNTKien/weebdex-api). Khi đã có proxy, hãy chỉnh sửa lại `src/config/site.ts` và `.env` cho phù hợp.

> `.env`: nhánh này tôi dùng [better-auth](https://better-auth.com/docs/introduction) và 
[neon](https://neon.com/) cho nhanh, ngoài ra còn 1 số biến khác, xem `example.env` để biết thêm chi tiết.

Cài đặt các package cần thiết:
```bash
bun install
```

Gen API client:
```bash
bun run gen:api
```

Chạy dev server:
```bash
bun run dev:vinext
```

Mở [http://localhost:3001](http://localhost:3001)

Build production:
```bash
bun run build:vinext
```

## Deployment
Đúng ra thì nên deploy bằng Cloudflare Workers, nhưng do gói Free chỉ giới hạn 3MiB, mà cái đống hổ lốn của tôi nó đâu đấy ~ 11MiB nên phải dùng [Nitro](https://v3.nitro.build/) + [Vercel](https://vercel.com/). Trong code đã config sẵn rồi, chỉ cần chỉnh lại build command và output directory trong Vercel như hình là được.

<img width="332" height="213" alt="image" src="https://github.com/user-attachments/assets/e9978ff3-4f6e-4080-b1e9-7a9479b24706" />

