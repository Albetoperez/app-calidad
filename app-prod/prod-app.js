let currentTask = 'H';
let currentAppMode = 'EM';

let PARQUE_MASTER = {}; 
let HISTORIAL_PROD = {};
let PARQUE_ESTACIONES = {};
let PARQUE_CAJAS = {}; 
let HISTORIAL_CAJAS = {};
let PARQUE_ZANJAS = {}; 
let PARQUE_PUNTUALES = {};
let HISTORIAL_ZANJAS = {}; 
let HISTORIAL_VALLADO = {};
let HISTORIAL_PUNTUALES = {};
let PARQUE_VALLADO = {}; 
let _currentCajaId = null;
let _currentPuntual = null; 

let pzScale = 1;
let pzPointX = 0;
let pzPointY = 0;
let pzCurrentArco = null;

let zaPanelCollapsed = false;
let zaLayerState = {
    zanja: { 'MT': true, 'BT': true, 'SSAA': true, 'PAT': true, 'CCTV': true, 'ENTRADA_PS': true, 'OTRAS': true },
    puntual: { 'arqueta': true, 'gateway': true, 'mbox': true, 'tbox': true, 'meteo': true, 'csb': true, 'cctv': true } 
};

localforage.config({ name: 'SIGMA_PROD_V1', storeName: 'produccion_hincas' });

const LEVELS = ['H', 'P', 'T', 'O', 'M'];

const CHECKLIST_PUNTUALES = {
    'arqueta': [
        {id: 'excavacion', label: '⛏️ Excavación'}, 
        {id: 'colocacion', label: '🏗️ Colocación'}, 
        {id: 'tapado', label: '🪨 Tapado'}, 
        {id: 'sellado', label: '💧 Sellado'}, 
        {id: 'marco', label: '🧱 Marco Hormigón'}, 
        {id: 'tapa', label: '🚪 Tapa'}
    ],
    'baculo': [
        {id: 'localizacion', label: '📍 Localización'},
        {id: 'cimentacion', label: '🧱 Cimentación'},
        {id: 'anclajes', label: '🔩 Anclajes'},
        {id: 'colocacion_poste', label: '🏗️ Colocación Poste'},
        {id: 'pat', label: '⚡ PAT'},
        {id: 'inst_equipos_otros', label: '🔌 Inst. Equipos por otros'}
    ],
    'meteo': [
        {id: 'localizacion', label: '📍 Localización'},
        {id: 'cimentacion', label: '🧱 Cimentación'},
        {id: 'anclajes', label: '🔩 Anclajes'},
        {id: 'colocacion_poste', label: '🏗️ Colocación Poste'},
        {id: 'pat', label: '⚡ PAT'},
        {id: 'inst_equipos_otros', label: '🔌 Inst. Equipos por otros'}
    ],
    'box': [
        {id: 'localizacion', label: '📍 Localización'},
        {id: 'cimentacion', label: '🧱 Cimentación'},
        {id: 'anclajes', label: '🔩 Anclajes'},
        {id: 'colocacion_poste', label: '🏗️ Colocación Poste'},
        {id: 'pat', label: '⚡ PAT'},
        {id: 'inst_equipos', label: '🔌 Instalación Equipos'},
        {id: 'conexionado', label: '🔋 Conexionado Equipos'}
    ]
};

function escapeHtml(str) { 
    if (!str) return '';
    const div = document.createElement('div'); div.textContent = str; return div.innerHTML; 
}
function escapeJsStr(str) { 
    if (!str) return '';
    return String(str).replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/</g, '\\x3C').replace(/>/g, '\\x3E').replace(/\n/g, '\\n'); 
}
function safeHtmlId(str) { 
    if (!str) return '';
    return String(str).replace(/[^a-zA-Z0-9-_:]/g, '_');
}

function setTask(task, el) {
    currentTask = task;
    document.querySelectorAll('.tool').forEach(t => t.classList.remove('active'));
    el.classList.add('active');
}

function setAppMode(mode) {
    currentAppMode = mode;
    
    if(document.getElementById('btn-mode-em')) document.getElementById('btn-mode-em').classList.toggle('active', mode === 'EM');
    if(document.getElementById('btn-mode-za')) document.getElementById('btn-mode-za').classList.toggle('active', mode === 'ZA');
    // btn-dash-za / btn-dash-pt removed (unused)

    const panelEM = document.getElementById('summary-panel');
    const panelZA = document.getElementById('summary-panel-za');
    const panelPuntuales = document.getElementById('summary-puntuales');
    const containerMap = document.getElementById('matrix-container');
    const layerContainer = document.getElementById('za-layer-container');

    if (containerMap) {
        containerMap.removeAttribute('style');
        containerMap.style.height = 'calc(100vh - 220px)'; 
        containerMap.style.overflow = 'auto'; 
        containerMap.style.padding = '20px';
        containerMap.innerHTML = '';
    }

    if (mode === 'EM') {
        if(containerMap) containerMap.style.padding = '0px';
        if(document.getElementById('toolbar-em')) document.getElementById('toolbar-em').style.display = 'flex';
        if(document.getElementById('filter-block-container')) document.getElementById('filter-block-container').style.display = 'inline-block';
        if(panelEM) panelEM.style.display = 'block';
        if(panelZA) panelZA.style.display = 'none';
        if(panelPuntuales) panelPuntuales.style.display = 'none';
        if(layerContainer) layerContainer.style.display = 'none';
    } else if (mode === 'ZA') {
        if(containerMap) containerMap.style.padding = '0px';
        if(document.getElementById('toolbar-em')) document.getElementById('toolbar-em').style.display = 'none';
        if(document.getElementById('filter-block-container')) document.getElementById('filter-block-container').style.display = 'none';
        if(panelEM) panelEM.style.display = 'none';
        if(panelZA) panelZA.style.display = 'block';
        if(panelPuntuales) panelPuntuales.style.display = 'flex';
        if(layerContainer) layerContainer.style.display = 'flex';
        zaPanelCollapsed = false;
        const body = document.getElementById('za-panel-body');
        if (body) body.classList.remove('collapsed');
        const icon = document.getElementById('za-toggle-icon');
        if (icon) icon.classList.remove('collapsed');
        const viewport = document.getElementById('zanjas-viewport');
        if (viewport) viewport.classList.remove('za-panel-collapsed');
    } else {
        if(document.getElementById('toolbar-em')) document.getElementById('toolbar-em').style.display = 'none';
        if(document.getElementById('filter-block-container')) document.getElementById('filter-block-container').style.display = 'none';
        if(panelEM) panelEM.style.display = 'none';
        if(panelZA) panelZA.style.display = 'none';
        if(panelPuntuales) panelPuntuales.style.display = 'none';
        if(layerContainer) layerContainer.style.display = 'none';
    }
    
    pzScale = 1; pzPointX = 0; pzPointY = 0;
    renderMatrixSelector();
}

async function limpiarProyecto() {
    if(confirm("¿Seguro que quieres borrar el diseño del plano para subir uno nuevo? (Tus avances coloreados NO se borrarán)")) {
        PARQUE_MASTER = {}; 
        PARQUE_ESTACIONES = {};
        PARQUE_CAJAS = {}; 
        PARQUE_ZANJAS = {}; 
        PARQUE_PUNTUALES = {};
        PARQUE_VALLADO = {};
        
        await localforage.setItem('PARQUE_MASTER_DATA', PARQUE_MASTER);
        await localforage.setItem('PARQUE_ESTACIONES_DATA', PARQUE_ESTACIONES);
        await localforage.setItem('PARQUE_CAJAS_DATA', PARQUE_CAJAS);
        await localforage.setItem('PARQUE_ZANJAS_DATA', PARQUE_ZANJAS);
        await localforage.setItem('PARQUE_PUNTUALES_DATA', PARQUE_PUNTUALES);
        await localforage.setItem('PARQUE_VALLADO_DATA', PARQUE_VALLADO);
        
        alert("Pizarra limpia. Ya puedes cargar tus Excel.");
        window.location.reload();
    }
}

async function importarArchivos(input) {
    const files = input.files;
    if (files.length === 0) return;
    const btn = document.getElementById('btn-import');
    if (btn) btn.innerText = "⏳ Procesando...";
    let ultimoArcoDetectado = '';

    const MAX_FILE_SIZE = 20 * 1024 * 1024;

    let totalRows = 0;
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (file.size > MAX_FILE_SIZE) { alert(`⚠️ Archivo demasiado grande.`); continue; }
        
        const fileArcoMatch = file.name.toUpperCase().match(/ARCO\s*(\d+)|ARC\s*(\d+)/);
        const fileArco = fileArcoMatch ? `ARC${fileArcoMatch[1] || fileArcoMatch[2]}` : null;

        const reader = new FileReader();
        await new Promise((resolve) => {
            reader.onload = function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    let todaLaData = [];
                    workbook.SheetNames.forEach(sheetName => { todaLaData = todaLaData.concat(XLSX.utils.sheet_to_json(workbook.Sheets[sheetName])); });
                    totalRows += todaLaData.length;
                    const detectado = procesarDatosJSON(todaLaData, fileArco);
                    if (detectado) ultimoArcoDetectado = detectado;
                } catch (error) { console.error("Error leyendo Excel:", error); alert(`Error al procesar "${file.name}": ${error.message}`); } 
                finally { resolve(); }
            };
            reader.onerror = () => resolve();
            reader.readAsArrayBuffer(file);
        });
    }

    try {
        await localforage.setItem('PARQUE_MASTER_DATA', PARQUE_MASTER);
        await localforage.setItem('PARQUE_ESTACIONES_DATA', PARQUE_ESTACIONES);
        await localforage.setItem('PARQUE_CAJAS_DATA', PARQUE_CAJAS);
        await localforage.setItem('PARQUE_ZANJAS_DATA', PARQUE_ZANJAS);
        await localforage.setItem('PARQUE_PUNTUALES_DATA', PARQUE_PUNTUALES);
        await localforage.setItem('PARQUE_VALLADO_DATA', PARQUE_VALLADO);
    } catch (e) { console.error("Error IndexedDB:", e); alert("Error al guardar en IndexedDB. Puede que el navegador no permita almacenamiento."); }
    
    const trackersCount = Object.keys(PARQUE_MASTER).length;
    const zanjasCount = Object.keys(PARQUE_ZANJAS).length;
    const puntualesCount = Object.keys(PARQUE_PUNTUALES).length;
    if (totalRows > 0 && trackersCount === 0 && zanjasCount === 0 && puntualesCount === 0) {
        alert("No se pudo extraer ningún dato. Revisa que el Excel tenga las columnas esperadas:\n- CODIGO o REFERENCIA, X, Y, FILA, HINCA (para trackers)\n- X INICIO, Y INICIO, X FIN, Y FIN (para zanjas)");
    }
    
    await generarTablaTotales(); 

    if (btn) { btn.innerText = `✅ ¡Cargado!`; setTimeout(() => btn.innerText = "📂 Cargar Listados", 2000); }
    input.value = '';
    actualizarSelectores(ultimoArcoDetectado);
}

const parseCoord = (val) => { if(!val) return 0; return parseFloat(String(val).replace(',', '.')); };

function detectarArco(id) {
    const clean = id.replace(/\s+/g, '');
    const match = clean.match(/ARCO\s*(\d+)|ARC\s*(\d+)/i);
    return match ? `ARC${match[1] || match[2]}` : 'S/A';
}

