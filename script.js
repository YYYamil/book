// Configuración global
const CONFIG = {
  secretKey: "cristiano1988",
  googleScriptUrl: "https://script.google.com/macros/s/AKfycbzHT7vZEwtr8IuN4mHRRD12fWc7h9AX5i52C87J-e6XKPKgOfkCHMY5Y1Y5bXzXYq9U/exec",
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
  //cargarDatosIniciales();
});

// Función para cargar datos iniciales desde Google Sheets
// async function cargarDatosIniciales() {
//   try {
//     const response = await fetch(CONFIG.googleScriptUrl, {
//       method: "POST",
//       body: JSON.stringify({
//         secret: CONFIG.secretKey,
//         action: "obtenerReservas",
//         fechaInicio: formatDate(new Date()),
//         fechaFin: formatDate(new Date(new Date().setFullYear(new Date().getFullYear() + 1)))
//       }),
//       headers: { "Content-Type": "application/json" }
//     });
    
//     const data = await response.json();
    
//     if (data.success) {
//       // Procesar las reservas para actualizar fechasOcupadas
//       data.reservas.forEach(reserva => {
//         const albergueKey = getAlbergueKey(reserva.albergue);
//         if (albergueKey) {
//           // Agregar todas las fechas entre ingreso y salida
//           const fechaInicio = new Date(reserva.fechaIngreso);
//           const fechaFin = new Date(reserva.fechaSalida);
          
//           for (let d = new Date(fechaInicio); d <= fechaFin; d.setDate(d.getDate() + 1)) {
//             if (!fechasOcupadas[albergueKey].some(f => f.toDateString() === d.toDateString())) {
//               fechasOcupadas[albergueKey].push(new Date(d));
//             }
//           }
//         }
//       });
//     }
//   } catch (error) {
//     console.error("Error al cargar datos iniciales:", error);
//   }
// }

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

//Configuración de listeners de formularios
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

async function submitForm(albergue) {
    // Obtener valores del formulario
    const institucion = document.getElementById(
        `institucion-${albergue}`
    ).value;
    const responsable = document.getElementById(
        `responsable-${albergue}`
    ).value;
    const contacto = document.getElementById(
        `contacto-${albergue}`
    ).value;
    const cantidad = document.getElementById(
        `cantidad-${albergue}`
    ).value;
    const fechaIngreso = document.getElementById(
        `fechaIngreso-${albergue}`
    ).value;
    const horaIngreso = document.getElementById(
        `horaIngreso-${albergue}`
    ).value;
    const fechaSalida = document.getElementById(
        `fechaSalida-${albergue}`
    ).value;
    const horaSalida = document.getElementById(
        `horaSalida-${albergue}`
    ).value;

    // Validación básica
    if (
        !institucion ||
        !responsable ||
        !contacto ||
        !cantidad ||
        !fechaIngreso ||
        !horaIngreso ||
        !fechaSalida ||
        !horaSalida
    ) {
        alert("Por favor complete todos los campos del formulario");
        return;
    }

    // Validar disponibilidad de fechas (mantén tu lógica si la necesitas)
    // ...

    // --- Enviar a Google Sheets ---
    const resultado = await enviarReservaAGoogleSheets({
        albergue,
        institucion,
        responsable,
        contacto,
        cantidad,
        fechaIngreso,
        horaIngreso,
        fechaSalida,
        horaSalida
    });

    if (resultado.success) {
        let albergueNombre = "";
        if (albergue === "maestro")
            albergueNombre = "Albergue Maestro José Fierro";
        if (albergue === "tinku")
            albergueNombre = "Albergue Tinku Huasi";
        if (albergue === "aquilina")
            albergueNombre = "Albergue Aquilina Soldati";

        alert(
            `¡Reserva realizada con éxito!\n\nInstitución: ${institucion}\nResponsable: ${responsable}\nContacto: ${contacto}\nCantidad de personas: ${cantidad}\nAlbergue: ${albergueNombre}\nIngreso: ${fechaIngreso} a las ${horaIngreso}\nSalida: ${fechaSalida} a las ${horaSalida}`
        );

        // Limpiar formulario y cerrar modal
        document
            .getElementById(
                `reservaForm${
                    albergue.charAt(0).toUpperCase() +
                    albergue.slice(1)
                }`
            )
            .reset();
        closeModal(albergue);
    } else {
        alert(`Error al guardar la reserva: ${resultado.message}`);
    }
}


