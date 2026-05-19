localforage.config({ name: 'SIGMA_QC_V1', storeName: 'calidad_hincas' });

// Registramos el plugin de las etiquetas de datos en Chart.js
Chart.register(ChartDataLabels);

const DEFECTOS = {
    'C':  { nombre: 'Corte/Mec.', color: '#ff9800' },
    'P':  { nombre: 'POT', color: '#e91e63' },
    'RC': { nombre: 'Revire Cab.', color: '#9c27b0' },
    'RB': { nombre: 'Revire Base', color: '#3f51b5' },
    'CI': { nombre: 'Cimentación', color: '#795548' },
    'E':  { nombre: 'Extracción', color: '#f44336' }
};

const levels = {'': 0, 'H': 1, 'P': 2, 'T': 3, 'O': 4, 'M': 5};
let charts = {};
let PARQUE_MASTER = {};
let DB_CACHE = { totalHincasPlanta: 0, totalHincasPorArco: {}, listaDefectos: [] };

let tableState = {
    filteredData: [],
    currentPage: 1,
    rowsPerPage: 20,
    sortCol: 'fecha',
    sortDir: 'desc'
};

function switchTab(tabId, el) {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    el.classList.add('active');
    document.getElementById('view-' + tabId).classList.add('active');
    
    if (tabId === 'detalle') refreshDetalle();
    else if (tabId === 'global') applyFilters();
    else if (tabId === 'listado') renderListadoTab();
}

async function initDashboard() {
    const saved = await localforage.getItem('PARQUE_MASTER_DATA');
    if (!saved) return;
    PARQUE_MASTER = saved;

    let arcos = [...new Set(Object.values(PARQUE_MASTER).map(tr => tr.arco))].sort();
    const select = document.getElementById('select-arco-dash');
    if (select) select.innerHTML = arcos.map(a => `<option value="${a}">${a}</option>`).join('');

    const hoy = new Date();
    const mesAtras = new Date(); mesAtras.setDate(hoy.getDate() - 30);
    document.getElementById('date-to').value = hoy.toISOString().split('T')[0];
    document.getElementById('date-from').value = mesAtras.toISOString().split('T')[0];

    await construirCache();
    applyFilters();
}

async function construirCache() {
    DB_CACHE.totalHincasPlanta = 0;
    DB_CACHE.listaDefectos = [];

    // 1. Recorremos PARQUE_MASTER solo para sumar la cantidad de hincas (Síncrono y rápido)
    for (let id in PARQUE_MASTER) {
        let tr = PARQUE_MASTER[id];
        let arco = tr.arco, block = tr.block || 'S/B';

        if (!DB_CACHE.totalHincasPorArco[arco]) DB_CACHE.totalHincasPorArco[arco] = { total: 0, bloques: {} };
        if (!DB_CACHE.totalHincasPorArco[arco].bloques[block]) DB_CACHE.totalHincasPorArco[arco].bloques[block] = 0;

        for (let fN in tr.filas) {
            let f = tr.filas[fN];
            DB_CACHE.totalHincasPlanta += f.hincas;
            DB_CACHE.totalHincasPorArco[arco].total += f.hincas;
            DB_CACHE.totalHincasPorArco[arco].bloques[block] += f.hincas;
        }
    }

    // 2. Leemos el índice de golpe (Solo 1 llamada a BD)
    const historial = await localforage.getItem('HISTORIAL_QC') || {};

    // 3. Rellenamos la lista solo con las que tienen defecto
    for (let idHinca in historial) {
        const data = historial[idHinca];
        
        if (data.estado !== '' && DEFECTOS[data.estado]) {
            const match = idHinca.match(/(.*)-F(\d+)-H(\d+)$/);
            
            if (match) {
                const idTracker = match[1];
                const fN = match[2];
                const h = match[3];
                const tr = PARQUE_MASTER[idTracker];
                
                if (tr) {
                    DB_CACHE.listaDefectos.push({
                        arco: tr.arco, 
                        bloque: tr.block || 'S/B',
                        id_tracker: idTracker.split('-').slice(-2).join('-'),
                        ubicacion: `${fN == 2 ? 'MOT' : 'GEM'} - H${h}`,
                        cod_defecto: data.estado,
                        nombre_defecto: DEFECTOS[data.estado].nombre,
                        fecha: data.fecha || 'S/F'
                    });
                }
            }
        }
    }
}

const barChartOptions = { 
    responsive: true, maintainAspectRatio: false, 
    layout: { padding: { top: 25 } },
    plugins: { 
        legend: { display: false },
        datalabels: {
            anchor: 'end', align: 'end', color: '#333', font: { weight: 'bold', size: 13 }
        }
    },
    scales: { y: { beginAtZero: true } }
};