function procesarDatosJSON(data, fileArco) {
    let arcoEnEsteArchivo = fileArco || '';
    
    if (!arcoEnEsteArchivo) {
        for (let i = 0; i < data.length; i++) {
            const rawRow = data[i];
            const keys = Object.keys(rawRow);
            const codigoKey = keys.find(k => k.trim().replace(/[_-]/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'CODIGO');
            const refKey = keys.find(k => k.trim().replace(/[_-]/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase() === 'REFERENCIA');
            let val = String(rawRow[codigoKey] || rawRow[refKey] || rawRow['TIPO'] || rawRow['CAPA'] || '').toUpperCase();
            let m = val.match(/ARCO\s*(\d+)|ARC\s*(\d+)/);
            if (m) { arcoEnEsteArchivo = `ARC${m[1] || m[2]}`; break; }
        }
    }
    if (!arcoEnEsteArchivo) arcoEnEsteArchivo = 'S/A';

    data.forEach(rawRow => {
        let row = {};
        for (let key in rawRow) row[key.trim().replace(/[_-]/g, ' ').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase()] = rawRow[key];
        
        if (row['X INICIO'] !== undefined && row['Y INICIO'] !== undefined && row['X FIN'] !== undefined && row['Y FIN'] !== undefined) {
            const x1 = parseCoord(row['X INICIO']), y1 = parseCoord(row['Y INICIO']);
            const x2 = parseCoord(row['X FIN']), y2 = parseCoord(row['Y FIN']);
            const ref = row['REFERENCIA'] || row['REFERENCIA (LINEAL)'] || row['TIPO'] || row['CAPA'] || 'ZANJA';
            
            if (x1 !== 0 && y1 !== 0 && x2 !== 0 && y2 !== 0) {
                const zArcoCol = detectarArco(row['ARCO'] || '');
                const zArcoRef = detectarArco(ref);
                const zArco = zArcoCol !== 'S/A' ? zArcoCol : (zArcoRef !== 'S/A' ? zArcoRef : arcoEnEsteArchivo);
                const safeRef = String(ref).replace(/[\.\-\s]/g, '_'); 
                const zId = `Z_${x1}_${y1}_${x2}_${y2}_${safeRef}_${zArco}`;
                PARQUE_ZANJAS[zId] = { id: zId, ref: ref, x1: x1, y1: y1, x2: x2, y2: y2, arco: zArco };
            }
            return; 
        }

        const parcela = row['PARCELA'];
        const numero = row['NUMERO'];
        if (parcela !== undefined && numero !== undefined && row['X'] !== undefined && row['Y'] !== undefined) {
            const xp = parseCoord(row['X']);
            const yp = parseCoord(row['Y']);

            if (xp !== 0 && yp !== 0) {
                const vArcoCol = detectarArco(row['ARCO'] || arcoEnEsteArchivo);
                if (!PARQUE_VALLADO[vArcoCol]) PARQUE_VALLADO[vArcoCol] = {};
                if (!PARQUE_VALLADO[vArcoCol][parcela]) PARQUE_VALLADO[vArcoCol][parcela] = [];

                PARQUE_VALLADO[vArcoCol][parcela].push({ numero: parseInt(numero, 10), x: xp, y: yp });
            }
            return;
        }

        const refPuntual = row['REFERENCIA'] || row['CODIGO'] || row['TIPO'] || row['CAPA'];
        const xp = parseCoord(row['X']);
        const yp = parseCoord(row['Y']);
        
        if (refPuntual && xp !== 0 && yp !== 0 && row['FILA'] === undefined && row['HINCA'] === undefined && !String(refPuntual).toUpperCase().includes('-SB-') && !String(refPuntual).toUpperCase().includes('-PS-')) {
            const upRef = String(refPuntual).toUpperCase();
            if (upRef.includes('ARQUETA') || upRef.includes('BÁCULO') || upRef.includes('BACULO') || upRef.includes('PVH') || upRef.includes('TORRE') || upRef.includes('AGRUPAMIENTO') || upRef.includes('FC-') || upRef.includes('GATEWAY') || upRef.includes('MBOX') || upRef.includes('TBOX') || upRef.includes('METEO') || upRef.includes('CSB') || upRef.includes('CCTV')) {
                const safePRef = String(upRef).replace(/[\.\-\s]/g, '_');
                const pArcoCol = detectarArco(row['ARCO'] || '');
                const pArcoRef = detectarArco(upRef);
                const pArco = pArcoCol !== 'S/A' ? pArcoCol : (pArcoRef !== 'S/A' ? pArcoRef : arcoEnEsteArchivo);
                const pId = `PT_${xp}_${yp}_${safePRef}_${pArco}`;
                PARQUE_PUNTUALES[pId] = { id: pId, ref: String(refPuntual), x: xp, y: yp, arco: pArco };
                return;
            }
        }

        const tId = row['CODIGO'] || row['REFERENCIA'] || row['TIPO'] || row['CAPA'];
        const rawX = row['X'], rawY = row['Y'];
        
        if (!tId || rawX === undefined || rawY === undefined) return;
        const tIdStr = String(tId).trim().toUpperCase();
        if (tIdStr === '') return;

        const x = parseCoord(rawX), y = parseCoord(rawY);
        if (x === 0 && y === 0) return;

        if (row['PUNTO'] !== undefined || tIdStr.includes('-PS-')) {
            const match = tIdStr.match(/ARCO\s*(\d+)|ARC\s*(\d+)/);
            const arcoPS = match ? `ARC${match[1] || match[2]}` : 'S/A';
            const blockPS = row['BLOQUE'] !== undefined && row['BLOQUE'] !== null && row['BLOQUE'] !== '' ? String(row['BLOQUE']).trim() : tIdStr.split('-').pop().trim();
            if (!PARQUE_ESTACIONES[tIdStr]) { PARQUE_ESTACIONES[tIdStr] = { name: tIdStr, arco: arcoPS, block: blockPS, minX: x, maxX: x, minY: y, maxY: y }; } 
            else { PARQUE_ESTACIONES[tIdStr].minX = Math.min(PARQUE_ESTACIONES[tIdStr].minX, x); PARQUE_ESTACIONES[tIdStr].maxX = Math.max(PARQUE_ESTACIONES[tIdStr].maxX, x); PARQUE_ESTACIONES[tIdStr].minY = Math.min(PARQUE_ESTACIONES[tIdStr].minY, y); PARQUE_ESTACIONES[tIdStr].maxY = Math.max(PARQUE_ESTACIONES[tIdStr].maxY, y); }
            return; 
        }

        if (tIdStr.includes('-SB-')) {
            const match = tIdStr.match(/ARCO\s*(\d+)|ARC\s*(\d+)/);
            const arcoSB = match ? `ARC${match[1] || match[2]}` : 'S/A';
            const blockRaw = row['BLOQUE'] !== undefined && row['BLOQUE'] !== null && row['BLOQUE'] !== '' ? String(row['BLOQUE']).trim() : (tIdStr.split('-')[2] || '').trim();
            const blockSB = blockRaw || 'S/B'; 
            if (!PARQUE_CAJAS[tIdStr]) { PARQUE_CAJAS[tIdStr] = { name: tIdStr, arco: arcoSB, block: blockSB, minX: x, maxX: x, minY: y, maxY: y }; } 
            else { PARQUE_CAJAS[tIdStr].minX = Math.min(PARQUE_CAJAS[tIdStr].minX, x); PARQUE_CAJAS[tIdStr].maxX = Math.max(PARQUE_CAJAS[tIdStr].maxX, x); PARQUE_CAJAS[tIdStr].minY = Math.min(PARQUE_CAJAS[tIdStr].minY, y); PARQUE_CAJAS[tIdStr].maxY = Math.max(PARQUE_CAJAS[tIdStr].maxY, y); }
            return; 
        }

        const block = row['BLOQUE'] || 'S/B', filaNum = row['FILA'], hincaRaw = row['HINCA'];
        if (filaNum === undefined || filaNum === null || hincaRaw === undefined || hincaRaw === null) return;
        const hincaIndex = parseInt(String(hincaRaw).replace(/^[^\d]*/, ''), 10);
        if (isNaN(hincaIndex) || hincaIndex <= 0) return;
        const arcoId = detectarArco(tIdStr);

        if(!PARQUE_MASTER[tIdStr]) { PARQUE_MASTER[tIdStr] = { name: tIdStr, arco: arcoId, block: String(block).trim(), minX: x, maxX: x, minY: y, maxY: y, filas: {} }; } 
        else { PARQUE_MASTER[tIdStr].minX = Math.min(PARQUE_MASTER[tIdStr].minX, x); PARQUE_MASTER[tIdStr].maxX = Math.max(PARQUE_MASTER[tIdStr].maxX, x); PARQUE_MASTER[tIdStr].minY = Math.min(PARQUE_MASTER[tIdStr].minY, y); PARQUE_MASTER[tIdStr].maxY = Math.max(PARQUE_MASTER[tIdStr].maxY, y); }
        if(!PARQUE_MASTER[tIdStr].filas[filaNum]) PARQUE_MASTER[tIdStr].filas[filaNum] = { tipo: filaNum == 2 ? "MOTORA" : "GEMELA", hincas: 0 };
        if(hincaIndex > PARQUE_MASTER[tIdStr].filas[filaNum].hincas) PARQUE_MASTER[tIdStr].filas[filaNum].hincas = hincaIndex;
    });
    return arcoEnEsteArchivo;
}

function actualizarSelectores(arcoPreferido) {
    let arcos = new Set();
    Object.values(PARQUE_MASTER).forEach(tr => { if(tr.arco) arcos.add(tr.arco); });
    Object.values(PARQUE_ZANJAS).forEach(z => { if(z.arco) arcos.add(z.arco); });
    Object.values(PARQUE_PUNTUALES).forEach(p => { if(p.arco) arcos.add(p.arco); });
    Object.values(PARQUE_ESTACIONES).forEach(ps => { if(ps.arco) arcos.add(ps.arco); });
    Object.values(PARQUE_CAJAS).forEach(sb => { if(sb.arco) arcos.add(sb.arco); });
    const selectArco = document.getElementById('select-arco');
    const valorAntes = selectArco.value;
    if (arcos.size === 0) {
        selectArco.innerHTML = '<option>Carga un Excel...</option>';
        document.getElementById('select-block').innerHTML = '';
        document.getElementById('matrix-container').innerHTML = '<div class="empty-state">No hay datos cargados.</div>';
        return;
    }
    selectArco.innerHTML = Array.from(arcos).sort().map(a => `<option value="${a}">${a === 'S/A' ? 'NO IDENTIFICADO' : a}</option>`).join('');
    if (arcoPreferido && arcos.has(arcoPreferido)) selectArco.value = arcoPreferido; else if (valorAntes && arcos.has(valorAntes)) selectArco.value = valorAntes;
    actualizarBloques();
}

function actualizarBloques() {
    const arcoSeleccionado = document.getElementById('select-arco').value;
    let bloques = new Set();
    Object.values(PARQUE_MASTER).forEach(tr => { if(tr.arco === arcoSeleccionado && tr.block) bloques.add(tr.block.charAt(0)); });
    Object.values(PARQUE_ESTACIONES).forEach(ps => { if(ps.arco === arcoSeleccionado && ps.block) bloques.add(ps.block.charAt(0)); });
    Object.values(PARQUE_CAJAS).forEach(sb => { if(sb.arco === arcoSeleccionado && sb.block) bloques.add(sb.block.charAt(0)); });
    document.getElementById('select-block').innerHTML = Array.from(bloques).sort().map(b => `<option value="${b}">BLOQUE ${b}</option>`).join('');
    
    pzScale = 1; pzPointX = 0; pzPointY = 0;
    renderMatrixSelector();
}

function renderMatrixSelector() {
    if (currentAppMode === 'EM') { renderMatrix(); } 
    else if (currentAppMode === 'ZA') { renderMatrixZanjas(); } 
    else if (currentAppMode === 'DASH_ZA') { renderDashboardZanjas(); } 
    else if (currentAppMode === 'DASH_PT') { renderDashboardPuntuales(); }
}

let _panInitialized = false;
let _panZoomInitialized = false;

async function renderMatrix() {
    _panInitialized = false;
    try {
        const arco = document.getElementById('select-arco').value;
        const block = document.getElementById('select-block').value;
        const container = document.getElementById('matrix-container');
        
        container.style.height = 'calc(100vh - 220px)'; 
        container.style.overflow = 'auto'; 
        container.style.paddingBottom = '0px'; 
        container.innerHTML = '';
        
        const ids = Object.keys(PARQUE_MASTER).filter(id => PARQUE_MASTER[id].arco === arco && PARQUE_MASTER[id].block.startsWith(block));
        const psIds = Object.keys(PARQUE_ESTACIONES).filter(id => PARQUE_ESTACIONES[id].arco === arco && PARQUE_ESTACIONES[id].block.startsWith(block));
        const sbIds = Object.keys(PARQUE_CAJAS).filter(id => PARQUE_CAJAS[id].arco === arco && PARQUE_CAJAS[id].block.startsWith(block));

        if(ids.length === 0 && psIds.length === 0 && sbIds.length === 0) { 
            container.innerHTML = '<div class="empty-state">No hay datos para este bloque.</div>'; 
            return; 
        }
        
        let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
        ids.forEach(id => { const tr = PARQUE_MASTER[id]; if(tr.minX < gMinX) gMinX = tr.minX; if(tr.maxX > gMaxX) gMaxX = tr.maxX; if(tr.minY < gMinY) gMinY = tr.minY; if(tr.maxY > gMaxY) gMaxY = tr.maxY; });
        psIds.forEach(id => { const ps = PARQUE_ESTACIONES[id]; if(ps.minX < gMinX) gMinX = ps.minX; if(ps.maxX > gMaxX) gMaxX = ps.maxX; if(ps.minY < gMinY) gMinY = ps.minY; if(ps.maxY > gMaxY) gMaxY = ps.maxY; });
        sbIds.forEach(id => { const sb = PARQUE_CAJAS[id]; if(sb.minX < gMinX) gMinX = sb.minX; if(sb.maxX > gMaxX) gMaxX = sb.maxX; if(sb.minY < gMinY) gMinY = sb.minY; if(sb.maxY > gMaxY) gMaxY = sb.maxY; });

        if (gMinX === Infinity) gMinX = 0;
        if (gMaxX === -Infinity) gMaxX = 1;
        if (gMinY === Infinity) gMinY = 0;
        if (gMaxY === -Infinity) gMaxY = 1;

        const rX = (gMaxX - gMinX) || 1; const rY = (gMaxY - gMinY) || 1;
        const SCALE_X = 8, SCALE_Y = 6;
        
        const MARGIN_LEFT = 450; 
        const MARGIN_TOP_BOTTOM = 300; 
        
        const canvasWidth = (rX * SCALE_X) + (MARGIN_LEFT * 2);
        const canvasHeight = (rY * SCALE_Y) + (MARGIN_TOP_BOTTOM * 2) + 300; 
        
        let html = `<div class="map-canvas" style="position: relative; min-width: ${canvasWidth}px; min-height: ${canvasHeight}px;">`;
        
        for (let id of psIds) {
            const ps = PARQUE_ESTACIONES[id];
            const pxX = (((ps.minX + ps.maxX) / 2 - gMinX) * SCALE_X) + MARGIN_LEFT;
            const pxY = ((gMaxY - ps.maxY) * SCALE_Y) + MARGIN_TOP_BOTTOM;
            let wS = ((ps.maxX - ps.minX) * SCALE_X); let pxH = ((ps.maxY - ps.minY) * SCALE_Y);
            if (wS < 60) wS = 60; if (pxH < 40) pxH = 40; 
            const letra = ps.name.split('-').pop(); const safeName = escapeHtml(`PS-${letra}`); 
            html += `<div class="power-station" style="position: absolute; left: ${pxX}px; top: ${pxY}px; width: ${wS}px; height: ${pxH}px;" title="${escapeHtml(ps.name)}"><span style="font-size: 16px; margin-bottom: 2px;">⚡</span><span>${safeName}</span></div>`;
        }

        for (let id of sbIds) {
            const sb = PARQUE_CAJAS[id];
            const pxX = (((sb.minX + sb.maxX) / 2 - gMinX) * SCALE_X) + MARGIN_LEFT;
            const pxY = ((gMaxY - sb.maxY) * SCALE_Y) + MARGIN_TOP_BOTTOM;
            let wS = 30, pxH = 18; 
            let checks = HISTORIAL_CAJAS[id] || {}; let count = contarChecks(checks);
            let colorClass = 'sb-red'; if(count === 6) colorClass = 'sb-green'; else if(count > 0) colorClass = 'sb-orange';
            const numCaja = sb.name.split('-').slice(2).join('-').split('_')[0];
            const htmlSbId = safeHtmlId(id);
            html += `<div id="sb-${htmlSbId}" class="string-box ${colorClass}" style="position: absolute; left: ${pxX}px; top: ${pxY}px; width: ${wS}px; height: ${pxH}px;" title="Ver Checklist" data-action="caja" data-id="${escapeHtml(id)}"><span>${escapeHtml(numCaja)}</span></div>`;
        }

        for (let id of ids) {
            const tr = PARQUE_MASTER[id];
            const pxX = (((tr.minX + tr.maxX) / 2 - gMinX) * SCALE_X) + MARGIN_LEFT;
            const pxY = ((gMaxY - tr.maxY) * SCALE_Y) + MARGIN_TOP_BOTTOM;
            let pxH = ((tr.maxY - tr.minY) * SCALE_Y); if (pxH < 40) pxH = 40; 
            const filas = Object.keys(tr.filas).sort((a,b) => a-b);
            const esM = filas.length === 1;
            let wS = !esM ? `width: ${((tr.maxX - tr.minX) * SCALE_X) + 22}px; justify-content: space-between;` : `justify-content: center;`;
            
            html += `<div class="prod-card map-card" style="position: absolute; left: ${pxX}px; top: ${pxY}px; height: ${pxH}px; ${wS}">`;
            const safeName = escapeHtml(tr.name.split('-').slice(-2).join('-'));
            html += `<div class="tracker-title" style="cursor:pointer;" data-action="tracker" data-id="${escapeHtml(id)}" title="Pintar tracker completo">${safeName}</div>`;
            for (let fN of filas) {
                const f = tr.filas[fN];
                let tT = fN == 2 ? 'MOT' : 'GEM'; let cT = fN == 2 ? 'motora' : 'gemela'; if (esM) { tT = 'MONO'; cT = 'mono'; }
                html += `<div class="row-container"><div class="row-tag ${cT}" style="cursor:pointer;" data-action="row" data-id="${escapeHtml(id)}" data-fn="${fN}" title="Pintar fila completa">${tT}</div><div class="cells-grid">`;
                for (let h = 1; h <= f.hincas; h++) {
                    const hId = `${id}-F${fN}-H${h}`;
                    const htmlHId = safeHtmlId(hId);
                    const rawData = HISTORIAL_PROD[hId];
                    const s = (rawData && typeof rawData === 'object') ? (rawData.estado || '') : (rawData || '');
                    html += `<div class="cell" id="${htmlHId}" data-action="cell" data-hid="${escapeHtml(hId)}" style="background-color:${getStyleByStatus(s)}; color: ${s==='' ? 'transparent' : '#333'};">${s}</div>`;
                }
                html += `</div></div>`;
            }
            html += `</div>`;
        }
        container.innerHTML = html + '</div>';
        
        const bName = document.getElementById('summary-block-name');
        if (bName) bName.innerText = `Arco ${arco.replace('ARC','')} - Bloque ${block}`;
        
        actualizarContadores();
        initPanEM();
        setupMatrixDelegation();
    } catch(e) {
        console.error("Error crítico dibujando EM:", e);
    }
}

function initPanEM() {
    if (_panInitialized) return;
    _panInitialized = true;

    const container = document.getElementById('matrix-container');
    if (!container) return;

    let isDragging = false;
    let startX, startY, sLeft, sTop;

    container.style.cursor = 'grab';

    const onDown = (e) => {
        if (currentAppMode !== 'EM') return;
        if (e.target.closest('.cell') || e.target.closest('.row-tag') || e.target.closest('.tracker-title') || e.target.closest('.string-box') || e.target.closest('.power-station')) {
            return; 
        }
        isDragging = true;
        container.style.cursor = 'grabbing';
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;
        startX = clientX - container.offsetLeft;
        startY = clientY - container.offsetTop;
        sLeft = container.scrollLeft;
        sTop = container.scrollTop;
    };

    const onMove = (e) => {
        if (!isDragging || currentAppMode !== 'EM') return;
        e.preventDefault();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;
        const x = clientX - container.offsetLeft;
        const y = clientY - container.offsetTop;
        container.scrollLeft = sLeft - (x - startX);
        container.scrollTop = sTop - (y - startY);
    };

    const onUp = () => {
        if (currentAppMode !== 'EM') return;
        isDragging = false;
        container.style.cursor = 'grab';
    };

    container.addEventListener('mousedown', onDown);
    container.addEventListener('mousemove', onMove);
    container.addEventListener('mouseup', onUp);
    container.addEventListener('mouseleave', onUp);

    container.addEventListener('touchstart', onDown, { passive: false });
    container.addEventListener('touchmove', onMove, { passive: false });
    container.addEventListener('touchend', onUp);
}

function setupMatrixDelegation() {
    const container = document.getElementById('matrix-container');
    if (!container) return;
    container.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        if (action === 'caja') {
            abrirModalCaja(target.dataset.id);
        } else if (action === 'tracker') {
            paintTracker(target.dataset.id);
        } else if (action === 'row') {
            paintRow(target.dataset.id, target.dataset.fn);
        } else if (action === 'cell') {
            paint(target.dataset.hid);
        }
    });
}

