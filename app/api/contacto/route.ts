import { Resend } from "resend";
import { validateContact, type ContactPayload } from "@/app/lib/contact";

const TO = "rodriguezdavid2712@gmail.com";
const FROM = "Arcade Vault <onboarding@resend.dev>";

export async function POST(request: Request) {
  let payload: ContactPayload;
  try {
    payload = (await request.json()) as ContactPayload;
  } catch {
    return Response.json({ ok: false, error: "Cuerpo JSON inválido." }, { status: 400 });
  }

  // Honeypot: si viene relleno es un bot. Fingimos éxito y no enviamos nada.
  if ((payload.company ?? "").trim() !== "") {
    return Response.json({ ok: true });
  }

  const invalid = validateContact(payload);
  if (invalid) {
    return Response.json({ ok: false, error: invalid }, { status: 400 });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.error("[contacto] Falta RESEND_API_KEY en el entorno.");
    return Response.json(
      { ok: false, error: "El servicio de correo no está configurado." },
      { status: 500 },
    );
  }

  const name = payload.name.trim();
  const email = payload.email.trim();
  const msg = payload.msg.trim();

  const text = [
    `Nuevo mensaje desde el formulario de Arcade Vault.`,
    ``,
    `Nombre:  ${name}`,
    `Correo:  ${email}`,
    ``,
    `Mensaje:`,
    msg,
  ].join("\n");

  try {
    const resend = new Resend(apiKey);
    const { error } = await resend.emails.send({
      from: FROM,
      to: TO,
      replyTo: email,
      subject: `[Arcade Vault] Mensaje de ${name}`,
      text,
    });

    if (error) {
      console.error("[contacto] Error de Resend:", error);
      return Response.json(
        { ok: false, error: "No se pudo enviar el mensaje. Inténtalo más tarde." },
        { status: 502 },
      );
    }
  } catch (err) {
    console.error("[contacto] Excepción al enviar:", err);
    return Response.json(
      { ok: false, error: "No se pudo enviar el mensaje. Inténtalo más tarde." },
      { status: 502 },
    );
  }

  return Response.json({ ok: true });
}
