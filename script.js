// Configuración global
const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyEf7ZRhoBh_va-y81IfWsNaoMvAFDXGH4sIKOIEj0wkqSOfz4alvu7tnYJe6fufrobow/exec",
  meses: ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'],
  diasSemana: ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'],
  diasSemanaCortos: ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb']
};

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
  maestro: 32,
  tinku: 29,
  aquilina: 26
};

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  setMinDates();
  setupDateListeners();
  setupFormListeners();
  cargarDatosIniciales();
});

// Función para cargar datos iniciales desde Google Sheets
async function cargarDatosIniciales() {
  try {
    const response = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      body: JSON.stringify({
        secret: CONFIG.secretKey,
        action: "obtenerReservas",
        fechaInicio: formatDate(new Date()),
        fechaFin: formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1))
      }),
      headers: { "Content-Type": "application/json" }
    });
    
    const data = await response.json();
    
    if (data.success) {
      // Procesar las reservas para actualizar fechasOcupadas
      data.reservas.forEach(reserva => {
        const albergueKey = getAlbergueKey(reserva.albergue);
        if (albergueKey) {
          // Agregar todas las fechas entre ingreso y salida
          const fechaInicio = new Date(reserva.fechaIngreso);
          const fechaFin = new Date(reserva.fechaSalida);
          
          for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
            if (!fechasOcupadas[albergueKey].some(f => f.toDateString() === d.toDateString())) {
              fechasOcupadas[albergueKey].push(new Date(d));
            }
          }
        }
      });
    }
  } catch (error) {
    console.error("Error al cargar datos iniciales:", error);
  }
}

// Funciones para manejar modales
function openModal(albergue) {
  document.getElementById(`modal-${albergue}`).classList.add('active');
  document.body.style.overflow = 'hidden';
  generarCalendario(albergue);
}

function closeModal(albergue) {
  document.getElementById(`modal-${albergue}`).classList.remove('active');
  document.body.style.overflow = 'auto';
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
      form.addEventListener('submit', function(e) {
        e.preventDefault();
        submitForm(albergue);
      });
    }
  });
}

// Función principal para enviar formularios
async function submitForm(albergue) {
  const formData = getFormData(albergue);
  
  if (!validateForm(formData)) return;
  
  // Verificar disponibilidad antes de enviar
  const disponibilidad = await verificarDisponibilidad(albergue, formData.fechaIngreso, formData.fechaSalida, formData.cantidad);
  
  if (!disponibilidad.disponible) {
    alert('No hay disponibilidad para las fechas seleccionadas. Por favor elija otras fechas.');
    return;
  }
  
  // Enviar a Google Sheets
  const resultado = await enviarReservaAGoogleSheets({
    ...formData,
    albergue
  });
  
  if (resultado.success) {
    mostrarConfirmacion(albergue, formData, resultado.idReserva);
    resetForm(albergue);
    closeModal(albergue);
    
    // Actualizar cache local
    actualizarCacheLocal(albergue, formData.fechaIngreso, formData.fechaSalida);
  } else {
    alert(`Error al realizar la reserva: ${resultado.message}`);
  }
}

// Helper functions
function getFormData(albergue) {
  return {
    institucion: document.getElementById(`institucion-${albergue}`).value,
    responsable: document.getElementById(`responsable-${albergue}`).value,
    contacto: document.getElementById(`contacto-${albergue}`).value,
    cantidad: document.getElementById(`cantidad-${albergue}`).value,
    fechaIngreso: document.getElementById(`fechaIngreso-${albergue}`).value,
    horaIngreso: document.getElementById(`horaIngreso-${albergue}`).value,
    fechaSalida: document.getElementById(`fechaSalida-${albergue}`).value,
    horaSalida: document.getElementById(`horaSalida-${albergue}`).value
  };
}

function validateForm(formData) {
  // Validación básica de campos requeridos
  if (Object.values(formData).some(val => !val)) {
    alert('Por favor complete todos los campos del formulario');
    return false;
  }
  
  // Validación de fechas
  const ingreso = new Date(formData.fechaIngreso);
  const salida = new Date(formData.fechaSalida);
  
  if (salida <= ingreso) {
    alert('La fecha de salida debe ser posterior a la fecha de ingreso');
    return false;
  }
  
  return true;
}

