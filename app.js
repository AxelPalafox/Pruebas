// ==========================================
// CONFIGURACIÓN DEL BACKEND NODE.JS
// ==========================================
const API_URL = 'https://5df53aade86f1a.app.lhr.life';

// Función universal para comunicarse con Node.js
async function apiCall(endpoint, method = 'GET', bodyData = null) {
    const options = {
        method: method,
        headers: { 'Content-Type': 'application/json' }
    };
    if (bodyData) {
        options.body = JSON.stringify(bodyData);
    }
    try {
        const response = await fetch(`${API_URL}/api/${endpoint}`, options);
        if (!response.ok) {
            const errData = await response.json().catch(() => ({}));
            throw new Error(errData.error || `Error HTTP: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error(`Error en ${endpoint}:`, error);
        throw error;
    }
}

// ==========================================
// VARIABLES GLOBALES
// ==========================================
let logosEquipos = {}; let todosLosPartidos = []; let todasLasPosiciones = []; let equiposAdminClasificados = { "Categoria A": [], "Categoria B": [] }; 
let datosScorebook = { visitante: [], local: [] }; let rostersScorebook = { visitante: [], local: [] }; 
let rosterCompletoGlobal = { visitante: [], local: [] }; 
let infoPartidoActivo = { info: "", equipoVisita: "", equipoLocal: "", equipoAnotando: "" }; 
let celdaActiva = null; let indicesActivos = { equipo: '', jugador: 0, inning: 0 }; let basesActivas = { b1: false, b2: false, b3: false, hr: false }; let outActivo = 0; 
let equipoActivoGlobal = ""; let esAdminGlobal = false; 
let lineupSeleccionado = []; let ordenJugadoresClic = []; 
let cambioActivo = { lado: '', indice: 0, nombreAnterior: '' };
const coloresLogos = ['#e53935', '#1e88e5', '#43a047', '#fb8c00', '#8e24aa', '#3949ab', '#00897b']; 

function getColor(str) { let sum=0; for(let i=0;i<str.length;i++) sum+=str.charCodeAt(i); return coloresLogos[sum % coloresLogos.length]; }

// ==========================================
// INICIALIZACIÓN
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    document.getElementById('login-pass').addEventListener('keypress', function(e) { if(e.key === 'Enter') intentarLogin(); });
    document.getElementById('login-user').addEventListener('keypress', function(e) { if(e.key === 'Enter') intentarLogin(); });
    document.getElementById('input-jugada').addEventListener('keypress', function(e) { if(e.key === 'Enter') guardarJugada(); });
    document.getElementById('input-nuevo-jugador').addEventListener('keypress', function(e) { if(e.key === 'Enter') agregarJugador(); });
    
    apiCall('obtenerProximosPartidos').then(res => { 
        todosLosPartidos = res || []; mostrarPartidos(todosLosPartidos); llenarSelectorAnotador(); 
    }).catch(console.error);

    apiCall('obtenerPosiciones').then(res => { 
        todasLasPosiciones = res || []; mostrarPosiciones(todasLasPosiciones); 
    }).catch(console.error);

    apiCall('obtenerLogos').then(res => { 
        logosEquipos = res || {}; 
        if(todosLosPartidos.length > 0) filtrarPorJornada(); 
        if(todasLasPosiciones.length > 0) mostrarPosiciones(todasLasPosiciones); 
    }).catch(console.error); 
});

function cambiarPantalla(id, boton) {
    document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa')); 
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('activa'); 
    boton.classList.add('active'); 
    let banners = document.querySelectorAll('.panel-lateral');
    if(id === 'pantalla-anotador' || id === 'pantalla-acceso') {
       banners.forEach(b => b.style.display = 'none');
    } else {
       banners.forEach(b => b.style.display = 'flex');
    }
    if(id === 'pantalla-anotador') llenarSelectorAnotador();
    if(id === 'pantalla-estadisticas') cargarEstadisticas();
}

function parseGameDate(fStr, hStr) {
    try {
        let year, month, day;
        if (fStr.match(/^\d{4}-\d{2}-\d{2}$/)) { 
            let parts = fStr.split('-'); year = parseInt(parts[0]); month = parseInt(parts[1]) - 1; day = parseInt(parts[2]); 
        } else { 
            let months = { "ene":0, "feb":1, "mar":2, "abr":3, "may":4, "jun":5, "jul":6, "ago":7, "sep":8, "oct":9, "nov":10, "dic":11 }; 
            let parts = fStr.toLowerCase().split(/[ \/\-]/); day = parseInt(parts[0]); if (isNaN(day)) return null; 
            let monthPart = parts[1] || ""; month = new Date().getMonth(); 
            if(!isNaN(parseInt(monthPart))) { month = parseInt(monthPart) - 1; } 
            else { for(let m in months) { if(monthPart.includes(m)) { month = months[m]; break; } } } 
            year = parts[2] ? parseInt(parts[2]) : new Date().getFullYear(); if (year < 100) year += 2000; 
        }
        let hours = 23, mins = 59; 
        if(hStr) { 
            let hMatch = hStr.match(/(\d+):(\d+)\s*(am|pm)?/i); 
            if(hMatch) { hours = parseInt(hMatch[1]); mins = parseInt(hMatch[2]); let ampm = hMatch[3] ? hMatch[3].toLowerCase() : ''; if(ampm === 'pm' && hours < 12) hours += 12; if(ampm === 'am' && hours === 12) hours = 0; } 
        }
        return new Date(year, month, day, hours, mins);
    } catch(e) { return null; }
}

// ==========================================
// ESTADÍSTICAS Y POSICIONES
// ==========================================
function cargarEstadisticas() {
    document.getElementById('contenedor-stats').style.display = 'none'; document.getElementById('msj-stats').style.display = 'block';
    
    apiCall('obtenerEstadisticas').then(res => {
        document.getElementById('msj-stats').style.display = 'none'; document.getElementById('contenedor-stats').style.display = 'flex';
        let tHr = document.getElementById('tabla-hrs'); tHr.innerHTML = '<tr style="background:#e65100;"><th>Jugador</th><th>HR</th></tr>';
        if(res.hrs.length === 0) tHr.innerHTML += '<tr><td colspan="2" style="color:#888;">Sin datos</td></tr>';
        res.hrs.forEach((h, i) => tHr.innerHTML += `<tr><td style="text-align:left; font-weight:bold; text-transform:capitalize;">${i+1}. ${h[0]}</td><td style="font-size:14px; font-weight:900;">${h[1]}</td></tr>`);
        let tP = document.getElementById('tabla-pitchers'); tP.innerHTML = '<tr style="background:#2e7d32;"><th>Pitcher</th><th>Wins</th></tr>';
        if(res.pitchers.length === 0) tP.innerHTML += '<tr><td colspan="2" style="color:#888;">Sin datos</td></tr>';
        res.pitchers.forEach((p, i) => tP.innerHTML += `<tr><td style="text-align:left; font-weight:bold; text-transform:capitalize;">${i+1}. ${p[0]}</td><td style="font-size:14px; font-weight:900;">${p[1]}</td></tr>`);
    }).catch(err => { document.getElementById('msj-stats').innerText = "Error cargando estadísticas."; });
}

function mostrarPosiciones(datos) {
    var div = document.getElementById('contenedor-tabla-posiciones');
    if(!datos || datos.length <= 1) { div.innerHTML = '<p style="text-align:center; color:#888; padding:20px;">Aún no hay juegos finalizados.</p>'; return; }
    var headers = datos[0].slice(1); var posA = []; var posB = [];
    for(var i=1; i<datos.length; i++) { if(datos[i][0] === "Categoria A") posA.push(datos[i].slice(1)); else if(datos[i][0] === "Categoria B") posB.push(datos[i].slice(1)); }
    var renderTable = function(title, rows, color) {
        if(rows.length === 0) return '';
        rows.sort((a,b) => {
            let ptsA = parseFloat(a[8].toString().replace(',', '.')) || 0; let ptsB = parseFloat(b[8].toString().replace(',', '.')) || 0;
            if(ptsA !== ptsB) return ptsB - ptsA; let difA = parseInt(a[7]) || 0; let difB = parseInt(b[7]) || 0; return difB - difA;
        });
        var html = `<h3 style="color:${color}; text-align:center; margin-top:20px; font-size:16px; background:#fff; padding:10px; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05);">${title}</h3><div style="overflow-x:auto; background:white; border-radius:8px; box-shadow:0 2px 5px rgba(0,0,0,0.05); margin-bottom:20px;"><table class="tabla-posiciones" style="width:100%; min-width:500px;"><thead><tr style="background-color:${color};">`;
        headers.forEach(h => html += `<th>${h}</th>`); html += '</tr></thead><tbody>';
        rows.forEach((r, index) => {
            html += '<tr>';
            r.forEach((c, idx) => {
               if(idx === 0) { 
                   let ini = c.substring(0,1).toUpperCase(); let img = logosEquipos[c] ? `<img src="${logosEquipos[c]}" class="pos-logo">` : `<div class="pos-logo-letra" style="background-color:${getColor(c)};">${ini}</div>`;
                   html += `<td style="text-align:left; font-weight:bold; white-space:nowrap; display:flex; align-items:center;"><span style="width:20px; text-align:center; color:#888; font-size:11px; margin-right:5px;">${index+1}</span>${img} ${c}</td>`;
               } else if(idx === 8) { html += `<td style="font-weight:900; color:${color}; font-size:14px;">${c !== "" ? c : "0"}</td>`; } else { html += `<td>${c !== "" ? c : "0"}</td>`; }
            }); html += '</tr>';
        });
        html += '</tbody></table></div>'; return html;
    }
    div.innerHTML = renderTable("🏆 CATEGORÍA A", posA, "#1a237e") + renderTable("🏆 CATEGORÍA B", posB, "#e65100");
}

function mostrarPartidos(partidos) {
    var s = document.getElementById('select-jornada');
    if(!partidos || partidos.length === 0) { 
       s.innerHTML = '<option>No hay partidos</option>'; 
       document.getElementById('contenedor-cat-a').innerHTML = '<p style="text-align:center;">Aún no hay juegos</p>'; 
       document.getElementById('contenedor-cat-b').innerHTML = '<p style="text-align:center;">Aún no hay juegos</p>'; 
       return; 
    }
    let jUnicas = []; partidos.forEach(p => { let j = p[6]?p[6].trim():""; if(j!=="" && !jUnicas.includes(j)) jUnicas.push(j); });
    jUnicas.sort((a, b) => { let numA = parseInt(a.replace(/\D/g, '')); let numB = parseInt(b.replace(/\D/g, '')); if(!isNaN(numA) && !isNaN(numB)) return numA - numB; if(!isNaN(numA)) return -1; if(!isNaN(numB)) return 1; return a.localeCompare(b); });
    s.innerHTML = '<option value="TODAS">Ver Todas las Jornadas</option>'; jUnicas.forEach(j => s.innerHTML += `<option value="${j}">${j}</option>`);
    filtrarPorJornada(); 
}

function filtrarPorJornada() {
    var sel = document.getElementById('select-jornada'); 
    var contA = document.getElementById('contenedor-cat-a'); contA.innerHTML = ''; 
    var contB = document.getElementById('contenedor-cat-b'); contB.innerHTML = '';  
    var filt = (sel.value === "TODAS") ? todosLosPartidos : todosLosPartidos.filter(p => (p[6]?p[6].trim():"") === sel.value);
    let cuentaA = 0; let cuentaB = 0;
    if(filt.length === 0) { 
        contA.innerHTML = '<p style="text-align:center; color:#888;">No hay partidos.</p>';
        contB.innerHTML = '<p style="text-align:center; color:#888;">No hay partidos.</p>';
        return; 
    }
    filt.forEach(function(p) {
      let fMostrar = p[0] || "Por definir"; if (fMostrar.match(/^\d{4}-\d{2}-\d{2}$/)) { let pts = fMostrar.split('-'); fMostrar = `${pts[2]}/${pts[1]}/${pts[0]}`; }
      let cLoc = (p[7] !== "" && p[7] !== undefined) ? p[7] : "-"; let cVis = (p[8] !== "" && p[8] !== undefined) ? p[8] : "-"; 
      let isEnVivo = false;
      if (cLoc === "-" && cVis === "-" && p[0]) {
         let gDate = parseGameDate(p[0], p[1]);
         if(gDate) {
             let now = new Date();
             let dosHoras = new Date(gDate.getTime() + (2 * 60 * 60 * 1000));
             if (now >= gDate && now <= dosHoras) isEnVivo = true;
         }
      }
      let badgeVivo = isEnVivo ? `<span class="badge-vivo">🔴 EN VIVO</span>` : "";
      let eqL = p[3] || "Local"; let eqV = p[4] || "Visita"; let iniL = eqL.substring(0,1).toUpperCase(); let iniV = eqV.substring(0,1).toUpperCase();
      let imgL = logosEquipos[eqL] ? `<img src="${logosEquipos[eqL]}" class="equipo-logo">` : `<div class="equipo-inicial" style="background-color:${getColor(eqL)}">${iniL}</div>`;
      let imgV = logosEquipos[eqV] ? `<img src="${logosEquipos[eqV]}" class="equipo-logo">` : `<div class="equipo-inicial" style="background-color:${getColor(eqV)}">${iniV}</div>`;
      let tarjeta = `<div class="tarjeta-partido"><div class="header-partido"><span>${fMostrar} ${p[1]} ${badgeVivo}</span><span>${p[2]} ${p[6]}</span></div><div class="equipos-container"><div class="equipo">${imgL}<div class="equipo-nombre">${eqL}</div></div><div class="vs-container"><div class="marcador-container"><span class="marcador">${cLoc}</span> - <span class="marcador">${cVis}</span></div></div><div class="equipo">${imgV}<div class="equipo-nombre">${eqV}</div></div></div>${p[5] ? `<div style="text-align:center; font-size:12px; color:#888; margin-top:10px;">📍 ${p[5]}</div>` : ""}</div>`;
      if (p[2] && p[2].toString().toUpperCase().includes("CATEGORIA A")) { contA.innerHTML += tarjeta; cuentaA++; }
      else { contB.innerHTML += tarjeta; cuentaB++; }
    });
    if(cuentaA === 0) contA.innerHTML = '<p style="text-align:center; color:#888;">Sin juegos programados</p>';
    if(cuentaB === 0) contB.innerHTML = '<p style="text-align:center; color:#888;">Sin juegos programados</p>';
}

// ==========================================
// AUTENTICACIÓN
// ==========================================
function intentarLogin() {
    var u = document.getElementById('login-user').value.trim(); 
    var p = document.getElementById('login-pass').value.trim(); 
    var msj = document.getElementById('login-mensaje');
    if(!u || !p) { msj.style.color="#e53935"; msj.innerText="Escribe usuario y contraseña"; msj.style.display='block'; return; }
    
    msj.style.color="#1a237e"; msj.innerText="Comprobando..."; msj.style.display='block';     
    
    apiCall('loginUsuario', 'POST', { usuario: u, password: p }).then(res => {
        if(res.exito) {
            document.getElementById('login-seccion').style.display = 'none'; 
            msj.style.display='none';
            document.getElementById('equipo-seccion').style.display = 'block';
            if(res.rol === "ADMIN") {
                esAdminGlobal = true; equipoActivoGlobal = "ADMIN"; document.getElementById('titulo-nombre-equipo').innerText = "👑 Modo Administrador"; 
            } else {
                esAdminGlobal = false; equipoActivoGlobal = res.equipo; document.getElementById('titulo-nombre-equipo').innerText = res.equipo; 
            }
            prepararPanelEquipo(equipoActivoGlobal);
        } else { 
            msj.style.color="#e53935"; msj.innerText="Credenciales incorrectas"; 
        }
    }).catch(err => { 
        msj.style.color="#e53935"; msj.innerText="Error de conexión."; 
    });
}

function cerrarSesion() { 
    equipoActivoGlobal=""; esAdminGlobal=false; 
    document.getElementById('equipo-seccion').style.display='none'; 
    document.getElementById('login-seccion').style.display='block'; 
}

// ==========================================
// PANEL DE ADMINISTRACIÓN Y EQUIPO
// ==========================================
function prepararPanelEquipo(nombre) {
    lineupSeleccionado = []; ordenJugadoresClic = []; actualizarPizarraLineup(); 
    if (esAdminGlobal) { 
        document.getElementById('panel-admin-partidos').style.display = 'block'; 
        document.getElementById('contenedor-admin-equipo').style.display = 'block'; 
        document.getElementById('panel-admin-rosters').style.display = 'block'; 
        document.getElementById('panel-admin-equipos').style.display = 'block'; 
        inicializarAdminPartidos();
        
        apiCall('obtenerEquipos').then(equipos => {
            let selE = document.getElementById('admin-select-equipo'); 
            let selR = document.getElementById('admin-roster-equipo'); 
            let selDel = document.getElementById('baja-eq-sel');
            selE.innerHTML = '<option value="">Selecciona equipo...</option>'; 
            selR.innerHTML = '<option value="">Selecciona un equipo a editar...</option>'; 
            selDel.innerHTML = '<option value="">Selecciona equipo a eliminar...</option>';
            let unicos = []; 
            equipos.forEach(e => { 
                let nombreEquipo = e[1];
                if(nombreEquipo && !unicos.includes(nombreEquipo) && !nombreEquipo.includes("AGENCIA LIBRE")) {
                    unicos.push(nombreEquipo); 
                } 
            }); 
            let opcionesDraft = `
              <option value="AGENCIA LIBRE A">🔥 DRAFT - CATEGORÍA A</option>
              <option value="AGENCIA LIBRE B">🔥 DRAFT - CATEGORÍA B</option>
            `;
            selE.innerHTML += opcionesDraft; selR.innerHTML += opcionesDraft;
            unicos.sort().forEach(e => { 
                let opt = `<option value="${e}">${e}</option>`;
                selE.innerHTML += opt; selR.innerHTML += opt; selDel.innerHTML += opt; 
            });
        }).catch(console.error);

        document.getElementById('contenedor-jugadores-lineup').innerHTML = '<p style="color:#888; grid-column:span 2; text-align:center;">Elige equipo arriba.</p>';
    } else {
        document.getElementById('panel-admin-partidos').style.display = 'none'; 
        document.getElementById('contenedor-admin-equipo').style.display = 'none'; 
        document.getElementById('panel-admin-rosters').style.display = 'none'; 
        document.getElementById('panel-admin-equipos').style.display = 'none';
        document.getElementById('contenedor-jugadores-lineup').innerHTML = '<p style="grid-column:span 2; text-align:center;">Cargando jugadores...</p>';
        cargarCheckboxesRoster(nombre);
    }
    let jUnicas = []; todosLosPartidos.forEach(p => { 
        if (esAdminGlobal || p[3]===nombre || p[4]===nombre) {
            let j = p[6]?p[6].trim():""; if(j!=="" && !jUnicas.includes(j)) jUnicas.push(j); 
        }
    });
    jUnicas.sort((a, b) => { let numA = parseInt(a.replace(/\D/g, '')); let numB = parseInt(b.replace(/\D/g, '')); if(!isNaN(numA) && !isNaN(numB)) return numA - numB; if(!isNaN(numA)) return -1; if(!isNaN(numB)) return 1; return a.localeCompare(b); });
    let selJ = document.getElementById('lineup-jornada-selector');
    selJ.innerHTML = '<option value="TODAS">Todas las Jornadas</option>';
    jUnicas.forEach(j => selJ.innerHTML += `<option value="${j}">${j}</option>`);
    filtrarLineupsPorJornada();
}

function inicializarAdminPartidos() {
    apiCall('obtenerListaEquiposAdmin').then(catEquipos => { 
        equiposAdminClasificados = catEquipos; filtrarEquiposPorCategoria(); 
    }).catch(console.error); 

    let selJor = document.getElementById('admin-jornada-edicion');
    let jUnicas = []; todosLosPartidos.forEach(p => { let j = p[6]?p[6].trim():""; if(j!=="" && !jUnicas.includes(j)) jUnicas.push(j); });
    jUnicas.sort((a, b) => { let numA = parseInt(a.replace(/\D/g, '')); let numB = parseInt(b.replace(/\D/g, '')); if(!isNaN(numA) && !isNaN(numB)) return numA - numB; if(!isNaN(numA)) return -1; if(!isNaN(numB)) return 1; return a.localeCompare(b); });
    selJor.innerHTML = '<option value="TODAS">Todas las Jornadas</option>';
    jUnicas.forEach(j => selJor.innerHTML += `<option value="${j}">${j}</option>`);
    filtrarEdicionPorJornada();
}

function filtrarEdicionPorJornada() {
    let selJor = document.getElementById('admin-jornada-edicion').value;
    let selEdicion = document.getElementById('admin-selector-edicion');
    selEdicion.innerHTML = '<option value="NUEVO">➕ CREAR NUEVO PARTIDO</option>';
    todosLosPartidos.forEach((p, index) => { 
        let j = p[6]?p[6].trim():"";
        if(selJor === "TODAS" || selJor === j) {
            selEdicion.innerHTML += `<option value="${index + 2}">${p[0]} - ${p[3]} vs ${p[4]}</option>`; 
        }
    });
}

function forzarRecalculo() {
    let btn = document.getElementById('btn-recalcular'); btn.innerText = "Sincronizando..."; btn.disabled = true;
    apiCall('recalcularPosicionesGS', 'POST').then(res => {
        btn.innerText = "✅ Sincronizado"; setTimeout(() => { btn.innerText = "🔄 Sincronizar Puntos y Posiciones"; btn.disabled = false; }, 3000);
        apiCall('obtenerPosiciones').then(pos => { todasLasPosiciones = pos || []; mostrarPosiciones(todasLasPosiciones); });
    }).catch(err => { btn.innerText = "Error"; btn.disabled = false; });
}

function filtrarEquiposPorCategoria() {
    let cat = document.getElementById('form-cat').value; let selLoc = document.getElementById('form-loc'); let selVis = document.getElementById('form-vis');
    let valLoc = selLoc.value; let valVis = selVis.value;
    selLoc.innerHTML = '<option value="">Equipo Local...</option>'; selVis.innerHTML = '<option value="">Equipo Visita...</option>';
    let eqs = [];
    if (cat === "Categoria A") eqs = equiposAdminClasificados["Categoria A"] || []; else if (cat === "Categoria B") eqs = equiposAdminClasificados["Categoria B"] || []; else eqs = [...new Set([...(equiposAdminClasificados["Categoria A"] || []), ...(equiposAdminClasificados["Categoria B"] || [])])].sort();
    eqs.forEach(e => { selLoc.innerHTML += `<option value="${e}">${e}</option>`; selVis.innerHTML += `<option value="${e}">${e}</option>`; });
    if(valLoc) selLoc.value = valLoc; if(valVis) selVis.value = valVis;
}

function cargarDatosPartidoEdicion() {
    let fila = document.getElementById('admin-selector-edicion').value;
    if(fila === "NUEVO") {
        ['form-fecha','form-hora','form-cat','form-jor','form-loc','form-vis','form-campo','form-score-loc','form-score-vis'].forEach(id => document.getElementById(id).value = "");
        filtrarEquiposPorCategoria(); document.getElementById('btn-guardar-partido').innerText = "➕ Crear Partido"; document.getElementById('btn-borrar-partido').style.display = "none";
    } else {
        let p = todosLosPartidos[fila - 2]; let fGuardada = p[0] || "";
        if (fGuardada.includes("/")) { let partes = fGuardada.split("/"); if (partes.length === 3) { let d = partes[0].padStart(2, '0'); let m = partes[1].padStart(2, '0'); let y = partes[2]; if (y.length === 2) y = "20" + y; document.getElementById('form-fecha').value = `${y}-${m}-${d}`; } } 
        else if (fGuardada.match(/^\d{4}-\d{2}-\d{2}$/)) { document.getElementById('form-fecha').value = fGuardada; } else { document.getElementById('form-fecha').value = ""; }
        document.getElementById('form-hora').value = p[1] || "";
        let selCat = document.getElementById('form-cat'); let cGuardada = p[2] || ""; if(!Array.from(selCat.options).some(o => o.value === cGuardada) && cGuardada !== "") selCat.innerHTML += `<option value="${cGuardada}">${cGuardada}</option>`; selCat.value = cGuardada; filtrarEquiposPorCategoria();
        let selJor = document.getElementById('form-jor'); let jGuardada = p[6] || ""; if(!Array.from(selJor.options).some(o => o.value === jGuardada) && jGuardada !== "") selJor.innerHTML += `<option value="${jGuardada}">${jGuardada}</option>`; selJor.value = jGuardada;
        document.getElementById('form-loc').value = p[3] || ""; document.getElementById('form-vis').value = p[4] || "";
        let selCampo = document.getElementById('form-campo'); let campoGuardado = p[5] || ""; if(!Array.from(selCampo.options).some(o => o.value === campoGuardado) && campoGuardado !== "") selCampo.innerHTML += `<option value="${campoGuardado}">${campoGuardado}</option>`; selCampo.value = campoGuardado;
        document.getElementById('form-score-loc').value = p[7] || ""; document.getElementById('form-score-vis').value = p[8] || "";
        document.getElementById('btn-guardar-partido').innerText = "🔄 Actualizar Marcador"; document.getElementById('btn-borrar-partido').style.display = "block";
    }
}

function guardarCambiosPartido() {
    let fila = document.getElementById('admin-selector-edicion').value; let datos = [ document.getElementById('form-fecha').value, document.getElementById('form-hora').value, document.getElementById('form-cat').value, document.getElementById('form-loc').value, document.getElementById('form-vis').value, document.getElementById('form-campo').value, document.getElementById('form-jor').value, document.getElementById('form-score-loc').value, document.getElementById('form-score-vis').value, fila ];
    if(!datos[3] || !datos[4]) { Swal.fire("Selecciona Equipo Local y Visitante."); return; }
    
    let btn = document.getElementById('btn-guardar-partido'); btn.innerText = "Guardando..."; btn.disabled = true;
    
    apiCall('guardarPartidoAdminGS', 'POST', { datos }).then(res => {
        btn.innerText = "✅ Guardado"; btn.disabled = false; setTimeout(() => { btn.innerText = "💾 Guardar"; }, 2000);
        apiCall('obtenerProximosPartidos').then(partidos => { todosLosPartidos = partidos; inicializarAdminPartidos(); mostrarPartidos(partidos); });
        apiCall('obtenerPosiciones').then(pos => { todasLasPosiciones = pos || []; mostrarPosiciones(todasLasPosiciones); });
    }).catch(err => { Swal.fire('Error', 'Falla al guardar', 'error'); btn.innerText = "💾 Guardar"; btn.disabled = false; });
}

function borrarPartido() {
    if(!confirm("¿Estás seguro de que deseas borrar este partido? Esto no se puede deshacer.")) return;
    let fila = document.getElementById('admin-selector-edicion').value; let btn = document.getElementById('btn-borrar-partido'); btn.innerText = "Borrando..."; btn.disabled = true;
    
    apiCall('borrarPartidoAdminGS', 'POST', { fila }).then(res => {
        btn.innerText = "🗑️ Borrar"; btn.disabled = false;
        apiCall('obtenerProximosPartidos').then(partidos => { todosLosPartidos = partidos; inicializarAdminPartidos(); mostrarPartidos(partidos); });
        apiCall('obtenerPosiciones').then(pos => { todasLasPosiciones = pos || []; mostrarPosiciones(todasLasPosiciones); });
    }).catch(err => { Swal.fire('Error', 'No se pudo borrar', 'error'); btn.innerText = "🗑️ Borrar"; btn.disabled = false; });
}

function crearEquipoBase() {
    let cat = document.getElementById('alta-eq-cat').value; let nombre = document.getElementById('alta-eq-nombre').value.trim(); let jugStr = document.getElementById('alta-eq-jugadores').value.trim();
    if(!nombre) { Swal.fire("Ponle un nombre al equipo"); return; } let jugadores = jugStr.split('\n').filter(j => j.trim() !== "");
    let btn = document.getElementById('btn-crear-eq'); btn.innerText = "Creando..."; btn.disabled = true;
    
    apiCall('altaEquipoGS', 'POST', { cat, nombre, jugadores }).then(res => {
        btn.innerText = "✨ Crear Equipo con Jugadores"; btn.disabled = false;
        if(res === "OK") { Swal.fire("Equipo Creado"); document.getElementById('alta-eq-nombre').value = ""; document.getElementById('alta-eq-jugadores').value = ""; prepararPanelEquipo("ADMIN"); }
    }).catch(err => { Swal.fire('Error', 'Falla al crear', 'error'); btn.innerText = "✨ Crear Equipo con Jugadores"; btn.disabled = false; });
}

function eliminarEquipoBase() {
    let eq = document.getElementById('baja-eq-sel').value; if(!eq) return; if(!confirm(`¿Seguro de eliminar al equipo ${eq}?`)) return;
    let btn = document.getElementById('btn-eliminar-eq'); btn.innerText = "Eliminando..."; btn.disabled = true;
    
    apiCall('bajaEquipoGS', 'POST', { eq }).then(res => { 
        btn.innerText = "🗑️ Eliminar Franquicia"; btn.disabled = false; if(res === "OK") { Swal.fire("Equipo eliminado"); prepararPanelEquipo("ADMIN"); } 
    }).catch(err => { Swal.fire('Error', 'Falla al eliminar', 'error'); btn.innerText = "🗑️ Eliminar Franquicia"; btn.disabled = false; });
}

function cargarRosterEdicion() {
    let eq = document.getElementById('admin-roster-equipo').value; let cont = document.getElementById('contenedor-edicion-roster'); let lista = document.getElementById('lista-roster-edicion');
    if(!eq) { cont.style.display = 'none'; return; } cont.style.display = 'block'; lista.innerHTML = '<p style="text-align:center;">Cargando jugadores...</p>';
    
    apiCall('obtenerRosterParaLineup', 'POST', { equipo: eq }).then(j => {
        lista.innerHTML = ''; if(j.length === 0) lista.innerHTML = '<p style="text-align:center; color:#888;">El equipo no tiene jugadores.</p>';
        j.forEach(jug => { lista.innerHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding:8px; border-bottom:1px solid #eee;"><span style="font-size:14px; font-weight:bold; text-transform:capitalize;">${jug}</span><button onclick="bajaJugador('${jug}')" style="background:#e53935; color:white; border:none; border-radius:4px; padding:5px 10px; cursor:pointer; font-weight:bold;">Dar de Baja</button></div>`; });
    }).catch(err => lista.innerHTML = '<p style="text-align:center; color:#e53935;">Error al cargar.</p>');
}

