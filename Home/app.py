"""
Ứng dụng web quản lý cá nhân
"""
from flask import Flask, render_template, request, jsonify, redirect, url_for, abort, send_file
from flask_login import (
    LoginManager,
    UserMixin,
    login_user,
    logout_user,
    login_required,
    current_user,
)
from flask_wtf import CSRFProtect
from sheets_manager import get_sheets_manager
from config import DEBUG, SECRET_KEY, LOGIN_USERNAME, LOGIN_PASSWORD
from datetime import datetime
import tempfile

app = Flask(__name__)
app.secret_key = SECRET_KEY

# Login & CSRF setup
login_manager = LoginManager(app)
login_manager.login_view = "login"
csrf = CSRFProtect(app)


class SimpleUser(UserMixin):
    def __init__(self, user_id: str, role: str = 'user'):
        self.id = user_id
        self.role = role or 'user'
        self.active = True


@login_manager.user_loader
def load_user(user_id):
    # Ưu tiên lấy từ sheet Accounts nếu có
    try:
        if sheets_manager:
            acc = sheets_manager.get_account_by_username(user_id)
            if acc and acc.get('active'):
                return SimpleUser(acc['username'], acc.get('role', 'user'))
    except Exception as e:
        print(f"[AUTH] Lỗi load_user từ sheet: {e}")
    # Fallback tài khoản cấu hình ENV
    if user_id == LOGIN_USERNAME:
        return SimpleUser(user_id, role='admin')
    return None


def admin_required():
    if not current_user.is_authenticated:
        abort(401)
    if getattr(current_user, 'role', 'user') != 'admin':
        abort(403)

# Khởi tạo Sheets Manager
try:
    sheets_manager = get_sheets_manager()
except Exception as e:
    print(f"Cảnh báo: Không thể kết nối Google Sheets: {e}")
    sheets_manager = None


@app.route('/')
@login_required
def home():
    """Trang dashboard chính"""
    display_name = getattr(current_user, 'id', '') or ''
    try:
        if sheets_manager:
            acc = sheets_manager.get_account_by_username(current_user.id)
            if acc:
                display_name = acc.get('name') or acc.get('username') or display_name
    except Exception as e:
        print(f"[DEBUG] Không lấy được display_name: {e}")
    summary = None
    if sheets_manager:
        try:
            # Ưu tiên lấy summary theo sheet cá nhân
            summary = sheets_manager.get_user_summary(current_user.id)
        except Exception as e:
            print(f"Lỗi lấy user summary: {e}")
        if not summary:
            try:
                summary = sheets_manager.get_summary()
            except Exception as e:
                print(f"Lỗi lấy summary chung: {e}")
    return render_template('Home.html', summary=summary, display_name=display_name)


@app.route('/chi-tieu')
@login_required
def chi_tieu_page():
    """Trang giao diện chi tiêu"""
    today_dt = datetime.now()
    today = today_dt.strftime('%Y-%m-%d')
    display_name = None
    try:
        if sheets_manager:
            acc = sheets_manager.get_account_by_username(current_user.id)
            if acc:
                display_name = acc.get('name') or acc.get('username')
    except Exception as e:
        print(f"[DEBUG] Không lấy được tên hiển thị: {e}")
    if not display_name:
        display_name = current_user.id
    return render_template(
        'chi_tieu.html',
        today=today,
        month=today_dt.month,
        year=today_dt.year,
        display_name=display_name
    )