function normalizeZanjaType(ref) {
    const r = String(ref).toUpperCase();
    if (r.includes('ENTRADA-PS') || r.includes('ENTRADA PS') || r.includes('ENTRADAPS')) return 'ENTRADA_PS';
    if (r.includes('MT')) return 'MT';
    if (r.includes('BT')) return 'BT';
    if (r.includes('SSAA')) return 'SSAA';
    if (r.includes('ZANJA G') || r.includes('ZANJA-G') || r.includes('ZANJA_G')) return 'PAT';
    if (r.includes('CCTV')) return 'CCTV';
    if (r.includes('LEA')) return 'CCTV';
    if (r.includes('LECA')) return 'OTRAS';
    return 'OTRAS';
}

function getZanjaColorByType(type) {
    const colors = { 
        'MT': '#ef4444',         
        'BT': '#f59e0b',         
        'SSAA': '#22c55e',       
        'PAT': '#ec4899',        
        'CCTV': '#ca8a04',       
        'ENTRADA_PS': '#06b6d4',  
        'OTRAS': '#94a3b8'       
    };
    return colors[type] || '#94a3b8';
}

function getZanjaColorByProgress(zId, maxMetros) {
    const stats = HISTORIAL_ZANJAS[zId] || {};
    const itemIds = ['excavacion', 'cama_arena', 'inspeccion_cables', 'ruteado_peinado', 'identificacion_cables', 'cinta_seguridad', 'cierre_zanja'];
    
    let anyStarted = false;
    let allFinished = true;
    
    itemIds.forEach(itemId => {
        const val = stats[itemId];
        if (val !== undefined && val > 0) anyStarted = true;
        if (!(val !== undefined && val >= maxMetros)) allFinished = false;
    });
    
    if (!anyStarted) return '#94a3b8';
    if (allFinished) return '#22c55e';
    return '#f59e0b';
}

function contarChecksPuntual(checks, type) {
    let count = 0;
    const items = CHECKLIST_PUNTUALES[type];
    if(!items) return 0;
    items.forEach(i => { if (checks[i.id] !== undefined) count++; });
    return count;
}
function getColorPuntual(count, max) {
    if (count === 0) return 'rgba(255, 0, 0, 0.45)';
    if (count === max) return 'rgba(0, 220, 0, 0.45)';
    return 'rgba(255, 130, 0, 0.45)';
}

