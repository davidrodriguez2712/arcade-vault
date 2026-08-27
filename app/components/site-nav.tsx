"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

export default function SiteNav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  const isActive = (name: "inicio" | "biblioteca" | "salon" | "acerca" | "auth") => {
    if (name === "inicio") return pathname === "/";
    if (name === "biblioteca")
      return pathname === "/biblioteca" || pathname.startsWith("/juego");
    if (name === "salon") return pathname === "/salon";
    if (name === "acerca") return pathname === "/acerca";
    return pathname === "/entrar";
  };

  const close = () => setOpen(false);

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
          <Link className={isActive("inicio") ? "active" : ""} href="/" onClick={close}>
            Inicio
          </Link>
          <Link
            className={isActive("biblioteca") ? "active" : ""}
            href="/biblioteca"
            onClick={close}
          >
            Biblioteca
          </Link>
          <Link className={isActive("salon") ? "active" : ""} href="/salon" onClick={close}>
            Salón de la Fama
          </Link>
          <Link className={isActive("acerca") ? "active" : ""} href="/acerca" onClick={close}>
            Acerca de
          </Link>
        </div>
        <div className="spacer"></div>
        <div className="coin-counter">
          <span className="coin"></span>
          <span>CRÉDITOS · 03</span>
        </div>
        <Link className="btn auth-btn" href="/entrar" onClick={close}>
          Iniciar Sesión
        </Link>
        <button className="btn ghost hamburger" onClick={() => setOpen(true)} aria-label="Menú">
          ≡
        </button>
      </nav>

      <div
        className={"av-mobile-backdrop" + (open ? " open" : "")}
        onClick={close}
      ></div>
      <aside className={"av-mobile-panel" + (open ? " open" : "")}>
        <div className="pixel neon-cyan" style={{ fontSize: 11, marginBottom: 16 }}>
          MENÚ
        </div>
        <Link className={isActive("inicio") ? "active" : ""} href="/" onClick={close}>
          Inicio
        </Link>
        <Link
          className={isActive("biblioteca") ? "active" : ""}
          href="/biblioteca"
          onClick={close}
        >
          Biblioteca
        </Link>
        <Link className={isActive("salon") ? "active" : ""} href="/salon" onClick={close}>
          Salón de la Fama
        </Link>
        <Link className={isActive("acerca") ? "active" : ""} href="/acerca" onClick={close}>
          Acerca de
        </Link>
        <Link className={isActive("auth") ? "active" : ""} href="/entrar" onClick={close}>
          Iniciar Sesión
        </Link>
        <div style={{ flex: 1 }}></div>
        <div
          className="pixel"
          style={{ fontSize: 9, color: "var(--ink-faint)", letterSpacing: "0.16em" }}
        >
          CRÉDITOS · 03
        </div>
      </aside>
    </>
  );
}
