# 02 — Kiến trúc

Ứng dụng theo mô hình Electron chuẩn với 3 tầng tách biệt rõ ràng, đảm bảo an toàn (context isolation).

## Sơ đồ tổng quát

```
┌─────────────────────────────────────────────────────────┐
│  RENDERER (React + Vite)  — chạy trong cửa sổ trình duyệt │
│  App.tsx, components/, utils/                             │
│  Truy cập backend DUY NHẤT qua window.api                 │
└───────────────────────────┬─────────────────────────────┘
                            │ window.api.* (contextBridge)
                            ▼
┌─────────────────────────────────────────────────────────┐
│  PRELOAD (preload.ts)                                     │
│  Whitelist các kênh IPC, expose window.api                │
│  nodeIntegration: false, contextIsolation: true           │
└───────────────────────────┬─────────────────────────────┘
                            │ ipcRenderer.invoke / .on
                            ▼
┌─────────────────────────────────────────────────────────┐
│  MAIN PROCESS (main.ts → backend/*)                       │
│  - mediaService: đăng ký IPC handlers                     │
│  - downloadManager: hàng đợi tải                          │
│  - ytDlpService: spawn yt-dlp.exe + ffmpeg.exe            │
│  - facebookSessionManager: phiên đăng nhập FB             │
│  - settingsService, ytDlpUpdater, appUpdater              │
└─────────────────────────────────────────────────────────┘
```

## Nguyên tắc bảo mật

Cấu hình `webPreferences` trong [src/main/main.ts](../src/main/main.ts):

- `nodeIntegration: false` — renderer không truy cập trực tiếp Node.js
- `contextIsolation: true` — tách context renderer và preload
- Chỉ các kênh IPC trong whitelist (`preload.ts`) mới được expose qua `window.api`
- Không expose trực tiếp `ipcRenderer`, `fs`, `child_process` cho renderer

## Luồng dữ liệu chính

### 1. Lấy thông tin video (fetch metadata)

```
User dán URL → App.handleFetch()
  → detectPlatform() (renderer-side)
  → window.api.fetchVideoInfo(url, platform)
  → IPC: FETCH_VIDEO_INFO
  → ytDlpService.fetchVideoInfo()
      → platformHandler.sanitizeUrl() + getExtractArgs()
      → spawn yt-dlp -J  (thử lần lượt nhiều nguồn cookie)
      → parseYtDlpOutput() → VideoMetadata[]
  → trả về renderer → addTasks() (đưa vào queue ở trạng thái 'pending')
```

### 2. Tải video

```
User bấm Start → window.api.startTask(taskId, outputDir?)
  → downloadManager.startTask() → đưa vào queue
  → processQueue() (tôn trọng maxConcurrentDownloads)
  → startDownload() → ytDlpService.downloadVideo()
      → spawn yt-dlp với -o template, -f format
      → parse stdout → onProgress() → emit 'task-progress'
  → emit 'queue-update' → push về renderer qua IPC
```

### 3. Sự kiện push từ main → renderer

DownloadManager là một `EventEmitter`, phát 2 sự kiện được `mediaService` forward về renderer:

- `queue-update` → `IPC_CHANNELS.QUEUE_UPDATE` — snapshot toàn bộ hàng đợi
- `task-progress` → `IPC_CHANNELS.TASK_PROGRESS` — tiến độ từng task (tần suất cao)

## Quản lý binary (yt-dlp / ffmpeg)

Cơ chế trong [ytDlpService.ts](../src/backend/ytDlpService.ts):

- Binary gốc đóng gói trong `assets/` (read-only sau khi cài).
- Lần đầu chạy: copy sang thư mục ghi được `userData/bin/` (`ensureBinaryExists`).
- Lý do: bản cài đặt nằm trong vùng read-only; updater cần ghi đè được binary.
- `--ffmpeg-location` luôn được inject để yt-dlp dùng ffmpeg đi kèm.
- `PYTHONIOENCODING=utf-8` để parse JSON Unicode (vd: tiếng Việt) không lỗi.

## Lưu trữ trên đĩa (trong `app.getPath('userData')`)

| File / thư mục | Mục đích |
|----------------|----------|
| `settings.json` | Cấu hình người dùng |
| `queue.json` | Lưu hàng đợi tải để khôi phục sau khi mở lại app |
| `bin/yt-dlp.exe`, `bin/ffmpeg.exe` | Binary runtime (ghi đè được) |
| `facebook_cookies.txt` | Cookie Facebook xuất ra cho yt-dlp (Netscape format) |
| `persist:facebook` (session) | Phiên đăng nhập Facebook nhúng (Electron tự lưu) |