function renderMatrixZanjas() {
    _panZoomInitialized = false;
    try {
        const arco = document.getElementById('select-arco').value;
        const container = document.getElementById('matrix-container');
        
        container.style.paddingBottom = '0px';
        container.style.overflow = 'hidden';
        container.innerHTML = '';
        
        let ids = Object.keys(PARQUE_MASTER).filter(id => PARQUE_MASTER[id].arco === arco);
        let sbIds = Object.keys(PARQUE_CAJAS).filter(id => PARQUE_CAJAS[id].arco === arco);
        
        let zValues = Object.values(PARQUE_ZANJAS).filter(z => z.arco === arco);
        let pValues = Object.values(PARQUE_PUNTUALES).filter(p => p.arco === arco);

        if(ids.length === 0 && sbIds.length === 0 && zValues.length === 0 && pValues.length === 0) { 
            container.innerHTML = '<div class="empty-state">No hay datos para esta vista de Arco.</div>'; 
            return; 
        }
        
        let gMinX = Infinity, gMaxX = -Infinity, gMinY = Infinity, gMaxY = -Infinity;
        ids.forEach(id => { const tr = PARQUE_MASTER[id]; if(tr.minX < gMinX) gMinX = tr.minX; if(tr.maxX > gMaxX) gMaxX = tr.maxX; if(tr.minY < gMinY) gMinY = tr.minY; if(tr.maxY > gMaxY) gMaxY = tr.maxY; });
        sbIds.forEach(id => { const sb = PARQUE_CAJAS[id]; if(sb.minX < gMinX) gMinX = sb.minX; if(sb.maxX > gMaxX) gMaxX = sb.maxX; if(sb.minY < gMinY) gMinY = sb.minY; if(sb.maxY > gMaxY) gMaxY = sb.maxY; });
        
        zValues.forEach(z => {
            if(z.x1 < gMinX) gMinX = z.x1; if(z.x1 > gMaxX) gMaxX = z.x1;
            if(z.x2 < gMinX) gMinX = z.x2; if(z.x2 > gMaxX) gMaxX = z.x2;
            if(z.y1 < gMinY) gMinY = z.y1; if(z.y1 > gMaxY) gMaxY = z.y1;
            if(z.y2 < gMinY) gMinY = z.y2; if(z.y2 > gMaxY) gMaxY = z.y2;
        });

        pValues.forEach(p => {
            if(p.x < gMinX) gMinX = p.x; if(p.x > gMaxX) gMaxX = p.x;
            if(p.y < gMinY) gMinY = p.y; if(p.y > gMaxY) gMaxY = p.y;
        });
        let vValues = PARQUE_VALLADO[arco] || {};
        Object.values(vValues).forEach(parcelaArr => {
            parcelaArr.forEach(pt => {
                if(pt.x < gMinX) gMinX = pt.x; if(pt.x > gMaxX) gMaxX = pt.x;
                if(pt.y < gMinY) gMinY = pt.y; if(pt.y > gMaxY) gMaxY = pt.y;
            });
        });
        if (gMinX === Infinity) gMinX = 0;
        if (gMaxX === -Infinity) gMaxX = 1;
        if (gMinY === Infinity) gMinY = 0;
        if (gMaxY === -Infinity) gMaxY = 1;

        const baseScaleX = 4, baseScaleY = 3, MARGIN = 100; 
        const rX = (gMaxX - gMinX) || 1; const rY = (gMaxY - gMinY) || 1;
        const canvasWidth = (rX * baseScaleX) + (MARGIN * 2);
        const canvasHeight = (rY * baseScaleY) + (MARGIN * 2);

        if (pzCurrentArco !== arco) {
            pzScale = 1;
            const cw = container.clientWidth || 1000;
            const ch = 500; 
            pzPointX = (cw - canvasWidth) / 2;
            pzPointY = (ch - canvasHeight) / 2;
            if (pzPointX < 0) pzPointX = 50; 
            if (pzPointY < 0) pzPointY = 50;
            pzCurrentArco = arco;
        }
        
        let html = `<div id="zanjas-viewport" style="width: 100%; height: 70vh; min-height: 500px; overflow: hidden; background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; position: relative; margin-top: 10px; cursor: grab;">`;
        html += `<div id="pan-zoom-layer" style="position: absolute; width: ${canvasWidth}px; height: ${canvasHeight}px; transform: translate(${pzPointX}px, ${pzPointY}px) scale(${pzScale}); transform-origin: 0 0;">`;
        
        let svgHtml = `<svg style="position:absolute; top:0; left:0; width:100%; height:100%; pointer-events:none; z-index:10;">`;
        
        let zanjaMetrosTotal = 0;
        let metrosPorTipo = { 'MT': 0, 'BT': 0, 'SSAA': 0, 'PAT': 0, 'CCTV': 0, 'ENTRADA_PS': 0, 'OTRAS': 0 };
        
        zValues.forEach(z => {
            const dx = z.x2 - z.x1; const dy = z.y2 - z.y1;
            const longitud = Math.sqrt(dx*dx + dy*dy);
            
            const type = normalizeZanjaType(z.ref);
            metrosPorTipo[type] = (metrosPorTipo[type] || 0) + longitud;
            if (!zaLayerState.zanja[type]) return;
            
            zanjaMetrosTotal += longitud;

            const pxX1 = ((z.x1 - gMinX) * baseScaleX) + MARGIN; const pxY1 = ((gMaxY - z.y1) * baseScaleY) + MARGIN;
            const pxX2 = ((z.x2 - gMinX) * baseScaleX) + MARGIN; const pxY2 = ((gMaxY - z.y2) * baseScaleY) + MARGIN;
            const maxMetros = Math.round(longitud);
            const strokeColor = getZanjaColorByProgress(z.id, maxMetros);
            
            const grosorFinal = 4 / pzScale;
            
            svgHtml += `<line x1="${pxX1}" y1="${pxY1}" x2="${pxX2}" y2="${pxY2}" stroke="${strokeColor}" stroke-width="${grosorFinal}" stroke-linecap="round" style="pointer-events:auto; cursor:pointer;" data-action="zanja" data-id="${escapeHtml(z.id)}"></line>`;

            if (type !== 'ENTRADA_PS') {
                const pLen = Math.sqrt(Math.pow(pxX2 - pxX1, 2) + Math.pow(pxY2 - pxY1, 2));
                if (pLen > 40) { 
                    const numTexts = Math.max(1, Math.floor(pLen / 100)); 
                    let angle = Math.atan2(pxY2 - pxY1, pxX2 - pxX1) * (180 / Math.PI);
                    if (angle > 90 || angle < -90) angle += 180; 
                    
                    for(let i = 1; i <= numTexts; i++) {
                        let f = i / (numTexts + 1);
                        let cx = pxX1 + (pxX2 - pxX1) * f;
                        let cy = pxY1 + (pxY2 - pxY1) * f;
                        svgHtml += `<text class="za-cut-text" x="${cx}" y="${cy}" fill="${strokeColor}" font-size="${10 / pzScale}" font-weight="900" font-family="sans-serif" text-anchor="middle" dominant-baseline="central" transform="rotate(${angle}, ${cx}, ${cy})" style="pointer-events:none;" paint-order="stroke" stroke="#f8fafc" stroke-width="${5 / pzScale}">${type}</text>`;
                    }
                }
            }
        });

        let countsPT = { arqueta: 0, gateway: 0, mbox: 0, tbox: 0, meteo: 0, csb: 0, cctv: 0 };
        let cctvDrawnCoords = new Set(); 

        pValues.forEach(p => {
            const pxX = ((p.x - gMinX) * baseScaleX) + MARGIN;
            const pxY = ((gMaxY - p.y) * baseScaleY) + MARGIN;
            const refUp = p.ref.toUpperCase();
            const c = '#000000'; 
            const sw = 2; 
            const htmlPId = safeHtmlId(p.id);
            let checks = HISTORIAL_PUNTUALES[p.id] || {};
            
            if (refUp.includes('ARQUETA')) {
                countsPT.arqueta++;
                if (!zaLayerState.puntual.arqueta) return;
                
                const s = 8; 
                let count = contarChecksPuntual(checks, 'arqueta');
                let fillCol = getColorPuntual(count, 6);

                svgHtml += `<rect id="pt-${htmlPId}" x="${pxX - s/2}" y="${pxY - s/2}" width="${s}" height="${s}" fill="${fillCol}" stroke="${c}" stroke-width="${sw}" style="pointer-events:auto; cursor:pointer;" data-action="puntual" data-id="${escapeHtml(p.id)}" data-ptype="arqueta" data-ref="${escapeHtml(p.ref)}"></rect>`;
            } 
            else if (refUp.includes('POSTE CAJA')) {
                countsPT.csb++;
                if (!zaLayerState.puntual.csb) return;
                
                let count = contarChecksPuntual(checks, 'box');
                let fillCol = getColorPuntual(count, 7);

                const s = 14; 
                const s2 = s/2;
                const triPath = `M ${pxX},${pxY - s2} L ${pxX + s2},${pxY + s2} L ${pxX - s2},${pxY + s2} Z`;
                
                svgHtml += `<path id="pt-${htmlPId}" d="${triPath}" fill="${fillCol}" stroke="${c}" stroke-width="${sw}" style="pointer-events:auto; cursor:pointer;" data-action="puntual" data-id="${escapeHtml(p.id)}" data-ptype="box" data-ref="${escapeHtml(p.ref)}"/>`;
                svgHtml += `<circle cx="${pxX}" cy="${pxY + 2.5}" r="1.5" fill="${c}" style="pointer-events:none;"></circle>`; 
                svgHtml += `<text x="${pxX}" y="${pxY - s2 - 4}" fill="${c}" font-size="9" font-weight="bold" text-anchor="middle" font-family="sans-serif" style="pointer-events:none;">CSB</text>`;
            }
            else if (refUp.includes('BÁCULO-CCTV') || refUp.includes('BACULO-CCTV') || refUp.includes('CCTV') || refUp.includes('FC-')) {
                if (!zaLayerState.puntual.cctv) return;
                
                const coordKey = `${p.x.toFixed(1)}_${p.y.toFixed(1)}`;
                if (cctvDrawnCoords.has(coordKey)) return; 
                
                cctvDrawnCoords.add(coordKey);
                countsPT.cctv++;

                let count = contarChecksPuntual(checks, 'baculo');
                let fillCol = getColorPuntual(count, 6);

                const r = 6; 
                const o = r * 0.7071; 
                const safeRef = refUp.includes('FC-') ? 'CCTV / FC' : p.ref;
                svgHtml += `<circle id="pt-${htmlPId}" cx="${pxX}" cy="${pxY}" r="${r}" fill="${fillCol}" stroke="${c}" stroke-width="${sw}" style="pointer-events:auto; cursor:pointer;" data-action="puntual" data-id="${escapeHtml(p.id)}" data-ptype="baculo" data-ref="${escapeHtml(safeRef)}"></circle>`;
                svgHtml += `<line x1="${pxX - o}" y1="${pxY - o}" x2="${pxX + o}" y2="${pxY + o}" stroke="${c}" stroke-width="${sw}" style="pointer-events:none;"></line>`;
                svgHtml += `<line x1="${pxX - o}" y1="${pxY + o}" x2="${pxX + o}" y2="${pxY - o}" stroke="${c}" stroke-width="${sw}" style="pointer-events:none;"></line>`;
            }
            else if (refUp.includes('GATEWAY') || refUp.includes('MBOX') || refUp.includes('TBOX') || refUp.includes('METEO')) {
                let shortName = 'PVH';
                let pType = null;
                let layerKey = null;
                if (refUp.includes('MBOX+GATEWAY')) { shortName = 'MBOX+GW'; pType = 'box'; layerKey = 'mbox'; countsPT.mbox++; }
                else if (refUp.includes('GATEWAY')) { shortName = 'GATEWAY'; pType = 'box'; layerKey = 'gateway'; countsPT.gateway++; }
                else if (refUp.includes('MBOX')) { shortName = 'MBOX'; pType = 'box'; layerKey = 'mbox'; countsPT.mbox++; }
                else if (refUp.includes('TBOX')) { shortName = 'TBOX'; pType = 'box'; layerKey = 'tbox'; countsPT.tbox++; }
                else if (refUp.includes('METEO')) { shortName = 'METEO'; pType = 'meteo'; layerKey = 'meteo'; countsPT.meteo++; }
                
                if (layerKey && !zaLayerState.puntual[layerKey]) return;

                let maxC = pType === 'meteo' ? 6 : 7;
                let count = contarChecksPuntual(checks, pType);
                let fillCol = getColorPuntual(count, maxC);

                const s = 14; 
                const s2 = s/2;
                const triPath = `M ${pxX},${pxY - s2} L ${pxX + s2},${pxY + s2} L ${pxX - s2},${pxY + s2} Z`;

                svgHtml += `<path id="pt-${htmlPId}" d="${triPath}" fill="${fillCol}" stroke="${c}" stroke-width="${sw}" style="pointer-events:auto; cursor:pointer;" data-action="puntual" data-id="${escapeHtml(p.id)}" data-ptype="${escapeHtml(pType)}" data-ref="${escapeHtml(shortName)}"/>`;
                svgHtml += `<circle cx="${pxX}" cy="${pxY + 2.5}" r="1.5" fill="${c}" style="pointer-events:none;"></circle>`; 
                svgHtml += `<text x="${pxX}" y="${pxY - s2 - 4}" fill="${c}" font-size="9" font-weight="bold" text-anchor="middle" font-family="sans-serif" style="pointer-events:none;">${escapeHtml(shortName)}</text>`; 
            }
        });
        
        let valladoMetrosTotal = 0;
        let valladoPorParcela = {};

        Object.keys(vValues).forEach(parcela => {
            let pts = vValues[parcela].sort((a, b) => a.numero - b.numero);
            if (pts.length < 2) return;
            
            // 1. Precalcular metros
            let metrosParcela = 0;
            for(let i = 0; i < pts.length; i++) {
                let p1 = pts[i]; let p2 = pts[(i + 1) % pts.length];
                metrosParcela += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
            }
            
            const parcelaId = `${arco}_${parcela}`;
            const color = getValladoColor(parcelaId);
            const sw = 2 / pzScale; // Grosor ligeramente mayor para facilitar el click
            
            // 2. Agrupar líneas para que se abran al hacer click
            svgHtml += `<g style="cursor:pointer; pointer-events:auto;" data-action="vallado" data-pid="${escapeHtml(parcelaId)}" data-pname="${escapeHtml(parcela)}" data-metros="${Math.round(metrosParcela)}">`;

            for(let i = 0; i < pts.length; i++) {
                let p1 = pts[i]; let p2 = pts[(i + 1) % pts.length];

                const pxX1 = ((p1.x - gMinX) * baseScaleX) + MARGIN;
                const pxY1 = ((gMaxY - p1.y) * baseScaleY) + MARGIN;
                const pxX2 = ((p2.x - gMinX) * baseScaleX) + MARGIN;
                const pxY2 = ((gMaxY - p2.y) * baseScaleY) + MARGIN;

                svgHtml += `<line class="za-vallado-line" x1="${pxX1}" y1="${pxY1}" x2="${pxX2}" y2="${pxY2}" stroke="${color}" stroke-width="${sw}" stroke-dasharray="${8/pzScale}, ${4/pzScale}"></line>`;

                const dxPx = pxX2 - pxX1; const dyPx = pxY2 - pxY1;
                const distPx = Math.sqrt(dxPx*dxPx + dyPx*dyPx);
                const numOs = Math.floor(distPx / 40);
                for(let j = 1; j <= numOs; j++) {
                    let f = j / (numOs + 1);
                    svgHtml += `<circle class="za-vallado-circle" cx="${pxX1 + dxPx * f}" cy="${pxY1 + dyPx * f}" r="${2.5/pzScale}" fill="#f8fafc" stroke="${color}" stroke-width="${1.2/pzScale}"></circle>`;
                }
            }
            svgHtml += `</g>`;

            valladoPorParcela[parcela] = metrosParcela;
            valladoMetrosTotal += metrosParcela;
        });
        
        svgHtml += `</svg>`;
        html += svgHtml;

        for (let id of sbIds) {
            const sb = PARQUE_CAJAS[id];
            const pxX = (((sb.minX + sb.maxX) / 2 - gMinX) * baseScaleX) + MARGIN; 
            const pxY = ((gMaxY - sb.maxY) * baseScaleY) + MARGIN;
            const numCaja = sb.name.split('-').slice(2).join('-').split('_')[0];
            html += `<div style="position: absolute; left: ${pxX}px; top: ${pxY}px; width: 24px; height: 14px; background: rgba(226, 232, 240, 0.7); border: 1px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; font-weight: bold; pointer-events: none; z-index: 1;">${escapeHtml(numCaja)}</div>`;
        }

        for (let id of ids) {
            const tr = PARQUE_MASTER[id];
            const pxX = (((tr.minX + tr.maxX) / 2 - gMinX) * baseScaleX) + MARGIN; const pxY = ((gMaxY - tr.maxY) * baseScaleY) + MARGIN;
            let pxH = ((tr.maxY - tr.minY) * baseScaleY); if (pxH < 40) pxH = 40; 
            const safeName = escapeHtml(tr.name.split('-').slice(-2).join('-'));
            let wS_ZA = ((tr.maxX - tr.minX) * baseScaleX) || 15;
            html += `<div style="position: absolute; left: ${pxX}px; top: ${pxY}px; width: ${wS_ZA}px; height: ${pxH}px; background: rgba(226, 232, 240, 0.7); border: 1px solid #cbd5e1; border-radius: 3px; display: flex; align-items: center; justify-content: center; font-size: 8px; color: #94a3b8; font-weight: bold; pointer-events: none; z-index: 2;">${safeName}</div>`;
        }
        
        html += `</div></div>`;
        container.innerHTML = html;
        
        const arcoNameZA = document.getElementById('summary-arco-name-za');
        if (arcoNameZA) arcoNameZA.innerText = `Arco ${arco.replace('ARC','')}`;
        
        const allMetros = Object.values(metrosPorTipo).reduce((a, b) => a + b, 0);
        const setTxt = (id, val) => { const el = document.getElementById(id); if(el) el.innerText = val; };
        setTxt('sum-za-metros', Math.round(allMetros) + " m");
        setTxt('sum-za-metros-mini', Math.round(allMetros) + " m");
        setTxt('sum-za-mt', Math.round(metrosPorTipo['MT']) + " m");
        setTxt('sum-za-bt', Math.round(metrosPorTipo['BT']) + " m");
        setTxt('sum-za-ssaa', Math.round(metrosPorTipo['SSAA']) + " m");
        setTxt('sum-za-pat', Math.round(metrosPorTipo['PAT']) + " m");
        setTxt('sum-za-cctv', Math.round(metrosPorTipo['CCTV']) + " m");
        setTxt('sum-za-entradaps', Math.round(metrosPorTipo['ENTRADA_PS']) + " m");
        setTxt('sum-za-otras', Math.round(metrosPorTipo['OTRAS'] || 0) + " m");
        
        setTxt('sum-pt-arqueta', countsPT.arqueta);
        setTxt('sum-pt-gateway', countsPT.gateway);
        setTxt('sum-pt-mbox', countsPT.mbox);
        setTxt('sum-pt-tbox', countsPT.tbox);
        setTxt('sum-pt-meteo', countsPT.meteo);
        setTxt('sum-pt-csb', countsPT.csb);
        setTxt('sum-pt-cctv', countsPT.cctv);
        let vContainer = document.getElementById('vallado-summary-container');
        if (!vContainer) {
            vContainer = document.createElement('div');
            vContainer.id = 'vallado-summary-container';
            vContainer.style.marginTop = '8px';
            const panelZanjaBody = document.getElementById('za-panel-body');
            if (panelZanjaBody) panelZanjaBody.insertBefore(vContainer, document.getElementById('zanjas-types-legend'));
        }

        if (vContainer) {
            if (valladoMetrosTotal > 0) {
                let vHtml = `<div class="summary-grid" style="grid-template-columns: 1fr; margin-bottom: 5px;"><div class="sum-item" style="border-left-color: #64748b; background: #e2e8f0;"><span>Total Vallado Perimetral</span><strong style="color:#0f172a;">${Math.round(valladoMetrosTotal).toLocaleString()} m</strong></div></div>`;
                vHtml += `<div class="summary-grid" style="grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));">`;
                Object.keys(valladoPorParcela).sort().forEach(p => {
                    vHtml += `<div class="sum-item" style="border-left-color: #94a3b8; padding: 4px 8px;"><span>Parcela ${escapeHtml(p)}</span><strong>${Math.round(valladoPorParcela[p]).toLocaleString()} m</strong></div>`;
                });
                vHtml += `</div>`;
                vContainer.innerHTML = vHtml;
            } else {
                vContainer.innerHTML = '';
            }
        }
        initPanZoomZanjas();
        setupSVGDelegation();
    } catch(e) {
        console.error("Error crítico dibujando Zanjas:", e);
    }
}

