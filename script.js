const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyNG4Wa6OB0buTmo6f594Blj6xs6--wFmvhFXTQOoPhpQiHsQU0OxGH28aVyj5f2eNK/exec"};


// ======= CALENDARIO =======
const calendarioEstado = {
  maestro: new Date(),
  tinku: new Date(),
  aquilina: new Date()
};

function cambiarMes(albergue, delta) {
  const current = calendarioEstado[albergue];
  current.setMonth(current.getMonth() + delta);
  generarCalendario(albergue, current);
}

async function generarCalendario(albergue, fechaBase) {
  const nombres = {
    maestro: 'Maestro José Fierro',
    tinku: 'Tinku Huasi',
    aquilina: 'Aquilina Soldati'
  };

  const contenedor = document.getElementById(`calendario-${albergue}`);
  const tituloMes = document.getElementById(`mes-actual-${albergue}`);
  contenedor.innerHTML = '';

  const anio = fechaBase.getFullYear();
  const mes = fechaBase.getMonth();
  const primerDia = new Date(anio, mes, 1).getDay();
  const diasMes = new Date(anio, mes + 1, 0).getDate();

  // Título del mes
  const opciones = { month: 'long', year: 'numeric' };
  tituloMes.textContent = fechaBase.toLocaleDateString('es-ES', opciones);

  // Cargar disponibilidad mensual
  const disponibilidad = await obtenerDisponibilidadPorAlbergue(nombres[albergue]);

  // Espacios en blanco al comienzo
  for (let i = 0; i < (primerDia === 0 ? 6 : primerDia - 1); i++) {
    const celda = document.createElement('div');
    celda.classList.add('calendario-dia', 'vacio');
    contenedor.appendChild(celda);
  }

  // Agregar los días
  for (let dia = 1; dia <= diasMes; dia++) {
    const fecha = new Date(anio, mes, dia).toISOString().split('T')[0];
    const registro = disponibilidad.find(e => e.fecha === fecha);
    
    const celda = document.createElement('div');
    celda.classList.add('calendario-dia');

    if (registro) {
      celda.innerHTML = `
        <span class="dia-num">${dia}</span>
        <span class="dispo">${registro.disponibles} libres</span>
      `;
    } else {
      celda.innerHTML = `<span class="dia-num">${dia}</span>`;
    }

    contenedor.appendChild(celda);
  }
}

function cargarDatosIniciales() {
  ['maestro', 'tinku', 'aquilina'].forEach(albergue => {
    const fecha = new Date();
    calendarioEstado[albergue] = new Date(fecha);
    generarCalendario(albergue, fecha);
  });
}

// ======= RESERVA =======
document.addEventListener('DOMContentLoaded', () => {
  cargarDatosIniciales();
  setupDateListeners();
});

function setupDateListeners() {
  document.querySelectorAll('.fecha-input').forEach(input => {
    input.addEventListener('change', mostrarDisponibilidadActual);
  });
}

async function enviarReservaAGoogleSheets(datos) {
  try {
    console.log("Enviando datos al servidor:", datos);
    const res = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      mode: "cors",
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(datos)
    });

    const respuesta = await res.json();
    console.log("Respuesta del servidor:", respuesta);

    if (respuesta.success) {
      alert("Reserva realizada con éxito. ID: " + respuesta.idReserva);
      document.getElementById("form-reserva").reset();
      mostrarDisponibilidadActual();
    } else {
      alert("Error: " + respuesta.message);
    }
  } catch (error) {
    console.error("Error al enviar reserva:", error);
    alert("Error al enviar reserva.");
  }
}

function submitForm(e) {
  e.preventDefault();

  const form = document.getElementById("form-reserva");
  const datos = {
    secret: CONFIG.secretKey,
    action: "crearReserva",
    albergue: form.albergue.value,
    institucion: form.institucion.value,
    responsable: form.responsable.value,
    contacto: form.contacto.value,
    cantidad: form.cantidad.value,
    fechaIngreso: form.fechaIngreso.value,
    horaIngreso: form.horaIngreso.value,
    fechaSalida: form.fechaSalida.value,
    horaSalida: form.horaSalida.value
  };

  enviarReservaAGoogleSheets(datos);
}

// ======= DISPONIBILIDAD POR DÍA =======
async function obtenerDisponibilidadPorAlbergue(albergue) {
  try {
    const res = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: CONFIG.secretKey,
        action: "getDisponibilidad"
      })
    });

    const datos = await res.json();

    if (!datos.success) {
      console.error("Error al obtener disponibilidad:", datos.message);
      return [];
    }

    return datos.data.filter(d => d.albergue === albergue);
  } catch (error) {
    console.error("Error al obtener disponibilidad:", error);
    return [];
  }
}

async function mostrarDisponibilidadActual() {
  const form = document.getElementById("form-reserva");
  const fecha = form.fechaIngreso.value;
  const albergue = form.albergue.value;

  if (!fecha || !albergue) return;

  const disponibilidad = await obtenerDisponibilidadPorAlbergue(albergue);
  const registro = disponibilidad.find(d => d.fecha === fecha);

  const ocupacionFill = document.querySelector(".ocupacion-fill");
  const ocupacionTexto = document.querySelector(".ocupacion-info");

  if (registro) {
    const porcentaje = Math.round((registro.ocupados / registro.capacidad) * 100);
    ocupacionFill.style.width = `${porcentaje}%`;
    ocupacionTexto.textContent = `${registro.disponibles} plazas disponibles (${registro.ocupados}/${registro.capacidad})`;
  } else {
    ocupacionFill.style.width = "0%";
    ocupacionTexto.textContent = "Sin datos de disponibilidad para esta fecha.";
  }
}

// ======= MODAL =======

// function openModal(albergue) {
//   document.getElementById("modal").style.display = "block";
//   document.getElementById("form-reserva").reset();
//   document.getElementById("albergue").value = albergue;

//   mostrarDisponibilidadActual();
// }

function openModal(nombreCompleto) {
  const modal = document.getElementById("modal");
  if (!modal) return;

  modal.style.display = "block";
  document.getElementById("form-reserva").reset();
  document.getElementById("albergue").value = nombreCompleto;
  mostrarDisponibilidadActual(nombreCompleto);
}

function closeModal() {
  document.getElementById("modal").style.display = "none";
}

window.openModal = openModal;
window.closeModal = closeModal;
window.submitForm = submitForm;
window.cambiarMes = cambiarMes;