function agregarJugador() {
    let eq = document.getElementById('admin-roster-equipo').value; 
    let nombre = document.getElementById('input-nuevo-jugador').value.trim();
    if(!eq || !nombre) { Swal.fire('Atención', 'Selecciona un equipo y escribe el nombre del jugador.', 'warning'); return; } 
    document.getElementById('input-nuevo-jugador').value = 'Guardando...';
    
    apiCall('agregarJugadorGS', 'POST', { eq, nombre }).then(res => {
        document.getElementById('input-nuevo-jugador').value = '';
        if(res && res.toString().includes("RECHAZADO_LIMITE_A")) {
            Swal.fire({ icon: 'error', title: 'Límite alcanzado', text: 'Este equipo de la Categoría B ya tiene 2 jugadores de la Categoría A. No se permiten más refuerzos.', confirmButtonColor: '#d33' });
        } else if (res && res.toString().includes("OK_REFUERZO")) {
            let partes = res.split("|"); let equipoOriginal = partes[1] || "Categoría A";
            Swal.fire({ icon: 'info', title: 'Refuerzo de Cat A Agregado', html: `El jugador se agregó correctamente con la etiqueta <b>(Cat A)</b>.<br><br>Sigue perteneciendo a <b>${equipoOriginal}</b>.`, confirmButtonColor: '#3085d6' });
            cargarRosterEdicion();
        } else if (res === "OK") {
            Swal.fire({ icon: 'success', title: '¡Guardado!', text: 'Jugador registrado correctamente.', showConfirmButton: false, timer: 1500 });
            cargarRosterEdicion(); 
        } else { Swal.fire('Error', 'Ocurrió un error al guardar.', 'error'); }
    }).catch(err => {
        document.getElementById('input-nuevo-jugador').value = ''; Swal.fire('Error', 'Ocurrió un error de red.', 'error');
    });
}

