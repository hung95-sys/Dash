"""
Cấu hình cho ứng dụng
"""
import os
from dotenv import load_dotenv

load_dotenv()

# Google Sheets Configuration
GOOGLE_SHEETS_CREDENTIALS_FILE = os.getenv('GOOGLE_SHEETS_CREDENTIALS_FILE', 'credentials.json')
GOOGLE_SHEETS_SPREADSHEET_ID = os.getenv('GOOGLE_SHEETS_SPREADSHEET_ID', '')

# Sheet names
SHEET_NAME_INCOME_EXPENSE = os.getenv('SHEET_NAME_INCOME_EXPENSE', 'ThuChi')
# Trang tính Danh mục: đặt mặc định "Danh Mục" (có dấu, có khoảng trắng)
SHEET_NAME_CATEGORIES = os.getenv('SHEET_NAME_CATEGORIES', 'Danh Mục')
# Accounts sheet
SHEET_NAME_ACCOUNTS = os.getenv('SHEET_NAME_ACCOUNTS', 'Accounts')

# Category columns mapping (column letters trong sheet DanhMuc)
# Mặc định theo hình: A = Danh mục thu, B = Danh mục chi
CATEGORY_COLUMNS = {
    'Thu': os.getenv('CATEGORY_COLUMN_THU', 'A'),
    'Chi': os.getenv('CATEGORY_COLUMN_CHI', 'B'),
}

# Flask Configuration
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret-key-change-in-production')
DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'

# Simple login credentials (nên cấu hình qua biến môi trường khi lên server)
LOGIN_USERNAME = os.getenv('LOGIN_USERNAME', 'admin')
LOGIN_PASSWORD = os.getenv('LOGIN_PASSWORD', 'changeme')
