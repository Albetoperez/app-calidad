function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

let tabActiva = 'curvas'; 
let miGraficoGlobal = null;
let miGraficoFisico = null;
let miGraficoBarras = null;
let miGraficoResumenBarras = null;
let miGraficoResumenEvol = null;

let ESTRUCTURA_DASH = {}, HISTORIAL = {}, acumulados = {};
let cacheTareasCalculadas = [];

let CERTIFICACIONES = {};

window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    ESTRUCTURA_DASH = await localforage.getItem('PMO_ESTRUCTURA_FINAL') || {};
    HISTORIAL = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    CERTIFICACIONES = await localforage.getItem('PMO_CERTIFICACIONES') || {};
    
    const selector = document.getElementById('filtro-disc');
    const disciplinas = Object.keys(ESTRUCTURA_DASH);
    
    if (disciplinas.length === 0) {
        selector.innerHTML = '<option value="__TODAS__">🌐 Todas las disciplinas</option><option>No hay metas configuradas</option>';
    } else {
        const opts = ['<option value="__TODAS__">🌐 Todas las disciplinas</option>'];
        disciplinas.forEach(d => opts.push(`<option value="${d}">${d}</option>`));
        selector.innerHTML = opts.join('');
    }
    
    actualizarSelectorItems();
    actualizarTodo();
};

function actualizarTodo() {
    procesarAcumulados();
    calcularPlanificacionYKPIs(); 
    dibujarTablaRAGLimpia();
    dibujarTablaRatiosCronograma0();
    actualizarTabActual();
}

function cambiarDisciplina() { 
    actualizarSelectorItems(); 
    actualizarTodo(); 
}

function actualizarSelectorItems() {
    const disc = document.getElementById('filtro-disc').value;
    const selectorItem = document.getElementById('filtro-item');
    
    if (disc === '__TODAS__') {
        selectorItem.innerHTML = '<option value="">🌐 Vista global (todas las disciplinas)</option>';
        document.getElementById('wrapper-filtro-item').style.display = 'none';
        return;
    }
    
    const grupos = ESTRUCTURA_DASH[disc] || {};
    let opts = [], count = 0;
    for (let g in grupos) {
        grupos[g].forEach(sub => {
            opts.push(`<option value="${sub.item}">${g} -> ${sub.item}</option>`);
            count++;
        });
    }
    selectorItem.innerHTML = count > 0 ? opts.join('') : '<option>No hay ítems</option>';
    document.getElementById('wrapper-filtro-item').style.display = 'flex';
}

function cambiarTab(tab) {
    tabActiva = tab;
    document.getElementById('tab-curvas').classList.remove('active');
    document.getElementById('tab-barras').classList.remove('active');
    document.getElementById('tab-ratios').classList.remove('active');
    document.getElementById('tab-gantt').classList.remove('active');
    document.getElementById('tab-economico').classList.remove('active');
    document.getElementById('tab-resumen').classList.remove('active');
    document.getElementById(`tab-${tab}`).classList.add('active');
    
    document.getElementById('wrapper-curvas').style.display = (tab === 'curvas') ? 'block' : 'none';
    document.getElementById('wrapper-barras').style.display = (tab === 'barras') ? 'block' : 'none';
    document.getElementById('wrapper-ratios').style.display = (tab === 'ratios') ? 'block' : 'none';
    document.getElementById('gantt-wrapper').style.display = (tab === 'gantt') ? 'block' : 'none';
    document.getElementById('wrapper-economico').style.display = (tab === 'economico') ? 'block' : 'none';
    document.getElementById('wrapper-resumen').style.display = (tab === 'resumen') ? 'block' : 'none';
    
    document.getElementById('rag-table-card').style.display = (tab === 'barras') ? 'block' : 'none';
    
    actualizarTabActual();
}

function actualizarTabActual() {
    // MAGIA VISUAL: Ocultamos los filtros de fechas si estamos en Gantt o Ratios
    try {
        const containerDesde = document.getElementById('fecha-desde')?.parentElement;
        const containerHasta = document.getElementById('fecha-hasta')?.parentElement;
        const botonesRango = document.querySelectorAll('.btn-quick-filter');
        
        // Solo tienen sentido las fechas en Curvas y Barras
        const mostrarFechas = (tabActiva === 'curvas' || tabActiva === 'barras');
        
        if (containerDesde) containerDesde.style.display = mostrarFechas ? '' : 'none';
        if (containerHasta) containerHasta.style.display = mostrarFechas ? '' : 'none';
        botonesRango.forEach(b => b.style.display = mostrarFechas ? '' : 'none');
    } catch(e) { console.warn("Error ocultando filtros", e); }

    // Carga de la pestaña correspondiente
    if (tabActiva === 'curvas') {
        setTimeout(dibujarGraficoGlobal, 30);
        setTimeout(dibujarGraficoFisico, 30);
    }
    else if (tabActiva === 'barras') setTimeout(dibujarGraficoBarras, 30);
    else if (tabActiva === 'ratios') setTimeout(dibujarTablaRatiosCronograma0, 30);
    else if (tabActiva === 'gantt') setTimeout(dibujarGantt, 30);
    else if (tabActiva === 'economico') setTimeout(dibujarTablaEconomica, 30);
    else if (tabActiva === 'resumen') setTimeout(dibujarResumenEconomico, 30);
}

function obtenerFechasOrdenadas() {
    let fechas = Object.keys(HISTORIAL);
    const desde = document.getElementById('fecha-desde').value;
    const hasta = document.getElementById('fecha-hasta').value;
    if (desde) fechas = fechas.filter(f => f >= desde);
    if (hasta) fechas = fechas.filter(f => f <= hasta);
    fechas.sort((a, b) => new Date(a) - new Date(b));
    return fechas;
}

function procesarAcumulados() {
    acumulados = {};
    const hasta = document.getElementById('fecha-hasta').value;
    for (let f in HISTORIAL) {
        if (hasta && f > hasta) continue;
        for (let d in HISTORIAL[f]) {
            for (let g in HISTORIAL[f][d]) {
                HISTORIAL[f][d][g].forEach(item => {
                    const key = `${d}||${g}||${item.item}`;
                    acumulados[key] = (acumulados[key] || 0) + item.cantidad;
                });
            }
        }
    }
}

function obtenerItemsADecorrer(disc) {
    if (disc === '__TODAS__') {
        let items = [];
        for (let d in ESTRUCTURA_DASH) {
            for (let g in ESTRUCTURA_DASH[d]) {
                ESTRUCTURA_DASH[d][g].forEach(sub => {
                    items.push({ disciplina: d, grupo: g, item: sub.item, meta: sub.meta, unidad: sub.unidad });
                });
            }
        }
        return items;
    }
    const grupos = ESTRUCTURA_DASH[disc] || {};
    let items = [];
    for (let g in grupos) {
        grupos[g].forEach(sub => {
            items.push({ disciplina: disc, grupo: g, item: sub.item, meta: sub.meta, unidad: sub.unidad });
        });
    }
    return items;
}

function calcularPlanificacionYKPIs() {
    const disc = document.getElementById('filtro-disc').value;
    const itemsGlobales = obtenerItemsADecorrer('__TODAS__');
    let hoy = new Date();
    hoy.setHours(0,0,0,0);
    
    let mapTareas = {};
    cacheTareasCalculadas = [];

    itemsGlobales.forEach(t => {
        const grupos = ESTRUCTURA_DASH[t.disciplina] || {};
        const items = grupos[t.grupo] || [];
        let realSub = items.find(s => s.item === t.item);
        if (realSub && realSub.fechaInicio && realSub.fechaFin) {
            let id = `${t.disciplina}||${t.grupo}||${t.item}`;
            let tareaObj = {
                id: id, disciplina: t.disciplina, grupo: t.grupo, item: t.item, meta: t.meta, unidad: t.unidad,
                fechaInicio: new Date(realSub.fechaInicio),
                fechaFin: new Date(realSub.fechaFin),
                vinculos: realSub.vinculos || [],
                pctFisico: 0
            };
            const key = `${t.disciplina}||${t.grupo}||${t.item}`;
            const prod = acumulados[key] || 0;
            tareaObj.pctFisico = t.meta > 0 ? Math.min(100, Math.round((prod / t.meta) * 100)) : 0;
                    
            tareaObj.inicioProyectado = tareaObj.fechaInicio.getTime();
            tareaObj.finProyectado = tareaObj.fechaFin.getTime();
            tareaObj.duracion = tareaObj.finProyectado - tareaObj.inicioProyectado;

            if (tareaObj.pctFisico < 100 && tareaObj.finProyectado < hoy.getTime()) {
                tareaObj.finProyectado = hoy.getTime();
                tareaObj.duracion = tareaObj.finProyectado - tareaObj.inicioProyectado;
            }
            mapTareas[id] = tareaObj;
            cacheTareasCalculadas.push(tareaObj);
        }
    });

    let numT = cacheTareasCalculadas.length;
    for (let i = 0; i < numT; i++) {
        let huboCambios = false;
        cacheTareasCalculadas.forEach(t => {
            let maxFinPredecesoras = t.fechaInicio.getTime();
            t.vinculos.forEach(vid => {
                let pred = mapTareas[vid];
                if (pred && pred.finProyectado > maxFinPredecesoras) maxFinPredecesoras = pred.finProyectado;
            });
            if (maxFinPredecesoras > t.inicioProyectado) {
                t.inicioProyectado = maxFinPredecesoras;
                t.finProyectado = t.inicioProyectado + t.duracion;
                if (t.pctFisico < 100 && t.finProyectado < hoy.getTime()) {
                    t.finProyectado = hoy.getTime();
                    t.duracion = t.finProyectado - t.inicioProyectado;
                }
                huboCambios = true;
            }
        });
        if (!huboCambios) break;
    }
}

function mostrarCargaGrafico() {
    document.getElementById('titulo-grafico').innerText = '⏳ Sincronizando datos PMO...';
}

function obtenerMetaTotalDisc(disc) {
    let total = 0;
    if (disc === '__TODAS__') {
        for (let d in ESTRUCTURA_DASH) {
            for (let g in ESTRUCTURA_DASH[d]) ESTRUCTURA_DASH[d][g].forEach(sub => total += sub.meta);
        }
    } else {
        for (let g in (ESTRUCTURA_DASH[disc] || {})) ESTRUCTURA_DASH[disc][g].forEach(sub => total += sub.meta);
    }
    return total;
}