function toggleZAPanel() {
    zaPanelCollapsed = !zaPanelCollapsed;
    const body = document.getElementById('za-panel-body');
    const icon = document.getElementById('za-toggle-icon');
    const viewport = document.getElementById('zanjas-viewport');
    if (body) body.classList.toggle('collapsed', zaPanelCollapsed);
    if (icon) icon.classList.toggle('collapsed', zaPanelCollapsed);
    if (viewport) viewport.classList.toggle('za-panel-collapsed', zaPanelCollapsed);
}

function toggleZALayer(category, key) {
    zaLayerState[category][key] = !zaLayerState[category][key];
    if (currentAppMode === 'ZA') renderMatrixZanjas();
}

function toggleZALayerDropdown() {
    const dd = document.getElementById('za-layer-dropdown');
    const btn = document.getElementById('za-layer-btn');
    if (dd && btn) {
        dd.classList.toggle('show');
    }
}

document.addEventListener('click', function(e) {
    const dd = document.getElementById('za-layer-dropdown');
    const btn = document.getElementById('za-layer-btn');
    if (dd && btn && !btn.contains(e.target) && !dd.contains(e.target)) {
        dd.classList.remove('show');
    }
});

function setupSVGDelegation() {
    const viewport = document.getElementById('zanjas-viewport');
    if (!viewport) return;
    viewport.addEventListener('click', function(e) {
        const target = e.target.closest('[data-action]');
        if (!target) return;
        const action = target.dataset.action;
        if (action === 'zanja') {
            abrirModalZanja(target.dataset.id);
        } else if (action === 'puntual') {
            abrirModalPuntual(target.dataset.id, target.dataset.ptype, target.dataset.ref);
        } else if (action === 'vallado') {
            abrirModalVallado(target.dataset.pid, target.dataset.pname, parseInt(target.dataset.metros));
        }
    });
}

function initPanZoomZanjas() {
    if (_panZoomInitialized) return;
    _panZoomInitialized = true;

    const viewport = document.getElementById('zanjas-viewport'); 
    const layer = document.getElementById('pan-zoom-layer');
    if (!viewport || !layer) return;

    let isDragging = false;
    let startX, startY;

    const onDown = (e) => {
        if (currentAppMode !== 'ZA') return;
        e.preventDefault();
        isDragging = true;
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;
        startX = clientX - pzPointX;
        startY = clientY - pzPointY;
        viewport.style.cursor = 'grabbing';
    };

    const onMove = (e) => {
        if (!isDragging || currentAppMode !== 'ZA') return;
        e.preventDefault();
        const clientX = e.clientX !== undefined ? e.clientX : (e.touches && e.touches[0].clientX);
        const clientY = e.clientY !== undefined ? e.clientY : (e.touches && e.touches[0].clientY);
        if (clientX === undefined || clientY === undefined) return;
        pzPointX = clientX - startX;
        pzPointY = clientY - startY;
        layer.style.transform = `translate(${pzPointX}px, ${pzPointY}px) scale(${pzScale})`;
    };

    const onUp = () => {
        if (currentAppMode !== 'ZA') return;
        isDragging = false;
        viewport.style.cursor = 'grab';
    };

    viewport.addEventListener('mousedown', onDown);
    viewport.addEventListener('mousemove', onMove);
    viewport.addEventListener('mouseup', onUp);
    viewport.addEventListener('mouseleave', onUp);

    viewport.addEventListener('touchstart', onDown, { passive: false });
    viewport.addEventListener('touchmove', onMove, { passive: false });
    viewport.addEventListener('touchend', onUp);

    viewport.addEventListener('wheel', function (e) {
        e.preventDefault();
        const rect = viewport.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        const xs = (mouseX - pzPointX) / pzScale;
        const ys = (mouseY - pzPointY) / pzScale;
        
        const delta = Math.sign(e.deltaY);
        if (delta < 0) pzScale *= 1.15;
        else if (delta > 0) pzScale /= 1.15;
        
        if(pzScale < 0.3) pzScale = 0.3;
        if(pzScale > 8) pzScale = 8;
        
        pzPointX = mouseX - xs * pzScale;
        pzPointY = mouseY - ys * pzScale;
        layer.style.transform = `translate(${pzPointX}px, ${pzPointY}px) scale(${pzScale})`;
        
        document.querySelectorAll('#zanjas-viewport line:not(.za-vallado-line):not(.za-vallado-point)').forEach(line => { 
            line.setAttribute('stroke-width', 4 / pzScale); 
        });
        document.querySelectorAll('.za-vallado-line').forEach(line => { 
            line.setAttribute('stroke-width', 1.5 / pzScale); 
            line.setAttribute('stroke-dasharray', `${8/pzScale}, ${4/pzScale}`);
        });
        document.querySelectorAll('.za-vallado-point').forEach(line => { 
            line.setAttribute('stroke-width', 1.5 / pzScale); 
        });
        document.querySelectorAll('.za-vallado-circle').forEach(circle => { 
            circle.setAttribute('r', 2.5 / pzScale); 
            circle.setAttribute('stroke-width', 1.2 / pzScale); 
        });
        
        document.querySelectorAll('#zanjas-viewport text.za-cut-text').forEach(txt => { 
            txt.setAttribute('font-size', 10 / pzScale); 
            txt.setAttribute('stroke-width', 5 / pzScale); 
        });
    }, { passive: false });
}

function abrirModalCaja(id) {
    cerrarModalCaja(); 
    _currentCajaId = id;
    const sb = PARQUE_CAJAS[id];
    if (!sb) return;
    let checks = HISTORIAL_CAJAS[id] || {};
    const items = [{id: 'localizacion', label: '📍 Localización'}, {id: 'soportacion', label: '⚙️ Soportación'}, {id: 'fusibles', label: '🔌 Fusibles'}, {id: 'con_strings', label: '⚡ Conexionado Strings'}, {id: 'con_bus', label: '🔋 Conexionado BUS'}, {id: 'limpieza', label: '🧹 Limpieza'}];
    let html = `<div id="modal-caja-overlay" class="modal-overlay" onclick="cerrarModalCaja()"><div class="modal-content" onclick="event.stopPropagation()"><h3>Checklist: <span style="color:var(--accent);">${escapeHtml(sb.name)}</span></h3><div class="checklist">`;
    items.forEach(item => { 
        const isChecked = checks[item.id] !== undefined ? 'checked' : ''; 
        html += `<label class="check-item"><input type="checkbox" ${isChecked} data-action="check-caja" data-id="${escapeHtml(id)}" data-item="${item.id}">${item.label}</label>`; 
    });
    html += `</div><button class="btn-close" onclick="cerrarModalCaja()">Guardar y Cerrar</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function cerrarModalCaja() { 
    const m = document.getElementById('modal-caja-overlay'); 
    if(m) { 
        m.remove(); 
        if (_currentCajaId) {
            const htmlSbId = safeHtmlId(_currentCajaId); 
            const sbEl = document.getElementById('sb-' + htmlSbId);
            if (sbEl) {
                const checks = HISTORIAL_CAJAS[_currentCajaId] || {};
                const count = contarChecks(checks);
                let colorClass = 'sb-red';
                if (count === 6) colorClass = 'sb-green';
                else if (count > 0) colorClass = 'sb-orange';
                sbEl.className = 'string-box ' + colorClass;
            }
            _currentCajaId = null;
        }
        actualizarContadores(); 
    } 
}

async function toggleCheckCaja(id, item, isChecked) {
    if (!HISTORIAL_CAJAS[id]) HISTORIAL_CAJAS[id] = {};
    let hoy = document.getElementById('fecha-produccion') ? document.getElementById('fecha-produccion').value : '';
    if (!hoy) hoy = new Date().toISOString().split('T')[0]; 
    
    if (isChecked) {
        HISTORIAL_CAJAS[id][item] = hoy;
    } else {
        delete HISTORIAL_CAJAS[id][item];
    }
    try { await localforage.setItem('HISTORIAL_CAJAS', HISTORIAL_CAJAS); } catch (e) { console.error("Error al guardar historial de cajas:", e); }
}

function contarChecks(checks) {
    let count = 0;
    if(checks['localizacion'] !== undefined) count++; 
    if(checks['soportacion'] !== undefined) count++; 
    if(checks['fusibles'] !== undefined) count++; 
    if(checks['con_strings'] !== undefined) count++; 
    if(checks['con_bus'] !== undefined) count++; 
    if(checks['limpieza'] !== undefined) count++;
    return count;
}

function abrirModalPuntual(id, type, refName) {
    cerrarModalPuntual();
    _currentPuntual = { id, type };
    let checks = HISTORIAL_PUNTUALES[id] || {};
    const items = CHECKLIST_PUNTUALES[type];
    if (!items) return;
    
    let html = `<div id="modal-punctual-overlay" class="modal-overlay" onclick="cerrarModalPuntual()"><div class="modal-content" onclick="event.stopPropagation()"><h3>Checklist: <span style="color:var(--accent);">${escapeHtml(refName)}</span></h3><div class="checklist">`;
    items.forEach(item => { 
        const isChecked = checks[item.id] !== undefined ? 'checked' : ''; 
        html += `<label class="check-item"><input type="checkbox" ${isChecked} data-action="check-puntual" data-id="${escapeHtml(id)}" data-item="${item.id}">${item.label}</label>`; 
    });
    html += `</div><button class="btn-close" onclick="cerrarModalPuntual()">Guardar y Cerrar</button></div></div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function cerrarModalPuntual() {
    const m = document.getElementById('modal-punctual-overlay');
    if (m) {
        m.remove();
        if (_currentPuntual) {
            const htmlPId = safeHtmlId(_currentPuntual.id);
            const ptEl = document.getElementById('pt-' + htmlPId);
            if (ptEl) {
                const checks = HISTORIAL_PUNTUALES[_currentPuntual.id] || {};
                const max = CHECKLIST_PUNTUALES[_currentPuntual.type].length;
                const count = contarChecksPuntual(checks, _currentPuntual.type);
                ptEl.setAttribute('fill', getColorPuntual(count, max));
            }
            _currentPuntual = null;
        }
        actualizarContadores();
    }
}

async function toggleCheckPuntual(id, item, isChecked) {
    if (!HISTORIAL_PUNTUALES[id]) HISTORIAL_PUNTUALES[id] = {};
    let hoy = document.getElementById('fecha-produccion') ? document.getElementById('fecha-produccion').value : '';
    if (!hoy) hoy = new Date().toISOString().split('T')[0];

    if (isChecked) { HISTORIAL_PUNTUALES[id][item] = hoy; } 
    else { delete HISTORIAL_PUNTUALES[id][item]; }
    try { await localforage.setItem('HISTORIAL_PUNTUALES', HISTORIAL_PUNTUALES); } catch (e) { console.error("Error al guardar historial puntuales:", e); }
}
const STATUS_COLORS = { 'H': '#ffeb3b', 'P': '#2196f3', 'T': '#9c27b0', 'O': '#00bcd4', 'M': '#4caf50', '': '#fff' };
function getStyleByStatus(s) { return STATUS_COLORS[s] || '#fff'; }

function modalConfirmacion(mensaje) {
    return new Promise((resolve) => {
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        const idYes = 'btn-cf-y-' + Date.now();
        const idNo = 'btn-cf-n-' + Date.now();
        overlay.innerHTML = `
            <div class="modal-content" onclick="event.stopPropagation()">
                <h3>⚠️ Confirmar</h3>
                <p style="margin: 15px 0; color: #555; font-size: 14px; line-height: 1.5;">${mensaje}</p>
                <div style="display: flex; gap: 10px;">
                    <button id="${idYes}" class="btn-close" style="flex:1; background: #dc2626;">Sí, continuar</button>
                    <button id="${idNo}" class="btn-close" style="flex:1; background: #64748b;">Cancelar</button>
                </div>
            </div>`;
        overlay.addEventListener('click', () => { overlay.remove(); resolve(false); });
        overlay.querySelector('#' + idYes).addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); resolve(true); });
        overlay.querySelector('#' + idNo).addEventListener('click', (e) => { e.stopPropagation(); overlay.remove(); resolve(false); });
        document.body.appendChild(overlay);
    });
}

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

