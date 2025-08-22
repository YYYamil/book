function doPost(e) {
  try {
    //Logger.log("Datos recibidos: " + JSON.stringify(e && e.parameter));
    const data = (e && e.parameter) ? e.parameter : {};

    // Validar clave secreta
    if ((data.secret || "") !== "cristiano1988") {
      //Logger.log("Error: Clave secreta inválida");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        //message: "No autorizado"
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // === Disponibilidad DIARIA ===
    if (data.action === "obtenerDisponibilidadDia") {
      const fechaISO = (data.fecha || "").trim();      // "yyyy-MM-dd"
      const albergue = (data.albergue || "").trim();   // nombre completo

      const resultado = obtenerDisponibilidadDia_(fechaISO, albergue);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fecha: fechaISO,
        albergue: albergue,
        capacidad: resultado.capacidad,
        ocupados: resultado.ocupados,
        disponibles: resultado.disponibles
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // === Crear reserva y actualizar disponibilidad (solo si pernocta es true) ===
    if (data.action === "crearReserva") {
      const ss = SpreadsheetApp.getActiveSpreadsheet();
      const hojaReservas       = ss.getSheetByName("Reservas");
      const hojaDisponibilidad = ss.getSheetByName("Disponibilidad");
      const hojaConfig         = ss.getSheetByName("Configuraciones");

      const horaEgreso = (data.horaEgreso || "").toString().trim();
      const hospeda    = (horaEgreso === "Pasar la noche");

      if (!hojaReservas || !hojaDisponibilidad || !hojaConfig) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          //message: "Faltan hojas necesarias"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Pernocta ("true"/"false" como string)
      const pernoctaRaw   = (data.pernocta ?? "false").toString().trim().toLowerCase();
      const esPernocta    = hospeda || (pernoctaRaw === "true" || pernoctaRaw === "1" || pernoctaRaw === "sí" || pernoctaRaw === "si");
      const pernoctaValue = esPernocta ? "Sí" : "No";
      //Logger.log(`Procesando reserva, pernocta: ${pernoctaValue}, raw: ${data.pernocta}, tipo: ${typeof data.pernocta}`);

      const fecha    = (data.fechaIngreso || "").toString().trim();   // "yyyy-MM-dd"
      const albergue = (data.albergue || "").toString().trim();
      const cantidad = Math.max(0, parseInt(data.cantidad, 10) || 0);

      const nuevoId = new Date().getTime();


      // Capacidad máxima desde Configuraciones
      const cfg = hojaConfig.getDataRange().getValues();
      const filaAlbergue = cfg.find(row => (row[2] || "").toString().trim() === albergue);
      const capacidadMaxima = filaAlbergue ? (parseInt(filaAlbergue[1], 10) || 0) : 0;

      if (capacidadMaxima <= 0) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          //message: `Albergue "${albergue}" no configurado`
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Si es pernocta, validar y actualizar "Disponibilidad"
      // Si es pernocta, validar y actualizar "Disponibilidad"
if (esPernocta) {
  const datosDisp = hojaDisponibilidad.getDataRange().getValues();

  // 1) Sumar TODAS las "Cantidad reservada" (col 4) para esa fecha+albergue
  let totalReservadoPrevio = 0;
  for (let i = datosDisp.length - 1; i >= 1; i--) {  // salteo encabezado
    const rowFecha = (datosDisp[i][0] instanceof Date)
      ? Utilities.formatDate(datosDisp[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
      : (datosDisp[i][0] || "").toString().trim();
    const rowAlbergue = (datosDisp[i][1] || "").toString().trim();

    if (rowFecha === fecha && rowAlbergue === albergue) {
      const cantReserva = parseInt(datosDisp[i][3], 10); // ← col 4 = Cantidad reservada
      if (!isNaN(cantReserva)) totalReservadoPrevio += cantReserva;
    }
  }

  // 2) Nuevo total reservado = previo + la cantidad actual que se está reservando
  const nuevoTotalReservado = totalReservadoPrevio + cantidad;

  // 3) Disponibles = capacidad máxima - total reservado
  const nuevosDisponibles = capacidadMaxima - nuevoTotalReservado;

  // Permitir 0, rechazar solo si quedaría negativo
  if (nuevosDisponibles < 0) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false
    })).setMimeType(ContentService.MimeType.JSON);
  }

  // 4) Guardar fila:
  //    col 3 = ocupados acumulados (total reservado),
  //    col 4 = cantidad de ESTA reserva,
  //    col 5 = disponibles calculados
  hojaDisponibilidad.appendRow([
    fecha,
    albergue,
    nuevoTotalReservado,   // col 3: ocupados/acumulado
    cantidad,              // col 4: Cantidad reservada de ESTA reserva
    nuevosDisponibles,      // col 5: Disponibles calculados
    nuevoId                
  ]);
}


      // Guardar la reserva (incluyendo "Sí"/"No" por pernocta)
      hojaReservas.appendRow([
        nuevoId,
        new Date(),
        albergue,
        data.institucion,
        data.responsable,
        data.contacto,
        parseInt(data.cantidad, 10) || 0,
        fecha,
        data.horaIngreso,
        horaEgreso,
        pernoctaValue,
        "Pre-Reserva"
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        //message: "Reserva creada exitosamente",
        idReserva: nuevoId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Acción inválida
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      //message: "Acción no válida"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error en el servidor: " + (error && error.stack ? error.stack : error));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      //message: "Error en el servidor: " + (error && error.message ? error.message : error)
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: "Método GET no soportado. Use POST para crear reservas o consultar disponibilidad."
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Devuelve {capacidad, ocupados, disponibles} para un albergue y fecha ISO.
 * Si no hay registro en "Disponibilidad", disponibles = capacidad (capacidad máxima).
 */
function obtenerDisponibilidadDia_(fechaISO, albergueFullName) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const hojaDisp   = ss.getSheetByName("Disponibilidad");
  const hojaConfig = ss.getSheetByName("Configuraciones");
  if (!hojaDisp || !hojaConfig) {
    throw new Error("Faltan hojas necesarias (Disponibilidad/Configuraciones).");
  }

  // 1) Capacidad desde Configuraciones (col 2 = capacidad, col 3 = nombre)
  const cfg = hojaConfig.getDataRange().getValues();
  let capacidadMax = 0;
  for (let i = 1; i < cfg.length; i++) {
    const nombre = (cfg[i][2] || "").toString().trim();
    if (nombre === albergueFullName) {
      capacidadMax = parseInt(cfg[i][1], 10) || 0;
      break;
    }
  }

  // 2) Sumar TODAS las reservas (col 4) para esa fecha + albergue
  const datos = hojaDisp.getDataRange().getValues();
  let totalReservado = 0;

  for (let i = 1; i < datos.length; i++) { // salteo encabezado
    const rowFecha = (datos[i][0] instanceof Date)
      ? Utilities.formatDate(datos[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
      : (datos[i][0] || "").toString().trim();
    const rowAlbergue = (datos[i][1] || "").toString().trim();

    if (rowFecha === fechaISO && rowAlbergue === albergueFullName) {
      const cant = parseInt(datos[i][3], 10); // col 4 = "Cantidad reservada"
      if (!isNaN(cant)) totalReservado += cant;
    }
  }

  // 3) Ocupados/Disponibles derivados
  const ocupados    = totalReservado;
  const disponibles = Math.max(0, capacidadMax - totalReservado);

  return { capacidad: capacidadMax, ocupados, disponibles };
}