function dibujarGraficoGlobal() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        const fechas = obtenerFechasOrdenadas();
        const metaTotalDisc = obtenerMetaTotalDisc(disc);
        let datosProgreso = [], prodAcum = 0;
        
        fechas.forEach(f => {
            if (HISTORIAL[f]) {
                if (disc === '__TODAS__') {
                    for (let d in HISTORIAL[f]) {
                        for (let g in HISTORIAL[f][d]) HISTORIAL[f][d][g].forEach(i => prodAcum += i.cantidad);
                    }
                } else if (HISTORIAL[f][disc]) {
                    for (let g in HISTORIAL[f][disc]) HISTORIAL[f][disc][g].forEach(i => prodAcum += i.cantidad);
                }
            }
            datosProgreso.push(metaTotalDisc > 0 ? Math.round((prodAcum / metaTotalDisc) * 100) : 0);
        });

        if (fechas.length === 0) { fechas.push(new Date().toISOString().split('T')[0]); datosProgreso.push(0); }
        document.getElementById('titulo-grafico').innerText = `Panel de Control de Avance Temporal — ${disc === '__TODAS__' ? 'Proyecto Global' : disc}`;

        const ctx = document.getElementById('chartMain').getContext('2d');
        if (miGraficoGlobal) miGraficoGlobal.destroy();
        miGraficoGlobal = new Chart(ctx, {
            type: 'line',
            data: { labels: fechas, datasets: [{ label: 'Curva S Avanzada (%) Real', data: datosProgreso, borderColor: '#005596', backgroundColor: 'rgba(0,85,150,0.05)', borderWidth: 3, fill: true, tension: 0.1 }] },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } } }
        });
    } catch (e) { console.error(e); }
}

