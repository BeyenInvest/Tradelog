import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { LogoLockup, LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import "./landing.css";

/* Public marketing landing page shown at `/` to logged-out visitors (B5).
   Converted 1:1 from the owner-approved mockup (artifact 8cc05b23): same
   structure, copy and layout, but wired to the app's real i18n, theme and
   brand components. All copy lives under the `landing.*` i18n namespace;
   gold-accented headings use <Trans> so the <em>/<line2> markup survives
   translation. Styles are scoped in ./landing.css under `.landing-root`. */

// Shared markup map for translated headings: an <em> gold accent and the
// hero's second line. Unused tags in a given string are simply ignored.
const accent = { em: <em />, line2: <span className="line2" /> };

function Check({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

function Grip() {
  return (
    <svg className="grip" width={12} height={12} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <circle cx="3" cy="2" r="1" /><circle cx="9" cy="2" r="1" />
      <circle cx="3" cy="6" r="1" /><circle cx="9" cy="6" r="1" />
      <circle cx="3" cy="10" r="1" /><circle cx="9" cy="10" r="1" />
    </svg>
  );
}

function Arrow() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

/** Outcome-pill icon mirroring the app's OutcomePill (TrendingUp / TrendingDown / Minus). */
function Trend({ up }: { up: boolean }) {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {up ? <path d="M3 17l6-6 4 4 8-8M21 7v6h-6" /> : <path d="M3 7l6 6 4-4 8 8M21 17v-6h-6" />}
    </svg>
  );
}
function MinusIc() {
  return (
    <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true">
      <path d="M5 12h14" />
    </svg>
  );
}

/** Decorative rangefinder-style bracket — a "focus frame" motif, not the brand mark. */
function Tick({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 120 120" fill="none" stroke="currentColor" strokeWidth={11} strokeLinecap="round" aria-hidden="true">
      <path d="M14,34 L14,14 L34,14" /><path d="M86,14 L106,14 L106,34" />
      <path d="M106,86 L106,106 L86,106" /><path d="M34,106 L14,106 L14,86" />
    </svg>
  );
}

function FrameCorner({ variant }: { variant: "tl" | "tr" | "bl" | "br" }) {
  const paths: Record<string, string> = {
    tl: "M4,16 L4,4 L16,4",
    tr: "M24,4 L36,4 L36,16",
    bl: "M4,24 L4,36 L16,36",
    br: "M24,36 L36,36 L36,24",
  };
  return (
    <svg className={`frame-corner fc-${variant}`} viewBox="0 0 40 40" fill="none" stroke="currentColor" strokeWidth={3.5} strokeLinecap="round" aria-hidden="true">
      <path d={paths[variant]} />
    </svg>
  );
}

function Kicker({ num, label }: { num: string; label: string }) {
  return (
    <div className="kicker reveal">
      <span className="num">{num}</span>
      <span className="rule" />
      <span className="eyebrow" style={{ letterSpacing: ".14em" }}>{label}</span>
    </div>
  );
}

export default function LandingPage() {
  const { t } = useTranslation();

  // Scroll-reveal: fade sections up as they enter view, with a small per-sibling
  // stagger. Hero elements animate immediately via CSS. Falls back to showing
  // everything if reduced-motion is set or IntersectionObserver is unavailable.
  useEffect(() => {
    const items = Array.from(
      document.querySelectorAll<HTMLElement>(
        ".landing-root .blk .reveal, .landing-root .band .reveal, .landing-root .cta-band .reveal, .landing-root .price-card.reveal",
      ),
    );
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || !("IntersectionObserver" in window)) {
      items.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target as HTMLElement;
          const sibs = Array.from(el.parentNode?.children ?? []).filter((n) =>
            (n as HTMLElement).classList.contains("reveal"),
          );
          const i = sibs.indexOf(el);
          el.style.animationDelay = `${i > 0 ? i * 0.08 : 0}s`;
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      { threshold: 0.14 },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <div className="ambient" aria-hidden="true" />

      <div className="wrap">
        <div className="topbar">
          <Link className="brand" to="/" aria-label="Beyen — home">
            <LogoLockup size={26} />
          </Link>
          <div className="spacer" />
          <div className="actions">
            <Link className="btn btn-link" to="/login">{t("landing.nav.login")}</Link>
            <Link className="btn btn-gold" to="/signup">{t("landing.nav.cta")}</Link>
            <div className="tools">
              <LanguageToggle iconOnly />
              <ThemeToggle iconOnly />
            </div>
          </div>
        </div>
      </div>

      <span id="top" />
      <main>
        {/* HERO */}
        <section className="hero">
          <div className="wrap">
            <span className="eyebrow reveal d1">
              <Tick className="tick" />
              <span>{t("landing.hero.eyebrow")}</span>
            </span>
            <h1 className="hero-title reveal d2">
              <Trans i18nKey="landing.hero.title" components={accent} />
            </h1>
            <p className="hero-sub reveal d3">{t("landing.hero.sub")}</p>
            <div className="hero-cta reveal d4">
              <Link className="btn btn-gold btn-lg" to="/signup">{t("landing.hero.cta1")}</Link>
              <a className="btn btn-ghost btn-lg" href="#cijfers">{t("landing.hero.cta2")}</a>
            </div>
            <p className="hero-note reveal d4">
              <span className="pulse" />
              <span>{t("landing.hero.note")}</span>
            </p>

            <div className="stage-wrap reveal d5">
              <FrameCorner variant="tl" />
              <FrameCorner variant="tr" />
              <FrameCorner variant="bl" />
              <FrameCorner variant="br" />
              <div className="stage">
                <div className="rail" aria-hidden="true">
                  <span className="rdot on">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></svg>
                  </span>
                  <span className="rdot">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /></svg>
                  </span>
                  <span className="rdot">
                    <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9}><path d="M4 5h16M4 12h16M4 19h10" /></svg>
                  </span>
                  <span className="rdot"><LogoMark size={15} /></span>
                </div>
                <div className="stage-main">
                  <div className="stage-head">
                    <span className="dot" style={{ background: "var(--loss)" }} />
                    <span className="dot" style={{ background: "var(--be)" }} />
                    <span className="dot" style={{ background: "var(--win)" }} />
                    <span className="stage-tabs">
                      <span className="on">{t("landing.stage.tab1")}</span>
                      <span>{t("landing.stage.tab2")}</span>
                      <span>{t("landing.stage.tab3")}</span>
                    </span>
                    <span className="stage-meta">{t("landing.stage.meta")}</span>
                  </div>
                  <div className="stage-grid">
                    <div className="chart-cell">
                      <div className="chart-cap">
                        <span className="t">{t("landing.chart.cap")}</span>
                      </div>
                      <div className="chart-holder">
                        <svg className="eq-svg" viewBox="0 0 600 210" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="lp-eqfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--gold)" stopOpacity="0.26" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" /></linearGradient>
                          </defs>
                          <line x1="0" y1="40" x2="600" y2="40" stroke="var(--border-soft)" strokeWidth="1" />
                          <line x1="0" y1="105" x2="600" y2="105" stroke="var(--border-soft)" strokeWidth="1" />
                          <line x1="0" y1="170" x2="600" y2="170" stroke="var(--border-soft)" strokeWidth="1" />
                          <path d="M0,170 L30,152 L60,142 L90,154 L120,134 L150,120 L180,110 L210,92 L240,80 L270,104 L300,132 L330,116 L360,100 L390,108 L420,88 L450,74 L480,84 L510,66 L540,74 L570,62 L600,66 L600,210 L0,210 Z" fill="url(#lp-eqfill)" />
                          <path className="eq-line" d="M0,170 L30,152 L60,142 L90,154 L120,134 L150,120 L180,110 L210,92 L240,80 L270,104 L300,132 L330,116 L360,100 L390,108 L420,88 L450,74 L480,84 L510,66 L540,74 L570,62 L600,66" fill="none" stroke="var(--gold)" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
                          <circle className="eq-peak" cx="240" cy="80" r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
                          <circle className="eq-trough" cx="300" cy="132" r="4" fill="var(--loss)" stroke="var(--surface)" strokeWidth="2" />
                          <circle className="eq-dot" cx="600" cy="66" r="4.5" fill="var(--gold)" />
                        </svg>
                        <div className="yaxis"><span>+20%</span><span>+10%</span><span>0</span><span /></div>
                      </div>
                    </div>
                    <div className="side-cell">
                      <div className="kpi-two">
                        <div className="kpi"><div className="label">{t("landing.kpi.wr")}</div><div className="val up">+16.4%</div></div>
                        <div className="kpi"><div className="label">{t("landing.kpi.pf")}</div><div className="val up">1.58</div></div>
                        <div className="kpi"><div className="label">{t("landing.kpi.exp")}</div><div className="val up">+0.31R</div></div>
                        <div className="kpi"><div className="label">{t("landing.kpi.dd")}</div><div className="val down">-8.9%</div></div>
                      </div>
                      <div>
                        <div className="mini-title" style={{ marginBottom: 10 }}>{t("landing.fields.title")}</div>
                        <div className="chips">
                          <span className="chip">{t("landing.chip.setup")} <span className="type">{t("landing.type.enum")}</span></span>
                          <span className="chip">{t("landing.chip.bias")} <span className="type">{t("landing.type.enum")}</span></span>
                          <span className="chip">{t("landing.chip.rule")} <span className="type">{t("landing.type.yesno")}</span></span>
                          <span className="chip add">{t("landing.chip.add")}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TRUST / STAT BAND */}
        <section className="band">
          <div className="wrap">
            <div className="band-top reveal">
              <h2 className="band-statement">{t("landing.band.statement")}</h2>
              <p className="band-sub">{t("landing.band.sub")}</p>
            </div>
            <div className="stat-row">
              <div className="stat reveal"><div className="num">€0</div><div className="lab">{t("landing.band.t1")}</div></div>
              <div className="stat reveal"><div className="num">∞</div><div className="lab">{t("landing.band.t2")}</div></div>
              <div className="stat reveal"><div className="num">2-in-1</div><div className="lab">{t("landing.band.t3")}</div></div>
              <div className="stat reveal"><div className="num">0</div><div className="lab">{t("landing.band.t4")}</div></div>
            </div>
          </div>
        </section>

        {/* 01 METHOD */}
        <section className="blk" id="methodiek">
          <div className="wrap">
            <Kicker num="01" label={t("landing.m.kicker")} />
            <div className="split">
              <div className="first">
                <h2 className="reveal"><Trans i18nKey="landing.m.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.m.lead")}</p>
                <div className="chips reveal" style={{ gap: 10, marginTop: 26 }}>
                  <span className="chip">ICT / SMC</span>
                  <span className="chip">Breakout</span>
                  <span className="chip">Mean-reversion</span>
                  <span className="chip">Supply &amp; demand</span>
                  <span className="chip">Options wheel</span>
                  <span className="chip add">{t("landing.m.presetOwn")}</span>
                </div>
                <p className="lead reveal" style={{ fontSize: "15.5px", marginTop: 24 }}>{t("landing.m.lead2")}</p>
              </div>
              <div className="reveal">
                <div className="panel">
                  <div className="panel-head"><LogoMark size={15} className="mark" /><span>{t("landing.m.editor")}</span></div>
                  <div className="panel-body">
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.chip.setup")}</span><span className="pill">{t("landing.m.opt6")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.chip.bias")}</span><span className="pill">{t("landing.m.opt3")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.m.killzone")}</span><span className="pill">{t("landing.m.opt4")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> <span>{t("landing.m.ruleField")}</span></span><span className="pill">{t("landing.m.yesno")}</span></div>
                    <div className="field-row"><span className="fl" style={{ color: "var(--gold)" }}><svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg> <span>{t("landing.m.newField")}</span></span><span className="pill gold">{t("landing.m.add")}</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 NUMBERS */}
        <section className="blk" id="cijfers">
          <div className="wrap">
            <Kicker num="02" label={t("landing.c.kicker")} />
            <div className="split rev">
              <div className="first reveal">
                <div className="panel">
                  <div className="panel-head">{t("landing.c.panelhead")}</div>
                  <div className="panel-body trades-list">
                    <div className="tr">
                      <span className="tr-sym">EURUSD <span className="tr-dir">long</span></span>
                      <span className="opill win"><Trend up /> Win</span>
                      <span className="rr up">+1.9R</span>
                    </div>
                    <div className="tr">
                      <span className="tr-sym">US30 <span className="tr-dir">short</span></span>
                      <span className="opill be"><MinusIc /> BE</span>
                      <span className="rr be">+0.0R</span>
                    </div>
                    <div className="tr">
                      <span className="tr-sym">NAS100 <span className="tr-dir">short</span></span>
                      <span className="opill loss"><Trend up={false} /> Loss</span>
                      <span className="rr down">-1.0R</span>
                    </div>
                    <div className="tr">
                      <span className="tr-sym">GBPUSD <span className="tr-dir">long</span> <span className="badge missed-solid">{t("landing.c.missed")}</span></span>
                      <span className="tr-dash">—</span>
                      <span className="rr strike">+2.3R</span>
                    </div>
                    <div className="excl-note"><span>{t("landing.c.excl")}</span><span className="badge">excl.</span></div>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="reveal"><Trans i18nKey="landing.c.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.c.lead")}</p>
                <ul className="points">
                  <li className="reveal"><span className="pt-mark"><Check /></span><div><h3>{t("landing.c.p1h")}</h3><p>{t("landing.c.p1b")}</p></div></li>
                  <li className="reveal"><span className="pt-mark"><Check /></span><div><h3>{t("landing.c.p2h")}</h3><p>{t("landing.c.p2b")}</p></div></li>
                  <li className="reveal"><span className="pt-mark"><Check /></span><div><h3>{t("landing.c.p3h")}</h3><p>{t("landing.c.p3b")}</p></div></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 03 EDGE ANALYSIS */}
        <section className="blk spotlight" id="edge">
          <div className="wrap">
            <Kicker num="03" label={t("landing.e.kicker")} />
            <div className="split">
              <div className="first">
                <h2 className="reveal"><Trans i18nKey="landing.e.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.e.lead")}</p>
                <div className="adherence reveal">
                  <div className="at">{t("landing.e.adhTitle")}</div>
                  <div className="adh-head"><span /><span className="bd-c-r">{t("landing.e.bdTrades")}</span><span className="bd-c-r">{t("landing.e.bdAvgR")}</span><span className="bd-c-r">Win%</span></div>
                  <div className="adh-row"><span>{t("landing.e.adhYes")}</span><span className="bd-c-r bd-n">82</span><span className="bd-c-r up">+0.51R</span><span className="bd-c-r wr-w">61%</span></div>
                  <div className="adh-row"><span>{t("landing.e.adhNo")}</span><span className="bd-c-r bd-n">24</span><span className="bd-c-r down">-0.33R</span><span className="bd-c-r wr-w">38%</span></div>
                </div>
              </div>
              <div className="reveal">
                <div className="panel">
                  <div className="panel-head">{t("landing.e.tableTitle")}</div>
                  <div className="panel-body bd-table">
                    <div className="bd-head">
                      <span>{t("landing.e.bdSetup")}</span>
                      <span className="bd-c-r">{t("landing.e.bdTrades")}</span>
                      <span className="bd-c-r">{t("landing.e.bdResult")}</span>
                      <span className="bd-c-r">Win%</span>
                      <span className="bd-c-r">Loss%</span>
                    </div>
                    <div className="bd-row"><span className="name">OB retrace</span><span className="bd-c-r bd-n">48</span><span className="bd-c-r up">+0.62R</span><span className="bd-c-r wr-w">61%</span><span className="bd-c-r wr-l">33%</span></div>
                    <div className="bd-row"><span className="name">Turtle soup</span><span className="bd-c-r bd-n">31</span><span className="bd-c-r up">+0.44R</span><span className="bd-c-r wr-w">58%</span><span className="bd-c-r wr-l">39%</span></div>
                    <div className="bd-row"><span className="name">Breaker</span><span className="bd-c-r bd-n">22</span><span className="bd-c-r up">+0.31R</span><span className="bd-c-r wr-w">54%</span><span className="bd-c-r wr-l">41%</span></div>
                    <div className="bd-row"><span className="name">FVG fill</span><span className="bd-c-r bd-n">27</span><span className="bd-c-r down">-0.18R</span><span className="bd-c-r wr-w">41%</span><span className="bd-c-r wr-l">52%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 04 BACKTESTING */}
        <section className="blk" id="backtesting">
          <div className="wrap">
            <Kicker num="04" label={t("landing.b.kicker")} />
            <div className="split rev">
              <div className="first reveal">
                <div className="panel">
                  <div className="panel-head"><span>{t("landing.b.project")}</span><span className="badge gold" style={{ marginLeft: "auto" }}>{t("landing.b.isolated")}</span></div>
                  <div className="panel-body">
                    <div className="bt-stats">
                      <div className="bt-stat"><div className="n">186</div><div className="l">{t("landing.b.trades")}</div></div>
                      <div className="bt-stat"><div className="n" style={{ color: "var(--win)" }}>+31.4%</div><div className="l">{t("landing.b.result")}</div></div>
                      <div className="bt-stat"><div className="n">1.72</div><div className="l">{t("landing.b.pf")}</div></div>
                      <div className="bt-stat"><div className="n" style={{ color: "var(--win)" }}>+0.34R</div><div className="l">{t("landing.b.exp")}</div></div>
                    </div>
                    <svg viewBox="0 0 600 120" preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
                      <defs><linearGradient id="lp-btfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--gold)" stopOpacity="0.20" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" /></linearGradient></defs>
                      <path d="M0,100 L40,90 L80,96 L120,78 L160,88 L200,66 L240,80 L280,58 L320,68 L360,44 L400,54 L440,38 L480,48 L520,28 L560,36 L600,22 L600,120 L0,120 Z" fill="url(#lp-btfill)" />
                      <path d="M0,100 L40,90 L80,96 L120,78 L160,88 L200,66 L240,80 L280,58 L320,68 L360,44 L400,54 L440,38 L480,48 L520,28 L560,36 L600,22" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <h2 className="reveal"><Trans i18nKey="landing.b.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.b.lead")}</p>
                <ul className="points">
                  <li className="reveal"><span className="pt-mark"><Check /></span><div><h3>{t("landing.b.b1h")}</h3><p>{t("landing.b.b1b")}</p></div></li>
                  <li className="reveal"><span className="pt-mark"><Check /></span><div><h3>{t("landing.b.b2h")}</h3><p>{t("landing.b.b2b")}</p></div></li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        {/* 05 TRADINGVIEW */}
        <section className="blk" id="tradingview">
          <div className="wrap">
            <Kicker num="05" label={t("landing.t.kicker")} />
            <h2 className="reveal"><Trans i18nKey="landing.t.h2" components={accent} /></h2>
            <p className="lead reveal">{t("landing.t.lead")}</p>
            <div className="pipe reveal">
              <div className="pipe-node">
                <div className="pn-ic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 3v18h18" /><path d="M7 14l3-4 3 3 4-6" /></svg></div>
                <h4>{t("landing.t.n1h")}</h4><p>{t("landing.t.n1b")}</p>
              </div>
              <div className="pipe-arrow"><Arrow /></div>
              <div className="pipe-node">
                <div className="pn-ic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v5H4zM4 15h16v5H4z" /><path d="M8 6.5h.01M8 17.5h.01" /></svg></div>
                <h4>{t("landing.t.n2h")}</h4><p>{t("landing.t.n2b")}</p>
              </div>
              <div className="pipe-arrow"><Arrow /></div>
              <div className="pipe-node end">
                <div className="pn-ic"><LogoMark size={22} /></div>
                <h4>{t("landing.t.n3h")}</h4><p>{t("landing.t.n3b")}</p>
              </div>
            </div>
            <div className="note-flag">{t("landing.t.note")}</div>
          </div>
        </section>

        {/* 06 EVERYTHING ELSE */}
        <section className="blk" id="more">
          <div className="wrap">
            <Kicker num="06" label={t("landing.f.kicker")} />
            <h2 className="reveal"><Trans i18nKey="landing.f.h2" components={accent} /></h2>
            <p className="lead reveal">{t("landing.f.lead")}</p>
            <div className="fgrid">
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 5h16v14H4z" /><path d="M8 3v4M16 3v4M4 10h16" /></svg></div><h4>{t("landing.f.c1h")}</h4><p>{t("landing.f.c1b")}</p></div>
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M3 7h18v12H3z" /><path d="M3 10h18M7 15h4" /></svg></div><h4>{t("landing.f.c2h")}</h4><p>{t("landing.f.c2b")}</p></div>
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 14h5M10 17h5" /></svg></div><h4>{t("landing.f.c3h")}</h4><p>{t("landing.f.c3b")}</p></div>
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div><h4>{t("landing.f.c4h")}</h4><p>{t("landing.f.c4b")}</p></div>
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><path d="M4 4h16v16H4z" /><path d="M4 9h16M9 9v11M7 6.5h0M11 6.5h0" /></svg></div><h4>{t("landing.f.c5h")}</h4><p>{t("landing.f.c5b")}</p></div>
              <div className="fcard reveal"><div className="fic"><svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18" /></svg></div><h4>{t("landing.f.c6h")}</h4><p>{t("landing.f.c6b")}</p></div>
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section className="blk" id="prijs">
          <div className="wrap">
            <Kicker num="07" label={t("landing.p.kicker")} />
            <h2 className="reveal"><Trans i18nKey="landing.p.h2" components={accent} /></h2>
            <p className="lead reveal">{t("landing.p.lead")}</p>
            <div className="price-grid">
              <div className="price-card reveal">
                <div className="price-tier">{t("landing.p.free")}</div>
                <div className="price-amt">€0<small>{t("landing.p.freeAmt")}</small></div>
                <ul className="feat-list">
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.f1")}</span></li>
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.f2")}</span></li>
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.f3")}</span></li>
                </ul>
                <Link className="btn btn-ghost btn-lg" to="/signup" style={{ width: "100%" }}>{t("landing.p.freeCta")}</Link>
              </div>
              <div className="price-card feat reveal">
                <div className="price-tier"><span>{t("landing.p.pro")}</span> <span className="flag">{t("landing.p.proSoon")}</span></div>
                <div className="price-amt">—<small>{t("landing.p.proAmt")}</small></div>
                <ul className="feat-list">
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.pf1")}</span></li>
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.pf2")}</span></li>
                  <li><span className="ck"><Check size={16} /></span><span>{t("landing.p.pf3")}</span></li>
                </ul>
                <Link className="btn btn-gold btn-lg" to="/signup" style={{ width: "100%" }}>{t("landing.p.proCta")}</Link>
              </div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="cta-band">
          <div className="wrap">
            <span className="eyebrow reveal" style={{ justifyContent: "center", display: "flex" }}>
              <LogoMark size={14} /> {t("common.tagline")}
            </span>
            <h2 className="reveal" style={{ maxWidth: "18ch" }}><Trans i18nKey="landing.cta.h2" components={accent} /></h2>
            <p className="lead reveal">{t("landing.cta.lead")}</p>
            <div className="hero-cta reveal"><Link className="btn btn-gold btn-lg" to="/signup">{t("landing.cta.btn")}</Link></div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div className="foot-inner">
            <div className="foot-brand">
              <LogoLockup size={22} />
              <span className="foot-tag">{t("common.tagline")}</span>
            </div>
            <div className="foot-links">
              <Link to="/terms">{t("landing.foot.terms")}</Link>
              <Link to="/privacy">{t("landing.foot.privacy")}</Link>
              <Link to="/login">{t("landing.nav.login")}</Link>
            </div>
          </div>
          <p className="foot-small">{t("landing.foot.small")}</p>
        </div>
      </footer>
    </div>
  );
}