function bajaJugador(nombre) {
    let eq = document.getElementById('admin-roster-equipo').value; if(!confirm(`¿Seguro que deseas dar de baja a ${nombre} del equipo ${eq}?`)) return;
    
    apiCall('eliminarJugadorGS', 'POST', { eq, nombre }).then(res => { 
        if(res === "OK") cargarRosterEdicion(); else Swal.fire("No se pudo dar de baja."); 
    }).catch(err => Swal.fire('Error', 'Error de red.', 'error'));
}

function cargarJugadoresAdmin() {
    var equipoElegido = document.getElementById('admin-select-equipo').value; 
    lineupSeleccionado = []; ordenJugadoresClic = []; actualizarPizarraLineup(); 
    if(equipoElegido === "") { document.getElementById('contenedor-jugadores-lineup').innerHTML = ''; return; }
    document.getElementById('contenedor-jugadores-lineup').innerHTML = '<p style="grid-column:span 2; text-align:center;">Cargando jugadores...</p>';
    cargarCheckboxesRoster(equipoElegido);
}

// ==========================================
// FOTOS Y CREDENCIAL VIRTUAL
// ==========================================
function procesarFoto(nombreJugador) {
    const input = document.getElementById('inputFoto');
    const file = input.files[0];
    if (!file) return;
    const fotoImg = document.getElementById('fotoCredencial');
    const labelBtn = document.querySelector('label[for="inputFoto"]');
    const textoOriginal = labelBtn ? labelBtn.innerHTML : '📷 Cambiar Foto';
    
    if (fotoImg) fotoImg.style.opacity = '0.5';
    if (labelBtn) labelBtn.innerHTML = '⏳ Subiendo...';
    
    const reader = new FileReader();
    reader.onload = function(event) {
        const img = new Image();
        img.onload = function() {
            // COMPRESIÓN DE LA IMAGEN
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 150; 
            const MAX_HEIGHT = 150;
            let width = img.width;
            let height = img.height;
            if (width > height) { if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; } } 
            else { if (height > MAX_HEIGHT) { width *= MAX_HEIGHT / height; height = MAX_HEIGHT; } }
            canvas.width = width; canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
            
            apiCall('jugador/foto', 'POST', { nombreJugador, base64data: dataUrl, mimeType: 'image/jpeg' })
            .then(res => {
                if(res.success || (res && !res.toString().includes("ERROR"))) {
                    if (fotoImg) { fotoImg.src = res.url || dataUrl; fotoImg.style.opacity = '1'; }
                    if (labelBtn) labelBtn.innerHTML = textoOriginal;
                    Swal.fire({ icon: 'success', title: 'Foto actualizada', toast: true, position: 'top-end', showConfirmButton: false, timer: 3000 });
                } else { throw new Error('Error devuelto por el servidor'); }
            }).catch(err => {
                if (fotoImg) fotoImg.style.opacity = '1';
                if (labelBtn) labelBtn.innerHTML = textoOriginal;
                Swal.fire('Error', 'Falla de conexión al subir foto: ' + err.message, 'error');
            });
        };
        img.src = event.target.result;
    };
    reader.onerror = function(error) {
        if (fotoImg) fotoImg.style.opacity = '1';
        if (labelBtn) labelBtn.innerHTML = textoOriginal;
        Swal.fire('Error', 'Hubo un problema leyendo el archivo', 'error');
    };
    reader.readAsDataURL(file);
}

