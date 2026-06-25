# 05 — IPC & Preload

## Single source of truth

Mọi tên kênh IPC và type dùng chung định nghĩa tại [src/types/ipc.ts](../src/types/ipc.ts). Renderer và main đều import từ đây để tránh lệch tên kênh.

## window.api (preload)

[preload.ts](../src/preload/preload.ts) expose object `window.api` qua `contextBridge`. Đây là **giao diện duy nhất** renderer dùng để gọi backend. Khai báo type tại [electron.d.ts](../src/types/electron.d.ts).

## Bảng các kênh IPC

### Renderer → Main (invoke, có trả về)

| `window.api.*` | Kênh | Tác dụng |
|----------------|------|----------|
| `fetchVideoInfo` | `FETCH_VIDEO_INFO` | Lấy metadata video |
| `addDownload` | `ADD_DOWNLOAD` | Thêm 1 download (xử lý save dialog) |
| `addTasks` | `ADD_TASKS` | Thêm hàng loạt task (pending) |
| `startTask` | `START_TASK` | Bắt đầu 1 task |
| `updateTask` | `UPDATE_TASK` | Đổi format/quality |
| `cancelTask` | `CANCEL_TASK` | Hủy task |
| `removeTask` | `REMOVE_TASK` | Xóa task |
| `retryTask` | `RETRY_TASK` | Thử lại |
| `getQueue` | `GET_QUEUE` | Lấy snapshot hàng đợi |
| `clearCompleted` | `CLEAR_COMPLETED` | Xóa task đã xong/lỗi/hủy |
| `clearAllTasks` | `CLEAR_ALL_TASKS` | Xóa toàn bộ |
| `selectDirectory` | `SELECT_DIRECTORY` | Hộp thoại chọn thư mục |
| `showSaveDialog` | `SHOW_SAVE_DIALOG` | Hộp thoại lưu file |
| `openFolder` / `openFile` | `OPEN_FOLDER` / `OPEN_FILE` | Mở thư mục / file |
| `getSettings` / `saveSettings` | `GET_SETTINGS` / `SAVE_SETTINGS` | Cài đặt |
| `selectCookieFile` | `SELECT_COOKIE_FILE` | Chọn file cookies.txt |
| `checkForUpdates` / `installUpdate` / `skipUpdate` | `CHECK_YT_DLP_UPDATE` / `INSTALL_YT_DLP_UPDATE` / `SKIP_UPDATE` | Updater yt-dlp |
| `restartApp` | `RESTART_APP` | Khởi động lại app |
| `appUpdateCheck` / `appUpdateDownload` / `appUpdateInstall` | `APP_UPDATE_*` | Updater ứng dụng |
| `getAppVersion` | `GET_APP_VERSION` | Lấy version |
| `getFacebookAuthStatus` / `facebookLogin` / `facebookLogout` | `FACEBOOK_AUTH_STATUS` / `FACEBOOK_LOGIN` / `FACEBOOK_LOGOUT` | Auth Facebook |

### Main → Renderer (push events)

| `window.api.*` (đăng ký listener) | Kênh | Tác dụng |
|-----------------------------------|------|----------|
| `onQueueUpdate` | `QUEUE_UPDATE` | Snapshot hàng đợi mới |
| `onTaskProgress` | `TASK_PROGRESS` | Tiến độ từng task |
| `onAppUpdateStatus` | `APP_UPDATE_STATUS` | Trạng thái cập nhật app |
| `installUpdate` (progress) | `INSTALL_YT_DLP_UPDATE-progress` | Tiến độ tải binary |

> Các listener trả về hàm `unsubscribe` để gỡ trong cleanup của `useEffect`.

## Type dùng chung quan trọng (ipc.ts)

- `SupportedPlatform` = `'youtube' | 'soundcloud' | 'facebook'`
- `VideoMetadata`, `VideoFormat` — kết quả fetch
- `DownloadOptions`, `DownloadProgress`, `DownloadTaskProgress`
- `DownloadTask` — task trong hàng đợi (kèm `status`, `progress`, `addedAt`)
- `AppSettings` — cấu hình người dùng
