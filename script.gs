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

    // Obtener disponibilidad completa
    if (data.action === "getDisponibilidad") {
      const hoja = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Disponibilidad");
      if (!hoja) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Hoja 'Disponibilidad' no encontrada"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const datos = hoja.getDataRange().getValues();
      const respuesta = datos.slice(1).map(row => ({
        fecha: row[0],
        albergue: row[1],
        ocupados: parseInt(row[2]),
        capacidad: parseInt(row[3]),
        disponibles: parseInt(row[4])
      }));

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        data: respuesta
      })).setMimeType(ContentService.MimeType.JSON);
    }

    // Obtener disponibilidad por día
    if (data.action === "obtenerDisponibilidadDia") {
      const albergue = data.albergue;
      const fecha = data.fecha;

      const hojaDisponibilidad = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Disponibilidad");
      const hojaConfig = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Configuraciones");

      if (!hojaDisponibilidad || !hojaConfig) {
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "No se encontraron las hojas necesarias"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const config = hojaConfig.getDataRange().getValues();
      const filaAlbergue = config.find(row => row[2] === albergue);
      const capacidad = filaAlbergue ? parseInt(filaAlbergue[1]) : 0;

      const datos = hojaDisponibilidad.getDataRange().getValues();
      const fila = datos.find(row => row[0] === fecha && row[1] === albergue);
      const ocupados = fila ? parseInt(fila[2]) : 0;

      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        fecha,
        albergue,
        capacidad,
        ocupados,
        disponibles: capacidad - ocupados
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
        data.fechaSalida,
        data.horaSalida,
        "Confirmada"
      ]);

      const fechas = getFechasRango(data.fechaIngreso, data.fechaSalida);
      const albergue = data.albergue;
      const cantidad = parseInt(data.cantidad);

      const config = hojaConfig.getDataRange().getValues();
      const filaAlbergue = config.find(row => row[2] === albergue);
      const capacidadMaxima = filaAlbergue ? parseInt(filaAlbergue[1]) : 0;

      const datosDisp = hojaDisponibilidad.getDataRange().getValues();

      fechas.forEach(fecha => {
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
      });

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

function getFechasRango(inicio, fin) {
  const fechas = [];
  let actual = new Date(inicio);
  const hasta = new Date(fin);

  while (actual <= hasta) {
    fechas.push(actual.toISOString().split("T")[0]);
    actual.setDate(actual.getDate() + 1);
  }
  return fechas;
}

function doGet(e) {
  return ContentService.createTextOutput(JSON.stringify({
    success: false,
    message: "Método GET no soportado. Use POST para crear reservas o consultar disponibilidad."
  })).setMimeType(ContentService.MimeType.JSON);
}
