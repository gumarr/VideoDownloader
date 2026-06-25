# Tài liệu dự án — Video Downloader

Đây là thư mục tài liệu mô tả **những gì dự án đã làm được**, kiến trúc và cách hoạt động của ứng dụng **Video Downloader** (Electron + React + Vite + TypeScript).

Ứng dụng cho phép tải video/audio từ **YouTube**, **SoundCloud** và **Facebook** thông qua `yt-dlp` + `ffmpeg` được đóng gói sẵn, với hàng đợi tải đa luồng, quản lý phiên đăng nhập Facebook và cơ chế tự cập nhật.

## Mục lục tài liệu

| File | Nội dung |
|------|----------|
| [01-tong-quan.md](01-tong-quan.md) | Tổng quan dự án, tech stack, tình trạng hiện tại |
| [02-kien-truc.md](02-kien-truc.md) | Kiến trúc 3 tầng (Main / Preload / Renderer), luồng dữ liệu |
| [03-tinh-nang.md](03-tinh-nang.md) | Danh sách đầy đủ các tính năng đã hoàn thành |
| [04-backend-services.md](04-backend-services.md) | Mô tả chi tiết từng service backend |
| [05-ipc-va-preload.md](05-ipc-va-preload.md) | Giao tiếp IPC giữa main và renderer |
| [06-frontend.md](06-frontend.md) | Cấu trúc UI React, các component |
| [07-build-va-chay.md](07-build-va-chay.md) | Cách chạy dev, build, đóng gói installer |

## Tóm tắt nhanh

- **Phiên bản hiện tại:** `1.4.1`
- **Nền tảng đóng gói:** Windows (NSIS installer)
- **Binary đi kèm:** `yt-dlp.exe`, `ffmpeg.exe` (trong `assets/`)
- **Tự cập nhật:** cả ứng dụng (electron-updater) và binary `yt-dlp`
