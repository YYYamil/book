function doPost(e) {
  try {
    Logger.log("Datos recibidos: " + JSON.stringify(e.parameter));
    const data = e.parameter;

    // Validar clave secreta
    if (data.secret !== "cristiano1988") {
      Logger.log("Error: Clave secreta inválida");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "No autorizado"
      })).setMimeType(ContentService.MimeType.JSON);
    }

//Disponibilidad DIARIA:
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


    // Crear reserva y actualizar disponibilidad
    if (data.action === "crearReserva") {
      const hojaReservas = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reservas");
      const hojaDisponibilidad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Disponibilidad");
      const hojaConfig = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuraciones");

      if (!hojaReservas || !hojaDisponibilidad || !hojaConfig) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Faltan hojas necesarias"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const nuevoId = new Date().getTime();
      hojaReservas.appendRow([
        nuevoId,
        new Date(),
        data.albergue,
        data.institucion,
        data.responsable,
        data.contacto,
        parseInt(data.cantidad),
        data.fechaIngreso,
        data.horaIngreso,
        "Confirmada"
      ]);

      const fecha = data.fechaIngreso;
      const albergue = data.albergue;
      const cantidad = parseInt(data.cantidad);

      const config = hojaConfig.getDataRange().getValues();
      const filaAlbergue = config.find(row => row[2] === albergue);
      const capacidadMaxima = filaAlbergue ? parseInt(filaAlbergue[1]) : 0;

      const datosDisp = hojaDisponibilidad.getDataRange().getValues();

      let filaEncontrada = null;
      let disponiblesPrevios = null;

      for (let i = datosDisp.length - 1; i >= 0; i--) {
        const row = datosDisp[i];
        const rowFecha = typeof row[0] === "object" && row[0] instanceof Date
          ? Utilities.formatDate(row[0], Session.getScriptTimeZone(), "yyyy-MM-dd")
          : row[0];
        const rowAlbergue = (row[1] || "").toString().trim();

        if (rowFecha === fecha && rowAlbergue === albergue.trim()) {
          filaEncontrada = row;
          disponiblesPrevios = parseInt(row[4]) || 0;
          break;
        }
      }

      let nuevosOcupados, nuevosDisponibles;

      if (filaEncontrada) {
        nuevosOcupados = cantidad;
        nuevosDisponibles = disponiblesPrevios - cantidad;
      } else {
        nuevosOcupados = cantidad;
        nuevosDisponibles = capacidadMaxima - cantidad;
      }

      hojaDisponibilidad.appendRow([
        fecha,
        albergue,
        nuevosOcupados,
        capacidadMaxima,
        nuevosDisponibles
      ]);

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Reserva creada exitosamente",
        idReserva: nuevoId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Acción inválida
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Acción no válida"
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (error) {
    Logger.log("Error en el servidor: " + error.message);
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error en el servidor: " + error.message
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

  // Capacidad Máxima desde Configuraciones (col 2 = capacidad, col 3 = nombre)
  const cfg = hojaConfig.getDataRange().getValues();
  let capacidadMax = 0;
  for (let i = 1; i < cfg.length; i++) {
    const nombre = (cfg[i][2] || "").toString().trim();
    if (nombre === albergueFullName) {
      capacidadMax = parseInt(cfg[i][1], 10) || 0;
      break;
    }
  }

  // Buscar última fila para esa fecha y albergue en "Disponibilidad"
  const datos = hojaDisp.getDataRange().getValues();
  let fila = null;
  for (let i = datos.length - 1; i >= 1; i--) {
    const rowFecha = (datos[i][0] instanceof Date)
      ? Utilities.formatDate(datos[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
      : (datos[i][0] || "").toString().trim();
    const rowAlbergue = (datos[i][1] || "").toString().trim();
    if (rowFecha === fechaISO && rowAlbergue === albergueFullName) {
      fila = datos[i];
      break;
    }
  }

  if (fila) {
    const ocupados     = parseInt(fila[2], 10) || 0; // col 3
    const disponibles  = parseInt(fila[4], 10) || 0; // col 5
    return { capacidad: capacidadMax, ocupados, disponibles };
  }
  // Sin registro: por consigna, mostrar "Capacidad Máxima"
  return { capacidad: capacidadMax, ocupados: 0, disponibles: capacidadMax };
}
