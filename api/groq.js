// Función de Vercel: llama a Groq con la key guardada en las variables de entorno.
// Variables (Vercel → Project → Settings → Environment Variables):
//   GROQ_API_KEY  (obligatoria)  tu key de console.groq.com
//   GROQ_MODEL    (opcional)     por defecto openai/gpt-oss-120b
//   CLAVE_APP     (opcional)     si la pones, la app la pide una vez para que nadie más use tu key
module.exports = async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: { message: "Usa POST." } });

  const key = process.env.GROQ_API_KEY;
  if (!key) return res.status(500).json({ error: { code: "sin_key", message: "Falta la variable GROQ_API_KEY en Vercel." } });

  const clave = process.env.CLAVE_APP;
  if (clave && req.headers["x-clave-app"] !== clave) {
    return res.status(401).json({ error: { code: "clave", message: "Clave de la app incorrecta." } });
  }

  let body = req.body;
  if (typeof body === "string") { try { body = JSON.parse(body); } catch (e) { body = null; } }
  const messages = body && body.messages;
  const ok = Array.isArray(messages) && messages.length > 0 && messages.length <= 4 &&
    messages.every(m => m && (m.role === "system" || m.role === "user") && typeof m.content === "string") &&
    JSON.stringify(messages).length < 80000;
  if (!ok) return res.status(400).json({ error: { message: "Solicitud no válida." } });

  const modelo = process.env.GROQ_MODEL || "openai/gpt-oss-120b";
  try {
    const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": "Bearer " + key },
      body: JSON.stringify({
        model: modelo,
        temperature: 0.2,
        response_format: { type: "json_object" },
        ...(/gpt-oss/.test(modelo) ? { reasoning_effort: "low" } : {}),
        messages
      })
    });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return res.status(502).json({ error: { message: "La GROQ_API_KEY de Vercel no es válida. Revísala y vuelve a desplegar." } });
    if (r.status === 429 && r.headers.get("retry-after")) res.setHeader("Retry-After", r.headers.get("retry-after"));
    if (!r.ok) return res.status(r.status).json({ error: { message: (j.error && j.error.message) || "Groq respondió con error." } });
    return res.status(200).json({ content: j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content });
  } catch (e) {
    return res.status(502).json({ error: { message: "No se pudo conectar con Groq." } });
  }
};