function getLevelIndex(status) {
    return (status === '' || status == null) ? -1 : LEVELS.indexOf(status);
}

function degradeData(data, newLvlIdx) {
    for (let i = newLvlIdx + 1; i < LEVELS.length; i++) {
        delete data[LEVELS[i]];
    }
    return data;
}

function applyToCell(id, newTask, newLvlIdx, hoy) {
    const cell = document.getElementById(id);
    if (!cell) return;

    let raw = HISTORIAL_PROD[id];
    let data = getMigratedData(raw);
    const curLvlIdx = getLevelIndex(data.estado || '');

    if (newLvlIdx < curLvlIdx) {
        degradeData(data, newLvlIdx);
    } else if (newTask !== '') {
        for (let i = 0; i <= newLvlIdx; i++) {
            if (!data[LEVELS[i]]) data[LEVELS[i]] = hoy;
        }
    }

    data.estado = newTask;

    cell.innerText = newTask;
    cell.style.backgroundColor = getStyleByStatus(newTask);
    cell.style.color = newTask === '' ? 'transparent' : '#333';

    if (newTask === '') delete HISTORIAL_PROD[id];
    else HISTORIAL_PROD[id] = data;
}

async function paint(id) {
    const newTask = currentTask === 'NA' ? '' : currentTask;
    const newLvlIdx = getLevelIndex(newTask);
    let hoy = document.getElementById('fecha-produccion') ? document.getElementById('fecha-produccion').value : '';
    if (!hoy) hoy = new Date().toISOString().split('T')[0];

    let raw = HISTORIAL_PROD[id];
    let data = getMigratedData(raw);
    const curLvlIdx = getLevelIndex(data.estado || '');

    if (newLvlIdx < curLvlIdx && data.estado) {
        if (!await modalConfirmacion('¿Deseas degradar o borrar esta unidad? Se perderán las fechas registradas superiores.')) return;
    }

    applyToCell(id, newTask, newLvlIdx, hoy);

    try { await localforage.setItem('HISTORIAL_PROD', HISTORIAL_PROD); } catch (e) { console.error("Error al guardar historial:", e); }
    actualizarContadores();
}

async function paintRow(trackerId, filaNum) {
    const newTask = currentTask === 'NA' ? '' : currentTask;
    const newLvlIdx = getLevelIndex(newTask);
    let hoy = document.getElementById('fecha-produccion') ? document.getElementById('fecha-produccion').value : '';
    if (!hoy) hoy = new Date().toISOString().split('T')[0];
    const tr = PARQUE_MASTER[trackerId];
    if (!tr || !tr.filas[filaNum]) return;

    const f = tr.filas[filaNum];
    let needsConfirm = false;
    for (let h = 1; h <= f.hincas; h++) {
        const raw = HISTORIAL_PROD[`${trackerId}-F${filaNum}-H${h}`];
        const data = getMigratedData(raw);
        if (newLvlIdx < getLevelIndex(data.estado || '') && data.estado) {
            needsConfirm = true;
            break;
        }
    }
    if (needsConfirm) {
        if (!await modalConfirmacion('¿Deseas degradar o borrar esta fila? Se perderán fechas de producción superiores.')) return;
    }

    for (let h = 1; h <= f.hincas; h++) {
        applyToCell(`${trackerId}-F${filaNum}-H${h}`, newTask, newLvlIdx, hoy);
    }

    try { await localforage.setItem('HISTORIAL_PROD', HISTORIAL_PROD); } catch (e) { console.error("Error al guardar historial:", e); }
    actualizarContadores();
}

async function paintTracker(trackerId) {
    const newTask = currentTask === 'NA' ? '' : currentTask;
    const newLvlIdx = getLevelIndex(newTask);
    let hoy = document.getElementById('fecha-produccion') ? document.getElementById('fecha-produccion').value : '';
    if (!hoy) hoy = new Date().toISOString().split('T')[0];
    const tr = PARQUE_MASTER[trackerId];
    if (!tr) return;

    let needsConfirm = false;
    outer:
    for (let fN in tr.filas) {
        for (let h = 1; h <= tr.filas[fN].hincas; h++) {
            const raw = HISTORIAL_PROD[`${trackerId}-F${fN}-H${h}`];
            const data = getMigratedData(raw);
            if (newLvlIdx < getLevelIndex(data.estado || '') && data.estado) {
                needsConfirm = true;
                break outer;
            }
        }
    }
    if (needsConfirm) {
        if (!await modalConfirmacion('¿Deseas degradar o borrar este tracker? Se perderán fechas superiores.')) return;
    }

    for (let fN in tr.filas) {
        for (let h = 1; h <= tr.filas[fN].hincas; h++) {
            applyToCell(`${trackerId}-F${fN}-H${h}`, newTask, newLvlIdx, hoy);
        }
    }

    try { await localforage.setItem('HISTORIAL_PROD', HISTORIAL_PROD); } catch (e) { console.error("Error al guardar historial:", e); }
    actualizarContadores();
}

let _syncPMOTimer = null;
function debouncedSyncPMO() {
    if (_syncPMOTimer) clearTimeout(_syncPMOTimer);
    _syncPMOTimer = setTimeout(() => {
        _syncPMOTimer = null;
        sincronizarConPMO();
    }, 30000);
}

function actualizarContadores() {
    const arco = document.getElementById('select-arco').value;
    const block = document.getElementById('select-block').value;
    if (!block || !PARQUE_MASTER) return;

    let tH = 0, tF = 0, cH = 0, cP = 0, cT = 0, cO = 0, cM = 0; 
    const ids = Object.keys(PARQUE_MASTER).filter(id => PARQUE_MASTER[id].arco === arco && PARQUE_MASTER[id].block.startsWith(block));
    const lv = {'': 0, 'H': 1, 'P': 2, 'T': 3, 'O': 4, 'M': 5};

    for (let id of ids) {
        const tr = PARQUE_MASTER[id];
        for (let fN in tr.filas) {
            const f = tr.filas[fN]; tF++; tH += f.hincas;
            let minLvl = 5;
            for (let h = 1; h <= f.hincas; h++) {
                const rawData = HISTORIAL_PROD[`${id}-F${fN}-H${h}`]; 
                const st = (rawData && typeof rawData === 'object') ? (rawData.estado || '') : (rawData || '');
                const l = lv[st] || 0;
                if (l >= 1) cH++; if (l >= 2) cP++;
                if (l < minLvl) minLvl = l;
            }
            if (minLvl >= 3) cT++; if (minLvl >= 4) cO++; if (minLvl >= 5) cM++;
        }
    }
    
    const elH = document.getElementById('sum-H'); if(elH) elH.innerText = `${cH} / ${tH} totales`;
    const elP = document.getElementById('sum-P'); if(elP) elP.innerText = `${cP} / ${tH} totales`;
    const elT = document.getElementById('sum-T'); if(elT) elT.innerText = `${cT} / ${tF} totales`;
    const elO = document.getElementById('sum-O'); if(elO) elO.innerText = `${cO} / ${tF} totales`;
    const elM = document.getElementById('sum-M'); if(elM) elM.innerText = `${cM} / ${tF} totales`;

    let totalCajas = 0, cRed = 0, cOrange = 0, cGreen = 0;
    const sbIds = Object.keys(PARQUE_CAJAS).filter(id => PARQUE_CAJAS[id].arco === arco && PARQUE_CAJAS[id].block.startsWith(block));
    
    for (let id of sbIds) {
        totalCajas++;
        let checks = HISTORIAL_CAJAS[id] || {};
        let count = contarChecks(checks);
        if(count === 0) cRed++; else if(count === 6) cGreen++; else cOrange++;
    }

    const eRed = document.getElementById('sum-scb-red');
    const eOrange = document.getElementById('sum-scb-orange');
    const eGreen = document.getElementById('sum-scb-green');
    
    if(eRed) eRed.innerText = `${cRed}`;
    if(eOrange) eOrange.innerText = `${cOrange}`;
    if(eGreen) eGreen.innerText = `${cGreen} / ${totalCajas} totales`;

    debouncedSyncPMO();
}

window.onload = async () => {
    try {
        const s = await localforage.getItem('PARQUE_MASTER_DATA');
        const ps = await localforage.getItem('PARQUE_ESTACIONES_DATA');
        const sb = await localforage.getItem('PARQUE_CAJAS_DATA');
        const hcajas = await localforage.getItem('HISTORIAL_CAJAS');
        const hp = await localforage.getItem('HISTORIAL_PUNTUALES');
        const h = await localforage.getItem('HISTORIAL_PROD');
        const z = await localforage.getItem('PARQUE_ZANJAS_DATA'); 
        const pt = await localforage.getItem('PARQUE_PUNTUALES_DATA');
        const v = await localforage.getItem('PARQUE_VALLADO_DATA'); 
        const hzanjas = await localforage.getItem('HISTORIAL_ZANJAS'); 
        const hvallado = await localforage.getItem('HISTORIAL_VALLADO'); 

        if(s) PARQUE_MASTER = s; 
        if(ps) PARQUE_ESTACIONES = ps; 
        if(sb) PARQUE_CAJAS = sb; 
        if(hcajas) HISTORIAL_CAJAS = hcajas;
        if(hp) HISTORIAL_PUNTUALES = hp;
        if(z) PARQUE_ZANJAS = z; 
        if(pt) PARQUE_PUNTUALES = pt;
        if(v) PARQUE_VALLADO = v; 
        if(hzanjas) HISTORIAL_ZANJAS = hzanjas; 
        if(hvallado) HISTORIAL_VALLADO = hvallado; 

        if (h) {
            for (let key in h) {
                h[key] = getMigratedData(h[key]);
            }
            HISTORIAL_PROD = h;
        }

        if(s) actualizarSelectores();
        setupModalDelegation();
    } catch (error) {
        console.error("Error al cargar datos:", error);
    }
};

function setupModalDelegation() {
    document.addEventListener('change', function(e) {
        const target = e.target;
        const action = target.dataset.action;
        if (action === 'check-caja') {
            toggleCheckCaja(target.dataset.id, target.dataset.item, target.checked);
        } else if (action === 'check-puntual') {
            toggleCheckPuntual(target.dataset.id, target.dataset.item, target.checked);
        } else if (action === 'check-vallado') {
            toggleCheckVallado(target.dataset.id, target.dataset.item, target.checked);
        }
    });
    document.addEventListener('input', function(e) {
        const target = e.target;
        if (target.dataset.action === 'zanja-input') {
            changeMetrosZanja(target.dataset.id, target.dataset.item, target.value, parseInt(target.dataset.max));
        }
    });
}

