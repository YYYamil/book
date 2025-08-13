// Configuración global
const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbz6U2YrFxatwQF4h-YKBgeL0RrXIV4Pp77Mx_X7cj7q0Id9wz3JXkew-KlLYdR1y7Ej/exec",
  meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  diasSemana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  diasSemanaCortos: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
};

function toFullName(albergueKey) {
  switch (albergueKey) {
    case 'maestro':  return 'Maestro José Fierro';
    case 'tinku':    return 'Tinku Huasi';
    case 'aquilina': return 'Aquilina Soldati';
    default:         return albergueKey; // fallback por si ya viene el nombre completo
  }
}


// Estado del calendario para cada albergue
const estadoCalendario = {
  maestro: { mes: new Date().getMonth(), año: new Date().getFullYear() },
  tinku: { mes: new Date().getMonth(), año: new Date().getFullYear() },
  aquilina: { mes: new Date().getMonth(), año: new Date().getFullYear() }
};

// Cache de fechas ocupadas (se actualizará desde Google Sheets)
let fechasOcupadas = {
  maestro: [],
  tinku: [],
  aquilina: []
};

// Capacidades de los albergues
const capacidades = {
  maestro: 92,
  tinku: 49,
  aquilina: 58
};

// Ocupación actual (se actualizará desde Google Sheets)
let ocupacionActual = {
  maestro: 0,
  tinku: 0,
  aquilina: 0
};

// Estado para prevenir envíos dobles
const formSubmissionState = {
  maestro: { isSubmitting: false },
  tinku: { isSubmitting: false },
  aquilina: { isSubmitting: false }
};

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {

  document.querySelectorAll('.glide').forEach(el => {
    if (!window.Glide) {
      console.warn('Glide.js no está cargado');
      return;
    }
    new Glide(el, {
      type: 'carousel',
      perView: 1,
      autoplay: 4000,     // 4s
      hoverpause: true,   // pausa al pasar el mouse (mejor UX)
      animationDuration: 600,
      gap: 0
    }).mount();
  });

  
  setMinDates();
  setupDateListeners();
  setupFormListeners();
});

// Funciones para manejar modales
function openModal(albergue) {
  console.log(`Abriendo modal para ${albergue}`);
  document.getElementById(`modal-${albergue}`).classList.add('active');
  document.body.style.overflow = 'hidden';
  resetForm(albergue); // Reset form when opening modal
  generarCalendario(albergue);
}

function closeModal(albergue) {
  console.log(`Cerrando modal para ${albergue}`);
  document.getElementById(`modal-${albergue}`).classList.remove('active');
  document.body.style.overflow = 'auto';
  resetForm(albergue); // Reset form when closing modal
}

window.onclick = function(event) {
  if (event.target.classList.contains('modal') && event.target.classList.contains('active')) {
    const albergue = event.target.id.split('-')[1];
    closeModal(albergue);
  }
};

// Configuración de listeners de formularios
function setupFormListeners() {
  ['maestro', 'tinku', 'aquilina'].forEach(albergue => {
    const form = document.getElementById(`reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)}`);
    if (form) {
      // Remove existing listeners to prevent duplicates
      form.removeEventListener('submit', handleFormSubmit);
      form.addEventListener('submit', handleFormSubmit);
    }
  });
}

// Helper function to handle form submission
function handleFormSubmit(e) {
  e.preventDefault();
  e.stopPropagation(); // Prevent event bubbling
  const albergue = e.target.id.replace('reservaForm', '').toLowerCase();
  if (formSubmissionState[albergue].isSubmitting) {
    console.log(`Envío duplicado bloqueado para ${albergue}`);
    return;
  }
  formSubmissionState[albergue].isSubmitting = true;
  submitForm(albergue).finally(() => {
    formSubmissionState[albergue].isSubmitting = false;
  });
}

