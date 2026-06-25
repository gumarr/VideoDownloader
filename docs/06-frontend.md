# 06 — Frontend (Renderer)

Giao diện React đặt tại `src/renderer/`. Entry: [main.tsx](../src/renderer/main.tsx) → [App.tsx](../src/renderer/App.tsx). Styling bằng Tailwind CSS (`index.css`).

## App.tsx — component gốc

Quản lý state toàn cục và điều phối luồng:

- **Theme:** dark/light, nhớ qua `localStorage`, mặc định theo `prefers-color-scheme`.
- **URL & fetch:** state `url`, `isFetching`, `error`, `warning`; `handleFetch()` làm sạch URL, gọi `detectPlatform`, gọi `fetchVideoInfo`, rồi `addTasks`.
- **Platform:** chọn nền tảng (sidebar), tự đổi theo URL nhận diện được.
- **Facebook auth:** `facebookLoggedIn`, `needsFacebookAuth`; xử lý login/logout, tự retry fetch sau khi login.
- **Queue:** subscribe `onQueueUpdate` + `onTaskProgress`, load `getQueue()` ban đầu.
- **Updater:** kiểm tra cập nhật yt-dlp khi mount (tôn trọng `skippedUpdateVersion`).
- **App version:** lấy qua `getAppVersion()`, hiển thị ở footer.

Các handler chính: `handleFetch`, `handleStartTask`, `handleStartAllPending`, `handleUpdateTask`, `handleCancelTask`, `handleRemoveTask`, `handleRetryTask`, `handleOpenFolder`, `handleOpenFile`, `handleClearCompleted`, `handleClearAllTasks`, `handleFacebookLogin`, `handleFacebookLogout`.

## Components (`src/renderer/components/`)

| Component | Vai trò |
|-----------|---------|
| `UrlInput.tsx` | Ô nhập URL + nút Paste + nút Fetch |
| `DownloadQueue.tsx` | Danh sách task, các nút thao tác từng task & toàn cục |
| `DownloadOptions.tsx` | Chọn format (MP4/MP3) và chất lượng cho task |
| `VideoInfo.tsx` | Hiển thị thông tin video (tiêu đề, thumbnail, thời lượng) |
| `ProgressBar.tsx` | Thanh tiến độ tải (%, tốc độ, ETA) |
| `FileNamePreview.tsx` | Xem trước tên file đầu ra |
| `SettingsPanel.tsx` | Bảng cài đặt (save mode, đồng thời, cookie, update) |
| `FacebookAuthPrompt.tsx` | Prompt kết nối/đăng xuất Facebook |
| `ThemeToggle.tsx` | Nút chuyển dark/light |
| `UpdateModal.tsx` | Modal cập nhật binary yt-dlp |
| `AppUpdateModal.tsx` | Modal cập nhật ứng dụng (electron-updater) |
| `DebugPanel.tsx` | Bảng debug (chỉ hiện khi chạy trong Electron) |

## Utils

- [platformDetect.ts](../src/renderer/utils/platformDetect.ts) — nhận diện nền tảng phía renderer (bản an toàn, không phụ thuộc Node).

## Phát hiện môi trường

`hasElectronAPI = !!window.api` — UI hoạt động cả khi chạy trong trình duyệt (dev) nhưng vô hiệu hóa các thao tác cần backend; footer hiển thị "Running in Electron" / "Running in browser".
