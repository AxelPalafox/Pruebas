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
      Swal.fire({
        title: 'Buscando...',
        html: 'Rastreando credencial y movimientos.',
        allowOutsideClick: false,
        didOpen: () => { Swal.showLoading() }
      });
      
      // REEMPLAZO DE google.script.run
      fetch(`${API_URL}/api/jugador/historial/${encodeURIComponent(nombreBusqueda)}`)
        .then(response => {
            if (!response.ok) throw new Error('Jugador no encontrado');
            return response.json();
        })
        .then(datos => {
            renderizarModalCredencial(datos);
        })
        .catch(error => {
            Swal.fire('Error', error.message, 'error');
        });
    }
  });
}

function verCredencial(nombreJugador) {
  Swal.fire({
    title: 'Cargando...',
    html: 'Buscando la ficha de <b>' + nombreJugador + '</b>',
    allowOutsideClick: false,
    didOpen: () => { Swal.showLoading() }
  });
  
  // REEMPLAZO DE google.script.run
  fetch(`${API_URL}/api/jugador/historial/${encodeURIComponent(nombreJugador)}`)
    .then(response => {
        if (!response.ok) throw new Error('Falla en el servidor o jugador no encontrado');
        return response.json();
    })
    .then(datos => {
        renderizarModalCredencial(datos);
    })
    .catch(error => {
        Swal.fire('Error', error.message, 'error');
    });
}

// Función auxiliar para no repetir código visual (usada en abrirCredencial y verCredencial)
function renderizarModalCredencial(datos) {
    let tablaHTML = `<div style="max-height: 200px; overflow-y: auto; margin-top: 15px;">
                      <table style="width: 100%; font-size: 13px; text-align: left; border-collapse: collapse;">
                        <thead style="background: #f1f1f1; position: sticky; top: 0;">
                          <tr>
                            <th style="padding: 5px; border-bottom: 2px solid #ccc;">Fecha</th>
                            <th style="padding: 5px; border-bottom: 2px solid #ccc;">Acción</th>
                            <th style="padding: 5px; border-bottom: 2px solid #ccc;">Destino</th>
                          </tr>
                        </thead>
                        <tbody>`;
    if (datos.historial.length === 0) {
      tablaHTML += `<tr><td colspan="3" style="text-align:center; padding: 10px;">No hay registros previos.</td></tr>`;
    } else {
      datos.historial.forEach(mov => {
        tablaHTML += `<tr>
                        <td style="padding: 5px; border-bottom: 1px solid #eee;">${mov.fecha}</td>
                        <td style="padding: 5px; border-bottom: 1px solid #eee;"><b>${mov.accion}</b></td>
                        <td style="padding: 5px; border-bottom: 1px solid #eee;">${mov.destino}</td>
                      </tr>`;
      });
    }
    tablaHTML += `</tbody></table></div>`;
    
    let urlFoto = datos.fotoUrl ? datos.fotoUrl : "https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png";
    let botonSubirFoto = "";
    
    if (typeof esAdminGlobal !== 'undefined' && typeof equipoActivoGlobal !== 'undefined') {
        if (esAdminGlobal || (equipoActivoGlobal !== "" && equipoActivoGlobal === datos.equipoActual)) {
            botonSubirFoto = `
                <div style="margin-top: 10px; margin-bottom: 5px;">
                    <label for="inputFoto" style="cursor:pointer; background:#0284c7; color:white; padding:6px 12px; border-radius:5px; font-size:12px; font-weight:bold; display:inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                        📷 Cambiar Foto
                    </label>
                    <input type="file" id="inputFoto" accept="image/*" style="display:none;" onchange="procesarFoto('${datos.nombre}')">
                </div>
            `;
        }
    }
    
    Swal.fire({
      title: 'Credencial Virtual',
      width: '600px',
      html: `
        <div style="display: flex; flex-direction: column; align-items: center;">
          <img id="fotoCredencial" src="${urlFoto}" style="width: 100px; height: 100px; border-radius: 50%; object-fit: cover; border: 3px solid #cbd5e1; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-bottom: 5px;">
          ${botonSubirFoto}
          <h2 style="margin: 5px 0 0 0; color: #1e293b;">${datos.nombre}</h2>
          <p style="margin: 5px 0 15px 0; font-size: 16px; color: #475569;">
            <b>Equipo Actual:</b> <span style="color: #0284c7;">${datos.equipoActual}</span><br>
            <b>Estatus:</b> <span style="background: #fef08a; padding: 2px 8px; border-radius: 10px; font-size: 12px; color: #854d0e;">${datos.categoriaActual}</span>
          </p>   
          <div style="width: 100%; border-top: 2px dashed #cbd5e1; padding-top: 15px;">
            <h4 style="margin: 0; color: #334155; text-align: left;">📖 Historial de Movimientos</h4>
            ${tablaHTML}
          </div>
        </div>
      `,
      confirmButtonText: 'Cerrar Credencial',
      confirmButtonColor: '#3085d6'
    });
}

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
    reader.onloadend = function() {
        const base64data = reader.result;
        const mimeType = file.type;
        
        // REEMPLAZO DE google.script.run
        fetch(`${API_URL}/api/jugador/foto`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ nombreJugador, base64data, mimeType })
        })
        .then(response => response.json())
        .then(res => {
            if(res.success) {
                if (fotoImg) {
                    fotoImg.src = res.url; // Asigna el base64 directamente
                    fotoImg.style.opacity = '1';
                }
                if (labelBtn) labelBtn.innerHTML = textoOriginal;
                Swal.fire({
                    icon: 'success', 
                    title: 'Foto actualizada', 
                    toast: true, 
                    position: 'top-end', 
                    showConfirmButton: false, 
                    timer: 3000
                });
            } else {
                throw new Error('No se guardó correctamente');
            }
        })
        .catch(err => {
            Swal.fire('Error', 'Falla de conexión al subir foto: ' + err.message, 'error');
            if (fotoImg) fotoImg.style.opacity = '1';
            if (labelBtn) labelBtn.innerHTML = textoOriginal;
        });
    };
    reader.readAsDataURL(file);
}
