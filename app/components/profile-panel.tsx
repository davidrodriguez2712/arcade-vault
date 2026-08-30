"use client";
import { useActionState } from "react";
import { signOut, updateUsername } from "@/app/lib/auth-actions";
import { AUTH_INITIAL_STATE } from "@/app/lib/auth-shared";
export default function ProfilePanel({
  email,
  username,
}: {
  email: string | null;
  username: string;
}) {
  const [state, action, pending] = useActionState(
    updateUsername,
    AUTH_INITIAL_STATE,
  );
  return (
    <div className="auth-card">
      <div className="auth-header">
        <div className="mark"></div>
        <h2 className="neon-cyan">TU PERFIL</h2>
      </div>
      <div className="field">
        <label htmlFor="pf-email">Correo electrónico</label>
        <input id="pf-email" type="email" value={email ?? "—"} disabled />
      </div>
      <form action={action}>
        <div className="field">
          <label htmlFor="pf-user">Nombre de jugador</label>
          <input
            id="pf-user"
            name="username"
            defaultValue={username}
            autoComplete="username"
            minLength={3}
            maxLength={16}
            required
          />
        </div>
        {state.error && (
          <p className="auth-msg" role="alert">
            {state.error}
          </p>
        )}
        {state.ok && (
          <p className="auth-ok" role="status">
            Nombre de jugador actualizado.
          </p>
        )}
        <button
          className="btn lg"
          type="submit"
          style={{ width: "100%", marginTop: 8 }}
          disabled={pending}
        >
          {pending ? "GUARDANDO…" : "GUARDAR CAMBIOS"}
        </button>
      </form>
      <form action={signOut}>
        <button
          className="btn ghost"
          type="submit"
          style={{ width: "100%", marginTop: 10 }}
        >
          CERRAR SESIÓN
        </button>
      </form>
    </div>
  );
}
