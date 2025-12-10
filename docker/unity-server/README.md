# Unity dedicated server image

Dockerfile này đóng gói build headless từ Unity để API matchmaking có thể spawn container qua `ROOM_DOCKER_IMAGE` (mặc định: `banculi/unity-dedicated:latest`).

## Chuẩn bị build
1. Xuất bản build dedicated/ headless từ Unity.
2. Copy toàn bộ output (ví dụ: `BanCuLiServer.x86_64`, thư mục `BanCuLiServer_Data`, các file phụ) vào thư mục `docker/unity-server/build/`. Thư mục đã có sẵn `.gitkeep` để không đẩy binary lên repo.

## Build image
```bash
docker build -f docker/unity-server/Dockerfile -t banculi/unity-dedicated:latest .
```

## Dùng cùng API
* API sẽ chạy `docker run` với image ở biến môi trường `ROOM_DOCKER_IMAGE` (khớp tag ở trên) và map port host theo `ROOM_CONTAINER_PORT` (mặc định 27015).
* Tham số khởi động server có thể tùy biến bằng `ROOM_SERVER_ARGS`; mặc định log được đẩy ra stdout để xem bằng `docker logs`.
* Nếu cần đẩy lên registry riêng, hãy đổi tag khi build rồi set lại `ROOM_DOCKER_IMAGE` cho API.
