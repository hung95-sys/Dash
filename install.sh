#!/bin/bash
# Script tự động deploy ứng dụng Dash từ GitHub
# Sử dụng: wget -O - https://raw.githubusercontent.com/hung95-sys/Dash/main/install.sh | bash

set -e  # Dừng nếu có lỗi

echo "🚀 Bắt đầu cài đặt tự động ứng dụng Dash..."
echo ""

# Màu sắc cho output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Kiểm tra quyền root
if [ "$EUID" -ne 0 ]; then 
    echo -e "${RED}⚠️  Vui lòng chạy với quyền sudo${NC}"
    exit 1
fi

# Cấu hình
APP_DIR="/var/www/dash"
REPO_URL="https://github.com/hung95-sys/Dash.git"
BRANCH="main"
SERVICE_NAME="dash-app"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}.service"

# Cài đặt các package cần thiết
echo -e "${GREEN}📦 Đang cài đặt các package cần thiết...${NC}"
apt update -qq
apt install -y python3 python3-pip python3-venv git nginx curl > /dev/null 2>&1

# Tạo thư mục ứng dụng
echo -e "${GREEN}📁 Tạo thư mục ứng dụng...${NC}"
mkdir -p $APP_DIR
cd $APP_DIR

# Clone repository
if [ -d ".git" ]; then
    echo -e "${YELLOW}📥 Pull code mới nhất...${NC}"
    git pull origin $BRANCH > /dev/null 2>&1
elif [ -d "Dash/.git" ]; then
    echo -e "${YELLOW}📥 Pull code từ thư mục Dash...${NC}"
    cd Dash
    git pull origin $BRANCH > /dev/null 2>&1
    cd ..
else
    echo -e "${GREEN}📥 Clone repository từ GitHub...${NC}"
    git clone $REPO_URL . > /dev/null 2>&1
fi

