// Quản lý tài khoản admin
let accounts = [];

function closeModal() {
    document.getElementById('account-modal').style.display = 'none';
}

function openCreateModal() {
    document.getElementById('account-modal-title').textContent = 'Thêm tài khoản';
    document.getElementById('account-row-id').value = '';
    document.getElementById('account-username').value = '';
    document.getElementById('account-username').disabled = false;
    document.getElementById('account-password').value = '';
    document.getElementById('account-name').value = '';
    document.getElementById('account-role').value = 'user';
    document.getElementById('account-active').checked = true;
    document.getElementById('account-modal').style.display = 'block';
}

function openEditModal(account) {
    document.getElementById('account-modal-title').textContent = 'Sửa tài khoản';
    document.getElementById('account-row-id').value = account.row_number;
    document.getElementById('account-username').value = account.username;
    document.getElementById('account-username').disabled = true;
    document.getElementById('account-password').value = '';
    document.getElementById('account-name').value = account.name || '';
    document.getElementById('account-role').value = account.role || 'user';
    document.getElementById('account-active').checked = !!account.active;
    document.getElementById('account-modal').style.display = 'block';
}

async function loadAccounts() {
    const body = document.getElementById('accounts-body');
    body.innerHTML = '<tr><td colspan="4" style="text-align:center;">Đang tải...</td></tr>';
    try {
        const res = await fetch('/api/accounts');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi tải danh sách');
        accounts = data.accounts || [];
        renderAccounts();
    } catch (err) {
        body.innerHTML = `<tr><td colspan="4" style="color:red;text-align:center;">${err.message}</td></tr>`;
    }
}

function renderAccounts() {
    const body = document.getElementById('accounts-body');
    if (!accounts.length) {
        body.innerHTML = '<tr><td colspan="5" style="text-align:center;">Chưa có tài khoản</td></tr>';
        return;
    }
    body.innerHTML = accounts.map(acc => {
        const status = acc.active
            ? `<span class="status-dot"><span class="dot"></span><span>Active</span></span>`
            : `<span class="status-dot off"><span class="dot"></span><span>Inactive</span></span>`;
        const role = acc.role || 'user';
        const rolePill = `<span class="admin-pill ${role === 'admin' ? 'pill-admin' : 'pill-user'}">${role}</span>`;
        return `<tr>
            <td>${acc.username}</td>
            <td>${acc.name || ''}</td>
            <td>${rolePill}</td>
            <td>${status}</td>
            <td class="actions">
                <button class="btn btn-secondary action-btn" data-action="edit" data-id="${acc.row_number}">Sửa</button>
                <button class="btn btn-danger action-btn" data-action="delete" data-id="${acc.row_number}">Xóa</button>
            </td>
        </tr>`;
    }).join('');
}

async function submitAccountForm(evt) {
    evt.preventDefault();
    const rowId = document.getElementById('account-row-id').value;
    const payload = {
        user: document.getElementById('account-username').value.trim(),
        password: document.getElementById('account-password').value.trim(),
        name: document.getElementById('account-name').value.trim(),
        role: document.getElementById('account-role').value,
        active: document.getElementById('account-active').checked,
    };
    if (!payload.user || (!rowId && !payload.password)) {
        alert('User và password không được trống');
        return;
    }
    try {
        const res = await fetch(rowId ? `/api/accounts/${rowId}` : '/api/accounts', {
            method: rowId ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi lưu tài khoản');
        closeModal();
        await loadAccounts();
    } catch (err) {
        alert(err.message);
    }
}

async function deleteAccount(rowId) {
    if (!confirm('Xóa tài khoản này?')) return;
    try {
        const res = await fetch(`/api/accounts/${rowId}`, { method: 'DELETE' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi xóa tài khoản');
        await loadAccounts();
    } catch (err) {
        alert(err.message);
    }
}

async function syncLocalToSheet() {
    if (!confirm('Bạn có chắc muốn đẩy đè TOÀN BỘ dữ liệu từ file local lên Google Sheet? Hành động này sẽ ghi đè tất cả dữ liệu hiện có trên Sheet!')) {
        return;
    }
    const btn = document.getElementById('btn-sync-to-sheet');
    const originalText = btn.textContent;
    btn.disabled = true;
    btn.textContent = 'Đang đồng bộ...';
    try {
        const res = await fetch('/admin/sync-now', { method: 'POST' });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi đồng bộ');
        alert('Đã đồng bộ thành công từ local lên Google Sheet!');
    } catch (err) {
        alert('Lỗi: ' + err.message);
    } finally {
        btn.disabled = false;
        btn.textContent = originalText;
    }
}

async function importSpreadsheet(file) {
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
        alert('File phải là định dạng .xlsx');
        return;
    }
    
    if (!confirm('Bạn có chắc muốn import file này? Hành động này sẽ GHI ĐÈ toàn bộ dữ liệu hiện tại!')) {
        return;
    }
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
        const res = await fetch('/admin/import.xlsx', {
            method: 'POST',
            body: formData
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Lỗi import file');
        alert('Đã import file thành công!');
        await loadAccounts(); // Reload danh sách tài khoản
    } catch (err) {
        alert('Lỗi: ' + err.message);
    }
}

function attachEvents() {
    document.getElementById('btn-sync-to-sheet').addEventListener('click', syncLocalToSheet);
    document.getElementById('btn-refresh-accounts').addEventListener('click', loadAccounts);
    document.getElementById('btn-open-create').addEventListener('click', openCreateModal);
    
    // Import file handler
    const importInput = document.getElementById('import-file-input');
    if (importInput) {
        importInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                importSpreadsheet(file);
                e.target.value = ''; // Reset input
            }
        });
    }
    
    document.getElementById('close-account-modal').addEventListener('click', closeModal);
    const closeSecondary = document.getElementById('close-account-modal-secondary');
    if (closeSecondary) {
        closeSecondary.addEventListener('click', closeModal);
    }
    document.getElementById('account-form').addEventListener('submit', submitAccountForm);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('account-modal');
        if (e.target === modal) {
            closeModal();
        }
    });
    document.getElementById('accounts-body').addEventListener('click', (e) => {
        const action = e.target.getAttribute('data-action');
        const id = e.target.getAttribute('data-id');
        if (!action || !id) return;
        const acc = accounts.find(a => String(a.row_number) === String(id));
        if (action === 'edit' && acc) {
            openEditModal(acc);
        }
        if (action === 'delete') {
            deleteAccount(id);
        }
    });
}

document.addEventListener('DOMContentLoaded', () => {
    attachEvents();
    loadAccounts();
});