function dibujarGraficoFisico() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        const selectorItem = document.getElementById('filtro-item');
        const itemSelec = selectorItem ? selectorItem.value : '';
        
        const canvasEl = document.getElementById('chartFisico');
        const mensajeEl = document.getElementById('mensaje-aviso-fisico');

        if (disc === '__TODAS__' || !itemSelec) {
            if (miGraficoFisico) { miGraficoFisico.destroy(); miGraficoFisico = null; }
            if (canvasEl) canvasEl.style.display = 'none';
            if (mensajeEl) mensajeEl.style.display = 'block';
            return;
        }

        if (canvasEl) canvasEl.style.display = 'block';
        if (mensajeEl) mensajeEl.style.display = 'none';

        const fechas = obtenerFechasOrdenadas();
        let metaItem = 0, unidadItem = '';

        for (let g in ESTRUCTURA_DASH[disc]) {
            ESTRUCTURA_DASH[disc][g].forEach(sub => { if (sub.item === itemSelec) { metaItem = sub.meta; unidadItem = sub.unidad; } });
        }

        let datosProd = [], datosMeta = [], prodAcum = 0;
        fechas.forEach(f => {
            if (HISTORIAL[f] && HISTORIAL[f][disc]) {
                for (let g in HISTORIAL[f][disc]) {
                    HISTORIAL[f][disc][g].forEach(i => { if (i.item === itemSelec) prodAcum += i.cantidad; });
                }
            }
            datosProd.push(prodAcum); datosMeta.push(metaItem);
        });

        const ctx = canvasEl.getContext('2d');
        if (miGraficoFisico) miGraficoFisico.destroy();
        miGraficoFisico = new Chart(ctx, {
            type: 'line',
            data: { labels: fechas, datasets: [
                { label: `Instalado Real (${unidadItem})`, data: datosProd, borderColor: '#ff9800', backgroundColor: 'rgba(255,152,0,0.05)', borderWidth: 3, tension: 0.1 },
                { label: `Meta Línea Base`, data: datosMeta, borderColor: '#64748b', borderDash: [6,6], borderWidth: 2, fill: false }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) { console.error(e); }
}

function dibujarGraficoBarras() {
    try {
        const disc = document.getElementById('filtro-disc').value;
        let labels = [], metas = [], prods = [];

        if (disc === '__TODAS__') {
            for (let d in ESTRUCTURA_DASH) {
                let sumaMeta = 0, sumaProd = 0;
                for (let g in ESTRUCTURA_DASH[d]) {
                    ESTRUCTURA_DASH[d][g].forEach(sub => { sumaMeta += sub.meta; sumaProd += acumulados[`${d}||${g}||${sub.item}`] || 0; });
                }
                labels.push(d); metas.push(sumaMeta); prods.push(sumaProd);
            }
        } else {
            for (let g in ESTRUCTURA_DASH[disc]) {
                ESTRUCTURA_DASH[disc][g].forEach(sub => { labels.push(`${sub.item}`); metas.push(sub.meta); prods.push(acumulados[`${disc}||${g}||${sub.item}`] || 0); });
            }
        }

        const ctx = document.getElementById('chartBarras').getContext('2d');
        if (miGraficoBarras) miGraficoBarras.destroy();
        miGraficoBarras = new Chart(ctx, {
            type: 'bar',
            data: { labels: labels, datasets: [
                { label: 'Real Acumulada', data: prods, backgroundColor: '#ff9800' },
                { label: 'Contrato Original', data: metas, backgroundColor: '#d3e3f0' }
            ]},
            options: { responsive: true, maintainAspectRatio: false }
        });
    } catch (e) { console.error(e); }
}

function dibujarTablaRAGLimpia() {
    const tabla = document.getElementById('rag-tabla');
    const thead = tabla.querySelector('thead');
    const tbody = document.getElementById('rag-tbody');
    const fechaRef = document.getElementById('rag-fecha-ref');
    const disc = document.getElementById('filtro-disc').value;
    if (fechaRef) fechaRef.innerText = `Actualizado: ${new Date().toLocaleDateString()}`;

    // 1. Reescribir las cabeceras dinámicamente para el nuevo diseño (sin tocar el HTML)
    thead.innerHTML = `
        <tr style="background: #005596; color: white;">
            <th style="min-width: 280px; padding: 12px; text-align: left;">Estructura de Trabajo (WBS)</th>
            <th style="text-align: center; padding: 12px;">Meta (Contrato)</th>
            <th style="text-align: center; padding: 12px;">Acum. Real</th>
            <th style="text-align: center; padding: 12px;">% Avance Físico</th>
            <th style="text-align: left; padding: 12px;">Semáforo RAG</th>
        </tr>
    `;

    let hoy = new Date().getTime();
    let html = '';

    // Función auxiliar para pintar cada fila del árbol
    function renderFilaRAG(nivel, nombre, metaStr, acumStr, pct, critica, idFila, idPadre) {
        let estadoTexto = critica ? '🔴 Crítico' : (pct >= 100 ? '✅ Finalizado' : (pct === 0 ? '⚪ Sin Iniciar' : '🟢 En Plazo'));
        let estadoColor = critica ? '#dc2626' : (pct >= 100 ? '#059669' : (pct === 0 ? '#64748b' : '#16a34a'));
        
        const indentMap = { 'disc': '0px', 'group': '25px', 'item': '50px' };
        const indent = indentMap[nivel] || '0px';
        const bgColor = nivel === 'disc' ? '#f8fafc' : (nivel === 'group' ? '#ffffff' : '#fafafa');
        const fontWeight = nivel === 'disc' ? 'bold' : (nivel === 'group' ? '600' : 'normal');
        
        const attrId = idFila ? `data-tree-id="${idFila}"` : '';
        const attrPadre = idPadre ? `data-parent="${idPadre}"` : '';
        const isClickable = nivel !== 'item';
        const onClick = isClickable ? `onclick="toggleTree('${idFila}')"` : '';
        const icono = nivel === 'disc' ? '📁' : (nivel === 'group' ? '📂' : '📝');
        const classChild = nivel !== 'disc' ? 'tree-child' : '';

        // Capamos visualmente al 100%
        let displayPct = pct > 100 ? 100 : pct;

        return `<tr class="${classChild}" style="background:${bgColor}; border-bottom: 1px solid #e2e8f0; cursor:${isClickable ? 'pointer' : 'default'};" data-level="${nivel}" ${attrId} ${attrPadre} ${onClick}>
            <td style="padding: 10px; font-weight: ${fontWeight}; color: #334155; text-align: left;">
                <span style="display:inline-block; width:${indent};"></span>
                <span class="tree-icon">${icono}</span> ${esc(nombre)}
            </td>
            <td style="text-align:center; padding: 10px; color: #475569;">${metaStr}</td>
            <td style="text-align:center; padding: 10px; font-weight:bold; color: #005596;">${acumStr}</td>
            <td style="font-weight: 900; text-align:center; color: #0284c7; padding: 10px;">${displayPct}%</td>
            <td style="padding: 10px; font-weight: bold; color: ${estadoColor}; text-align: left;">${estadoTexto}</td>
        </tr>`;
    }

    let disciplinasAProcesar = disc === '__TODAS__' ? Object.keys(ESTRUCTURA_DASH) : [disc];

    if (disciplinasAProcesar.length === 0 || (disc !== '__TODAS__' && !ESTRUCTURA_DASH[disc])) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align: center; padding: 20px; color: #888;">No hay datos operativos registrados</td></tr>';
        return;
    }

    // 2. CONSTRUIR EL ÁRBOL
    disciplinasAProcesar.forEach(d => {
        let discItems = 0, sumaAvancesDisc = 0, discCritica = false;
        let gruposHTML = '';
        const discId = `rag-disc-${d.replace(/[\s\/]+/g, '_')}`;

        for (let g in ESTRUCTURA_DASH[d]) {
            let grpItems = 0, sumaAvancesGrp = 0, grpCritica = false;
            let itemsHTML = '';
            const grpId = `rag-grp-${d.replace(/[\s\/]+/g, '_')}-${g.replace(/[\s\/]+/g, '_')}`;

            ESTRUCTURA_DASH[d][g].forEach(sub => {
                grpItems++;
                discItems++;
                const prod = acumulados[`${d}||${g}||${sub.item}`] || 0;
                let pctFisico = sub.meta > 0 ? Math.round((prod / sub.meta) * 100) : (prod > 0 ? 100 : 0);
                
                let itemCritico = false;
                if (sub.fechaFin) {
                    let fin = new Date(sub.fechaFin).getTime();
                    if (hoy > fin && pctFisico < 100) {
                        itemCritico = true;
                        grpCritica = true;
                        discCritica = true;
                    }
                }

                sumaAvancesGrp += Math.min(100, pctFisico);
                sumaAvancesDisc += Math.min(100, pctFisico);

                let metaStr = sub.meta > 0 ? `${sub.meta.toLocaleString()} <small style="color:#888;">${sub.unidad}</small>` : '-';
                let prodStr = prod > 0 ? `${Math.round(prod).toLocaleString()} <small style="color:#888;">${sub.unidad}</small>` : '0';

                itemsHTML += renderFilaRAG('item', sub.item, metaStr, prodStr, pctFisico, itemCritico, '', grpId);
            });

            let pctGrp = grpItems > 0 ? Math.round(sumaAvancesGrp / grpItems) : 0;
            gruposHTML += renderFilaRAG('group', g, '-', '-', pctGrp, grpCritica, grpId, discId);
            gruposHTML += itemsHTML;
        }

        let pctDisc = discItems > 0 ? Math.round(sumaAvancesDisc / discItems) : 0;
        html += renderFilaRAG('disc', d.toUpperCase(), '-', '-', pctDisc, discCritica, discId, null);
        html += gruposHTML;
    });

    tbody.innerHTML = html;

    // 3. Plegar por defecto todo excepto las Disciplinas principales
    document.querySelectorAll('#rag-tbody .tree-child').forEach(el => el.style.display = 'none');
}

window.modoGanttActual = 'detallado';

window.setModoGantt = function(modo) {
    window.modoGanttActual = modo;
    const btnDetallado = document.getElementById('btn-gantt-detallado');
    const btnAgrupado = document.getElementById('btn-gantt-agrupado');
    
    if (btnDetallado && btnAgrupado) {
        if (modo === 'agrupado') {
            btnAgrupado.style.background = 'white'; btnAgrupado.style.color = 'var(--blue)'; btnAgrupado.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            btnDetallado.style.background = 'transparent'; btnDetallado.style.color = '#64748b'; btnDetallado.style.boxShadow = 'none';
        } else {
            btnDetallado.style.background = 'white'; btnDetallado.style.color = 'var(--blue)'; btnDetallado.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
            btnAgrupado.style.background = 'transparent'; btnAgrupado.style.color = '#64748b'; btnAgrupado.style.boxShadow = 'none';
        }
    }
    dibujarGantt();
};

// Variable global para guardar el nivel de lupa (Zoom)
if (!window.escalaGantt) window.escalaGantt = 'mensual';

window.setEscalaGantt = function(escala) {
    window.escalaGantt = escala;
    dibujarGantt();
};

function dibujarGantt() {
    const disc = document.getElementById('filtro-disc').value;
    const container = document.getElementById('gantt-container');
    let hoy = new Date(); hoy.setHours(0,0,0,0);
    const msPorDia = 1000 * 60 * 60 * 24;

    let tareasVista = disc === '__TODAS__' ? cacheTareasCalculadas : cacheTareasCalculadas.filter(t => t.disciplina === disc);
    if (tareasVista.length === 0) { 
        container.innerHTML = '<div style="padding: 30px; text-align: center; color: #888;">No hay tareas con plazos válidos.</div>'; 
        return; 
    }

    let minDate = new Date(Math.min(...tareasVista.map(t => t.fechaInicio.getTime())));
    let maxDate = new Date(Math.max(...tareasVista.map(t => t.finProyectado)));
    if (hoy > maxDate) maxDate = hoy;
    
    // Márgenes de seguridad
    minDate.setDate(minDate.getDate() - 7);
    maxDate.setDate(maxDate.getDate() + 7);

    let spanTotalMs = maxDate.getTime() - minDate.getTime();
    if (spanTotalMs === 0) spanTotalMs = msPorDia;
    let totalDays = Math.ceil(spanTotalMs / msPorDia);

    let tableWidth = '100%';
    if (window.escalaGantt === 'diaria') tableWidth = `${Math.max(1000, totalDays * 25)}px`;
    if (window.escalaGantt === 'semanal') tableWidth = `${Math.max(1000, (totalDays/7) * 85)}px`; 

    let timelineHTML = '<div class="gantt-timeline-header">';
    
    if (window.escalaGantt === 'mensual') {
        let mesTemp = new Date(minDate.getFullYear(), minDate.getMonth(), 1);
        while (mesTemp <= maxDate) {
            let leftPct = ((mesTemp - minDate) / spanTotalMs) * 100;
            if (leftPct >= 0 && leftPct <= 100) {
                let nombreMes = mesTemp.toLocaleDateString('es-ES', { month: 'short', year: '2-digit' });
                timelineHTML += `<div class="gantt-month-tick" style="left: ${leftPct}%;"><span>${nombreMes}</span></div>`;
            }
            mesTemp.setMonth(mesTemp.getMonth() + 1); 
        }
    } else if (window.escalaGantt === 'semanal') {
        let dTemp = new Date(minDate);
        let day = dTemp.getDay() || 7; 
        if(day !== 1) dTemp.setDate(dTemp.getDate() - (day - 1)); // Forzar inicio en Lunes
        dTemp.setHours(0,0,0,0);
        
        while (dTemp <= maxDate) {
            let leftPct = ((dTemp - minDate) / spanTotalMs) * 100;
            if (leftPct >= 0 && leftPct <= 100) {
                let dUTC = new Date(Date.UTC(dTemp.getFullYear(), dTemp.getMonth(), dTemp.getDate()));
                let dayNum = dUTC.getUTCDay() || 7;
                dUTC.setUTCDate(dUTC.getUTCDate() + 4 - dayNum);
                let yearStart = new Date(Date.UTC(dUTC.getUTCFullYear(),0,1));
                let weekNum = Math.ceil((((dUTC - yearStart) / 86400000) + 1)/7);
                
                let txt = "Sem " + weekNum;
                timelineHTML += `<div class="gantt-month-tick" style="left: ${leftPct}%; border-left: 1px dashed #cbd5e1;"><span style="font-size:0.65rem; margin-left:6px; color:#64748b; font-weight:600; display:inline-block; white-space:nowrap;">${txt}</span></div>`;
            }
            dTemp.setDate(dTemp.getDate() + 7);
        }
    } else if (window.escalaGantt === 'diaria') {
        let dTemp = new Date(minDate);
        while (dTemp <= maxDate) {
            let leftPct = ((dTemp - minDate) / spanTotalMs) * 100;
            if (leftPct >= 0 && leftPct <= 100) {
                let txt = dTemp.getDate();
                timelineHTML += `<div class="gantt-month-tick" style="left: ${leftPct}%; border-left: 1px dotted #e2e8f0;"><span style="font-size:0.6rem; margin-left:2px; color:#94a3b8;">${txt}</span></div>`;
            }
            dTemp.setDate(dTemp.getDate() + 1);
        }
    }

    let pctHoy = ((hoy - minDate) / spanTotalMs) * 100;
    if (pctHoy >= 0 && pctHoy <= 100) timelineHTML += `<div class="gantt-today-label" style="left: ${pctHoy}%;">HOY</div>`;
    timelineHTML += '</div>';

    const botonesViejos = document.getElementById('btn-gantt-detallado')?.parentElement;
    if(botonesViejos) botonesViejos.style.display = 'none';

    let toolbarHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 12px; background: #f8fafc; padding: 8px 16px; border-radius: 8px; border: 1px solid #e2e8f0;">
            <div style="display:flex; align-items:center; gap: 10px;">
                <span style="font-size: 0.8rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Estructura:</span>
                <div style="display:flex; background: #e2e8f0; padding: 3px; border-radius: 6px;">
                    <button onclick="window.setModoGantt('detallado')" style="border:none; padding: 5px 15px; border-radius: 4px; cursor:pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s; background: ${window.modoGanttActual === 'detallado' ? 'white' : 'transparent'}; color: ${window.modoGanttActual === 'detallado' ? '#005596' : '#64748b'}; box-shadow: ${window.modoGanttActual === 'detallado' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">Detallada</button>
                    <button onclick="window.setModoGantt('agrupado')" style="border:none; padding: 5px 15px; border-radius: 4px; cursor:pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s; background: ${window.modoGanttActual === 'agrupado' ? 'white' : 'transparent'}; color: ${window.modoGanttActual === 'agrupado' ? '#005596' : '#64748b'}; box-shadow: ${window.modoGanttActual === 'agrupado' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">Agrupada</button>
                </div>
            </div>
            <div style="display:flex; align-items:center; gap: 10px;">
                <span style="font-size: 0.8rem; color:#64748b; font-weight:bold; text-transform:uppercase;">Zoom Temporal:</span>
                <div style="display:flex; background: #e2e8f0; padding: 3px; border-radius: 6px;">
                    <button onclick="window.setEscalaGantt('mensual')" style="border:none; padding: 5px 15px; border-radius: 4px; cursor:pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s; background: ${window.escalaGantt === 'mensual' ? 'white' : 'transparent'}; color: ${window.escalaGantt === 'mensual' ? '#005596' : '#64748b'}; box-shadow: ${window.escalaGantt === 'mensual' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">Meses</button>
                    <button onclick="window.setEscalaGantt('semanal')" style="border:none; padding: 5px 15px; border-radius: 4px; cursor:pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s; background: ${window.escalaGantt === 'semanal' ? 'white' : 'transparent'}; color: ${window.escalaGantt === 'semanal' ? '#005596' : '#64748b'}; box-shadow: ${window.escalaGantt === 'semanal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">Semanas</button>
                    <button onclick="window.setEscalaGantt('diaria')" style="border:none; padding: 5px 15px; border-radius: 4px; cursor:pointer; font-size: 0.8rem; font-weight: bold; transition: 0.2s; background: ${window.escalaGantt === 'diaria' ? 'white' : 'transparent'}; color: ${window.escalaGantt === 'diaria' ? '#005596' : '#64748b'}; box-shadow: ${window.escalaGantt === 'diaria' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none'};">Días</button>
                </div>
            </div>
        </div>
    `;

    // SOLUCIÓN: Anchos fijos en píxeles (px) para las cabeceras en lugar de porcentajes (%)
    let html = toolbarHTML + `
    <div style="overflow-x: auto; overflow-y: auto; max-height: calc(100vh - 350px); width: 100%; border: 1px solid #e2e8f0; border-radius: 6px; position: relative;">
        <table class="gantt-table" style="min-width: ${tableWidth}; width: 100%; table-layout: fixed; border: none; margin: 0; border-collapse: separate; border-spacing: 0;">
        <thead style="position: sticky; top: 0; z-index: 50; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
            <tr>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 190px; min-width: 190px; max-width: 190px;">Tarea / WBS</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 85px; min-width: 85px; max-width: 85px; text-align:center;">Estado</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 50px; min-width: 50px; max-width: 50px; text-align:center;">Dur.</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 75px; min-width: 75px; max-width: 75px; text-align:center;">Inicio</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 75px; min-width: 75px; max-width: 75px; text-align:center;">Fin</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; width: 60px; min-width: 60px; max-width: 60px; text-align:center;">Desvío</th>
                <th style="background: white; border-bottom: 2px solid #e2e8f0; padding-bottom: 0; min-width: 300px;">${timelineHTML}</th>
            </tr>
        </thead>
        <tbody>`;

    let itemsADibujar = [];

    if (window.modoGanttActual === 'agrupado') {
        let gruposResumen = {};
        let propAgrupacion = disc === '__TODAS__' ? 'disciplina' : 'grupo';
        let labelAgrupacion = disc === '__TODAS__' ? 'Resumen Macro-Fase' : 'Resumen Grupo WBS';

        tareasVista.forEach(t => {
            let clave = t[propAgrupacion] || 'General';
            if (!gruposResumen[clave]) {
                gruposResumen[clave] = {
                    item: clave, grupo: labelAgrupacion,
                    fechaInicio: t.fechaInicio.getTime(), fechaFin: t.fechaFin.getTime(),
                    inicioProyectado: t.inicioProyectado, finProyectado: t.finProyectado,
                    sumaPct: t.pctFisico || 0, count: 1, caducadaCritica: false, empujada: false, nivel: 'grupo'
                };
            } else {
                let g = gruposResumen[clave];
                g.fechaInicio = Math.min(g.fechaInicio, t.fechaInicio.getTime());
                g.fechaFin = Math.max(g.fechaFin, t.fechaFin.getTime());
                g.inicioProyectado = Math.min(g.inicioProyectado, t.inicioProyectado);
                g.finProyectado = Math.max(g.finProyectado, t.finProyectado);
                g.sumaPct += (t.pctFisico || 0);
                g.count++;
            }
            if (hoy.getTime() > t.fechaFin.getTime() && (t.pctFisico || 0) < 100) gruposResumen[clave].caducadaCritica = true;
            if (t.inicioProyectado > t.fechaInicio.getTime()) gruposResumen[clave].empujada = true;
        });

        for (let clave in gruposResumen) {
            let g = gruposResumen[clave];
            g.pctFisico = g.sumaPct / g.count; 
            g.duracion = g.fechaFin - g.fechaInicio;
            itemsADibujar.push(g);
        }
    } else {
        itemsADibujar = tareasVista.map(t => ({
            item: t.item, grupo: t.grupo,
            fechaInicio: t.fechaInicio.getTime(), fechaFin: t.fechaFin.getTime(),
            inicioProyectado: t.inicioProyectado, finProyectado: t.finProyectado,
            duracion: t.duracion, pctFisico: t.pctFisico || 0, nivel: 'item'
        }));
    }

    itemsADibujar.forEach(t => {
        const leftBaselinePct = Math.max(0, ((t.fechaInicio - minDate.getTime()) / spanTotalMs) * 100);
        const widthBaselinePct = Math.max(0, ((t.fechaFin - t.fechaInicio) / spanTotalMs) * 100);

        let fechaFinRealOProyectada = t.finProyectado;
        if (t.pctFisico < 100 && hoy.getTime() > t.finProyectado) {
            fechaFinRealOProyectada = hoy.getTime(); 
        }

        const leftProjPct = Math.max(0, ((t.inicioProyectado - minDate.getTime()) / spanTotalMs) * 100);
        const widthActualPct = Math.max(0, ((fechaFinRealOProyectada - t.inicioProyectado) / spanTotalMs) * 100);

        const duracionDias = Math.max(1, Math.round((t.fechaFin - t.fechaInicio) / msPorDia));
        const strInicio = new Date(t.fechaInicio).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'2-digit'});
        const strFin = new Date(t.fechaFin).toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit', year:'2-digit'});
        
        let desvioDias = Math.round((fechaFinRealOProyectada - t.fechaFin) / msPorDia);
        if (t.pctFisico >= 100 && t.finProyectado <= t.fechaFin) desvioDias = 0; 
        
        let htmlDesvio = desvioDias > 0 
            ? `<span style="color:#dc2626; font-weight:bold;">+${desvioDias}</span>` 
            : `<span style="color:#16a34a;">0</span>`;

        let colorEstado = '#16a34a'; 
        let textoEstado = 'En plazo';
        let claseCSS = 'en-plazo';
        
        if (t.pctFisico >= 100) {
            textoEstado = 'Finalizado';
            colorEstado = '#16a34a';
        } else if ((window.modoGanttActual === 'agrupado' && t.caducadaCritica) || (window.modoGanttActual === 'detallado' && hoy.getTime() > t.fechaFin)) { 
            colorEstado = '#dc2626'; 
            textoEstado = 'Crítico'; 
            claseCSS = 'critico';
        } else if ((window.modoGanttActual === 'agrupado' && t.empujada) || (window.modoGanttActual === 'detallado' && t.inicioProyectado > t.fechaInicio)) { 
            colorEstado = '#f59e0b'; 
            textoEstado = 'Empujada'; 
        }

        let hoyLineHtml = (pctHoy >= 0 && pctHoy <= 100) ? `<div class="gantt-today-line" style="left: ${pctHoy}%;"></div>` : '';
        let estiloTexto = window.modoGanttActual === 'agrupado' ? 'font-weight:900; color:var(--blue); text-transform: uppercase; font-size: 0.85rem;' : 'font-weight:bold; color:var(--blue); font-size:0.85rem;';

        let htmlBarras = '';
        if (t.nivel === 'item') {
            htmlBarras = `
                <div class="gantt-baseline" style="left: ${leftBaselinePct}%; width: ${widthBaselinePct}%;"></div>
                <div class="gantt-actual ${claseCSS}" style="left: ${leftProjPct}%; width: ${widthActualPct}%;">
                    <div class="gantt-progress ${claseCSS}" style="width: ${t.pctFisico}%;"></div>
                </div>
                <div class="gantt-pct-text" style="left: calc(${leftProjPct}% + ${widthActualPct}%);">
                    ${Math.round(t.pctFisico)}%
                </div>
            `;
        } else {
            htmlBarras = `
                <div class="gantt-summary" style="left: ${leftBaselinePct}%; width: ${widthBaselinePct}%; top: 2px; height: 6px;"></div>
                <div class="gantt-actual ${claseCSS}" style="left: ${leftProjPct}%; width: ${widthActualPct}%; top: 14px; border-width: 1.5px; background-color: rgba(255,255,255,0.7);">
                    <div class="gantt-progress ${claseCSS}" style="width: ${t.pctFisico}%; opacity: 0.9;"></div>
                </div>
                <div class="gantt-pct-text" style="left: calc(${leftProjPct}% + ${widthActualPct}%); font-size: 11px;">
                    ${Math.round(t.pctFisico)}%
                </div>
            `;
        }

        html += `<tr>
            <td style="border-right: 1px solid #f1f5f9; overflow: hidden; text-overflow: ellipsis;"><div style="${estiloTexto}">${t.item}</div><div style="font-size:0.65rem; color:#888;">${t.grupo}</div></td>
            <td style="text-align:center; border-right: 1px solid #f1f5f9;"><span class="gantt-status" style="color:${colorEstado}; font-size: 0.75rem;">${textoEstado}</span></td>
            <td style="text-align:center; font-size: 0.75rem; color:#475569; font-weight: 500; border-right: 1px solid #f1f5f9;">${duracionDias}</td>
            <td style="text-align:center; font-size: 0.75rem; color:#475569; border-right: 1px solid #f1f5f9;">${strInicio}</td>
            <td style="text-align:center; font-size: 0.75rem; color:#475569; border-right: 1px solid #f1f5f9;">${strFin}</td>
            <td style="text-align:center; font-size: 0.8rem; border-right: 1px solid #e2e8f0;">${htmlDesvio}</td>
            <td>
                <div class="gantt-track">
                    ${hoyLineHtml}
                    ${htmlBarras}
                </div>
            </td>
        </tr>`;
    });
    
    html += `</tbody></table></div>`;
    container.innerHTML = html;
}
function aplicarFiltroRapido(rango) {
    document.querySelectorAll('.btn-quick-filter').forEach(b => b.classList.remove('active'));
    let el = document.querySelector(`.btn-quick-filter[data-range="${rango}"]`);
    if(el) el.classList.add('active');

    const hoy = new Date();
    const fmt = d => d.toISOString().split('T')[0];

    if (rango === 'todo') {
        document.getElementById('fecha-desde').value = '';
        document.getElementById('fecha-hasta').value = '';
    } else {
        const dias = parseInt(rango, 10);
        const desde = new Date(hoy);
        desde.setDate(hoy.getDate() - dias);
        document.getElementById('fecha-desde').value = fmt(desde);
        document.getElementById('fecha-hasta').value = fmt(hoy);
    }
    actualizarTodo();
}

function exportarExcelProf() {
    try {
        const desde = document.getElementById('fecha-desde').value;
        const hasta = document.getElementById('fecha-hasta').value;
        const libro = XLSX.utils.book_new();

        let datosConsolidados = [];
        cacheTareasCalculadas.forEach(t => {
            datosConsolidados.push({
                "Disciplina": t.disciplina, "Grupo WBS": t.grupo, "Ítem / Tarea": t.item,
                "Meta Contractual": t.meta, "Total Ejecutado Acumulado": Math.round(acumulados[`${t.disciplina}||${t.grupo}||${t.item}`] || 0),
                "Unidad": t.unidad, "% Avance": t.pctFisico / 100
            });
        });

        if (datosConsolidados.length === 0) { alert("No hay datos cargados en el sistema."); return; }

        const hojaConsolidado = XLSX.utils.json_to_sheet(datosConsolidados);
        hojaConsolidado['!cols'] = [{wch: 22}, {wch: 28}, {wch: 40}, {wch: 18}, {wch: 24}, {wch: 10}, {wch: 16}];
        hojaConsolidado['!autofilter'] = {ref: hojaConsolidado['!ref']};
        aplicarFormatoNumeros(hojaConsolidado, {3: '#,##0', 4: '#,##0', 6: '0%'});
        XLSX.utils.book_append_sheet(libro, hojaConsolidado, "Resumen Consolidado PMO");

        let datosCronologicos = [];
        for (let fecha in HISTORIAL) {
            if (desde && fecha < desde) continue;
            if (hasta && fecha > hasta) continue;
            for (let disc in HISTORIAL[fecha]) {
                for (let grupo in HISTORIAL[fecha][disc]) {
                    HISTORIAL[fecha][disc][grupo].forEach(item => {
                        if (item.cantidad > 0) {
                            datosCronologicos.push({
                                "Fecha Reporte": fecha, "Disciplina": disc, "Grupo WBS": grupo,
                                "Ítem / Tarea": item.item, "Cantidad": item.cantidad, "Ud.": item.unidad
                            });
                        }
                    });
                }
            }
        }

        if (datosCronologicos.length > 0) {
            datosCronologicos.sort((a, b) => new Date(a["Fecha Reporte"]) - new Date(b["Fecha Reporte"]));
            const hojaPartes = XLSX.utils.json_to_sheet(datosCronologicos);
            hojaPartes['!cols'] = [{wch: 16}, {wch: 22}, {wch: 28}, {wch: 40}, {wch: 14}, {wch: 10}];
            hojaPartes['!autofilter'] = {ref: hojaPartes['!ref']};
            aplicarFormatoNumeros(hojaPartes, {4: '#,##0.00'});
            XLSX.utils.book_append_sheet(libro, hojaPartes, "Historial Diario");
        }

        XLSX.writeFile(libro, `Cuadro_Mando_SIGMA_PMO_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("⚠️ Error al generar el Excel: " + error.message); }
}