function abrirCredencialVirtual() {
    Swal.fire({
      title: 'Buscador de Jugadores',
      input: 'text',
      inputLabel: 'Ingresa el nombre del jugador:',
      inputPlaceholder: 'Ej. Juan Perez',
      showCancelButton: true,
      confirmButtonText: 'Buscar',
      cancelButtonText: 'Cancelar'
    }).then((result) => {
      if (result.isConfirmed && result.value.trim() !== "") {
        let nombreBusqueda = result.value.trim();
        Swal.fire({ title: 'Buscando...', html: 'Rastreando credencial y movimientos.', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
        
        apiCall(`jugador/historial/${encodeURIComponent(nombreBusqueda)}`).then(datos => {
            renderizarModalCredencial(datos);
        }).catch(error => Swal.fire('Error', error.message, 'error'));
      }
    });
}
  
function verCredencial(nombreJugador) {
    Swal.fire({ title: 'Cargando...', html: 'Buscando la ficha de <b>' + nombreJugador + '</b>', allowOutsideClick: false, didOpen: () => { Swal.showLoading() } });
    apiCall(`jugador/historial/${encodeURIComponent(nombreJugador)}`).then(datos => {
        renderizarModalCredencial(datos);
    }).catch(error => Swal.fire('Error', error.message, 'error'));
}

function renderizarModalCredencial(datos) {
    let tablaHTML = `<div style="max-height: 200px; overflow-y: auto; margin-top: 15px;"><table style="width: 100%; font-size: 13px; text-align: left; border-collapse: collapse;"><thead style="background: #f1f1f1; position: sticky; top: 0;"><tr><th style="padding: 5px; border-bottom: 2px solid #ccc;">Fecha</th><th style="padding: 5px; border-bottom: 2px solid #ccc;">Acción</th><th style="padding: 5px; border-bottom: 2px solid #ccc;">Destino</th></tr></thead><tbody>`;
    if (datos.historial.length === 0) { tablaHTML += `<tr><td colspan="3" style="text-align:center; padding: 10px;">No hay registros previos.</td></tr>`; } 
    else { datos.historial.forEach(mov => { tablaHTML += `<tr><td style="padding: 5px; border-bottom: 1px solid #eee;">${mov.fecha}</td><td style="padding: 5px; border-bottom: 1px solid #eee;"><b>${mov.accion}</b></td><td style="padding: 5px; border-bottom: 1px solid #eee;">${mov.destino}</td></tr>`; }); }
    tablaHTML += `</tbody></table></div>`;
    
    let urlFoto = datos.fotoUrl ? datos.fotoUrl : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    let botonSubirFoto = "";
    
    if (typeof esAdminGlobal !== 'undefined' && typeof equipoActivoGlobal !== 'undefined') {
        if (esAdminGlobal || (equipoActivoGlobal !== "" && equipoActivoGlobal === datos.equipoActual)) {
            botonSubirFoto = `<div style="margin-top: 10px; margin-bottom: 5px;"><label for="inputFoto" style="cursor:pointer; background:#0284c7; color:white; padding:6px 12px; border-radius:5px; font-size:12px; font-weight:bold; display:inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">📷 Cambiar Foto</label><input type="file" id="inputFoto" accept="image/*" style="display:none;" onchange="procesarFoto('${datos.nombre}')"></div>`;
        }
    }
    
    Swal.fire({
      title: 'Credencial Virtual', width: '600px',
      html: `<div style="display: flex; flex-direction: column; align-items: center;"><img id="fotoCredencial" src="${urlFoto}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 5px;">${botonSubirFoto}<h2 style="margin: 5px 0 0 0; color: #1e293b;">${datos.nombre}</h2><p style="margin: 5px 0 15px 0; font-size: 16px; color: #475569;"><b>Equipo Actual:</b> <span style="color: #0284c7;">${datos.equipoActual}</span><br><b>Estatus:</b> <span style="background: #fef08a; padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #854d0e;">${datos.categoriaActual}</span></p><div style="width: 100%; border-top: 2px dashed #cbd5e1; padding-top: 15px;"><h4 style="margin: 0; color: #334155; text-align: left;">📖 Historial de Movimientos</h4>${tablaHTML}</div></div>`,
      confirmButtonText: 'Cerrar Credencial', confirmButtonColor: '#3085d6'
    });
}

// ==========================================
// LINEUPS
// ==========================================
function cargarCheckboxesRoster(eq) {
    apiCall('obtenerRosterParaLineup', 'POST', { equipo: eq }).then(j => {
        var html = ''; 
        j.forEach(jug => { 
            let idSafe = jug.replace(/[^a-zA-Z0-9]/g, '_');
            html += `<div style="background:#f4f4f4; padding:10px; border-radius:8px; border:1px solid #ddd; display:flex; flex-direction:column; align-items:center; text-align:center;">
              <label style="text-transform:capitalize; font-size:13px; font-weight:bold; margin-bottom:8px; display:flex; flex-direction:column; align-items:center; cursor:pointer;">
                <input type="checkbox" value="${jug}" class="chk-jugador" id="chk-${idSafe}" onchange="gestionarClicJugador(this, '${idSafe}')" style="transform:scale(1.4); margin-bottom:8px;"> 
                ${jug}
              </label>
              <select id="pos-${idSafe}" style="width:100%; padding:6px; font-size:12px; border-radius:4px; margin:0; border:1px solid #ccc; text-align:center;" disabled onchange="actualizarPizarraLineup()">
                <option value="">Posición...</option>
                <option value="1">1 (P)</option><option value="2">2 (C)</option><option value="3">3 (1B)</option>
                <option value="4">4 (2B)</option><option value="5">5 (3B)</option><option value="6">6 (SS)</option>
                <option value="7">7 (LF)</option><option value="8">8 (CF)</option><option value="9">9 (RF)</option>
                <option value="BD">BD</option>
              </select>
            </div>`; 
        });
        document.getElementById('contenedor-jugadores-lineup').innerHTML = html;
    }).catch(err => { document.getElementById('contenedor-jugadores-lineup').innerHTML = '<p>Error al cargar roster</p>'; });
}

function filtrarLineupsPorJornada() {
    let selJ = document.getElementById('lineup-jornada-selector').value;
    var selP = document.getElementById('equipo-select-partido'); 
    selP.innerHTML = '<option value="">Selecciona el partido...</option>'; 
    let esPrivilegiado = esAdminGlobal || equipoActivoGlobal.toUpperCase() === "ANOTADOR";
    let nombreCriterio = esPrivilegiado ? document.getElementById('admin-select-equipo').value : equipoActivoGlobal;
    todosLosPartidos.forEach(p => { 
        let j = p[6]?p[6].trim():"";
        if(selJ === "TODAS" || selJ === j) {
            if (esPrivilegiado || p[3]===nombreCriterio || p[4]===nombreCriterio) {
                selP.innerHTML += `<option value="${p[0]} ${p[1]} | ${p[3]} vs ${p[4]}">${p[0]} ${p[1]} | ${p[3]} vs ${p[4]}</option>`; 
            }
        }
    });
    lineupSeleccionado = []; ordenJugadoresClic = []; actualizarPizarraLineup();
    document.querySelectorAll('.chk-jugador').forEach(cb => { cb.checked = false; let sel = document.getElementById('pos-' + cb.id.substring(4)); if(sel) sel.disabled = true; }); 
}

function verificarLineupGuardado() {
    var partido = document.getElementById('equipo-select-partido').value; 
    var btn = document.getElementById('btn-enviar-lineup');
    document.querySelectorAll('.chk-jugador').forEach(cb => { 
       cb.checked = false; let sel = document.getElementById('pos-' + cb.id.substring(4)); if(sel) sel.disabled = true; 
    }); 
    lineupSeleccionado = []; ordenJugadoresClic = []; actualizarPizarraLineup();
    btn.innerText = "Enviar Lineup Oficial"; btn.style.backgroundColor = "#1a237e"; btn.disabled = false;
    let esPrivilegiado = esAdminGlobal || equipoActivoGlobal.toUpperCase() === "ANOTADOR";
    let eqBuscado = esPrivilegiado ? document.getElementById('admin-select-equipo').value : equipoActivoGlobal;
    if (partido === "" || eqBuscado === "") return; 
    let expirado = juegoExpirado(partido);
    document.getElementById('vista-orden-bateo').innerHTML = '<p style="color:#aaa; text-align:center;">Buscando si enviaste uno...</p>';
    
    apiCall('obtenerLineupExistente', 'POST', { partido, eqBuscado }).then(exist => {
        if (exist && exist.length > 0) { 
            ordenJugadoresClic = []; 
            exist.forEach(j => {
                let match = j.match(/^(.*?)\s*(?:\(([^)]+)\))?$/);
                if(match) {
                   let nom = match[1].trim(); let pos = match[2] || ""; let idSafe = nom.replace(/[^a-zA-Z0-9]/g, '_');
                   let cb = document.getElementById('chk-' + idSafe);
                   if(cb) { cb.checked = true; let sel = document.getElementById('pos-' + idSafe); if(sel) { sel.disabled = false; sel.value = pos; } ordenJugadoresClic.push(nom); }
                }
            }); 
            btn.innerText = "⚾ Actualizar Lineup"; btn.style.backgroundColor = "#f57c00"; 
        }
        actualizarPizarraLineup();   
        if (expirado && !esPrivilegiado) { 
            btn.innerText = "⏳ Tiempo Expirado"; btn.disabled = true; document.getElementById('vista-orden-bateo').innerHTML += '<p style="color:#d32f2f; font-weight:bold; font-size:12px; text-align:center; margin-top:10px;">El juego inició hace más de 10 minutos. No se puede modificar el roster.</p>'; 
        }
    }).catch(err => { document.getElementById('vista-orden-bateo').innerHTML = '<p>Error de carga</p>'; });
}

function gestionarClicJugador(checkbox, idSafe) { 
    let sel = document.getElementById('pos-' + idSafe); 
    sel.disabled = !checkbox.checked; 
    if(!checkbox.checked) { sel.value = ""; ordenJugadoresClic = ordenJugadoresClic.filter(n => n !== checkbox.value); } 
    else { if(!ordenJugadoresClic.includes(checkbox.value)) { ordenJugadoresClic.push(checkbox.value); } }
    actualizarPizarraLineup(); 
}

function actualizarPizarraLineup() { 
    var vista = document.getElementById('vista-orden-bateo'); 
    lineupSeleccionado = [];
    if(ordenJugadoresClic.length === 0) { vista.innerHTML = '<p style="color:#aaa; text-align:center; margin:0;">Pizarra vacía.</p>'; return; } 
    var html = '<ol style="margin:0; padding-left:25px; font-weight:500; font-size:0.9em; text-transform:capitalize;">'; 
    ordenJugadoresClic.forEach(nom => {
        let idSafe = nom.replace(/[^a-zA-Z0-9]/g, '_');
        let sel = document.getElementById('pos-' + idSafe); let pos = sel ? sel.value : "";
        let txtMostrar = pos ? `${nom} <b style="color:#e65100;">(${pos})</b>` : nom; 
        let txtGuardar = pos ? `${nom} (${pos})` : nom;
        html += `<li>${txtMostrar}</li>`; lineupSeleccionado.push(txtGuardar);
    }); 
    vista.innerHTML = html + '</ol>'; 
} 

function juegoExpirado(partidoInfo) {
    let p = todosLosPartidos.find(x => `${x[0]} ${x[1]} | ${x[3]} vs ${x[4]}` === partidoInfo);
    if(!p) return false; let fStr = p[0]; let hStr = p[1]; if (!fStr) return false;
    let gameDate = parseGameDate(fStr, hStr);
    if(!gameDate) return false;
    gameDate.setMinutes(gameDate.getMinutes() + 20); 
    return new Date() > gameDate;
}

function enviarLineup() {
    var partido = document.getElementById('equipo-select-partido').value;
    let esPrivilegiado = esAdminGlobal || equipoActivoGlobal.toUpperCase() === "ANOTADOR";
    let eqBuscado = esPrivilegiado ? document.getElementById('admin-select-equipo').value : equipoActivoGlobal;
    if(esPrivilegiado) { if(eqBuscado === "") { Swal.fire("Selecciona a qué equipo le estás registrando el lineup arriba en el menú de ADMIN/ANOTADOR."); return; } }
    if(partido === "") { Swal.fire("Selecciona un partido primero."); return; }
    if(lineupSeleccionado.length === 0) { if(!confirm("⚠️ Estás a punto de guardar un roster VACÍO. Esto borrará el lineup anterior. ¿Seguro?")) return; }
    if (juegoExpirado(partido) && !esPrivilegiado) { Swal.fire("El tiempo de tolerancia (10 min) ha expirado."); return; } 
    
    var btn = document.getElementById('btn-enviar-lineup'); btn.innerText = "Guardando..."; btn.disabled = true;
    
    apiCall('guardarLineupDia', 'POST', { partido, eqBuscado, lineupSeleccionado }).then(res => { 
        btn.innerText = "✅ Guardado"; btn.disabled = false; 
    }).catch(err => { Swal.fire('Error', 'Falla al guardar', 'error'); btn.innerText = "Reintentar"; btn.disabled = false; });
}

// ==========================================
// SCOREBOOK Y ANOTADOR
// ==========================================
function llenarSelectorAnotador() {
    var selJ = document.getElementById('select-jornada-anotador'); var selP = document.getElementById('select-partido-anotador');
    if(!todosLosPartidos || todosLosPartidos.length === 0) { selJ.innerHTML = '<option value="">No hay jornadas</option>'; selP.innerHTML = '<option value="">No hay partidos</option>'; return; }
    let jUnicas = []; todosLosPartidos.forEach(p => { let j = p[6]?p[6].trim():""; if(j!=="" && !jUnicas.includes(j)) jUnicas.push(j); });
    jUnicas.sort((a, b) => { let numA = parseInt(a.replace(/\D/g, '')); let numB = parseInt(b.replace(/\D/g, '')); if(!isNaN(numA) && !isNaN(numB)) return numA - numB; if(!isNaN(numA)) return -1; if(!isNaN(numB)) return 1; return a.localeCompare(b); });
    selJ.innerHTML = '<option value="TODAS">Mostrar Todas las Jornadas</option>'; jUnicas.forEach(j => selJ.innerHTML += `<option value="${j}">${j}</option>`);
    filtrarJuegosAnotador();
}

function filtrarJuegosAnotador() {
    var selJ = document.getElementById('select-jornada-anotador').value; var selP = document.getElementById('select-partido-anotador');
    selP.innerHTML = '<option value="">Selecciona el partido...</option>';
    var filt = (selJ === "TODAS" || selJ === "") ? todosLosPartidos : todosLosPartidos.filter(p => (p[6]?p[6].trim():"") === selJ);
    filt.forEach(p => { let info = `${p[0]} ${p[1]} | ${p[3]} vs ${p[4]}`; selP.innerHTML += `<option value="${info}" data-loc="${p[3]}" data-vis="${p[4]}">${info}</option>`; });
    document.getElementById('area-scorebook').style.display='none'; document.getElementById('msj-anotador').innerText = "";
}

function cargarPartidoAnotador() {
    var sel = document.getElementById('select-partido-anotador');
    if(sel.value === "") { document.getElementById('area-scorebook').style.display='none'; return; }
    infoPartidoActivo.info = sel.value; infoPartidoActivo.equipoLocal = sel.options[sel.selectedIndex].getAttribute('data-loc'); infoPartidoActivo.equipoVisita = sel.options[sel.selectedIndex].getAttribute('data-vis');
    document.getElementById('msj-anotador').innerText = "Cargando Scorebook..."; document.getElementById('area-scorebook').style.display = 'none';
    
    let btnFin = document.getElementById('btn-finalizar-juego');
    let esInvitado = (equipoActivoGlobal === ""); 
    let esPrivilegiado = esAdminGlobal || equipoActivoGlobal.toUpperCase() === "ANOTADOR";
    if (esInvitado) { btnFin.style.display = "none"; } 
    else {
        btnFin.style.display = "block"; 
        let pCheck = todosLosPartidos.find(x => `${x[0]} ${x[1]} | ${x[3]} vs ${x[4]}` === sel.value);
        if (pCheck && pCheck[7] !== "" && pCheck[8] !== "") {
           if (!esPrivilegiado) { btnFin.innerText = "🔒 Juego Finalizado"; btnFin.disabled = true; btnFin.style.backgroundColor = "#9e9e9e"; } 
           else { btnFin.innerText = "🔄 Actualizar Marcador Oficial"; btnFin.disabled = false; btnFin.style.backgroundColor = "#d32f2f"; }
        } else { btnFin.innerText = "🏁 Finalizar Juego"; btnFin.disabled = false; btnFin.style.backgroundColor = "#d32f2f"; }
    }
    
    apiCall('obtenerLineupsParaAnotador', 'POST', { partidoInfo: sel.value, local: infoPartidoActivo.equipoLocal, visita: infoPartidoActivo.equipoVisita }).then(res => {
        if (esInvitado) {
            document.getElementById('msj-anotador').innerText = "👁️ MODO OBSERVADOR"; document.getElementById('msj-anotador').style.color = "#ff9800"; document.getElementById('msj-anotador').style.fontWeight = "bold";
        } else { document.getElementById('msj-anotador').innerText = ""; }
        document.getElementById('area-scorebook').style.display = 'block';
        document.getElementById('tab-visitante').innerText = (infoPartidoActivo.equipoVisita || "VISITANTE").toUpperCase(); 
        document.getElementById('tab-local').innerText = (infoPartidoActivo.equipoLocal || "LOCAL").toUpperCase();
        document.getElementById('lbl-visita').innerText = (infoPartidoActivo.equipoVisita || "VISITANTE").toUpperCase(); 
        document.getElementById('lbl-local').innerText = (infoPartidoActivo.equipoLocal || "LOCAL").toUpperCase();
        rostersScorebook.visitante = res.visitante || []; rostersScorebook.local = res.local || [];
        rosterCompletoGlobal.visitante = res.rosterCompletoVisitante || []; rosterCompletoGlobal.local = res.rosterCompletoLocal || [];   
        datosScorebook.visitante = expandirMemoria(res.scorebookVisitante, Math.max(rostersScorebook.visitante.length, 12)); datosScorebook.local = expandirMemoria(res.scorebookLocal, Math.max(rostersScorebook.local.length, 12));
        generarCuadricula('tbody-visitante', rostersScorebook.visitante, 'visitante'); generarCuadricula('tbody-local', rostersScorebook.local, 'local');
        infoPartidoActivo.equipoAnotando = infoPartidoActivo.equipoVisita; calcularMarcadorEnVivo();
    }).catch(err => { document.getElementById('msj-anotador').innerText = "Error cargando juego."; });
}

function calcularMarcadorEnVivo() {
    let rV = 0, rL = 0;
    datosScorebook.visitante.forEach(j => j.forEach(inn => { if(inn.hr) rV++; })); datosScorebook.local.forEach(j => j.forEach(inn => { if(inn.hr) rL++; }));
    document.getElementById('marcador-en-vivo').innerText = `${rV} - ${rL}`; return { rV, rL };
}

function finalizarJuegoDesdeAnotador() {
    let scores = calcularMarcadorEnVivo();
    let pitcherAuto = "";
    if (scores.rV !== scores.rL) {
        let ganadorLado = scores.rV > scores.rL ? 'visitante' : 'local';
        let rosterG = rostersScorebook[ganadorLado];
        if (rosterG) {
            for (let i=0; i<rosterG.length; i++) {
                if (rosterG[i].includes("(1)") || rosterG[i].includes("(P)")) {
                    let pName = rosterG[i].replace(/\s*\([^)]*\)$/, '').trim();
                    if (pName.includes('/')) { let parts = pName.split('/'); pName = parts[parts.length - 1].trim(); }
                    pitcherAuto = pName; break;
                }
            }
        }
    }
    let pG = prompt("Confirma o escribe el nombre del Pitcher Ganador).", pitcherAuto);
    if(pG === null) return; 
    let msg = `¿Deseas FINALIZAR el juego y subir este resultado oficial?\n\n${infoPartidoActivo.equipoVisita}: ${scores.rV} carreras\n${infoPartidoActivo.equipoLocal}: ${scores.rL} carreras\n\nLas Posiciones se actualizarán automáticamente.`;
    if (!confirm(msg)) return;  
    
    let btn = document.getElementById('btn-finalizar-juego'); btn.innerText = "Subiendo resultado..."; btn.disabled = true;
    
    apiCall('finalizarJuegoAnotador', 'POST', { info: infoPartidoActivo.info, rV: scores.rV, rL: scores.rL, pG }).then(res => {
        btn.innerText = "✅ ¡Juego Finalizado y Stats Actualizadas!"; 
        setTimeout(() => { 
           let esPrivilegiado = esAdminGlobal || equipoActivoGlobal.toUpperCase() === "ANOTADOR";
           if(esPrivilegiado) { btn.innerText = "🔄 Actualizar Marcador Oficial"; btn.disabled = false; }
           else { btn.innerText = "🔒 Juego Finalizado"; btn.disabled = true; btn.style.backgroundColor = "#9e9e9e"; }
        }, 3000);
        apiCall('obtenerProximosPartidos').then(p => { todosLosPartidos = p || []; mostrarPartidos(todosLosPartidos); });
        apiCall('obtenerPosiciones').then(pos => { todasLasPosiciones = pos || []; mostrarPosiciones(todasLasPosiciones); });
    }).catch(err => { Swal.fire('Error', 'Falla finalizando', 'error'); btn.innerText = "🏁 Finalizar Juego"; btn.disabled = false; });
}