async function submitForm(albergue) {
  console.log(`Iniciando envío de formulario para ${albergue}`);

  const formData = getFormData(albergue);
  if (!formData.institucion || !formData.responsable || !formData.contacto ||
      !formData.cantidad || !formData.fechaIngreso || !formData.horaIngreso) {
    alert("Por favor complete todos los campos del formulario");
    return;
  }

  const btn = getSubmitButton(albergue);
  setBtnLoading(btn);

  try {
    const resultado = await enviarReservaAGoogleSheets(formData);

    if (resultado.success) {
      mostrarConfirmacion(albergue, formData, resultado.idReserva);
      setBtnSuccess(btn);
showSnackbar('PRE-Reserva Realizada: Para su confirmación, llamar al 381-123456.', 'success', 5800);

      setTimeout(() => {
        resetForm(albergue);
        closeModal(albergue);
        resetBtn(btn);
      }, 900);
    } else {
      setBtnError(btn, 'Error');
showSnackbar(`Error al guardar la reserva: ${resultado.message || 'Intente nuevamente'}`, 'error', 2200);
      setTimeout(() => resetBtn(btn), 1200);
      return;
    }
  } catch (err) {
    console.error(err);
    setBtnError(btn, 'Error');
    alert('Ocurrió un error al enviar la reserva.');
    setTimeout(() => resetBtn(btn), 1200);
  }
}




// Helper functions
function getFormData(albergue) {
  const pernoctaCheckbox = document.getElementById(`pernocta-${albergue}`);
  const pernoctaValue = pernoctaCheckbox ? pernoctaCheckbox.checked : false;
  console.log(`Pernocta para ${albergue}: ${pernoctaValue}`);
  return {
    albergue,
    institucion: document.getElementById(`institucion-${albergue}`).value,
    responsable: document.getElementById(`responsable-${albergue}`).value,
    contacto: document.getElementById(`contacto-${albergue}`).value,
    cantidad: document.getElementById(`cantidad-${albergue}`).value,
    fechaIngreso: document.getElementById(`fechaIngreso-${albergue}`).value,
    horaIngreso: document.getElementById(`horaIngreso-${albergue}`).value,
    //pernocta: document.getElementById('pernocta-maestro').checked // <-- BOOLEANO nativo
    pernocta: pernoctaValue

  };
}

function mostrarConfirmacion(albergue, formData, idReserva) {
  console.log(`Mostrando confirmación para ${albergue}, ID: ${idReserva}, Pernocta: ${formData.pernocta}`);
  const nombresAlbergues = {
    maestro: 'Albergue Maestro José Fierro',
    tinku: 'Albergue Tinku Huasi',
    aquilina: 'Albergue Aquilina Soldati'
  };

  // alert(`¡Reserva #${idReserva} realizada con éxito!\n\n` +
  //       `Institución: ${formData.institucion}\n` +
  //       `Responsable: ${formData.responsable}\n` +
  //       `Contacto: ${formData.contacto}\n` +
  //       `Cantidad: ${formData.cantidad} personas\n` +
  //       `Albergue: ${nombresAlbergues[albergue]}\n` +
  //       `Ingreso: ${formData.fechaIngreso} a las ${formData.horaIngreso}\n` +
  //       `Pernocta: ${formData.pernocta ? 'Sí' : 'No'}`);
}

function resetForm(albergue) {
  const form = document.getElementById(`reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)}`);
  form.reset();
  // Ensure checkbox is unchecked
  const pernoctaCheckbox = document.getElementById(`pernocta-${albergue}`);
  if (pernoctaCheckbox) {
    pernoctaCheckbox.checked = false;
  }
  console.log(`Formulario reseteado para ${albergue}, Pernocta: ${pernoctaCheckbox ? pernoctaCheckbox.checked : 'No checkbox'}`);
}

// function actualizarCacheLocal(albergue, fechaISO) {
//   const fecha = new Date(fechaISO);
//   if (!fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString())) {
//     fechasOcupadas[albergue].push(new Date(fecha));
//     console.log(`Cache local actualizado para ${albergue}, fecha: ${fechaIngreso}`);
//   }
// }

// Funciones para fechas
function setMinDates() {
  const today = new Date().toISOString().split('T')[0];
  document.querySelectorAll('input[type="date"]').forEach(input => {
    input.min = today;
  });
}

function setupDateListeners() {
  ['maestro', 'tinku', 'aquilina'].forEach(albergue => {
    const ingresoInput = document.getElementById(`fechaIngreso-${albergue}`);
    if (ingresoInput) {
      ingresoInput.addEventListener('change', function() {
        // No need to set min for salidaInput since it's removed
      });
    }
  });
}

function formatDate(date) {
  return date.toISOString().split('T')[0];
}

function isoFromYMD(año, mes0, dia) {
  return `${año}-${String(mes0 + 1).padStart(2,'0')}-${String(dia).padStart(2,'0')}`;
}

