export interface ContactPayload {
  name: string;
  email: string;
  msg: string;
  company?: string; // honeypot; si viene relleno es un bot
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_MSG = 5000;

// Devuelve el primer mensaje de error, o null si el payload es válido.
export function validateContact(payload: ContactPayload): string | null {
  const name = (payload.name ?? "").trim();
  const email = (payload.email ?? "").trim();
  const msg = (payload.msg ?? "").trim();

  if (!name) return "El nombre es obligatorio.";
  if (!email) return "El correo es obligatorio.";
  if (!EMAIL_RE.test(email)) return "El correo no tiene un formato válido.";
  if (!msg) return "El mensaje es obligatorio.";
  if (msg.length > MAX_MSG) return `El mensaje no puede superar los ${MAX_MSG} caracteres.`;

  return null;
}