// --- PESTAÑA GLOBAL ---
function applyFilters() {
    const startStr = document.getElementById('date-from').value;
    const endStr = document.getElementById('date-to').value;
    tableState.filteredData = DB_CACHE.listaDefectos.filter(d => d.fecha >= startStr && d.fecha <= endStr);
    
    let conteo = { 'C':0, 'P':0, 'RC':0, 'RB':0, 'CI':0, 'E':0 };
    tableState.filteredData.forEach(d => { conteo[d.cod_defecto]++; });

    let sortedKeys = Object.keys(conteo).sort((a, b) => conteo[b] - conteo[a]);
    let topDefecto = conteo[sortedKeys[0]] > 0 ? DEFECTOS[sortedKeys[0]].nombre : 'Ninguno';
    let totalDefectos = tableState.filteredData.length;
    let indiceRechazo = DB_CACHE.totalHincasPlanta > 0 ? ((totalDefectos / DB_CACHE.totalHincasPlanta) * 100).toFixed(2) : '0.00';

    document.getElementById('kpi-total-defectos').innerText = totalDefectos;
    document.getElementById('kpi-indice-rechazo').innerText = indiceRechazo + '%';
    document.getElementById('kpi-top-defecto').innerText = topDefecto;
    document.getElementById('kpi-extracciones').innerText = conteo['E'];

    document.getElementById('view-global').innerHTML = `
        <div class="dashboard-grid">
            <div class="card">
                <h2>Acumulado por Defecto (Planta)</h2>
                <div style="height: 350px;"><canvas id="chartPareto"></canvas></div>
            </div>
            <div class="card">
                <h2>Distribución de Fallos (%)</h2>
                <div style="height: 350px;"><canvas id="chartPie"></canvas></div>
            </div>
        </div>`;

    if (charts.pareto) charts.pareto.destroy();
    charts.pareto = new Chart(document.getElementById('chartPareto'), {
        type: 'bar',
        data: {
            labels: sortedKeys.map(k => DEFECTOS[k].nombre),
            datasets: [{ data: sortedKeys.map(k => conteo[k]), backgroundColor: sortedKeys.map(k => DEFECTOS[k].color) }]
        },
        options: barChartOptions
    });

    if (charts.pie) charts.pie.destroy();
    charts.pie = new Chart(document.getElementById('chartPie'), {
        type: 'doughnut',
        data: {
            labels: sortedKeys.filter(k => conteo[k] > 0).map(k => DEFECTOS[k].nombre),
            datasets: [{
                data: sortedKeys.filter(k => conteo[k] > 0).map(k => conteo[k]),
                backgroundColor: sortedKeys.filter(k => conteo[k] > 0).map(k => DEFECTOS[k].color)
            }]
        },
        options: { 
            responsive: true, maintainAspectRatio: false,
            plugins: {
                legend: { position: 'right' },
                datalabels: {
                    color: '#fff', font: { weight: 'bold', size: 14 },
                    // CORRECCIÓN: Ahora muestra estrictamente solo el %
                    formatter: (value) => {
                        let perc = totalDefectos > 0 ? ((value / totalDefectos) * 100).toFixed(1) : 0;
                        return value > 0 ? perc + "%" : '';
                    }
                }
            }
        }
    });
}

