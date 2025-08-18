function doPost(e) {
  try {
    Logger.log("Datos recibidos: " + JSON.stringify(e && e.parameter));
    const data = (e && e.parameter) ? e.parameter : {};

    // Validar clave secreta
    if ((data.secret || "") !== "cristiano1988") {
      Logger.log("Error: Clave secreta inválida");
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: "No autorizado"
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

      if (!hojaReservas || !hojaDisponibilidad || !hojaConfig) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Faltan hojas necesarias"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Pernocta ("true"/"false" como string)
      const pernoctaRaw   = (data.pernocta ?? "false").toString().trim().toLowerCase();
      const esPernocta    = (pernoctaRaw === "true" || pernoctaRaw === "1" || pernoctaRaw === "sí" || pernoctaRaw === "si");
      const pernoctaValue = esPernocta ? "Sí" : "No";
      Logger.log(`Procesando reserva, pernocta: ${pernoctaValue}, raw: ${data.pernocta}, tipo: ${typeof data.pernocta}`);

      const fecha    = (data.fechaIngreso || "").toString().trim();   // "yyyy-MM-dd"
      const albergue = (data.albergue || "").toString().trim();
      const cantidad = Math.max(0, parseInt(data.cantidad, 10) || 0);

      // Capacidad máxima desde Configuraciones
      const cfg = hojaConfig.getDataRange().getValues();
      const filaAlbergue = cfg.find(row => (row[2] || "").toString().trim() === albergue);
      const capacidadMaxima = filaAlbergue ? (parseInt(filaAlbergue[1], 10) || 0) : 0;

      if (capacidadMaxima <= 0) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: `Albergue "${albergue}" no configurado`
        })).setMimeType(ContentService.MimeType.JSON);
      }

      // Si es pernocta, validar y actualizar "Disponibilidad"
      if (esPernocta) {
        const datosDisp = hojaDisponibilidad.getDataRange().getValues();
        let filaEncontrada = null;

        // Buscar la última fila para ese día/albergue (desde el final)
        for (let i = datosDisp.length - 1; i >= 1; i--) {
          const rowFecha = (datosDisp[i][0] instanceof Date)
            ? Utilities.formatDate(datosDisp[i][0], Session.getScriptTimeZone(), "yyyy-MM-dd")
            : (datosDisp[i][0] || "").toString().trim();
          const rowAlbergue = (datosDisp[i][1] || "").toString().trim();
          if (rowFecha === fecha && rowAlbergue === albergue) {
            filaEncontrada = datosDisp[i];
            break;
          }
        }

        const ocupadosPrevios    = filaEncontrada ? (parseInt(filaEncontrada[2], 10) || 0) : 0;
        const nuevosOcupados     = ocupadosPrevios + cantidad;
        const nuevosDisponibles  = capacidadMaxima - nuevosOcupados;

        // Permitir 0, rechazar sólo si quedaría negativo
        if (nuevosDisponibles < 0) {
          Logger.log(`Error: No hay lugares disponibles para ${albergue} el ${fecha}. Sobra: ${-nuevosDisponibles}`);
          return ContentService.createTextOutput(JSON.stringify({
            success: false,
            message: `No hay lugares disponibles para ${albergue} el ${fecha}`
          })).setMimeType(ContentService.MimeType.JSON);
        }

        hojaDisponibilidad.appendRow([
          fecha,
          albergue,
          nuevosOcupados,      // acumulado
          capacidadMaxima,
          nuevosDisponibles
        ]);
      }

      // Guardar la reserva (incluyendo "Sí"/"No" por pernocta)
      const nuevoId = new Date().getTime();
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
        pernoctaValue,         // si tu hoja no tiene esta columna, podés quitarla
        "Confirmada"
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
    Logger.log("Error en el servidor: " + (error && error.stack ? error.stack : error));
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: "Error en el servidor: " + (error && error.message ? error.message : error)
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