# Xử lý trường hợp có thư mục Dash bên trong
if [ -d "Dash" ] && [ ! -d "Home" ]; then
    echo -e "${YELLOW}📦 Đang di chuyển nội dung từ Dash...${NC}"
    mv Dash/* Dash/.* . 2>/dev/null || true
    rmdir Dash 2>/dev/null || true
fi

# Xác định đường dẫn Home
if [ -d "Home" ]; then
    HOME_DIR="$APP_DIR/Home"
elif [ -d "Dash/Home" ]; then
    HOME_DIR="$APP_DIR/Dash/Home"
else
    echo -e "${RED}❌ Không tìm thấy thư mục Home!${NC}"
    exit 1
fi

cd $HOME_DIR

# Tạo virtual environment
echo -e "${GREEN}🐍 Tạo virtual environment...${NC}"
if [ ! -d "venv" ]; then
    python3 -m venv venv
fi

# Cài đặt dependencies
echo -e "${GREEN}📦 Cài đặt Python dependencies...${NC}"
source venv/bin/activate
pip install --upgrade pip -q > /dev/null 2>&1
pip install -r requirements.txt -q > /dev/null 2>&1
deactivate

# Tạo file .env nếu chưa có
if [ ! -f ".env" ]; then
    echo -e "${YELLOW}📝 Tạo file .env mẫu...${NC}"
    SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_hex(32))" 2>/dev/null || openssl rand -hex 32)
    cat > .env << EOF
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=
SECRET_KEY=$SECRET_KEY
DEBUG=False
LOGIN_USERNAME=admin
LOGIN_PASSWORD=changeme123
EOF
    chmod 600 .env
    echo -e "${YELLOW}⚠️  Đã tạo file .env mẫu. Vui lòng chỉnh sửa với thông tin của bạn!${NC}"
fi

# Tạo systemd service
echo -e "${GREEN}⚙️  Tạo systemd service...${NC}"
cat > $SERVICE_FILE << EOF
[Unit]
Description=Dash Flask Application
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=$HOME_DIR
Environment="PATH=$HOME_DIR/venv/bin"
ExecStart=$HOME_DIR/venv/bin/python $HOME_DIR/app.py
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=dash-app

[Install]
WantedBy=multi-user.target
EOF

# Reload systemd và khởi động service
systemctl daemon-reload
systemctl enable $SERVICE_NAME > /dev/null 2>&1

# Tạo thư mục data nếu chưa có
DATA_DIR="$HOME_DIR/data"
mkdir -p $DATA_DIR
chown -R www-data:www-data $DATA_DIR

# Kiểm tra và tạo file xlsx mẫu nếu chưa có
if [ ! -f "$DATA_DIR/export_all.xlsx" ]; then
    echo -e "${YELLOW}📊 Tạo file xlsx mẫu...${NC}"
    source venv/bin/activate
    python3 << PYTHON_EOF
import os
from openpyxl import Workbook

data_dir = "$DATA_DIR"
xlsx_path = os.path.join(data_dir, 'export_all.xlsx')

if not os.path.exists(xlsx_path):
    wb = Workbook()
    wb.remove(wb.active)  # Xóa sheet mặc định
    wb.save(xlsx_path)
    print(f"Đã tạo file xlsx tại: {xlsx_path}")
PYTHON_EOF
    deactivate
    chown www-data:www-data "$DATA_DIR/export_all.xlsx"
    echo -e "${GREEN}✅ File xlsx đã được tạo tại: $DATA_DIR/export_all.xlsx${NC}"
    echo -e "${YELLOW}   Bạn có thể upload file xlsx có sẵn để thay thế file này${NC}"
fi

# Thông báo về credentials.json (không bắt buộc nếu chỉ dùng file xlsx)
if [ ! -f "credentials.json" ]; then
    echo -e "${GREEN}ℹ️  Ứng dụng sẽ chạy ở chế độ offline với file xlsx local${NC}"
    echo -e "${GREEN}   File credentials.json KHÔNG BẮT BUỘC nếu chỉ dùng file xlsx${NC}"
    echo -e "${YELLOW}   Nếu muốn đồng bộ với Google Sheets, upload credentials.json vào: $HOME_DIR${NC}"
else
    echo -e "${GREEN}✅ Đã tìm thấy file credentials.json${NC}"
fi

# Tạo file cấu hình Nginx mẫu
echo -e "${GREEN}🌐 Tạo cấu hình Nginx mẫu...${NC}"
cat > /etc/nginx/sites-available/dash << 'NGINX_EOF'
server {
    listen 80;
    server_name _;  # Thay bằng domain của bạn

    location / {
        proxy_pass http://127.0.0.1:5001;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }

    proxy_connect_timeout 60s;
    proxy_send_timeout 60s;
    proxy_read_timeout 60s;
}
NGINX_EOF

# Kích hoạt site Nginx
if [ ! -L "/etc/nginx/sites-enabled/dash" ]; then
    ln -s /etc/nginx/sites-available/dash /etc/nginx/sites-enabled/
fi

# Test và restart Nginx
nginx -t > /dev/null 2>&1 && systemctl restart nginx > /dev/null 2>&1 || echo -e "${YELLOW}⚠️  Nginx chưa được cấu hình đúng, vui lòng kiểm tra lại${NC}"

# Khởi động service
echo -e "${GREEN}🔄 Khởi động service...${NC}"
systemctl restart $SERVICE_NAME > /dev/null 2>&1

# Chờ một chút để service khởi động
sleep 2

# Kiểm tra trạng thái
if systemctl is-active --quiet $SERVICE_NAME; then
    echo -e "${GREEN}✅ Cài đặt hoàn tất!${NC}"
    echo ""
    echo "📋 Thông tin quan trọng:"
    echo "   - Thư mục ứng dụng: $HOME_DIR"
    echo "   - File .env: $HOME_DIR/.env"
    echo "   - Service: $SERVICE_NAME"
    echo ""
    echo "📝 Các bước tiếp theo:"
    echo "   1. Chỉnh sửa file .env: nano $HOME_DIR/.env"
    echo "      (Đặt LOGIN_PASSWORD mạnh hơn)"
    echo "   2. Upload file xlsx vào: $HOME_DIR/data/export_all.xlsx (nếu có)"
    echo "   3. (Tùy chọn) Upload credentials.json nếu muốn đồng bộ Google Sheets"
    echo "   4. Chỉnh sửa Nginx config: nano /etc/nginx/sites-available/dash"
    echo "      (Thay 'server_name _;' bằng domain của bạn)"
    echo "   5. Restart service: systemctl restart $SERVICE_NAME"
    echo "   6. Restart Nginx: systemctl restart nginx"
    echo ""
    echo "🔍 Kiểm tra logs:"
    echo "   journalctl -u $SERVICE_NAME -f"
    echo ""
    echo "🌐 Ứng dụng đang chạy tại: http://$(hostname -I | awk '{print $1}'):5001"
else
    echo -e "${RED}❌ Service không khởi động được. Kiểm tra logs:${NC}"
    echo "   journalctl -u $SERVICE_NAME -n 50"
    exit 1
fi

