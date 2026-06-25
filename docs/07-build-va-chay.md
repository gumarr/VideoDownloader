# 07 — Build & chạy

## Yêu cầu

- Node.js + npm
- Windows (đóng gói target NSIS; binary đi kèm là `.exe`)
- `assets/yt-dlp.exe`, `assets/ffmpeg.exe`, `assets/icon.ico` phải tồn tại

## Cài đặt

```bash
npm install
```

## Chạy chế độ phát triển

```bash
npm run dev
```

Lệnh này (xem `package.json`):
1. Biên dịch main process: `tsc -p tsconfig.main.json`
2. Chạy song song (`concurrently`):
   - Vite dev server cho renderer tại `http://127.0.0.1:5173`
   - `wait-on` đợi server sẵn sàng → khởi động `electron .`

Ở dev, `main.ts` load `http://127.0.0.1:5173` và tự mở DevTools.

## Build production

```bash
npm run build
```

Gồm 3 bước:
1. `build:renderer` — `tsc -b tsconfig.app.json && vite build`
2. `build:main` — `tsc -p tsconfig.main.json`
3. `electron-builder` — đóng gói installer

Output: thư mục `release/`, installer `VideoDownloaderSetup.exe` (NSIS).

## Chạy bản đã build (không đóng gói)

```bash
npm run start   # electron .
```

## Cấu hình đóng gói (electron-builder)

Trong `package.json` → `build`:

- `appId`: `com.videodownloader.app`
- `extraResources`: copy `assets/**` cạnh `app.asar` (để truy cập yt-dlp/ffmpeg ở production qua `process.resourcesPath`)
- `win.target`: `nsis`, icon `assets/icon.ico`
- `nsis`: cho chọn thư mục cài, tạo shortcut desktop & start menu, chạy app sau khi cài
- `publish`: GitHub (`owner: gumarr`, `repo: VideoDownloader`) — phục vụ auto-update

## Cấu hình TypeScript

| File | Phạm vi |
|------|---------|
| `tsconfig.json` | Gốc (references) |
| `tsconfig.main.json` | Main + preload + backend (Node/CommonJS) |
| `tsconfig.app.json` | Renderer (React/DOM) |
| `tsconfig.node.json` | Cấu hình build tooling |

## Lint

```bash
# ESLint (cấu hình tại eslint.config.js)
npx eslint .
```
