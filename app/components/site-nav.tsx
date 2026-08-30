"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/app/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
function readUsername(user: User | null): string | null {
  const name = user?.user_metadata?.username;
  return typeof name === "string" ? name : null;
}
export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();
  // La sesión se lee en cliente para no volver dinámicas las páginas estáticas
  // (`/`, `/biblioteca`, `/salon`). En la primera carga se pinta "sin sesión" y
  // el efecto lo corrige; el parpadeo es aceptado (ver SPEC 12).
  useEffect(() => {
    const supabase = createClient();
    // `onAuthStateChange` emite `INITIAL_SESSION` al suscribirse (leído de las
    // cookies, sin red) y luego cada login / logout / refresh de token.
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUsername(readUsername(session?.user ?? null));
    });
    return () => data.subscription.unsubscribe();
  }, []);
  const isActive = (
    name: "inicio" | "biblioteca" | "salon" | "acerca" | "auth",
  ) => {
    if (name === "inicio") return pathname === "/";
    if (name === "biblioteca")
      return pathname === "/biblioteca" || pathname.startsWith("/juego");
    if (name === "salon") return pathname === "/salon";
    if (name === "acerca") return pathname === "/acerca";
    return pathname === "/entrar" || pathname === "/perfil";
  };
  const close = () => setOpen(false);
  const logout = async () => {
    close();
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/");
    router.refresh();
  };
  return (
    <>
      <nav className="av-nav">
        <Link className="logo" href="/" onClick={close}>
          <div className="logo-mark"></div>
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </Link>
        <div className="links">
          <Link
            className={isActive("inicio") ? "active" : ""}
            href="/"
            onClick={close}
          >
            Inicio
          </Link>
          <Link
            className={isActive("biblioteca") ? "active" : ""}
            href="/biblioteca"
            onClick={close}
          >
            Biblioteca
          </Link>
          <Link
            className={isActive("salon") ? "active" : ""}
            href="/salon"
            onClick={close}
          >
            Salón de la Fama
          </Link>
          <Link
            className={isActive("acerca") ? "active" : ""}
            href="/acerca"
            onClick={close}
          >
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        {username ? (
          <div className="nav-session">
            <Link
              className={"btn auth-btn" + (isActive("auth") ? " active" : "")}
              href="/perfil"
              onClick={close}
            >
              {username}
            </Link>
            <button className="btn ghost nav-logout" onClick={logout}>
              Salir
            </button>
          </div>
        ) : (
          <Link className="btn auth-btn" href="/entrar" onClick={close}>
            Iniciar Sesión
          </Link>
        )}
        <button
          className="btn ghost hamburger"
          onClick={() => setOpen(true)}
          aria-label="Menú"
        >
          ≡
        </button>
      </nav>
      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div
          className="pixel neon-cyan"
          style={{ fontSize: 11, marginBottom: 16 }}
        >
          MENÚ
        </div>
        <Link
          className={isActive("inicio") ? "active" : ""}
          href="/"
          onClick={close}
        >
          Inicio
        </Link>
        <Link
          className={isActive("biblioteca") ? "active" : ""}
          href="/biblioteca"
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link
          className={isActive("salon") ? "active" : ""}
          href="/salon"
          onClick={close}
        >
          Salón de la Fama
        </Link>
        <Link
          className={isActive("acerca") ? "active" : ""}
          href="/acerca"
          onClick={close}
        >
          Acerca de
        </Link>
        {username ? (
          <>
            <Link
              className={isActive("auth") ? "active" : ""}
              href="/perfil"
              onClick={close}
            >
              {username}
            </Link>
            <button className="av-mobile-logout" onClick={logout}>
              Cerrar sesión
            </button>
          </>
        ) : (
          <Link
            className={isActive("auth") ? "active" : ""}
            href="/entrar"
            onClick={close}
          >
            Iniciar Sesión
          </Link>
        )}
        <div style={{ flex: 1 }}></div>
      </aside>
    </>
  );
}
