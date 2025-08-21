import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'SuicaoDex',
    short_name: 'SuicaoDex',
    description: '"Ứng dụng" đọc truyện đầu hàng Vi En',
    start_url: '/',
    display: 'standalone',
    // background_color: '#ffffff',
    // theme_color: '#000000',
    icons: [
      {
        src: '/icon/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icon/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
    ],
    // Thêm cấu hình offline
    orientation: 'portrait',
    categories: ['books', 'entertainment'],
    lang: 'vi',
    dir: 'ltr',
    prefer_related_applications: false,
    shortcuts: [
      {
        name: "Trang chủ",
        url: "/",
        description: "Trang chủ SuicaoDex"
      },
      {
        name: "Mới cập nhật",
        url: "/latest",
        description: "Truyện mới cập nhật"
      },
      {
        name: "Thư viện",
        url: "/my-library",
        description: "Thư viện truyện của bạn"
      }
    ]
  }
}