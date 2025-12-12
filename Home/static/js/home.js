/**
 * JavaScript cho trang Home (Dashboard)
 */

// Adjust stat value font size based on available width
function fitStatValue(element) {
    if (!element) return;
    requestAnimationFrame(() => {
        const card = element.closest('.stat-card');
        if (!card) return;

        // Reset to default size before recalculating
        element.style.fontSize = '';

        const maxWidth = card.clientWidth - 48; // padding breathing room
        const computedStyle = window.getComputedStyle(element);
        let fontSize = parseFloat(computedStyle.fontSize);

        // Gradually shrink font-size until the text fits
        while (element.scrollWidth > maxWidth && fontSize > 18) {
            fontSize -= 1.5;
            element.style.fontSize = fontSize + 'px';
        }
    });
}

function fitAllStats() {
    document.querySelectorAll('.stat-value').forEach(fitStatValue);
}

function formatStatValue(value) {
    const num = Number(value);
    const safeValue = Number.isFinite(num) ? num : 0;
    return safeValue.toLocaleString('vi-VN');
}

function updateStatValue(target, value) {
    const element = typeof target === 'string' ? document.getElementById(target) : target;
    if (!element) return;
    element.innerHTML = formatStatValue(value);
    fitStatValue(element);
}

// Load fund (quỹ) summary
async function loadQuySummary() {
    const container = document.getElementById('quy-summary');
    if (!container) return;

    try {
        container.innerHTML = '<div class="loading">Đang tải...</div>';

        const response = await fetch('/api/quy_summary');
        const data = await response.json();

        if (data.error) {
            container.innerHTML = '<p class="error-message">Không tải được dữ liệu quỹ</p>';
            return;
        }

        const byPurpose = data.by_purpose || {};
        const total = parseFloat(data.total || 0);

        if (Object.keys(byPurpose).length === 0) {
            container.innerHTML = '<p class="empty-message">Chưa có giao dịch quỹ nào</p>';
            return;
        }

        const formatCurrency = (value) =>
            parseFloat(value || 0).toLocaleString('vi-VN');

        // Lấy danh sách tên người từ totals_by_person hoặc mặc định là Hưng và Giang
        const totalsByPerson = data.totals_by_person || {};
        const personNames = Object.keys(totalsByPerson).length > 0 
            ? Object.keys(totalsByPerson) 
            : ['Hưng', 'Giang'];

        // Hiển thị tất cả mục đích quỹ với chi tiết theo từng người
        const rowsHtml = Object.entries(byPurpose)
            .filter(([purpose, info]) => {
                const total = typeof info === 'object' && info !== null ? (info.total ?? 0) : (info ?? 0);
                return total > 0;
            })
            .map(([purpose, info]) => {
                const infoObj = typeof info === 'object' && info !== null ? info : { total: info ?? 0 };
                const total = infoObj.total ?? 0;
                
                // Tạo các cột cho từng người
                const personCells = personNames.map(name => {
                    const amount = infoObj[name] ?? 0;
                    return `<td class="amount-cell">${formatCurrency(amount)}</td>`;
                }).join('');

                return `
                <tr>
                    <td>${purpose}</td>
                    ${personCells}
                    <td class="amount-cell">${formatCurrency(total)}</td>
                </tr>
            `;
            }).join('');

        // Tính tổng theo từng người và tổng tất cả
        const personTotals = {};
        let totalAll = 0;
        
        personNames.forEach(name => {
            personTotals[name] = 0;
        });

        Object.entries(byPurpose).forEach(([purpose, info]) => {
            const infoObj = typeof info === 'object' && info !== null ? info : { total: info ?? 0 };
            personNames.forEach(name => {
                personTotals[name] += infoObj[name] ?? 0;
            });
            totalAll += infoObj.total ?? 0;
        });

        // Tạo các cột tổng cho từng người
        const personTotalCells = personNames.map(name => {
            return `<th class="amount-cell">${formatCurrency(personTotals[name] || 0)}</th>`;
        }).join('');

        const html = `
            <div class="table-container">
                <table>
                    <thead>
                        <tr>
                            <th>Mục đích quỹ</th>
                            ${personNames.map(name => `<th>${name}</th>`).join('')}
                            <th>Tổng</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${rowsHtml}
                    </tbody>
                    <tfoot>
                        <tr>
                            <th>Tổng tất cả quỹ</th>
                            ${personTotalCells}
                            <th class="amount-cell">${formatCurrency(totalAll)}</th>
                        </tr>
                    </tfoot>
                </table>
            </div>
        `;

        container.innerHTML = html;
    } catch (error) {
        console.error('Lỗi tải quy_summary:', error);
        container.innerHTML = '<p class="error-message">Lỗi tải dữ liệu quỹ</p>';
    }
}

// Load total fund
async function loadTotalFund() {
    try {
        const response = await fetch('/api/quy_summary');
        const data = await response.json();

        if (!data.error) {
            const total = parseFloat(data.total || 0);
            updateStatValue('total-fund', total);
        }
    } catch (error) {
        console.error('Lỗi load total fund:', error);
    }
}

// Auto refresh summary every 30 seconds
async function refreshSummary() {
    try {
        const response = await fetch('/api/summary');
        const data = await response.json();

        if (data.total_income !== undefined) {
            updateStatValue('total-income', data.total_income);
            updateStatValue('total-expense', data.total_expense);
            updateStatValue('balance', data.balance);
            if (data.total_fund !== undefined) {
                updateStatValue('total-fund', data.total_fund);
            }
        }

        // Refresh fund summary (mục đích quỹ)
        loadQuySummary();
    } catch (error) {
        console.error('Lỗi refresh summary:', error);
    }
}

// Handle navigation links
function setupNavigation() {
    const navLinks = document.querySelectorAll('.nav a[href="#"]');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            alert('Tính năng đang phát triển');
        });
    });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
    loadQuySummary();
    loadTotalFund();
    setupNavigation();
    fitAllStats();
    setInterval(refreshSummary, 30000); // Refresh every 30 seconds
});
