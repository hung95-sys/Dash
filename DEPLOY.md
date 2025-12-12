# 🚀 Hướng dẫn Deploy ứng dụng lên Server

Hướng dẫn chi tiết để deploy ứng dụng Flask từ GitHub lên server Linux (Ubuntu/Debian).

## 📋 Yêu cầu

- Server Linux (Ubuntu 20.04+ hoặc Debian 11+)
- Python 3.7+
- Git
- Quyền sudo

## 🔧 Cài đặt ban đầu trên Server

### 1. Cài đặt các package cần thiết

```bash
sudo apt update
sudo apt install -y python3 python3-pip python3-venv git nginx
```

### 2. Tạo thư mục cho ứng dụng

```bash
sudo mkdir -p /var/www/dash
sudo chown -R $USER:$USER /var/www/dash
```

## 📥 Deploy từ GitHub

### Cách 1: Deploy thủ công

```bash
# Tạo thư mục và clone repository
cd /var/www
sudo git clone https://github.com/hung95-sys/Dash.git dash
cd dash

# Kiểm tra cấu trúc thư mục
ls -la
# Nếu thấy thư mục Dash (chữ D hoa), cần vào Dash/Home
# Nếu thấy thư mục Home trực tiếp, vào Home

# Trường hợp 1: Có thư mục Dash bên trong
cd Dash/Home

# Hoặc nếu muốn di chuyển lên cấp trên (khuyến nghị):
# cd /var/www/dash
# sudo mv Dash/* Dash/.* . 2>/dev/null || true
# sudo rmdir Dash
# cd Home

# Tạo virtual environment
python3 -m venv venv
source venv/bin/activate

# Cài đặt dependencies
pip install --upgrade pip
pip install -r requirements.txt
```

### Cách 2: Sử dụng script tự động

```bash
# Copy file deploy.sh lên server
# Cho phép thực thi
chmod +x deploy.sh

# Chạy script
./deploy.sh
```

## ⚙️ Cấu hình ứng dụng

### 1. Tạo file `.env`

```bash
cd /var/www/dash/Home
nano .env
```

Nội dung file `.env`:

```env
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
SECRET_KEY=your_very_secure_secret_key_here
DEBUG=False
LOGIN_USERNAME=admin
LOGIN_PASSWORD=your_secure_password_here
```

**Lưu ý quan trọng:**
- `SECRET_KEY`: Tạo một chuỗi ngẫu nhiên mạnh (có thể dùng: `python -c "import secrets; print(secrets.token_hex(32))"`)
- `DEBUG`: Đặt `False` khi deploy production
- `LOGIN_PASSWORD`: Đặt mật khẩu mạnh

### 2. Upload file `credentials.json`

Upload file `credentials.json` (từ Google Cloud Console) vào thư mục `/var/www/dash/Home/`:

```bash
# Sử dụng scp từ máy local
scp credentials.json user@your-server:/var/www/dash/Home/

# Hoặc sử dụng SFTP, hoặc tạo trực tiếp trên server
nano /var/www/dash/Home/credentials.json
```

## 🔄 Tạo Systemd Service

### 1. Copy file service

```bash
sudo cp dash-app.service /etc/systemd/system/
```

### 2. Chỉnh sửa file service (nếu cần)

```bash
sudo nano /etc/systemd/system/dash-app.service
```

Điều chỉnh:
- `User` và `Group`: Thay đổi nếu không dùng `www-data`
- `WorkingDirectory`: Đường dẫn đến thư mục Home
- `ExecStart`: Đường dẫn đến Python và app.py

### 3. Khởi động service

```bash
# Reload systemd
sudo systemctl daemon-reload

# Enable service (tự động khởi động khi reboot)
sudo systemctl enable dash-app

# Start service
sudo systemctl start dash-app

# Kiểm tra trạng thái
sudo systemctl status dash-app
```

### 4. Xem logs

```bash
# Xem logs real-time
sudo journalctl -u dash-app -f

# Xem logs gần đây
sudo journalctl -u dash-app -n 50
```

## 🌐 Cấu hình Nginx (Reverse Proxy)

### 1. Tạo file cấu hình Nginx

```bash
sudo nano /etc/nginx/sites-available/dash
```

Nội dung:

```nginx
server {
    listen 80;
    server_name your-domain.com;  # Thay bằng domain của bạn

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # WebSocket support (nếu cần)
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    # Tăng timeout cho các request lớn
    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
```

