"use client";
import { useActionState, useState } from "react";
import Link from "next/link";
import { signIn, signUp } from "@/app/lib/auth-actions";
import { AUTH_INITIAL_STATE, DEFAULT_NEXT } from "@/app/lib/auth-shared";
import { createClient } from "@/app/lib/supabase/client";
type Provider = "google" | "github";
export default function AuthCard({ next = DEFAULT_NEXT }: { next?: string }) {
  const [tab, setTab] = useState<"in" | "up">("in");
  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    AUTH_INITIAL_STATE,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    AUTH_INITIAL_STATE,
  );
  const [oauthError, setOauthError] = useState<string | null>(null);
  // El alta con confirmación de correo activa devuelve `needsConfirmation` sin
  // sesión: mientras sigamos en la pestaña de alta mostramos el aviso.
  const showConfirm =
    tab === "up" && signUpState.ok && !!signUpState.needsConfirmation;
  const oauth = async (provider: Provider) => {
    setOauthError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setOauthError(
        "No se pudo iniciar sesión con ese proveedor. Inténtalo de nuevo.",
      );
    }
  };
  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark"></div>
        <h2 className="neon-cyan">ARCADE VAULT</h2>
        <div
          className="mono"
          style={{
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.16em",
            marginTop: 6,
          }}
        >
          ACCESO AL SISTEMA · v2.6
        </div>
      </div>
      {showConfirm ? (
        <div className="auth-notice">
          <p className="pixel neon-cyan" style={{ fontSize: 11, margin: 0 }}>
            REVISA TU CORREO
          </p>
          <p className="mono">
            Te hemos enviado un enlace de confirmación a{" "}
            <strong>{signUpState.email}</strong>. Ábrelo para activar tu cuenta
            y entrar al Vault.
          </p>
          <button
            className="btn ghost"
            type="button"
            style={{ width: "100%" }}
            onClick={() => setTab("in")}
          >
            VOLVER A INICIAR SESIÓN
          </button>
        </div>
      ) : (
        <>
          <div className="auth-tabs">
            <button
              type="button"
              className={tab === "in" ? "on" : ""}
              onClick={() => setTab("in")}
            >
              INICIAR SESIÓN
            </button>
            <button
              type="button"
              className={tab === "up" ? "on" : ""}
              onClick={() => setTab("up")}
            >
              CREAR CUENTA
            </button>
          </div>
          {tab === "in" ? (
            <form action={signInAction} key="in">
              <input type="hidden" name="next" value={next} />
              <div className="field">
                <label htmlFor="in-email">Correo electrónico</label>
                <input
                  id="in-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jugador@vault.gg"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="in-pass">Contraseña</label>
                <input
                  id="in-pass"
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
              </div>
              {signInState.error && (
                <p className="auth-msg" role="alert">
                  {signInState.error}
                </p>
              )}
              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={signInPending}
              >
                {signInPending ? "ENTRANDO…" : "ENTRAR AL VAULT"}
              </button>
            </form>
          ) : (
            <form action={signUpAction} key="up">
              <div className="field">
                <label htmlFor="up-user">Nombre de jugador</label>
                <input
                  id="up-user"
                  name="username"
                  autoComplete="username"
                  placeholder="px_kai"
                  minLength={3}
                  maxLength={16}
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="up-email">Correo electrónico</label>
                <input
                  id="up-email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="jugador@vault.gg"
                  required
                />
              </div>
              <div className="field">
                <label htmlFor="up-pass">Contraseña</label>
                <input
                  id="up-pass"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="mínimo 8 caracteres"
                  minLength={8}
                  required
                />
              </div>
              {signUpState.error && (
                <p className="auth-msg" role="alert">
                  {signUpState.error}
                </p>
              )}
              <button
                className="btn lg"
                type="submit"
                style={{ width: "100%", marginTop: 8 }}
                disabled={signUpPending}
              >
                {signUpPending ? "CREANDO…" : "CREAR Y JUGAR"}
              </button>
            </form>
          )}
          <Link
            className="btn ghost"
            href="/biblioteca"
            style={{
              width: "100%",
              marginTop: 10,
              display: "block",
              textAlign: "center",
            }}
          >
            JUGAR COMO INVITADO
          </Link>
          <div className="auth-divider">O CONTINÚA CON</div>
          {oauthError && (
            <p className="auth-msg" role="alert">
              {oauthError}
            </p>
          )}
          <div className="social">
            <button
              className="btn ghost"
              type="button"
              onClick={() => oauth("google")}
            >
              ◆ GOOGLE
            </button>
            <button
              className="btn ghost"
              type="button"
              onClick={() => oauth("github")}
            >
              ▣ GITHUB
            </button>
          </div>
          <div
            style={{
              marginTop: 18,
              textAlign: "center",
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.1em",
            }}
          >
            AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
          </div>
        </>
      )}
    </div>
  );
}
