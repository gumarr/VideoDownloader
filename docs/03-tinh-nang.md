# 03 — Các tính năng đã hoàn thành

Danh sách đầy đủ những gì dự án **đã làm được**, nhóm theo chủ đề.

## 1. Lấy thông tin & nhận diện nền tảng

- ✅ Tự động nhận diện nền tảng từ URL (YouTube / SoundCloud / Facebook) — [platformDetect.ts](../src/renderer/utils/platformDetect.ts) (renderer) và [platformHandler.ts](../src/backend/platformHandler.ts) (backend).
- ✅ Làm sạch URL theo từng nền tảng (strip tracking params: `fbclid`, `utm_*`, `si`, `__cft__`, …).
- ✅ Lấy metadata qua `yt-dlp -J`: tiêu đề, thumbnail, thời lượng (định dạng MM:SS / HH:MM:SS), uploader, danh sách format.
- ✅ Hỗ trợ **playlist**: YouTube (cap 150), SoundCloud (cap 150, giữ metadata), Facebook profile videos (cap 20).
- ✅ Bỏ qua track riêng tư/đã xóa trong playlist và báo cảnh báo (warnings) thay vì fail toàn bộ.

## 2. Hàng đợi tải (Download Queue)

- ✅ Hàng đợi đa task với các trạng thái: `pending`, `queued`, `downloading`, `completed`, `failed`, `cancelled`.
- ✅ Tải **đồng thời** nhiều task, giới hạn cấu hình được (`maxConcurrentDownloads`, 1–5, mặc định 2).
- ✅ Thêm hàng loạt (batch) tất cả mục của playlist vào queue.
- ✅ "Start All Pending" — bắt đầu mọi task đang chờ.
- ✅ Thao tác từng task: start, cancel (kill tiến trình), remove, retry.
- ✅ Dọn dẹp: xóa task đã xong/lỗi/hủy, xóa tất cả.
- ✅ **Khôi phục hàng đợi** sau khi mở lại app (`queue.json`); task đang tải dở được reset về `queued`.
- ✅ Tiến độ thời gian thực: %, đã tải / tổng, tốc độ, ETA.

## 3. Tùy chọn tải

- ✅ Chọn định dạng **MP4** (video) hoặc **MP3** (trích xuất audio chất lượng cao nhất).
- ✅ Chọn chất lượng video (best / 1080p / 720p / … xuống 144p) với filter format theo chiều cao.
- ✅ SoundCloud luôn ép sang MP3.
- ✅ Đặt tên file tùy chỉnh hoặc dùng `%(title)s` mặc định.
- ✅ Merge video+audio sang MP4 bằng ffmpeg.

## 4. Đăng nhập Facebook & cookie

- ✅ Cửa sổ đăng nhập Facebook nhúng (session riêng `persist:facebook`), giữ đăng nhập qua các lần mở app.
- ✅ Phát hiện đăng nhập thành công bằng cookie `c_user` + `xs` (poll mỗi 2s, timeout 10 phút).
- ✅ Xuất cookie ra file Netscape (`facebook_cookies.txt`) cho yt-dlp; tự refresh khi quá 60 phút.
- ✅ Chiến lược cookie nhiều lớp: file đã xuất → cache → dò trình duyệt hệ thống (Chrome/Edge/Firefox) → session nhúng → không cookie (nội dung công khai).
- ✅ Tự hiện prompt đăng nhập khi gặp nội dung yêu cầu xác thực (`FACEBOOK_AUTH_REQUIRED`).
- ✅ Đăng xuất Facebook (xóa session + cookie file).
- ✅ Xử lý riêng lỗi rate-limit (HTTP 429) của Facebook.

### Cookie cho YouTube/SoundCloud
- ✅ Cấu hình nguồn cookie: none / auto / chrome / edge / firefox / file (`cookies.txt`).
- ✅ Tự dò profile trình duyệt đã cài (Default, Profile 1, Profile 2…).
- ✅ Cache cấu hình cookie thành công để không lặp lại vòng thử.
- ✅ Thông báo lỗi thân thiện (bot detection, DB locked, không đọc được cookie…).

## 5. Cập nhật

- ✅ **Tự cập nhật ứng dụng** qua electron-updater + GitHub Releases (kiểm tra khi khởi động, người dùng quyết định tải/cài).
- ✅ **Tự cập nhật binary yt-dlp** từ GitHub Releases của yt-dlp: tải về `.new`, kiểm tra kích thước, swap an toàn có rollback (`.bak`).
- ✅ Tạm dừng hàng đợi khi cập nhật binary (để Windows nhả file lock), resume sau khi xong.
- ✅ Giãn cách kiểm tra cập nhật (mặc định 24h), bỏ qua phiên bản cụ thể (skip).

## 6. Cài đặt (Settings)

- ✅ Chế độ lưu: "Hỏi mỗi lần" (save dialog) hoặc "Thư mục mặc định".
- ✅ Nhớ thư mục lưu gần nhất.
- ✅ Số lượng tải đồng thời, tùy chọn cập nhật, nguồn cookie.
- ✅ Lưu/đọc bền vững qua `settings.json`, merge với default để tương thích ngược.

## 7. Giao diện & trải nghiệm

- ✅ Giao diện React + Tailwind, **dark/light theme** (nhớ lựa chọn, theo hệ thống).
- ✅ Sidebar chọn nền tảng, ô nhập URL có nút Paste.
- ✅ Hiển thị tiến độ tải trực quan (ProgressBar), thumbnail, thông tin video.
- ✅ Mở thư mục chứa file / mở file sau khi tải xong.
- ✅ Thông báo lỗi/cảnh báo với hành động (Try Again, mở Settings).
- ✅ Debug Panel và modal cập nhật.
- ✅ Hiển thị phiên bản app ở footer.

## 8. An toàn & ổn định

- ✅ Context isolation, IPC whitelist (xem [02-kien-truc.md](02-kien-truc.md)).
- ✅ Ép UTF-8 khi spawn yt-dlp để xử lý tên file Unicode.
- ✅ Giải quyết đường dẫn file output qua nhiều cơ chế dự phòng (expected path → stdout → quét thư mục).
- ✅ Tránh circular dependency bằng lazy import (`facebookSessionManager` ↔ `ytDlpService`).
