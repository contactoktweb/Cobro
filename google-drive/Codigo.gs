// Script de Google (Apps Script) para guardar los PDF en tu Drive.
// Reconstruido: guarda las cuentas de cobro y las cotizaciones en carpetas distintas.
// Cómo usarlo: script.google.com → pega este código → pon abajo la MISMA clave que DRIVE_CLAVE en Vercel →
// Implementar → Nueva implementación → Aplicación web (Ejecutar como: yo · Acceso: Cualquier usuario).
// Si ya tenías una implementación, usa «Administrar implementaciones» → editar → Nueva versión (la URL /exec no cambia).
const CLAVE = "PON_AQUI_LA_MISMA_CLAVE_QUE_DRIVE_CLAVE";
const CARPETA_COBROS = "Cuentas de cobro K&T";
const CARPETA_COTIZACIONES = "Cotizaciones";

function carpeta_(nombre) {
  const it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre); // si no existe, la crea
}
function salida_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (CLAVE && d.clave !== CLAVE) return salida_({ok: false, error: "Clave incorrecta."});
    if (d.accion === "probar") {
      carpeta_(CARPETA_COBROS); carpeta_(CARPETA_COTIZACIONES);
      return salida_({ok: true, carpeta: CARPETA_COBROS + " y " + CARPETA_COTIZACIONES});
    }
    if (d.accion === "subir") {
      const dest = carpeta_(d.tipo === "cotizacion" ? CARPETA_COTIZACIONES : CARPETA_COBROS);
      const blob = Utilities.newBlob(Utilities.base64Decode(d.pdf), "application/pdf", d.nombre + ".pdf");
      if (d.reemplazar) { try { DriveApp.getFileById(d.reemplazar).setTrashed(true); } catch (err) {} }
      const f = dest.createFile(blob);
      return salida_({ok: true, url: f.getUrl(), id: f.getId()});
    }
    if (d.accion === "borrar") {
      DriveApp.getFileById(d.id).setTrashed(true);
      return salida_({ok: true});
    }
    return salida_({ok: false, error: "Acción no válida."});
  } catch (err) {
    return salida_({ok: false, error: String(err)});
  }
}
