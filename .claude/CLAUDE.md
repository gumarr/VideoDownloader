# CLAUDE.md — Hướng dẫn cho Claude Code

Tài liệu này định hướng khi làm việc trong repo **Video Downloader**. Đọc kèm thư mục [docs/](../docs/) để hiểu chi tiết.

## Dự án là gì

Ứng dụng desktop **Electron + React + Vite + TypeScript** để tải video/audio từ **YouTube, SoundCloud, Facebook** bằng `yt-dlp` + `ffmpeg` đóng gói sẵn. Có hàng đợi tải đa luồng, quản lý đăng nhập Facebook, tự cập nhật. Đóng gói cho Windows (NSIS).

## Kiến trúc 3 tầng

- **Main process** (`src/backend/` + `src/main/main.ts`): toàn bộ logic nghiệp vụ, spawn yt-dlp.
- **Preload** (`src/preload/preload.ts`): expose `window.api` qua contextBridge — cầu nối DUY NHẤT.
- **Renderer** (`src/renderer/`): UI React, chỉ gọi backend qua `window.api`.

Xem [docs/02-kien-truc.md](../docs/02-kien-truc.md).

## Quy tắc quan trọng khi sửa code

1. **Tên kênh IPC & type dùng chung** luôn định nghĩa ở `src/types/ipc.ts` — đừng hardcode chuỗi kênh ở nơi khác. Khi thêm kênh mới: cập nhật `ipc.ts` → `preload.ts` → `electron.d.ts` → handler trong `mediaService.ts`.
2. **Bảo mật:** giữ `nodeIntegration: false`, `contextIsolation: true`. Không expose `ipcRenderer`/`fs`/`child_process` trực tiếp cho renderer.
3. **Binary:** yt-dlp/ffmpeg chạy từ `userData/bin/` (copy từ `assets/`), KHÔNG chạy trực tiếp từ `assets/` (read-only ở production). Luôn dùng `getYtDlpPath()` / `ensureBinaryExists()`.
4. **UTF-8:** mọi `spawn` yt-dlp phải set `env.PYTHONIOENCODING = 'utf-8'` (tên file Unicode/tiếng Việt).
5. **Facebook ↔ ytDlpService:** dùng lazy `import()` để tránh circular dependency.
6. **downloadManager** là singleton EventEmitter; phát `queue-update` và `task-progress`. Mọi thay đổi trạng thái nên đi qua `emitUpdate()` (đồng thời ghi `queue.json`).

## Lệnh thường dùng

| Mục đích | Lệnh |
|----------|------|
| Dev | `npm run dev` |
| Build renderer | `npm run build:renderer` |
| Build main | `npm run build:main` |
| Build + đóng gói | `npm run build` |
| Chạy bản build | `npm run start` |
| Lint | `npx eslint .` |

> Shell mặc định là PowerShell (Windows). Có Bash tool cho script POSIX.

## Khi thêm nền tảng mới

1. Thêm vào `SupportedPlatform` (ipc.ts).
2. Tạo `PlatformHandler` mới trong `platformHandler.ts` + cập nhật `getPlatformHandler`/`detectPlatform`.
3. Cập nhật `detectPlatform` phía renderer (`utils/platformDetect.ts`).
4. Thêm nút nền tảng trong sidebar `App.tsx`.

## Tài liệu tham khảo

Thư mục [docs/](../docs/) — tổng quan, kiến trúc, tính năng, backend, IPC, frontend, build.
