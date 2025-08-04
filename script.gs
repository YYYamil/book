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

    // Verificar acción
    if (data.action === "crearReserva") {
      const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Reservas");
      if (!sheet) {
        Logger.log("Error: Hoja 'Reservas' no encontrada");
        return ContentService.createTextOutput(JSON.stringify({
          success: false,
          message: "Hoja 'Reservas' no encontrada"
        })).setMimeType(ContentService.MimeType.JSON);
      }

      const nuevoId = new Date().getTime();
      Logger.log("Guardando reserva con ID: " + nuevoId);

      sheet.appendRow([
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

      Logger.log("Reserva guardada exitosamente");
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: "Reserva creada exitosamente",
        idReserva: nuevoId
      })).setMimeType(ContentService.MimeType.JSON);
    }

    Logger.log("Error: Acción no válida - " + data.action);
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
    message: "Método GET no soportado. Use POST para crear reservas."
  })).setMimeType(ContentService.MimeType.JSON);
}


