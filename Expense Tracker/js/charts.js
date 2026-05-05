// =====================================================
// charts.js — Chart.js Chart Rendering
// =====================================================

const Charts = (() => {
    let pieChart = null;
    let barChart = null;

    const CATEGORY_COLORS = {
        'Housing': '#A78BFA',
        'Food & Dining': '#FB923C',
        'Transportation': '#38BDF8',
        'Health & Medical': '#34D399',
        'Entertainment': '#F472B6',
        'Shopping': '#FCD34D',
        'Education': '#818CF8',
        'Savings & Investment': '#2DD4BF',
        'Personal Care': '#FB7185',
        'Travel': '#C084FC',
        'Other': '#9CA3AF',
    };

    const chartDefaults = {
        plugins: {
            legend: {
                labels: {
                    color: '#8B949E',
                    font: { family: 'Inter', size: 12 },
                    boxWidth: 12,
                    padding: 16
                }
            },
            tooltip: {
                backgroundColor: '#1C2333',
                titleColor: '#F0F6FC',
                bodyColor: '#8B949E',
                borderColor: 'rgba(255,255,255,0.08)',
                borderWidth: 1,
                padding: 12,
                titleFont: { family: 'Inter', weight: '600' },
                bodyFont: { family: 'Inter' }
            }
        }
    };

    // Pie/Doughnut chart — spending by category this month
    function renderPieChart(expenses, symbol) {
        const ctx = document.getElementById('pie-chart');
        if (!ctx) return;

        // Aggregate by category for current month
        const now = new Date();
        const thisMonth = expenses.filter(e => {
            const d = new Date(e.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const catTotals = {};
        thisMonth.forEach(e => {
            catTotals[e.category] = (catTotals[e.category] || 0) + parseFloat(e.amount);
        });

        const labels = Object.keys(catTotals);
        const data = Object.values(catTotals);
        const colors = labels.map(l => CATEGORY_COLORS[l] || '#9CA3AF');

        if (pieChart) pieChart.destroy();

        if (labels.length === 0) {
            ctx.getContext('2d').clearRect(0, 0, ctx.width, ctx.height);
            return;
        }

        pieChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.map(c => c + '33'),
                    borderColor: colors,
                    borderWidth: 2,
                    hoverBackgroundColor: colors.map(c => c + '66'),
                    hoverOffset: 8
                }]
            },
            options: {
                ...chartDefaults,
                cutout: '65%',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    ...chartDefaults.plugins,
                    tooltip: {
                        ...chartDefaults.plugins.tooltip,
                        callbacks: {
                            label: (ctx) => ` ${symbol}${ctx.parsed.toFixed(2)}`
                        }
                    }
                }
            }
        });
    }

    // Bar chart — income vs expenses last 6 months
    function renderBarChart(expenses, income, symbol) {
        const ctx = document.getElementById('bar-chart');
        if (!ctx) return;

        const months = [];
        const incomeData = [];
        const expenseData = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(1);
            d.setMonth(d.getMonth() - i);
            const label = d.toLocaleString('default', { month: 'short', year: '2-digit' });
            months.push(label);

            const m = d.getMonth();
            const y = d.getFullYear();

            const exp = expenses
                .filter(e => { const dt = new Date(e.date); return dt.getMonth() === m && dt.getFullYear() === y; })
                .reduce((s, e) => s + parseFloat(e.amount), 0);

            const inc = income
                .filter(e => { const dt = new Date(e.date); return dt.getMonth() === m && dt.getFullYear() === y; })
                .reduce((s, e) => s + parseFloat(e.amount), 0);

            expenseData.push(parseFloat(exp.toFixed(2)));
            incomeData.push(parseFloat(inc.toFixed(2)));
        }

        if (barChart) barChart.destroy();

        barChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: months,
                datasets: [
                    {
                        label: 'Income',
                        data: incomeData,
                        backgroundColor: 'rgba(16,185,129,0.25)',
                        borderColor: '#10B981',
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false
                    },
                    {
                        label: 'Expenses',
                        data: expenseData,
                        backgroundColor: 'rgba(124,58,237,0.25)',
                        borderColor: '#7C3AED',
                        borderWidth: 2,
                        borderRadius: 6,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                ...chartDefaults,
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: { color: '#8B949E', font: { family: 'Inter', size: 11 } }
                    },
                    y: {
                        grid: { color: 'rgba(255,255,255,0.05)' },
                        ticks: {
                            color: '#8B949E',
                            font: { family: 'Inter', size: 11 },
                            callback: v => `${symbol}${v}`
                        },
                        beginAtZero: true
                    }
                },
                plugins: {
                    ...chartDefaults.plugins,
                    tooltip: {
                        ...chartDefaults.plugins.tooltip,
                        callbacks: {
                            label: ctx => ` ${symbol}${ctx.parsed.y.toFixed(2)}`
                        }
                    }
                }
            }
        });
    }

    return { renderPieChart, renderBarChart };
})();