function setSelectedDate(albergue, iso, cell) {
  estadoCalendario[albergue].selectedISO = iso;

  // quitar selección anterior en este calendario
  const grid = document.getElementById(`calendario-${albergue}`);
  const prev = grid.querySelector('.dia.seleccionado');
  if (prev) prev.classList.remove('seleccionado');

  // marcar la nueva
  cell.classList.add('seleccionado');

  // (opcional) reflejar en el input fecha del formulario
  const inputFecha = document.getElementById(`fechaIngreso-${albergue}`);
  if (inputFecha) inputFecha.value = iso;
}


function getAlbergueKey(albergueNombre) {
  if (albergueNombre.includes('Maestro')) return 'maestro';
  if (albergueNombre.includes('Tinku')) return 'tinku';
  if (albergueNombre.includes('Aquilina')) return 'aquilina';
  return null;
}

// Funciones para el calendario
function generarCalendario(albergue) {
  const estado = estadoCalendario[albergue];
  const { mes, año } = estado;

  const primerDia = new Date(año, mes, 1);
  const ultimoDia = new Date(año, mes + 1, 0);
  const primerDiaSemana = primerDia.getDay();
  const diasEnMes = ultimoDia.getDate();

  const contenedor = document.getElementById(`calendario-${albergue}`);
  contenedor.innerHTML = '';

  // Encabezados de días
  CONFIG.diasSemanaCortos.forEach(dia => {
    const diaHeader = document.createElement('div');
    diaHeader.className = 'dia-header';
    diaHeader.textContent = dia;
    contenedor.appendChild(diaHeader);
  });

  // Días del mes anterior
  const diasMesAnterior = new Date(año, mes, 0).getDate();
  // 
    for (let i = 1; i <= diasEnMes; i++) {
  const fechaActual = new Date(año, mes, i);
  const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fechaActual.toDateString());

  const dia = crearDiaElemento(i, estaOcupado ? 'ocupado' : '');

  // hoy
  const hoy = new Date();
  if (fechaActual.toDateString() === hoy.toDateString()) {
    dia.classList.add('hoy');
  }

  // ⬇️ NUEVO: iso y selección persistente
  const iso = isoFromYMD(año, mes, i);
  dia.dataset.iso = iso;
  if (estadoCalendario[albergue].selectedISO === iso) {
    dia.classList.add('seleccionado');
  }

  if (!estaOcupado && !dia.classList.contains('otro-mes')) {
    dia.addEventListener('click', () => {
      setSelectedDate(albergue, iso, dia);                // ⬅️ resalta el click
      mostrarInfoDia(albergue, año, mes, i);              // ⬅️ y luego actualiza datos
    });
  }


    contenedor.appendChild(dia);
  }

  // Días del mes siguiente
  const totalCeldas = 42; // 6 filas x 7 días
  const diasMesSiguiente = totalCeldas - (primerDiaSemana + diasEnMes);

  for (let i = 1; i <= diasMesSiguiente; i++) {
    contenedor.appendChild(crearDiaElemento(i, 'otro-mes'));
  }

  // Actualizar título del mes
  document.getElementById(`mes-actual-${albergue}`).textContent = 
    `${CONFIG.meses[mes]} ${año}`;
  console.log(`Calendario generado para ${albergue}, mes: ${CONFIG.meses[mes]} ${año}`);
}

function crearDiaElemento(numero, claseExtra = '') {
  const dia = document.createElement('div');
  dia.className = `dia ${claseExtra}`;
  dia.textContent = numero;
  return dia;
}

// function mostrarInfoDia(albergue, año, mes, dia) {
//   const fecha = new Date(año, mes, dia);
//   const diaSemana = CONFIG.diasSemana[fecha.getDay()];
//   const mesNombre = CONFIG.meses[mes];

//   const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString());
//   const disponibles = capacidades[albergue] - ocupacionActual[albergue];

  

//   const mensaje = `Fecha seleccionada: ${diaSemana}, ${dia} de ${mesNombre} de ${año}\n` +
//                   `Estado: ${estaOcupado ? 'No disponible' : 'Disponible'}\n` +
//                   `Capacidad total: ${capacidades[albergue]} personas\n` +
//                   `Personas ocupadas: ${ocupacionActual[albergue]} personas\n` +
//                   `Disponibles: ${disponibles} personas`;

//   alert(mensaje);
// }