@app.route('/api/chi_categories', methods=['GET'])
@login_required
def chi_categories():
    """API trả về danh mục chi (cột B sheet DanhMuc)"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        categories = sheets_manager.get_categories().get('Chi', [])
        return jsonify({'categories': categories})
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy danh mục chi: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/thu_categories', methods=['GET'])
@login_required
def thu_categories():
    """API trả về danh mục thu (cột A sheet Danh Mục)"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        categories = sheets_manager.get_categories().get('Thu', [])
        return jsonify({'categories': categories})
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy danh mục thu: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/quy_purposes', methods=['GET'])
@login_required
def quy_purposes():
    """API trả về mục đích quỹ (cột C sheet Danh Mục)"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        purposes = sheets_manager.get_quy_purposes()
        return jsonify({'purposes': purposes})
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy mục đích quỹ: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/chi_submit', methods=['POST'])
@login_required
@csrf.exempt
def chi_submit():
    """Ghi khoản chi vào sheet cá nhân (theo Name của account)."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        date_str = (data.get('date') or '').strip() or datetime.now().strftime('%Y-%m-%d')
        category = (data.get('category') or '').strip()
        note = (data.get('note') or '').strip()
        purpose = (data.get('purpose') or '').strip()  # Mục đích quỹ
        amount_raw = str(data.get('amount') or '').replace(',', '').strip()
        if not category:
            return jsonify({'error': 'Danh mục không được trống'}), 400
        try:
            amount = float(amount_raw)
        except (ValueError, TypeError):
            return jsonify({'error': 'Số tiền không hợp lệ'}), 400
        if amount <= 0:
            return jsonify({'error': 'Số tiền phải lớn hơn 0'}), 400

        acc = sheets_manager.get_account_by_username(current_user.id)
        if not acc:
            return jsonify({'error': 'Không tìm thấy tài khoản trong sheet Accounts'}), 400
        sheet_name = acc.get('name') or acc.get('username')
        if not sheet_name:
            return jsonify({'error': 'Thiếu Name của tài khoản để ghi sheet riêng'}), 400

        sheets_manager.add_user_transaction(
            sheet_name=sheet_name,
            date_str=date_str,
            category=category,
            amount=amount,
            note=note,
            purpose=purpose,  # Lưu mục đích quỹ vào cột "Quỹ"
        )
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi ghi khoản chi: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/thu_submit', methods=['POST'])
@login_required
@csrf.exempt
def thu_submit():
    """Ghi khoản thu vào sheet cá nhân."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        date_str = (data.get('date') or '').strip() or datetime.now().strftime('%Y-%m-%d')
        category = (data.get('category') or '').strip()
        note = (data.get('note') or '').strip()
        amount_raw = str(data.get('amount') or '').replace(',', '').strip()
        if not category:
            return jsonify({'error': 'Danh mục không được trống'}), 400
        try:
            amount = float(amount_raw)
        except (ValueError, TypeError):
            return jsonify({'error': 'Số tiền không hợp lệ'}), 400
        if amount <= 0:
            return jsonify({'error': 'Số tiền phải lớn hơn 0'}), 400

        acc = sheets_manager.get_account_by_username(current_user.id)
        if not acc:
            return jsonify({'error': 'Không tìm thấy tài khoản trong sheet Accounts'}), 400
        sheet_name = acc.get('name') or acc.get('username')
        if not sheet_name:
            return jsonify({'error': 'Thiếu Name của tài khoản để ghi sheet riêng'}), 400

        sheets_manager.add_user_transaction(
            sheet_name=sheet_name,
            date_str=date_str,
            category=category,
            amount=amount,
            note=note,
            is_income=True,
        )
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi ghi khoản thu: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/user_transactions', methods=['GET'])
@login_required
def user_transactions():
    """Trả về giao dịch của user theo tháng/năm."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        month = request.args.get('month')
        year = request.args.get('year')
        now = datetime.now()
        try:
            month_val = int(month) if month else now.month
            year_val = int(year) if year else now.year
        except ValueError:
            return jsonify({'error': 'Tháng hoặc năm không hợp lệ'}), 400

        acc = sheets_manager.get_account_by_username(current_user.id)
        if not acc:
            return jsonify({'error': 'Không tìm thấy tài khoản trong sheet Accounts'}), 400
        sheet_name = acc.get('name') or acc.get('username')
        if not sheet_name:
            return jsonify({'error': 'Thiếu Name của tài khoản để lấy sheet'}), 400

        txs = sheets_manager.get_user_transactions(sheet_name, month_val, year_val)
        return jsonify({'transactions': txs})
    except Exception as e:
        print(f"[ERROR] Lỗi lấy giao dịch user: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/user_yearly_report', methods=['GET'])
@login_required
def user_yearly_report():
    """Tổng hợp thu/chi/quỹ tối đa 5 năm cho user hiện tại."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        max_years = request.args.get('years')
        try:
            max_years = int(max_years) if max_years else 5
        except ValueError:
            max_years = 5

        acc = sheets_manager.get_account_by_username(current_user.id)
        if not acc:
            return jsonify({'error': 'Không tìm thấy tài khoản trong sheet Accounts'}), 400
        sheet_name = acc.get('name') or acc.get('username')
        if not sheet_name:
            return jsonify({'error': 'Thiếu Name của tài khoản để lấy sheet'}), 400

        data = sheets_manager.get_user_yearly_report(sheet_name, years=max_years)
        return jsonify({'years': data})
    except Exception as e:
        print(f"[ERROR] Lỗi lấy báo cáo năm: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/user_monthly_report', methods=['GET'])
@login_required
def user_monthly_report():
    """Tổng hợp thu/chi/quỹ theo 12 tháng của 1 năm cho user hiện tại."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        year = request.args.get('year')
        try:
            year_val = int(year) if year else None
        except ValueError:
            year_val = None

        acc = sheets_manager.get_account_by_username(current_user.id)
        if not acc:
            return jsonify({'error': 'Không tìm thấy tài khoản trong sheet Accounts'}), 400
        sheet_name = acc.get('name') or acc.get('username')
        if not sheet_name:
            return jsonify({'error': 'Thiếu Name của tài khoản để lấy sheet'}), 400

        data = sheets_manager.get_user_monthly_report(sheet_name, year=year_val)
        return jsonify({'months': data})
    except Exception as e:
        print(f"[ERROR] Lỗi lấy báo cáo tháng: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin')
@login_required
def admin_page():
    admin_required()
    return render_template('admin.html')


@app.route('/admin/export.xlsx', methods=['GET'])
@login_required
def export_spreadsheet():
    """Xuất toàn bộ file xlsx để backup (chỉ admin). Tên file có kèm ngày tháng."""
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        tmp_path = tmp.name
        tmp.close()
        sheets_manager.export_full_spreadsheet(tmp_path)
        
        # Thêm ngày tháng vào tên file backup
        now = datetime.now()
        date_str = now.strftime('%Y%m%d_%H%M%S')
        download_name = f'export_all_{date_str}.xlsx'
        
        return send_file(
            tmp_path,
            as_attachment=True,
            download_name=download_name,
            mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        )
    except Exception as e:
        print(f"[ERROR] Xuất spreadsheet: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/admin/import.xlsx', methods=['POST'])
@login_required
@csrf.exempt
def import_spreadsheet():
    """Import file xlsx để ghi đè dữ liệu hiện tại (chỉ admin)."""
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    
    if 'file' not in request.files:
        return jsonify({'error': 'Không có file được upload'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'Chưa chọn file'}), 400
    
    if not file.filename.lower().endswith('.xlsx'):
        return jsonify({'error': 'File phải là định dạng .xlsx'}), 400
    
    try:
        # Lưu file tạm
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix='.xlsx')
        tmp_path = tmp.name
        file.save(tmp_path)
        tmp.close()
        
        # Import file vào
        success = sheets_manager.import_full_spreadsheet(tmp_path)
        
        # Xóa file tạm
        import os
        try:
            os.unlink(tmp_path)
        except:
            pass
        
        if success:
            return jsonify({'success': True, 'message': 'Đã import file thành công'})
        else:
            return jsonify({'error': 'Import thất bại'}), 500
    except Exception as e:
        print(f"[ERROR] Import spreadsheet: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': f'Lỗi import: {str(e)}'}), 500


@app.route('/admin/sync-now', methods=['POST'])
@login_required
def sync_local_to_sheet():
    """Đẩy đè toàn bộ dữ liệu từ file local lên Google Sheet (chỉ admin)."""
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        sheets_manager.sync_local_to_sheet()
        return jsonify({'success': True, 'message': 'Đã đồng bộ thành công từ local lên Google Sheet'})
    except Exception as e:
        print(f"[ERROR] Đồng bộ local -> Sheet: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/summary', methods=['GET'])
@login_required
def get_summary():
    """API lấy tổng kết cho user hiện tại"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500

    try:
        summary = sheets_manager.get_user_summary(current_user.id)
        return jsonify(summary)
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


@app.route('/api/quy_summary', methods=['GET'])
@login_required
def get_quy_summary():
    """API lấy tổng quỹ và mục đích quỹ từ 2 sheet Hưng và Giang"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        # Lấy tổng quỹ từ cả 2 sheet "Hưng" và "Giang"
        quy_data = sheets_manager.get_combined_quy_summary(['Hưng', 'Giang'])
        return jsonify(quy_data)
    except Exception as e:
        print(f"[ERROR] Lỗi khi lấy quỹ summary: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500


# ---------- Account Management (Admin) ----------
@app.route('/api/accounts', methods=['GET'])
@login_required
def list_accounts():
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        accounts = sheets_manager.get_accounts()
        # Không trả về mật khẩu thuần cho client? vẫn cần để edit: che
        for acc in accounts:
            acc['password'] = ''  # ẩn password
        return jsonify({'accounts': accounts})
    except Exception as e:
        print(f"[ERROR] Lỗi lấy accounts: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/accounts', methods=['POST'])
@login_required
@csrf.exempt
def create_account():
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        # Cho phép gửi 'user' hoặc 'username' từ client
        username = (data.get('user') or data.get('username') or '').strip()
        password = (data.get('password') or '').strip()
        name = (data.get('name') or '').strip()
        role = (data.get('role') or 'user').strip() or 'user'
        active = bool(data.get('active', True))
        row = sheets_manager.add_account(username, password, name, role, active)
        return jsonify({'success': True, 'row_number': row})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi tạo account: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/accounts/<int:row_id>', methods=['PUT'])
@login_required
@csrf.exempt
def update_account(row_id):
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        password = data.get('password')
        name = data.get('name')
        role = data.get('role')
        active = data.get('active')
        sheets_manager.update_account(row_id, password=password, name=name, role=role, active=active)
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi cập nhật account: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/accounts/<int:row_id>', methods=['DELETE'])
@login_required
@csrf.exempt
def delete_account(row_id):
    admin_required()
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        sheets_manager.delete_account(row_id)
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi xóa account: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/categories', methods=['POST'])
@login_required
@csrf.exempt  # API JSON
def add_category():
    """API thêm danh mục mới"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    
    try:
        data = request.get_json()
        category_type = data.get('type')
        category_name = (data.get('name') or '').strip()
        icon = (data.get('icon') or '').strip()
        
        if category_type not in ['Thu', 'Chi', 'Quỹ']:
            return jsonify({'error': 'Loại danh mục không hợp lệ'}), 400
        
        if not category_name:
            return jsonify({'error': 'Tên danh mục không được để trống'}), 400
        
        success = sheets_manager.add_category(category_type, category_name, icon)
        if success:
            return jsonify({'success': True, 'message': 'Đã thêm danh mục thành công'})
        else:
            return jsonify({'error': 'Danh mục này đã tồn tại'}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500


@app.route('/api/categories', methods=['PUT'])
@login_required
@csrf.exempt
def update_category_api():
    """API cập nhật danh mục"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        category_type = data.get('type')
        old_name = (data.get('old_name') or '').strip()
        new_name = (data.get('new_name') or '').strip()
        icon = (data.get('icon') or '').strip()
        if category_type not in ['Thu', 'Chi', 'Quỹ']:
            return jsonify({'error': 'Loại danh mục không hợp lệ'}), 400
        if not old_name or not new_name:
            return jsonify({'error': 'Tên danh mục không được để trống'}), 400
        success = sheets_manager.update_category(category_type, old_name, new_name, icon)
        if success:
            return jsonify({'success': True, 'message': 'Đã cập nhật danh mục thành công'})
        else:
            return jsonify({'error': 'Không tìm thấy danh mục cần cập nhật'}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500


@app.route('/api/categories', methods=['DELETE'])
@login_required
@csrf.exempt
def delete_category_api():
    """API xóa danh mục"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        category_type = data.get('type')
        category_name = (data.get('name') or '').strip()
        if category_type not in ['Thu', 'Chi', 'Quỹ']:
            return jsonify({'error': 'Loại danh mục không hợp lệ'}), 400
        if not category_name:
            return jsonify({'error': 'Tên danh mục không được để trống'}), 400
        success = sheets_manager.delete_category(category_type, category_name)
        if success:
            return jsonify({'success': True, 'message': 'Đã xóa danh mục thành công'})
        else:
            return jsonify({'error': 'Không tìm thấy danh mục cần xóa'}), 400
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        return jsonify({'error': f'Lỗi server: {str(e)}'}), 500


@app.route('/api/available_icons', methods=['GET'])
@login_required
def get_available_icons():
    """API lấy danh sách icon có sẵn từ cột D và E trong sheet Danh Mục"""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        icons = sheets_manager.get_available_icons()
        return jsonify({'icons': icons})
    except Exception as e:
        print(f"[ERROR] Lỗi lấy icon: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/change_password', methods=['POST'])
@login_required
@csrf.exempt
def change_password():
    """Đổi mật khẩu cho tài khoản lưu trong sheet Accounts."""
    if not sheets_manager:
        return jsonify({'error': 'Không thể kết nối Google Sheets'}), 500
    try:
        data = request.get_json() or {}
        old_password = (data.get('old_password') or '').strip()
        new_password = (data.get('new_password') or '').strip()
        if not old_password or not new_password:
            return jsonify({'error': 'Thiếu mật khẩu cũ hoặc mới'}), 400

        username = current_user.id
        acc = sheets_manager.get_account_by_username(username)
        if not acc:
            return jsonify({'error': 'Tài khoản không hỗ trợ đổi mật khẩu (không có trong sheet)'}), 400
        if acc.get('password') != old_password:
            return jsonify({'error': 'Mật khẩu cũ không đúng'}), 400

        sheets_manager.update_password_by_username(username, new_password)
        return jsonify({'success': True})
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"[ERROR] Lỗi đổi mật khẩu: {e}")
        return jsonify({'error': str(e)}), 500


@app.route("/login", methods=["GET", "POST"])
@csrf.exempt  # dùng form đơn giản, không cấu hình CSRF token
def login():
    """Trang đăng nhập đơn giản với 1 tài khoản cấu hình trong .env"""
    if current_user.is_authenticated:
        return redirect(url_for("home"))

    error = None
    if request.method == "POST":
        username = request.form.get("username", "").strip()
        password = request.form.get("password", "")

        # 1) Thử từ sheet Accounts (ưu tiên)
        authed = False
        user_role = 'user'
        if sheets_manager:
            try:
                acc = sheets_manager.get_account_by_username(username)
                if acc and acc.get('active') and acc.get('password') == password:
                    authed = True
                    user_role = acc.get('role', 'user') or 'user'
            except Exception as e:
                print(f"[AUTH] Lỗi xác thực sheet: {e}")

        # 2) Fallback tài khoản ENV (admin)
        if not authed and username == LOGIN_USERNAME and password == LOGIN_PASSWORD:
            authed = True
            user_role = 'admin'

        if authed:
            user = SimpleUser(username, role=user_role)
            login_user(user)
            next_page = request.args.get("next") or url_for("home")
            return redirect(next_page)
        else:
            error = "Sai tài khoản hoặc mật khẩu"

    return render_template("login.html", error=error)


@app.route("/logout")
@login_required
def logout():
    logout_user()
    return redirect(url_for("login"))


if __name__ == "__main__":
    app.run(debug=DEBUG, host="0.0.0.0", port=5001)

