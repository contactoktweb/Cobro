/**
 * Cuentas de cobro K&T → Google Drive
 *
 * Guarda los PDF que subes desde la app: las cuentas de cobro en la carpeta «Cuentas de cobro K&T»
 * y las cotizaciones en la carpeta «Cotizaciones» (se crea sola si no existe).
 * Anota cada uno en la hoja «Registro de cuentas de cobro» (dentro de la carpeta de cuentas de cobro).
 *
 * Instalación (una sola vez):
 *  1. Entra a https://script.google.com → Nuevo proyecto. Borra lo que haya y pega este archivo.
 *  2. Cambia CLAVE por una clave tuya (la misma va en Vercel como DRIVE_CLAVE o en config.js como driveClave).
 *  3. Implementar → Nueva implementación → tipo «Aplicación web».
 *     Ejecutar como: «Yo». Quién tiene acceso: «Cualquier usuario».
 *  4. Autoriza los permisos y copia la URL que termina en /exec.
 */
const CLAVE = 'PON_AQUI_TU_CLAVE';
const CARPETA = 'Cuentas de cobro K&T';
const CARPETA_COTIZ = 'Cotizaciones';
const HOJA = 'Registro de cuentas de cobro';

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    if (d.clave !== CLAVE) return responder({ ok: false, error: 'Clave de Drive incorrecta.' });
    const carpeta = obtenerCarpeta(CARPETA);
    const carpetaCot = obtenerCarpeta(CARPETA_COTIZ);
    const ambas = [carpeta, carpetaCot];
    if (d.accion === 'probar') return responder({ ok: true, carpeta: carpeta.getName() + ' y ' + carpetaCot.getName() });

    if (d.accion === 'borrar') {
      if (!d.id) return responder({ ok: false, error: 'Falta el archivo a borrar.' });
      const borrado = enviarAPapelera(ambas, d.id);
      quitarDelRegistro(d.id);
      return responder({ ok: true, borrado: borrado });
    }

    if (d.accion !== 'subir' || !d.pdf || !d.nombre) return responder({ ok: false, error: 'Solicitud incompleta.' });
    // Si la cuenta ya estaba en Drive y cambió, la versión anterior va a la papelera
    if (d.reemplazar) { enviarAPapelera(ambas, d.reemplazar); quitarDelRegistro(d.reemplazar); }

    const nombre = String(d.nombre).slice(0, 200) + '.pdf';
    const destino = d.tipo === 'cotizacion' ? carpetaCot : carpeta;
    const archivo = destino.createFile(Utilities.newBlob(Utilities.base64Decode(d.pdf), 'application/pdf', nombre));
    registrar(carpeta, d, nombre, archivo.getUrl());
    return responder({ ok: true, url: archivo.getUrl(), id: archivo.getId() });
  } catch (err) {
    return responder({ ok: false, error: 'Error en el script de Google: ' + err });
  }
}

function doGet() {
  return responder({ ok: true, mensaje: 'Servicio de cuentas de cobro K&T activo.' });
}

function obtenerCarpeta(nombre) {
  const it = DriveApp.getFoldersByName(nombre);
  return it.hasNext() ? it.next() : DriveApp.createFolder(nombre);
}

function registrar(carpeta, d, nombre, url) {
  const props = PropertiesService.getScriptProperties();
  let hoja = null;
  const id = props.getProperty('HOJA_ID');
  if (id) { try { hoja = SpreadsheetApp.openById(id); } catch (e) { hoja = null; } }
  if (!hoja) {
    hoja = SpreadsheetApp.create(HOJA);
    DriveApp.getFileById(hoja.getId()).moveTo(carpeta);
    props.setProperty('HOJA_ID', hoja.getId());
    const h = hoja.getSheets()[0];
    h.appendRow(['Subido', 'Fecha de la cuenta', 'Cliente', 'NIT / CC', 'Valor', 'Archivo', 'Enlace', 'Tipo']);
    h.getRange(1, 1, 1, 8).setFontWeight('bold');
    h.setFrozenRows(1);
  }
  const h0 = hoja.getSheets()[0];
  if (!h0.getRange(1, 8).getValue()) h0.getRange(1, 8).setValue('Tipo').setFontWeight('bold'); // hojas creadas antes de las cotizaciones
  h0.appendRow([new Date(), d.fecha || '', d.cliente || '', d.nit || '', d.valor || '', nombre, url, d.tipo === 'cotizacion' ? 'Cotización' : 'Cuenta de cobro']);
}

// Solo toca archivos que estén dentro de la carpeta de cuentas de cobro o la de cotizaciones.
function enviarAPapelera(carpetas, id) {
  try {
    const f = DriveApp.getFileById(String(id));
    const padres = f.getParents();
    let enCarpeta = false;
    while (padres.hasNext()) { const pid = padres.next().getId(); if (carpetas.some(c => c.getId() === pid)) enCarpeta = true; }
    if (!enCarpeta) return false;
    f.setTrashed(true);
    return true;
  } catch (e) {
    return false; // ya no existe
  }
}

function quitarDelRegistro(id) {
  const hojaId = PropertiesService.getScriptProperties().getProperty('HOJA_ID');
  if (!hojaId) return;
  try {
    const h = SpreadsheetApp.openById(hojaId).getSheets()[0];
    const filas = h.getDataRange().getValues();
    for (let i = filas.length - 1; i >= 1; i--) {
      if (String(filas[i][6]).indexOf(String(id)) !== -1) h.deleteRow(i + 1);
    }
  } catch (e) { /* el registro es opcional */ }
}

function responder(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
