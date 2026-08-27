import { CATS, GAMES } from "@/app/lib/games";

export default function Home() {
  return (
    <>
      <nav className="av-nav">
        <div className="logo">
          <div className="logo-mark" />
          <div className="logo-text neon-cyan">
            ARCADE <span className="neon-magenta">VAULT</span>
          </div>
        </div>
        <div className="links">
          <a className="active">Biblioteca</a>
          <a>Salón de la Fama</a>
        </div>
        <div className="spacer" />
        <div className="coin-counter">
          <span className="coin" />
          <span>CRÉDITOS · 03</span>
        </div>
        <button className="btn auth-btn">Iniciar Sesión</button>
        <button className="btn ghost hamburger" aria-label="Menú">
          ≡
        </button>
      </nav>

      <main className="av-main">
        <div className="fade-in">
          <section className="av-hero">
            <h1 className="flicker">ARCADE VAULT</h1>
            <div className="sub">
              INSERTA UNA MONEDA PARA JUGAR <span className="blink">_</span>
            </div>
          </section>

          <div className="av-filters">
            <div className="av-search">
              <span className="ico">⌕</span>
              <input placeholder="Buscar un juego por nombre…" />
            </div>
            <div className="av-chips">
              {CATS.map((c) => (
                <button
                  key={c}
                  className={"chip" + (c === "TODOS" ? " active" : "")}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          <div className="av-grid">
            {GAMES.map((game) => (
              <div key={game.id} className="card">
                <div className="cover">
                  <div className={"cover-bg " + game.cover} />
                  <div className="label">{game.cat}</div>
                </div>
                <div className="meta">
                  <div className="title">{game.title}</div>
                  <div className="desc">{game.short}</div>
                  <div className="row">
                    <div className="score-badge">
                      <span>MEJOR PUNTUACIÓN</span>
                      <b>{game.best.toLocaleString("es-ES")}</b>
                    </div>
                    <button
                      className={
                        "btn" +
                        (game.color === "magenta"
                          ? " magenta"
                          : game.color === "yellow"
                            ? " yellow"
                            : "")
                      }
                    >
                      JUGAR
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--line)",
          padding: "20px 32px",
          textAlign: "center",
          color: "var(--ink-faint)",
          fontFamily: "var(--mono)",
          fontSize: 11,
          letterSpacing: "0.16em",
        }}
      >
        © 2026 ARCADE VAULT · HECHO CON PIXELES Y NEÓN
      </footer>
    </>
  );
}
