# Trang Web Cá Nhân - Personal Website

Ứng dụng web quản lý cá nhân được xây dựng bằng Python Flask, tích hợp Google Sheets để lưu trữ dữ liệu. Giao diện responsive, tối ưu cho cả PC và mobile.

## Tính năng

- ✅ **Dashboard**: Trang tổng quan với thống kê thu chi
- ✅ **Quản lý Thu Chi**: Thêm, xem, xóa giao dịch thu chi
- 🔄 **Tính năng khác**: Đang phát triển (Ghi chú, Lịch, ...)

## 📚 Hướng dẫn chi tiết

👉 **Xem file [HUONG_DAN_SETUP.md](HUONG_DAN_SETUP.md) để có hướng dẫn thiết lập Google Sheets API từng bước chi tiết!**

## Yêu cầu hệ thống

- Python 3.7+
- Tài khoản Google với Google Sheets API enabled
- File credentials.json từ Google Cloud Console

## Cài đặt

### 1. Clone hoặc tải project

```bash
cd F:\Home
```

### 2. Cài đặt dependencies

```bash
pip install -r requirements.txt
```

### 3. Thiết lập Google Sheets API

1. Truy cập [Google Cloud Console](https://console.cloud.google.com/)
2. Tạo project mới hoặc chọn project hiện có
3. Enable Google Sheets API và Google Drive API
4. Tạo Service Account:
   - Vào "IAM & Admin" > "Service Accounts"
   - Tạo service account mới
   - Tải file JSON credentials
   - Đổi tên file thành `credentials.json` và đặt vào thư mục gốc của project

### 4. Tạo Google Sheet

1. Tạo một Google Sheet mới
2. Chia sẻ sheet với email của service account (tìm trong file credentials.json, field `client_email`)
3. Copy Spreadsheet ID từ URL (phần giữa `/d/` và `/edit`)
4. Tạo file `.env` trong thư mục gốc:

```env
GOOGLE_SHEETS_SPREADSHEET_ID=your_spreadsheet_id_here
SECRET_KEY=your_secret_key_here
DEBUG=True
```

Hoặc bạn có thể để trống `GOOGLE_SHEETS_SPREADSHEET_ID`, hệ thống sẽ tự động tạo sheet mới.

### 5. Chạy ứng dụng

```bash
python app.py
```

Mở trình duyệt và truy cập: `http://localhost:5000`

## Cấu trúc dự án

```
Home/
├── app.py                 # File chính của ứng dụng Flask
├── config.py              # Cấu hình ứng dụng
├── sheets_manager.py      # Module quản lý Google Sheets
├── requirements.txt       # Dependencies
├── credentials.json       # Google Service Account credentials (không commit)
├── .env                  # Biến môi trường (không commit)
├── templates/
│   ├── Home.html         # Trang dashboard
│   └── thu_chi.html      # Trang quản lý thu chi
└── static/
    └── css/
        └── style.css     # Stylesheet responsive
```

## Sử dụng

### Thêm giao dịch thu chi

1. Vào trang "Thu Chi"
2. Click "➕ Thêm giao dịch"
3. Điền thông tin:
   - **Loại**: Thu hoặc Chi
   - **Danh mục**: Tên danh mục (ví dụ: Lương, Ăn uống, Mua sắm...)
   - **Số tiền**: Số tiền giao dịch
   - **Ghi chú**: (Tùy chọn)
   - Nếu chọn **Quỹ**: Chọn quỹ từ danh sách
4. Click "Thêm"

### Danh mục động

- Các danh mục Thu/Chi được lấy trực tiếp từ sheet `DanhMuc`
- Mặc định ứng dụng đọc các cột:
  - `A`: Danh mục thu
  - `B`: Danh mục chi
- Chỉ cần nhập danh mục ở các cột này, giao diện sẽ tự động cập nhật

### Xóa giao dịch

1. Tìm giao dịch cần xóa
2. Click nút "🗑️ Xóa"
3. Xác nhận xóa

## Phát triển thêm tính năng

Để thêm tính năng mới:

1. **Thêm route mới trong `app.py`**:
```python
@app.route('/tinh-nang-moi')
def tinh_nang_moi():
    return render_template('tinh_nang_moi.html')
```

2. **Tạo template HTML trong `templates/`**

3. **Thêm API endpoints nếu cần** trong `app.py`

4. **Thêm methods trong `sheets_manager.py`** nếu cần thao tác với Sheets

5. **Cập nhật navigation** trong các template HTML

## Lưu ý bảo mật

- ⚠️ **KHÔNG** commit file `credentials.json` và `.env` lên Git
- Thêm vào `.gitignore`:
```
credentials.json
.env
__pycache__/
*.pyc
```

## 🔍 Debug

Nếu dữ liệu không load được dù đã có trong Google Sheets, xem file [DEBUG_GUIDE.md](DEBUG_GUIDE.md) để debug chi tiết.

## Troubleshooting

### Lỗi "Không thể kết nối Google Sheets"

**Nguyên nhân phổ biến:**
1. File `credentials.json` không tìm thấy hoặc sai vị trí
2. Service Account chưa được share quyền với Google Sheet
3. Google Sheets API hoặc Google Drive API chưa được enable

**Cách khắc phục:**
1. Kiểm tra file `credentials.json` có trong thư mục gốc (cùng cấp với `app.py`)
2. Mở file `credentials.json`, tìm email trong `"client_email"`
3. Mở Google Sheet, click "Share" → Thêm email đó với quyền "Editor"
4. Kiểm tra trong Google Cloud Console:
   - Google Sheets API đã được enable
   - Google Drive API đã được enable

👉 **Xem file [HUONG_DAN_SETUP.md](HUONG_DAN_SETUP.md) để có hướng dẫn chi tiết từng bước!**

### Lỗi import module
- Chạy `pip install -r requirements.txt` lại
- Kiểm tra Python version >= 3.7
- Thử cài từng package: `pip install Flask gspread google-auth google-auth-oauthlib google-auth-httplib2 python-dotenv`

## License

MIT License - Tự do sử dụng và chỉnh sửa

