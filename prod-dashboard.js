let PARQUE_MASTER = {};
let HISTORIAL_PROD = {};
let PARQUE_CAJAS = {};
let HISTORIAL_CAJAS = {};
let PARQUE_ZANJAS = {};
let PARQUE_PUNTUALES = {};
let HISTORIAL_ZANJAS = {};
let HISTORIAL_PUNTUALES = {};

const LEVELS = ['H', 'P', 'T', 'O', 'M'];

let chartS = null;
let chartDiario = null;
let chartSCB = null;
let chartDiarioSCB = null;
let chartZanjas = null;
let chartPuntuales = null;

localforage.config({ name: 'SIGMA_PROD_V1', storeName: 'produccion_hincas' });

window.onload = async () => {
    try {
        const s = await localforage.getItem('PARQUE_MASTER_DATA');
        const h = await localforage.getItem('HISTORIAL_PROD');
        const c = await localforage.getItem('PARQUE_CAJAS_DATA');
        const hc = await localforage.getItem('HISTORIAL_CAJAS');
        const z = await localforage.getItem('PARQUE_ZANJAS_DATA');
        const pt = await localforage.getItem('PARQUE_PUNTUALES_DATA');
        const hz = await localforage.getItem('HISTORIAL_ZANJAS');
        const hpt = await localforage.getItem('HISTORIAL_PUNTUALES');

        if (s) PARQUE_MASTER = s;
        if (c) PARQUE_CAJAS = c;
        if (hc) HISTORIAL_CAJAS = hc;
        if (z) PARQUE_ZANJAS = z;
        if (pt) PARQUE_PUNTUALES = pt;
        if (hz) HISTORIAL_ZANJAS = hz;
        if (hpt) HISTORIAL_PUNTUALES = hpt;

        if (h) {
            for (let key in h) {
                h[key] = getMigratedData(h[key]);
            }
            HISTORIAL_PROD = h;
        }

        if (s || c || z || pt) {
            inicializarSelectorArco();
            procesarDashboard();
        } else {
            if(document.getElementById('blocks-accordion-container')) document.getElementById('blocks-accordion-container').innerHTML = '<div style="text-align:center; padding:30px; color:#94a3b8; font-weight:600;">No hay datos cargados.</div>';
        }
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
};

function getMigratedData(raw) {
    let dataToSave = {};
    if (raw && typeof raw === 'object') {
        if (raw.fecha && !raw.H) {
            let maxLvl = LEVELS.indexOf(raw.estado);
            for(let i=0; i<=maxLvl; i++) dataToSave[LEVELS[i]] = raw.fecha;
            dataToSave.estado = raw.estado;
        } else {
            dataToSave = { ...raw };
        }
    } else if (raw && typeof raw === 'string') {
        dataToSave.estado = raw;
    }
    return dataToSave;
}

function switchTabDash(tab) {
    ['mecanica', 'electrica', 'zanjas', 'puntuales'].forEach(t => {
        const btn = document.getElementById('tab-' + t);
        const panel = document.getElementById('panel-' + t);
        if (btn) {
            if (t === tab) btn.classList.add('active');
            else btn.classList.remove('active');
        }
        if (panel) {
            panel.style.display = (t === tab) ? 'block' : 'none';
        }
    });
    procesarDashboard(); 
}

function inicializarSelectorArco() {
    let arcos = new Set();
    Object.values(PARQUE_MASTER).forEach(tr => { if(tr.arco) arcos.add(tr.arco); });
    Object.values(PARQUE_CAJAS).forEach(sb => { if(sb.arco) arcos.add(sb.arco); });
    Object.values(PARQUE_ZANJAS).forEach(z => { if(z.arco) arcos.add(z.arco); });
    Object.values(PARQUE_PUNTUALES).forEach(p => { if(p.arco) arcos.add(p.arco); });
    
    const select = document.getElementById('dash-select-arco');
    if (!select) return;
    let optionsHtml = '<option value="TODOS">🌍 TODOS LOS ARCOS</option>';
    
    Array.from(arcos).sort().forEach(arco => {
        if (arco !== 'S/A') optionsHtml += `<option value="${arco}">⚡ ${arco}</option>`;
    });
    select.innerHTML = optionsHtml;
}

function limpiarFechas() {
    if(document.getElementById('dash-date-from')) document.getElementById('dash-date-from').value = '';
    if(document.getElementById('dash-date-to')) document.getElementById('dash-date-to').value = '';
    procesarDashboard();
}

function toggleAccordion(headerElement) {
    const content = headerElement.nextElementSibling;
    const icon = headerElement.querySelector('i');
    if (content.classList.contains('hidden')) {
        content.classList.remove('hidden');
        if(icon) { icon.classList.remove('fa-chevron-down'); icon.classList.add('fa-chevron-up'); }
    } else {
        content.classList.add('hidden');
        if(icon) { icon.classList.remove('fa-chevron-up'); icon.classList.add('fa-chevron-down'); }
    }
}

function normalizeZanjaType(ref) {
    const r = String(ref).toUpperCase();
    if (r.includes('ENTRADA-PS') || r.includes('ENTRADA PS') || r.includes('ENTRADAPS')) return 'ENTRADA_PS';
    if (r.includes('MT')) return 'MT';
    if (r.includes('BT')) return 'BT';
    if (r.includes('SSAA')) return 'SSAA';
    if (r.includes('ZANJA G') || r.includes('ZANJA-G') || r.includes('ZANJA_G')) return 'PAT';
    if (r.includes('CCTV') || r.includes('LEA')) return 'CCTV';
    return 'OTRAS';
}

function procesarDashboard() {
    const selectEl = document.getElementById('dash-select-arco');
    const arcoSeleccionado = selectEl ? selectEl.value : 'TODOS';
    
    const elDateFrom = document.getElementById('dash-date-from');
    const elDateTo = document.getElementById('dash-date-to');
    const dateFrom = elDateFrom ? elDateFrom.value : '';
    const dateTo = elDateTo ? elDateTo.value : '';
    
    const elChartFilter = document.getElementById('chart-task-filter');
    const tareaCurva = elChartFilter ? elChartFilter.value : 'H';
    
    const enRango = (fecha) => {
        if (!dateFrom && !dateTo) return true;
        if (!fecha) return false;
        if (dateFrom && fecha < dateFrom) return false;
        if (dateTo && fecha > dateTo) return false;
        return true;
    };

    const pMec = document.getElementById('panel-mecanica');
    const pElec = document.getElementById('panel-electrica');
    const pZan = document.getElementById('panel-zanjas');
    const pPun = document.getElementById('panel-puntuales');

    if (pMec && pMec.style.display !== 'none') procesarMecanica(arcoSeleccionado, enRango, tareaCurva);
    if (pElec && pElec.style.display !== 'none') procesarSCB(arcoSeleccionado, enRango);
    if (pZan && pZan.style.display !== 'none') procesarZanjas(arcoSeleccionado);
    if (pPun && pPun.style.display !== 'none') procesarPuntuales(arcoSeleccionado);
}
function procesarMecanica(arcoSeleccionado, enRango, tareaCurva) {
    let trackersFiltrados = Object.values(PARQUE_MASTER);
    if (arcoSeleccionado !== 'TODOS') trackersFiltrados = trackersFiltrados.filter(tr => tr.arco === arcoSeleccionado);

    let tHincas = 0, tFilas = 0;
    let cHincas = 0, cPiruletas = 0, cTorque = 0, cOmegas = 0, cModulos = 0;
    let bloquesData = {}, produccionDiaria = {}, datosCurva = {}; 
    const lv = {'': 0, 'H': 1, 'P': 2, 'T': 3, 'O': 4, 'M': 5};

    trackersFiltrados.forEach(tr => {
        const ar = tr.arco;
        const bKey = `Bloque ${tr.block}`;
        
        if (!bloquesData[ar]) bloquesData[ar] = {};
        if (!bloquesData[ar][bKey]) bloquesData[ar][bKey] = { name: bKey, tH: 0, tF: 0, cH: 0, cP: 0, cT: 0, cO: 0, cM: 0 };

        for (let fN in tr.filas) {
            const f = tr.filas[fN];
            tFilas++; tHincas += f.hincas;
            bloquesData[ar][bKey].tF++;
            bloquesData[ar][bKey].tH += f.hincas;

            let minLvlFila = 5;
            let datesT = [], datesO = [], datesM = [];

            for (let h = 1; h <= f.hincas; h++) {
                const raw = HISTORIAL_PROD[`${tr.name}-F${fN}-H${h}`];
                let data = getMigratedData(raw);
                if (!data.estado) data.estado = '';
                
                const l = lv[data.estado] || 0;
                if (l < minLvlFila) minLvlFila = l;

                const fH = data.H || '';
                const fP = data.P || '';
                if (data.T) datesT.push(data.T);
                if (data.O) datesO.push(data.O);
                if (data.M) datesM.push(data.M);

                if (l >= 1) {
                    if (enRango(fH)) {
                        cHincas++; bloquesData[ar][bKey].cH++;
                    }
                    if (fH && enRango(fH)) {
                        if (!produccionDiaria[fH]) produccionDiaria[fH] = {H:0,P:0,T:0,O:0,M:0};
                        produccionDiaria[fH].H++;
                        if (tareaCurva === 'H') datosCurva[fH] = (datosCurva[fH] || 0) + 1;
                    }
                }
                if (l >= 2) {
                    if (enRango(fP)) {
                        cPiruletas++; bloquesData[ar][bKey].cP++;
                    }
                    if (fP && enRango(fP)) {
                        if (!produccionDiaria[fP]) produccionDiaria[fP] = {H:0,P:0,T:0,O:0,M:0};
                        produccionDiaria[fP].P++;
                        if (tareaCurva === 'P') datosCurva[fP] = (datosCurva[fP] || 0) + 1;
                    }
                }
            }

            if (minLvlFila >= 3) {
                let validDatesT = datesT.filter(d => d);
                let maxDateT = validDatesT.length > 0 ? validDatesT.reduce((a,b) => a > b ? a : b) : '';
                if (enRango(maxDateT)) {
                    cTorque++; bloquesData[ar][bKey].cT++;
                    if (maxDateT && enRango(maxDateT)) {
                        if (!produccionDiaria[maxDateT]) produccionDiaria[maxDateT] = {H:0,P:0,T:0,O:0,M:0};
                        produccionDiaria[maxDateT].T++;
                        if (tareaCurva === 'T') datosCurva[maxDateT] = (datosCurva[maxDateT] || 0) + 1;
                    }
                }
            }

            if (minLvlFila >= 4) {
                let validDatesO = datesO.filter(d => d);
                let maxDateO = validDatesO.length > 0 ? validDatesO.reduce((a,b) => a > b ? a : b) : '';
                if (enRango(maxDateO)) {
                    cOmegas++; bloquesData[ar][bKey].cO++;
                    if (maxDateO && enRango(maxDateO)) {
                        if (!produccionDiaria[maxDateO]) produccionDiaria[maxDateO] = {H:0,P:0,T:0,O:0,M:0};
                        produccionDiaria[maxDateO].O++;
                        if (tareaCurva === 'O') datosCurva[maxDateO] = (datosCurva[maxDateO] || 0) + 1;
                    }
                }
            }

            if (minLvlFila >= 5) {
                let validDatesM = datesM.filter(d => d);
                let maxDateM = validDatesM.length > 0 ? validDatesM.reduce((a,b) => a > b ? a : b) : '';
                if (enRango(maxDateM)) {
                    cModulos++; bloquesData[ar][bKey].cM++;
                    if (maxDateM && enRango(maxDateM)) {
                        if (!produccionDiaria[maxDateM]) produccionDiaria[maxDateM] = {H:0,P:0,T:0,O:0,M:0};
                        produccionDiaria[maxDateM].M++;
                        if (tareaCurva === 'M') datosCurva[maxDateM] = (datosCurva[maxDateM] || 0) + 1;
                    }
                }
            }
        }
    });

    const pctH = tHincas ? ((cHincas / tHincas) * 100).toFixed(1) : 0;
    const pctP = tHincas ? ((cPiruletas / tHincas) * 100).toFixed(1) : 0;
    const pctT = tFilas ? ((cTorque / tFilas) * 100).toFixed(1) : 0;
    const pctO = tFilas ? ((cOmegas / tFilas) * 100).toFixed(1) : 0;
    const pctM = tFilas ? ((cModulos / tFilas) * 100).toFixed(1) : 0;

    const getRowHtml = (lbl, curr, tot, pct, c) => `
        <tr><td style="padding: 10px 0; border-bottom: 1px solid #e8edf4; width: 35%; font-weight: 600; font-size: 12px;">${lbl}</td><td style="padding: 10px 0; border-bottom: 1px solid #e8edf4;"><div style="display: flex; justify-content: space-between; font-weight: 600; font-size: 11px; color: #64748b;"><span>${curr} / ${tot}</span><span style="color:${c}; font-weight: 700;">${pct}%</span></div><div style="width: 100%; background: #e8edf4; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 5px;"><div style="background:${c}; width:${pct}%; height: 100%; border-radius: 4px;"></div></div></td></tr>`;

    if(document.getElementById('tabla-avance-num')) {
        document.getElementById('tabla-avance-num').innerHTML = getRowHtml('Hincas', cHincas, tHincas, pctH, '#ffb300') + getRowHtml('Piruletas', cPiruletas, tHincas, pctP, '#2196f3') + getRowHtml('Torquetubes', cTorque, tFilas, pctT, '#9c27b0') + getRowHtml('Omegas', cOmegas, tFilas, pctO, '#00bcd4') + getRowHtml('Módulos', cModulos, tFilas, pctM, '#4caf50');
    }

    const fechasDiarias = Object.keys(produccionDiaria).sort(); 
    if (chartDiario) chartDiario.destroy();
    const elChartD = document.getElementById('chartDiario');
    if(elChartD) {
        chartDiario = new Chart(elChartD.getContext('2d'), {
            type: 'bar',
            data: {
                labels: fechasDiarias.length ? fechasDiarias : ['Sin datos'],
                datasets: [
                    { label: 'Hincas', data: fechasDiarias.map(f => produccionDiaria[f].H || 0), backgroundColor: '#ffb300', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Piruletas', data: fechasDiarias.map(f => produccionDiaria[f].P || 0), backgroundColor: '#2196f3', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Torquetubes', data: fechasDiarias.map(f => produccionDiaria[f].T || 0), backgroundColor: '#9c27b0', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Omegas', data: fechasDiarias.map(f => produccionDiaria[f].O || 0), backgroundColor: '#00bcd4', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Módulos', data: fechasDiarias.map(f => produccionDiaria[f].M || 0), backgroundColor: '#4caf50', borderRadius: 3, barPercentage: 0.7 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#e8edf4' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } } }
        });
    }

    const fechasOrdenadasS = Object.keys(datosCurva).sort();
    let datosAcumulados = [], acumulado = 0;
    fechasOrdenadasS.forEach(fecha => { acumulado += datosCurva[fecha]; datosAcumulados.push(acumulado); });
    if (chartS) chartS.destroy();
    const comboTask = document.getElementById('chart-task-filter');
    const lblCurva = `Acumulado - ${comboTask ? comboTask.options[comboTask.selectedIndex].text : 'Curva'}`;
    const elChartS = document.getElementById('chartCurvaS');
    if(elChartS) {
        chartS = new Chart(elChartS.getContext('2d'), {
            type: 'line',
            data: { labels: fechasOrdenadasS.length ? fechasOrdenadasS : ['Sin datos'], datasets: [{ label: lblCurva, data: datosAcumulados.length ? datosAcumulados : [0], borderColor: '#005596', backgroundColor: 'rgba(0, 85, 150, 0.1)', borderWidth: 3, fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#e8edf4' } }, x: { grid: { display: false } } }, plugins: { legend: { display: true, position: 'bottom', labels: { boxWidth: 12, padding: 15 } } } }
        });
    }

    let accordionHtml = '';
    const arcosKeys = Object.keys(bloquesData).sort();
    if (arcosKeys.length === 0) { accordionHtml = '<div style="padding:20px; text-align:center; color:#94a3b8; font-weight:600;">No hay bloques registrados.</div>'; } else {
        arcosKeys.forEach(ar => {
            const isHidden = (arcoSeleccionado === 'TODOS') ? 'hidden' : '';
            const iconCls = isHidden ? 'fa-chevron-down' : 'fa-chevron-up';
            accordionHtml += `<div class="accordion-header" onclick="toggleAccordion(this)"><span><i class="fa-solid fa-bolt" style="color: #005596;"></i> ${ar}</span><i class="fa-solid ${iconCls}" style="font-size: 12px; color: #94a3b8;"></i></div><div class="accordion-content ${isHidden}">`;
            accordionHtml += `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px;">`;
            Object.values(bloquesData[ar]).sort((a,b) => a.name.localeCompare(b.name)).forEach(bl => {
                const bPctH = bl.tH ? ((bl.cH / bl.tH) * 100).toFixed(0) : 0, bPctP = bl.tH ? ((bl.cP / bl.tH) * 100).toFixed(0) : 0, bPctT = bl.tF ? ((bl.cT / bl.tF) * 100).toFixed(0) : 0, bPctO = bl.tF ? ((bl.cO / bl.tF) * 100).toFixed(0) : 0, bPctM = bl.tF ? ((bl.cM / bl.tF) * 100).toFixed(0) : 0;
                accordionHtml += `<div style="background:#fafbfc; border:1px solid #e8edf4; border-radius:4px; padding:10px; width:calc(33.33% - 6px); min-width:200px; box-sizing:border-box;"><div style="font-weight:700; color:#005596; font-size:12px; margin-bottom:6px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bl.name}</div><div style="display:flex; flex-direction:column; gap:3px;">
                    <div style="display:flex; align-items:center; gap:6px; font-size:11px;"><span style="color:#ffb300; font-weight:700; width:14px;">H</span><span style="color:#475569; width:65px; white-space:nowrap;">Hincas</span><div style="flex:1; background:#e8edf4; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#ffb300; width:${bPctH}%; height:100%; border-radius:2px;"></div></div><span style="color:#475569; font-weight:600; white-space:nowrap;">${bl.cH}/${bl.tH}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:11px;"><span style="color:#2196f3; font-weight:700; width:14px;">P</span><span style="color:#475569; width:65px; white-space:nowrap;">Piruletas</span><div style="flex:1; background:#e8edf4; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#2196f3; width:${bPctP}%; height:100%; border-radius:2px;"></div></div><span style="color:#475569; font-weight:600; white-space:nowrap;">${bl.cP}/${bl.tH}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:11px;"><span style="color:#9c27b0; font-weight:700; width:14px;">T</span><span style="color:#475569; width:65px; white-space:nowrap;">Torquetubes</span><div style="flex:1; background:#e8edf4; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#9c27b0; width:${bPctT}%; height:100%; border-radius:2px;"></div></div><span style="color:#475569; font-weight:600; white-space:nowrap;">${bl.cT}/${bl.tF}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:11px;"><span style="color:#00bcd4; font-weight:700; width:14px;">O</span><span style="color:#475569; width:65px; white-space:nowrap;">Omegas</span><div style="flex:1; background:#e8edf4; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#00bcd4; width:${bPctO}%; height:100%; border-radius:2px;"></div></div><span style="color:#475569; font-weight:600; white-space:nowrap;">${bl.cO}/${bl.tF}</span></div>
                    <div style="display:flex; align-items:center; gap:6px; font-size:11px;"><span style="color:#4caf50; font-weight:700; width:14px;">M</span><span style="color:#475569; width:65px; white-space:nowrap;">Módulos</span><div style="flex:1; background:#e8edf4; height:4px; border-radius:2px; overflow:hidden;"><div style="background:#4caf50; width:${bPctM}%; height:100%; border-radius:2px;"></div></div><span style="color:#475569; font-weight:600; white-space:nowrap;">${bl.cM}/${bl.tF}</span></div></div></div>`;
            });
            accordionHtml += `</div></div>`;
        });
    }
    if(document.getElementById('blocks-accordion-container')) document.getElementById('blocks-accordion-container').innerHTML = accordionHtml;
}

function procesarSCB(arcoSeleccionado, enRango) {
    let cajasFiltradas = Object.values(PARQUE_CAJAS);
    if (arcoSeleccionado !== 'TODOS') cajasFiltradas = cajasFiltradas.filter(sb => sb.arco === arcoSeleccionado);

    let tCajas = 0, scbRed = 0, scbOrange = 0, scbGreen = 0;
    let chkCounts = { loc: 0, sop: 0, fus: 0, str: 0, bus: 0, lim: 0 };
    let scbBloquesData = {};
    let produccionDiariaSCB = {}; 

    cajasFiltradas.forEach(sb => {
        tCajas++;
        const ar = sb.arco;
        const bKey = `Bloque ${sb.block}`;
        
        if (!scbBloquesData[ar]) scbBloquesData[ar] = {};
        if (!scbBloquesData[ar][bKey]) scbBloquesData[ar][bKey] = { name: bKey, t: 0, r: 0, o: 0, g: 0 };
        scbBloquesData[ar][bKey].t++;

        let checks = HISTORIAL_CAJAS[sb.name] || {};
        let count = 0;
        let fechasCaja = []; 

        const processCheck = (item, type) => {
            if (checks[item]) {
                count++; chkCounts[type]++;
                if (typeof checks[item] === 'string') fechasCaja.push(checks[item]);
            }
        };

        processCheck('localizacion', 'loc');
        processCheck('soportacion', 'sop');
        processCheck('fusibles', 'fus');
        processCheck('con_strings', 'str');
        processCheck('con_bus', 'bus');
        processCheck('limpieza', 'lim');

        if (count === 0) { scbRed++; scbBloquesData[ar][bKey].r++; }
        else if (count === 6) { scbGreen++; scbBloquesData[ar][bKey].g++; }
        else { scbOrange++; scbBloquesData[ar][bKey].o++; }

        if (fechasCaja.length > 0) {
            fechasCaja.sort(); 
            let fInicio = fechasCaja[0]; 
            if (enRango(fInicio)) {
                if (!produccionDiariaSCB[fInicio]) produccionDiariaSCB[fInicio] = { iniciadas: 0, finalizadas: 0 };
                produccionDiariaSCB[fInicio].iniciadas++;
            }

            if (count === 6) { 
                let fFin = fechasCaja[fechasCaja.length - 1]; 
                if (enRango(fFin)) {
                    if (!produccionDiariaSCB[fFin]) produccionDiariaSCB[fFin] = { iniciadas: 0, finalizadas: 0 };
                    produccionDiariaSCB[fFin].finalizadas++;
                }
            }
        }
    });

    const pctScbRed = tCajas ? ((scbRed / tCajas) * 100).toFixed(1) : 0;
    const pctScbOrg = tCajas ? ((scbOrange / tCajas) * 100).toFixed(1) : 0;
    const pctScbGrn = tCajas ? ((scbGreen / tCajas) * 100).toFixed(1) : 0;
    if (chartSCB) chartSCB.destroy();
    const elChartSCB = document.getElementById('chartSCB');
    if(elChartSCB) {
        chartSCB = new Chart(elChartSCB.getContext('2d'), {
            type: 'bar',
            data: {
                labels: ['Localización', 'Soportación', 'Fusibles', 'Conex. Strings', 'Conex. BUS', 'Limpieza'],
                datasets: [{ label: 'Cajas completadas', data: [chkCounts.loc, chkCounts.sop, chkCounts.fus, chkCounts.str, chkCounts.bus, chkCounts.lim], backgroundColor: '#3b82f6', borderRadius: 4 }]
            },
            options: { indexAxis: 'y', responsive: true, maintainAspectRatio: false, scales: { x: { beginAtZero: true, max: tCajas || 1, grid: { color: '#e8edf4' } }, y: { grid: { display: false } } }, plugins: { legend: { display: false } } }
        });
    }

    const fechasSCB = Object.keys(produccionDiariaSCB).sort();
    if (chartDiarioSCB) chartDiarioSCB.destroy();
    const elChartDiarioSCB = document.getElementById('chartDiarioSCB');
    if(elChartDiarioSCB) {
        chartDiarioSCB = new Chart(elChartDiarioSCB.getContext('2d'), {
            type: 'bar',
            data: {
                labels: fechasSCB.length ? fechasSCB : ['Sin datos'],
                datasets: [
                    { label: 'Cajas Comenzadas', data: fechasSCB.map(f => produccionDiariaSCB[f].iniciadas), backgroundColor: '#f97316', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Cajas Finalizadas', data: fechasSCB.map(f => produccionDiariaSCB[f].finalizadas), backgroundColor: '#16a34a', borderRadius: 3, barPercentage: 0.7 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#e8edf4' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, padding: 15 } } } }
        });
    }

    let scbAccordionHtml = '';
    const scbArcosKeys = Object.keys(scbBloquesData).sort();
    if (scbArcosKeys.length === 0) { scbAccordionHtml = '<div style="padding:20px; text-align:center; color:#94a3b8; font-weight:600;">No hay cajas registradas.</div>'; } else {
        scbArcosKeys.forEach(ar => {
            const isHidden = (arcoSeleccionado === 'TODOS') ? 'hidden' : '';
            const iconCls = isHidden ? 'fa-chevron-down' : 'fa-chevron-up';
            scbAccordionHtml += `<div class="accordion-header" onclick="toggleAccordion(this)"><span><i class="fa-solid fa-bolt" style="color: #005596;"></i> ${ar}</span><i class="fa-solid ${iconCls}" style="font-size: 12px; color: #94a3b8;"></i></div><div class="accordion-content ${isHidden}">`;
            scbAccordionHtml += `<div style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px;">`;
            Object.values(scbBloquesData[ar]).sort((a,b) => a.name.localeCompare(b.name)).forEach(bl => {
                const bPctG = bl.t ? ((bl.g / bl.t) * 100).toFixed(0) : 0;
                const bPctR = bl.t ? ((bl.r / bl.t) * 100) : 0;
                const bPctO = bl.t ? ((bl.o / bl.t) * 100) : 0;
                scbAccordionHtml += `<div style="background:#fafbfc; border:1px solid #e8edf4; border-radius:4px; padding:10px; width:calc(33.33% - 6px); min-width:200px; box-sizing:border-box;"><div style="font-weight:700; color:#005596; font-size:12px; margin-bottom:6px; display:flex; justify-content:space-between; align-items:center;"><span style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${bl.name}</span><span style="font-size:11px; color:#16a34a; font-weight:700;">${bPctG}%</span></div>
                    <div style="display:flex; height:6px; border-radius:3px; overflow:hidden; margin-bottom:5px; background:#e8edf4;">
                        <div style="background:#dc2626; width:${bPctR}%;"></div>
                        <div style="background:#f97316; width:${bPctO}%;"></div>
                        <div style="background:#16a34a; width:${bPctG}%;"></div></div>
                    <div style="display:flex; justify-content:space-between; font-size:10px; font-weight:600; color:#475569;">
                        <span style="color:#dc2626">${bl.r} pend.</span><span style="color:#f97316">${bl.o} proc.</span><span style="color:#16a34a">${bl.g} ok</span></div></div>`;
            });
            scbAccordionHtml += `</div></div>`;
        });
    }
    if(document.getElementById('blocks-accordion-scb')) document.getElementById('blocks-accordion-scb').innerHTML = scbAccordionHtml;
}
function procesarZanjas(arcoSeleccionado) {
    const containerZanjas = document.getElementById('contenedor-analitica-zanjas');
    if (!containerZanjas) return;
    
    let zValues = Object.values(PARQUE_ZANJAS);
    if (arcoSeleccionado !== 'TODOS') zValues = zValues.filter(z => z.arco === arcoSeleccionado);
    
    if (zValues.length === 0) {
        containerZanjas.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-weight:600; font-size:14px;">No hay datos de zanjas para el filtro seleccionado.</div>';
        return;
    }

    const FASES = [
        {k:'excavacion', l:'1. Excavación', i:'fa-solid fa-digging'},
        {k:'cama_arena', l:'2. Cama arena', i:'fa-regular fa-circle'},
        {k:'inspeccion_cables', l:'3. Inspección cables', i:'fa-solid fa-magnifying-glass'},
        {k:'ruteado_peinado', l:'4. Ruteado y peinado', i:'fa-solid fa-cable-car'},
        {k:'identificacion_cables', l:'5. Identificación cables', i:'fa-solid fa-tag'},
        {k:'cinta_seguridad', l:'6. Cinta seguridad', i:'fa-solid fa-tape'},
        {k:'cierre_zanja', l:'7. Cierre de zanja', i:'fa-solid fa-check'}
    ];
    const TIPOS = ['MT','BT','SSAA','PAT','CCTV','ENTRADA_PS','OTRAS'];

    let totalMetrosProyecto = 0;
    let metrosPorItem = { excavacion: 0, cama_arena: 0, inspeccion_cables: 0, ruteado_peinado: 0, identificacion_cables: 0, cinta_seguridad: 0, cierre_zanja: 0 };
    let metrosPorTipo = {};
    let metrosPorFaseYTipo = {};

    zValues.forEach(z => {
        const dx = z.x2 - z.x1; const dy = z.y2 - z.y1;
        const longitud = Math.sqrt(dx*dx + dy*dy);
        totalMetrosProyecto += longitud;
        const type = normalizeZanjaType(z.ref);
        if (!metrosPorTipo[type]) metrosPorTipo[type] = { total: 0, ejecutado: 0 };
        metrosPorTipo[type].total += longitud;

        let stats = HISTORIAL_ZANJAS[z.id] || {};
        FASES.forEach(f => {
            const val = stats[f.k] || 0;
            if (val) {
                metrosPorItem[f.k] += val;
                if (!metrosPorFaseYTipo[f.k]) metrosPorFaseYTipo[f.k] = {};
                if (!metrosPorFaseYTipo[f.k][type]) metrosPorFaseYTipo[f.k][type] = 0;
                metrosPorFaseYTipo[f.k][type] += val;
                if (f.k === 'cierre_zanja') metrosPorTipo[type].ejecutado += val;
            }
        });
    });

    if (!window._zanjaFilterType) window._zanjaFilterType = 'TODOS';
    const selType = window._zanjaFilterType;

    const typeTabs = `<div style="display:flex; flex-wrap:wrap; gap:3px;">` +
        `<button class="dash-tab ${selType==='TODOS'?'active':''}" style="font-size:10px;padding:3px 8px;" onclick="window._zanjaFilterType='TODOS';procesarDashboard()">Todos</button>` +
        TIPOS.map(t => `<button class="dash-tab ${selType===t?'active':''}" style="font-size:10px;padding:3px 8px;" onclick="window._zanjaFilterType='${t}';procesarDashboard()">${t}</button>`).join('') +
        `</div>`;

    const baseTotal = selType !== 'TODOS' ? (metrosPorTipo[selType]?.total || 0) : totalMetrosProyecto;

    const phasesGrid = `<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">` +
        FASES.map(f => {
            const phaseTotal = metrosPorItem[f.k];
            const filtered = selType !== 'TODOS' ? (metrosPorFaseYTipo[f.k]?.[selType] || 0) : phaseTotal;
            const pct = baseTotal > 0 ? ((filtered / baseTotal) * 100).toFixed(1) : 0;
            return `<div style="background:#fafbfc;border:1px solid #e8edf4;border-radius:4px;padding:7px 9px;">
                <div style="display:flex;justify-content:space-between;font-size:10px;font-weight:600;color:#475569;margin-bottom:2px;">
                    <span><i class="${f.i}" style="width:12px;color:#005596;font-size:10px;"></i> ${f.l}</span>
                    <span style="color:${f.k==='cierre_zanja'?'#16a34a':'#005596'}">${Math.round(filtered).toLocaleString()}m</span>
                </div>
                <div style="width:100%;background:#e8edf4;height:4px;border-radius:2px;overflow:hidden;">
                    <div style="width:${pct}%;background:${f.k==='cierre_zanja'?'#16a34a':'#3b82f6'};height:100%;border-radius:2px;"></div>
                </div>
                <div style="font-size:9px;color:#94a3b8;margin-top:1px;font-weight:600;">${pct}%</div>
            </div>`;
        }).join('') + `</div>`;

    const labels = []; const diseño = []; const ejec = [];
    TIPOS.forEach(t => {
        if (metrosPorTipo[t] && metrosPorTipo[t].total > 0) {
            labels.push(t); diseño.push(Math.round(metrosPorTipo[t].total)); ejec.push(Math.round(metrosPorTipo[t].ejecutado));
        }
    });

    if (chartZanjas) chartZanjas.destroy();
    const chartHtml = labels.length ? `<div style="margin-bottom:16px;">
        <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:13px;font-weight:700;">Producción por Tipo de Circuito</h3>
        <div style="position:relative;height:200px;width:100%;"><canvas id="chartZanjas"></canvas></div>
    </div>` : '';

    const tableRows = TIPOS.filter(t => metrosPorTipo[t]).map(t => {
        const item = metrosPorTipo[t]; const pend = Math.max(0, item.total - item.ejecutado);
        const p = item.total > 0 ? ((item.ejecutado / item.total) * 100).toFixed(1) : 0;
        return `<tr><td style="font-weight:600;font-size:11px;">${t}</td><td style="text-align:right;font-size:11px;">${Math.round(item.total).toLocaleString()} m</td><td style="text-align:right;color:#16a34a;font-weight:600;font-size:11px;">${Math.round(item.ejecutado).toLocaleString()} m</td><td style="text-align:right;color:#dc2626;font-size:11px;">${Math.round(pend).toLocaleString()} m</td><td style="text-align:right;font-weight:700;font-size:11px;">${p}%</td></tr>`;
    }).join('');

    containerZanjas.innerHTML = `
        <div style="margin-bottom:16px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:10px;">
                <h3 style="margin:0;color:#1e293b;font-size:13px;font-weight:700;">Avance por Fases</h3>
                <span style="font-size:10px;color:#64748b;font-weight:600;">Filtrar:</span>
                ${typeTabs}
            </div>
            ${phasesGrid}
        </div>
        ${chartHtml}
        <div>
            <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:13px;font-weight:700;">Balance por Tipo de Circuito</h3>
            <table class="dash-table"><thead><tr><th style="font-size:10px;">Tipo</th><th style="text-align:right;font-size:10px;">Diseño</th><th style="text-align:right;font-size:10px;">Ejecutado</th><th style="text-align:right;font-size:10px;">Pendiente</th><th style="text-align:right;font-size:10px;">%</th></tr></thead>
            <tbody>${tableRows}</tbody></table>
        </div>`;

    const elChartZ = document.getElementById('chartZanjas');
    if (elChartZ) {
        chartZanjas = new Chart(elChartZ.getContext('2d'), {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [
                    { label: 'Diseño', data: diseño, backgroundColor: '#94a3b8', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Ejecutado', data: ejec, backgroundColor: '#16a34a', borderRadius: 3, barPercentage: 0.7 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#e8edf4' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 } } } } }
        });
    }
}

function procesarPuntuales(arcoSeleccionado) {
    const containerPuntuales = document.getElementById('contenedor-analitica-puntuales');
    if (!containerPuntuales) return;
    
    let pValues = Object.values(PARQUE_PUNTUALES);
    if (arcoSeleccionado !== 'TODOS') pValues = pValues.filter(p => p.arco === arcoSeleccionado);
    
    if (pValues.length === 0) {
        containerPuntuales.innerHTML = '<div style="text-align:center; padding:40px; color:#94a3b8; font-weight:600; font-size:14px;">No hay datos de equipos puntuales para el filtro seleccionado.</div>';
        return;
    }

    let resumenTipos = {};
    let prodDiariaPuntuales = {};

    pValues.forEach(p => {
        const refUp = p.ref.toUpperCase();
        let typeKey = 'otras'; let label = 'Otros Elementos'; let maxChecks = 6;
        if (refUp.includes('ARQUETA')) { typeKey = 'arqueta'; label = 'Arquetas Registro'; maxChecks = 6; }
        else if (refUp.includes('POSTE CAJA')) { typeKey = 'csb'; label = 'Postes Caja (CSB)'; maxChecks = 7; }
        else if (refUp.includes('BÁCULO-CCTV') || refUp.includes('BACULO-CCTV') || refUp.includes('CCTV') || refUp.includes('FC-')) { typeKey = 'cctv'; label = 'Báculos CCTV'; maxChecks = 6; }
        else if (refUp.includes('GATEWAY')) { typeKey = 'gateway'; label = 'Gateways'; maxChecks = 7; }
        else if (refUp.includes('MBOX')) { typeKey = 'mbox'; label = 'Cajas MBox'; maxChecks = 7; }
        else if (refUp.includes('TBOX')) { typeKey = 'tbox'; label = 'Cajas TBox'; maxChecks = 7; }
        else if (refUp.includes('METEO')) { typeKey = 'meteo'; label = 'Estaciones Meteo'; maxChecks = 6; }

        if (!resumenTipos[typeKey]) resumenTipos[typeKey] = { label: label, total: 0, sin_empezar: 0, en_proceso: 0, terminados: 0, maxC: maxChecks };
        resumenTipos[typeKey].total++;
        
        let checks = HISTORIAL_PUNTUALES[p.id] || {};
        let count = 0;
        let fechas = [];
        Object.keys(checks).forEach(k => {
            if (checks[k]) { count++; fechas.push(checks[k]); }
        });
        
        if (count === 0) resumenTipos[typeKey].sin_empezar++;
        else if (count === maxChecks) resumenTipos[typeKey].terminados++;
        else resumenTipos[typeKey].en_proceso++;

        if (fechas.length > 0) {
            fechas.sort();
            const fInicio = fechas[0];
            if (!prodDiariaPuntuales[fInicio]) prodDiariaPuntuales[fInicio] = { iniciadas: 0, finalizadas: 0 };
            prodDiariaPuntuales[fInicio].iniciadas++;

            if (count === maxChecks) {
                const fFin = fechas[fechas.length - 1];
                if (!prodDiariaPuntuales[fFin]) prodDiariaPuntuales[fFin] = { iniciadas: 0, finalizadas: 0 };
                prodDiariaPuntuales[fFin].finalizadas++;
            }
        }
    });

    if (chartPuntuales) chartPuntuales.destroy();
    const fechasPD = Object.keys(prodDiariaPuntuales).sort();
    const elChartPP = document.getElementById('chartPuntuales');
    if (elChartPP) {
        chartPuntuales = new Chart(elChartPP.getContext('2d'), {
            type: 'bar',
            data: {
                labels: fechasPD.length ? fechasPD : ['Sin datos'],
                datasets: [
                    { label: 'Iniciadas', data: fechasPD.map(f => prodDiariaPuntuales[f].iniciadas), backgroundColor: '#f97316', borderRadius: 3, barPercentage: 0.7 },
                    { label: 'Finalizadas', data: fechasPD.map(f => prodDiariaPuntuales[f].finalizadas), backgroundColor: '#16a34a', borderRadius: 3, barPercentage: 0.7 }
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, grid: { color: '#e8edf4' } }, x: { grid: { display: false } } }, plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 10 } } } } }
        });
    }

    containerPuntuales.innerHTML = `
        <h3 style="margin:0 0 10px 0;color:#1e293b;font-size:13px;font-weight:700;">Progreso por Tipo de Equipamiento</h3>
        <table class="dash-table">
            <thead><tr><th style="font-size:10px;">Descripción</th><th style="text-align:center;font-size:10px;">Total</th><th style="text-align:center;font-size:10px;">Pendiente</th><th style="text-align:center;font-size:10px;">En Proceso</th><th style="text-align:center;font-size:10px;">Terminado</th><th style="text-align:center;font-size:10px;">%</th></tr></thead>
            <tbody>
                ${Object.keys(resumenTipos).sort().map(k => {
                    const r = resumenTipos[k]; const pOk = r.total > 0 ? ((r.terminados / r.total) * 100).toFixed(0) : 0;
                    return `<tr><td style="font-weight:600;font-size:11px;">${r.label}</td><td style="text-align:center;font-weight:600;font-size:11px;">${r.total}</td><td style="text-align:center;color:#dc2626;font-size:11px;">${r.sin_empezar}</td><td style="text-align:center;color:#ea580c;font-size:11px;">${r.en_proceso}</td><td style="text-align:center;color:#16a34a;font-weight:600;font-size:11px;">${r.terminados}</td><td style="text-align:center;font-weight:700;font-size:11px;">${pOk}%</td></tr>`;
                }).join('')}
            </tbody>
        </table>`;
}