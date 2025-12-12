#!/bin/bash
# Script deploy ứng dụng Flask từ GitHub

set -e  # Dừng nếu có lỗi

echo "🚀 Bắt đầu deploy ứng dụng..."

# Cấu hình
APP_DIR="/var/www/dash"
REPO_URL="https://github.com/hung95-sys/Dash.git"
BRANCH="main"
SERVICE_NAME="dash-app"

# Tạo thư mục nếu chưa có
if [ ! -d "$APP_DIR" ]; then
    echo "📁 Tạo thư mục $APP_DIR..."
    sudo mkdir -p $APP_DIR
    sudo chown -R $USER:$USER $APP_DIR
fi

cd $APP_DIR

# Clone hoặc pull code mới nhất
if [ -d ".git" ]; then
    echo "📥 Pull code mới nhất từ GitHub..."
    git pull origin $BRANCH
else
    echo "📥 Clone repository từ GitHub..."
    if [ "$(ls -A $APP_DIR)" ]; then
        echo "⚠️  Thư mục không trống. Đang xóa và clone lại..."
        cd ..
        sudo rm -rf $APP_DIR
        sudo mkdir -p $APP_DIR
        sudo chown -R $USER:$USER $APP_DIR
    fi
    git clone $REPO_URL $APP_DIR
fi

# Di chuyển vào thư mục Home
cd Home

# Tạo virtual environment nếu chưa có
if [ ! -d "venv" ]; then
    echo "🐍 Tạo virtual environment..."
    python3 -m venv venv
fi

# Kích hoạt virtual environment và cài đặt dependencies
echo "📦 Cài đặt dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

# Kiểm tra file .env
if [ ! -f ".env" ]; then
    echo "⚠️  File .env chưa tồn tại. Vui lòng tạo file .env với các biến môi trường cần thiết."
    echo "📝 Tạo file .env mẫu..."
    cat > .env.example << EOF
GOOGLE_SHEETS_CREDENTIALS_FILE=credentials.json
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
SECRET_KEY=your_secret_key_here_change_in_production
DEBUG=False
LOGIN_USERNAME=admin
LOGIN_PASSWORD=your_secure_password_here
EOF
    echo "✅ Đã tạo file .env.example. Vui lòng copy thành .env và điền thông tin."
fi

# Kiểm tra file credentials.json
if [ ! -f "credentials.json" ]; then
    echo "⚠️  File credentials.json chưa tồn tại. Vui lòng upload file credentials.json vào thư mục này."
fi

# Restart service
echo "🔄 Khởi động lại service..."
sudo systemctl restart $SERVICE_NAME || echo "⚠️  Service chưa được tạo. Chạy lệnh sau để tạo service:"
echo "   sudo systemctl enable $SERVICE_NAME"
echo "   sudo systemctl start $SERVICE_NAME"

echo "✅ Deploy hoàn tất!"
echo "📊 Kiểm tra trạng thái: sudo systemctl status $SERVICE_NAME"
echo "📝 Xem logs: sudo journalctl -u $SERVICE_NAME -f"

