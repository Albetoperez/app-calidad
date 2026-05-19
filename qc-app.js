let currentTask = 'C';
let PARQUE_MASTER = {}; 
let HISTORIAL_QC = {};
// ESTO ES CLAVE: Guardamos en una base de datos distinta
localforage.config({ name: 'SIGMA_QC_V1', storeName: 'calidad_hincas' });

function setTask(task, el) {
    currentTask = task;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

async function importarArchivos(input) {
    const files = input.files;
    if (files.length === 0) return;

    const btn = document.getElementById('btn-import');
    if (btn) btn.innerText = "⏳ Procesando...";
    let ultimoArcoDetectado = '';

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let todaLaData = [];
                    workbook.SheetNames.forEach(sheetName => {
                        todaLaData = todaLaData.concat(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]));
                    });
                    const detectado = procesarDatosJSON(todaLaData);
                    if (detectado) ultimoArcoDetectado = detectado;
                } catch (error) { console.error("Error leyendo Excel:", error); } 
                finally { resolve(); }
            };
            reader.readAsArrayBuffer(file);
        });
    }

    await localforage.setItem('PARQUE_MASTER_DATA', PARQUE_MASTER);
    if (btn) { btn.innerText = `✅ ¡Cargado!`; setTimeout(() => btn.innerText = "📂 Cargar Listados", 2000); }
    input.value = '';
    actualizarSelectores(ultimoArcoDetectado);
}

const parseCoord = (val) => { if(!val) return 0; return parseFloat(String(val).replace(',', '.')); };

function procesarDatosJSON(data) {
    let arcoEnEsteArchivo = '';
    data.forEach(rawRow => {
        let row = {};
        for (let key in rawRow) row[key.trim().toUpperCase()] = rawRow[key];
        const tId = row['CODIGO'], block = row['BLOQUE'] || 'S/B', rawX = row['X'], rawY = row['Y'], filaNum = row['FILA'], hincaIndex = row['HINCA'];
        if (!tId || rawX === undefined || rawY === undefined || !filaNum || !hincaIndex) return;

        const tIdStr = String(tId).trim().toUpperCase();
        if (tIdStr === '') return;

        let arcoId = 'S/A';
        const cleanId = tIdStr.replace(/\s+/g, ''); 
        if (cleanId.includes('ARC1')) arcoId = 'ARC1'; else if (cleanId.includes('ARC2')) arcoId = 'ARC2'; else if (cleanId.includes('ARC3')) arcoId = 'ARC3'; else if (cleanId.includes('ARC4')) arcoId = 'ARC4'; else if (cleanId.includes('ARC5')) arcoId = 'ARC5';

        if (!arcoEnEsteArchivo && arcoId !== 'S/A') arcoEnEsteArchivo = arcoId;
        const x = parseCoord(rawX), y = parseCoord(rawY);
        if (x === 0 && y === 0) return;

        if(!PARQUE_MASTER[tIdStr]) {
            PARQUE_MASTER[tIdStr] = { name: tIdStr, arco: arcoId, block: String(block).trim(), minX: x, maxX: x, minY: y, maxY: y, filas: {} };
        } else {
            PARQUE_MASTER[tIdStr].arco = arcoId; PARQUE_MASTER[tIdStr].minX = Math.min(PARQUE_MASTER[tIdStr].minX, x); PARQUE_MASTER[tIdStr].maxX = Math.max(PARQUE_MASTER[tIdStr].maxX, x); PARQUE_MASTER[tIdStr].minY = Math.min(PARQUE_MASTER[tIdStr].minY, y); PARQUE_MASTER[tIdStr].maxY = Math.max(PARQUE_MASTER[tIdStr].maxY, y);
        }
        if(!PARQUE_MASTER[tIdStr].filas[filaNum]) PARQUE_MASTER[tIdStr].filas[filaNum] = { tipo: filaNum == 2 ? "MOTORA" : "GEMELA", hincas: 0 };
        if(hincaIndex > PARQUE_MASTER[tIdStr].filas[filaNum].hincas) PARQUE_MASTER[tIdStr].filas[filaNum].hincas = parseInt(hincaIndex, 10);
    });
    return arcoEnEsteArchivo;
}

function actualizarSelectores(arcoPreferido) {
    let arcos = new Set();
    Object.values(PARQUE_MASTER).forEach(tr => { if(tr.arco) arcos.add(tr.arco); });
    const sel = document.getElementById('select-arco');
    if (arcos.size === 0) { sel.innerHTML = '<option>Carga un Excel...</option>'; return; }
    sel.innerHTML = Array.from(arcos).sort().map(a => `<option value="${a}">${a}</option>`).join('');
    if (arcoPreferido && arcos.has(arcoPreferido)) sel.value = arcoPreferido;
    actualizarBloques();
}

function actualizarBloques() {
    const arco = document.getElementById('select-arco').value;
    let bloques = new Set();
    Object.values(PARQUE_MASTER).forEach(tr => { if(tr.arco === arco && tr.block) bloques.add(tr.block); });
    document.getElementById('select-block').innerHTML = Array.from(bloques).sort().map(b => `<option value="${b}">BLOQUE ${b}</option>`).join('');
    renderMatrix();
}