### 2. Kích hoạt site

```bash
# Tạo symbolic link
sudo ln -s /etc/nginx/sites-available/dash /etc/nginx/sites-enabled/

# Test cấu hình Nginx
sudo nginx -t

# Restart Nginx
sudo sudo systemctl restart nginx
```

### 3. Cấu hình SSL với Let's Encrypt (Tùy chọn nhưng khuyến nghị)

```bash
# Cài đặt Certbot
sudo apt install certbot python3-certbot-nginx

# Lấy certificate
sudo certbot --nginx -d your-domain.com

# Certbot sẽ tự động cấu hình SSL và renew
```

## 🔄 Cập nhật ứng dụng

Khi có code mới trên GitHub:

```bash
cd /var/www/dash
git pull origin main

cd Home
source venv/bin/activate
pip install -r requirements.txt  # Nếu có dependencies mới

sudo systemctl restart dash-app
```

Hoặc sử dụng script:

```bash
./deploy.sh
```

## 🔒 Bảo mật

### 1. Firewall

```bash
# Cho phép SSH, HTTP, HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Bật firewall
sudo ufw enable
```

### 2. File permissions

```bash
# Đảm bảo file nhạy cảm có quyền phù hợp
chmod 600 /var/www/dash/Home/.env
chmod 600 /var/www/dash/Home/credentials.json
```

## 🐛 Troubleshooting

### Lỗi "cd: Home: No such file or directory"

**Nguyên nhân:** Repository chưa được clone đúng cách hoặc đang ở sai thư mục. Git có thể tạo thư mục `Dash` (chữ D hoa) bên trong `dash`.

**Cách khắc phục:**

```bash
# Kiểm tra bạn đang ở đâu
pwd
# Phải là /var/www/dash

# Kiểm tra cấu trúc thư mục
ls -la

# Trường hợp 1: Thấy thư mục Dash (chữ D hoa)
cd Dash/Home  # Vào đúng thư mục

# Trường hợp 2: Muốn di chuyển lên cấp trên để tránh nhầm lẫn
cd /var/www/dash
sudo mv Dash/* Dash/.* . 2>/dev/null || true  # Di chuyển tất cả
sudo rmdir Dash  # Xóa thư mục Dash trống
cd Home  # Bây giờ vào được

# Trường hợp 3: Không thấy gì cả, clone lại:
cd /var/www
sudo rm -rf dash
sudo git clone https://github.com/hung95-sys/Dash.git dash
cd dash
ls -la  # Kiểm tra cấu trúc
# Nếu thấy Dash, vào Dash/Home
# Nếu thấy Home, vào Home
```

### Ứng dụng không chạy

```bash
# Kiểm tra logs
sudo journalctl -u dash-app -n 100

# Kiểm tra port có đang được sử dụng không
sudo netstat -tlnp | grep 5001

# Test chạy thủ công
cd /var/www/dash/Home
source venv/bin/activate
python app.py
```

### Lỗi kết nối Google Sheets

- Kiểm tra file `credentials.json` có tồn tại và đúng định dạng
- Kiểm tra Google Sheet đã share với service account email
- Kiểm tra biến môi trường `GOOGLE_SHEETS_SPREADSHEET_ID` trong `.env`

### Nginx không proxy được

```bash
# Kiểm tra Nginx logs
sudo tail -f /var/log/nginx/error.log

# Kiểm tra ứng dụng có chạy trên port 5001 không
curl http://127.0.0.1:5001
```

## 📝 Checklist Deploy

- [ ] Cài đặt Python, pip, git, nginx
- [ ] Clone repository từ GitHub
- [ ] Tạo virtual environment và cài dependencies
- [ ] Tạo file `.env` với các biến môi trường
- [ ] Upload file `credentials.json`
- [ ] Tạo và khởi động systemd service
- [ ] Cấu hình Nginx reverse proxy
- [ ] Cấu hình SSL (Let's Encrypt)
- [ ] Cấu hình firewall
- [ ] Test ứng dụng hoạt động
- [ ] Thiết lập backup định kỳ

## 🔄 Tự động hóa với GitHub Actions (Tùy chọn)

Xem file `.github/workflows/deploy.yml` để thiết lập tự động deploy khi push code lên GitHub.

