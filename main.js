document.addEventListener('DOMContentLoaded', () => {
    // ===================================================================
    // 1. VARIÁVEIS GLOBAIS E CONSTANTES
    // ===================================================================
    const appState = {
        companyInfo: null,
        calibration: {},
        receitas: [],
        despesasVariaveis: [],
        despesasFixas: [],
        maoDeObra: [],
    };

    const MASTER_EMAIL = 'admin@traktogestao.com';
    const MASTER_PASSWORD = 'admin123';

    const STORAGE_KEYS = {
        COMPANY: 'corretagestao02_empresa',
        CALIBRATION: 'corretagestao02_calibracao',
        RECEITAS: 'corretagestao02_receitas',
        DV: 'corretagestao02_despesasVariaveis',
        DF: 'corretagestao02_despesasFixas',
        MO: 'corretagestao02_maoDeObra',
    };

    // Elementos da DOM
    const authScreen = document.getElementById('auth-screen');
    const welcomeScreen = document.getElementById('welcome-screen');
    const mainApp = document.getElementById('main-app');
    const companyForm = document.getElementById('company-form');
    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const showRegister = document.getElementById('show-register');
    const showLogin = document.getElementById('show-login');
    const loginFormDiv = document.getElementById('login-form-div');
    const registerFormDiv = document.getElementById('register-form-div');
    const adminScreen = document.getElementById('admin-screen');
    const adminLoginForm = document.getElementById('admin-login-form');
    const adminPanel = document.getElementById('admin-panel');
    const adminEmpresas = document.getElementById('admin-empresas');
    const adminUsuarios = document.getElementById('admin-usuarios');
    const searchEmpresa = document.getElementById('search-empresa');
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');
    const logoutButton = document.getElementById('logout-button');

    // ===================================================================
    // 2. FUNÇÕES DE INICIALIZAÇÃO E ESTADO
    // ===================================================================
    function loadState() {
        appState.companyInfo = JSON.parse(localStorage.getItem(STORAGE_KEYS.COMPANY));
        appState.calibration = JSON.parse(localStorage.getItem(STORAGE_KEYS.CALIBRATION)) || {};
        appState.receitas = JSON.parse(localStorage.getItem(STORAGE_KEYS.RECEITAS)) || [];
        appState.despesasVariaveis = JSON.parse(localStorage.getItem(STORAGE_KEYS.DV)) || [];
        appState.despesasFixas = JSON.parse(localStorage.getItem(STORAGE_KEYS.DF)) || [];
        appState.maoDeObra = JSON.parse(localStorage.getItem(STORAGE_KEYS.MO)) || [];
    }
    
function saveState(key, data) {
localStorage.setItem(key, JSON.stringify(data));
}

    async function ensureMasterUser() {
        try {
            await auth.signInWithEmailAndPassword(MASTER_EMAIL, MASTER_PASSWORD);
            const uid = auth.currentUser.uid;
            const snap = await db.collection('usuarios').doc(uid).get();
            if (!snap.exists) {
                await db.collection('usuarios').doc(uid).set({ nome: 'Admin', tipo_acesso: 'master', status: 'ativo' });
            }
            await auth.signOut();
        } catch (err) {
            try {
                const cred = await auth.createUserWithEmailAndPassword(MASTER_EMAIL, MASTER_PASSWORD);
                await db.collection('usuarios').doc(cred.user.uid).set({ nome: 'Admin', tipo_acesso: 'master', status: 'ativo' });
                await auth.signOut();
            } catch (e) {
                console.error(e);
            }
        }
    }

    function renderAdminEmpresas(list) {
        adminEmpresas.innerHTML = list.map(emp => `
            <div class="border-b py-1 flex items-center justify-between">
                <div>${emp.razao_social} - <span class="text-sm">${emp.status}</span></div>
                <div>
                    <select data-id="${emp.id}" class="validade border rounded p-1 text-xs">
                        <option value="15d">15 dias</option>
                        <option value="6m">6 meses</option>
                        <option value="12m">12 meses</option>
                        <option value="24m">24 meses</option>
                        <option value="fantasma">Fantasma</option>
                    </select>
                    <button class="liberar text-indigo-600 ml-2" data-id="${emp.id}">Salvar</button>
                </div>
            </div>`).join('');
    }

    async function loadAdminData() {
        const empSnapshot = await db.collection('empresas').get();
        window._empresas = empSnapshot.docs.map(d => ({ id: d.id, ...d.data() }));
        renderAdminEmpresas(window._empresas);
        const userSnap = await db.collection('usuarios').get();
        const list = userSnap.docs.filter(doc => doc.data().tipo_acesso !== 'master');
        adminUsuarios.innerHTML = list.map(u => `
            <div class="border-b py-1 flex justify-between items-center">
                ${u.data().nome} - ${u.data().email} - <span class="status">${u.data().status}</span>
                <div>
                    <button class="reset text-indigo-600 mr-2" data-email="${u.data().email}">Resetar Senha</button>
                    <button class="toggle text-indigo-600" data-id="${u.id}">Toggle Status</button>
                </div>
            </div>`).join('');
    }
    
    function init() {
        loadState();
        ensureMasterUser();
        if (window.location.pathname.includes('admin')) {
            showAdminScreen();
            adminLoginForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                try {
                    await auth.signInWithEmailAndPassword(document.getElementById('admin-email').value, document.getElementById('admin-password').value);
                    const snap = await db.collection('usuarios').doc(auth.currentUser.uid).get();
                    if (snap.exists && snap.data().tipo_acesso === 'master') {
                        adminLoginForm.classList.add('hidden');
                        adminPanel.classList.remove('hidden');
                        loadAdminData();
                    } else {
                        alert('Acesso não autorizado');
                        auth.signOut();
                    }
                } catch (err) {
                    alert('Credenciais inválidas');
                }
            });
            adminEmpresas.addEventListener('click', async (ev) => {
                if (ev.target.classList.contains('liberar')) {
                    const id = ev.target.dataset.id;
                    const validade = ev.target.parentElement.querySelector('.validade').value;
                    await db.collection('empresas').doc(id).update({ status: 'ativo', validade });
                    const users = await db.collection('usuarios').where('empresaId', '==', id).get();
                    users.forEach(u => db.collection('usuarios').doc(u.id).update({ status: 'ativo', validade_acesso: validade }));
                    ev.target.textContent = 'Salvo';
                }
            });
            searchEmpresa.addEventListener('input', () => {
                const term = searchEmpresa.value.toLowerCase();
                const filtered = window._empresas.filter(e => e.cnpj?.includes(term) || e.razao_social.toLowerCase().includes(term) || (e.nome_fantasia||'').toLowerCase().includes(term));
                renderAdminEmpresas(filtered);
            });
            adminUsuarios.addEventListener('click', async (ev) => {
                if (ev.target.classList.contains('toggle')) {
                    const id = ev.target.dataset.id;
                    const doc = await db.collection('usuarios').doc(id).get();
                    const newStatus = doc.data().status === 'ativo' ? 'bloqueado' : 'ativo';
                    await db.collection('usuarios').doc(id).update({ status: newStatus });
                    ev.target.parentElement.parentElement.querySelector('.status').textContent = newStatus;
                }
                if (ev.target.classList.contains('reset')) {
                    await auth.sendPasswordResetEmail(ev.target.dataset.email);
                    alert('Email de recuperação enviado');
                }
            });
            return;
        }
        auth.onAuthStateChanged(async user => {
            if (user) {
                const userSnap = await db.collection('usuarios').doc(user.uid).get();
                if (!userSnap.exists) { showAuthScreen(); return; }
                const uData = userSnap.data();
                if (uData.status !== 'ativo') {
                    alert('Cadastro aguardando liberação ou bloqueado.');
                    auth.signOut();
                    return;
                }
                const empSnap = await db.collection('empresas').doc(uData.empresaId).get();
                if (empSnap.exists) {
                    const d = empSnap.data();
                    appState.companyInfo = { id: empSnap.id, name: d.razao_social, cnpj: d.cnpj };
                    saveState(STORAGE_KEYS.COMPANY, appState.companyInfo);
                    document.getElementById('company-name').value = appState.companyInfo.name || '';
                    document.getElementById('company-cnpj').value = appState.companyInfo.cnpj || '';
                    document.getElementById('reg-razao').value = d.razao_social || '';
                    document.getElementById('reg-fantasia').value = d.nome_fantasia || '';
                    document.getElementById('reg-cnpj').value = d.cnpj || '';
                    document.getElementById('reg-endereco').value = d.endereco || '';
                }
                showWelcomeScreen();
            } else {
                showAuthScreen();
            }
        });
        renderAllLists();
        populateCalibrationForm();
        setupReportSelectors();
        addEventListeners();
    }

    // ===================================================================
    // 3. FUNÇÕES DE RENDERIZAÇÃO E UI
    // ===================================================================
    function showAuthScreen() {
        authScreen.style.display = 'flex';
        welcomeScreen.style.display = 'none';
        mainApp.style.display = 'none';
    }

    function showWelcomeScreen() {
        authScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        mainApp.style.display = 'none';
    }

    function showMainApp() {
        document.getElementById('header-company-name').textContent = appState.companyInfo.name;
        document.getElementById('header-company-cnpj').textContent = `CNPJ: ${appState.companyInfo.cnpj}`;
        authScreen.style.display = 'none';
        welcomeScreen.style.display = 'none';
        adminScreen.style.display = 'none';
        mainApp.style.display = 'block';
    }

    function showAdminScreen() {
        authScreen.style.display = 'none';
        welcomeScreen.style.display = 'none';
        mainApp.style.display = 'none';
        adminScreen.style.display = 'flex';
    }

    function switchTab(tabName) {
        tabContents.forEach(content => content.classList.remove('tab-content-active'));
        tabButtons.forEach(button => button.classList.remove('tab-active'));
        document.getElementById(`tab-${tabName}`).classList.add('tab-content-active');
        document.querySelector(`[data-tab="${tabName}"]`).classList.add('tab-active');
    }

    function renderList(containerId, items, columns) {
        const container = document.querySelector(`#${containerId} > div`);
        if (!container) return;

        if (items.length === 0) {
            container.innerHTML = `<p class="text-slate-500 text-center py-4">Nenhum item adicionado ainda.</p>`;
            return;
        }

        const table = document.createElement('table');
        table.className = 'min-w-full divide-y divide-slate-200';
        
        const thead = document.createElement('thead');
        thead.className = 'bg-slate-50';
        thead.innerHTML = `
            <tr>
                ${columns.map(col => `<th scope="col" class="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">${col.header}</th>`).join('')}
                <th scope="col" class="relative px-6 py-3"><span class="sr-only">Ações</span></th>
            </tr>
        `;
        table.appendChild(thead);

        const tbody = document.createElement('tbody');
        tbody.className = 'bg-white divide-y divide-slate-200';
        
        items.forEach(item => {
            const row = document.createElement('tr');
            row.innerHTML = `
                ${columns.map(col => `<td class="px-6 py-4 whitespace-nowrap text-sm text-slate-700">${col.render(item)}</td>`).join('')}
                <td class="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button class="delete-btn text-red-600 hover:text-red-900" data-id="${item.id}" data-type="${containerId.replace('-list', '')}">Excluir</button>
                </td>
            `;
            tbody.appendChild(row);
        });
        table.appendChild(tbody);

        container.innerHTML = '';
        container.appendChild(table);
    }

    function formatCurrency(value) {
        if (value === null || value === undefined || isNaN(parseFloat(value))) {
            return 'R$ 0,00';
        }
        return parseFloat(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    }

    function formatDate(dateString) {
        if (!dateString) return 'N/A';
        const dateParts = dateString.split('-');
        if(dateParts.length !== 3) return dateString;
        const [year, month, day] = dateParts;
        return `${day}/${month}/${year}`;
    }
    
    function formatPercentage(value) {
        return `(${(value || 0).toFixed(2)}%)`;
    }

    function renderAllLists() {
        renderList('receitas-list', appState.receitas, [
            { header: 'Data', render: item => formatDate(item.data) },
            { header: 'Descrição', render: item => item.descricao || 'N/A' },
            { header: 'Tipo', render: item => item.tipo },
            { header: 'Valor', render: item => formatCurrency(item.valor) },
        ]);
        renderList('despesas-variaveis-list', appState.despesasVariaveis, [
            { header: 'Data', render: item => formatDate(item.data) },
            { header: 'Categoria', render: item => item.categoria },
            { header: 'Descrição', render: item => item.descricao || 'N/A' },
            { header: 'Fornecedor', render: item => item.fornecedor || 'N/A' },
            { header: 'Valor', render: item => formatCurrency(item.valor) },
        ]);
        renderList('despesas-fixas-list', appState.despesasFixas, [
            { header: 'Data', render: item => formatDate(item.data) },
            { header: 'Categoria', render: item => item.categoria },
            { header: 'Fornecedor', render: item => item.fornecedor || 'N/A' },
            { header: 'Valor', render: item => formatCurrency(item.valor) },
        ]);
        renderList('mao-de-obra-list', appState.maoDeObra, [
            { header: 'Data', render: item => formatDate(item.data) },
            { header: 'Categoria', render: item => item.categoria },
            { header: 'Fornecedor/Func.', render: item => item.fornecedor || 'N/A' },
            { header: 'Valor', render: item => formatCurrency(item.valor) },
        ]);
    }
    
    function populateCalibrationForm() {
        const form = document.getElementById('calibration-form');
        for (const key in appState.calibration) {
            if (form.elements[key]) {
                form.elements[key].value = appState.calibration[key];
            }
        }
    }
    
    function setupReportSelectors() {
        const today = new Date();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const year = today.getFullYear();
        
        document.getElementById('report-month').value = `${year}-${month}`;
        document.getElementById('report-year').value = year;
    }

    // ===================================================================
    // 4. FUNÇÕES DE MANIPULAÇÃO DE DADOS (ADD/DELETE)
    // ===================================================================

    function handleFormSubmit(event, formId, stateKey, stateArray) {
        event.preventDefault();
        const form = document.getElementById(formId);
        const formData = new FormData(form);
        const newItem = { id: Date.now() };

        for (let [key, value] of formData.entries()) {
             newItem[key] = value;
        }
        
        stateArray.push(newItem);
        saveState(stateKey, stateArray);
        renderAllLists();
        form.reset();
    }

    function showConfirmationModal(text, onConfirm) {
        const modal = document.getElementById('confirmation-modal');
        document.getElementById('modal-text').textContent = text;
        modal.classList.remove('hidden');

        const confirmBtn = document.getElementById('confirm-delete-btn');
        const cancelBtn = document.getElementById('cancel-delete-btn');

        const confirmHandler = () => { onConfirm(); hideModal(); cleanup(); };
        const cancelHandler = () => { hideModal(); cleanup(); };
        const hideModal = () => modal.classList.add('hidden');
        const cleanup = () => {
            confirmBtn.removeEventListener('click', confirmHandler);
            cancelBtn.removeEventListener('click', cancelHandler);
        };

        confirmBtn.addEventListener('click', confirmHandler);
        cancelBtn.addEventListener('click', cancelHandler);
    }

    function handleDelete(id, type) {
        const onConfirm = () => {
            let stateKey;
            switch (type) {
                case 'receitas': appState.receitas = appState.receitas.filter(item => item.id !== parseInt(id)); stateKey = STORAGE_KEYS.RECEITAS; break;
                case 'despesas-variaveis': appState.despesasVariaveis = appState.despesasVariaveis.filter(item => item.id !== parseInt(id)); stateKey = STORAGE_KEYS.DV; break;
                case 'despesas-fixas': appState.despesasFixas = appState.despesasFixas.filter(item => item.id !== parseInt(id)); stateKey = STORAGE_KEYS.DF; break;
                case 'mao-de-obra': appState.maoDeObra = appState.maoDeObra.filter(item => item.id !== parseInt(id)); stateKey = STORAGE_KEYS.MO; break;
                default: console.error('Tipo de exclusão desconhecido:', type); return;
            }
            saveState(stateKey, appState[type.replace(/-/g, '_') === 'despesas_variaveis' ? 'despesasVariaveis' : type.replace(/-/g, '_')]);
            renderAllLists();
        };
        showConfirmationModal('Tem certeza que deseja excluir este item?', onConfirm);
    }

    // ===================================================================
    // 5. LÓGICA DO RELATÓRIO E PDF
    // ===================================================================
    
    function generateReport() {
        const type = document.getElementById('report-type').value;
        let startDate, endDate, periodText;
        
        const toUTCDate = (dateString) => {
            const date = new Date(dateString);
            return new Date(date.valueOf() + date.getTimezoneOffset() * 60 * 1000);
        }

        if (type === 'monthly') {
            const monthValue = document.getElementById('report-month').value;
            if (!monthValue) { alert("Por favor, selecione um mês."); return; }
            const [year, month] = monthValue.split('-');
            startDate = new Date(year, month - 1, 1);
            endDate = new Date(year, month, 0, 23, 59, 59);
            periodText = `${month}/${year}`;
        } else { // yearly
            const year = document.getElementById('report-year').value;
             if (!year) { alert("Por favor, selecione um ano."); return; }
            startDate = new Date(year, 0, 1);
            endDate = new Date(year, 11, 31, 23, 59, 59);
            periodText = `Anual ${year}`;
        }

        const filterByDate = (item) => {
            const itemDate = toUTCDate(item.data);
            return itemDate >= startDate && itemDate <= endDate;
        };

        const receitasFiltradas = appState.receitas.filter(filterByDate);
        const consumoFiltrado = appState.despesasVariaveis.filter(filterByDate);
        const dfFiltrados = appState.despesasFixas.filter(filterByDate);
        const moFiltrados = appState.maoDeObra.filter(filterByDate);
        
        const totalReceitas = receitasFiltradas.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
        const totalConsumo = consumoFiltrado.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
        const totalDF = dfFiltrados.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
        const totalMO = moFiltrados.reduce((sum, item) => sum + parseFloat(item.valor || 0), 0);
        
        const cal = appState.calibration;
        const receitasPorTipo = receitasFiltradas.reduce((acc, item) => {
            acc[item.tipo] = (acc[item.tipo] || 0) + parseFloat(item.valor || 0); return acc;
        }, {});
        
        const impostoFaturamentoValor = (totalReceitas * (parseFloat(cal.imposto_faturamento) || 0)) / 100;
        const encargosDiversosValor = (totalReceitas * (parseFloat(cal.encargos_diversos) || 0)) / 100;
        const taxaDebitoValor = (receitasPorTipo['Débito'] || 0) * (parseFloat(cal.taxa_debito) || 0) / 100;
        const taxaCreditoValor = (receitasPorTipo['Crédito'] || 0) * (parseFloat(cal.taxa_credito) || 0) / 100;
        const comissaoIfoodValor = (receitasPorTipo['iFood'] || 0) * (parseFloat(cal.comissao_ifood) || 0) / 100;
        const comissao99Valor = (receitasPorTipo['99'] || 0) * (parseFloat(cal.comissao_99) || 0) / 100;

        const totalImpostosTaxas = impostoFaturamentoValor + encargosDiversosValor + taxaDebitoValor + taxaCreditoValor + comissaoIfoodValor + comissao99Valor;
        const taxDetails = { impostoFaturamentoValor, encargosDiversosValor, taxaDebitoValor, taxaCreditoValor, comissaoIfoodValor, comissao99Valor };

        const lucroBruto = totalReceitas - totalConsumo;
        const lucroLiquido = lucroBruto - totalDF - totalMO - totalImpostosTaxas;
        
        const perc = (value) => totalReceitas > 0 ? (value / totalReceitas) * 100 : 0;
        const consumoPerc = perc(totalConsumo);
        const dfPerc = perc(totalDF);
        const moPerc = perc(totalMO);
        const impostosPerc = perc(totalImpostosTaxas);
        const liquidoPerc = perc(lucroLiquido);
        
        // Atualizar UI visível
        document.getElementById('report-receita-total').textContent = formatCurrency(totalReceitas);
        document.getElementById('report-consumo').textContent = formatCurrency(totalConsumo);
        document.getElementById('report-consumo-perc').textContent = formatPercentage(consumoPerc);
        document.getElementById('report-lucro-bruto').textContent = formatCurrency(lucroBruto);
        document.getElementById('report-despesas-fixas').textContent = formatCurrency(totalDF);
        document.getElementById('report-despesas-fixas-perc').textContent = formatPercentage(dfPerc);
        document.getElementById('report-mao-de-obra').textContent = formatCurrency(totalMO);
        document.getElementById('report-mao-de-obra-perc').textContent = formatPercentage(moPerc);
        document.getElementById('report-impostos-taxas').textContent = formatCurrency(totalImpostosTaxas);
        document.getElementById('report-impostos-taxas-perc').textContent = formatPercentage(impostosPerc);
        document.getElementById('report-lucro-liquido').textContent = formatCurrency(lucroLiquido);
        document.getElementById('report-lucro-liquido-perc').textContent = formatPercentage(liquidoPerc);
        
        document.getElementById('report-company-name-view').textContent = appState.companyInfo.name;
        document.getElementById('report-company-cnpj-view').textContent = `CNPJ: ${appState.companyInfo.cnpj}`;
        document.getElementById('report-period-view').textContent = `Período: ${periodText}`;
        document.getElementById('report-date-view').textContent = `Gerado em: ${new Date().toLocaleDateString('pt-BR')}`;
        
        // Gerar conteúdo detalhado para o PDF
        generatePdfContent(periodText, { totalReceitas, totalConsumo, lucroBruto, totalDF, totalMO, totalImpostosTaxas, lucroLiquido }, { consumoPerc, dfPerc, moPerc, impostosPerc, liquidoPerc }, { receitasFiltradas, consumoFiltrado, dfFiltrados, moFiltrados }, taxDetails);

        document.getElementById('report-output').classList.remove('hidden');
    }

    function generatePdfContent(periodText, totals, percentages, lists, taxDetails) {
        const { companyInfo, calibration } = appState;
        const detailContainer = document.getElementById('pdf-detailed-content');
        const perc = (value) => totals.totalReceitas > 0 ? (value / totals.totalReceitas * 100).toFixed(2) + '%' : '0.00%';

        const createDetailTable = (title, items, columns) => {
            if (items.length === 0) return '';
            let rows = items.map(item => `
                <tr>
                    ${columns.map(col => `<td>${col.render(item)}</td>`).join('')}
                </tr>
            `).join('');
            return `
                <h3 style="font-size: 12pt; font-weight: bold; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">${title}</h3>
                <table class="pdf-table">
                    <thead>
                        <tr>${columns.map(c => `<th>${c.header}</th>`).join('')}</tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>`;
        };
        
        const createTaxDetailTable = () => {
             return `
                <h3 style="font-size: 12pt; font-weight: bold; margin-top: 20px; border-bottom: 1px solid #ccc; padding-bottom: 5px;">Detalhamento de Impostos e Taxas</h3>
                <table class="pdf-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Calibragem (%)</th>
                            <th>Valor Calculado (R$)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td>Imposto sobre Faturamento</td><td>${calibration.imposto_faturamento || 0}%</td><td>${formatCurrency(taxDetails.impostoFaturamentoValor)}</td></tr>
                        <tr><td>Taxa de Débito</td><td>${calibration.taxa_debito || 0}%</td><td>${formatCurrency(taxDetails.taxaDebitoValor)}</td></tr>
                        <tr><td>Taxa de Crédito</td><td>${calibration.taxa_credito || 0}%</td><td>${formatCurrency(taxDetails.taxaCreditoValor)}</td></tr>
                        <tr><td>Comissão iFood</td><td>${calibration.comissao_ifood || 0}%</td><td>${formatCurrency(taxDetails.comissaoIfoodValor)}</td></tr>
                        <tr><td>Comissão 99</td><td>${calibration.comissao_99 || 0}%</td><td>${formatCurrency(taxDetails.comissao99Valor)}</td></tr>
                        <tr><td>Encargos Diversos</td><td>${calibration.encargos_diversos || 0}%</td><td>${formatCurrency(taxDetails.encargosDiversosValor)}</td></tr>
                        <tr style="font-weight: bold; background-color: #f2f2f2;"><td>Total</td><td></td><td>${formatCurrency(totals.totalImpostosTaxas)}</td></tr>
                    </tbody>
                </table>
            `;
        };

        const receitaCols = [ { header: 'Data', render: item => formatDate(item.data) }, { header: 'Descrição', render: item => item.descricao || 'N/A' }, { header: 'Tipo', render: item => item.tipo }, { header: 'Valor', render: item => formatCurrency(item.valor) }];
        const despesaCols = [ { header: 'Data', render: item => formatDate(item.data) }, { header: 'Categoria', render: item => item.categoria }, { header: 'Descrição', render: item => item.descricao || 'N/A' }, { header: 'Fornecedor', render: item => item.fornecedor || 'N/A' }, { header: 'Valor', render: item => formatCurrency(item.valor) }, { header: 'Part. (%)', render: item => perc(item.valor) } ];
        
        detailContainer.innerHTML = `
            <div class="pdf-header">
                <div>
                    <h2 style="font-size: 16pt; font-weight: bold;">${companyInfo.name}</h2>
                    <p>CNPJ: ${companyInfo.cnpj}</p>
                </div>
                <div style="text-align: right;">
                    <h3 style="font-size: 12pt; font-weight: bold;">Demonstração do Resultado (DRE)</h3>
                    <p>Período: ${periodText}</p>
                    <p style="font-size: 8pt;">Gerado em: ${new Date().toLocaleDateString('pt-BR')}</p>
                </div>
            </div>

            <h3 style="font-size: 12pt; font-weight: bold; margin-top: 20px;">Resumo Financeiro</h3>
            <table class="pdf-summary-table">
                <tbody>
                    <tr><td>(+) Receita Bruta Total</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.totalReceitas)}</td><td style="text-align: right; width: 80px;">100.00%</td></tr>
                    <tr><td>(-) Consumo</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.totalConsumo)}</td><td style="text-align: right;">${formatPercentage(percentages.consumoPerc)}</td></tr>
                    <tr style="background-color: #f2f2f2;"><td>(=) Lucro Bruto</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.lucroBruto)}</td><td></td></tr>
                    <tr><td>(-) Despesas Fixas</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.totalDF)}</td><td style="text-align: right;">${formatPercentage(percentages.dfPerc)}</td></tr>
                    <tr><td>(-) Mão de Obra</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.totalMO)}</td><td style="text-align: right;">${formatPercentage(percentages.moPerc)}</td></tr>
                    <tr><td>(-) Impostos e Taxas</td><td style="text-align: right; font-weight: bold;">${formatCurrency(totals.totalImpostosTaxas)}</td><td style="text-align: right;">${formatPercentage(percentages.impostosPerc)}</td></tr>
                    <tr style="background-color: #e6f7ff;"><td>(=) Lucro Líquido</td><td style="text-align: right; font-weight: bold; font-size: 11pt;">${formatCurrency(totals.lucroLiquido)}</td><td style="text-align: right; font-weight: bold;">${formatPercentage(percentages.liquidoPerc)}</td></tr>
                </tbody>
            </table>
            
            ${createDetailTable('Detalhes das Receitas', lists.receitasFiltradas, receitaCols)}
            ${createDetailTable('Detalhes de Consumo', lists.consumoFiltrado, despesaCols)}
            ${createDetailTable('Detalhes das Despesas Fixas', lists.dfFiltrados, despesaCols)}
            ${createDetailTable('Detalhes de Mão de Obra', lists.moFiltrados, despesaCols)}
            ${createTaxDetailTable()}
        `;
    }

    async function exportPDF() {
        const reportElement = document.getElementById('pdf-detailed-content');
        if (!reportElement) return;
        reportElement.classList.remove('hidden');

        const { jsPDF } = window.jspdf;
        const canvas = await html2canvas(reportElement, { scale: 2, useCORS: true, windowWidth: reportElement.scrollWidth, windowHeight: reportElement.scrollHeight });
        
        reportElement.classList.add('hidden');
        
        const imgData = canvas.toDataURL('image/png');
        const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' });
        
        const imgWidth = 210; // A4 width in mm
        const pageHeight = 295; // A4 height in mm
        const imgHeight = canvas.height * imgWidth / canvas.width;
        let heightLeft = imgHeight;
        let position = 0;

        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;

        while (heightLeft >= 0) {
          position = heightLeft - imgHeight;
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
          heightLeft -= pageHeight;
        }
        
        pdf.save(`DRE_Detalhado_${appState.companyInfo.name.replace(/ /g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`);
    }
    
    // ===================================================================
    // 6. EVENT LISTENERS
    // ===================================================================
    function addEventListeners() {
        companyForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const name = document.getElementById('company-name').value;
            const cnpj = document.getElementById('company-cnpj').value;
            if(auth.currentUser && appState.companyInfo){
                await db.collection('empresas').doc(appState.companyInfo.id).update({ razao_social: name, cnpj });
            }
            if(name && cnpj){
                appState.companyInfo = { ...appState.companyInfo, name, cnpj };
                saveState(STORAGE_KEYS.COMPANY, appState.companyInfo);
                showMainApp();
            }
        });

        logoutButton.addEventListener('click', () => {
            showConfirmationModal('Tem certeza que deseja sair?', () => { localStorage.removeItem(STORAGE_KEYS.COMPANY); auth.signOut(); });
        });

        loginForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            try {
                await auth.signInWithEmailAndPassword(document.getElementById('login-email').value, document.getElementById('login-password').value);
            } catch(err){ alert(err.message); }
        });

        registerForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const data = {
                razao: document.getElementById('reg-razao').value,
                fantasia: document.getElementById('reg-fantasia').value,
                cnpj: document.getElementById('reg-cnpj').value,
                endereco: document.getElementById('reg-endereco').value,
                email: document.getElementById('reg-email').value,
                senha: document.getElementById('reg-senha').value,
            };
            try {
                const cred = await auth.createUserWithEmailAndPassword(data.email, data.senha);
                const empRef = await db.collection('empresas').add({ cnpj: data.cnpj, razao_social: data.razao, nome_fantasia: data.fantasia, endereco: data.endereco, status: 'aguardando', validade: '' });
                await db.collection('usuarios').doc(cred.user.uid).set({ empresaId: empRef.id, nome: data.razao, tipo_acesso: 'admin', status: 'aguardando', validade_acesso: '' });
                alert('Cadastro realizado. Aguarde liberação.');
                registerForm.reset();
                loginFormDiv.classList.remove('hidden');
                registerFormDiv.classList.add('hidden');
            } catch(err){ alert(err.message); }
        });

        showRegister.addEventListener('click', (e)=>{ e.preventDefault(); loginFormDiv.classList.add('hidden'); registerFormDiv.classList.remove('hidden'); });
        showLogin.addEventListener('click', (e)=>{ e.preventDefault(); registerFormDiv.classList.add('hidden'); loginFormDiv.classList.remove('hidden'); });

        tabButtons.forEach(button => button.addEventListener('click', () => switchTab(button.dataset.tab)));

        document.getElementById('calibration-form').addEventListener('submit', (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const newCalibration = {};
            for (let [key, value] of formData.entries()) { newCalibration[key] = value; }
            appState.calibration = newCalibration;
            saveState(STORAGE_KEYS.CALIBRATION, appState.calibration);
            alert('Calibração salva com sucesso!');
        });
        
        document.getElementById('receitas-form').addEventListener('submit', (e) => handleFormSubmit(e, 'receitas-form', STORAGE_KEYS.RECEITAS, appState.receitas));
        document.getElementById('despesas-variaveis-form').addEventListener('submit', (e) => handleFormSubmit(e, 'despesas-variaveis-form', STORAGE_KEYS.DV, appState.despesasVariaveis));
        document.getElementById('despesas-fixas-form').addEventListener('submit', (e) => handleFormSubmit(e, 'despesas-fixas-form', STORAGE_KEYS.DF, appState.despesasFixas));
        document.getElementById('mao-de-obra-form').addEventListener('submit', (e) => handleFormSubmit(e, 'mao-de-obra-form', STORAGE_KEYS.MO, appState.maoDeObra));
        
        mainApp.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-btn')) { handleDelete(e.target.dataset.id, e.target.dataset.type); }
        });

        document.getElementById('report-type').addEventListener('change', (e) => {
            const isMonthly = e.target.value === 'monthly';
            document.getElementById('month-selector-div').style.display = isMonthly ? 'block' : 'none';
            document.getElementById('year-selector-div').style.display = isMonthly ? 'none' : 'block';
        });
        
        document.getElementById('generate-report-btn').addEventListener('click', generateReport);
        document.getElementById('export-pdf-btn').addEventListener('click', exportPDF);
    }

    // ===================================================================
    // 7. PONTO DE ENTRADA DA APLICAÇÃO
    // ===================================================================
    init();
});

