// Configuración global
const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbyiyNqnKRfywGxpW7uhFgJgH_fFtZRrkutUW40m3tz7bD6Xk7sPN4W0xqwshwoaYJD1/exec"};

// Inicialización cuando se carga la página
document.addEventListener('DOMContentLoaded', function() {
  setMinDates();
  setupDateListeners();
  setupFormListeners();
});

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
  
  if (!validateForm(formData)) {
    return;
  }
  
  try {
    // Mostrar feedback al usuario
    const submitBtn = document.querySelector(`#reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)} button[type="submit"]`);
    const btnOriginalText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Enviando...';
    
    // Enviar a Google Sheets
    const resultado = await enviarReservaAGoogleSheets({
      ...formData,
      albergue
    });
    
    if (resultado.success) {
      mostrarConfirmacion(albergue, formData);
      resetForm(albergue);
      closeModal(albergue);
    } else {
      alert(`Error al realizar la reserva: ${resultado.message}`);
    }
  } catch (error) {
    console.error("Error en submitForm:", error);
    alert("Ocurrió un error al procesar la reserva. Por favor intente nuevamente.");
  } finally {
    const submitBtn = document.querySelector(`#reservaForm${albergue.charAt(0).toUpperCase() + albergue.slice(1)} button[type="submit"]`);
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = 'Confirmar Reserva';
    }
  }
}

// Helper functions básicas
function getFormData(albergue) {
  return {
    institucion: document.getElementById(`institucion-${albergue}`).value.trim(),
    responsable: document.getElementById(`responsable-${albergue}`).value.trim(),
    contacto: document.getElementById(`contacto-${albergue}`).value.trim(),
    cantidad: parseInt(document.getElementById(`cantidad-${albergue}`).value),
    fechaIngreso: document.getElementById(`fechaIngreso-${albergue}`).value,
    horaIngreso: document.getElementById(`horaIngreso-${albergue}`).value,
    fechaSalida: document.getElementById(`fechaSalida-${albergue}`).value,
    horaSalida: document.getElementById(`horaSalida-${albergue}`).value
  };
}

function validateForm(formData) {
  // Validación básica de campos requeridos
  if (!formData.institucion || !formData.responsable || !formData.contacto || 
      isNaN(formData.cantidad) || !formData.fechaIngreso || !formData.horaIngreso || 
      !formData.fechaSalida || !formData.horaSalida) {
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
  
  // Validación de cantidad
  if (formData.cantidad < 1) {
    alert('La cantidad de personas debe ser al menos 1');
    return false;
  }
  
  return true;
}

function mostrarConfirmacion(albergue, formData) {
  const nombresAlbergues = {
    maestro: 'Albergue Maestro José Fierro',
    tinku: 'Albergue Tinku Huasi',
    aquilina: 'Albergue Aquilina Soldati'
  };
  
  alert(`¡Reserva realizada con éxito!\n\n` +
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

// Funciones de modales
function openModal(albergue) {
  document.getElementById(`modal-${albergue}`).classList.add('active');
  document.body.style.overflow = 'hidden';
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

///////////////////////////////
document.addEventListener('DOMContentLoaded', function() {
  // Inicializa sliders para cada albergue
  document.querySelectorAll('.glide').forEach(element => {
    new Glide(element, {
      type: 'carousel',
      perView: 1,
      autoplay: 4000,
      hoverpause: false, // Cambiado a true para mejor UX
      animationDuration: 2000,
      gap: 0
    }).mount();
  });

  // Resto de tu código de inicialización...
  setMinDates();
  setupDateListeners();
  cargarDatosIniciales();
}); 