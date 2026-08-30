import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = {
  title: "Enlace no válido · Arcade Vault",
  robots: { index: false },
};
export default function AuthErrorPage() {
  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card" style={{ textAlign: "center" }}>
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-magenta">ENLACE NO VÁLIDO</h2>
        </div>
        <p
          className="mono"
          style={{
            fontSize: 13,
            color: "var(--ink-dim)",
            lineHeight: 1.7,
            margin: "8px 0 20px",
          }}
        >
          No pudimos validar el enlace. Puede que haya caducado, que ya se
          hubiera usado, o que la dirección esté incompleta.
        </p>
        <Link className="btn lg" href="/entrar" style={{ width: "100%" }}>
          VOLVER A ENTRAR
        </Link>
      </div>
    </div>
  );
}
