let chiCategories = [];
let selectedCategory = null;
let currentTab = 'Chi';
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút
let allTxs = [];
const categoryIconMap = {};
let iconsLoadedChi = false;
let iconsLoadedThu = false;
let quyPurposes = [];

function formatMoneyInput(inputEl) {
    const raw = inputEl.value.replace(/\D/g, '');
    if (!raw) {
        inputEl.value = '';
        return '';
    }
    const formatted = raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    inputEl.value = formatted;
    return formatted;
}

function getCachedCategories(key) {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        if (!obj || !obj.data || !obj.ts) return null;
        if (Date.now() - obj.ts > CACHE_TTL_MS) return null;
        return obj.data;
    } catch {
        return null;
    }
}

function setCachedCategories(key, data) {
    try {
        localStorage.setItem(key, JSON.stringify({ data, ts: Date.now() }));
    } catch {
        // ignore
    }
}

function cacheCategoryIcons(categories) {
    (categories || []).forEach(c => {
        const name = c.name || '';
        if (name && c.icon) {
            categoryIconMap[name] = c.icon;
        }
    });
}

async function loadChiCategories() {
    const grid = document.getElementById('chi-grid');
    const cached = getCachedCategories('chi_categories');
    if (cached && cached.length) {
        chiCategories = cached;
        cacheCategoryIcons(chiCategories);
        renderCategories();
        iconsLoadedChi = true;
        return;
    }
    try {
        const res = await fetch('/api/chi_categories');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tải được danh mục');
        chiCategories = data.categories || [];
        cacheCategoryIcons(chiCategories);
        iconsLoadedChi = true;
        setCachedCategories('chi_categories', chiCategories);
        if (!chiCategories.length) {
            grid.innerHTML = '<div class="chi-cat placeholder">Không có danh mục</div>';
            return;
        }
        renderCategories();
    } catch (err) {
        grid.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
    }
}

async function loadThuCategories() {
    const grid = document.getElementById('chi-grid');
    grid.innerHTML = '<div class="chi-cat placeholder">Đang tải...</div>';
    const cached = getCachedCategories('thu_categories');
    if (cached && cached.length) {
        chiCategories = cached;
        cacheCategoryIcons(chiCategories);
        renderCategories();
        iconsLoadedThu = true;
        return;
    }
    try {
        const res = await fetch('/api/thu_categories');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tải được danh mục');
        chiCategories = data.categories || [];
        cacheCategoryIcons(chiCategories);
        iconsLoadedThu = true;
        setCachedCategories('thu_categories', chiCategories);
        if (!chiCategories.length) {
            grid.innerHTML = '<div class="chi-cat placeholder">Không có danh mục</div>';
            return;
        }
        renderCategories();
    } catch (err) {
        grid.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
    }
}

async function loadQuyPurposes() {
    try {
        const res = await fetch('/api/quy_purposes');
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Không tải được mục đích quỹ');
        quyPurposes = data.purposes || [];
        // Cập nhật dropdown
        const purposeSelect = document.getElementById('chi-purpose');
        if (purposeSelect) {
            purposeSelect.innerHTML = '<option value="">Chọn mục đích...</option>' +
                quyPurposes.map(p => `<option value="${p.name}">${p.icon || ''} ${p.name}</option>`).join('');
        }
    } catch (err) {
        console.error('Lỗi load mục đích quỹ:', err);
    }
}

function renderCategories() {
    const grid = document.getElementById('chi-grid');
    grid.innerHTML = chiCategories.map((c, idx) => {
        const icon = (c.icon || '').trim();
        const name = c.name || '';
        const active = idx === 0 ? 'active' : '';
        if (idx === 0 && !selectedCategory) selectedCategory = name;
        return `<button class="chi-cat ${active}" data-name="${name}">
            <span class="icon">${icon || '•'}</span>
            <span>${name}</span>
        </button>`;
    }).join('');
    grid.querySelectorAll('.chi-cat').forEach(btn => {
        btn.addEventListener('click', () => {
            grid.querySelectorAll('.chi-cat').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedCategory = btn.getAttribute('data-name');
            // Hiển thị dropdown mục đích quỹ nếu chọn "Quỹ"
            const purposeField = document.getElementById('chi-purpose-field');
            if (purposeField) {
                if (selectedCategory && selectedCategory.toLowerCase() === 'quỹ') {
                    purposeField.style.display = 'block';
                } else {
                    purposeField.style.display = 'none';
                    const purposeSelect = document.getElementById('chi-purpose');
                    if (purposeSelect) purposeSelect.value = '';
                }
            }
        });
    });
    // Kiểm tra category đã chọn ban đầu
    if (selectedCategory && selectedCategory.toLowerCase() === 'quỹ') {
        const purposeField = document.getElementById('chi-purpose-field');
        if (purposeField) purposeField.style.display = 'block';
    }
}