function abrirModalZanja(id) {
    cerrarModalZanja();
    const z = PARQUE_ZANJAS[id];
    if (!z) return;
    
    const dx = z.x2 - z.x1;
    const dy = z.y2 - z.y1;
    const longitud = Math.sqrt(dx*dx + dy*dy);
    const maxMetros = Math.round(longitud);
    
    let stats = HISTORIAL_ZANJAS[id] || {};
    
    const items = [
        {id: 'excavacion', label: '⛏️ 1. Excavación (profundidad y ancho)'},
        {id: 'cama_arena', label: '⏳ 2. Cama de arena'},
        {id: 'inspeccion_cables', label: '🔍 3. Inspección de cables'},
        {id: 'ruteado_peinado', label: '🔌 4. Ruteado y peinado'},
        {id: 'identificacion_cables', label: '🏷️ 5. Identificación cables'},
        {id: 'cinta_seguridad', label: '🎀 6. Cinta seguridad'},
        {id: 'cierre_zanja', label: '🪨 7. Cierre de zanja'}
    ];
    
    const type = normalizeZanjaType(z.ref);
    
    let html = `
    <div id="modal-zanja-overlay" class="modal-overlay" onclick="cerrarModalZanja()">
        <div class="modal-content" onclick="event.stopPropagation()">
            <h3>Zanja: <span style="color:var(--accent);">${escapeHtml(z.ref)}</span></h3>
            <p style="margin-top:-8px; margin-bottom:20px; color:#64748b; font-size:13px;">Categoría: <strong>${type}</strong> | Longitud Total: <strong>${maxMetros} m</strong></p>
            <div class="checklist" style="display:flex; flex-direction:column; gap:4px;">`;
            
    items.forEach(item => {
        const val = stats[item.id] !== undefined ? stats[item.id] : '';
        html += `
        <div class="zanja-item" style="display:flex; align-items:center; justify-content:space-between; margin-bottom:8px; gap:15px; font-size:14px; border-bottom:1px dashed #e2e8f0; padding-bottom:6px;">
            <span style="font-weight:500; color:#334155;">${item.label}</span>
            <div style="display:flex; align-items:center; gap:5px;">
                <input type="number" min="0" max="${maxMetros}" placeholder="0" value="${val}" 
                       style="width:75px; padding:5px; border:1px solid #cbd5e1; border-radius:6px; text-align:center; font-weight:bold; color:var(--accent);"
                       data-action="zanja-input" data-id="${escapeHtml(id)}" data-item="${item.id}" data-max="${maxMetros}">
                <span style="color:#64748b; font-weight:600; font-size:13px; min-width:65px;">/ [${maxMetros} m]</span>
            </div>
        </div>`;
    });
    
    html += `
            </div>
            <button class="btn-close" style="margin-top:15px; width:100%;" onclick="cerrarModalZanja()">Guardar y Cerrar</button>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', html);
}

function cerrarModalZanja() {
    const m = document.getElementById('modal-zanja-overlay');
    if(m) m.remove();
}

let _zanjaTimers = {};

function changeMetrosZanja(id, itemId, value, maxMetros) {
    if (!HISTORIAL_ZANJAS[id]) HISTORIAL_ZANJAS[id] = {};
    
    let num = parseFloat(value);
    if (isNaN(num) || num < 0 || value.trim() === '') {
        delete HISTORIAL_ZANJAS[id][itemId];
    } else {
        if (num > maxMetros) num = maxMetros;
        HISTORIAL_ZANJAS[id][itemId] = num;
    }
    
    const key = id + '_' + itemId;
    if (_zanjaTimers[key]) clearTimeout(_zanjaTimers[key]);
    _zanjaTimers[key] = setTimeout(async () => {
        delete _zanjaTimers[key];
        try { await localforage.setItem('HISTORIAL_ZANJAS', HISTORIAL_ZANJAS); } catch (e) { console.error(e); }
        renderMatrixZanjas();
    }, 300);
}

function renderDashboardZanjas() {
    const container = document.getElementById('matrix-container');
    if (!container) return;
    
    const selectEl = document.getElementById('select-arco');
    const arco = selectEl ? selectEl.value : '';
    
    if(!arco || arco.includes('Carga')) {
        container.innerHTML = '<div style="padding:40px; text-align:center; font-weight:bold; color:#64748b; font-size:16px;">⚠️ Por favor, carga un archivo Excel o selecciona un Arco válido para ver las analíticas.</div>';
        return;
    }
    
    let zValues = Object.values(PARQUE_ZANJAS).filter(z => z.arco === arco);
    
    let totalMetrosProyecto = 0;
    let metrosPorItem = { excavacion: 0, cama_arena: 0, inspeccion_cables: 0, ruteado_peinado: 0, identificacion_cables: 0, cinta_seguridad: 0, cierre_zanja: 0 };
    let metrosPorTipo = {}; 

    zValues.forEach(z => {
        const dx = z.x2 - z.x1; const dy = z.y2 - z.y1;
        const longitud = Math.sqrt(dx*dx + dy*dy);
        totalMetrosProyecto += longitud;
        const type = normalizeZanjaType(z.ref);
        if (!metrosPorTipo[type]) metrosPorTipo[type] = { total: 0, ejecutado: 0 };
        metrosPorTipo[type].total += longitud;

        let stats = HISTORIAL_ZANJAS[z.id] || {};
        if (stats.excavacion) metrosPorItem.excavacion += stats.excavacion;
        if (stats.cama_arena) metrosPorItem.cama_arena += stats.cama_arena;
        if (stats.inspeccion_cables) metrosPorItem.inspeccion_cables += stats.inspeccion_cables;
        if (stats.ruteado_peinado) metrosPorItem.ruteado_peinado += stats.ruteado_peinado;
        if (stats.identificacion_cables) metrosPorItem.identificacion_cables += stats.identificacion_cables;
        if (stats.cinta_seguridad) metrosPorItem.cinta_seguridad += stats.cinta_seguridad;
        if (stats.cierre_zanja) { metrosPorItem.cierre_zanja += stats.cierre_zanja; metrosPorTipo[type].ejecutado += stats.cierre_zanja; }
    });

    const pctAvanceReal = totalMetrosProyecto > 0 ? ((metrosPorItem.cierre_zanja / totalMetrosProyecto) * 100).toFixed(1) : 0;

    let html = `
    <h2 style="margin-top:0; color:#1e293b; font-size:18px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">📊 Cuadro Analítico: Canalizaciones e Hitos de Obra Civil (${arco})</h2>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap:15px; margin-bottom:25px; margin-top:15px;">
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border-left:4px solid #64748b;"><div style="font-size:12px; color:#64748b; font-weight:600;">METROS DISEÑO TOTAL</div><div style="font-size:22px; font-weight:700; color:#1e293b; margin-top:5px;">${Math.round(totalMetrosProyecto).toLocaleString()} m</div></div>
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border-left:4px solid #ffeb3b;"><div style="font-size:12px; color:#64748b; font-weight:600;">EXCAVACIÓN REALIZADA</div><div style="font-size:22px; font-weight:700; color:#1e293b; margin-top:5px;">${Math.round(metrosPorItem.excavacion).toLocaleString()} m</div></div>
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border-left:4px solid #4caf50;"><div style="font-size:12px; color:#64748b; font-weight:600;">ZANJA COMPLETADA (HITOS 1-7)</div><div style="font-size:22px; font-weight:700; color:#4caf50; margin-top:5px;">${Math.round(metrosPorItem.cierre_zanja).toLocaleString()} m <span style="font-size:14px; color:#64748b; font-weight:500;">(${pctAvanceReal}%)</span></div></div>
    </div>
    <h3 style="color:#334155; font-size:15px; margin-bottom:10px;">📉 Estado Lineal por Fases de Ejecución</h3>
    <div style="display:flex; flex-direction:column; gap:8px; background:#f8fafc; padding:15px; border-radius:8px; margin-bottom:25px;">
        ${[{k:'excavacion', l:'⛏️ 1. Excavación'}, {k:'cama_arena', l:'⏳ 2. Cama de arena'}, {k:'inspeccion_cables', l:'🔍 3. Inspección de cables'}, {k:'ruteado_peinado', l:'🔌 4. Ruteado y peinado'}, {k:'identificacion_cables', l:'🏷️ 5. Identificación cables'}, {k:'cinta_seguridad', l:'🎀 6. Cinta seguridad'}, {k:'cierre_zanja', l:'🪨 7. Cierre de zanja'}].map(f => {
            const m = metrosPorItem[f.k]; const pct = totalMetrosProyecto > 0 ? ((m / totalMetrosProyecto) * 100).toFixed(1) : 0;
            return `<div style="font-size:13px; font-weight:500; color:#334155;">${f.l}: <strong>${Math.round(m).toLocaleString()} m</strong> (${pct}%)</div><div style="width:100%; background:#e2e8f0; height:12px; border-radius:6px; margin-bottom:8px; overflow:hidden;"><div style="width:${pct}%; background:${f.k==='cierre_zanja'?'#4caf50':'#2196f3'}; height:100%;"></div></div>`;
        }).join('')}
    </div>
    <h3 style="color:#334155; font-size:15px; margin-bottom:10px;">📋 Balance de Producción por Tipo de Circuito</h3>
    <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
        <thead><tr style="background:#e2e8f0; color:#334155;"><th style="padding:10px; border:1px solid #cbd5e1;">Tipo Circuito</th><th style="padding:10px; border:1px solid #cbd5e1;">Diseño Total</th><th style="padding:10px; border:1px solid #cbd5e1;">Completado</th><th style="padding:10px; border:1px solid #cbd5e1;">Pendiente</th><th style="padding:10px; border:1px solid #cbd5e1;">% Listo</th></tr></thead>
        <tbody>
            ${Object.keys(metrosPorTipo).sort().map(t => {
                const item = metrosPorTipo[t]; const pend = Math.max(0, item.total - item.ejecutado); const p = item.total > 0 ? ((item.ejecutado / item.total) * 100).toFixed(1) : 0;
                return `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; font-weight:600; border:1px solid #cbd5e1;">${t}</td><td style="padding:10px; border:1px solid #cbd5e1;">${Math.round(item.total).toLocaleString()} m</td><td style="padding:10px; color:#4caf50; font-weight:600; border:1px solid #cbd5e1;">${Math.round(item.ejecutado).toLocaleString()} m</td><td style="padding:10px; color:#ef4444; border:1px solid #cbd5e1;">${Math.round(pend).toLocaleString()} m</td><td style="padding:10px; font-weight:600; border:1px solid #cbd5e1;">${p}%</td></tr>`;
            }).join('')}
        </tbody>
    </table>`;
    container.innerHTML = html;
}

function renderDashboardPuntuales() {
    const container = document.getElementById('matrix-container');
    if (!container) return;
    
    const selectEl = document.getElementById('select-arco');
    const arco = selectEl ? selectEl.value : '';
    
    if(!arco || arco.includes('Carga')) {
        container.innerHTML = '<div style="padding:40px; text-align:center; font-weight:bold; color:#64748b; font-size:16px;">⚠️ Por favor, carga un archivo Excel o selecciona un Arco válido para ver las analíticas.</div>';
        return;
    }
    
    let pValues = Object.values(PARQUE_PUNTUALES).filter(p => p.arco === arco);
    
    let totalEquipos = pValues.length;
    let resumenTipos = {};

    pValues.forEach(p => {
        const refUp = p.ref.toUpperCase();
        let typeKey = 'otras'; let label = 'Otros Elementos'; let maxChecks = 6;
        if (refUp.includes('ARQUETA')) { typeKey = 'arqueta'; label = '📥 Arquetas Registro'; maxChecks = 6; } 
        else if (refUp.includes('POSTE CAJA')) { typeKey = 'csb'; label = '📦 Postes Caja (CSB)'; maxChecks = 7; }
        else if (refUp.includes('BÁCULO-CCTV') || refUp.includes('BACULO-CCTV') || refUp.includes('CCTV') || refUp.includes('FC-')) { typeKey = 'cctv'; label = '🎥 Báculos CCTV'; maxChecks = 6; }
        else if (refUp.includes('GATEWAY')) { typeKey = 'gateway'; label = '📡 Gateways'; maxChecks = 7; }
        else if (refUp.includes('MBOX')) { typeKey = 'mbox'; label = '⚡ Cajas MBox'; maxChecks = 7; }
        else if (refUp.includes('TBOX')) { typeKey = 'tbox'; label = '🔋 Cajas TBox'; maxChecks = 7; }
        else if (refUp.includes('METEO')) { typeKey = 'meteo'; label = '🌤️ Estaciones Meteo'; maxChecks = 6; }

        if (!resumenTipos[typeKey]) resumenTipos[typeKey] = { label: label, total: 0, sin_empezar: 0, en_proceso: 0, terminados: 0, maxC: maxChecks };
        resumenTipos[typeKey].total++;
        let checks = HISTORIAL_PUNTUALES[p.id] || {};
        let count = 0;
        Object.keys(checks).forEach(k => { if(checks[k]) count++; });
        if (count === 0) resumenTipos[typeKey].sin_empezar++;
        else if (count === maxChecks) resumenTipos[typeKey].terminados++;
        else resumenTipos[typeKey].en_proceso++;
    });

    let tSin = 0, tPro = 0, tTer = 0;
    Object.values(resumenTipos).forEach(r => { tSin += r.sin_empezar; tPro += r.en_proceso; tTer += r.terminados; });
    const pctGral = totalEquipos > 0 ? ((tTer / totalEquipos) * 100).toFixed(1) : 0;

    let html = `
    <h2 style="margin-top:0; color:#1e293b; font-size:18px; border-bottom:2px solid #e2e8f0; padding-bottom:8px;">📊 Cuadro Analítico: Equipamiento e Instalaciones Puntuales (${arco})</h2>
    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap:15px; margin-bottom:25px; margin-top:15px;">
        <div style="background:#f8fafc; padding:15px; border-radius:8px; border-left:4px solid #64748b;"><div style="font-size:12px; color:#64748b;">TOTAL EQUIPOS RED</div><div style="font-size:22px; font-weight:700; color:#1e293b; margin-top:5px;">${totalEquipos} uds</div></div>
        <div style="background:#fff5f5; padding:15px; border-radius:8px; border-left:4px solid #ef4444;"><div style="font-size:12px; color:#991b1b;">PENDIENTES</div><div style="font-size:22px; font-weight:700; color:#b91c1c; margin-top:5px;">${tSin} uds</div></div>
        <div style="background:#fffbeb; padding:15px; border-radius:8px; border-left:4px solid #f59e0b;"><div style="font-size:12px; color:#92400e;">EN MONTAJE / AJUSTE</div><div style="font-size:22px; font-weight:700; color:#b45309; margin-top:5px;">${tPro} uds</div></div>
        <div style="background:#f0fdf4; padding:15px; border-radius:8px; border-left:4px solid #4caf50;"><div style="font-size:12px; color:#166534;">INSTALADOS AL 100%</div><div style="font-size:22px; font-weight:700; color:#166534; margin-top:5px;">${tTer} uds <span style="font-size:14px; color:#64748b;">(${pctGral}%)</span></div></div>
    </div>
    <h3 style="color:#334155; font-size:15px; margin-bottom:10px;">📋 Estado de Montaje por Tipo de Equipamiento</h3>
    <table style="width:100%; border-collapse:collapse; font-size:13px; text-align:left;">
        <thead><tr style="background:#e2e8f0; color:#334155;"><th style="padding:10px; border:1px solid #cbd5e1;">Descripción Elemento</th><th style="padding:10px; border:1px solid #cbd5e1; text-align:center;">Total</th><th style="padding:10px; border:1px solid #cbd5e1; text-align:center; color:#b91c1c;">Sin Empezar</th><th style="padding:10px; border:1px solid #cbd5e1; text-align:center; color:#b45309;">En Proceso</th><th style="padding:10px; border:1px solid #cbd5e1; text-align:center; color:#166534;">Terminado</th><th style="padding:10px; border:1px solid #cbd5e1; text-align:center;">% Listo</th></tr></thead>
        <tbody>
            ${Object.keys(resumenTipos).sort().map(k => {
                const r = resumenTipos[k]; const pOk = r.total > 0 ? ((r.terminados / r.total) * 100).toFixed(0) : 0;
                return `<tr style="border-bottom:1px solid #e2e8f0;"><td style="padding:10px; font-weight:600; border:1px solid #cbd5e1;">${r.label}</td><td style="padding:10px; text-align:center; font-weight:600; border:1px solid #cbd5e1;">${r.total}</td><td style="padding:10px; text-align:center; border:1px solid #cbd5e1; color:#64748b;">${r.sin_empezar}</td><td style="padding:10px; text-align:center; border:1px solid #cbd5e1; color:#b45309;">${r.en_proceso}</td><td style="padding:10px; text-align:center; border:1px solid #cbd5e1; color:#4caf50; font-weight:700;">${r.terminados}</td><td style="padding:10px; text-align:center; font-weight:700; border:1px solid #cbd5e1; background:#f8fafc;">${pOk}%</td></tr>`;
            }).join('')}
        </tbody>
    </table>`;
    container.innerHTML = html;
}

async function sincronizarConPMO() {
    try {
        let conteoDiario = {};

        // 1. Ahora la función acepta "cantidad" para poder sumar metros en lugar de solo unidades
        const addCount = (fecha, disc, grupo, itemStr, cantidad = 1) => {
            if (!conteoDiario[fecha]) conteoDiario[fecha] = {};
            if (!conteoDiario[fecha][disc]) conteoDiario[fecha][disc] = {};
            if (!conteoDiario[fecha][disc][grupo]) conteoDiario[fecha][disc][grupo] = {};
            if (!conteoDiario[fecha][disc][grupo][itemStr]) conteoDiario[fecha][disc][grupo][itemStr] = 0;
            
            conteoDiario[fecha][disc][grupo][itemStr] += cantidad;
        };

        // --- MECÁNICOS ---
        for (let id in HISTORIAL_PROD) {
            const data = HISTORIAL_PROD[id];
            if (typeof data === 'object') {
                if (data.H) addCount(data.H, 'Mecánicos', '3.1 INSTALACIÓN DE HINCAS', 'Instalación de hincas');
                if (data.T) addCount(data.T, 'Mecánicos', '3.2 MONTAJE DE ESTRUCTURA', 'Montaje de estructura');
                if (data.M) addCount(data.M, 'Mecánicos', '3.3 MONTAJE DE MODULOS', 'Montaje de módulos');
            }
        }

        // --- ELÉCTRICOS: Cajas SCB ---
        for (let id in HISTORIAL_CAJAS) {
            const date = HISTORIAL_CAJAS[id]['soportacion']; 
            if (date) addCount(date, 'Eléctricos', '4.5 SCBs', 'Instalacion mecánica de cajas');
        }

        // --- CIVIL Y ELÉCTRICOS: Equipos Puntuales guiados por Checklist ---
        for (let id in HISTORIAL_PUNTUALES) {
            const p = PARQUE_PUNTUALES[id];
            if (!p) continue;
            const checks = HISTORIAL_PUNTUALES[id];
            const refUp = p.ref.toUpperCase();
            
            if (refUp.includes('ARQUETA') && checks['colocacion']) {
                addCount(checks['colocacion'], 'Civil', '2.8 ARQUETAS Y CIMENTACIONES M', 'arquetas');
            }
            else if (refUp.includes('BÁCULO-CCTV') || refUp.includes('BACULO-CCTV') || refUp.includes('CCTV') || refUp.includes('FC-')) {
                if (checks['cimentacion']) addCount(checks['cimentacion'], 'Civil', '2.8 ARQUETAS Y CIMENTACIONES M', 'cimentaciones cctv');
                if (checks['colocacion_poste']) addCount(checks['colocacion_poste'], 'Eléctricos', '4.8 CCTV', 'instalacion de baculos');
            }
            else if (refUp.includes('POSTE CAJA') || refUp.includes('GATEWAY') || refUp.includes('MBOX') || refUp.includes('TBOX') || refUp.includes('METEO')) {
                if (checks['cimentacion']) addCount(checks['cimentacion'], 'Civil', '2.8 ARQUETAS Y CIMENTACIONES M', 'cimentaciones torres');
                if (checks['colocacion_poste']) {
                    const dateColocacion = checks['colocacion_poste'];
                    if (refUp.includes('POSTE CAJA')) addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'CSB');
                    else if (refUp.includes('MBOX+GATEWAY')) {
                        addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'MBOX');
                        addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'GATEWAY');
                    }
                    else if (refUp.includes('GATEWAY')) addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'GATEWAY');
                    else if (refUp.includes('MBOX')) addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'MBOX');
                    else if (refUp.includes('TBOX')) addCount(dateColocacion, 'Eléctricos', '4.7 torres de comunicacion', 'TBOX');
                    else if (refUp.includes('METEO')) addCount(dateColocacion, 'Eléctricos', '4.10 ESTACIÓN METEOROLÓGICA', 'Estación Meteorológica');
                }
            }
        }

        // --- CIVIL: Vallado Perimetral (Comprobación de los 6 checks) ---
        for (let id in HISTORIAL_VALLADO) {
            const checks = HISTORIAL_VALLADO[id];
            
            // Solo si están los 6 apartados marcados
            if (checks['comp_materiales'] && checks['replanteo'] && checks['hormigonado'] && 
                checks['malla'] && checks['tensores'] && checks['puerta']) {
                
                // Extraemos la fecha más reciente en la que se completó el último paso
                const fechaFin = Object.values(checks).sort().reverse()[0];
                
                // Desglosamos el ID (ej: "ARC1_1") para buscar los metros
                const partes = id.split('_');
                const arco = partes[0];
                const parcela = partes.slice(1).join('_');
                
                let metrosParcela = 0;
                if (PARQUE_VALLADO[arco] && PARQUE_VALLADO[arco][parcela]) {
                    let pts = PARQUE_VALLADO[arco][parcela].sort((a, b) => a.numero - b.numero);
                    if (pts.length >= 2) {
                        for(let i = 0; i < pts.length; i++) {
                            let p1 = pts[i]; let p2 = pts[(i + 1) % pts.length];
                            metrosParcela += Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                        }
                    }
                }

                if (metrosParcela > 0) {
                    addCount(fechaFin, 'Civil', '2.2 VALLADO PERIMETRAL', 'Vallado perimetral', Math.round(metrosParcela));
                }
            }
        }

        // 2. Descargar historial de PMO
        const pmoDB = localforage.createInstance({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
        let histPMO = await pmoDB.getItem('PMO_HISTORIAL_PRODUCCION') || {};

        // 4. Volcado Final Inyectando Cantidades
        for (let fecha in conteoDiario) {
            if (!histPMO[fecha]) histPMO[fecha] = {};
            for (let disc in conteoDiario[fecha]) {
                if (!histPMO[fecha][disc]) histPMO[fecha][disc] = {};
                for (let grupo in conteoDiario[fecha][disc]) {
                    if (!histPMO[fecha][disc][grupo]) histPMO[fecha][disc][grupo] = [];
                    let arrayPMO = histPMO[fecha][disc][grupo];
                    
                    for (let itemStr in conteoDiario[fecha][disc][grupo]) {
                        const cantidad = conteoDiario[fecha][disc][grupo][itemStr];
                        let found = false;
                        for (let i = 0; i < arrayPMO.length; i++) {
                            if (arrayPMO[i].item === itemStr) {
                                arrayPMO[i].cantidad = cantidad;
                                found = true;
                                break;
                            }
                        }
                        if (!found) {
                            // Asignar "m" para vallado y "uds" para el resto
                            const unidadItem = (itemStr === 'Vallado perimetral') ? 'm' : 'uds';
                            arrayPMO.push({ item: itemStr, cantidad: cantidad, unidad: unidadItem });
                        }
                    }
                }
            }
        }

        await pmoDB.setItem('PMO_HISTORIAL_PRODUCCION', histPMO);
    } catch (error) {
        console.error("Error en la sincronización:", error);
    }
}
async function generarTablaTotales() {
    try {
        let totales = {
            hincas: 0, trackers: 0, modulos: 0,  
            scb: Object.keys(PARQUE_CAJAS).length,
            power_stations: Object.keys(PARQUE_ESTACIONES).length,
            vallado: 0, arquetas: 0, cctv: 0, meteos: 0, tbox: 0, mbox: 0, gateway: 0, csb: 0,
            zanjas_bt: 0, zanjas_mt: 0, zanjas_cctv: 0, zanjas_ssaa: 0
        };

        let tFilas = 0, tHincas = 0;
        Object.values(PARQUE_MASTER).forEach(tr => {
            if (tr.filas) {
                for (let fN in tr.filas) {
                    tFilas++; 
                    tHincas += parseInt(tr.filas[fN].hincas) || 0;
                }
            }
        });

        totales.hincas = tHincas;
        totales.trackers = tFilas; 
        totales.modulos = tFilas;  

        Object.values(PARQUE_PUNTUALES).forEach(p => {
            const refUp = String(p.ref).toUpperCase();
            if (refUp.includes('ARQUETA')) totales.arquetas++;
            else if (refUp.includes('POSTE CAJA')) totales.csb++;
            else if (refUp.includes('BÁCULO-CCTV') || refUp.includes('BACULO-CCTV') || refUp.includes('CCTV') || refUp.includes('FC-')) totales.cctv++;
            else if (refUp.includes('MBOX+GATEWAY')) { totales.mbox++; totales.gateway++; }
            else if (refUp.includes('GATEWAY')) totales.gateway++;
            else if (refUp.includes('MBOX')) totales.mbox++;
            else if (refUp.includes('TBOX')) totales.tbox++;
            else if (refUp.includes('METEO')) totales.meteos++;
        });

        Object.values(PARQUE_VALLADO).forEach(arcoObj => {
            Object.values(arcoObj).forEach(parcelaArr => {
                let pts = parcelaArr.sort((a, b) => a.numero - b.numero);
                if (pts.length >= 2) {
                    for(let i = 0; i < pts.length; i++) {
                        let p1 = pts[i]; let p2 = pts[(i + 1) % pts.length];
                        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                        totales.vallado += Math.sqrt(dx*dx + dy*dy);
                    }
                }
            });
        });

        Object.values(PARQUE_ZANJAS).forEach(z => {
            const dx = z.x2 - z.x1; const dy = z.y2 - z.y1;
            const metros = Math.sqrt(dx*dx + dy*dy);
            const type = normalizeZanjaType(z.ref);
            if (type === 'BT') totales.zanjas_bt += metros;
            else if (type === 'MT') totales.zanjas_mt += metros;
            else if (type === 'CCTV') totales.zanjas_cctv += metros;
            else if (type === 'SSAA' || type === 'PAT') totales.zanjas_ssaa += metros;
        });

        await localforage.setItem('PARQUE_TOTALES_PROYECTO', totales);
    } catch (error) {
        console.error(error);
    }
}

// ==========================================================================
// CHECKLIST DE VALLADO PERIMETRAL
// ==========================================================================
const CHECKLIST_VALLADO_ITEMS = [
    {id: 'comp_materiales', label: '📦 Comprobación de Materiales a emplear'},
    {id: 'replanteo', label: '📍 Replanteo y postes'},
    {id: 'hormigonado', label: '🧱 Hormigonado y aplomado postes'},
    {id: 'malla', label: '🕸️ Colocación malla'},
    {id: 'tensores', label: '🔩 Instalación tensores'},
    {id: 'puerta', label: '🚪 Puerta vehicular'}
];

function getValladoColor(parcelaId) {
    const checks = HISTORIAL_VALLADO[parcelaId] || {};
    let count = 0;
    CHECKLIST_VALLADO_ITEMS.forEach(i => { if (checks[i.id]) count++; });
    if (count === 0) return '#64748b'; // Gris (Sin empezar)
    if (count === CHECKLIST_VALLADO_ITEMS.length) return '#22c55e'; // Verde (Terminado)
    return '#f59e0b'; // Naranja (En proceso)
}

function abrirModalVallado(id, parcelaName, metros) {
    cerrarModalVallado();
    let checks = HISTORIAL_VALLADO[id] || {};
    let html = `
    <div id="modal-vallado-overlay" class="modal-overlay" onclick="cerrarModalVallado()">
        <div class="modal-content" onclick="event.stopPropagation()">
            <h3>Vallado: <span style="color:var(--accent);">Parcela ${escapeHtml(parcelaName)}</span></h3>
            <p style="margin-top:-8px; margin-bottom:15px; color:#64748b; font-size:13px;">Longitud del tramo: <strong>${metros} m</strong></p>
            <div class="checklist">`;
            
    CHECKLIST_VALLADO_ITEMS.forEach(item => { 
        const isChecked = checks[item.id] !== undefined ? 'checked' : ''; 
        html += `<label class="check-item"><input type="checkbox" ${isChecked} data-action="check-vallado" data-id="${escapeHtml(id)}" data-item="${item.id}">${item.label}</label>`; 
    });
    
    html += `
            </div>
            <button class="btn-close" style="margin-top:15px; width:100%;" onclick="cerrarModalVallado()">Guardar y Cerrar</button>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', html);
}

function cerrarModalVallado() {
    const m = document.getElementById('modal-vallado-overlay');
    if (m) {
        m.remove();
        renderMatrixZanjas(); // Refresca el mapa para aplicar los colores nuevos
        sincronizarConPMO();  // <--- ESTA ES LA LÍNEA QUE FALTABA PARA ENVIARLO AL PMO
    }
}
async function toggleCheckVallado(id, item, isChecked) {
    if (!HISTORIAL_VALLADO[id]) HISTORIAL_VALLADO[id] = {};
    const inputFecha = document.getElementById('fecha-produccion');
    let hoy = inputFecha ? inputFecha.value || new Date().toISOString().split('T')[0] : new Date().toISOString().split('T')[0];
    
    if (isChecked) HISTORIAL_VALLADO[id][item] = hoy; 
    else delete HISTORIAL_VALLADO[id][item];
    
    try { await localforage.setItem('HISTORIAL_VALLADO', HISTORIAL_VALLADO); } 
    catch (e) { console.error("Error guardando checklist vallado:", e); }
}