function generarMemoriaVacia(jugadores) { let lista = []; let max = jugadores ? Math.max(jugadores.length, 12) : 12; for(let i=0; i<max; i++) { let filaInnings = []; for(let inn=0; inn<10; inn++) filaInnings.push({text:'', b1:false, b2:false, b3:false, hr:false, out: 0}); lista.push(filaInnings); } return lista; }
function expandirMemoria(datosViejos, maxJug) { let memVacia = generarMemoriaVacia(Array(maxJug)); for(let i=0; i<maxJug; i++) { for(let j=0; j<10; j++) { if(datosViejos && datosViejos[i] && datosViejos[i][j]) { memVacia[i][j] = datosViejos[i][j]; if(memVacia[i][j].out === undefined) memVacia[i][j].out = 0; } } } return memVacia; }

function cambiarTabAnotador(lado) {
    document.getElementById('tab-visitante').classList.remove('activa'); document.getElementById('tab-local').classList.remove('activa');
    document.getElementById('book-visitante').style.display = 'none'; document.getElementById('book-local').style.display = 'none';
    document.getElementById('tab-' + lado).classList.add('activa'); document.getElementById('book-' + lado).style.display = 'block';
    infoPartidoActivo.equipoAnotando = (lado === 'visitante') ? infoPartidoActivo.equipoVisita : infoPartidoActivo.equipoLocal;
}

