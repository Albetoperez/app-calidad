// ==========================================================================
// SIGMA PMO - APLICACIÓN PRINCIPAL (app.js)
// ==========================================================================

function esc(str) {
    if (str === null || str === undefined) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

const RESERVED = ['__proto__', 'constructor', 'prototype'];

let ESTRUCTURA = {};
let disciplinaActiva = 'Logística';
let lineaBaseBloqueada = false;
let tareaVinculoActiva = null;
let tabActivaConfig = 'produccion';
let tabActivaParte = 'produccion';
let tabActivaHistorial = 'produccion'; 

// === INICIALIZACIÓN ===
window.onload = async () => {
    localforage.config({ name: 'SIGMA_PMO', storeName: 'partes_v13' });
    
    const saved = await localforage.getItem('PMO_ESTRUCTURA_FINAL');
    if (saved) {
        ESTRUCTURA = saved;
    } else {
        ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
    }
    
    // Migración silenciosa: Transforma vínculos simples a múltiples (Arrays)
    for (let disc in ESTRUCTURA) {
        for (let grupo in ESTRUCTURA[disc]) {
            ESTRUCTURA[disc][grupo].forEach(item => {
                if (item.fechaInicio === undefined) item.fechaInicio = "";
                if (item.fechaFin === undefined) item.fechaFin = "";
                if (item.vinculos === undefined) {
                    item.vinculos = item.vinculo ? [item.vinculo] : [];
                    delete item.vinculo;
                }
                if (item.precioUnitario === undefined) item.precioUnitario = 0;
                if (item.presupuestoTotal === undefined) item.presupuestoTotal = 0;

            });
        }
    }
    
    lineaBaseBloqueada = await localforage.getItem('PMO_LINEABASE_BLOQUEADA') || false;
    
    inyectarModalVinculos();
    initEventDelegation();
    
    if (window.location.hash === '#parte') abrirParte();
};

function inyectarModalVinculos() {
    const modalHTML = `
    <div id="modal-vinculos" class="modal-overlay" style="display:none;">
        <div class="modal-content">
            <h3>Seleccionar Predecesoras</h3>
            <p style="font-size:0.85rem; color:#666; margin-top:0;">Selecciona las tareas que deben finalizar antes de iniciar esta.</p>
            <div id="lista-vinculos-checkbox" class="checkbox-list"></div>
            <div style="display:flex; justify-content:flex-end; gap:10px;">
                <button class="btn-nav-outline" onclick="cerrarModalVinculos()">Cancelar</button>
                <button class="btn-action" onclick="guardarVinculosModal()">Guardar Vínculos</button>
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

function initEventDelegation() {
    document.getElementById('sidebar-disc').addEventListener('click', e => {
        const btn = e.target.closest('.btn-sidebar');
        if (btn) cambiarDiscConfig(btn.dataset.disc);
    });

    document.getElementById('groups-area').addEventListener('click', e => {
        const t = e.target;
        if (t.matches('.btn-eliminar-grupo')) {
            if (confirm("¿Estás seguro de eliminar todo el grupo y sus ítems?")) {
                eliminarGrupo(t.dataset.grupo);
            }
            return;
        }
        if (t.matches('.btn-eliminar-sub')) {
            eliminarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10));
            return;
        }
        if (t.matches('.btn-anadir-sub')) {
            añadirSub(t.dataset.grupo);
            return;
        }
    });

    document.getElementById('groups-area').addEventListener('change', e => {
        const t = e.target;
        if (t.matches('.input-renombrar-grupo')) {
            renombrarGrupo(t.dataset.grupoOriginal, t.value);
            return;
        }
        if (t.matches('.input-sub-item')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'item', t.value);
            return;
        }
        if (t.matches('.input-sub-meta')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'meta', t.value);
            return;
        }
        if (t.matches('.select-sub-unidad')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'unidad', t.value);
            return;
        }
        if (t.matches('.input-sub-fechaini')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'fechaInicio', t.value);
            return;
        }
        if (t.matches('.input-sub-fechafin')) {
            actualizarSub(t.dataset.grupo, parseInt(t.dataset.idx, 10), 'fechaFin', t.value);
            return;
        }
    });

    document.getElementById('tabs-parte').addEventListener('click', e => {
        const btn = e.target.closest('.tab');
        if (btn) cambiarDiscParte(btn.dataset.disc);
    });

    document.getElementById('parte-acordeones').addEventListener('change', e => {
        if (e.target.matches('.input-add')) {
            validarProduccionDiaria(e.target);
        }
    });

    document.getElementById('groups-area-coste').addEventListener('change', e => {
        const t = e.target;
        if (t.matches('.input-sub-precio')) {
            const grupo = t.dataset.grupo, idx = parseInt(t.dataset.idx, 10);
            const val = parseFloat(t.value) || 0;
            const item = ESTRUCTURA[disciplinaActiva][grupo][idx];
            item.precioUnitario = val;
            if (item.meta > 0) {
                item.presupuestoTotal = val * item.meta;
            }
            renderGruposConfigCoste();
            return;
        }
        if (t.matches('.input-sub-presupuesto')) {
            ESTRUCTURA[disciplinaActiva][t.dataset.grupo][parseInt(t.dataset.idx, 10)].presupuestoTotal = parseFloat(t.value) || 0;
            return;
        }
    });

    document.getElementById('parte-certificaciones').addEventListener('change', e => {
        if (e.target.matches('.input-certif')) {
            validarCertificacion(e.target);
        }
    });
}

// === NAVEGACIÓN GENERAL ===
function irInicio() {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
    document.getElementById('view-portada').style.display = 'flex';
    document.getElementById('header-nav').style.display = 'none';
}

function refrescarParte() {
    if (tabActivaParte === 'produccion') {
        renderAcordeones();
    } else {
        renderAcordeonesCertificaciones();
    }
}

function refrescarHistorial() {
    if (tabActivaHistorial === 'produccion') {
        renderListaHistorial();
    } else {
        renderListaHistorialCertificaciones();
    }
}

// === MÓDULO 1: CONFIGURACIÓN Y METAS (WBS) ===
function abrirConfig() {
    document.getElementById('view-portada').style.display = 'none';
    document.getElementById('view-config').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const configHeader = document.querySelector('#view-config .main-content > div:first-child');
    configHeader.style.display = 'flex';
    configHeader.style.justifyContent = 'space-between';
    configHeader.style.flexWrap = 'wrap';
    configHeader.style.gap = '15px';
    
    configHeader.innerHTML = `
        <h2 style="margin: 0; color: var(--blue); border: none; padding: 0; min-width: 250px;">Configuración WBS</h2>
        <div class="header-actions">
            <button class="btn-header" onclick="descargarPlantillaWBS()">📥 Descargar Plantilla</button>
            <button class="btn-header" onclick="document.getElementById('file-import-wbs').click()">📤 Importar Excel</button>
            <input type="file" id="file-import-wbs" style="display:none;" accept=".xlsx, .xls" onchange="importarExcelWBS(this)">
            <button id="btn-toggle-lock" class="btn-header ${lineaBaseBloqueada ? 'locked' : 'unlocked'}" onclick="toggleBloqueo()">
                ${lineaBaseBloqueada ? '🔓 Desbloquear Línea Base' : '🔒 Congelar Línea Base'}
            </button>
        </div>
        <div class="tabs" style="width:100%; margin-top:15px; padding:0; border-bottom:2px solid #eee;">
            <button class="tab ${tabActivaConfig === 'produccion' ? 'active' : ''}" onclick="cambiarTabConfig('produccion')">📋 Producción</button>
            <button class="tab ${tabActivaConfig === 'coste' ? 'active' : ''}" onclick="cambiarTabConfig('coste')">💰 Coste</button>
        </div>
    `;
    
    renderSidebar();
    
    const costeArea = document.getElementById('groups-area-coste');
    if (!costeArea) {
        const groupsArea = document.getElementById('groups-area');
        const div = document.createElement('div');
        div.id = 'groups-area-coste';
        div.style.display = tabActivaConfig === 'coste' ? 'block' : 'none';
        groupsArea.parentNode.insertBefore(div, groupsArea.nextSibling);
    }
    
    if (tabActivaConfig === 'produccion') {
        document.getElementById('groups-area').style.display = 'block';
        document.getElementById('groups-area-coste').style.display = 'none';
        document.getElementById('add-group-ui').style.display = 'none';
        document.getElementById('btn-show-add').style.display = 'inline-block';
        renderGruposConfig();
    } else {
        document.getElementById('groups-area').style.display = 'none';
        document.getElementById('groups-area-coste').style.display = 'block';
        document.getElementById('add-group-ui').style.display = 'none';
        document.getElementById('btn-show-add').style.display = 'none';
        renderGruposConfigCoste();
    }
}

function cambiarTabConfig(tab) {
    tabActivaConfig = tab;
    abrirConfig();
}

function renderGruposConfigCoste() {
    const area = document.getElementById('groups-area-coste');
    area.innerHTML = '';
    const grupos = ESTRUCTURA[disciplinaActiva] || {};

    const disabledClass = lineaBaseBloqueada ? 'input-disabled' : '';

    for (let gName in grupos) {
        let html = `
        <div class="group-container">
            <div class="group-header">
                <span style="font-weight:bold;">${esc(gName)}</span>
            </div>
            <div style="overflow-x: auto; padding: 0 10px;">
                <table class="config-table" style="min-width: 650px;">
                    <thead>
                        <tr>
                            <th style="width:25%">Sub-ítem</th>
                            <th style="width:8%; text-align:center">Meta</th>
                            <th style="width:6%">Und</th>
                            <th style="width:18%">Precio Unitario (€)</th>
                            <th style="width:28%">Presupuesto Total (€)</th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        grupos[gName].forEach((sub, idx) => {
            const metaStr = Number.isInteger(sub.meta) ? sub.meta.toString() : (sub.meta || 0).toFixed(2);
            const precioStr = sub.precioUnitario ? sub.precioUnitario.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00';
            const presupStr = sub.presupuestoTotal ? sub.presupuestoTotal.toLocaleString('es-ES', {minimumFractionDigits:2, maximumFractionDigits:2}) : '0,00';
            const readonlyAttr = lineaBaseBloqueada ? 'readonly' : '';

            html += `
                        <tr>
                            <td><span style="font-weight:bold; color:#333;">${esc(sub.item)}</span></td>
                            <td style="text-align:center;">${metaStr}</td>
                            <td>${esc(sub.unidad)}</td>
                            <td><input type="number" min="0" step="0.01" value="${sub.precioUnitario || 0}" class="cfg-input ${disabledClass} input-sub-precio" data-grupo="${esc(gName)}" data-idx="${idx}" ${readonlyAttr}></td>
                            <td><input type="number" min="0" step="0.01" value="${sub.presupuestoTotal || 0}" class="cfg-input ${disabledClass} input-sub-presupuesto" data-grupo="${esc(gName)}" data-idx="${idx}" ${readonlyAttr}></td>
                        </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
        </div>`;
        area.innerHTML += html;
    }
    
    if (area.innerHTML === '') {
        area.innerHTML = '<div class="empty-state">No hay ítems configurados en esta disciplina.</div>';
    }
}

function renderSidebar() {
    const nav = document.getElementById('sidebar-disc');
    let html = '<h3 style="margin:0 0 15px 0; color:var(--blue);">Disciplinas</h3>';
    html += DISCIPLINAS.map(d => {
        return `<button class="btn-sidebar ${d === disciplinaActiva ? 'active' : ''}" data-disc="${esc(d)}">${esc(d)}</button>`;
    }).join('');
    nav.innerHTML = html;
}

function cambiarDiscConfig(d) { 
    disciplinaActiva = d; 
    renderSidebar(); 
    if (tabActivaConfig === 'produccion') {
        renderGruposConfig();
    } else {
        renderGruposConfigCoste();
    }
}

function renderGruposConfig() {
    const area = document.getElementById('groups-area'); 
    area.innerHTML = '';
    const grupos = ESTRUCTURA[disciplinaActiva] || {};

    const disabledClass = lineaBaseBloqueada ? 'input-disabled' : '';
    const hiddenClass = lineaBaseBloqueada ? 'btn-disabled' : '';

    for (let gName in grupos) {
        let html = `
        <div class="group-container">
            <div class="group-header">
                <input type="text" value="${esc(gName)}" class="cfg-input-header ${disabledClass} input-renombrar-grupo" data-grupo-original="${esc(gName)}" ${lineaBaseBloqueada ? 'readonly' : ''}>
                <button class="${hiddenClass} btn-eliminar-grupo" style="color:red; background:none; border:none; cursor:pointer;" data-grupo="${esc(gName)}">🗑️</button>
            </div>
            <div style="overflow-x: auto; padding: 0 10px;">
                <table class="config-table" style="min-width: 850px;">
                    <thead>
                        <tr>
                            <th style="width:25%">Sub-ítem</th>
                            <th style="width:10%; text-align:center">Meta</th>
                            <th style="width:10%">Und</th>
                            <th style="width:15%">F. Inicio</th>
                            <th style="width:15%">F. Fin</th>
                            <th style="width:20%; text-align:center;">Predecesoras</th>
                            <th class="${hiddenClass}" style="width:5%"></th>
                        </tr>
                    </thead>
                    <tbody>`;
        
        grupos[gName].forEach((sub, idx) => {
            let numVinculos = Array.isArray(sub.vinculos) ? sub.vinculos.length : 0;
            let btnText = numVinculos > 0 ? `🔗 Vínculos (${numVinculos})` : '🔗 Vincular';
            let btnStyle = numVinculos > 0 ? 'background:#dbeafe; border-color:#3b82f6;' : '';
            
            const opcionesUnidad = UNIDADES.map(u => `<option value="${esc(u)}" ${u === sub.unidad ? 'selected' : ''}>${esc(u)}</option>`).join('');

            html += `
                        <tr>
                            <td><input type="text" value="${esc(sub.item)}" class="cfg-input ${disabledClass} input-sub-item" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td><input type="number" min="0" value="${sub.meta}" class="cfg-input ${disabledClass} input-sub-meta" style="text-align:center;" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td>
                                <select class="cfg-input ${disabledClass} select-sub-unidad" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'disabled' : ''}>
                                    ${opcionesUnidad}
                                </select>
                            </td>
                            <td><input type="date" value="${sub.fechaInicio || ''}" class="cfg-input ${disabledClass} input-sub-fechaini" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td><input type="date" value="${sub.fechaFin || ''}" class="cfg-input ${disabledClass} input-sub-fechafin" data-grupo="${esc(gName)}" data-idx="${idx}" ${lineaBaseBloqueada ? 'readonly' : ''}></td>
                            <td style="text-align:center;"><button class="btn-vinculos ${disabledClass}" style="${btnStyle}" onclick="abrirModalVinculos('${esc(gName)}', ${idx})" ${lineaBaseBloqueada ? 'disabled' : ''}>${btnText}</button></td>
                            <td class="${hiddenClass}"><button style="border:none; background:none; color:red;" class="btn-eliminar-sub" data-grupo="${esc(gName)}" data-idx="${idx}">❌</button></td>
                        </tr>`;
        });
        
        html += `
                    </tbody>
                </table>
            </div>
            <button class="btn-action-add ${hiddenClass} btn-anadir-sub" style="background:#f9f9f9; width:100%; border:none; padding:10px; cursor:pointer;" data-grupo="${esc(gName)}">+ Añadir Ítem</button>
        </div>`;
        area.innerHTML += html;
    }
}

// === LÓGICA DE VENTANA MODAL DE VÍNCULOS ===
function abrirModalVinculos(grupo, idx) {
    tareaVinculoActiva = { grupo: grupo, idx: idx };
    const tareaActual = ESTRUCTURA[disciplinaActiva][grupo][idx];
    const vinculosGuardados = Array.isArray(tareaActual.vinculos) ? tareaActual.vinculos : [];
    
    const listaContainer = document.getElementById('lista-vinculos-checkbox');
    let html = '';

    for (let d in ESTRUCTURA) {
        html += `<div style="background:#f1f5f9; padding:5px 10px; font-weight:bold; font-size:0.8rem; margin-top:10px; color:var(--blue);">${d}</div>`;
        for (let g in ESTRUCTURA[d]) {
            ESTRUCTURA[d][g].forEach(sub => {
                if (d === disciplinaActiva && g === grupo && sub.item === tareaActual.item) return;

                let idUnico = `${d}||${g}||${sub.item}`;
                let isChecked = vinculosGuardados.includes(idUnico) ? 'checked' : '';
                
                html += `
                <div class="checkbox-item">
                    <input type="checkbox" id="chk-${esc(idUnico)}" value="${esc(idUnico)}" class="chk-vinculo" ${isChecked}>
                    <label for="chk-${esc(idUnico)}"><strong>${esc(g)}</strong>: ${esc(sub.item)}</label>
                </div>`;
            });
        }
    }

    listaContainer.innerHTML = html;
    document.getElementById('modal-vinculos').style.display = 'flex';
}

function cerrarModalVinculos() {
    document.getElementById('modal-vinculos').style.display = 'none';
    tareaVinculoActiva = null;
}

function guardarVinculosModal() {
    if (!tareaVinculoActiva) return;
    
    let marcados = [];
    document.querySelectorAll('.chk-vinculo:checked').forEach(chk => {
        marcados.push(chk.value);
    });

    ESTRUCTURA[disciplinaActiva][tareaVinculoActiva.grupo][tareaVinculoActiva.idx].vinculos = marcados;
    
    cerrarModalVinculos();
    renderGruposConfig(); 
}

async function guardarConfig() {
    const btn = document.getElementById('btn-save-wbs');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;
    try {
        await localforage.setItem('PMO_ESTRUCTURA_FINAL', ESTRUCTURA);
        alert('✅ Cambios guardados correctamente en la WBS y Fechas.');
    } catch (e) {
        alert('⚠️ Error al guardar la configuración: ' + e.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

async function toggleBloqueo() {
    lineaBaseBloqueada = !lineaBaseBloqueada;
    await localforage.setItem('PMO_LINEABASE_BLOQUEADA', lineaBaseBloqueada);
    
    const btn = document.getElementById('btn-toggle-lock');
    if (lineaBaseBloqueada) {
        btn.className = 'btn-header locked';
        btn.innerText = '🔓 Desbloquear Línea Base';
        alert("🔒 Línea base CONGELADA. Ya no se pueden modificar metas ni fechas.");
    } else {
        btn.className = 'btn-header unlocked';
        btn.innerText = '🔒 Congelar Línea Base';
        alert("🔓 Línea base DESBLOQUEADA. Puedes editar el contrato de nuevo.");
    }
    renderGruposConfig();
}

function mostrarUIAdicionGrupo() {
    document.getElementById('add-group-ui').style.display = 'block';
    document.getElementById('btn-show-add').style.display = 'none';
    document.getElementById('new-group-name').focus();
}

function cancelarNuevoGrupo() {
    document.getElementById('add-group-ui').style.display = 'none';
    document.getElementById('btn-show-add').style.display = 'inline-block';
    document.getElementById('new-group-name').value = '';
}

function guardarNuevoGrupo() {
    const n = document.getElementById('new-group-name').value.trim();
    if (!n) {
        alert("El nombre del grupo no puede estar vacío.");
        return;
    }
    if (RESERVED.includes(n) || n.startsWith('__')) {
        alert("⚠️ Error: Nombre de grupo no válido.");
        return;
    }
    if (!ESTRUCTURA[disciplinaActiva]) ESTRUCTURA[disciplinaActiva] = {};
    if (!ESTRUCTURA[disciplinaActiva][n]) {
        ESTRUCTURA[disciplinaActiva][n] = []; 
    }
    cancelarNuevoGrupo();
    renderGruposConfig(); 
}

function renombrarGrupo(o, n) {
    if (n && n !== o && !ESTRUCTURA[disciplinaActiva][n] && !RESERVED.includes(n) && !n.startsWith('__')) {
        ESTRUCTURA[disciplinaActiva][n] = ESTRUCTURA[disciplinaActiva][o]; 
        delete ESTRUCTURA[disciplinaActiva][o]; 
    }
    renderGruposConfig(); 
}

function añadirSub(g) { 
    ESTRUCTURA[disciplinaActiva][g].push({item:'', meta:0, unidad:'uds', fechaInicio:'', fechaFin:'', vinculos:[], precioUnitario:0, presupuestoTotal:0}); 
    renderGruposConfig(); 
}

function actualizarSub(g, i, k, v) { 
    if (k === 'meta') {
        const val = parseFloat(v);
        if (val < 0 || isNaN(val)) {
            alert("⚠️ Error: No se admiten metas negativas.");
            renderGruposConfig();
            return;
        }
        
        // 1. Guardamos la nueva cantidad (meta)
        const item = ESTRUCTURA[disciplinaActiva][g][i];
        item[k] = val;
        
        // 2. NUEVO: Recalculamos el presupuesto total automáticamente
        if (item.precioUnitario > 0) {
            item.presupuestoTotal = val * item.precioUnitario;
        } else {
            item.presupuestoTotal = 0;
        }
        
    } else {
        ESTRUCTURA[disciplinaActiva][g][i][k] = v;
    }
}

function eliminarSub(g, i) {
     ESTRUCTURA[disciplinaActiva][g].splice(i, 1);
     renderGruposConfig();
}

function eliminarGrupo(g) { 
    if (confirm("¿Estás seguro de eliminar todo el grupo y sus ítems?")) { 
        delete ESTRUCTURA[disciplinaActiva][g]; 
        renderGruposConfig(); 
    } 
}

// === MÓDULO 2: PARTE DIARIO DE PRODUCCIÓN ===
function abrirParte() {
    document.getElementById('view-portada').style.display = 'none';
    document.getElementById('view-parte').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const f = document.getElementById('fecha-parte'); 
    if (!f.value) f.value = new Date().toISOString().split('T')[0];
    
    document.getElementById('tabs-parte').innerHTML = DISCIPLINAS.map(d => { 
        return `<button class="tab ${d === disciplinaActiva ? 'active' : ''}" data-disc="${esc(d)}">${esc(d)}</button>`;
    }).join('');
    
    const certifTabs = document.getElementById('tabs-parte-tipo');
    if (!certifTabs) {
        const tabsParent = document.getElementById('tabs-parte').parentNode;
        const div = document.createElement('div');
        div.id = 'tabs-parte-tipo';
        div.className = 'tabs';
        div.style.cssText = 'padding:0 20px; border-bottom:2px solid #eee; margin-bottom:10px;';
        div.innerHTML = `
            <button class="tab ${tabActivaParte === 'produccion' ? 'active' : ''}" onclick="cambiarTabParte('produccion')">📋 Producción</button>
            <button class="tab ${tabActivaParte === 'certificaciones' ? 'active' : ''}" onclick="cambiarTabParte('certificaciones')">💰 Certificaciones</button>
        `;
        tabsParent.insertBefore(div, document.getElementById('tabs-parte').nextSibling);
    } else {
        certifTabs.innerHTML = `
            <button class="tab ${tabActivaParte === 'produccion' ? 'active' : ''}" onclick="cambiarTabParte('produccion')">📋 Producción</button>
            <button class="tab ${tabActivaParte === 'certificaciones' ? 'active' : ''}" onclick="cambiarTabParte('certificaciones')">💰 Certificaciones</button>
        `;
    }
    
    const certifArea = document.getElementById('parte-certificaciones');
    if (!certifArea) {
        const acordeones = document.getElementById('parte-acordeones');
        const div = document.createElement('div');
        div.id = 'parte-certificaciones';
        div.style.cssText = 'display:none;';
        acordeones.parentNode.insertBefore(div, acordeones.nextSibling);
        const saveBtn = document.querySelector('#view-parte .btn-save');
        const certifBtn = document.createElement('div');
        certifBtn.id = 'certif-save-area';
        certifBtn.style.cssText = 'text-align:center; margin-top:30px; display:none;';
        certifBtn.innerHTML = '<button class="btn-save" onclick="guardarCertificacion()">💾 GUARDAR CERTIFICACIÓN</button>';
        saveBtn.parentNode.insertBefore(certifBtn, saveBtn.nextSibling);
    }
    
    if (tabActivaParte === 'produccion') {
        document.getElementById('parte-acordeones').style.display = 'grid';
        document.getElementById('parte-certificaciones').style.display = 'none';
        document.querySelector('#view-parte .btn-save').style.display = 'inline-block';
        document.getElementById('certif-save-area').style.display = 'none';
        renderAcordeones();
    } else {
        document.getElementById('parte-acordeones').style.display = 'none';
        document.getElementById('parte-certificaciones').style.display = 'block';
        document.querySelector('#view-parte .btn-save').style.display = 'none';
        document.getElementById('certif-save-area').style.display = 'block';
        renderAcordeonesCertificaciones();
    }
}

function cambiarTabParte(tab) {
    tabActivaParte = tab;
    abrirParte();
}

function validarCertificacion(input) {
    if (parseFloat(input.value) < 0) {
        alert("⚠️ Error: No se puede registrar un importe negativo.");
        input.value = "";
    }
}

async function renderAcordeonesCertificaciones() {
    const area = document.getElementById('parte-certificaciones');
    area.innerHTML = '<div class="loading-spinner" style="margin:40px auto;">Cargando datos...</div>';

    const fechaInput = document.getElementById('fecha-parte');
    if (!fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    const fecha = fechaInput.value;
    const grupos = ESTRUCTURA[disciplinaActiva] || {};

    try {
        const certifs = await localforage.getItem('PMO_CERTIFICACIONES') || {};
        const guardadosHoy = (certifs[fecha] && certifs[fecha][disciplinaActiva]) ? certifs[fecha][disciplinaActiva] : null;

        let acumulados = {};
        for (let fKey in certifs) {
            let dia = certifs[fKey];
            if (dia[disciplinaActiva]) {
                for (let g in dia[disciplinaActiva]) {
                    if (!acumulados[g]) acumulados[g] = [];
                    dia[disciplinaActiva][g].forEach((sub, idx) => {
                        acumulados[g][idx] = (acumulados[g][idx] || 0) + (sub.importe || 0);
                        acumulados[g][idx + '__sobre'] = (acumulados[g][idx + '__sobre'] || 0) + (sub.sobrecoste || 0);
                    });
                }
            }
        }

        let html = '';
        for (let gName in grupos) {
            html += `<div class="group-container"><div class="group-header">${esc(gName)}</div><table class="config-table"><tbody>`;
            
            grupos[gName].forEach((sub, idx) => {
                const importeHoy = (guardadosHoy && guardadosHoy[gName] && guardadosHoy[gName][idx]) ? (guardadosHoy[gName][idx].importe || 0) : 0;
                const totalAcumulado = acumulados[gName] ? (acumulados[gName][idx] || 0) : 0;
                const presupuesto = sub.presupuestoTotal || 0;
                const pctPresupuesto = presupuesto > 0 ? Math.min((totalAcumulado / presupuesto) * 100, 100) : 0;

                    const sobrecosteHoy = (guardadosHoy && guardadosHoy[gName] && guardadosHoy[gName][idx]) ? (guardadosHoy[gName][idx].sobrecoste || 0) : 0;
                    const totalSobrecoste = acumulados[gName] ? (acumulados[gName][idx + '__sobre'] || 0) : 0;

                    html += `
                    <tr>
                        <td style="width: 55%; padding-right: 10px;">
                            <div style="font-weight: bold; color: #333; font-size: 0.9rem; margin-bottom: 8px;">${esc(sub.item)}</div>
                            <div class="badge-row">
                                <span class="badge badge-meta">Presupuestado: ${presupuesto.toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
                                <span class="badge badge-acum">Certificado acum: ${totalAcumulado.toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
                                <span class="badge badge-sobrecoste">Sobrecoste acum: ${totalSobrecoste.toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>
                                <span class="badge badge-certif-hoy">Certificado hoy: <strong>${(importeHoy + sobrecosteHoy).toLocaleString('es-ES', {minimumFractionDigits:2})} €</strong></span>
                            </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${pctPresupuesto}%; background: #16a34a;"></div>
                        </div>
                    </td>
                    <td style="vertical-align: middle; padding-left: 0; min-width: 250px;">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px; flex-wrap: wrap;">
                            <div style="display:flex; align-items:center; gap:3px;">
                                <span style="font-size: 0.7rem; color: #005596; font-weight:bold;">Contrato:</span>
                                <input type="number" id="certif-${esc(gName)}-${idx}" min="0" step="0.01" class="cfg-input input-add input-certif" style="width: 85px; text-align: right; font-weight: bold; border-color:#005596;" placeholder="0,00">
                            </div>
                            <div style="display:flex; align-items:center; gap:3px;">
                                <span style="font-size: 0.7rem; color: #dc2626; font-weight:bold;">Sobrecoste:</span>
                                <input type="number" id="certif-sobre-${esc(gName)}-${idx}" min="0" step="0.01" class="cfg-input input-add input-certif" style="width: 85px; text-align: right; font-weight: bold; border-color:#dc2626; background:#fef2f2;" placeholder="0,00">
                            </div>
                        </div>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
        area.innerHTML = html || '<div class="empty-state">No hay ítems configurados en esta disciplina.</div>';
    } catch (e) {
        area.innerHTML = `<div class="error-message">⚠️ Error al cargar datos: ${esc(e.message)}</div>`;
    }
}

async function guardarCertificacion() {
    const btn = document.querySelector('#certif-save-area .btn-save');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const fecha = document.getElementById('fecha-parte').value;
        if (!fecha) {
            alert('⚠️ Selecciona una fecha antes de guardar.');
            btn.innerText = textoOriginal;
            btn.style.opacity = '1';
            btn.disabled = false;
            return;
        }

        let certifs = await localforage.getItem('PMO_CERTIFICACIONES') || {};
        
        if (!certifs[fecha]) certifs[fecha] = {};
        if (!certifs[fecha][disciplinaActiva]) certifs[fecha][disciplinaActiva] = {};

        let data = {};
        const existente = certifs[fecha][disciplinaActiva];

        for (let g in ESTRUCTURA[disciplinaActiva]) {
            data[g] = ESTRUCTURA[disciplinaActiva][g].map((sub, i) => {
                const input = document.getElementById(`certif-${esc(g)}-${i}`);
                const inputSobre = document.getElementById(`certif-sobre-${esc(g)}-${i}`);
                let importe = input ? (parseFloat(input.value) || 0) : 0;
                let sobrecoste = inputSobre ? (parseFloat(inputSobre.value) || 0) : 0;
                if (importe < 0) importe = 0;
                if (sobrecoste < 0) sobrecoste = 0;
                const prev = (existente[g] && existente[g][i]) ? existente[g][i] : null;
                return {
                    item: sub.item,
                    importe: (prev ? prev.importe || 0 : 0) + importe,
                    sobrecoste: (prev ? prev.sobrecoste || 0 : 0) + sobrecoste
                };
            });
        }

        certifs[fecha][disciplinaActiva] = data;
        await localforage.setItem('PMO_CERTIFICACIONES', certifs);
        alert("✅ Certificación registrada correctamente.");
        irInicio();
    } catch (e) {
        alert("⚠️ Error al guardar la certificación: " + e.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

function cambiarDiscParte(d) { 
    disciplinaActiva = d; 
    abrirParte(); 
}

async function renderAcordeones() {
    const area = document.getElementById('parte-acordeones');
    area.innerHTML = '<div class="loading-spinner" style="margin:40px auto;">Cargando datos de producción...</div>';

    const fechaInput = document.getElementById('fecha-parte');
    if (!fechaInput.value) fechaInput.value = new Date().toISOString().split('T')[0];
    const fecha = fechaInput.value;
    const grupos = ESTRUCTURA[disciplinaActiva] || {};

    try {
        const hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        const guardadosHoy = (hist[fecha] && hist[fecha][disciplinaActiva]) ? hist[fecha][disciplinaActiva] : null;

        let acumulados = {};
        for (let fKey in hist) {
            let dia = hist[fKey];
            if (dia[disciplinaActiva]) {
                for (let g in dia[disciplinaActiva]) {
                    if (!acumulados[g]) acumulados[g] = [];
                    dia[disciplinaActiva][g].forEach((sub, idx) => {
                        acumulados[g][idx] = (acumulados[g][idx] || 0) + (sub.cantidad || 0);
                    });
                }
            }
        }

        let html = '';
        for (let gName in grupos) {
            html += `<div class="group-container"><div class="group-header">${esc(gName)}</div><table class="config-table"><tbody>`;
            
            grupos[gName].forEach((sub, idx) => {
                const valorHoy = (guardadosHoy && guardadosHoy[gName] && guardadosHoy[gName][idx]) ? (guardadosHoy[gName][idx].cantidad || 0) : 0;
                const totalAcumulado = acumulados[gName] ? (acumulados[gName][idx] || 0) : 0;
                const porcentaje = sub.meta > 0 ? Math.min((totalAcumulado / sub.meta) * 100, 100) : 0;
                const metaStr = Number.isInteger(sub.meta) ? sub.meta.toString() : sub.meta.toFixed(2);

                    html += `
                    <tr>
                        <td style="width: 60%; padding-right: 10px;">
                            <div style="font-weight: bold; color: #333; font-size: 0.9rem; margin-bottom: 8px;">${esc(sub.item)}</div>
                            <div class="badge-row">
                                <span class="badge badge-meta">Meta: ${metaStr} ${esc(sub.unidad)}</span>
                                <span class="badge badge-acum">Acum: ${totalAcumulado.toLocaleString()} ${esc(sub.unidad)}</span>
                                <span class="badge badge-certif-hoy">Producción de hoy: <strong>${valorHoy > 0 ? valorHoy : '0'}</strong></span>
                            </div>
                        <div class="progress-bar-bg">
                            <div class="progress-bar-fill" style="width: ${porcentaje}%;"></div>
                        </div>
                    </td>
                    <td style="vertical-align: middle; padding-left: 0;">
                        <div style="display: flex; align-items: center; justify-content: flex-end; gap: 5px;">
                            <span style="font-size: 0.8rem; color: #b45309; font-weight:bold;">+ Añadir:</span>
                            <input type="number" id="prod-${esc(gName)}-${idx}" step="any" class="cfg-input input-add" style="width: 80px; text-align: right; font-weight: bold;" placeholder="0">
                        </div>
                    </td>
                </tr>`;
            });
            html += `</tbody></table></div>`;
        }
        area.innerHTML = html || '<div class="empty-state">No hay ítems configurados en esta disciplina.</div>';
    } catch (e) {
        area.innerHTML = `<div class="error-message">⚠️ Error al cargar datos: ${esc(e.message)}</div>`;
    }
}

function validarProduccionDiaria(input) {
    // Función liberada: ahora se permiten ajustes negativos
}

async function guardarParte() {
    const btn = document.querySelector('#view-parte .btn-save');
    const textoOriginal = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.style.opacity = '0.7';
    btn.disabled = true;

    try {
        const fecha = document.getElementById('fecha-parte').value;
        if (!fecha) {
            alert('⚠️ Selecciona una fecha antes de guardar.');
            btn.innerText = textoOriginal;
            btn.style.opacity = '1';
            btn.disabled = false;
            return;
        }

        let hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
        
        if (!hist[fecha]) hist[fecha] = {};
        if (!hist[fecha][disciplinaActiva]) hist[fecha][disciplinaActiva] = {};

        let data = {};
        const existente = hist[fecha][disciplinaActiva];

        for (let g in ESTRUCTURA[disciplinaActiva]) {
            data[g] = ESTRUCTURA[disciplinaActiva][g].map((sub, i) => {
                const input = document.getElementById(`prod-${esc(g)}-${i}`);
                let valorAgregado = input ? (parseFloat(input.value) || 0) : 0;
                                
                // Rescatamos lo que ya estuviera guardado hoy (si lo hay) y se lo sumamos a lo nuevo
                const prev = (existente[g] && existente[g][i]) ? existente[g][i] : null;
                
                return { 
                    item: sub.item, 
                    cantidad: (prev ? prev.cantidad || 0 : 0) + valorAgregado, 
                    unidad: sub.unidad 
                };
            });
        }

        hist[fecha][disciplinaActiva] = data;
        await localforage.setItem('PMO_HISTORIAL_PRODUCCION', hist);
        alert("✅ Producción registrada correctamente.");
        irInicio();
    } catch (e) {
        alert("⚠️ Error al guardar la producción: " + e.message);
    } finally {
        btn.innerText = textoOriginal;
        btn.style.opacity = '1';
        btn.disabled = false;
    }
}

// === MÓDULO 3: VISOR DE HISTORIAL (Muro y Calendario) ===

let mesCalendario = new Date().getMonth();
let anioCalendario = new Date().getFullYear();

function abrirHistorial() {
    document.querySelectorAll('[id^="view-"]').forEach(v => v.style.display = 'none');
    document.getElementById('view-historial').style.display = 'block';
    document.getElementById('header-nav').style.display = 'block';
    
    const histTabs = document.getElementById('tabs-historial');
    if (!histTabs) {
        const parent = document.querySelector('#view-historial .main-content');
        const div = document.createElement('div');
        div.id = 'tabs-historial';
        div.className = 'tabs';
        div.style.cssText = 'padding:0; border-bottom:2px solid #eee; margin-bottom:15px;';
        div.innerHTML = `
            <button class="tab ${tabActivaHistorial === 'produccion' ? 'active' : ''}" onclick="cambiarTabHistorial('produccion')">📋 Producción</button>
            <button class="tab ${tabActivaHistorial === 'certificaciones' ? 'active' : ''}" onclick="cambiarTabHistorial('certificaciones')">💰 Certificaciones</button>
        `;
        parent.insertBefore(div, document.getElementById('historial-lista'));
    } else {
        histTabs.innerHTML = `
            <button class="tab ${tabActivaHistorial === 'produccion' ? 'active' : ''}" onclick="cambiarTabHistorial('produccion')">📋 Producción</button>
            <button class="tab ${tabActivaHistorial === 'certificaciones' ? 'active' : ''}" onclick="cambiarTabHistorial('certificaciones')">💰 Certificaciones</button>
        `;
    }
    
    // Al abrir, generamos el calendario y mostramos el historial
    renderCalendario();
    refrescarHistorial();
}

function cambiarTabHistorial(tab) {
    tabActivaHistorial = tab;
    abrirHistorial();
}

// --- LOGICA DEL CALENDARIO ---
// --- LOGICA DEL CALENDARIO (Corregido para no pintar puntos si los datos están a 0) ---
async function renderCalendario() {
    const container = document.getElementById('calendario-historial');
    if(!container) return;

    const histProd = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    const histCert = await localforage.getItem('PMO_CERTIFICACIONES') || {};
    
    const primerDia = new Date(anioCalendario, mesCalendario, 1);
    const ultimoDia = new Date(anioCalendario, mesCalendario + 1, 0);
    
    let html = `
    <div class="calendar-header">
        <button class="btn-nav-outline" style="padding:4px 12px; font-size:1rem;" onclick="cambiarMesCalendario(-1)">◀</button>
        <span>${primerDia.toLocaleDateString('es-ES', {month: 'long', year: 'numeric'}).toUpperCase()}</span>
        <button class="btn-nav-outline" style="padding:4px 12px; font-size:1rem;" onclick="cambiarMesCalendario(1)">▶</button>
    </div>
    <div class="calendar-grid">
        <div class="cal-day-header">Lun</div><div class="cal-day-header">Mar</div><div class="cal-day-header">Mié</div>
        <div class="cal-day-header">Jue</div><div class="cal-day-header">Vie</div><div class="cal-day-header">Sáb</div><div class="cal-day-header">Dom</div>
    `;

    let diaSemana = primerDia.getDay() === 0 ? 7 : primerDia.getDay();
    for (let i = 1; i < diaSemana; i++) {
        html += `<div class="cal-day empty"></div>`;
    }

    const fechaSeleccionada = document.getElementById('fecha-historial').value;

    for (let i = 1; i <= ultimoDia.getDate(); i++) {
        const f = new Date(anioCalendario, mesCalendario, i);
        const fLocal = new Date(f.getTime() - (f.getTimezoneOffset() * 60000)).toISOString().split('T')[0];
        
        // Verificación real de Producción: ¿Hay algo mayor que 0?
        let tieneProd = false;
        if (histProd[fLocal]) {
            for (let d in histProd[fLocal]) {
                for (let g in histProd[fLocal][d]) {
                    if (Array.isArray(histProd[fLocal][d][g])) {
                        histProd[fLocal][d][g].forEach(item => {
                            if (item.cantidad > 0) tieneProd = true;
                        });
                    }
                }
            }
        }

        // Verificación real de Certificaciones: ¿Hay algo mayor que 0?
        let tieneCert = false;
        if (histCert[fLocal]) {
            for (let d in histCert[fLocal]) {
                for (let g in histCert[fLocal][d]) {
                    if (Array.isArray(histCert[fLocal][d][g])) {
                        histCert[fLocal][d][g].forEach(item => {
                            if (item.importe > 0 || item.sobrecoste > 0) tieneCert = true;
                        });
                    }
                }
            }
        }
        
        let clases = "cal-day";
        if (tieneProd || tieneCert) clases += " has-data";
        if (fLocal === fechaSeleccionada) clases += " selected";

        let dots = "";
        if (tieneProd) dots += `<div class="cal-dot dot-prod" title="Hay producción"></div>`;
        if (tieneCert) dots += `<div class="cal-dot dot-cert" title="Hay certificación"></div>`;

        html += `<div class="${clases}" onclick="seleccionarFechaHistorial('${fLocal}')">
            ${i}
            <div class="cal-dot-container">${dots}</div>
        </div>`;
    }
    html += `</div>`;
    container.innerHTML = html;
}

function cambiarMesCalendario(delta) {
    mesCalendario += delta;
    if (mesCalendario > 11) { mesCalendario = 0; anioCalendario++; }
    else if (mesCalendario < 0) { mesCalendario = 11; anioCalendario--; }
    renderCalendario();
}

function seleccionarFechaHistorial(fecha) {
    document.getElementById('fecha-historial').value = fecha || ""; 
    renderCalendario(); // Para repintar el día seleccionado en azul
    refrescarHistorial(); // Para actualizar el muro inferior
}

// --- LOGICA DEL MURO DE ACTIVIDAD ---
// Función para abrir/cerrar el acordeón
window.toggleAcordeonDia = function(id) {
    const content = document.getElementById(id);
    const icon = document.getElementById('icon-' + id);
    if (content.classList.contains('open')) {
        content.classList.remove('open');
        icon.innerText = '▼'; // Flecha abajo
    } else {
        content.classList.add('open');
        icon.innerText = '▲'; // Flecha arriba
    }
};

// --- LOGICA DEL MURO DE ACTIVIDAD (Con Acordeón) ---
async function renderListaHistorialCertificaciones() {
    const fecha = document.getElementById('fecha-historial').value;
    const certifs = await localforage.getItem('PMO_CERTIFICACIONES') || {};
    const area = document.getElementById('historial-lista');
    
    let fechasAMostrar = fecha ? [fecha] : Object.keys(certifs).sort((a,b) => new Date(b) - new Date(a));
    
    if (fechasAMostrar.length === 0 || (!fecha && Object.keys(certifs).length === 0)) {
        area.innerHTML = '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">No hay certificaciones registradas.</div>';
        return;
    }
    
    let htmlCompleto = '';

    fechasAMostrar.forEach(f => {
        const dataDia = certifs[f];
        if (!dataDia) return;

        let htmlDia = '';
        let hayDatosGlobal = false;

        for (let disc in dataDia) {
            let tieneDatos = false;
            let discHtml = `
            <div class="group-container" style="border-color: #16a34a; margin-top: 10px;">
                <div class="group-header" style="background: #16a34a; color: white;">💰 ${esc(disc)}</div>
                <div style="background: white;">`;
            
            for (let g in dataDia[disc]) {
                dataDia[disc][g].forEach(item => {
                    const tieneContrato = item.importe > 0;
                    const tieneSobrecoste = item.sobrecoste > 0;
                    if (tieneContrato || tieneSobrecoste) {
                        tieneDatos = true;
                        hayDatosGlobal = true;
                        let valoresHtml = '';
                        if (tieneContrato) valoresHtml += `<span style="color:#005596; font-weight:bold;">${item.importe.toLocaleString('es-ES', {minimumFractionDigits:2})} €</span>`;
                        if (tieneSobrecoste) valoresHtml += `${tieneContrato ? ' + ' : ''}<span style="color:#dc2626; font-weight:bold;">${item.sobrecoste.toLocaleString('es-ES', {minimumFractionDigits:2})} €*</span>`;
                        discHtml += `
                        <div class="ticket-row">
                            <div>
                                <div class="ticket-title">${esc(g)}</div>
                                <div class="ticket-sub">${esc(item.item)}</div>
                            </div>
                            <div class="ticket-val" style="font-size:1rem;">${valoresHtml}</div>
                        </div>`;
                    }
                });
            }
            discHtml += `</div></div>`;
            if (tieneDatos) htmlDia += discHtml;
        }
        
        if (hayDatosGlobal) {
            const [yyyy, mm, dd] = f.split('-');
            const idAcordeon = `cert-dia-${f}`;
            // Si hay una fecha concreta seleccionada, se abre solo. Si no, se queda cerrado.
            const isOpen = fecha ? 'open' : ''; 
            const iconDir = fecha ? '▲' : '▼';

            htmlCompleto += `
            <div class="dia-acordeon-header" onclick="toggleAcordeonDia('${idAcordeon}')">
                <span>📅 Certificación del: ${dd}/${mm}/${yyyy}</span>
                <span id="icon-${idAcordeon}">${iconDir}</span>
            </div>
            <div id="${idAcordeon}" class="dia-acordeon-content ${isOpen}">
                ${htmlDia}
                <div style="text-align:right; font-size:0.75rem; color:#888; margin-top:5px;">* Sobrecoste (adicionales)</div>
            </div>`;
        }
    });

    area.innerHTML = htmlCompleto || '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">Registros en cero.</div>';
}

async function renderListaHistorial() {
    const fecha = document.getElementById('fecha-historial').value;
    const hist = await localforage.getItem('PMO_HISTORIAL_PRODUCCION') || {};
    const area = document.getElementById('historial-lista');
    
    let fechasAMostrar = fecha ? [fecha] : Object.keys(hist).sort((a,b) => new Date(b) - new Date(a));
    
    if (fechasAMostrar.length === 0 || (!fecha && Object.keys(hist).length === 0)) {
        area.innerHTML = '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">No hay partes de trabajo registrados.</div>';
        return;
    }
    
    let htmlCompleto = '';

    fechasAMostrar.forEach(f => {
        const dataDia = hist[f];
        if (!dataDia) return;

        let htmlDia = '';
        let hayDatosGlobal = false;

        for (let disc in dataDia) {
            let tieneDatos = false;
            let discHtml = `
            <div class="group-container" style="border-color: var(--blue); margin-top: 10px;">
                <div class="group-header" style="background: var(--blue); color: white;">⚙️ ${esc(disc)}</div>
                <div style="background: white;">`;
            
            for (let g in dataDia[disc]) {
                dataDia[disc][g].forEach(item => {
                    if (item.cantidad > 0) {
                        tieneDatos = true;
                        hayDatosGlobal = true;
                        discHtml += `
                        <div class="ticket-row">
                            <div>
                                <div class="ticket-title">${esc(g)}</div>
                                <div class="ticket-sub">${esc(item.item)}</div>
                            </div>
                            <div class="ticket-val">${item.cantidad} <span style="font-size:0.8rem; color:#888;">${esc(item.unidad)}</span></div>
                        </div>`;
                    }
                });
            }
            discHtml += `</div></div>`;
            if (tieneDatos) htmlDia += discHtml;
        }
        
        if (hayDatosGlobal) {
            const [yyyy, mm, dd] = f.split('-');
            const idAcordeon = `prod-dia-${f}`;
            // Si hay una fecha concreta seleccionada, se abre solo. Si no, se queda cerrado.
            const isOpen = fecha ? 'open' : ''; 
            const iconDir = fecha ? '▲' : '▼';

            htmlCompleto += `
            <div class="dia-acordeon-header" onclick="toggleAcordeonDia('${idAcordeon}')">
                <span>📅 Parte de Producción: ${dd}/${mm}/${yyyy}</span>
                <span id="icon-${idAcordeon}">${iconDir}</span>
            </div>
            <div id="${idAcordeon}" class="dia-acordeon-content ${isOpen}">
                ${htmlDia}
            </div>`;
        }
    });
    
    area.innerHTML = htmlCompleto || '<div style="padding: 30px; text-align: center; color: #888; font-weight: bold;">Registros en cero.</div>';
}

// === MOTOR DE IMPORTACIÓN Y EXPORTACIÓN DE EXCEL PARA LA WBS ===

function cargarSheetJS() {
    if (window.XLSX) return Promise.resolve();
    return new Promise((resolve) => {
        const script = document.createElement('script');
        script.src = "https://cdn.jsdelivr.net/npm/xlsx/dist/xlsx.full.min.js";
        script.onload = resolve;
        document.head.appendChild(script);
    });
}

async function descargarPlantillaWBS() {
    await cargarSheetJS();
    let data = [];
    
    for (let d in ESTRUCTURA) {
        for (let g in ESTRUCTURA[d]) {
            ESTRUCTURA[d][g].forEach(sub => {
                data.push({
                    "Disciplina": d,
                    "Grupo WBS": g,
                    "Sub-ítem / Tarea": sub.item,
                    "Meta": sub.meta || 0,
                    "Unidad": sub.unidad || "uds",
                    "Precio Unitario (€)": sub.precioUnitario || 0,
                    "Presupuesto Total (€)": sub.presupuestoTotal || 0,
                    "Fecha Inicio (AAAA-MM-DD)": sub.fechaInicio || "",
                    "Fecha Fin (AAAA-MM-DD)": sub.fechaFin || ""
                });
            });
        }
    }
    
    const ws = XLSX.utils.json_to_sheet(data);
    ws['!cols'] = [{wch: 20}, {wch: 25}, {wch: 35}, {wch: 12}, {wch: 10}, {wch: 18}, {wch: 20}, {wch: 22}, {wch: 22}];
    
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Contrato WBS");
    XLSX.writeFile(wb, "Plantilla_Maestro_WBS_ELECNOR.xlsx");
}

async function importarExcelWBS(input) {
    if (!input.files || input.files.length === 0) return;
    await cargarSheetJS();
    
    const file = input.files[0];
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            const worksheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json(worksheet);
            
            if (json.length === 0) {
                alert("⚠️ Error: El archivo Excel seleccionado está vacío.");
                input.value = "";
                return;
            }

            const primeraFila = json[0];
            if (!primeraFila.hasOwnProperty("Disciplina") || !primeraFila.hasOwnProperty("Grupo WBS") || !primeraFila.hasOwnProperty("Sub-ítem / Tarea")) {
                alert("⚠️ Formato incorrecto. El Excel debe contener obligatoriamente las columnas: 'Disciplina', 'Grupo WBS' y 'Sub-ítem / Tarea'.");
                input.value = "";
                return;
            }

            if (!confirm("⚠️ ATENCIÓN: Al importar este Excel se reescribirá la Línea Base con los datos del archivo. ¿Deseas continuar?")) {
                input.value = "";
                return;
            }

            let NUEVA_ESTRUCTURA = JSON.parse(JSON.stringify(ESTRUCTURA_MAESTRA));
            for (let d in NUEVA_ESTRUCTURA) {
                NUEVA_ESTRUCTURA[d] = {};
            }

            json.forEach(row => {
                const d = row["Disciplina"] ? row["Disciplina"].trim() : "";
                const g = row["Grupo WBS"] ? row["Grupo WBS"].trim() : "";
                const item = row["Sub-ítem / Tarea"] ? row["Sub-ítem / Tarea"].trim() : "";
                const meta = parseFloat(row["Meta"]) || 0;
                const unidad = row["Unidad"] ? row["Unidad"].trim() : "uds";
                const precioUnitario = parseFloat(row["Precio Unitario (€)"]) || 0;
                const presupuestoTotal = parseFloat(row["Presupuesto Total (€)"]) || 0;
                const fIni = row["Fecha Inicio (AAAA-MM-DD)"] ? row["Fecha Inicio (AAAA-MM-DD)"].toString().trim() : "";
                const fFin = row["Fecha Fin (AAAA-MM-DD)"] ? row["Fecha Fin (AAAA-MM-DD)"].toString().trim() : "";

                if (!d || !g || !item) return; 

                if (!NUEVA_ESTRUCTURA[d]) NUEVA_ESTRUCTURA[d] = {};
                if (!NUEVA_ESTRUCTURA[d][g]) NUEVA_ESTRUCTURA[d][g] = [];

                NUEVA_ESTRUCTURA[d][g].push({
                    item: item,
                    meta: meta,
                    unidad: unidad,
                    precioUnitario: precioUnitario,
                    presupuestoTotal: presupuestoTotal,
                    fechaInicio: fIni,
                    fechaFin: fFin,
                    vinculos: [] 
                });
            });

            ESTRUCTURA = NUEVA_ESTRUCTURA;
            if (tabActivaConfig === 'produccion') {
                renderGruposConfig();
            } else {
                renderGruposConfigCoste();
            }
            alert("✅ Excel leído correctamente en pantalla. Pulsa el botón de abajo 'GUARDAR CAMBIOS EN WBS' para consolidarlo en el sistema.");
            
        } catch(err) {
            alert("⚠️ Error crítico procesando el archivo: " + err.message);
        }
        input.value = ""; 
    };
    reader.readAsArrayBuffer(file);
}

// =======================================================================
// === FUNCIÓN: IMPORTAR METAS DESDE LA APP DE PRODUCCIÓN ===
// =======================================================================
async function importarMetasDesdeProd() {
    if (!confirm("¿Desea importar las cantidades de diseño consolidadas desde Producción?")) return;

    try {
        const dbProd = localforage.createInstance({ name: 'SIGMA_PROD_V1', storeName: 'produccion_hincas' });
        
        // 1. Vamos directamente a la caja fuerte limpia
        const totales = await dbProd.getItem('PARQUE_TOTALES_PROYECTO');

        if (!totales) {
            alert("No se ha encontrado la tabla de totales.\n\nPor favor, recarga tu archivo Excel en la aplicación de Producción para que se generen los datos.");
            return;
        }

        // 2. Volcamos la información limpia en tu WBS
        if (typeof ESTRUCTURA !== 'undefined') {
            for (let disc in ESTRUCTURA) {
                for (let grupo in ESTRUCTURA[disc]) {
                    const listaItems = ESTRUCTURA[disc][grupo];
                    if (!Array.isArray(listaItems)) continue;

                    const grupoUpper = grupo.toUpperCase();

                    listaItems.forEach(item => {
                        if (!item.item) return;
                        const nombreItem = item.item.toLowerCase();

                        // --- LOGÍSTICA ---
                        if (grupoUpper.includes('1.1 HINCAS') && nombreItem.includes('suministro')) item.meta = totales.hincas;
                        if (grupoUpper.includes('1.2 ESTRUCTURA') && nombreItem.includes('suministro de estructura')) item.meta = totales.trackers;
                        if ((grupoUpper.includes('1.3 MODULOS') || grupoUpper.includes('1.3 MÓDULOS')) && 
                            (nombreItem.includes('suministro de modulos') || nombreItem.includes('suministro de módulos'))) {
                            item.meta = totales.modulos;
                        }
                        if (grupoUpper.includes('1.4 INVERSORES') && nombreItem.includes('suministro de inversores')) item.meta = totales.power_stations;
                        if (grupoUpper.includes('1.6 SCBS') && nombreItem.includes('suministro de cajas scb')) item.meta = totales.scb;
                        if (grupoUpper.includes('1.7 SCADA Y CCTV') && nombreItem.includes('suministro de cctv')) item.meta = totales.cctv;

                        // --- OBRA CIVIL --- 
                        if (grupoUpper.includes('2.2 VALLADO PERIMETRAL') && nombreItem.includes('vallado perimetral')) item.meta = Math.round(totales.vallado);
                        if (grupoUpper.includes('2.4 LOSAS POWER STATION') && nombreItem.includes('skid')) item.meta = totales.power_stations;

                        // Zanjas BT y MT
                        if (grupoUpper.includes('2.6 ZANJAS DE BT') && (nombreItem.includes('excavacion') || nombreItem.includes('excavación') || nombreItem.includes('tubos') || nombreItem.includes('relleno'))) {
                            item.meta = Math.round(totales.zanjas_bt);
                        }
                        if (grupoUpper.includes('2.7 ZANJAS DE MT') && (nombreItem.includes('excavacion') || nombreItem.includes('excavación') || nombreItem.includes('tubos') || nombreItem.includes('relleno'))) {
                            item.meta = Math.round(totales.zanjas_mt);
                        }

                        // Mantenemos Arquetas y CCTV Civil como estaban por si acaso
                        if (grupoUpper.includes('2.8 ARQUETAS')) {
                            if (nombreItem === 'arquetas') item.meta = totales.arquetas;
                            if (nombreItem.includes('torre') || nombreItem.includes('comunicaciones')) item.meta = (totales.mbox + totales.tbox + totales.gateway + totales.csb);
                            if (nombreItem.includes('cctv') && !nombreItem.includes('zanjas')) item.meta = totales.cctv;
                        }
                        if (grupoUpper.includes('2.9 CCTV') || grupoUpper.includes('ZANJAS CCTV')) {
                             if (nombreItem.includes('excavacion') || nombreItem.includes('excavación') || nombreItem.includes('tubos') || nombreItem.includes('relleno')) item.meta = Math.round(totales.zanjas_cctv);
                        }

                        // --- MECÁNICA ---
                        if (grupoUpper.includes('3.1 INSTALACIÓN DE HINCAS') && (nombreItem.includes('instalación') || nombreItem.includes('instalacion'))) item.meta = totales.hincas;
                        if (grupoUpper.includes('3.2 MONTAJE DE ESTRUCTURA') && nombreItem.includes('montaje')) item.meta = totales.trackers;
                        if ((grupoUpper.includes('3.3 MONTAJE DE MODULOS') || grupoUpper.includes('3.3 MONTAJE DE MÓDULOS')) && 
                            (nombreItem.includes('montaje de modulos') || nombreItem.includes('montaje de módulos') || nombreItem.includes('montaje'))) {
                            item.meta = totales.modulos;
                        }

                        // --- ELÉCTRICA / COMUNICACIONES ---
                        if (grupoUpper.includes('4.5 POWER STATION') && (nombreItem.includes('equipo') || nombreItem.includes('instalacion') || nombreItem.includes('instalación'))) item.meta = totales.power_stations;
                        
                        if (grupoUpper.includes('4.5 SCBS') && (nombreItem.includes('instalación mecánica') || nombreItem.includes('instalacion mecanica') || nombreItem.includes('instalacion mecánica'))) {
                            item.meta = totales.scb;
                        }
                        
                        if (grupoUpper.includes('4.7 TORRES DE COMUNICACION') || grupoUpper.includes('4.7 TORRES DE COMUNICACIÓN')) {
                            if (nombreItem === 'mbox') item.meta = totales.mbox;
                            if (nombreItem === 'tbox') item.meta = totales.tbox;
                            if (nombreItem === 'csb') item.meta = totales.csb;
                            if (nombreItem === 'gateway') item.meta = totales.gateway;
                        }
                        if (grupoUpper.includes('4.8 CCTV') && (nombreItem.includes('baculo') || nombreItem.includes('báculo') || nombreItem.includes('camara') || nombreItem.includes('cámara'))) item.meta = totales.cctv;
                        
                        if ((grupoUpper.includes('4.10 ESTACIÓN METEOROLÓGICA') || grupoUpper.includes('4.10 ESTACION METEOROLOGICA')) && (nombreItem.includes('estación meteorológica') || nombreItem.includes('estacion meteorologica'))) {
                            item.meta = totales.meteos;
                        }
                    });
                }
            }

            // 3. ¡AQUÍ ESTÁ EL TRUCO! Guardamos la estructura actualizada en LocalForage para siempre
            await localforage.setItem('PMO_ESTRUCTURA_FINAL', ESTRUCTURA);

            // 4. Refresco visual de la tabla actual
            if (typeof cambiarDiscConfig === 'function') cambiarDiscConfig(disciplinaActiva);
            else if (typeof renderGruposConfig === 'function' && tabActivaConfig === 'produccion') renderGruposConfig();
            else if (typeof renderGruposConfigCoste === 'function') renderGruposConfigCoste();

            alert("✅ Importación completada y GUARDADA con éxito en el navegador.");
        }
    } catch (error) {
        alert("Error en el proceso de comunicación con Producción: " + error.message);
    }
}