// Debe ser async porque consulta al backend
// async function mostrarInfoDia(albergue, año, mes0, dia) {
//   const fecha = new Date(año, mes0, dia);
//   const fechaISO = `${año}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
//   const diaSemana = CONFIG.diasSemana[fecha.getDay()];
//   const mesNombre = CONFIG.meses[mes0];

//   console.log(`mostrarInfoDia llamado para albergue: ${albergue}, fecha: ${fechaISO}`);

//   // 1) Pedir disponibilidad real al GS
//   const disponibilidad = await obtenerDisponibilidadDia(albergue, fechaISO); // <-- esta función debe existir

//   // 2) Valores por defecto si no hay registro (capacidad máxima)
//   let ocupados = 0;
//   let capacidad = capacidades[albergue];
//   let disponibles = capacidad;

//   if (disponibilidad) {
//     ocupados = disponibilidad.ocupados;
//     capacidad = disponibilidad.capacidad;
//     disponibles = disponibilidad.disponibles;
//     // mantener cache local si lo usás
//     ocupacionActual[albergue] = ocupados;
//   } else {
//     console.error('No se obtuvo disponibilidad, usando valores por defecto');
//   }

//   // 3) Actualizar el modal con ids genéricos
//   const spanDisp = document.getElementById(`disponibles-${albergue}`);
//   if (spanDisp) spanDisp.textContent = disponibles;
//   const spanCap = document.getElementById(`capacidad-${albergue}`);
//   if (spanCap) spanCap.textContent = capacidad;

//   // 4) (Opcional) Cartel informativo
//   const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString());
//   const mensaje = `Fecha seleccionada: ${diaSemana}, ${dia} de ${mesNombre} de ${año}\n` +
//                   `Estado: ${estaOcupado ? 'No disponible' : 'Disponible'}\n` +
//                   `Capacidad total: ${capacidad} personas\n` +
//                   `Personas ocupadas: ${ocupados} personas\n` +
//                   `Disponibles: ${disponibles} personas`;
//   alert(mensaje);

//   updateOcupacionUI(albergue, ocupados, capacidad);

// }

