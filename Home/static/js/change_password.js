async function submitChangePassword(evt) {
    evt.preventDefault();
    const oldPwd = document.getElementById('old-password').value.trim();
    const newPwd = document.getElementById('new-password').value.trim();
    if (!oldPwd || !newPwd) {
        alert('Vui lòng nhập đủ mật khẩu cũ và mới');
        return;
    }
    try {
        const res = await fetch('/api/change_password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ old_password: oldPwd, new_password: newPwd }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Đổi mật khẩu thất bại');
        alert('Đổi mật khẩu thành công');
        closeChangePasswordModal();
    } catch (err) {
        alert(err.message);
    }
}

function openChangePasswordModal() {
    document.getElementById('change-password-modal').style.display = 'block';
}

function closeChangePasswordModal() {
    document.getElementById('change-password-modal').style.display = 'none';
    document.getElementById('old-password').value = '';
    document.getElementById('new-password').value = '';
}

document.addEventListener('DOMContentLoaded', () => {
    const trigger = document.getElementById('change-password-btn');
    if (trigger) trigger.addEventListener('click', openChangePasswordModal);
    const closeBtn = document.getElementById('close-change-password');
    if (closeBtn) closeBtn.addEventListener('click', closeChangePasswordModal);
    const form = document.getElementById('change-password-form');
    if (form) form.addEventListener('submit', submitChangePassword);
    window.addEventListener('click', (e) => {
        const modal = document.getElementById('change-password-modal');
        if (e.target === modal) closeChangePasswordModal();
    });
});