// --- PESTAÑA DETALLE ARCO ---
async function refreshDetalle() {
    const arco = document.getElementById('select-arco-dash').value;
    const startStr = document.getElementById('date-from').value;
    const endStr = document.getElementById('date-to').value;
    if(!arco || !startStr || !endStr) return;
    
    const defectosArco = DB_CACHE.listaDefectos.filter(d => d.arco === arco && d.fecha >= startStr && d.fecha <= endStr);
    const totalHincasArco = DB_CACHE.totalHincasPorArco[arco]?.total || 1;
    const bloqueStatsArco = DB_CACHE.totalHincasPorArco[arco]?.bloques || {};
    
    let conteo = { 'C':0, 'P':0, 'RC':0, 'RB':0, 'CI':0, 'E':0 };
    let conteoPorBloque = {};
    Object.keys(bloqueStatsArco).forEach(b => conteoPorBloque[b] = 0);
    defectosArco.forEach(d => { 
        conteo[d.cod_defecto]++; 
        if(conteoPorBloque[d.bloque] !== undefined) conteoPorBloque[d.bloque]++;
    });
    
    document.getElementById('kpi-total-defectos').innerText = defectosArco.length;
    document.getElementById('kpi-indice-rechazo').innerText = ((defectosArco.length / totalHincasArco) * 100).toFixed(2) + '%';
    document.getElementById('kpi-extracciones').innerText = conteo['E'];

    let blockLabels = Object.keys(conteoPorBloque).sort();
    let blockLabelsWithContext = blockLabels.map(b => `${b} (${bloqueStatsArco[b]})`);
    let blockRejectRates = blockLabels.map(b => {
        let th = bloqueStatsArco[b];
        return th > 0 ? ((conteoPorBloque[b] / th) * 100).toFixed(2) : 0;
    });

    document.getElementById('detalle-content').innerHTML = `
        <div class="dashboard-grid">
            <div class="card"><h2>Acumulado por Defecto (${arco})</h2><div style="height:350px;"><canvas id="chartArcoPareto"></canvas></div></div>
            <div class="card"><h2>Índice de Rechazo por Bloque (%)</h2><div style="height:350px;"><canvas id="chartRechazoBloque"></canvas></div></div>
        </div>`;

    if (charts.arcoPareto) charts.arcoPareto.destroy();
    let sortedKeys = Object.keys(conteo).sort((a,b) => conteo[b] - conteo[a]);
    charts.arcoPareto = new Chart(document.getElementById('chartArcoPareto'), {
        type: 'bar',
        data: {
            labels: sortedKeys.map(k => DEFECTOS[k].nombre),
            datasets: [{ data: sortedKeys.map(k => conteo[k]), backgroundColor: sortedKeys.map(k => DEFECTOS[k].color) }]
        },
        options: barChartOptions
    });

    if (charts.rechazoBloque) charts.rechazoBloque.destroy();
    charts.rechazoBloque = new Chart(document.getElementById('chartRechazoBloque'), {
        type: 'bar',
        data: {
            labels: blockLabelsWithContext,
            datasets: [{ label: '% de Rechazo', data: blockRejectRates, backgroundColor: '#b0bec5' }]
        },
        options: {
            responsive: true, maintainAspectRatio: false, layout: { padding: { top: 25 } },
            plugins: { 
                legend: { display: false },
                datalabels: {
                    anchor: 'end', align: 'end', color: '#333', font: { weight: 'bold', size: 12 },
                    formatter: (value) => value > 0 ? value + '%' : ''
                }
            },
            scales: { y: { beginAtZero: true } }
        }
    });
}

// --- PESTAÑA LISTADO ---
function renderListadoTab() {
    tableState.filteredData.sort((a, b) => {
        let valA = a[tableState.sortCol], valB = b[tableState.sortCol];
        return tableState.sortDir === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
    });
    const start = (tableState.currentPage - 1) * tableState.rowsPerPage;
    const end = start + tableState.rowsPerPage;
    const paginatedData = tableState.filteredData.slice(start, end);
    let html = paginatedData.map(d => `
        <tr>
            <td><b>${d.arco}</b></td>
            <td>${d.bloque}</td>
            <td>${d.id_tracker}</td>
            <td>${d.ubicacion}</td>
            <td><span class="badge-defecto" style="background:${DEFECTOS[d.cod_defecto].color}">${d.nombre_defecto}</span></td>
            <td>${d.fecha}</td>
        </tr>
    `).join('');
    document.getElementById('body-listado').innerHTML = html || '<tr><td colspan="6">Sin datos para mostrar</td></tr>';
    renderPagination();
}

function renderPagination() {
    const totalPages = Math.ceil(tableState.filteredData.length / tableState.rowsPerPage);
    let html = '';
    for (let i = 1; i <= totalPages; i++) html += `<button class="page-btn ${i === tableState.currentPage ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    document.getElementById('pagination-controls').innerHTML = html;
}
function goToPage(p) { tableState.currentPage = p; renderListadoTab(); }
function changePageSize() { tableState.rowsPerPage = parseInt(document.getElementById('select-rows-per-page').value); tableState.currentPage = 1; renderListadoTab(); }
function sortTable(col) {
    if (tableState.sortCol === col) tableState.sortDir = tableState.sortDir === 'asc' ? 'desc' : 'asc';
    else { tableState.sortCol = col; tableState.sortDir = 'asc'; }
    renderListadoTab();
}
function exportToExcel() {
    let table = document.getElementById('tabla-reparaciones');
    let wb = XLSX.utils.table_to_book(table, {sheet: "Lista_Reparaciones"});
    XLSX.writeFile(wb, "Reporte_QC_Reparaciones.xlsx");
}

initDashboard();