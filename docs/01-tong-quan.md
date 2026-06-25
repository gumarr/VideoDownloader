# 01 — Tổng quan dự án

## Mô tả

**Video Downloader** là ứng dụng desktop (Electron) cho phép người dùng tải video và audio từ nhiều nền tảng về máy. Ứng dụng đóng gói sẵn `yt-dlp` và `ffmpeg` nên người dùng cuối **không cần cài đặt thêm gì**.

## Nền tảng hỗ trợ tải

| Nền tảng | Định dạng mặc định | Ghi chú |
|----------|--------------------|---------|
| **YouTube** | MP4 (best) | Hỗ trợ video đơn và playlist (giới hạn 150 mục) |
| **SoundCloud** | MP3 (best) | Hỗ trợ track đơn và playlist; giữ nguyên metadata (tên, ảnh bìa) |
| **Facebook** | MP4 (best) | Video, Reels, post, group post, fb.watch; có quản lý đăng nhập |

## Tech stack

- **Electron** `^41.2.0` — vỏ ứng dụng desktop
- **React** `^19.2.4` + **React DOM** — giao diện renderer
- **Vite** `^8.0.4` — bundler/dev server cho renderer
- **TypeScript** `~6.0.2` — toàn bộ codebase
- **Tailwind CSS** `^4.2.2` — styling (qua `@tailwindcss/vite`)
- **electron-updater** `^6.8.3` — tự cập nhật ứng dụng qua GitHub Releases
- **electron-builder** `^26.8.1` — đóng gói installer NSIS cho Windows
- **yt-dlp.exe** + **ffmpeg.exe** — công cụ tải/chuyển mã (bundled trong `assets/`)

## Tình trạng hiện tại

- Phiên bản: **`1.4.1`** (`package.json`)
- Đóng gói cho **Windows** (target NSIS), icon `assets/icon.ico`
- Publish qua **GitHub Releases** (`owner: gumarr`, `repo: VideoDownloader`)
- App ID: `com.videodownloader.app`

## Cấu trúc thư mục mã nguồn

```
src/
├── main/           # Electron main process (entry point)
│   └── main.ts
├── preload/        # Cầu nối an toàn giữa main và renderer
│   └── preload.ts
├── backend/        # Logic nghiệp vụ chạy trong main process
│   ├── ytDlpService.ts          # Gọi yt-dlp: fetch metadata + download
│   ├── downloadManager.ts       # Hàng đợi tải + quản lý đồng thời
│   ├── mediaService.ts          # Đăng ký toàn bộ IPC handlers
│   ├── platformHandler.ts       # Xử lý URL theo từng nền tảng
│   ├── facebookSessionManager.ts# Quản lý phiên đăng nhập Facebook
│   ├── settingsService.ts       # Đọc/ghi settings.json
│   ├── ytDlpUpdater.ts          # Cập nhật binary yt-dlp
│   └── appUpdater.ts            # Cập nhật ứng dụng (electron-updater)
├── renderer/       # Giao diện React
│   ├── App.tsx
│   ├── components/  # Các component UI
│   └── utils/       # platformDetect.ts
└── types/          # Định nghĩa type dùng chung
    ├── ipc.ts        # Type & tên kênh IPC (single source of truth)
    └── electron.d.ts # Khai báo window.api cho renderer
```