function aplicarFormatoNumeros(hoja, formatos) {
    const range = XLSX.utils.decode_range(hoja['!ref']);
    for (let R = range.s.r + 1; R <= range.e.r; R++) {
        for (let C in formatos) {
            const addr = XLSX.utils.encode_cell({r: R, c: parseInt(C)});
            if (hoja[addr] && hoja[addr].t === 'n') { hoja[addr].z = formatos[C]; }
        }
    }
}

function exportarHistoricoPartes() {
    try {
        const fechas = Object.keys(HISTORIAL).sort();
        if (fechas.length === 0) { alert("No hay partes registrados."); return; }
        const libro = XLSX.utils.book_new();

        let datosPartes = [];
        fechas.forEach(fecha => {
            for (let disc in HISTORIAL[fecha]) {
                for (let grupo in HISTORIAL[fecha][disc]) {
                    HISTORIAL[fecha][disc][grupo].forEach(item => {
                        datosPartes.push({ "Fecha": fecha, "Disciplina": disc, "Grupo WBS": grupo, "Ítem / Tarea": item.item, "Cantidad": item.cantidad, "Unidad": item.unidad || '' });
                    });
                }
            }
        });

        const hojaPartes = XLSX.utils.json_to_sheet(datosPartes);
        hojaPartes['!cols'] = [{wch: 16}, {wch: 22}, {wch: 28}, {wch: 40}, {wch: 14}, {wch: 10}];
        XLSX.utils.book_append_sheet(libro, hojaPartes, "Partes Diarios");
        XLSX.writeFile(libro, `Historico_Partes_ELECNOR_${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) { alert("⚠️ Error: " + error.message); }
}

// === EXPORTACIONES PDF ===
function generarHTMLPortada(discLabel) {
    return `<div class="pdf-pagina pdf-portada">
        <div style="margin-bottom:30px;">
            <div class="pdf-portada-logo">ELECNOR</div>
            <div class="pdf-portada-logo-sub">Project Management Office</div>
        </div>
        <div class="pdf-portada-badge">SIGMA PMO</div>
        <div class="pdf-portada-titulo">INFORME EJECUTIVO DE PRODUCCIÓN</div>
        <div class="pdf-portada-linea"></div>
        <div class="pdf-portada-subtitulo">Panel de Control de Plazos y Obra</div>
        <div class="pdf-portada-info"><strong>Filtro Reporte:</strong> ${discLabel}<br><strong>Fecha de Emisión:</strong> ${new Date().toLocaleDateString()}</div>
    </div>`;
}

function fabricarTablaSubgrupos(nombreDisc) {
    let htmlFilas = '';
    let hoy = new Date().getTime();
    
    let tareasFiltradas = cacheTareasCalculadas.filter(t => t.disciplina === nombreDisc);
    let subgruposUnicos = [...new Set(tareasFiltradas.map(t => t.grupo))].sort();

    subgruposUnicos.forEach(sub => {
        let tareasSub = tareasFiltradas.filter(t => t.grupo === sub);
        let total = 0, cerradas = 0, sumaAvance = 0, critico = false;

        tareasSub.forEach(t => {
            total++;
            sumaAvance += t.pctFisico;
            if (t.pctFisico === 100) cerradas++;
            if (hoy > t.fechaFin && t.pctFisico < 100) critico = true;
        });

        let promedio = total > 0 ? Math.round(sumaAvance / total) : 0;
        let estadoTxt = critico ? '🔴 Crítico' : (promedio >= 100 ? '✅ Finalizado' : '🟢 En Plazo');
        let estadoCol = critico ? '#dc2626' : '#16a34a';

        htmlFilas += `<tr>
            <td style="padding: 7px 6px; border-bottom: 1px solid #e2e8f0; text-align: left;">${sub}</td>
            <td style="text-align:center; padding: 7px 6px; border-bottom: 1px solid #e2e8f0;">${total}</td>
            <td style="text-align:center; padding: 7px 6px; border-bottom: 1px solid #e2e8f0;">${cerradas}</td>
            <td style="text-align:center; font-weight:bold; padding: 7px 6px; border-bottom: 1px solid #e2e8f0; color: #005596;">${promedio}%</td>
            <td style="font-weight:bold; padding: 7px 6px; border-bottom: 1px solid #e2e8f0; text-align: left; color: ${estadoCol};">${estadoTxt}</td>
        </tr>`;
    });

    return `
    <div class="pdf-pagina" style="page-break-before: always;">
        <div class="pdf-seccion-titulo">RESUMEN OPERATIVO DE FASE</div>
        <div class="pdf-seccion-subtitulo">Desglose de Control: ${nombreDisc.toUpperCase()}</div>
        <table class="pdf-tabla" style="width:100%; border-collapse:collapse; font-size:0.75rem; margin-top:15px;">
            <thead>
                <tr>
                    <th style="background:#005596; color:white; padding:8px 6px; text-align:left;">Línea de Trabajo / Componente</th>
                    <th style="background:#005596; color:white; padding:8px 6px; text-align:center;">Nº Tareas</th>
                    <th style="background:#005596; color:white; padding:8px 6px; text-align:center;">Cerradas</th>
                    <th style="background:#005596; color:white; padding:8px 6px; text-align:center;">% Avance</th>
                    <th style="background:#005596; color:white; padding:8px 6px; text-align:left;">Plazo</th>
                </tr>
            </thead>
            <tbody>
                ${htmlFilas || '<tr><td colspan="5" style="text-align:center; padding:10px;">No hay subgrupos para esta fase</td></tr>'}
            </tbody>
        </table>
    </div>`;
}

function generarHTMLResumen(disc) {
    let ragHtml = '';
    let tituloTabla = '';
    
    if (disc === '__TODAS__') {
        tituloTabla = 'Estado General por Disciplinas del Proyecto';
        const disciplinasProyecto = Object.keys(ESTRUCTURA_DASH).length > 0 ? Object.keys(ESTRUCTURA_DASH) : ['Logística', 'Civil', 'Mecánicos', 'Eléctricos', 'Línea de Alta Tensión'];

        disciplinasProyecto.forEach(d => {
            let discItems = 0, discComp = 0, sumaAvances = 0, discCritica = false;
            let tareasDeEstaDisc = cacheTareasCalculadas.filter(t => t.disciplina === d);
            
            tareasDeEstaDisc.forEach(t => {
                discItems++; 
                sumaAvances += t.pctFisico;
                if (t.pctFisico === 100) discComp++;
                if (new Date().getTime() > t.fechaFin.getTime() && t.pctFisico < 100) discCritica = true;
            });

            let promedioAvance = discItems > 0 ? Math.round(sumaAvances / discItems) : 0;
            let estadoTexto = discCritica ? '🔴 Crítico' : (promedioAvance >= 100 ? '✅ Finalizado' : '🟢 En Plazo');
            let estadoColor = discCritica ? '#dc2626' : '#16a34a';

            ragHtml += `<tr>
                <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.85rem;"><strong>📁 ${d.toUpperCase()}</strong></td>
                <td style="text-align:center; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">${discItems}</td>
                <td style="text-align:center; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">${discComp}</td>
                <td style="text-align:center; font-weight:bold; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; color: #005596; font-size: 0.85rem;">${promedioAvance}%</td>
                <td style="font-weight:bold; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; color: ${estadoColor}; font-size: 0.85rem;">${estadoTexto}</td>
            </tr>`;
        });
    } else {
        tituloTabla = `Resumen Operativo de la Fase: ${disc}`;
        const filasTablaPantalla = document.querySelectorAll('#rag-tbody tr');
        
        if (filasTablaPantalla.length > 0 && !filasTablaPantalla[0].innerText.includes('Cargando')) {
            filasTablaPantalla.forEach(tr => {
                const celdas = tr.querySelectorAll('td');
                if (celdas.length >= 5) {
                    ragHtml += `<tr>
                        <td style="padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.85rem;">${celdas[0].innerText}</td>
                        <td style="text-align:center; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">${celdas[1].innerText}</td>
                        <td style="text-align:center; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; font-size: 0.85rem;">${celdas[2].innerText}</td>
                        <td style="text-align:center; font-weight:bold; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; color: #005596; font-size: 0.85rem;">${celdas[3].innerText}</td>
                        <td style="font-weight:bold; padding: 9px 8px; border-bottom: 1px solid #e2e8f0; text-align: left; font-size: 0.85rem;">${celdas[4].innerText}</td>
                    </tr>`;
                }
            });
        }
    }

    return `<div class="pdf-pagina">
        <div class="pdf-seccion-titulo">${tituloTabla.toUpperCase()}</div>
        <table class="pdf-tabla" style="width:100%; border-collapse:collapse; font-size:0.8rem; margin-top:10px;">
            <thead>
                <tr>
                    <th style="background:#005596; color:white; padding:10px 8px; text-align:left;">Línea de Trabajo / Disciplina</th>
                    <th style="background:#005596; color:white; padding:10px 8px; text-align:center;">Nº Tareas</th>
                    <th style="background:#005596; color:white; padding:10px 8px; text-align:center;">Cerradas</th>
                    <th style="background:#005596; color:white; padding:10px 8px; text-align:center;">% Avance</th>
                    <th style="background:#005596; color:white; padding:10px 8px; text-align:left;">Plazo</th>
                </tr>
            </thead>
            <tbody>
                ${ragHtml || '<tr><td colspan="5" style="text-align:center; padding:10px;">No hay datos disponibles</td></tr>'}
            </tbody>
        </table>
    </div>`;
}

function generarHTMLDesglose(disc) {
    const grupos = ESTRUCTURA_DASH[disc] || {};
    if (Object.keys(grupos).length === 0) return '';
    let html = `<div class="pdf-pagina" style="page-break-before: always;"><div class="pdf-seccion-titulo">DESGLOSE DE PAQUETES DE TRABAJO</div><div class="pdf-disciplina-header">${disc.toUpperCase()}</div>`;
    
    for (let g in grupos) {
        html += `<div class="pdf-grupo-wbs" style="page-break-inside: avoid;"><div class="pdf-grupo-titulo">${g}</div><table class="pdf-tabla-detalle"><thead><tr><th>Ítem / Componente</th><th>Ud.</th><th>Meta</th><th>Instalado</th><th>Progreso</th></tr></thead><tbody>`;
        grupos[g].forEach(sub => {
            const prod = acumulados[`${disc}||${g}||${sub.item}`] || 0;
            const pct = sub.meta > 0 ? Math.min(100, Math.round((prod / sub.meta) * 100)) : 0;
            html += `<tr><td>${sub.item}</td><td>${sub.unidad}</td><td>${sub.meta.toLocaleString()}</td><td>${Math.round(prod).toLocaleString()}</td><td>${pct}%</td></tr>`;
        });
        html += `</tbody></table></div>`;
    }
    html += `</div>`;
    return html;
}

function construirPaginasPDF(disc) {
    const tituloPortada = disc === '__TODAS__' ? 'Proyecto Consolidado Global' : disc;
    let paginas = [generarHTMLPortada(tituloPortada)];
    
    paginas.push(generarHTMLResumen(disc));

    if (disc === '__TODAS__') {
        const listaDisciplinas = Object.keys(ESTRUCTURA_DASH).length > 0 ? Object.keys(ESTRUCTURA_DASH) : ['Logística', 'Civil', 'Mecánicos', 'Eléctricos', 'Línea de Alta Tensión'];
        listaDisciplinas.forEach(d => {
            paginas.push(fabricarTablaSubgrupos(d));
        });

        Object.keys(ESTRUCTURA_DASH).forEach(d => {
            let p = generarHTMLDesglose(d);
            if (p) paginas.push(p);
        });
    } else {
        let p = generarHTMLDesglose(disc);
        if (p) paginas.push(p);
    }

    return paginas;
}

function renderizarPDF(paginasHtml, filename, btn) {
    const textoOriginal = btn.innerText;
    btn.innerText = "⏳ Generando..."; btn.disabled = true;
    try {
        let htmlCompleto = paginasHtml.join('<div class="html2pdf__page-break"></div>');
        const contenedor = document.createElement('div');
        contenedor.innerHTML = htmlCompleto;
        contenedor.className = 'pdf-template-content';

        html2pdf().set({
            margin: 0, filename: filename, image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, logging: false },
            jsPDF: { format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['css', 'legacy'] }
        }).from(contenedor).save().then(() => { 
            btn.innerText = textoOriginal; 
            btn.disabled = false; 
        }).catch(e => { 
            alert('Error al exportar: ' + e.message); 
            btn.innerText = textoOriginal; 
            btn.disabled = false; 
        });
    } catch (e) { 
        btn.innerText = textoOriginal; 
        btn.disabled = false; 
    }
}

function exportarInformeEspecifico() {
    const disc = document.getElementById('filtro-disc').value;
    if (disc === '__TODAS__') { alert("Para este informe utiliza el botón 'Descargar Informe Completo'."); return; }
    const filename = `Informe_Especifico_SIGMA_${disc}_${new Date().toISOString().split('T')[0]}.pdf`;
    renderizarPDF(construirPaginasPDF(disc), filename, document.getElementById('btn-pdf-specific'));
}

function exportarInformeCompleto() {
    const filename = `Informe_Consolidado_ELECNOR_${new Date().toISOString().split('T')[0]}.pdf`;
    renderizarPDF(construirPaginasPDF('__TODAS__'), filename, document.getElementById('btn-pdf-full'));
}

function dibujarTablaRatiosCronograma0() {
    const tbody = document.getElementById('ratios-tbody');
    const disc = document.getElementById('filtro-disc').value;
    
    // Reescribimos la cabecera (thead) dinámicamente para quitarle los fondos de colores del HTML
    const tablaRatios = tbody.closest('table');
    if (tablaRatios) {
        const thead = tablaRatios.querySelector('thead');
        if (thead) {
            thead.innerHTML = `
                <tr style="background: #005596; color: white;">
                    <th style="padding:10px; min-width:180px; text-align: left;">Actividad / WBS</th>
                    <th style="text-align:center;">Meta Total</th>
                    <th style="text-align:center;">Ratio Contrato<br><small>(ud/día)</small></th>
                    <th style="text-align:center;">% Debiera<br><small>(Hoy)</small></th>
                    <th style="text-align:center;">Ud. Debieran<br><small>(Hoy)</small></th>
                    <th style="text-align:center;">Prod. Real<br><small>Acumulada</small></th>
                    <th style="text-align:center;">Ud. Desviadas</th>
                    <th style="text-align:center;">% Desvío</th>
                    <th style="text-align:center;">Ratio Real<br><small>(Histórico)</small></th>
                    <th style="text-align:center;">Ratio Real<br><small>(Últ. 5 Días)</small></th>
                    <th style="text-align:center; min-width:105px;">F. Fin Est.<br><small>(Ritmo Actual)</small></th>
                    <th style="text-align:center;">Ratio Necesario<br><small>(Para Cumplir)</small></th>
                </tr>
            `;
        }
    }

    let hoy = new Date();
    hoy.setHours(0,0,0,0);
    const msPorDia = 1000 * 60 * 60 * 24;

    let disciplinasAProcesar = disc === '__TODAS__' ? Object.keys(ESTRUCTURA_DASH) : [disc];
    
    if (disciplinasAProcesar.length === 0 || (disc !== '__TODAS__' && !ESTRUCTURA_DASH[disc])) {
        tbody.innerHTML = '<tr><td colspan="12" style="text-align:center; padding:20px; color:#888;">No hay actividades registradas para esta disciplina.</td></tr>';
        return;
    }

    document.getElementById('titulo-grafico').innerText = `Matriz de Productividad y Desviaciones Críticas — ${disc === '__TODAS__' ? 'Proyecto Global' : disc}`;

    // Función auxiliar para pintar las filas de la tabla con el nuevo diseño minimalista
    function renderFilaRatio(nivel, nombre, metaStr, ratioContrato, pctDebiera, udDebieran, prodReal, udDesviadas, pctDesvio, ratioHist, ratio5d, fFinEst, ratioNec, colorRatioNec, idFila, idPadre) {
        const indentMap = { 'disc': '0px', 'group': '25px', 'item': '50px' };
        const indent = indentMap[nivel] || '0px';
        const bgColor = nivel === 'disc' ? '#f8fafc' : (nivel === 'group' ? '#ffffff' : '#fafafa');
        const fontWeight = nivel === 'disc' ? 'bold' : (nivel === 'group' ? '600' : 'normal');
        
        const attrId = idFila ? `data-tree-id="${idFila}"` : '';
        const attrPadre = idPadre ? `data-parent="${idPadre}"` : '';
        const isClickable = nivel !== 'item';
        const onClick = isClickable ? `onclick="toggleTree('${idFila}')"` : '';
        const icono = nivel === 'disc' ? '📁' : (nivel === 'group' ? '📂' : '📝');
        const classChild = nivel !== 'disc' ? 'tree-child' : '';

        // Formato unificado (Grises para contexto, Color solo para alertas/producción)
        let colorDesvio = '#475569'; 
        let fwItem = nivel === 'item' ? 'normal' : 'bold';
        let colorProdReal = '#475569';
        
        if (nivel === 'item') {
            let devVal = parseFloat(udDesviadas.replace(/[^\d.-]/g, ''));
            colorDesvio = devVal >= 0 ? '#16a34a' : '#dc2626'; // Verde si vamos bien, Rojo si falta
            colorProdReal = '#005596'; // Azul corporativo para destacar nuestra producción real
            fwItem = 'bold';
        }

        return `<tr class="${classChild}" style="background:${bgColor}; border-bottom: 1px solid #e2e8f0; cursor:${isClickable ? 'pointer' : 'default'};" data-level="${nivel}" ${attrId} ${attrPadre} ${onClick}>
            <td style="padding: 10px 5px; font-weight: ${fontWeight}; color: #334155; text-align: left;">
                <span style="display:inline-block; width:${indent};"></span>
                <span class="tree-icon">${icono}</span> ${esc(nombre)}
            </td>
            <td style="text-align:center; font-weight:${fwItem}; color:#334155;">${metaStr}</td>
            <td style="text-align:center; color:#64748b;">${ratioContrato}</td>
            <td style="text-align:center; color:#64748b;">${pctDebiera}</td>
            <td style="text-align:center; color:#64748b;">${udDebieran}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:${colorProdReal};">${prodReal}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:${colorDesvio}">${udDesviadas}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:${colorDesvio}">${pctDesvio}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:#475569;">${ratioHist}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:#475569;">${ratio5d}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:#334155;">${fFinEst}</td>
            <td style="text-align:center; font-weight:${fwItem}; color:${colorRatioNec};">${ratioNec}</td>
        </tr>`;
    }

    let html = '';

    disciplinasAProcesar.forEach(d => {
        const discId = `ratio-disc-${d.replace(/[\s\/]+/g, '_')}`;
        html += renderFilaRatio('disc', d.toUpperCase(), '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '', discId, null);

        for (let g in ESTRUCTURA_DASH[d]) {
            const grpId = `ratio-grp-${d.replace(/[\s\/]+/g, '_')}-${g.replace(/[\s\/]+/g, '_')}`;
            html += renderFilaRatio('group', g, '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '-', '', grpId, discId);

            ESTRUCTURA_DASH[d][g].forEach(sub => {
                let t = cacheTareasCalculadas.find(task => task.disciplina === d && task.grupo === g && task.item === sub.item);
                
                if (!t) {
                    t = { item: sub.item, meta: sub.meta, unidad: sub.unidad, fechaInicio: hoy, fechaFin: hoy, duracion: 0, pctFisico: 0 };
                }

                const prodAcum = acumulados[`${d}||${g}||${sub.item}`] || 0;
                const duracionContratoDias = Math.ceil((t.fechaFin - t.fechaInicio) / msPorDia) + 1;
                const ratioDiaProgramado = duracionContratoDias > 0 ? (t.meta / duracionContratoDias) : 0;
                
                let diasTranscurridosBase = Math.ceil((hoy - t.fechaInicio) / msPorDia) + 1;
                if (hoy < t.fechaInicio) diasTranscurridosBase = 0;
                if (hoy > t.fechaFin) diasTranscurridosBase = duracionContratoDias;

                const udDebieranHoy = Math.max(0, Math.min(t.meta, diasTranscurridosBase * ratioDiaProgramado));
                const pctDebieraHoy = t.meta > 0 ? (udDebieranHoy / t.meta) * 100 : 0;

                const cantidadDesviada = prodAcum - udDebieranHoy;
                let pctDesvio = 0;
                if (udDebieranHoy > 0) pctDesvio = (cantidadDesviada / udDebieranHoy) * 100;
                else if (prodAcum > 0) pctDesvio = 100;

                let fechasConProduccion = [];
                for (let fStr in HISTORIAL) {
                    if (HISTORIAL[fStr] && HISTORIAL[fStr][d] && HISTORIAL[fStr][d][g]) {
                        HISTORIAL[fStr][d][g].forEach(pt => { if (pt.item === t.item && pt.cantidad > 0) fechasConProduccion.push(new Date(fStr)); });
                    }
                }

                let ratioRealHistorico = 0;
                if (fechasConProduccion.length > 0) {
                    fechasConProduccion.sort((a, b) => a - b);
                    const primerDiaProduccion = fechasConProduccion[0];
                    const diasTrabajadosReal = Math.ceil((hoy - primerDiaProduccion) / msPorDia) + 1;
                    ratioRealHistorico = prodAcum / Math.max(1, diasTrabajadosReal);
                }

                let prodUltimos5Dias = 0;
                for (let i = 0; i < 5; i++) {
                    let dTemp = new Date(hoy);
                    dTemp.setDate(hoy.getDate() - i);
                    let fStr = dTemp.toISOString().split('T')[0];
                    if (HISTORIAL[fStr] && HISTORIAL[fStr][d] && HISTORIAL[fStr][d][g]) {
                        HISTORIAL[fStr][d][g].forEach(pt => { if (pt.item === t.item) prodUltimos5Dias += pt.cantidad; });
                    }
                }
                const ratio5Dias = prodUltimos5Dias / 5;

                const udRestantes = Math.max(0, t.meta - prodAcum);
                let fechaFinEstimadaTexto = '—';
                let velocidadCalculoFecha = ratio5Dias > 0 ? ratio5Dias : ratioRealHistorico;

                if (prodAcum >= t.meta) {
                    fechaFinEstimadaTexto = '✅ Finalizado';
                } else if (velocidadCalculoFecha > 0) {
                    const diasNecesariosEst = udRestantes / velocidadCalculoFecha;
                    let fEst = new Date(hoy);
                    fEst.setDate(hoy.getDate() + Math.ceil(diasNecesariosEst));
                    fechaFinEstimadaTexto = fEst.toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit', year: '2-digit' });
                } else {
                    fechaFinEstimadaTexto = '❌ Parado';
                }

                const diasRestantesContrato = Math.ceil((t.fechaFin - hoy) / msPorDia);
                let ratioNecesarioTexto = '—';
                let colorRatioNecesario = '#475569'; // Gris neutro por defecto

                if (prodAcum >= t.meta) {
                    ratioNecesarioTexto = '0.0';
                } else if (diasRestantesContrato > 0) {
                    const ratioNec = udRestantes / diasRestantesContrato;
                    ratioNecesarioTexto = ratioNec.toFixed(1);
                    if (ratioNec > ratioDiaProgramado * 1.3) colorRatioNecesario = '#dc2626'; // Rojo si requiere sobreesfuerzo
                    else colorRatioNecesario = '#16a34a'; // Verde si es asumible
                } else {
                    ratioNecesarioTexto = '⚠️ Vencido';
                    colorRatioNecesario = '#dc2626';
                }

                const signoDesvio = cantidadDesviada > 0 ? '+' : '';

                html += renderFilaRatio(
                    'item', sub.item, 
                    `${t.meta.toLocaleString()} <small>${t.unidad}</small>`, 
                    ratioDiaProgramado.toFixed(1), 
                    `${Math.round(pctDebieraHoy)}%`, 
                    Math.round(udDebieranHoy).toLocaleString(), 
                    Math.round(prodAcum).toLocaleString(), 
                    `${signoDesvio}${Math.round(cantidadDesviada).toLocaleString()}`, 
                    `${signoDesvio}${Math.round(pctDesvio)}%`, 
                    ratioRealHistorico.toFixed(1), 
                    ratio5Dias.toFixed(1), 
                    fechaFinEstimadaTexto, 
                    ratioNecesarioTexto, colorRatioNecesario, 
                    '', grpId
                );
            });
        }
    });

    tbody.innerHTML = html;

    // Plegar todo por defecto excepto las Disciplinas principales
    document.querySelectorAll('#ratios-tbody .tree-child').forEach(el => el.style.display = 'none');
}

// === MÓDULO 6: CONTROL ECONÓMICO ===
function obtenerCertificadosAcumulados() {
    let certifAcum = {};
    let sobrecosteAcum = {};
    for (let f in CERTIFICACIONES) {
        for (let d in CERTIFICACIONES[f]) {
            for (let g in CERTIFICACIONES[f][d]) {
                CERTIFICACIONES[f][d][g].forEach(item => {
                    const key = `${d}||${g}||${item.item}`;
                    certifAcum[key] = (certifAcum[key] || 0) + (item.importe || 0);
                    sobrecosteAcum[key] = (sobrecosteAcum[key] || 0) + (item.sobrecoste || 0);
                });
            }
        }
    }
    return { certifAcum, sobrecosteAcum };
}

function dibujarTablaEconomica() {
    const container = document.getElementById('economico-content');
    const disc = document.getElementById('filtro-disc').value;
    const { certifAcum, sobrecosteAcum } = obtenerCertificadosAcumulados();

    document.getElementById('titulo-grafico').innerText = `💰 Control Económico — ${disc === '__TODAS__' ? 'Proyecto Global' : disc}`;

    let items = [];
    if (disc === '__TODAS__') {
        for (let d in ESTRUCTURA_DASH) {
            for (let g in ESTRUCTURA_DASH[d]) {
                ESTRUCTURA_DASH[d][g].forEach(sub => {
                    items.push({ disciplina: d, grupo: g, item: sub, key: `${d}||${g}||${sub.item}` });
                });
            }
        }
    } else {
        for (let g in (ESTRUCTURA_DASH[disc] || {})) {
            ESTRUCTURA_DASH[disc][g].forEach(sub => {
                items.push({ disciplina: disc, grupo: g, item: sub, key: `${disc}||${g}||${sub.item}` });
            });
        }
    }

    if (items.length === 0) {
        container.innerHTML = '<div class="empty-state">No hay ítems configurados. Ve a Metas > Coste para asignar presupuestos.</div>';
        return;
    }

    let totalPresupuesto = 0, totalCertificado = 0, totalSobrecoste = 0;

    let html = `
    <div style="margin-bottom:20px;">
        <div style="display:grid; grid-template-columns: repeat(5, 1fr); gap:6px; margin-bottom:12px;">
            <div class="pdf-kpi-card" style="background:#f0fdf4; border-bottom-color:#16a34a; padding:5px 4px;">
                <h4 style="font-size:0.55rem; color:#64748b; text-transform:uppercase; margin:0 0 1px;">Presupuesto Total</h4>
                <div class="pdf-kpi-val" style="font-size:0.85rem; color:#16a34a;" id="eco-total-presupuesto">0 €</div>
            </div>
            <div class="pdf-kpi-card" style="background:#eff6ff; border-bottom-color:#005596; padding:5px 4px;">
                <h4 style="font-size:0.55rem; color:#64748b; text-transform:uppercase; margin:0 0 1px;">Total Certificado</h4>
                <div class="pdf-kpi-val" style="font-size:0.85rem; color:#005596;" id="eco-total-certificado">0 €</div>
            </div>
            <div class="pdf-kpi-card" style="background:#fef2f2; border-bottom-color:#dc2626; padding:5px 4px;">
                <h4 style="font-size:0.55rem; color:#64748b; text-transform:uppercase; margin:0 0 1px;">Total Sobrecoste</h4>
                <div class="pdf-kpi-val" style="font-size:0.85rem; color:#dc2626;" id="eco-total-sobrecoste">0 €</div>
            </div>
            <div class="pdf-kpi-card" style="background:#fff7ed; border-bottom-color:#f59e0b; padding:5px 4px;">
                <h4 style="font-size:0.55rem; color:#64748b; text-transform:uppercase; margin:0 0 1px;">Desviación Total</h4>
                <div class="pdf-kpi-val" style="font-size:0.85rem; color:#f59e0b;" id="eco-total-desviacion">0 €</div>
            </div>
            <div class="pdf-kpi-card" style="background:#fef2f2; border-bottom-color:#dc2626; padding:5px 4px;">
                <h4 style="font-size:0.55rem; color:#64748b; text-transform:uppercase; margin:0 0 1px;">% Gastado</h4>
                <div class="pdf-kpi-val" style="font-size:0.85rem; color:#dc2626;" id="eco-total-porcentaje">0%</div>
            </div>
        </div>
        
        <div style="overflow-x: auto; overflow-y: auto; max-height: 55vh; border: 1px solid #e2e8f0; border-radius: 6px; position: relative;">
            <table class="rag-table" style="font-size:0.85rem; width: 100%; border-collapse: separate; border-spacing: 0;" id="eco-tree-table">
                <thead style="position: sticky; top: 0; z-index: 100; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
                    <tr>
                        <th style="background: #005596; color: white; padding: 10px; min-width:250px; border-bottom: none;">Disciplina / Grupo / Ítem</th>
                        <th style="background: #005596; color: white; padding: 10px; text-align:center; border-bottom: none;">Presupuesto (€)</th>
                        <th style="background: #005596; color: white; padding: 10px; text-align:center; border-bottom: none;">Certificado (€)</th>
                        <th style="background: #005596; color: white; padding: 10px; text-align:center; border-bottom: none;">Sobrecoste (€)</th>
                        <th style="background: #005596; color: white; padding: 10px; text-align:center; border-bottom: none;">% Gastado</th>
                        <th style="background: #005596; color: white; padding: 10px; text-align:center; border-bottom: none;">Desviación (€)</th>
                    </tr>
                </thead>
                <tbody id="eco-tree-tbody">`;

    const FMT = v => (v || 0).toLocaleString('es-ES', {minimumFractionDigits:2});
    const FMT_PCT = v => (v || 0).toFixed(1) + '%';

    let treeRows = [];

    for (let d in ESTRUCTURA_DASH) {
        let discPresupuesto = 0, discCertificado = 0, discSobrecoste = 0;
        let discGroups = [];

        for (let g in ESTRUCTURA_DASH[d]) {
            let grpPresupuesto = 0, grpCertificado = 0, grpSobrecoste = 0;
            let grpItems = [];

            ESTRUCTURA_DASH[d][g].forEach(sub => {
                const key = `${d}||${g}||${sub.item}`;
                const presupuesto = sub.presupuestoTotal || 0;
                const certificado = certifAcum[key] || 0;
                const sobrecoste = sobrecosteAcum[key] || 0;

                grpPresupuesto += presupuesto;
                grpCertificado += certificado;
                grpSobrecoste += sobrecoste;

                grpItems.push({ item: sub.item, presupuesto, certificado, sobrecoste, level: 'item', parentGrp: g });
                totalPresupuesto += presupuesto;
                totalCertificado += certificado;
                totalSobrecoste += sobrecoste;
            });

            discPresupuesto += grpPresupuesto;
            discCertificado += grpCertificado;
            discSobrecoste += grpSobrecoste;

            discGroups.push({ grupo: g, presupuesto: grpPresupuesto, certificado: grpCertificado, sobrecoste: grpSobrecoste, items: grpItems, level: 'group' });
        }

        treeRows.push({ disciplina: d, presupuesto: discPresupuesto, certificado: discCertificado, sobrecoste: discSobrecoste, groups: discGroups, level: 'disc', expanded: false });
    }

    function renderRow(level, name, presupuesto, certificado, sobrecoste, extraClass, icon, onClick, treeId, parentId) {
        const total = certificado + sobrecoste;
        const pct = presupuesto > 0 ? (total / presupuesto) * 100 : 0;
        const desviacion = presupuesto - total;
        const colorDesvio = desviacion >= 0 ? '#16a34a' : '#dc2626';
        const signoDesvio = desviacion > 0 ? '+' : '';
        const indentMap = { 'disc': '0px', 'group': '25px', 'item': '50px' };
        const indent = indentMap[level] || '0px';
        const isTotal = extraClass === 'rag-total-row';
        const bgColor = level === 'disc' ? '#f0f7ff' : (level === 'group' ? '#fafafa' : 'transparent');
        const treeIdAttr = treeId ? `data-tree-id="${treeId}"` : '';
        const parentAttr = parentId ? `data-parent="${parentId}"` : '';

        return `<tr class="${extraClass}" style="background:${bgColor}; cursor:${onClick ? 'pointer' : 'default'};" data-level="${level}" ${treeIdAttr} ${parentAttr} ${onClick ? `onclick="${onClick}"` : ''}>
            <td style="padding:${level === 'disc' ? '12' : '8'}px 10px; font-weight:${level === 'disc' ? 'bold' : (level === 'group' ? '600' : 'normal')}; color:${isTotal ? 'white' : '#333'};">
                <span style="display:inline-block; width:${indent};"></span>
                ${icon ? `<span class="tree-icon">${icon}</span>` : ''} ${esc(name)}
            </td>
            <td style="text-align:center; font-weight:${isTotal ? '900' : 'bold'}; color:${isTotal ? 'white' : '#333'};">${FMT(presupuesto)}</td>
            <td style="text-align:center; font-weight:bold; color:#005596;">${FMT(certificado)}</td>
            <td style="text-align:center; font-weight:bold; color:#dc2626;">${FMT(sobrecoste)}</td>
            <td style="text-align:center; font-weight:bold; color:${pct > 100 ? '#dc2626' : (isTotal ? 'white' : '#16a34a')}">${FMT_PCT(pct)}</td>
            <td style="text-align:center; font-weight:bold; color:${isTotal ? 'white' : colorDesvio}">${signoDesvio}${FMT(desviacion)}</td>
        </tr>`;
    }

    treeRows.forEach(dr => {
        const discClean = dr.disciplina.replace(/[\s\/]+/g, '_');
        const discId = `disc-${discClean}`;
        html += renderRow('disc', dr.disciplina, dr.presupuesto, dr.certificado, dr.sobrecoste, '', '📁', `toggleTree('${discId}')`, discId, null);

        dr.groups.forEach(gr => {
            const grpClean = `${discClean}_${gr.grupo.replace(/[\s\/]+/g, '_')}`;
            const grpId = `grp-${grpClean}`;
            html += renderRow('group', gr.grupo, gr.presupuesto, gr.certificado, gr.sobrecoste, `tree-child`, '📂', `toggleTree('${grpId}')`, grpId, discId);

            gr.items.forEach(it => {
                html += renderRow('item', it.item, it.presupuesto, it.certificado, it.sobrecoste, `tree-child`, '', null, '', grpId);
            });
        });
    });

    html += renderRow('disc', 'TOTAL GENERAL', totalPresupuesto, totalCertificado, totalSobrecoste, 'rag-total-row', '', null, '', null);

    html += `</tbody></table></div></div>`;
    container.innerHTML = html;

    document.getElementById('eco-total-presupuesto').innerText = FMT(totalPresupuesto) + ' €';
    document.getElementById('eco-total-certificado').innerText = FMT(totalCertificado) + ' €';
    document.getElementById('eco-total-sobrecoste').innerText = FMT(totalSobrecoste) + ' €';
    const desviacionTotal = totalPresupuesto - totalCertificado - totalSobrecoste;
    document.getElementById('eco-total-desviacion').innerText = (desviacionTotal > 0 ? '+' : '') + FMT(desviacionTotal) + ' €';
    const pctTotal = totalPresupuesto > 0 ? ((totalCertificado + totalSobrecoste) / totalPresupuesto) * 100 : 0;
    document.getElementById('eco-total-porcentaje').innerText = FMT_PCT(pctTotal);

    document.querySelectorAll('.tree-child').forEach(el => el.style.display = 'none');
}

// Tree toggle function
function toggleTree(id) {
    const children = document.querySelectorAll(`.tree-child[data-parent="${id}"]`);
    const isHidden = children.length > 0 && children[0].style.display === 'none';
    children.forEach(el => el.style.display = isHidden ? '' : 'none');
    if (children.length > 0) {
        const trigger = children[0].closest('table').querySelector(`[data-tree-id="${id}"]`);
        if (trigger) {
            const td = trigger.querySelector('td');
            if (td) {
                const icon = td.querySelector('.tree-icon');
                if (icon) icon.textContent = isHidden ? '📂' : '📁';
            }
        }
    }
}

// === MÓDULO 7: RESUMEN ECONÓMICO (Gráficos) ===
// === MÓDULO 7: RESUMEN ECONÓMICO (Gráficos) ===
function dibujarResumenEconomico() {
    const container = document.getElementById('resumen-content');
    const { certifAcum, sobrecosteAcum } = obtenerCertificadosAcumulados();

    document.getElementById('titulo-grafico').innerText = '📊 Resumen Económico — Avance vs. Fugas de Capital';

    // Construimos dos filas de gráficos (Adiós a las tarjetas redundantes)
    container.innerHTML = `
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px; margin-bottom:20px;">
        <div class="card" style="margin:0; padding:15px; border-top: 3px solid #005596;">
            <h3 style="color:var(--blue); margin:0 0 15px 0; font-size:1rem;">Avance Contractual: Presupuesto vs Certificado</h3>
            <div style="height:300px; position:relative;">
                <canvas id="chartMacroBar"></canvas>
            </div>
        </div>
        <div class="card" style="margin:0; padding:15px; border-top: 3px solid #005596;">
            <h3 style="color:var(--blue); margin:0 0 15px 0; font-size:1rem;">Evolución Temporal del Certificado</h3>
            <div style="height:300px; position:relative;">
                <canvas id="chartMacroEvol"></canvas>
            </div>
        </div>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:20px;">
        <div class="card" style="margin:0; padding:15px; border-top: 3px solid #dc2626;">
            <h3 style="color:#dc2626; margin:0 0 15px 0; font-size:1rem;">Fugas: Sobrecoste por Disciplina</h3>
            <div style="height:300px; position:relative;">
                <canvas id="chartSobrBar"></canvas>
            </div>
        </div>
        <div class="card" style="margin:0; padding:15px; border-top: 3px solid #dc2626;">
            <h3 style="color:#dc2626; margin:0 0 15px 0; font-size:1rem;">Evolución Temporal del Sobrecoste</h3>
            <div style="height:300px; position:relative;">
                <canvas id="chartSobrEvol"></canvas>
            </div>
        </div>
    </div>`;

    // 1. Preparar datos para los gráficos de Barras
    let disciplinas = Object.keys(ESTRUCTURA_DASH);
    let labels = [], dataPresupuesto = [], dataCertificado = [], dataSobrecoste = [];

    disciplinas.forEach(d => {
        let pres = 0, cert = 0, sobr = 0;
        for (let g in ESTRUCTURA_DASH[d]) {
            ESTRUCTURA_DASH[d][g].forEach(sub => {
                const key = `${d}||${g}||${sub.item}`;
                pres += sub.presupuestoTotal || 0;
                cert += certifAcum[key] || 0;
                sobr += sobrecosteAcum[key] || 0;
            });
        }
        labels.push(d);
        dataPresupuesto.push(pres);
        dataCertificado.push(cert);
        dataSobrecoste.push(sobr);
    });

    // 2. Preparar datos para los gráficos de Líneas (Mensualizado)
    let monthlyData = {};
    let fechas = Object.keys(CERTIFICACIONES).sort();

    fechas.forEach(f => {
        let monthKey = f.substring(0, 7); // Agrupamos por mes (YYYY-MM)
        if (!monthlyData[monthKey]) monthlyData[monthKey] = { cert: 0, sobr: 0 };
        for (let d in CERTIFICACIONES[f]) {
            for (let g in CERTIFICACIONES[f][d]) {
                CERTIFICACIONES[f][d][g].forEach(item => {
                    monthlyData[monthKey].cert += item.importe || 0;
                    monthlyData[monthKey].sobr += item.sobrecoste || 0;
                });
            }
        }
    });

    let months = Object.keys(monthlyData).sort();
    let cumCert = [], cumSobr = [];
    let accCert = 0, accSobr = 0;

    months.forEach(m => {
        accCert += monthlyData[m].cert;
        accSobr += monthlyData[m].sobr;
        cumCert.push(accCert);
        cumSobr.push(accSobr);
    });

    if (months.length === 0) {
        months = ['Sin datos'];
        cumCert = [0];
        cumSobr = [0];
    }

    // 3. Dibujar los 4 gráficos de forma independiente
    setTimeout(() => {
        // --- GRÁFICO 1: Barras Macro (Presupuesto vs Certificado) ---
        const ctxMacroBar = document.getElementById('chartMacroBar');
        if (ctxMacroBar) {
            if (window.miChartMacroBar) window.miChartMacroBar.destroy();
            window.miChartMacroBar = new Chart(ctxMacroBar.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Presupuesto Base', data: dataPresupuesto, backgroundColor: '#d3e3f0' },
                        { label: 'Certificado (Sano)', data: dataCertificado, backgroundColor: '#005596' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { ticks: { callback: v => v.toLocaleString('es-ES') + ' €' } } }
                }
            });
        }

        // --- GRÁFICO 2: Evolución Macro (Línea de Certificación) ---
        const ctxMacroEvol = document.getElementById('chartMacroEvol');
        if (ctxMacroEvol) {
            if (window.miChartMacroEvol) window.miChartMacroEvol.destroy();
            window.miChartMacroEvol = new Chart(ctxMacroEvol.getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        { label: 'Certificado Acumulado', data: cumCert, borderColor: '#005596', backgroundColor: 'rgba(0,85,150,0.1)', fill: true, tension: 0.1, borderWidth: 3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { ticks: { callback: v => v.toLocaleString('es-ES') + ' €' } } }
                }
            });
        }

        // --- GRÁFICO 3: Barras de Fugas (Solo Sobrecoste) ---
        const ctxSobrBar = document.getElementById('chartSobrBar');
        if (ctxSobrBar) {
            if (window.miChartSobrBar) window.miChartSobrBar.destroy();
            window.miChartSobrBar = new Chart(ctxSobrBar.getContext('2d'), {
                type: 'bar',
                data: {
                    labels: labels,
                    datasets: [
                        { label: 'Sobrecoste Acumulado', data: dataSobrecoste, backgroundColor: '#dc2626' }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { ticks: { callback: v => v.toLocaleString('es-ES') + ' €' } } }
                }
            });
        }

        // --- GRÁFICO 4: Evolución de Fugas (Línea de Sobrecoste) ---
        const ctxSobrEvol = document.getElementById('chartSobrEvol');
        if (ctxSobrEvol) {
            if (window.miChartSobrEvol) window.miChartSobrEvol.destroy();
            window.miChartSobrEvol = new Chart(ctxSobrEvol.getContext('2d'), {
                type: 'line',
                data: {
                    labels: months,
                    datasets: [
                        { label: 'Evolución del Sobrecoste', data: cumSobr, borderColor: '#dc2626', backgroundColor: 'rgba(220,38,38,0.1)', fill: true, tension: 0.1, borderWidth: 3 }
                    ]
                },
                options: {
                    responsive: true, maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } },
                    scales: { y: { ticks: { callback: v => v.toLocaleString('es-ES') + ' €' } } }
                }
            });
        }
    }, 50);
}