// Función principal para enviar formularios
// async function submitForm(albergue) {
//   const formData = getFormData(albergue);
  
//   if (!validateForm(formData)) return;
  
//   // Verificar disponibilidad antes de enviar
//   const disponibilidad = await verificarDisponibilidad(albergue, formData.fechaIngreso, formData.fechaSalida, formData.cantidad);
  
//   if (!disponibilidad.disponible) {
//     alert('No hay disponibilidad para las fechas seleccionadas. Por favor elija otras fechas.');
//     return;
//   }
  
//   // Enviar a Google Sheets
//   const resultado = await enviarReservaAGoogleSheets({
//     ...formData,
//     albergue
//   });
  
//   if (resultado.success) {
//     mostrarConfirmacion(albergue, formData, resultado.idReserva);
//     resetForm(albergue);
//     closeModal(albergue);
    
//     // Actualizar cache local
//     actualizarCacheLocal(albergue, formData.fechaIngreso, formData.fechaSalida);
//   } else {
//     alert(`Error al realizar la reserva: ${resultado.message}`);
//   }
// }

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

// function validateForm(formData) {
//   // Validación básica de campos requeridos
//   if (Object.values(formData).some(val => !val)) {
//     alert('Por favor complete todos los campos del formulario');
//     return false;
//   }
  
//   // Validación de fechas
//   const ingreso = new Date(formData.fechaIngreso);
//   const salida = new Date(formData.fechaSalida);
  
//   if (salida <= ingreso) {
//     alert('La fecha de salida debe ser posterior a la fecha de ingreso');
//     return false;
//   }
  
//   return true;
// }

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

