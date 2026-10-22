// Función de Vercel: envía el PDF a tu script de Google (google-drive/Codigo.gs).
// Variables (Vercel → Project → Settings → Environment Variables):
//   DRIVE_SCRIPT_URL  (obligatoria)  URL de la aplicación web del script (termina en /exec)
//   DRIVE_CLAVE       (obligatoria)  la misma CLAVE que pusiste en el script
//   CLAVE_APP         (opcional)     la misma que usa api/groq.js
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Usa POST." } });

  const url = process.env.DRIVE_SCRIPT_URL;
  if (!url) return res.status(500).json({ error: { message: "Falta DRIVE_SCRIPT_URL en las variables de entorno de Vercel." } });

  const clave = process.env.CLAVE_APP;
  if (clave && req.headers["x-clave-app"] !== clave) {
    return res.status(401).json({ error: { message: "La clave de la app no coincide con CLAVE_APP. Escríbela en «Ajustes de IA»." } });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  if (!body || !["subir", "probar", "borrar"].includes(body.accion)) return res.status(400).json({ error: { message: "Solicitud no válida." } });

  try {
    const r = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ ...body, clave: process.env.DRIVE_CLAVE || "" }),
      redirect: "follow"
    });
    const txt = await r.text();
    let j; try { j = JSON.parse(txt); } catch (e) {
      return res.status(502).json({ error: { message: "El script de Google no respondió bien. Revisa que esté implementado como «Aplicación web» con acceso «Cualquier usuario»." } });
    }
    if (!j.ok) return res.status(502).json({ error: { message: j.error || "Google Drive rechazó la solicitud." } });
    return res.status(200).json(j);
  } catch (e) {
    return res.status(502).json({ error: { message: "No se pudo conectar con Google Drive." } });
  }
};
