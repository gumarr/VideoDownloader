# 04 — Backend services

Toàn bộ logic nghiệp vụ chạy trong main process, nằm ở `src/backend/`.

## ytDlpService.ts

Cầu nối tới `yt-dlp.exe`. Trách nhiệm chính:

- **Quản lý binary:** `ensureBinaryExists()` copy yt-dlp/ffmpeg từ `assets/` (read-only) sang `userData/bin/` (ghi được). `getYtDlpPath()` trả đường dẫn runtime.
- **`fetchVideoInfo(url, platform)`** → `{ data: VideoMetadata[], warnings }`:
  - Facebook: nhánh xác thực riêng — lấy cookie qua `facebookSessionManager`, thử có-auth rồi không-auth; phân loại lỗi auth (`FACEBOOK_AUTH_REQUIRED`) và rate-limit.
  - YouTube/SoundCloud: chuỗi thử nhiều nguồn cookie (cache → cấu hình user → baseline → các trình duyệt đã cài), phân biệt lỗi *cookie infrastructure* và lỗi *content*, cache cấu hình thành công.
- **`downloadVideo(options, onProgress)`** → `{ proc, promise }`:
  - Build args yt-dlp (`-o` template, `-f` format theo MP4/MP3 + chất lượng, `--merge-output-format mp4`).
  - Parse stdout lấy %, size, speed, ETA và đường dẫn file đích.
  - Giải đường dẫn file kết quả qua nhiều lớp dự phòng.
- `parseYtDlpOutput()`: parser JSON dùng chung (video đơn & playlist), map sang `VideoMetadata`.

## downloadManager.ts

Singleton `EventEmitter` sở hữu hàng đợi và độ đồng thời.

- Cấu trúc: `tasks` (Map), `processes` (Map taskId→ChildProcess), `queue` (mảng id chờ), `activeIds` (Set đang chạy).
- **API:** `addTasks`, `addTask`, `startTask`, `updateTask`, `cancelTask`, `removeTask`, `retryTask`, `clearCompleted`, `clearAllTasks`, `getSnapshot`.
- **Engine:** `processQueue()` chạy task đến khi đạt `maxConcurrentDownloads`; `startDownload()` spawn qua `downloadVideo`.
- **Bền vững:** `init()` đọc `queue.json`, reset task `downloading` → `queued`; `saveQueueToDisk()` ghi mỗi lần `emitUpdate()`.
- **Tích hợp updater:** `pauseQueue()` / `resumeQueue()` để nhả file lock yt-dlp khi cập nhật binary.
- **Sự kiện:** `queue-update` (snapshot), `task-progress` (tiến độ).

## mediaService.ts

`attachMediaHandlers()` — đăng ký **toàn bộ** IPC handler (gọi 1 lần từ `main.ts`). Bao gồm: fetch info, quản lý queue, dialog chọn thư mục/file cookie, save dialog, mở thư mục/file, settings, updater yt-dlp, auth Facebook. Đồng thời forward sự kiện `downloadManager` về renderer.

## platformHandler.ts

Interface `PlatformHandler` với `sanitizeUrl`, `getDefaults`, `getExtractArgs` cho từng nền tảng:

- **youtube:** phát hiện playlist thật (param `list` không bắt đầu `RD`, không `start_radio`) → `--flat-playlist --playlist-end 150`, ngược lại `--no-playlist`.
- **soundcloud:** strip query param; KHÔNG dùng `--flat-playlist` (giữ metadata) → `--playlist-end 150`. Default MP3.
- **facebook:** strip tracking, giữ `v`/`story_fbid`/`id`; phân loại reel/watch/videos/group → args phù hợp.
- `detectPlatform(url)` và `getPlatformHandler(platform)`.

## facebookSessionManager.ts

Singleton quản lý phiên đăng nhập Facebook. Session partition `persist:facebook`.

- `isLoggedIn()` — kiểm tra cookie `c_user` + `xs`.
- `openLoginWindow()` — mở cửa sổ login, poll 2s, timeout 10 phút, xuất cookie khi thành công.
- `exportCookiesFile()` — xuất cookie ra `facebook_cookies.txt` (Netscape format).
- `clearSession()` — xóa session + file cookie.
- `isCookiesFileStale()` — file > 60 phút coi là cũ.
- `tryChromeBridge()` — dò trình duyệt hệ thống (chrome/edge/firefox), trả `success`/`locked`/`not-logged-in`/`not-found`.
- `getWorkingCookieArgs()` — chọn nguồn cookie tốt nhất theo thứ tự ưu tiên (xem [03-tinh-nang.md](03-tinh-nang.md) §4). Không bao giờ throw, không tự mở cửa sổ login.

## settingsService.ts

Đọc/ghi `settings.json` trong `userData`, cache in-memory. `loadSettings` merge với `DEFAULT_SETTINGS` (forward-compat). API: `getSettings`, `saveSettings`, `updateSettings`.

## ytDlpUpdater.ts

Cập nhật binary yt-dlp từ GitHub Releases (`yt-dlp/yt-dlp`).

- `checkForUpdates(force)` — so sánh `--version` với tag mới nhất (so sánh chuỗi date-tag), tôn trọng interval.
- `installUpdate(onProgress)` — pause queue → tải `.new` → kiểm kích thước (≥1MB) → rename `.bak`/swap có rollback → resume queue.

## appUpdater.ts

Wrapper `electron-updater`. `autoDownload=false`, `autoInstallOnAppQuit=true`. Phát trạng thái về renderer qua `APP_UPDATE_STATUS` (checking/available/downloading/downloaded/error). API: `checkForAppUpdate`, `downloadAppUpdate`, `installAppUpdate`.