async function mostrarInfoDia(albergue, año, mes0, dia) {
  const fecha = new Date(año, mes0, dia);
  const fechaISO = `${año}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const diaSemana = CONFIG.diasSemana[fecha.getDay()];
  const mesNombre = CONFIG.meses[mes0];

  console.log(`mostrarInfoDia llamado para albergue: ${albergue}, fecha: ${fechaISO}`);

  // ⬇️ Mostrar loader y bloquear interacción
  showCalendarLoading(albergue);

  try {
  // 1) Pedir disponibilidad real al GS
  const disponibilidad = await obtenerDisponibilidadDia(albergue, fechaISO);

  // 2) Tomar capacidad/disponibles y derivar ocupados = capacidad - disponibles
  const capBase = Number(capacidades[albergue]) || 0;
  const capacidad   = Number(disponibilidad?.capacidad ?? capBase) || 0;
  const disponibles = Number(disponibilidad?.disponibles ?? capacidad) || 0;
  const ocupados    = Math.max(0, Math.min(capacidad, capacidad - disponibles));

  // Mantener cache local si lo usás
  ocupacionActual[albergue] = ocupados;

  // 3) Actualizar el modal con ids genéricos
  const spanDisp = document.getElementById(`disponibles-${albergue}`);
  if (spanDisp) spanDisp.textContent = disponibles;
  const spanCap = document.getElementById(`capacidad-${albergue}`);
  if (spanCap) spanCap.textContent = capacidad;

  // // 4) (Opcional) Cartel informativo
  // const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString());
  // const mensaje = `Fecha seleccionada: ${diaSemana}, ${dia} de ${mesNombre} de ${año}\n` +
  //                 `Estado: ${estaOcupado ? 'No disponible' : 'Disponible'}\n` +
  //                 `Capacidad total: ${capacidad} personas\n` +
  //                 `Personas ocupadas: ${ocupados} personas\n` +
  //                 `Disponibles: ${disponibles} personas`;
  // alert(mensaje);

  // 5) Actualizar barra y texto "X/Cap personas ocupadas"
  updateOcupacionUI(albergue, ocupados, capacidad);

  // (opcional) tu alert informativo
    // ...
  } catch (e) {
    console.error('Error al obtener disponibilidad:', e);
    // Podés mostrar un mensaje inline si querés
  } finally {
    // ⬇️ Siempre ocultar loader y habilitar interacción
    hideCalendarLoading(albergue);
  }
}


function cambiarMes(albergue, direccion) {
  estadoCalendario[albergue].mes += direccion;

  // Ajustar año si es necesario
  if (estadoCalendario[albergue].mes < 0) {
    estadoCalendario[albergue].mes = 11;
    estadoCalendario[albergue].año--;
  } else if (estadoCalendario[albergue].mes > 11) {
    estadoCalendario[albergue].mes = 0;
    estadoCalendario[albergue].año++;
  }

  const estadoCalendario = {
  maestro:  { mes: new Date().getMonth(), año: new Date().getFullYear(), selectedISO: null },
  tinku:    { mes: new Date().getMonth(), año: new Date().getFullYear(), selectedISO: null },
  aquilina: { mes: new Date().getMonth(), año: new Date().getFullYear(), selectedISO: null }
};


  generarCalendario(albergue);
}

// Funciones para interactuar con Google Sheets
async function enviarReservaAGoogleSheets(data) {
  try {
    const payload = {
      secret: CONFIG.secretKey,
      action: "crearReserva",
      albergue: data.albergue === 'maestro' ? 'Maestro José Fierro' : 
               data.albergue === 'tinku' ? 'Tinku Huasi' : 'Aquilina Soldati',
      institucion: data.institucion,
      responsable: data.responsable,
      contacto: data.contacto,
      cantidad: parseInt(data.cantidad),
      fechaIngreso: data.fechaIngreso,
      horaIngreso: data.horaIngreso,
      pernocta: data.pernocta // Send boolean value
    };

    console.log(`Enviando datos a Google Sheets: ${JSON.stringify(payload)}`);
    const response = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });

    const result = await response.json();
    console.log(`Respuesta de Google Sheets: ${JSON.stringify(result)}`);
    return result;
  } catch (error) {
    console.error(`Error al enviar reserva para ${data.albergue}: ${error}`);
    return { success: false, message: "Error de conexión" };
  }
}




//DIARIA
function toISODateYMD(dateObj) {
  // dateObj es un Date del día cliqueado
  const y = dateObj.getFullYear();
  const m = String(dateObj.getMonth() + 1).padStart(2, '0');
  const d = String(dateObj.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
async function fetchDisponiblesMaestro(fechaISO) {
  const payload = new URLSearchParams({
    secret: CONFIG.secretKey,
    action: 'obtenerDisponibilidadDia',
    fecha: fechaISO
  });

  const resp = await fetch(CONFIG.googleScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  });

  const json = await resp.json();
  if (!json.success) throw new Error(json.message || 'Error en servidor');
  return json; // {fecha, albergue, capacidad, ocupados, disponibles}
}


// Llamalo cuando el usuario hace click en un día del calendario del modal "Maestro José Fierro"
async function onCalendarDayClickMaestro(dateObj) {
  try {
    const fechaISO = toISODateYMD(dateObj);
    const res = await fetchDisponiblesMaestro(fechaISO);

    // Actualizar el modal (ejemplo: <span id="disponibles-maestro"></span>)
    const spanDisp = document.getElementById('disponibles-maestro');
    if (spanDisp) spanDisp.textContent = res.disponibles;

    // Si además querés mostrar la capacidad:
    const spanCap = document.getElementById('capacidad-maestro'); // opcional
    if (spanCap) spanCap.textContent = res.capacidad;

    // También podés guardar la fecha seleccionada en tu form:
    const inputFecha = document.getElementById('fechaIngreso-maestro');
    if (inputFecha) inputFecha.value = fechaISO;

  } catch (e) {
    console.error(e);
    alert('No se pudo obtener la disponibilidad. Intenta de nuevo.');
  }
}


async function obtenerDisponibilidadDia(albergueKey, fechaISO) {
  const payload = new URLSearchParams({
    secret: CONFIG.secretKey,
    action: 'obtenerDisponibilidadDia',
    albergue: toFullName(albergueKey), // nombre completo que matchea las hojas
    fecha: fechaISO
  });

  const resp = await fetch(CONFIG.googleScriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: payload
  });

  const json = await resp.json();
  if (!json.success) throw new Error(json.message || 'Error en servidor');
  return {
    ocupados: json.ocupados,
    disponibles: json.disponibles,
    capacidad: json.capacidad
  };
}


function updateOcupacionUI(albergue, ocupados, capacidad) {
  const percent = capacidad > 0 ? Math.max(0, Math.min(100, Math.round((ocupados / capacidad) * 100))) : 0;

  const fill = document.getElementById(`ocupacion-fill-${albergue}`);
  if (fill) fill.style.width = `${percent}%`;

  const info = document.getElementById(`ocupacion-info-${albergue}`);
  if (info) info.textContent = `${ocupados}/${capacidad} Camas ocupadas`;
}


const isLoading = { maestro: false, tinku: false, aquilina: false };

function showCalendarLoading(albergue) {
  isLoading[albergue] = true;

  const overlay = document.getElementById(`cal-loader-${albergue}`);
  if (overlay) {
    overlay.hidden = false;
    overlay.setAttribute('aria-busy', 'true');
  }

  // Bloquear interacción en header y grid
  const grid = document.getElementById(`calendario-${albergue}`);
  if (grid) grid.classList.add('cal-block');

  const header = document.querySelector(`#modal-${albergue} .calendario-header`);
  if (header) header.classList.add('cal-block');
}