// Funciones para interactuar con Google Sheets cambiada para recibir DATOS gs
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
      fechaSalida: data.fechaSalida,
      horaSalida: data.horaSalida
    };

    console.log("Datos que se envían al backend:", payload);


    const response = await fetch(CONFIG.googleScriptUrl, {
      method: "POST",
      // body: JSON.stringify(payload),
      // headers: { "Content-Type": "application/json" }
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams(payload)
    });
    
    return await response.json();
  } catch (error) {
    console.error("Error al enviar reserva:", error);
    return { success: false, message: "Error de conexión" };
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

                // Estado del calendario para cada albergue
                // const estadoCalendario = {
                //     maestro: {
                //         mes: new Date().getMonth(),
                //         año: new Date().getFullYear(),
                //     },
                //     tinku: {
                //         mes: new Date().getMonth(),
                //         año: new Date().getFullYear(),
                //     },
                //     aquilina: {
                //         mes: new Date().getMonth(),
                //         año: new Date().getFullYear(),
                //     },
                // };

                // Fechas ocupadas por albergue (simulación)
                // const fechasOcupadas = {
                //     maestro: [
                //         new Date(2024, 10, 11),
                //         new Date(2024, 10, 12),
                //         new Date(2024, 10, 13),
                //         new Date(2024, 10, 18),
                //         new Date(2024, 10, 19),
                //         new Date(2024, 10, 20),
                //         new Date(2024, 10, 21),
                //     ],
                //     tinku: [
                //         new Date(2024, 10, 5),
                //         new Date(2024, 10, 6),
                //         new Date(2024, 10, 7),
                //         new Date(2024, 10, 15),
                //         new Date(2024, 10, 16),
                //         new Date(2024, 10, 25),
                //         new Date(2024, 10, 26),
                //     ],
                //     aquilina: [
                //         new Date(2024, 10, 3),
                //         new Date(2024, 10, 4),
                //         new Date(2024, 10, 10),
                //         new Date(2024, 10, 17),
                //         new Date(2024, 10, 24),
                //         new Date(2024, 10, 25),
                //         new Date(2024, 10, 30),
                //     ],
                // };

                // Función para abrir modales
                
                
                function openModal(albergue) {
                    document
                        .getElementById(`modal-${albergue}`)
                        .classList.add("active");
                    document.body.style.overflow = "hidden";
                    generarCalendario(albergue);
                }

                // Función para cerrar modales
                function closeModal(albergue) {
                    document
                        .getElementById(`modal-${albergue}`)
                        .classList.remove("active");
                    document.body.style.overflow = "auto";
                }

                // Cerrar modal al hacer clic fuera del contenido
                window.onclick = function (event) {
                    if (
                        event.target.classList.contains("modal") &&
                        event.target.classList.contains("active")
                    ) {
                        event.target.classList.remove("active");
                        document.body.style.overflow = "auto";
                    }
                };

                // Manejo de formularios
                // document
                //     .getElementById("reservaFormMaestro")
                //     .addEventListener("submit", function (e) {
                //         e.preventDefault();
                //         submitForm("maestro");
                //     });

                // document
                //     .getElementById("reservaFormTinku")
                //     .addEventListener("submit", function (e) {
                //         e.preventDefault();
                //         submitForm("tinku");
                //     });

                // document
                //     .getElementById("reservaFormAquilina")
                //     .addEventListener("submit", function (e) {
                //         e.preventDefault();
                //         submitForm("aquilina");
                //     });

                // function submitForm(albergue) {
                //     // Obtener valores del formulario
                //     const institucion = document.getElementById(
                //         `institucion-${albergue}`
                //     ).value;
                //     const responsable = document.getElementById(
                //         `responsable-${albergue}`
                //     ).value;
                //     const contacto = document.getElementById(
                //         `contacto-${albergue}`
                //     ).value;
                //     const cantidad = document.getElementById(
                //         `cantidad-${albergue}`
                //     ).value;
                //     const fechaIngreso = document.getElementById(
                //         `fechaIngreso-${albergue}`
                //     ).value;
                //     const horaIngreso = document.getElementById(
                //         `horaIngreso-${albergue}`
                //     ).value;
                //     const fechaSalida = document.getElementById(
                //         `fechaSalida-${albergue}`
                //     ).value;
                //     const horaSalida = document.getElementById(
                //         `horaSalida-${albergue}`
                //     ).value;

                //     // Validación básica
                //     if (
                //         !institucion ||
                //         !responsable ||
                //         !contacto ||
                //         !cantidad ||
                //         !fechaIngreso ||
                //         !horaIngreso ||
                //         !fechaSalida ||
                //         !horaSalida
                //     ) {
                //         alert(
                //             "Por favor complete todos los campos del formulario");
                //         return;
                //     }

                //     // Validar fechas
                //     const ingreso = new Date(fechaIngreso);
                //     const salida = new Date(fechaSalida);

                    // if (salida <= ingreso) {
                    //     alert(
                    //         "La fecha de salida debe ser posterior a la fecha de ingreso"
                    //     );
                    //     return;
                    // }

                //     // Validar disponibilidad de fechas
                //     const fechaIngresoObj = new Date(fechaIngreso);
                //     const fechaSalidaObj = new Date(fechaSalida);

                //     let hayConflicto = false;
                //     for (
                //         let d = new Date(fechaIngresoObj);
                //         d <= fechaSalidaObj;
                //         d.setDate(d.getDate() + 1)
                //     ) {
                //         if (
                //             fechasOcupadas[albergue].some(
                //                 (fecha) =>
                //                     fecha.toDateString() === d.toDateString()
                //             )
                //         ) {
                //             hayConflicto = true;
                //             break;
                //         }
                //     }

                //     if (hayConflicto) {
                //         alert(
                //             "Las fechas seleccionadas no están disponibles. Por favor seleccione otras fechas."
                //         );
                //         return;
                //     }

                //     // Mostrar confirmación
                //     let albergueNombre = "";
                //     if (albergue === "maestro")
                //         albergueNombre = "Albergue Maestro José Fierro";
                //     if (albergue === "tinku")
                //         albergueNombre = "Albergue Tinku Huasi";
                //     if (albergue === "aquilina")
                //         albergueNombre = "Albergue Aquilina Soldati";

                //     alert(
                //         `¡Reserva realizada con éxito!\n\nInstitución: ${institucion}\nResponsable: ${responsable}\nContacto: ${contacto}\nCantidad de personas: ${cantidad}\nAlbergue: ${albergueNombre}\nIngreso: ${fechaIngreso} a las ${horaIngreso}\nSalida: ${fechaSalida} a las ${horaSalida}`
                //     );

                //     // Limpiar formulario y cerrar modal
                //     document
                //         .getElementById(
                //             `reservaForm${
                //                 albergue.charAt(0).toUpperCase() +
                //                 albergue.slice(1)
                //             }`
                //         )
                //         .reset();
                //     closeModal(albergue);
                // }

                // Establecer fechas mínimas


                function setMinDates() {
                    const today = new Date().toISOString().split("T")[0];
                    const inputs =
                        document.querySelectorAll('input[type="date"]');
                    inputs.forEach((input) => {
                        input.min = today;
                    });
                }

                // Actualizar fecha mínima de salida cuando cambia la fecha de ingreso
                function setupDateListeners() {
                    const albergues = ["maestro", "tinku", "aquilina"];
                    albergues.forEach((albergue) => {
                        const ingresoInput = document.getElementById(
                            `fechaIngreso-${albergue}`
                        );
                        const salidaInput = document.getElementById(
                            `fechaSalida-${albergue}`
                        );

                        if (ingresoInput && salidaInput) {
                            ingresoInput.addEventListener(
                                "change",
                                function () {
                                    salidaInput.min = this.value;
                                }
                            );
                        }
                    });
                }

                // Generar calendario dinámico
                function generarCalendario(albergue) {
                    const estado = estadoCalendario[albergue];
                    const mes = estado.mes;
                    const año = estado.año;

                    const primerDia = new Date(año, mes, 1);
                    const ultimoDia = new Date(año, mes + 1, 0);
                    const primerDiaSemana = primerDia.getDay();

                    const diasEnMes = ultimoDia.getDate();

                    const contenedor = document.getElementById(
                        `calendario-${albergue}`
                    );
                    contenedor.innerHTML = "";

                    // Encabezados de días
                    const dias = [
                        "Dom",
                        "Lun",
                        "Mar",
                        "Mié",
                        "Jue",
                        "Vie",
                        "Sáb",
                    ];
                    dias.forEach((dia) => {
                        const diaHeader = document.createElement("div");
                        diaHeader.className = "dia-header";
                        diaHeader.textContent = dia;
                        contenedor.appendChild(diaHeader);
                    });

                    // Días del mes anterior
                    const diasMesAnterior = new Date(año, mes, 0).getDate();
                    for (let i = primerDiaSemana - 1; i >= 0; i--) {
                        const dia = document.createElement("div");
                        dia.className = "dia otro-mes";
                        dia.textContent = diasMesAnterior - i;
                        contenedor.appendChild(dia);
                    }

                    // Días del mes actual
                    const hoy = new Date();
                    for (let i = 1; i <= diasEnMes; i++) {
                        const dia = document.createElement("div");
                        dia.className = "dia";
                        dia.textContent = i;
                        dia.dataset.fecha = `${año}-${String(mes + 1).padStart(
                            2,
                            "0"
                        )}-${String(i).padStart(2, "0")}`;

                        const fechaActual = new Date(año, mes, i);

                        // Marcar día de hoy
                        if (fechaActual.toDateString() === hoy.toDateString()) {
                            dia.classList.add("hoy");
                        }

                        // Marcar días ocupados
                        if (
                            fechasOcupadas[albergue].some(
                                (fecha) =>
                                    fecha.toDateString() ===
                                    fechaActual.toDateString()
                            )
                        ) {
                            dia.classList.add("ocupado");
                        }

                        // Agregar evento de clic
                        dia.addEventListener("click", function () {
                            if (
                                !dia.classList.contains("ocupado") &&
                                !dia.classList.contains("otro-mes")
                            ) {
                                // Mostrar información de disponibilidad
                                const fechaSeleccionada = new Date(año, mes, i);
                                const diaSemana = [
                                    "Domingo",
                                    "Lunes",
                                    "Martes",
                                    "Miércoles",
                                    "Jueves",
                                    "Viernes",
                                    "Sábado",
                                ][fechaSeleccionada.getDay()];
                                const meses = [
                                    "Enero",
                                    "Febrero",
                                    "Marzo",
                                    "Abril",
                                    "Mayo",
                                    "Junio",
                                    "Julio",
                                    "Agosto",
                                    "Septiembre",
                                    "Octubre",
                                    "Noviembre",
                                    "Diciembre",
                                ];

                                let mensaje = `Fecha seleccionada: ${diaSemana}, ${i} de ${meses[mes]} de ${año}\n`;

                                if (
                                    fechasOcupadas[albergue].some(
                                        (fecha) =>
                                            fecha.toDateString() ===
                                            fechaSeleccionada.toDateString()
                                    )
                                ) {
                                    mensaje += "Estado: No disponible\n";
                                } else {
                                    mensaje += "Estado: Disponible\n";
                                }

                                // Mostrar capacidad según albergue
                                let capacidad = 0;
                                let ocupadas = 0;
                                if (albergue === "maestro") {
                                    capacidad = 92;
                                    ocupadas = 32;
                                } else if (albergue === "tinku") {
                                    capacidad = 49;
                                    ocupadas = 29;
                                } else if (albergue === "aquilina") {
                                    capacidad = 58;
                                    ocupadas = 26;
                                }

                                mensaje += `Capacidad total: ${capacidad} personas\n`;
                                mensaje += `Personas ocupadas: ${ocupadas} personas\n`;
                                mensaje += `Disponibles: ${
                                    capacidad - ocupadas
                                } personas`;

                                alert(mensaje);
                            }
                        });

                        contenedor.appendChild(dia);
                    }

                    // Días del mes siguiente
                    const totalCeldas = 42; // 6 filas x 7 días
                    const celdasUsadas = primerDiaSemana + diasEnMes;
                    const diasMesSiguiente = totalCeldas - celdasUsadas;

                    for (let i = 1; i <= diasMesSiguiente; i++) {
                        const dia = document.createElement("div");
                        dia.className = "dia otro-mes";
                        dia.textContent = i;
                        contenedor.appendChild(dia);
                    }

                    // Actualizar título del mes
                    const meses = [
                        "Enero",
                        "Febrero",
                        "Marzo",
                        "Abril",
                        "Mayo",
                        "Junio",
                        "Julio",
                        "Agosto",
                        "Septiembre",
                        "Octubre",
                        "Noviembre",
                        "Diciembre",
                    ];
                    document.getElementById(
                        `mes-actual-${albergue}`
                    ).textContent = `${meses[mes]} ${año}`;
                }

                // Cambiar mes en el calendario
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

                // Inicializar cuando se carga la página
                document.addEventListener("DOMContentLoaded", function () {
                    setMinDates();
                    setupDateListeners();
                });
            