function mostrarConfirmacion(albergue, formData, idReserva) {
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
        `Salida: ${formData.fechaSalida} a las ${formData.horaSalida}`);
}

function resetForm(albergue) {
  document.getElementById(`reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)}`).reset();
}

function actualizarCacheLocal(albergue, fechaIngreso, fechaSalida) {
  const inicio = new Date(fechaIngreso);
  const fin = new Date(fechaSalida);
  
  for (let d = new Date(inicio); d <= fin; d.setDate(d.getDate() + 1)) {
    if (!fechasOcupadas[albergue].some(f => f.toDateString() === d.toDateString())) {
      fechasOcupadas[albergue].push(new Date(d));
    }
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
    const salidaInput = document.getElementById(`fechaSalida-${albergue}`);
    
    if (ingresoInput && salidaInput) {
      ingresoInput.addEventListener('change', function() {
        salidaInput.min = this.value;
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
}

function crearDiaElemento(numero, claseExtra = '') {
  const dia = document.createElement('div');
  dia.className = `dia ${claseExtra}`;
  dia.textContent = numero;
  return dia;
}

function mostrarInfoDia(albergue, año, mes, dia) {
  const fecha = new Date(año, mes, dia);
  const diaSemana = CONFIG.diasSemana[fecha.getDay()];
  const mesNombre = CONFIG.meses[mes];
  
  const estaOcupado = fechasOcupadas[albergue].some(f => f.toDateString() === fecha.toDateString());
  const disponibles = capacidades[albergue] - ocupacionActual[albergue];
  
  const mensaje = `Fecha seleccionada: ${diaSemana}, ${dia} de ${mesNombre} de ${año}\n` +
                  `Estado: ${estaOcupado ? 'No disponible' : 'Disponible'}\n` +
                  `Capacidad total: ${capacidades[albergue]} personas\n` +
                  `Personas ocupadas: ${ocupacionActual[albergue]} personas\n` +
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

// Función para enviar datos a Google Sheets (MODIFICADA PARA FORM-DATA)
async function enviarReservaAGoogleSheets(data) {
  try {
    const albergueNombre = {
      maestro: 'Maestro José Fierro',
      tinku: 'Tinku Huasi',
      aquilina: 'Aquilina Soldati'
    }[data.albergue];

    const formData = new FormData();
    formData.append("secret", CONFIG.secretKey);
    formData.append("action", "crearReserva");
    formData.append("albergue", albergueNombre);
    formData.append("institucion", data.institucion);
    formData.append("responsable", data.responsable);
    formData.append("contacto", data.contacto);
    formData.append("cantidad", data.cantidad);
    formData.append("fechaIngreso", data.fechaIngreso);
    formData.append("horaIngreso", data.horaIngreso);
    formData.append("fechaSalida", data.fechaSalida);
    formData.append("horaSalida", data.horaSalida);

    const formDataObj = {};
    formData.forEach((value, key) => (formDataObj[key] = value));
    console.log("Enviando datos al servidor:", formDataObj);

    const response = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      body: formData
    });

    const responseData = await response.json();
    console.log("Respuesta del servidor:", responseData);
    return responseData;
  } catch (error) {
    console.error("Error al enviar reserva:", error);
    return { 
      success: false, 
      message: "Error de conexión con el servidor",
      error: error.message 
    };
  }
}

async function verificarDisponibilidad(albergue, fechaIngreso, fechaSalida, cantidad) {
  try {
    const albergueNombre = data.albergue === 'maestro' ? 'Maestro José Fierro' : 
                         data.albergue === 'tinku' ? 'Tinku Huasi' : 'Aquilina Soldati';
    
    const payload = {
      secret: CONFIG.secretKey,
      action: "verificarDisponibilidad",
      albergue: albergueNombre,
      fechaIngreso,
      fechaSalida,
      cantidad: parseInt(cantidad)
    };

    const response = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "application/json" }
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error al verificar disponibilidad:", error);
    return { disponible: false, message: "Error al verificar disponibilidad" };
  }
}