function generarCuadricula(idTbody, jugadores, lado) {
    var tbody = document.getElementById(idTbody); tbody.innerHTML = ''; let maxJugadores = Math.max(jugadores.length, 12);
    let out3PorInning = []; for(let inn=0; inn<10; inn++) { out3PorInning[inn] = -1; for(let i=0; i<maxJugadores; i++) { if(datosScorebook[lado][i][inn] && datosScorebook[lado][i][inn].out === 3) { out3PorInning[inn] = i; break; } } }
    let inicioInning = []; inicioInning[0] = 0; for(let inn=0; inn<9; inn++) { if(out3PorInning[inn] !== -1) { inicioInning[inn+1] = (out3PorInning[inn] + 1) % maxJugadores; } }
    let esInvitado = (equipoActivoGlobal === "");
    for(let i=0; i < maxJugadores; i++) {
        let nombre = jugadores[i] || ""; let tr = document.createElement('tr'); 
        let tdNum = document.createElement('td'); tdNum.className = 'col-num'; tdNum.innerText = i+1; tr.appendChild(tdNum);
        let tdJug = document.createElement('td'); tdJug.className = 'col-jugador'; tdJug.style.textTransform = 'capitalize';
        if(nombre !== "") {
           if(!esInvitado) {
               tdJug.style.cursor = 'pointer'; tdJug.title = "Haz clic para registrar un cambio de jugador";
               tdJug.onclick = function() { abrirModalCambio(lado, i, nombre); };
           } else { tdJug.style.cursor = 'default'; }
           tdJug.innerHTML = nombre.split('/').map(n => n.trim()).join('<br><span style="color:#e65100; font-size:10px;">⬇</span> ');
        } else { tdJug.innerText = nombre; }
        tr.appendChild(tdJug);
        for(let inn=1; inn<=10; inn++) {
            let td = document.createElement('td');
            if(nombre !== "") {
                let memoriaCelda = datosScorebook[lado][i][inn-1]; let colorTexto = (memoriaCelda.text.includes('K') || memoriaCelda.text.includes('-') || memoriaCelda.text.includes('DP') || memoriaCelda.text.includes('F')) ? '#e53935' : '#1a237e';
                let outHtml = memoriaCelda.out > 0 ? `<div class="out-circle">${memoriaCelda.out}</div>` : ''; let finHtml = memoriaCelda.out === 3 ? `<div class="fin-entrada"></div>` : ''; let iniciaHtml = (inicioInning[inn-1] === i && inn > 1) ? `<div class="inicia-flecha">▶</div>` : '';
                let bloqueadaClass = (out3PorInning[inn-1] !== -1 && i > out3PorInning[inn-1]) ? 'celda-bloqueada' : ''; let iniciaClass = (inicioInning[inn-1] === i && inn > 1) ? 'inicia-entrada' : '';
                td.className = `${bloqueadaClass} ${iniciaClass}`; 
                if(!esInvitado) { td.onclick = function() { abrirModal(this, nombre, inn, lado, i); }; } else { td.style.cursor = 'default'; }       
                td.innerHTML = `${iniciaHtml}<svg class="diamante-svg" viewBox="0 0 100 100"><polygon class="run-fill ${memoriaCelda.hr?'active':''}" points="50,85 85,50 50,15 15,50" /><path class="base-path b1 ${memoriaCelda.b1?'active':''}" d="M50,85 L85,50" /><path class="base-path b2 ${memoriaCelda.b2?'active':''}" d="M85,50 L50,15" /><path class="base-path b3 ${memoriaCelda.b3?'active':''}" d="M50,15 L15,50" /><path class="base-path b4 ${memoriaCelda.hr?'active':''}" d="M15,50 L50,85" /></svg><span class="texto-jugada" style="color:${colorTexto}">${memoriaCelda.text}</span>${outHtml} ${finHtml}`;
            }
            tr.appendChild(td);
        }
        tbody.appendChild(tr);
    }
}

