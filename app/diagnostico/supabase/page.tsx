import type { Metadata } from "next";
import { createClient } from "@/app/lib/supabase/server";
export const metadata: Metadata = {
  title: "Arcade Vault · Diagnóstico Supabase",
  robots: { index: false, follow: false },
};
function maskUrl(url: string): string {
  try {
    const { host, protocol } = new URL(url);
    const [ref, ...rest] = host.split(".");
    const shortRef =
      ref.length > 8 ? `${ref.slice(0, 4)}…${ref.slice(-4)}` : ref;
    return `${protocol}//${[shortRef, ...rest].join(".")}`;
  } catch {
    return "(URL inválida)";
  }
}
type Check = { label: string; value: string; ok: boolean };
export default async function DiagnosticoSupabasePage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const checks: Check[] = [
    {
      label: "NEXT_PUBLIC_SUPABASE_URL",
      value: url ? maskUrl(url) : "ausente",
      ok: Boolean(url),
    },
    {
      label: "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
      value: key ? `presente (${key.slice(0, 16)}…)` : "ausente",
      ok: Boolean(key),
    },
  ];
  let sessionLine: Check;
  if (!url || !key) {
    sessionLine = {
      label: "Conexión",
      value:
        "no se prueba: faltan variables de entorno. Copia .env.example a .env.local con los valores reales.",
      ok: false,
    };
  } else {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.getClaims();
      if (error) {
        sessionLine = {
          label: "Conexión",
          value: `error de Supabase: ${error.message}`,
          ok: false,
        };
      } else {
        const sub = data?.claims?.sub;
        sessionLine = {
          label: "Conexión",
          value: sub ? `OK · sesión de ${sub}` : "OK · sin sesión",
          ok: true,
        };
      }
    } catch (e) {
      sessionLine = {
        label: "Conexión",
        value: `excepción: ${e instanceof Error ? e.message : String(e)}`,
        ok: false,
      };
    }
  }
  const rows = [...checks, sessionLine];
  return (
    <section
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "48px 24px",
        fontFamily: "var(--mono)",
      }}
    >
      <h1 className="pixel neon-cyan" style={{ fontSize: 18, marginBottom: 8 }}>
        ▸ DIAGNÓSTICO SUPABASE
      </h1>
      <p style={{ color: "var(--ink-dim)", fontSize: 13, marginBottom: 24 }}>
        Prueba de humo de los cimientos de Supabase (SPEC 04). No enlazada en el
        Nav; sin indexar.
      </p>
      <ul style={{ listStyle: "none", display: "grid", gap: 10 }}>
        {rows.map((row) => (
          <li
            key={row.label}
            style={{
              display: "grid",
              gridTemplateColumns: "auto 1fr",
              gap: 12,
              padding: "12px 14px",
              border: "1px solid var(--line-2)",
              background: "var(--bg-2)",
              fontSize: 13,
            }}
          >
            <span
              aria-hidden
              style={{ color: row.ok ? "var(--green)" : "var(--magenta)" }}
            >
              {row.ok ? "●" : "▲"}
            </span>
            <span>
              <strong style={{ color: "var(--ink)" }}>{row.label}</strong>
              <br />
              <span style={{ color: "var(--ink-dim)", wordBreak: "break-all" }}>
                {row.value}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