function formatCategoryWithIcon(name) {
    const icon = categoryIconMap[name] || '';
    return icon ? `${icon} ${name}` : (name || '');
}

document.addEventListener('DOMContentLoaded', () => {
    loadChiCategories();
    loadQuyPurposes();

    const dateInput = document.getElementById('chi-date');
    if (dateInput) {
        if (!dateInput.value) {
            dateInput.value = dateInput.dataset.today || new Date().toISOString().slice(0, 10);
        }
        dateInput.addEventListener('click', () => {
            if (dateInput.showPicker) {
                dateInput.showPicker();
            } else {
                dateInput.focus();
            }
        });
    }

    const submitBtn = document.getElementById('chi-submit-btn');
    if (submitBtn) {
        submitBtn.addEventListener('click', async (e) => {
            e.preventDefault();
            const dateVal = (document.getElementById('chi-date')?.value || '').trim();
            const noteVal = (document.getElementById('chi-note')?.value || '').trim();
            const amountVal = (document.getElementById('chi-amount')?.value || '').trim().replace(/\./g, '');
            const categoryVal = selectedCategory || '';
            if (!categoryVal) {
                alert('Chọn danh mục trước khi ghi');
                return;
            }
            // Kiểm tra mục đích quỹ nếu chọn category "Quỹ"
            if (categoryVal.toLowerCase() === 'quỹ') {
                const purposeVal = (document.getElementById('chi-purpose')?.value || '').trim();
                if (!purposeVal) {
                    alert('Vui lòng chọn mục đích quỹ');
                    return;
                }
            }
            if (!amountVal) {
                alert('Nhập số tiền');
                return;
            }
            try {
                const endpoint = currentTab === 'Thu' ? '/api/thu_submit' : '/api/chi_submit';
                const purposeVal = (document.getElementById('chi-purpose')?.value || '').trim();
                const res = await fetch(endpoint, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        date: dateVal,
                        category: categoryVal,
                        amount: amountVal,
                        note: noteVal,
                        purpose: purposeVal, // Mục đích quỹ (chỉ có khi category='Quỹ')
                    })
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error || 'Ghi khoản chi thất bại');
                alert('Đã ghi khoản chi');
                const amountEl = document.getElementById('chi-amount');
                if (amountEl) amountEl.value = '';
                const noteEl = document.getElementById('chi-note');
                if (noteEl) noteEl.value = '';
                const purposeEl = document.getElementById('chi-purpose');
                if (purposeEl) purposeEl.value = '';
            } catch (err) {
                alert(err.message);
            }
        });
    }

    const amountInput = document.getElementById('chi-amount');
    if (amountInput) {
        amountInput.addEventListener('input', () => formatMoneyInput(amountInput));
    }

    // Tabs Chi / Thu / Lịch / Khác
    const tabChi = document.getElementById('tab-chi');
    const tabThu = document.getElementById('tab-thu');
    const tabLich = document.getElementById('tab-lich');
    const tabOther = document.getElementById('tab-other');
    const panelChi = document.getElementById('panel-chi');
    const panelLich = document.getElementById('panel-lich');
    const panelReport = document.getElementById('panel-report');
    const panelOther = document.getElementById('panel-other');
    const bottomButtons = document.querySelectorAll('.chi-bottom-item[data-tab]');

    function setActiveTab(tab) {
        currentTab = tab;
        if (tabChi) tabChi.classList.toggle('active', tab === 'Chi');
        if (tabThu) tabThu.classList.toggle('active', tab === 'Thu');
        if (tabLich) tabLich.classList.toggle('active', tab === 'Lich');
        if (tabOther) tabOther.classList.toggle('active', tab === 'Other');

        bottomButtons.forEach(btn => {
            const t = btn.getAttribute('data-tab');
            const isEntry = t === 'Entry' && (tab === 'Chi' || tab === 'Thu');
            btn.classList.toggle('active', isEntry || t === tab);
        });

        if (panelChi) panelChi.style.display = (tab === 'Lich' || tab === 'Report' || tab === 'Other') ? 'none' : 'block';
        if (panelLich) panelLich.style.display = tab === 'Lich' ? 'block' : 'none';
        if (panelReport) panelReport.style.display = tab === 'Report' ? 'block' : 'none';
        if (panelOther) panelOther.style.display = tab === 'Other' ? 'block' : 'none';

        // Ẩn dropdown mục đích quỹ khi chuyển tab
        const purposeField = document.getElementById('chi-purpose-field');
        if (purposeField) {
            purposeField.style.display = 'none';
            const purposeSelect = document.getElementById('chi-purpose');
            if (purposeSelect) purposeSelect.value = '';
        }

        if (tab === 'Chi') {
            loadChiCategories();
        } else if (tab === 'Thu') {
            loadThuCategories();
        } else if (tab === 'Lich') {
            ensureLoadLich();
        } else if (tab === 'Report') {
            ensureLoadReport();
        } else if (tab === 'Other') {
            loadOtherPanel();
        }

    // đổi label nút/tiêu đề cho phù hợp tab
    const moneyLabel = document.querySelector('label[for="chi-amount"]') || document.querySelector('.chi-field label:nth-of-type(3)');
    const submitBtn = document.getElementById('chi-submit-btn');
    if (moneyLabel) {
        moneyLabel.textContent = tab === 'Thu' ? 'Tiền thu' : 'Tiền chi';
    }
    if (submitBtn) {
        submitBtn.textContent = tab === 'Thu' ? 'Nhập khoản Thu' : 'Nhập khoản Tiền chi';
    }
    }

    if (tabChi) tabChi.addEventListener('click', () => setActiveTab('Chi'));
    if (tabThu) tabThu.addEventListener('click', () => setActiveTab('Thu'));
    if (tabLich) tabLich.addEventListener('click', () => setActiveTab('Lich'));
    if (tabOther) tabOther.addEventListener('click', () => setActiveTab('Other'));
    bottomButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const t = btn.getAttribute('data-tab');
            if (t) setActiveTab(t);
        });
    });

    // Lịch data
    const lichMonth = document.getElementById('lich-month');
    const lichYear = document.getElementById('lich-year');
    const lichDate = document.getElementById('lich-date');
    const lichCalendar = document.getElementById('lich-calendar');
    const lichTitle = document.getElementById('lich-title');
    const lichPrev = document.getElementById('lich-prev');
    const lichNext = document.getElementById('lich-next');
    const lichMonthPicker = document.getElementById('lich-month-picker');
    let lichLoaded = false;
    let currentMonth = lichMonth ? Number(lichMonth.value) : new Date().getMonth() + 1;
    let currentYear = lichYear ? Number(lichYear.value) : new Date().getFullYear();

    function formatNumber(n) {
        try { return Number(n).toLocaleString('vi-VN'); } catch { return n; }
    }

    function groupByDate(txs) {
        const map = {};
        txs.forEach(tx => {
            const d = tx.date || '';
            if (!map[d]) map[d] = { income: 0, expense: 0, items: [] };
            if (tx.type === 'Thu') map[d].income += tx.amount || 0;
            if (tx.type === 'Chi') map[d].expense += tx.amount || 0;
            map[d].items.push(tx);
        });
        const dates = Object.keys(map).sort((a, b) => (a > b ? -1 : 1));
        return dates.map(d => ({ date: d, ...map[d] }));
    }

    function renderByDate(dateStr) {
        const list = document.getElementById('lich-list');
        if (!list) return;
        if (!allTxs || !allTxs.length) {
            list.innerHTML = '<div class="chi-cat placeholder">Không có giao dịch</div>';
            return;
        }
        const filtered = dateStr ? allTxs.filter(tx => (tx.date || '').startsWith(dateStr)) : allTxs;
        if (!filtered.length) {
            list.innerHTML = '<div class="chi-cat placeholder">Không có giao dịch cho ngày này</div>';
            return;
        }
        const grouped = groupByDate(filtered);
        list.innerHTML = grouped.map(g => {
            const totalDay = g.income - g.expense;
            const rows = g.items.map(item => `
                <div class="lich-item">
                    <div class="lich-item-main">
                        <div class="cat-row">
                            <span class="lich-badge ${item.type === 'Chi' ? 'expense' : 'income'}">${item.type === 'Chi' ? 'Chi' : 'Thu'}</span>
                            <span class="cat">${formatCategoryWithIcon(item.category)}</span>
                        </div>
                        <div class="note">${item.note || ''}</div>
                    </div>
                    <div class="amount ${item.type === 'Chi' ? 'expense' : 'income'}">
                        ${item.type === 'Chi' ? '-' : ''}${formatNumber(item.amount || 0)}
                    </div>
                </div>
            `).join('');
            return `
                <div class="lich-day">
                    <div class="lich-day-body">
                        ${rows}
                    </div>
                </div>
            `;
        }).join('');
    }

    function renderCalendar() {
        if (!lichCalendar) return;
        const firstDay = new Date(currentYear, currentMonth - 1, 1);
        const startDow = firstDay.getDay() === 0 ? 7 : firstDay.getDay(); // Monday=1
        const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
        const dowLabels = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
        const dayTotals = {};
        allTxs.forEach(tx => {
            const [y, m, d] = (tx.date || '').split('-').map(Number);
            if (y === currentYear && m === currentMonth) {
                const key = tx.date;
                if (!dayTotals[key]) dayTotals[key] = { income: 0, expense: 0 };
                if (tx.type === 'Thu') dayTotals[key].income += tx.amount || 0;
                if (tx.type === 'Chi') dayTotals[key].expense += tx.amount || 0;
            }
        });
        if (lichTitle) lichTitle.textContent = `${String(currentMonth).padStart(2, '0')}/${currentYear}`;
        const cells = [];
        // headers
        cells.push('<div class="lich-dow-row">');
        dowLabels.forEach(label => cells.push(`<div class="lich-dow">${label}</div>`));
        cells.push('</div><div class="lich-days">');
        for (let i = 1; i < startDow; i++) {
            cells.push('<div class="lich-day-cell empty"></div>');
        }
        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${currentYear}-${String(currentMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const totals = dayTotals[dateStr] || { income: 0, expense: 0 };
            const incomeVal = totals.income || 0;
            const expenseVal = totals.expense || 0;
            const hasData = (incomeVal + expenseVal) > 0;
            const incHtml = incomeVal ? `<div class="lich-amt income">${formatNumber(incomeVal)}</div>` : '';
            const expHtml = expenseVal ? `<div class="lich-amt expense">${formatNumber(expenseVal)}</div>` : '';
            cells.push(`
                <button class="lich-day-cell${hasData ? ' has' : ''}" data-date="${dateStr}">
                    <div class="lich-day-number">${d}</div>
                    ${incHtml}
                    ${expHtml}
                </button>
            `);
        }
        cells.push('</div>');
        lichCalendar.innerHTML = cells.join('');
        lichCalendar.querySelectorAll('.lich-day-cell[data-date]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (lichDate) lichDate.value = btn.getAttribute('data-date');
                renderByDate(btn.getAttribute('data-date'));
            });
        });
    }

    async function loadLichData() {
        const list = document.getElementById('lich-list');
        if (list) list.innerHTML = '<div class="chi-cat placeholder">Đang tải...</div>';
        const m = currentMonth;
        const y = currentYear;
        try {
            const res = await fetch(`/api/user_transactions?month=${m}&year=${y}`);
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không tải được dữ liệu');
            allTxs = data.transactions || [];
            let sumIncome = 0, sumExpense = 0;
            allTxs.forEach(tx => {
                if (tx.type === 'Thu') sumIncome += tx.amount || 0;
                if (tx.type === 'Chi') sumExpense += tx.amount || 0;
            });
            const incEl = document.getElementById('lich-sum-income');
            const expEl = document.getElementById('lich-sum-expense');
            const balEl = document.getElementById('lich-sum-balance');
            if (incEl) incEl.textContent = formatNumber(sumIncome);
            if (expEl) expEl.textContent = formatNumber(sumExpense);
            if (balEl) balEl.textContent = formatNumber(sumIncome - sumExpense);

            if (lichDate && !lichDate.value) {
                const todayIso = new Date().toISOString().slice(0, 10);
                const [ty, tm] = todayIso.split('-').map(Number);
                if (ty === currentYear && tm === currentMonth) {
                    lichDate.value = todayIso;
                } else {
                    lichDate.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}-01`;
                }
            }

            renderByDate(lichDate ? lichDate.value : '');
            renderCalendar();
        } catch (err) {
            if (list) list.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
        }
    }

    if (lichDate && lichDate.showPicker) {
        lichDate.addEventListener('click', () => lichDate.showPicker());
    }
    if (lichDate) {
        lichDate.addEventListener('change', () => renderByDate(lichDate.value));
    }
    if (lichDate && window.LICH_DEFAULT_MONTH && window.LICH_DEFAULT_YEAR) {
        const todayIso = new Date().toISOString().slice(0, 10);
        const [ty, tm] = todayIso.split('-').map(Number);
        if (ty === Number(window.LICH_DEFAULT_YEAR) && tm === Number(window.LICH_DEFAULT_MONTH)) {
            lichDate.value = todayIso;
        }
    }

    function ensureLoadLich() {
        if (!lichLoaded) {
            const tasks = [];
            if (!iconsLoadedThu) {
                tasks.push(fetch('/api/thu_categories').then(async res => {
                    const data = await res.json();
                    if (res.ok) {
                        cacheCategoryIcons(data.categories || []);
                        iconsLoadedThu = true;
                    }
                }).catch(() => {}));
            }
            Promise.all(tasks).finally(() => {
                loadLichData();
                lichLoaded = true;
            });
        } else {
            loadLichData();
        }
    }

    function shiftMonth(delta) {
        currentMonth += delta;
        if (currentMonth < 1) {
            currentMonth = 12;
            currentYear -= 1;
        } else if (currentMonth > 12) {
            currentMonth = 1;
            currentYear += 1;
        }
        if (lichMonth) lichMonth.value = currentMonth;
        if (lichYear) lichYear.value = currentYear;
        if (lichMonthPicker) {
            lichMonthPicker.value = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
        }
        // luôn reload khi đổi tháng
        loadLichData();
        lichLoaded = true;
    }

    if (lichPrev) lichPrev.addEventListener('click', () => shiftMonth(-1));
    if (lichNext) lichNext.addEventListener('click', () => shiftMonth(1));
    if (lichMonthPicker) {
        // bật picker khi bấm tiêu đề
        if (lichTitle) {
            lichTitle.addEventListener('click', () => {
                lichMonthPicker.style.pointerEvents = 'auto';
                lichMonthPicker.style.opacity = 1e-6;
                lichMonthPicker.focus();
                if (lichMonthPicker.showPicker) lichMonthPicker.showPicker();
            });
        }
        lichMonthPicker.addEventListener('change', () => {
            const val = lichMonthPicker.value; // yyyy-mm
            if (!val) return;
            const [y, m] = val.split('-').map(Number);
            if (!y || !m) return;
            currentYear = y;
            currentMonth = m;
            if (lichMonth) lichMonth.value = currentMonth;
            if (lichYear) lichYear.value = currentYear;
            loadLichData();
            lichLoaded = true;
        });
    }

    // Báo cáo
    let reportLoaded = false;
    let reportChart = null;
    let reportMonthlyChart = null;
    async function loadReport() {
        const wrap = document.getElementById('report-years');
        const chartEl = document.getElementById('report-chart');
        const wrapMonths = document.getElementById('report-months');
        const chartElMonths = document.getElementById('report-chart-monthly');
        if (!wrap) return;
        wrap.innerHTML = '<div class="chi-cat placeholder">Đang tải...</div>';
        if (wrapMonths) wrapMonths.innerHTML = '<div class="chi-cat placeholder">Đang tải...</div>';
        try {
            const res = await fetch('/api/user_yearly_report?years=5');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không tải được báo cáo');
            const items = data.years || [];
            if (!items.length) {
                wrap.innerHTML = '<div class="chi-cat placeholder">Không có dữ liệu</div>';
                return;
            }
            // render chart (income as line, expense & fund as bars)
            if (chartEl && window.Chart) {
                const labels = items.map(i => i.year);
                const incomes = items.map(i => i.income || 0);
                const expenses = items.map(i => i.expense || 0);
                const funds = items.map(i => i.fund || 0);
                chartEl.parentElement.style.height = `${Math.max(260, labels.length * 55)}px`;
                if (reportChart) reportChart.destroy();
                reportChart = new Chart(chartEl, {
                    type: 'bar',
                    data: {
                        labels,
                        datasets: [
                            { 
                                label: 'Thu', 
                                data: incomes, 
                                type: 'line',
                                borderColor: '#4ade80',
                                backgroundColor: 'rgba(74,222,128,0.18)',
                                borderWidth: 3,
                                tension: 0.25,
                                fill: false,
                                pointRadius: 5,
                                pointBackgroundColor: '#22c55e'
                            },
                            { label: 'Chi', data: expenses, backgroundColor: 'rgba(239,68,68,0.8)', borderRadius: 10, barThickness: 26, maxBarThickness: 32, stack: 'stack' },
                            { label: 'Quỹ', data: funds, backgroundColor: 'rgba(59,130,246,0.8)', borderRadius: 10, barThickness: 26, maxBarThickness: 32, stack: 'stack' },
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    color: '#e2e8f0',
                                    callback: (v) => formatNumber(v)
                                },
                                grid: { color: 'rgba(148,163,184,0.25)' },
                                border: { color: 'rgba(148,163,184,0.35)' }
                            },
                            x: {
                                ticks: {
                                    color: '#e2e8f0',
                                    callback: (_val, idx) => labels[idx] ?? _val
                                },
                                grid: { color: 'rgba(148,163,184,0.18)' },
                                border: { color: 'rgba(148,163,184,0.35)' }
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { usePointStyle: true, boxWidth: 10, boxHeight: 10, color: '#e5e7eb' }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15,23,42,0.9)',
                                titleColor: '#e5e7eb',
                                bodyColor: '#e5e7eb',
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.parsed.y ?? ctx.parsed.x;
                                        return `${ctx.dataset.label}: ${formatNumber(val)}`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            const maxVal = Math.max(...items.map(i => Math.max(i.income || 0, i.expense || 0, i.fund || 0, 1)));
            wrap.innerHTML = items.map(i => {
                const incW = Math.round((i.income || 0) / maxVal * 100);
                const expW = Math.round((i.expense || 0) / maxVal * 100);
                const fundW = Math.round((i.fund || 0) / maxVal * 100);
                return `
                <div class="report-row">
                    <div class="report-year">${i.year}</div>
                    <div class="report-bars">
                        <div class="bar income" style="width:${incW}%">
                            <span>${formatNumber(i.income || 0)}</span>
                        </div>
                        <div class="bar expense" style="width:${expW}%">
                            <span>${formatNumber(i.expense || 0)}</span>
                        </div>
                        <div class="bar fund" style="width:${fundW}%">
                            <span>${formatNumber(i.fund || 0)}</span>
                        </div>
                    </div>
                </div>`;
            }).join('');

            // Monthly report (current year)
            if (wrapMonths && chartElMonths && window.Chart) {
                const resMonth = await fetch('/api/user_monthly_report');
                const dataMonth = await resMonth.json();
                if (!resMonth.ok) throw new Error(dataMonth.error || 'Không tải được báo cáo tháng');
                const months = dataMonth.months || [];
                if (!months.length) {
                    wrapMonths.innerHTML = '<div class="chi-cat placeholder">Không có dữ liệu</div>';
                } else {
                    wrapMonths.innerHTML = '';
                }
                const labelsM = months.map(m => `T${m.month}`);
                const incomesM = months.map(m => m.income || 0);
                const expensesM = months.map(m => m.expense || 0);
                const fundsM = months.map(m => m.fund || 0);
                chartElMonths.parentElement.style.height = `${Math.max(260, labelsM.length * 55)}px`;
                if (reportMonthlyChart) reportMonthlyChart.destroy();
                reportMonthlyChart = new Chart(chartElMonths, {
                    type: 'bar',
                    data: {
                        labels: labelsM,
                        datasets: [
                            {
                                label: 'Thu',
                                data: incomesM,
                                type: 'line',
                                borderColor: '#4ade80',
                                backgroundColor: 'rgba(74,222,128,0.18)',
                                borderWidth: 3,
                                tension: 0.25,
                                fill: false,
                                pointRadius: 4,
                                pointBackgroundColor: '#22c55e'
                            },
                            {
                                label: 'Chi',
                                data: expensesM,
                                backgroundColor: 'rgba(239,68,68,0.82)',
                                borderRadius: 10,
                                barThickness: 24,
                                maxBarThickness: 28,
                                stack: 'stack'
                            },
                            {
                                label: 'Quỹ',
                                data: fundsM,
                                backgroundColor: 'rgba(59,130,246,0.85)',
                                borderRadius: 10,
                                barThickness: 24,
                                maxBarThickness: 28,
                                stack: 'stack'
                            },
                        ]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        scales: {
                            y: {
                                beginAtZero: true,
                                ticks: { color: '#e2e8f0', callback: (v) => formatNumber(v) },
                                grid: { color: 'rgba(148,163,184,0.25)' }
                            },
                            x: {
                                ticks: { color: '#e2e8f0' },
                                grid: { color: 'rgba(148,163,184,0.12)' },
                                stacked: true
                            }
                        },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { color: '#e5e7eb' }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15,23,42,0.9)',
                                titleColor: '#e5e7eb',
                                bodyColor: '#e5e7eb',
                                callbacks: {
                                    label: (ctx) => {
                                        const val = ctx.parsed.y ?? ctx.parsed.x;
                                        return `${ctx.dataset.label}: ${formatNumber(val)}`;
                                    }
                                }
                            }
                        }
                    }
                });
            }

            reportLoaded = true;
        } catch (err) {
            wrap.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
            const wrapMonths = document.getElementById('report-months');
            if (wrapMonths) wrapMonths.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
        }
    }

    function ensureLoadReport() {
        if (!reportLoaded) {
            loadReport();
        }
    }

    // ========== TAB KHÁC - QUẢN LÝ DANH MỤC ==========
    let otherLoaded = false;
    let currentCatType = 'Thu';
    let allCategories = { 'Thu': [], 'Chi': [], 'Quỹ': [] };
    let availableIcons = [];

    async function loadOtherPanel() {
        if (otherLoaded) return;
        otherLoaded = true;
        
        // Gắn event listeners trước khi load data
        setupOtherPanelListeners();
        
        await Promise.all([
            loadAvailableIcons(),
            loadCategoriesList()
        ]);
    }

    function setupOtherPanelListeners() {
        // Event listeners cho tabs
        document.querySelectorAll('.cat-tab').forEach(btn => {
            btn.addEventListener('click', () => {
                document.querySelectorAll('.cat-tab').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                currentCatType = btn.getAttribute('data-cat-type');
                resetCategoryForm();
                renderCategoryList();
            });
        });

        // Event listener cho nút Thêm/Cập nhật
        const catSubmitBtn = document.getElementById('cat-submit-btn');
        if (catSubmitBtn) {
            catSubmitBtn.addEventListener('click', (e) => {
                e.preventDefault();
                submitCategoryForm();
            });
        }

        // Event listener cho nút Hủy
        const catCancelBtn = document.getElementById('cat-cancel-btn');
        if (catCancelBtn) {
            catCancelBtn.addEventListener('click', (e) => {
                e.preventDefault();
                resetCategoryForm();
            });
        }

        // Event listener cho icon input
        const catIconInput = document.getElementById('cat-icon');
        if (catIconInput) {
            catIconInput.addEventListener('focus', () => {
                const grid = document.getElementById('icon-picker-grid');
                if (grid) grid.style.display = 'flex';
            });
            catIconInput.addEventListener('click', () => {
                const grid = document.getElementById('icon-picker-grid');
                if (grid) grid.style.display = 'flex';
            });
        }

        // Đóng icon picker khi click bên ngoài
        document.addEventListener('click', (e) => {
            const grid = document.getElementById('icon-picker-grid');
            const iconInput = document.getElementById('cat-icon');
            if (grid && iconInput && grid.style.display === 'flex') {
                if (!grid.contains(e.target) && e.target !== iconInput) {
                    grid.style.display = 'none';
                }
            }
        });
    }

    async function loadAvailableIcons() {
        try {
            const res = await fetch('/api/available_icons');
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Không tải được icon');
            availableIcons = data.icons || [];
            renderIconPicker();
        } catch (err) {
            console.error('Lỗi load icon:', err);
            const grid = document.getElementById('icon-picker-grid');
            if (grid) grid.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
        }
    }

    function renderIconPicker() {
        const grid = document.getElementById('icon-picker-grid');
        if (!grid) return;
        if (!availableIcons.length) {
            grid.innerHTML = '<div class="chi-cat placeholder">Chưa có icon</div>';
            return;
        }
        const currentIcon = document.getElementById('cat-icon').value;
        grid.innerHTML = availableIcons.map(icon => {
            const selected = icon === currentIcon ? 'selected' : '';
            return `<button class="icon-picker-item ${selected}" data-icon="${icon}">${icon}</button>`;
        }).join('');
        
        grid.querySelectorAll('.icon-picker-item').forEach(btn => {
            btn.addEventListener('click', () => {
                const icon = btn.getAttribute('data-icon');
                document.getElementById('cat-icon').value = icon;
                grid.querySelectorAll('.icon-picker-item').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                grid.style.display = 'none';
            });
        });
    }

    async function loadCategoriesList() {
        const list = document.getElementById('category-list');
        if (list) list.innerHTML = '<div class="chi-cat placeholder">Đang tải...</div>';
        try {
            const [resThu, resChi, resQuy] = await Promise.all([
                fetch('/api/thu_categories'),
                fetch('/api/chi_categories'),
                fetch('/api/quy_purposes')
            ]);
            const dataThu = await resThu.json();
            const dataChi = await resChi.json();
            const dataQuy = await resQuy.json();
            
            if (resThu.ok) allCategories.Thu = dataThu.categories || [];
            if (resChi.ok) allCategories.Chi = dataChi.categories || [];
            if (resQuy.ok) allCategories.Quỹ = dataQuy.purposes || [];
            
            renderCategoryList();
        } catch (err) {
            console.error('Lỗi load danh mục:', err);
            if (list) list.innerHTML = `<div class="chi-cat placeholder" style="color:#ef4444;">${err.message}</div>`;
        }
    }

    function renderCategoryList() {
        const list = document.getElementById('category-list');
        if (!list) return;
        const cats = allCategories[currentCatType] || [];
        if (!cats.length) {
            list.innerHTML = '<div class="chi-cat placeholder">Chưa có danh mục</div>';
            return;
        }
        list.innerHTML = cats.map(cat => {
            const icon = cat.icon || '';
            const name = cat.name || '';
            return `
                <div class="category-item">
                    <div class="category-item-info">
                        <span class="category-icon">${icon}</span>
                        <span class="category-name">${name}</span>
                    </div>
                    <div class="category-item-actions">
                        <button class="cat-edit-btn" data-name="${name}">Sửa</button>
                        <button class="cat-delete-btn" data-name="${name}">Xóa</button>
                    </div>
                </div>
            `;
        }).join('');
        
        list.querySelectorAll('.cat-edit-btn').forEach(btn => {
            btn.addEventListener('click', () => editCategory(btn.getAttribute('data-name')));
        });
        list.querySelectorAll('.cat-delete-btn').forEach(btn => {
            btn.addEventListener('click', () => deleteCategory(btn.getAttribute('data-name')));
        });
    }

    function editCategory(name) {
        const cats = allCategories[currentCatType] || [];
        const cat = cats.find(c => c.name === name);
        if (!cat) return;
        
        document.getElementById('cat-icon').value = cat.icon || '';
        document.getElementById('cat-name').value = cat.name || '';
        document.getElementById('cat-old-name').value = cat.name || '';
        document.getElementById('cat-edit-mode').value = 'true';
        document.getElementById('cat-submit-btn').textContent = 'Cập nhật';
        document.getElementById('cat-cancel-btn').style.display = 'inline-block';
    }

    async function deleteCategory(name) {
        if (!confirm(`Xóa danh mục "${name}"?`)) return;
        try {
            const res = await fetch('/api/categories', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: currentCatType, name })
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Xóa thất bại');
            
            // Xóa cache để reload từ server
            localStorage.removeItem('chi_categories');
            localStorage.removeItem('thu_categories');
            
            // Reload danh sách trong tab Khác
            await loadCategoriesList();
            resetCategoryForm();
            
            // Reload danh sách ở tab Chi/Thu để cập nhật
            if (currentCatType === 'Chi') {
                await loadChiCategories();
            } else if (currentCatType === 'Thu') {
                await loadThuCategories();
            } else if (currentCatType === 'Quỹ') {
                await loadQuyPurposes();
            }
        } catch (err) {
            alert('Lỗi: ' + err.message);
        }
    }

    function resetCategoryForm() {
        document.getElementById('cat-icon').value = '';
        document.getElementById('cat-name').value = '';
        document.getElementById('cat-old-name').value = '';
        document.getElementById('cat-edit-mode').value = 'false';
        document.getElementById('cat-submit-btn').textContent = 'Thêm';
        document.getElementById('cat-cancel-btn').style.display = 'none';
        const grid = document.getElementById('icon-picker-grid');
        if (grid) grid.style.display = 'none';
    }

    async function submitCategoryForm() {
        const iconEl = document.getElementById('cat-icon');
        const nameEl = document.getElementById('cat-name');
        const editModeEl = document.getElementById('cat-edit-mode');
        const oldNameEl = document.getElementById('cat-old-name');
        
        if (!iconEl || !nameEl || !editModeEl || !oldNameEl) {
            console.error('Không tìm thấy các element cần thiết');
            return;
        }
        
        const icon = (iconEl.value || '').trim();
        const name = (nameEl.value || '').trim();
        const editMode = editModeEl.value === 'true';
        const oldName = oldNameEl.value;
        
        if (!name) {
            alert('Vui lòng nhập tên danh mục');
            return;
        }
        
        try {
            let res;
            if (editMode) {
                res = await fetch('/api/categories', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ 
                        type: currentCatType, 
                        old_name: oldName, 
                        new_name: name, 
                        icon 
                    })
                });
            } else {
                res = await fetch('/api/categories', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ type: currentCatType, name, icon })
                });
            }
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Thao tác thất bại');
            
            // Xóa cache để reload từ server
            localStorage.removeItem('chi_categories');
            localStorage.removeItem('thu_categories');
            
            // Reload danh sách trong tab Khác
            await loadCategoriesList();
            resetCategoryForm();
            
            // Reload danh sách ở tab Chi/Thu để hiển thị danh mục mới
            if (currentCatType === 'Chi') {
                await loadChiCategories();
            } else if (currentCatType === 'Thu') {
                await loadThuCategories();
            } else if (currentCatType === 'Quỹ') {
                await loadQuyPurposes();
            }
        } catch (err) {
            console.error('Lỗi submit category:', err);
            alert('Lỗi: ' + err.message);
        }
    }

    const hash = (window.location.hash || '').toLowerCase();
    if (hash === '#lich') {
        setActiveTab('Lich');
    } else if (hash === '#report') {
        setActiveTab('Report');
    } else if (hash === '#other') {
        setActiveTab('Other');
    } else {
        setActiveTab('Chi');
    }
});