function abrirModalCambio(lado, i, nombreActual) {
    cambioActivo = { lado: lado, indice: i, nombreAnterior: nombreActual };
    document.getElementById('txt-jugador-sale').innerText = "Sale: " + nombreActual;
    let sel = document.getElementById('select-sustituto'); sel.innerHTML = '<option value="">Selecciona al sustituto...</option>';
    let enUso = rostersScorebook[lado].map(j => j.split('/').map(n => n.replace(/\s*\([^)]*\)$/, '').trim().toLowerCase())).flat();
    let rosterC = rosterCompletoGlobal[lado] || [];
    let disponibles = rosterC.filter(j => !enUso.includes(j.trim().toLowerCase()));
    if (disponibles.length === 0) { sel.innerHTML += '<option value="" disabled>No hay banca disponible</option>'; } 
    else { disponibles.forEach(j => { sel.innerHTML += `<option value="${j}">${j}</option>`; }); }
    document.getElementById('modal-cambio').style.display = 'block';
}

function cerrarModalCambio() { document.getElementById('modal-cambio').style.display = 'none'; }
function guardarCambioJugador() {
    let sustituto = document.getElementById('select-sustituto').value;
    if(!sustituto) { Swal.fire("Selecciona un jugador del menú."); return; }
    let nombreNuevoCompleto = cambioActivo.nombreAnterior + " / " + sustituto;
    rostersScorebook[cambioActivo.lado][cambioActivo.indice] = nombreNuevoCompleto;
    cerrarModalCambio(); sincronizarConExcel(cambioActivo.lado);
    generarCuadricula(`tbody-${cambioActivo.lado}`, rostersScorebook[cambioActivo.lado], cambioActivo.lado);
}

