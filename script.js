// Data Storage - Using localStorage for persistence
    let residents = JSON.parse(localStorage.getItem('residents')) || [];
    let payments = JSON.parse(localStorage.getItem('payments')) || [];
    let expenses = JSON.parse(localStorage.getItem('expenses')) || [];
    let duesConfig = JSON.parse(localStorage.getItem('duesConfig')) || [];
    let announcements = JSON.parse(localStorage.getItem('announcements')) || [];
    let editingResidentId = null;
    let editingAnnouncementId = null;

    // Initialize the application
    document.addEventListener('DOMContentLoaded', function() {
        initializeYearDropdown();
        setDefaultDate();
        loadAllData();
        updateDashboard();
    });

    // Navigation Functions
    function showPage(pageId) {
        // Hide all pages
        document.querySelectorAll('.page').forEach(page => {
            page.classList.remove('active');
        });
        
        // Remove active class from all nav items
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });
        
        // Show selected page
        document.getElementById(pageId).classList.add('active');
        
        // Add active class to clicked nav item
        event.target.classList.add('active');
        
        // Load data for the current page
        if (pageId === 'residents') loadResidents();
        if (pageId === 'income') loadIncome();
        if (pageId === 'expenses') loadExpenses();
        if (pageId === 'reports') loadReports();
        if (pageId === 'dashboard') updateDashboard();
    }

    // Modal Functions
    function openModal(modalId) {
        document.getElementById(modalId).style.display = 'block';
        
        if (modalId === 'paymentModal') {
            populateFlatDropdown();
        }
        if (modalId === 'announcementModal') {
            setDefaultAnnouncementDate();
        }
    }

    function closeModal(modalId) {
        document.getElementById(modalId).style.display = 'none';
        
        // Reset forms
        if (modalId === 'residentModal') {
            document.getElementById('residentForm').reset();
            editingResidentId = null;
            document.getElementById('residentModalTitle').textContent = 'Add Resident';
        }
        if (modalId === 'paymentModal') {
            document.getElementById('paymentForm').reset();
            document.getElementById('duesFields').style.display = 'none';
            document.getElementById('expectedAmountInfo').innerHTML = '';
        }
        if (modalId === 'expenseModal') {
            document.getElementById('expenseForm').reset();
        }
        if (modalId === 'announcementModal') {
            document.getElementById('announcementForm').reset();
            editingAnnouncementId = null;
            document.getElementById('announcementModalTitle').textContent = 'Add Announcement';
        }
    }

    // Utility Functions
    function initializeYearDropdown() {
        const yearSelect = document.getElementById('paymentYear');
        const currentYear = new Date().getFullYear();
        
        for (let year = 2025; year <= 2045; year++) {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            if (year === currentYear) option.selected = true;
            yearSelect.appendChild(option);
        }
    }

    function setDefaultDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('paymentDate').value = today;
        document.getElementById('expenseDate').value = today;
    }

    function setDefaultAnnouncementDate() {
        const today = new Date().toISOString().split('T')[0];
        document.getElementById('announcementDate').value = today;
    }

    function saveToStorage() {
        localStorage.setItem('residents', JSON.stringify(residents));
        localStorage.setItem('payments', JSON.stringify(payments));
        localStorage.setItem('expenses', JSON.stringify(expenses));
        localStorage.setItem('duesConfig', JSON.stringify(duesConfig));
        localStorage.setItem('announcements', JSON.stringify(announcements));
    }

    function loadAllData() {
        loadResidents();
        loadIncome();
        loadExpenses();
        loadReports();
        loadAnnouncements();
    }

    // Dashboard Functions
    function updateDashboard() {
        // Update metrics
        document.getElementById('totalResidents').textContent = residents.length;
        
        const currentMonth = new Date().getMonth() + 1;
        const currentYear = new Date().getFullYear();
        
        const monthlyIncome = payments
            .filter(item => {
                const date = new Date(item.date);
                return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        
        const monthlyExpenses = expenses
            .filter(item => {
                const date = new Date(item.date);
                return date.getMonth() + 1 === currentMonth && date.getFullYear() === currentYear;
            })
            .reduce((sum, item) => sum + parseFloat(item.amount), 0);
        
        document.getElementById('monthlyIncome').textContent = `$${monthlyIncome.toFixed(2)}`;
        document.getElementById('monthlyExpenses').textContent = `$${monthlyExpenses.toFixed(2)}`;
        document.getElementById('netIncome').textContent = `$${(monthlyIncome - monthlyExpenses).toFixed(2)}`;
        
        // Update recent entries
        updateRecentEntries();
    }

    function updateRecentEntries() {
        const recentIncomeDiv = document.getElementById('recentIncome');
        const recentExpensesDiv = document.getElementById('recentExpenses');
        
        // Recent income
        const recentIncome = payments
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        recentIncomeDiv.innerHTML = recentIncome.length ? 
            recentIncome.map(item => `
                <div class="entry-item">
                    <strong>${item.payer}</strong> - $${item.amount}<br>
                    <small>${item.date} | ${item.type}</small>
                </div>
            `).join('') : '<p>No recent income entries</p>';
        
        // Recent expenses
        const recentExpenses = expenses
            .sort((a, b) => new Date(b.date) - new Date(a.date))
            .slice(0, 5);
        
        recentExpensesDiv.innerHTML = recentExpenses.length ?
            recentExpenses.map(item => `
                <div class="entry-item">
                    <strong>${item.category}</strong> - $${item.amount}<br>
                    <small>${item.date} | ${item.description}</small>
                </div>
            `).join('') : '<p>No recent expense entries</p>';
    }

    // Residents Management
    function loadResidents() {
        const tbody = document.querySelector('#residentsTable tbody');
        tbody.innerHTML = residents.map(resident => `
            <tr>
                <td>${resident.flatNo}</td>
                <td>${resident.fullName}</td>
                <td>${resident.phone}</td>
                <td>${resident.email}</td>
                <td><span class="status-${resident.status.toLowerCase()}">${resident.status}</span></td>
                <td>${resident.licensePlate || '-'}</td>
                <td>
                    <button class="btn" onclick="editResident('${resident.id}')">✏️ Edit</button>
                    <button class="btn btn-danger" onclick="deleteResident('${resident.id}')">🗑️ Delete</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('residentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const residentData = {
            id: editingResidentId || Date.now().toString(),
            flatNo: document.getElementById('flatNo').value,
            fullName: document.getElementById('fullName').value,
            phone: document.getElementById('phone').value,
            email: document.getElementById('email').value,
            licensePlate: document.getElementById('licensePlate').value,
            status: document.getElementById('status').value
        };
        
        if (editingResidentId) {
            const index = residents.findIndex(r => r.id === editingResidentId);
            residents[index] = residentData;
        } else {
            residents.push(residentData);
        }
        
        saveToStorage();
        loadResidents();
        loadIncome(); // Refresh income page to update dropdowns
        updateDashboard();
        closeModal('residentModal');
    });

    function editResident(id) {
        const resident = residents.find(r => r.id === id);
        if (resident) {
            editingResidentId = id;
            document.getElementById('flatNo').value = resident.flatNo;
            document.getElementById('fullName').value = resident.fullName;
            document.getElementById('phone').value = resident.phone;
            document.getElementById('email').value = resident.email;
            document.getElementById('licensePlate').value = resident.licensePlate || '';
            document.getElementById('status').value = resident.status;
            document.getElementById('residentModalTitle').textContent = 'Edit Resident';
            openModal('residentModal');
        }
    }

    function deleteResident(id) {
        if (confirm('Are you sure you want to delete this resident?')) {
            residents = residents.filter(r => r.id !== id);
            // Also remove related dues configuration
            duesConfig = duesConfig.filter(d => {
                const resident = residents.find(r => r.flatNo === d.flatNo);
                return resident !== undefined;
            });
            // Remove related payments
            payments = payments.filter(p => {
                const resident = residents.find(r => r.flatNo === p.flatNo);
                return resident !== undefined;
            });
            saveToStorage();
            loadResidents();
            loadIncome(); // Refresh income page
            updateDashboard();
            alert('Resident deleted successfully!');
        }
    }

    // Income Management
    function loadIncome() {
        loadDuesConfig();
        loadPayments();
    }

    function loadDuesConfig() {
        // Populate flat dropdown for configuration
        const configFlatSelect = document.getElementById('configFlatSelect');
        configFlatSelect.innerHTML = '<option value="">Select Flat</option>';
        
        residents.forEach(resident => {
            const option = document.createElement('option');
            option.value = resident.flatNo;
            option.textContent = `${resident.flatNo} - ${resident.fullName}`;
            configFlatSelect.appendChild(option);
        });

        // Load dues configuration table
        const tbody = document.querySelector('#duesConfigTable tbody');
        tbody.innerHTML = residents.map(resident => {
            const config = duesConfig.find(d => d.flatNo === resident.flatNo);
            const dueAmount = config ? config.monthlyDue : 'Not Set';
            
            return `
                <tr>
                    <td>${resident.flatNo}</td>
                    <td>${resident.fullName}</td>
                    <td>${dueAmount !== 'Not Set' ? '$' + dueAmount : dueAmount}</td>
                    <td>
                        ${config ? `<button class="btn btn-warning" onclick="editDuesConfig('${resident.flatNo}')">✏️ Edit</button>
                        <button class="btn btn-danger" onclick="deleteDuesConfig('${resident.flatNo}')">🗑️ Remove</button>` : 
                        `<button class="btn" onclick="setDuesConfig('${resident.flatNo}')">⚙️ Set Amount</button>`}
                    </td>
                </tr>
            `;
        }).join('');
    }

    function saveDuesConfig() {
        const flatNo = document.getElementById('configFlatSelect').value;
        const dueAmount = parseFloat(document.getElementById('configDueAmount').value);
        
        if (!flatNo || !dueAmount) {
            alert('Please select a flat and enter a due amount.');
            return;
        }
        
        const existingIndex = duesConfig.findIndex(d => d.flatNo === flatNo);
        const configData = {
            flatNo: flatNo,
            monthlyDue: dueAmount
        };
        
        if (existingIndex >= 0) {
            duesConfig[existingIndex] = configData;
        } else {
            duesConfig.push(configData);
        }
        
        saveToStorage();
        loadDuesConfig();
        
        // Clear form
        document.getElementById('configFlatSelect').value = '';
        document.getElementById('configDueAmount').value = '';
    }

    function setDuesConfig(flatNo) {
        document.getElementById('configFlatSelect').value = flatNo;
        document.getElementById('configDueAmount').focus();
    }

    function editDuesConfig(flatNo) {
        const config = duesConfig.find(d => d.flatNo === flatNo);
        if (config) {
            document.getElementById('configFlatSelect').value = flatNo;
            document.getElementById('configDueAmount').value = config.monthlyDue;
        }
    }

    function deleteDuesConfig(flatNo) {
        if (confirm('Are you sure you want to remove the dues configuration for this flat?')) {
            duesConfig = duesConfig.filter(d => d.flatNo !== flatNo);
            saveToStorage();
            loadDuesConfig();
            alert('Dues configuration removed successfully!');
        }
    }

    function loadPayments() {
        const tbody = document.querySelector('#paymentsTable tbody');
        tbody.innerHTML = payments.map(payment => {
            const monthYear = payment.type === 'Due' && payment.month && payment.year ? 
                `${getMonthName(payment.month)} ${payment.year}` : '-';
            
            // Check payment status against expected amount
            let statusHtml = '';
            if (payment.type === 'Due') {
                const config = duesConfig.find(d => d.flatNo === payment.flatNo);
                if (config) {
                    const expected = config.monthlyDue;
                    const paid = parseFloat(payment.amount);
                    if (paid >= expected) {
                        statusHtml = '<span class="status-paid">Paid</span>';
                    } else {
                        statusHtml = '<span class="status-partial">Partial</span>';
                    }
                } else {
                    statusHtml = '<span class="status-paid">Paid</span>';
                }
            } else {
                statusHtml = '<span class="status-paid">Extra</span>';
            }
            
            return `
                <tr>
                    <td>${payment.payer}</td>
                    <td>${payment.flatNo}</td>
                    <td>${payment.date}</td>
                    <td>${payment.type}</td>
                    <td>${monthYear}</td>
                    <td>$${payment.amount}</td>
                    <td>${statusHtml}</td>
                    <td>
                        <button class="btn btn-danger" onclick="deletePayment('${payment.id}')">🗑️ Delete</button>
                    </td>
                </tr>
            `;
        }).join('');
    }

    function populateFlatDropdown() {
        const flatSelect = document.getElementById('payerFlat');
        flatSelect.innerHTML = '<option value="">Select Flat</option>';
        
        residents.forEach(resident => {
            const option = document.createElement('option');
            option.value = resident.flatNo;
            option.textContent = `${resident.flatNo} - ${resident.fullName}`;
            flatSelect.appendChild(option);
        });
    }

    function toggleDuesFields() {
        const paymentType = document.getElementById('paymentType').value;
        const duesFields = document.getElementById('duesFields');
        
        if (paymentType === 'Due') {
            duesFields.style.display = 'grid';
            document.getElementById('paymentYear').required = true;
            document.getElementById('paymentMonth').required = true;
        } else {
            duesFields.style.display = 'none';
            document.getElementById('paymentYear').required = false;
            document.getElementById('paymentMonth').required = false;
            document.getElementById('expectedAmountInfo').innerHTML = '';
        }
    }

    function updateExpectedAmount() {
        const flatNo = document.getElementById('payerFlat').value;
        const paymentType = document.getElementById('paymentType').value;
        const expectedAmountInfo = document.getElementById('expectedAmountInfo');
        
        if (paymentType === 'Due' && flatNo) {
            const config = duesConfig.find(d => d.flatNo === flatNo);
            if (config) {
                expectedAmountInfo.innerHTML = `<span style="color: #28a745;">Expected monthly due: $${config.monthlyDue}</span>`;
            } else {
                expectedAmountInfo.innerHTML = '<span style="color: #ffc107;">No monthly due amount configured for this flat</span>';
            }
        } else {
            expectedAmountInfo.innerHTML = '';
        }
    }

    document.getElementById('paymentForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const paymentData = {
            id: Date.now().toString(),
            payer: document.getElementById('payerName').value,
            flatNo: document.getElementById('payerFlat').value,
            date: document.getElementById('paymentDate').value,
            type: document.getElementById('paymentType').value,
            year: document.getElementById('paymentYear').value || null,
            month: document.getElementById('paymentMonth').value || null,
            amount: parseFloat(document.getElementById('paymentAmount').value)
        };
        
        payments.push(paymentData);
        saveToStorage();
        loadPayments();
        updateDashboard();
        closeModal('paymentModal');
    });

    function deletePayment(id) {
        if (confirm('Are you sure you want to delete this payment entry?')) {
            payments = payments.filter(p => p.id !== id);
            saveToStorage();
            loadPayments();
            updateDashboard();
            alert('Payment deleted successfully!');
        }
    }

    // Expenses Management
    function loadExpenses() {
        const tbody = document.querySelector('#expensesTable tbody');
        tbody.innerHTML = expenses.map(expense => `
            <tr>
                <td>${expense.category}</td>
                <td>${expense.description}</td>
                <td>$${expense.amount}</td>
                <td>${expense.date}</td>
                <td>
                    <button class="btn btn-danger" onclick="deleteExpense('${expense.id}')">🗑️ Delete</button>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('expenseForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const expenseData = {
            id: Date.now().toString(),
            category: document.getElementById('expenseCategory').value,
            description: document.getElementById('expenseDescription').value,
            amount: parseFloat(document.getElementById('expenseAmount').value),
            date: document.getElementById('expenseDate').value
        };
        
        expenses.push(expenseData);
        saveToStorage();
        loadExpenses();
        updateDashboard();
        closeModal('expenseModal');
    });

    function deleteExpense(id) {
        if (confirm('Are you sure you want to delete this expense?')) {
            expenses = expenses.filter(e => e.id !== id);
            saveToStorage();
            loadExpenses();
            updateDashboard();
            alert('Expense deleted successfully!');
        }
    }

    // Reports Functions
    function loadReports() {
        populateReportYearDropdown();
        showReportMessages();
    }

    function populateReportYearDropdown() {
        const yearSelect = document.getElementById('reportYearSelect');
        const availableYears = new Set();
        
        // Extract years from payments and expenses
        payments.forEach(payment => {
            if (payment.year) {
                availableYears.add(parseInt(payment.year));
            }
        });
        
        expenses.forEach(expense => {
            const year = new Date(expense.date).getFullYear();
            availableYears.add(year);
        });
        
        // Clear and populate dropdown
        yearSelect.innerHTML = '<option value="">Select Year</option>';
        
        // Sort years in descending order (newest first)
        const sortedYears = Array.from(availableYears).sort((a, b) => b - a);
        
        sortedYears.forEach(year => {
            const option = document.createElement('option');
            option.value = year;
            option.textContent = year;
            yearSelect.appendChild(option);
        });
        
        // Auto-select current year if available
        const currentYear = new Date().getFullYear();
        if (availableYears.has(currentYear)) {
            yearSelect.value = currentYear;
            updateReportsForYear();
        }
    }

    function showReportMessages() {
        document.getElementById('duesReportMessage').style.display = 'block';
        document.getElementById('expenseReportMessage').style.display = 'block';
        document.getElementById('duesReportContainer').style.display = 'none';
        document.getElementById('expenseReportContainer').style.display = 'none';
    }

    function updateReportsForYear() {
        const selectedYear = document.getElementById('reportYearSelect').value;
        
        if (!selectedYear) {
            showReportMessages();
            return;
        }
        
        // Hide messages and show tables
        document.getElementById('duesReportMessage').style.display = 'none';
        document.getElementById('expenseReportMessage').style.display = 'none';
        document.getElementById('duesReportContainer').style.display = 'block';
        document.getElementById('expenseReportContainer').style.display = 'block';
        
        generateDuesReport(parseInt(selectedYear));
        generateExpenseReport(parseInt(selectedYear));
    }

    function generateDuesReport(year) {
        const header = document.getElementById('duesReportHeader');
        const body = document.getElementById('duesReportBody');
        
        // Generate months for the selected year
        const months = [];
        for (let month = 1; month <= 12; month++) {
            const date = new Date(year, month - 1, 1);
            months.push({
                year: year,
                month: month,
                name: date.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        
        // Create header
        header.innerHTML = `
            <tr>
                <th>Flat No</th>
                ${months.map(m => `<th>${m.name}</th>`).join('')}
            </tr>
        `;
        
        // Create body
        body.innerHTML = residents.map(resident => {
            const row = months.map(month => {
                const payment = payments.find(p => 
                    p.flatNo === resident.flatNo && 
                    p.type === 'Due' && 
                    parseInt(p.year) === month.year && 
                    parseInt(p.month) === month.month
                );
                
                if (payment) {
                    const config = duesConfig.find(d => d.flatNo === resident.flatNo);
                    if (config && parseFloat(payment.amount) < config.monthlyDue) {
                        return '<td><span class="partial tooltip" data-tooltip="Partially paid">⚠️ Partial</span></td>';
                    }
                    return '<td><span class="paid tooltip" data-tooltip="Fully paid">✅ Paid</span></td>';
                }
                return '<td><span class="unpaid tooltip" data-tooltip="Dues not paid">❌ Unpaid</span></td>';
            }).join('');
            
            return `<tr><td>${resident.flatNo}</td>${row}</tr>`;
        }).join('');
    }

    function generateExpenseReport(year) {
        const body = document.getElementById('expenseReportBody');
        
        // Filter expenses for the selected year
        const yearExpenses = expenses.filter(expense => {
            const expenseYear = new Date(expense.date).getFullYear();
            return expenseYear === year;
        });
        
        // Group expenses by month
        const monthlyExpenses = {};
        yearExpenses.forEach(expense => {
            const date = new Date(expense.date);
            const month = date.getMonth() + 1;
            const monthName = date.toLocaleDateString('en-US', { month: 'long' });
            
            if (!monthlyExpenses[month]) {
                monthlyExpenses[month] = {
                    name: monthName,
                    total: 0,
                    count: 0
                };
            }
            
            monthlyExpenses[month].total += parseFloat(expense.amount);
            monthlyExpenses[month].count++;
        });
        
        // Generate table rows for all 12 months
        const rows = [];
        for (let month = 1; month <= 12; month++) {
            const monthName = new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
            const data = monthlyExpenses[month];
            
            if (data) {
                rows.push(`
                    <tr>
                        <td>${data.name}</td>
                        <td>$${data.total.toFixed(2)}</td>
                        <td>${data.count}</td>
                    </tr>
                `);
            } else {
                rows.push(`
                    <tr>
                        <td>${monthName}</td>
                        <td>$0.00</td>
                        <td>0</td>
                    </tr>
                `);
            }
        }
        
        body.innerHTML = rows.join('');
    }

    // Export Functions
    function exportDuesReport() {
        const selectedYear = document.getElementById('reportYearSelect').value;
        if (!selectedYear) {
            alert('Please select a year first.');
            return;
        }
        
        // Generate months for the selected year
        const months = [];
        for (let month = 1; month <= 12; month++) {
            const date = new Date(selectedYear, month - 1, 1);
            months.push({
                year: parseInt(selectedYear),
                month: month,
                name: date.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        
        let csvContent = 'Flat No,' + months.map(m => m.name).join(',') + '\n';
        
        residents.forEach(resident => {
            const row = [resident.flatNo];
            months.forEach(month => {
                const payment = payments.find(p => 
                    p.flatNo === resident.flatNo && 
                    p.type === 'Due' && 
                    parseInt(p.year) === month.year && 
                    parseInt(p.month) === month.month
                );
                
                if (payment) {
                    const config = duesConfig.find(d => d.flatNo === resident.flatNo);
                    if (config && parseFloat(payment.amount) < config.monthlyDue) {
                        row.push('⚠️ Partial');
                    } else {
                        row.push('✅ Paid');
                    }
                } else {
                    row.push('❌ Unpaid');
                }
            });
            csvContent += row.join(',') + '\n';
        });
        
        downloadCSV(csvContent, `dues-report-${selectedYear}.csv`);
    }

    function exportExpenseReport() {
        const selectedYear = document.getElementById('reportYearSelect').value;
        if (!selectedYear) {
            alert('Please select a year first.');
            return;
        }
        
        let csvContent = 'Month,Total Expenses,Number of Transactions\n';
        
        // Filter expenses for the selected year
        const yearExpenses = expenses.filter(expense => {
            const expenseYear = new Date(expense.date).getFullYear();
            return expenseYear === parseInt(selectedYear);
        });
        
        // Group expenses by month
        const monthlyExpenses = {};
        yearExpenses.forEach(expense => {
            const date = new Date(expense.date);
            const month = date.getMonth() + 1;
            const monthName = date.toLocaleDateString('en-US', { month: 'long' });
            
            if (!monthlyExpenses[month]) {
                monthlyExpenses[month] = {
                    name: monthName,
                    total: 0,
                    count: 0
                };
            }
            
            monthlyExpenses[month].total += parseFloat(expense.amount);
            monthlyExpenses[month].count++;
        });
        
        // Generate CSV for all 12 months
        for (let month = 1; month <= 12; month++) {
            const monthName = new Date(selectedYear, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
            const data = monthlyExpenses[month];
            
            if (data) {
                csvContent += `${data.name},${data.total.toFixed(2)},${data.count}\n`;
            } else {
                csvContent += `${monthName},0.00,0\n`;
            }
        }
        
        downloadCSV(csvContent, `expense-report-${selectedYear}.csv`);
    }

    function exportDuesReportExcel() {
        const selectedYear = document.getElementById('reportYearSelect').value;
        if (!selectedYear) {
            alert('Please select a year first.');
            return;
        }
        
        // Generate months for the selected year
        const months = [];
        for (let month = 1; month <= 12; month++) {
            const date = new Date(selectedYear, month - 1, 1);
            months.push({
                year: parseInt(selectedYear),
                month: month,
                name: date.toLocaleDateString('en-US', { month: 'short' })
            });
        }
        
        // Create Excel-compatible HTML table
        let excelContent = `
            <table>
                <tr>
                    <th>Flat No</th>
                    ${months.map(m => `<th>${m.name}</th>`).join('')}
                </tr>
        `;
        
        residents.forEach(resident => {
            excelContent += '<tr>';
            excelContent += `<td>${resident.flatNo}</td>`;
            
            months.forEach(month => {
                const payment = payments.find(p => 
                    p.flatNo === resident.flatNo && 
                    p.type === 'Due' && 
                    parseInt(p.year) === month.year && 
                    parseInt(p.month) === month.month
                );
                
                let status = '❌ Unpaid';
                if (payment) {
                    const config = duesConfig.find(d => d.flatNo === resident.flatNo);
                    if (config && parseFloat(payment.amount) < config.monthlyDue) {
                        status = '⚠️ Partial';
                    } else {
                        status = '✅ Paid';
                    }
                }
                excelContent += `<td>${status}</td>`;
            });
            
            excelContent += '</tr>';
        });
        
        excelContent += '</table>';
        
        downloadExcel(excelContent, `dues-report-${selectedYear}.xlsx`);
    }

    function exportExpenseReportExcel() {
        const selectedYear = document.getElementById('reportYearSelect').value;
        if (!selectedYear) {
            alert('Please select a year first.');
            return;
        }
        
        // Filter expenses for the selected year
        const yearExpenses = expenses.filter(expense => {
            const expenseYear = new Date(expense.date).getFullYear();
            return expenseYear === parseInt(selectedYear);
        });
        
        // Group expenses by month
        const monthlyExpenses = {};
        yearExpenses.forEach(expense => {
            const date = new Date(expense.date);
            const month = date.getMonth() + 1;
            const monthName = date.toLocaleDateString('en-US', { month: 'long' });
            
            if (!monthlyExpenses[month]) {
                monthlyExpenses[month] = {
                    name: monthName,
                    total: 0,
                    count: 0
                };
            }
            
            monthlyExpenses[month].total += parseFloat(expense.amount);
            monthlyExpenses[month].count++;
        });
        
        // Create Excel-compatible HTML table
        let excelContent = `
            <table>
                <tr>
                    <th>Month</th>
                    <th>Total Expenses</th>
                    <th>Number of Transactions</th>
                </tr>
        `;
        
        // Generate table rows for all 12 months
        for (let month = 1; month <= 12; month++) {
            const monthName = new Date(selectedYear, month - 1, 1).toLocaleDateString('en-US', { month: 'long' });
            const data = monthlyExpenses[month];
            
            if (data) {
                excelContent += `
                    <tr>
                        <td>${data.name}</td>
                        <td>${data.total.toFixed(2)}</td>
                        <td>${data.count}</td>
                    </tr>
                `;
            } else {
                excelContent += `
                    <tr>
                        <td>${monthName}</td>
                        <td>0.00</td>
                        <td>0</td>
                    </tr>
                `;
            }
        }
        
        excelContent += '</table>';
        
        downloadExcel(excelContent, `expense-report-${selectedYear}.xlsx`);
    }

    function downloadCSV(csvContent, filename) {
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function downloadExcel(htmlContent, filename) {
        // Create Excel-compatible content with proper headers
        const excelContent = `
            <html xmlns:o="urn:schemas-microsoft-com:office:office" 
                  xmlns:x="urn:schemas-microsoft-com:office:excel" 
                  xmlns="http://www.w3.org/TR/REC-html40">
            <head>
                <meta charset="utf-8">
                <!--[if gte mso 9]>
                <xml>
                    <x:ExcelWorkbook>
                        <x:ExcelWorksheets>
                            <x:ExcelWorksheet>
                                <x:Name>Report</x:Name>
                                <x:WorksheetSource HRef="sheet001.htm"/>
                            </x:ExcelWorksheet>
                        </x:ExcelWorksheets>
                    </x:ExcelWorkbook>
                </xml>
                <![endif]-->
                <style>
                    table { border-collapse: collapse; width: 100%; }
                    th, td { border: 1px solid #000; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; font-weight: bold; }
                </style>
            </head>
            <body>
                ${htmlContent}
            </body>
            </html>
        `;
        
        const blob = new Blob([excelContent], { 
            type: 'application/vnd.ms-excel;charset=utf-8;' 
        });
        
        const link = document.createElement('a');
        if (link.download !== undefined) {
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', filename);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    // Utility Functions
    function getMonthName(monthNumber) {
        const months = [
            'January', 'February', 'March', 'April', 'May', 'June',
            'July', 'August', 'September', 'October', 'November', 'December'
        ];
        return months[monthNumber - 1];
    }

    // Announcements Management
    function loadAnnouncements() {
        const announcementsList = document.getElementById('announcementsList');
        
        if (announcements.length === 0) {
            announcementsList.innerHTML = `
                <div class="empty-announcements">
                    <h4>📢 No Announcements Yet</h4>
                    <p>Click "Add Announcement" to create your first announcement for residents.</p>
                </div>
            `;
            return;
        }
        
        // Sort announcements by date (newest first)
        const sortedAnnouncements = announcements.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        announcementsList.innerHTML = sortedAnnouncements.map(announcement => {
            const typeIcons = {
                info: '📘',
                warning: '⚠️',
                alert: '🚨'
            };
            
            return `
                <div class="announcement-card ${announcement.type}">
                    <div class="announcement-header">
                        <h4 class="announcement-title">
                            ${typeIcons[announcement.type]} ${announcement.title}
                        </h4>
                        <div class="announcement-date">
                            🗓️ ${formatDate(announcement.date)}
                        </div>
                    </div>
                    <div class="announcement-message">
                        ${announcement.message}
                    </div>
                    <div class="announcement-actions">
                        <button class="btn btn-small" onclick="editAnnouncement('${announcement.id}')">✏️ Edit</button>
                        <button class="btn btn-danger btn-small" onclick="deleteAnnouncement('${announcement.id}')">🗑️ Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    document.getElementById('announcementForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const announcementData = {
            id: editingAnnouncementId || Date.now().toString(),
            title: document.getElementById('announcementTitle').value,
            type: document.getElementById('announcementType').value,
            message: document.getElementById('announcementMessage').value,
            date: document.getElementById('announcementDate').value
        };
        
        if (editingAnnouncementId) {
            const index = announcements.findIndex(a => a.id === editingAnnouncementId);
            announcements[index] = announcementData;
        } else {
            announcements.push(announcementData);
        }
        
        saveToStorage();
        loadAnnouncements();
        closeModal('announcementModal');
    });

    function editAnnouncement(id) {
        const announcement = announcements.find(a => a.id === id);
        if (announcement) {
            editingAnnouncementId = id;
            document.getElementById('announcementTitle').value = announcement.title;
            document.getElementById('announcementType').value = announcement.type;
            document.getElementById('announcementMessage').value = announcement.message;
            document.getElementById('announcementDate').value = announcement.date;
            document.getElementById('announcementModalTitle').textContent = 'Edit Announcement';
            openModal('announcementModal');
        }
    }

    function deleteAnnouncement(id) {
        if (confirm('Are you sure you want to delete this announcement?')) {
            announcements = announcements.filter(a => a.id !== id);
            saveToStorage();
            loadAnnouncements();
            alert('Announcement deleted successfully!');
        }
    }

    function formatDate(dateString) {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    }

    // Close modals when clicking outside
    window.onclick = function(event) {
        if (event.target.classList.contains('modal')) {
            event.target.style.display = 'none';
        }
    }