async function renderMatrix() {
    const arco = document.getElementById('select-arco').value;
    const block = document.getElementById('select-block').value;
    const container = document.getElementById('matrix-container');
    container.innerHTML = '';
    const ids = Object.keys(PARQUE_MASTER).filter(id => PARQUE_MASTER[id].arco === arco && PARQUE_MASTER[id].block === block);
    if(ids.length === 0) return;
    
    let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
    ids.forEach(id => {
        const tr = PARQUE_MASTER[id];
        if(tr.minX < gMinX) gMinX = tr.minX; if(tr.maxX > gMaxX) gMaxX = tr.maxX;
        if(tr.minY < gMinY) gMinY = tr.minY; if(tr.maxY > gMaxY) gMaxY = tr.maxY;
    });
    
    const rX = (gMaxX - gMinX) || 1, rY = (gMaxY - gMinY) || 1;
    const ZX = 8, ZY = 6, M = 300; 
    let html = `<div class="map-canvas" style="min-width: ${(rX * ZX) + (M * 2)}px; min-height: ${(rY * ZY) + (M * 2)}px;">`;
    
    for (let id of ids) {
        const tr = PARQUE_MASTER[id];
        const pxX = (((tr.minX + tr.maxX) / 2 - gMinX) * ZX) + M;
        const pxY = ((gMaxY - tr.maxY) * ZY) + M;
        let pxH = ((tr.maxY - tr.minY) * ZY); if (pxH < 40) pxH = 40; 
        const filas = Object.keys(tr.filas).sort((a,b) => a-b);
        const esM = filas.length === 1;
        let wS = !esM ? `width: ${((tr.maxX - tr.minX) * ZX) + 22}px; justify-content: space-between;` : `justify-content: center;`;
        
        html += `<div class="prod-card map-card" style="left: ${pxX}px; top: ${pxY}px; height: ${pxH}px; ${wS}">`;
        html += `<div class="tracker-title">${tr.name.split('-').slice(-2).join('-')}</div>`;
        for (let fN of filas) {
            const f = tr.filas[fN];
            let tT = fN == 2 ? 'MOT' : 'GEM', cT = fN == 2 ? 'motora' : 'gemela'; if (esM) { tT = 'MONO'; cT = 'mono'; }
            html += `<div class="row-container"><div class="row-tag ${cT}">${tT}</div><div class="cells-grid">`;
            for (let h = 1; h <= f.hincas; h++) {
                const hId = `${id}-F${fN}-H${h}`;
                const raw = await localforage.getItem(hId);
                const s = (raw && typeof raw === 'object') ? (raw.estado || '') : (raw || '');
                html += `<div class="cell" id="${hId}" onclick="paint('${hId}')" style="background-color:${getStyleByStatus(s)}; color: ${s==='' ? 'transparent' : 'white'};">${s}</div>`;
            }
            html += `</div></div>`;
        }
        html += `</div>`;
    }
    container.innerHTML = html + '</div>';
    actualizarContadores();
}

function getStyleByStatus(s) {
    const c = { 'C': '#ff9800', 'P': '#e91e63', 'RC': '#9c27b0', 'RB': '#3f51b5', 'CI': '#795548', 'E': '#f44336', '': '#fff' };
    return c[s] || '#fff';
}

async function paint(id) {
    const cell = document.getElementById(id);
    const newTask = currentTask === 'NA' ? '' : currentTask;
    
    const raw = await localforage.getItem(id);
    const currentStatus = (raw && typeof raw === 'object') ? (raw.estado || '') : (raw || '');
    const currentDate = (raw && typeof raw === 'object') ? raw.fecha : null;

    if (newTask === '' && currentStatus !== '') {
        if (!confirm(`✅ ¿Confirmas que esta hinca está arreglada y quieres borrar el defecto?`)) return;
    }

    const hoy = new Date().toISOString().split('T')[0]; 
    const dataToSave = {
        estado: newTask,
        fecha: (newTask === '') ? null : (newTask === currentStatus ? (currentDate || hoy) : hoy)
    };

    cell.innerText = newTask; 
    cell.style.backgroundColor = getStyleByStatus(newTask);
    cell.style.color = newTask === '' ? 'transparent' : 'white';
    
    // Guardado dual
    await localforage.setItem(id, dataToSave); 
    
    if (newTask === '') {
        delete HISTORIAL_QC[id]; 
    } else {
        HISTORIAL_QC[id] = dataToSave; 
    }
    await localforage.setItem('HISTORIAL_QC', HISTORIAL_QC); 

    actualizarContadores();
}

async function actualizarContadores() {
    const arco = document.getElementById('select-arco').value;
    const block = document.getElementById('select-block').value;
    if (!block || !PARQUE_MASTER) return;

    // Contadores de defectos
    let cC = 0, cP = 0, cRC = 0, cRB = 0, cCI = 0, cE = 0; 
    const ids = Object.keys(PARQUE_MASTER).filter(id => PARQUE_MASTER[id].arco === arco && PARQUE_MASTER[id].block === block);

    for (let id of ids) {
        for (let fN in PARQUE_MASTER[id].filas) {
            const f = PARQUE_MASTER[id].filas[fN];
            for (let h = 1; h <= f.hincas; h++) {
                const raw = await localforage.getItem(`${id}-F${fN}-H${h}`);
                const st = (raw && typeof raw === 'object') ? (raw.estado || '') : (raw || '');
                if (st === 'C') cC++;
                if (st === 'P') cP++;
                if (st === 'RC') cRC++;
                if (st === 'RB') cRB++;
                if (st === 'CI') cCI++;
                if (st === 'E') cE++;
            }
        }
    }
    
    document.getElementById('summary-block-name').innerText = block;
    document.getElementById('sum-C').innerText = cC;
    document.getElementById('sum-P').innerText = cP;
    document.getElementById('sum-RC').innerText = cRC;
    document.getElementById('sum-RB').innerText = cRB;
    document.getElementById('sum-CI').innerText = cCI;
    document.getElementById('sum-E').innerText = cE;
}

window.onload = async () => {
    const s = await localforage.getItem('PARQUE_MASTER_DATA');
    if(s) { PARQUE_MASTER = s; actualizarSelectores(); }
    
    const h = await localforage.getItem('HISTORIAL_QC');
    if(h) { HISTORIAL_QC = h; }
};