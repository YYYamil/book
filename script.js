// Configuración global
const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyLjmLXc-9NkK6jbCxeZ3r3NSYV7x4TGatHWCncugnY4xKyVa7Epza7EH6rb7mAJEA-/exec",
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
  // Obtener valores del formulario
  const formData = getFormData(albergue);

  // Validación básica
  if (!formData.institucion || !formData.responsable || !formData.contacto || !formData.cantidad || !formData.fechaIngreso || !formData.horaIngreso) {
    console.log(`Validación fallida para ${albergue}`);
    alert("Por favor complete todos los campos del formulario");
    return;
  }

  // --- Enviar a Google Sheets ---
  const resultado = await enviarReservaAGoogleSheets(formData);

  if (resultado.success) {
    console.log(`Reserva exitosa para ${albergue}, ID: ${resultado.idReserva}`);
    mostrarConfirmacion(albergue, formData, resultado.idReserva);

    // Actualizar cache local si pernocta es true
    if (formData.pernocta) {
      actualizarCacheLocal(albergue, formData.fechaIngreso);
    }

    // Limpiar formulario y cerrar modal
    resetForm(albergue);
    closeModal(albergue);
  } else {
    console.log(`Error en reserva para ${albergue}: ${resultado.message}`);
    alert(`Error al guardar la reserva: ${resultado.message}`);
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

  alert(`¡Reserva #${idReserva} realizada con éxito!\n\n` +
        `Institución: ${formData.institucion}\n` +
        `Responsable: ${formData.responsable}\n` +
        `Contacto: ${formData.contacto}\n` +
        `Cantidad: ${formData.cantidad} personas\n` +
        `Albergue: ${nombresAlbergues[albergue]}\n` +
        `Ingreso: ${formData.fechaIngreso} a las ${formData.horaIngreso}\n` +
        `Pernocta: ${formData.pernocta ? 'Sí' : 'No'}`);
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

function actualizarCacheLocal(albergue, fechaIngreso) {
  const fecha = new Date(fechaIngreso);
  if (!fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString())) {
    fechasOcupadas[albergue].push(new Date(fecha));
    console.log(`Cache local actualizado para ${albergue}, fecha: ${fechaIngreso}`);
  }
}

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
  for (let i = primerDiaSemana - 1; i >= 0; i--) {
    contenedor.appendChild(crearDiaElemento(diasMesAnterior - i, 'otro-mes'));
  }

  // Días del mes actual
  const hoy = new Date();
  for (let i = 1; i <= diasEnMes; i++) {
    const fechaActual = new Date(año, mes, i);
    const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fechaActual.toDateString());

    const dia = crearDiaElemento(i, estaOcupado ? 'ocupado' : '');

    if (fechaActual.toDateString() === hoy.toDateString()) {
      dia.classList.add('hoy');
    }

    if (!estaOcupado && !dia.classList.contains('otro-mes')) {
      dia.addEventListener('click', () => mostrarInfoDia(albergue, año, mes, i));
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
async function mostrarInfoDia(albergue, año, mes0, dia) {
  const fecha = new Date(año, mes0, dia);
  const fechaISO = `${año}-${String(mes0 + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
  const diaSemana = CONFIG.diasSemana[fecha.getDay()];
  const mesNombre = CONFIG.meses[mes0];

  console.log(`mostrarInfoDia llamado para albergue: ${albergue}, fecha: ${fechaISO}`);

  // 1) Pedir disponibilidad real al GS
  const disponibilidad = await obtenerDisponibilidadDia(albergue, fechaISO); // <-- esta función debe existir

  // 2) Valores por defecto si no hay registro (capacidad máxima)
  let ocupados = 0;
  let capacidad = capacidades[albergue];
  let disponibles = capacidad;

  if (disponibilidad) {
    ocupados = disponibilidad.ocupados;
    capacidad = disponibilidad.capacidad;
    disponibles = disponibilidad.disponibles;
    // mantener cache local si lo usás
    ocupacionActual[albergue] = ocupados;
  } else {
    console.error('No se obtuvo disponibilidad, usando valores por defecto');
  }

  // 3) Actualizar el modal con ids genéricos
  const spanDisp = document.getElementById(`disponibles-${albergue}`);
  if (spanDisp) spanDisp.textContent = disponibles;
  const spanCap = document.getElementById(`capacidad-${albergue}`);
  if (spanCap) spanCap.textContent = capacidad;

  // 4) (Opcional) Cartel informativo
  const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString());
  const mensaje = `Fecha seleccionada: ${diaSemana}, ${dia} de ${mesNombre} de ${año}\n` +
                  `Estado: ${estaOcupado ? 'No disponible' : 'Disponible'}\n` +
                  `Capacidad total: ${capacidad} personas\n` +
                  `Personas ocupadas: ${ocupados} personas\n` +
                  `Disponibles: ${disponibles} personas`;
  alert(mensaje);
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