function abrirModal(celda, jugador, inning, lado, jugadorIndex) {
    celdaActiva = celda; indicesActivos = { equipo: lado, jugador: jugadorIndex, inning: inning-1 };
    document.getElementById('modal-titulo').innerText = jugador; document.getElementById('modal-subtitulo').innerText = `Registrando Inning ${inning}`;
    let memoriaCelda = datosScorebook[lado][jugadorIndex][inning-1]; basesActivas = { b1: memoriaCelda.b1, b2: memoriaCelda.b2, b3: memoriaCelda.b3, hr: memoriaCelda.hr };
    outActivo = memoriaCelda.out || 0; setOut(outActivo); document.getElementById('input-jugada').value = memoriaCelda.text; actualizarUIBases(); document.getElementById('modal-jugada').style.display = 'block';
    setTimeout(() => document.getElementById('input-jugada').focus(), 100); 
}

function setOut(num) { outActivo = num; document.querySelectorAll('.btn-out').forEach(b => b.classList.remove('activa')); document.getElementById('btn-out-' + num).classList.add('activa'); }
function toggleBase(num) { if(num === 1) { basesActivas.b1 = !basesActivas.b1; } if(num === 2) { basesActivas.b1 = true; basesActivas.b2 = !basesActivas.b2; } if(num === 3) { basesActivas.b1 = true; basesActivas.b2 = true; basesActivas.b3 = !basesActivas.b3; } if(num === 4) { let est = !basesActivas.hr; basesActivas.b1=est; basesActivas.b2=est; basesActivas.b3=est; basesActivas.hr=est; } actualizarUIBases(); }
function actualizarUIBases() { document.getElementById('btn-1b').className = 'btn-base ' + (basesActivas.b1 ? 'activa' : ''); document.getElementById('btn-2b').className = 'btn-base ' + (basesActivas.b2 ? 'activa' : ''); document.getElementById('btn-3b').className = 'btn-base ' + (basesActivas.b3 ? 'activa' : ''); document.getElementById('btn-hr').className = 'btn-base ' + (basesActivas.hr ? 'activa' : ''); }
function escribirJugada(txt) { document.getElementById('input-jugada').value = txt; if(txt === '1B') toggleBase(1); if(txt === '2B') toggleBase(2); if(txt === '3B') toggleBase(3); if(txt === 'HR') toggleBase(4); }

function guardarJugada() {
    if(!celdaActiva) return; let txt = document.getElementById('input-jugada').value.toUpperCase();
    datosScorebook[indicesActivos.equipo][indicesActivos.jugador][indicesActivos.inning] = { text: txt, b1: basesActivas.b1, b2: basesActivas.b2, b3: basesActivas.b3, hr: basesActivas.hr, out: outActivo };
    cerrarModal(); generarCuadricula(`tbody-${indicesActivos.equipo}`, rostersScorebook[indicesActivos.equipo], indicesActivos.equipo); calcularMarcadorEnVivo(); sincronizarConExcel(indicesActivos.equipo);
}

function limpiarCelda() {
    if(!celdaActiva) return; datosScorebook[indicesActivos.equipo][indicesActivos.jugador][indicesActivos.inning] = {text:'', b1:false, b2:false, b3:false, hr:false, out: 0};
    cerrarModal(); generarCuadricula(`tbody-${indicesActivos.equipo}`, rostersScorebook[indicesActivos.equipo], indicesActivos.equipo); calcularMarcadorEnVivo(); sincronizarConExcel(indicesActivos.equipo);
}
function cerrarModal() { document.getElementById('modal-jugada').style.display = 'none'; celdaActiva = null; }

function sincronizarConExcel(lado) {
    if (!lado) { if (indicesActivos && indicesActivos.equipo) lado = indicesActivos.equipo; else lado = document.getElementById('tab-visitante').classList.contains('activa') ? 'visitante' : 'local'; }
    let toast = document.getElementById('toast-guardando'); toast.style.display = 'block'; 
    let datosAEnviar = datosScorebook[lado]; let rosterAEnviar = rostersScorebook[lado]; let equipoAnotandoReal = lado === 'visitante' ? infoPartidoActivo.equipoVisita : infoPartidoActivo.equipoLocal;
    
    apiCall('guardarScorebookEnExcel', 'POST', { info: infoPartidoActivo.info, equipoAnotandoReal, datosAEnviar, rosterAEnviar }).then(res => {
        if(res === "OK") setTimeout(() => { toast.style.display = 'none'; }, 2000);
        else throw new Error();
    }).catch(err => { 
        toast.innerText = "❌ Error al guardar en Excel"; toast.style.backgroundColor = "#d32f2f"; 
        setTimeout(() => { toast.style.display = 'none'; toast.innerText = "💾 Guardado en Excel"; toast.style.backgroundColor = "#2e7d32"; }, 3000); 
    });
}

// ==========================================
// PLANTILLAS
// ==========================================
function prepararSelectorPlantillas() {
    const select = document.getElementById('select-equipo-plantilla');
    if (!select) return;
    select.innerHTML = '<option value="">Selecciona un equipo...</option>';
    
    apiCall('obtenerEquipos').then(equipos => {
        let unicos = [];
        equipos.forEach(eq => { 
            let nombreEquipo = eq[1]; 
            if(nombreEquipo && !unicos.includes(nombreEquipo) && nombreEquipo !== "AGENCIA LIBRE") {
                unicos.push(nombreEquipo); 
            }
        });
        let draftOption = document.createElement('option'); draftOption.value = "AGENCIA LIBRE"; draftOption.text = "🔥 DRAFT / AGENCIA LIBRE"; draftOption.style.fontWeight = "bold"; select.appendChild(draftOption);
        unicos.sort().forEach(nombre => { let option = document.createElement('option'); option.value = nombre; option.text = nombre; select.appendChild(option); });   
    }).catch(console.error);
}

function mostrarJugadoresPlantilla() {
    const equipo = document.getElementById('select-equipo-plantilla').value;
    const contenedor = document.getElementById('lista-jugadores-plantilla');
    if (!equipo) { contenedor.innerHTML = ""; return; }
    contenedor.innerHTML = '<p style="text-align:center; color:#999;">Consultando lista...</p>';
    
    apiCall('obtenerRosterParaLineup', 'POST', { equipo }).then(jugadores => {
        if (!jugadores || jugadores.length === 0) { contenedor.innerHTML = "<p style='text-align:center; color:red;'>No hay jugadores registrados en este equipo.</p>"; return; }
        let html = `<table style="width:100%; border-collapse: collapse; background: #fff; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 5px rgba(0,0,0,0.05);"><thead style="background: #f1f3f4; color: #5f6368; font-size: 12px; text-transform: uppercase;"><tr><th style="padding: 12px; text-align: left; width: 40px;">#</th><th style="padding: 12px; text-align: left;">Nombre del Jugador</th></tr></thead><tbody>`;
        jugadores.forEach((jugador, i) => {
            html += `<tr style="border-bottom: 1px solid #f1f1f1;"><td style="padding: 10px; color: #aaa; font-weight: bold;">${i + 1}</td><td onclick="verCredencial('${jugador}')" style="padding: 10px; font-weight: 500; color: #0284c7; cursor: pointer;">${jugador}</td></tr>`;
        });
        html += "</tbody></table>";
        contenedor.innerHTML = html;
    }).catch(err => { contenedor.innerHTML = "<p>Error de carga</p>"; });
}