function hideCalendarLoading(albergue) {
  isLoading[albergue] = false;

  const overlay = document.getElementById(`cal-loader-${albergue}`);
  if (overlay) {
    overlay.hidden = true;
    overlay.setAttribute('aria-busy', 'false');
  }

  const grid = document.getElementById(`calendario-${albergue}`);
  if (grid) grid.classList.remove('cal-block');

  const header = document.querySelector(`#modal-${albergue} .calendario-header`);
  if (header) header.classList.remove('cal-block');
}
// para boton reserva vERDE
function getSubmitButton(albergue){
  const form = document.getElementById(`reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)}`);
  return form ? form.querySelector('.btn-submit') : null;
}
function setBtnLoading(btn){
  if(!btn) return;
  const lbl = btn.querySelector('.btn-label');
  if (lbl) lbl.textContent = 'Confirmar Reserva';
  // limpiar otros estados
  btn.classList.remove('is-success','is-error');
  // activar loading
  btn.classList.add('is-loading');
  btn.disabled = true;
}
function setBtnSuccess(btn, text='Reservado'){
  if(!btn) return;
  const lbl = btn.querySelector('.btn-label');
  if (lbl) lbl.textContent = text;
  btn.classList.remove('is-loading','is-error'); // <- importante
  btn.classList.add('is-success');
  btn.disabled = true;
}
// function resetBtn(btn){
//   if(!btn) return;
//   btn.classList.remove('is-loading','is-success');
//   btn.disabled = false;
// }

// function setBtnError(btn, text='Error'){
//   if(!btn) return;
//   const lbl = btn.querySelector('.btn-label');
//   if (lbl) lbl.textContent = text;
//   // Quitar otros estados visuales
//   btn.classList.remove('is-loading','is-success');
//   // Mostrar rojo con X
//   btn.classList.add('is-error');
//   // Permitimos reintentar: NO lo dejamos deshabilitado
//   btn.disabled = false;
// }

function setBtnError(btn, text='Error'){
  if(!btn) return;
  const lbl = btn.querySelector('.btn-label');
  if (lbl) lbl.textContent = text;
  btn.classList.remove('is-loading','is-success'); // <- importante
  btn.classList.add('is-error');
  btn.disabled = false; // permitir reintentar
}

function resetBtn(btn, text='Confirmar Reserva'){
  if(!btn) return;
  const lbl = btn.querySelector('.btn-label');
  if (lbl) lbl.textContent = text;
  // quitar TODOS los estados
  btn.classList.remove('is-loading','is-success','is-error'); // <- agrega is-error
  btn.disabled = false;
}

function ensureSnackbar() {
  let bar = document.getElementById('app-snackbar');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'app-snackbar';
    document.body.appendChild(bar);
  }
  return bar;
}

function showSnackbar(message, type = 'success', duration = 1800) {
  const bar = ensureSnackbar();
  bar.classList.remove('success','error','show');
  bar.classList.add(type === 'error' ? 'error' : 'success');
  bar.textContent = message;

  // mostrar
  // (forzamos reflow para reiniciar la transición si ya estaba visible)
  void bar.offsetWidth;
  bar.classList.add('show');

  // ocultar
  clearTimeout(bar._hideTimer);
  bar._hideTimer = setTimeout(() => {
    bar.classList.remove('show');
  }, duration);
}


