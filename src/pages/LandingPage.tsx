import { useEffect } from "react";
import { Link } from "react-router-dom";
import { Trans, useTranslation } from "react-i18next";
import { LogoLockup, LogoMark } from "@/components/ui/Logo";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import "./landing.css";

/* Public marketing landing page shown at `/` to logged-out visitors (B5 v2).
   Rebuilt per the Strategic Design & Positioning master prompt (2026-09):
   structure follows the visitor's mental journey (attention → recognition →
   belief → trust → action) instead of the standard SaaS skeleton. Design is
   "serif on graphite": typography-led, luminance hierarchy, gold rationed to
   the primary CTA / data line / section numbers. Strategy & research notes in
   docs/landing-strategie-2026-09.md; previous version preserved on branch
   backup/fase-b5-landing-v1. All copy lives under the `landing.*` i18n
   namespace; styles are scoped in ./landing.css under `.landing-root`. */

// Shared markup map for translated headings: an <em> gold accent and the
// hero's second line. Unused tags in a given string are simply ignored.
const accent = { em: <em />, line2: <span className="line2" /> };

function Check({ size = 18 }: { size?: number }) {
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
      <span className="eyebrow">{label}</span>
      <span className="rule" />
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
      document.querySelectorAll<HTMLElement>(".landing-root .reveal:not(.hero .reveal)"),
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
          el.style.animationDelay = `${i > 0 ? i * 0.07 : 0}s`;
          el.classList.add("in");
          io.unobserve(el);
        });
      },
      // Pre-trigger well below the viewport so fast scrolling never lands on a
      // section whose reveal hasn't fired yet (was: threshold 0.14, no margin —
      // which produced blank frames on quick scrolls in dark mode).
      { threshold: 0, rootMargin: "0px 0px 100% 0px" },
    );
    items.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <div className="landing-root">
      <div className="ambient" aria-hidden="true" />

      <header className="topbar-shell">
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
      </header>

      <main>
        {/* HERO — attention: one truth, one line of what it is, one CTA, real product proof. */}
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
              <span className="hero-note">{t("landing.hero.note")}</span>
            </div>

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
                      <div className="chart-cap">{t("landing.stage.cap")}</div>
                      <div className="chart-holder">
                        <svg className="eq-svg" viewBox="0 0 600 210" preserveAspectRatio="none" aria-hidden="true">
                          <defs>
                            <linearGradient id="lp-eqfill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="var(--gold)" stopOpacity="0.18" /><stop offset="1" stopColor="var(--gold)" stopOpacity="0" /></linearGradient>
                          </defs>
                          <line x1="0" y1="40" x2="600" y2="40" stroke="var(--hairline)" strokeWidth="1" />
                          <line x1="0" y1="105" x2="600" y2="105" stroke="var(--hairline)" strokeWidth="1" />
                          <line x1="0" y1="170" x2="600" y2="170" stroke="var(--hairline)" strokeWidth="1" />
                          <path d="M0,170 L30,152 L60,142 L90,154 L120,134 L150,120 L180,110 L210,92 L240,80 L270,104 L300,132 L330,116 L360,100 L390,108 L420,88 L450,74 L480,84 L510,66 L540,74 L570,62 L600,66 L600,210 L0,210 Z" fill="url(#lp-eqfill)" />
                          <path className="eq-line" d="M0,170 L30,152 L60,142 L90,154 L120,134 L150,120 L180,110 L210,92 L240,80 L270,104 L300,132 L330,116 L360,100 L390,108 L420,88 L450,74 L480,84 L510,66 L540,74 L570,62 L600,66" fill="none" stroke="var(--gold)" strokeWidth="2.2" strokeLinejoin="round" strokeLinecap="round" />
                          <circle className="eq-peak" cx="240" cy="80" r="4" fill="var(--surface)" stroke="var(--muted)" strokeWidth="2" />
                          <circle className="eq-trough" cx="300" cy="132" r="4" fill="var(--loss)" stroke="var(--surface)" strokeWidth="2" />
                          <circle className="eq-dot" cx="600" cy="66" r="4" fill="var(--gold)" />
                        </svg>
                        <div className="yaxis"><span>+20%</span><span>+10%</span><span>0</span><span /></div>
                      </div>
                    </div>
                    <div className="side-cell">
                      <div className="kpi"><div className="label">{t("landing.kpi.res")}</div><div className="val up">+16.4%</div></div>
                      <div className="kpi"><div className="label">{t("landing.kpi.pf")}</div><div className="val">1.58</div></div>
                      <div className="kpi"><div className="label">{t("landing.kpi.exp")}</div><div className="val up">+0.31R</div></div>
                      <div className="kpi"><div className="label">{t("landing.kpi.dd")}</div><div className="val down">-8.9%</div></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <p className="sample-note">{t("landing.stage.sample")}</p>
          </div>
        </section>

        {/* TRUST BAND — one early beat of who this is for. */}
        <section className="band">
          <div className="wrap">
            <div className="band-inner reveal">
              <LogoMark size={92} className="band-mark" />
              <div className="band-top">
                <h2 className="band-statement">{t("landing.band.statement")}</h2>
                <p className="band-sub">{t("landing.band.sub")}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 01 RECOGNITION — the visitor's problem, named. The comparison panel
            shows the same trade as a spreadsheet row vs. as Beyen records it. */}
        <section className="blk" id="probleem">
          <div className="wrap">
            <Kicker num="01" label={t("landing.r.kicker")} />
            <div className="split">
              <div className="first">
                <h2 className="reveal"><Trans i18nKey="landing.r.h2" components={accent} /></h2>
                <p className="prose-p reveal">{t("landing.r.p1")}</p>
                <p className="prose-p reveal">{t("landing.r.p2")}</p>
                <p className="prose-turn reveal">{t("landing.r.p3")}</p>
              </div>
              <div className="reveal">
                <div className="panel cmp">
                  <div className="cmp-half">
                    <div className="cmp-cap">{t("landing.r.cmpA")}</div>
                    <div className="cmp-sheet">
                      <span>EURUSD</span>
                      <span className="up">+1.9R</span>
                      <span className="cmp-check">✓</span>
                    </div>
                  </div>
                  <div className="cmp-divider" aria-hidden="true" />
                  <div className="cmp-half">
                    <div className="cmp-cap b">{t("landing.r.cmpB")}</div>
                    <div className="cmp-sheet">
                      <span>EURUSD</span>
                      <span className="up">+1.9R</span>
                      <span className="opill win"><Trend up /> Win</span>
                    </div>
                    <div className="cmp-rows">
                      <div className="cmp-row"><span>{t("landing.r.cmpRule")}</span><span className="cmp-bad">{t("landing.r.cmpRuleVal")}</span></div>
                      <div className="cmp-row"><span>{t("landing.r.cmpEval")}</span><span className="cmp-bad">Emotional error</span></div>
                      <div className="cmp-row"><span>{t("landing.r.cmpKz")}</span><span>London</span></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 02 BELIEF — your method becomes the measure. */}
        <section className="blk" id="methodiek">
          <div className="wrap">
            <Kicker num="02" label={t("landing.m.kicker")} />
            <div className="split">
              <div className="first">
                <h2 className="reveal"><Trans i18nKey="landing.m.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.m.lead")}</p>
                <div className="chips reveal">
                  <span className="chip">ICT / SMC</span>
                  <span className="chip">Breakout</span>
                  <span className="chip">Mean-reversion</span>
                  <span className="chip">Supply &amp; demand</span>
                  <span className="chip">Options wheel</span>
                  <span className="chip add">{t("landing.m.presetOwn")}</span>
                </div>
                <p className="lead sm reveal">{t("landing.m.lead2")}</p>
              </div>
              <div className="proof-col reveal">
                <div className="panel">
                  <div className="panel-head"><span>{t("landing.m.editor")}</span></div>
                  <div className="panel-body">
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.m.chipSetup")}</span><span className="pill">{t("landing.m.opt6")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.m.chipBias")}</span><span className="pill">{t("landing.m.opt3")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> {t("landing.m.killzone")}</span><span className="pill">{t("landing.m.opt4")}</span></div>
                    <div className="field-row"><span className="fl"><Grip /> <span>{t("landing.m.ruleField")}</span></span><span className="pill">{t("landing.m.yesno")}</span></div>
                  </div>
                </div>
                <div className="proof-join" aria-hidden="true" />
                <div className="panel">
                  <div className="panel-head">{t("landing.e.tableTitle")}</div>
                  <div className="panel-body bd-table">
                    <div className="bd-head">
                      <span>{t("landing.e.bdSetup")}</span>
                      <span className="bd-c-r">{t("landing.e.bdTrades")}</span>
                      <span className="bd-c-r">{t("landing.e.bdAvgR")}</span>
                      <span className="bd-c-r">Win%</span>
                    </div>
                    <div className="bd-row"><span className="name">OB retrace</span><span className="bd-c-r bd-n">48</span><span className="bd-c-r up">+0.62R</span><span className="bd-c-r">61%</span></div>
                    <div className="bd-row"><span className="name">Turtle soup</span><span className="bd-c-r bd-n">31</span><span className="bd-c-r up">+0.44R</span><span className="bd-c-r">58%</span></div>
                    <div className="bd-row"><span className="name">FVG fill</span><span className="bd-c-r bd-n">27</span><span className="bd-c-r down">-0.18R</span><span className="bd-c-r">41%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 03 BELIEF — the constitution: numbers that hide nothing. */}
        <section className="blk" id="cijfers">
          <div className="wrap">
            <Kicker num="03" label={t("landing.c.kicker")} />
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

        {/* MID-PAGE CTA — right after the strongest trust argument. */}
        <section className="mid-cta">
          <div className="wrap">
            <div className="hero-cta reveal" style={{ justifyContent: "center" }}>
              <Link className="btn btn-gold btn-lg" to="/signup">{t("landing.hero.cta1")}</Link>
              <span className="hero-note">{t("landing.midcta.note")}</span>
            </div>
          </div>
        </section>

        {/* 04 BELIEF — discipline is measurable: execution judged apart from outcome. */}
        <section className="blk spotlight" id="discipline">
          <div className="wrap">
            <Kicker num="04" label={t("landing.d.kicker")} />
            <div className="split">
              <div className="first">
                <h2 className="reveal"><Trans i18nKey="landing.d.h2" components={accent} /></h2>
                <p className="lead reveal">{t("landing.d.lead")}</p>
                <div className="eval-row reveal">
                  <span className="mini-title">{t("landing.d.evalTitle")}</span>
                  <div className="chips">
                    <span className="chip">Good trade</span>
                    <span className="chip">Emotional error</span>
                    <span className="chip">Technical error</span>
                  </div>
                </div>
              </div>
              <div className="reveal">
                <div className="panel">
                  <div className="panel-head">{t("landing.d.adhTitle")}</div>
                  <div className="panel-body bd-table">
                    <div className="bd-head">
                      <span />
                      <span className="bd-c-r">{t("landing.d.bdTrades")}</span>
                      <span className="bd-c-r">{t("landing.d.bdAvgR")}</span>
                      <span className="bd-c-r">Win%</span>
                    </div>
                    <div className="bd-row"><span className="name">{t("landing.d.adhYes")}</span><span className="bd-c-r bd-n">82</span><span className="bd-c-r up">+0.51R</span><span className="bd-c-r">61%</span></div>
                    <div className="bd-row"><span className="name">{t("landing.d.adhNo")}</span><span className="bd-c-r bd-n">24</span><span className="bd-c-r down">-0.33R</span><span className="bd-c-r">38%</span></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 05 BELIEF — backtesting: prove it before you risk it. */}
        <section className="blk" id="backtesting">
          <div className="wrap">
            <Kicker num="05" label={t("landing.b.kicker")} />
            <div className="split rev">
              <div className="first reveal">
                <div className="panel">
                  <div className="panel-head"><span>{t("landing.b.project")}</span><span className="badge" style={{ marginLeft: "auto" }}>{t("landing.b.isolated")}</span><span className="badge">{t("landing.stage.sample")}</span></div>
                  <div className="panel-body">
                    <div className="bt-stats">
                      <div className="bt-stat"><div className="n">186</div><div className="l">{t("landing.b.trades")}</div></div>
                      <div className="bt-stat"><div className="n up">+31.4%</div><div className="l">{t("landing.b.result")}</div></div>
                      <div className="bt-stat"><div className="n">1.72</div><div className="l">{t("landing.b.pf")}</div></div>
                      <div className="bt-stat"><div className="n up">+0.34R</div><div className="l">{t("landing.b.exp")}</div></div>
                    </div>
                    <svg viewBox="0 0 600 120" preserveAspectRatio="none" style={{ width: "100%", height: "auto", display: "block" }} aria-hidden="true">
                      <path d="M0,100 L40,90 L80,96 L120,78 L160,88 L200,66 L240,80 L280,58 L320,68 L360,44 L400,54 L440,38 L480,48 L520,28 L560,36 L600,22" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
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

        {/* 06 TRUST — the paper interlude: what Beyen deliberately is not. */}
        <section className="blk paper" id="filosofie">
          <div className="wrap">
            <Kicker num="06" label={t("landing.t.kicker")} />
            <div className="prose">
              <h2 className="reveal"><Trans i18nKey="landing.t.h2" components={accent} /></h2>
              <p className="prose-p reveal">{t("landing.t.p1")}</p>
              <p className="prose-p reveal">{t("landing.t.p2")}</p>
            </div>
            <div className="steps reveal">
              <div className="step"><span className="step-num">01</span><h3>{t("landing.t.n1h")}</h3><p>{t("landing.t.n1b")}</p></div>
              <div className="step"><span className="step-num">02</span><h3>{t("landing.t.n2h")}</h3><p>{t("landing.t.n2b")}</p></div>
              <div className="step"><span className="step-num">03</span><h3>{t("landing.t.n3h")}</h3><p>{t("landing.t.n3b")}</p></div>
            </div>
            <p className="note-flag reveal">{t("landing.t.note")}</p>
            <p className="signature reveal">{t("landing.t.p3")}</p>
          </div>
        </section>

        {/* 07 ACTION — pricing, sober. */}
        <section className="blk" id="prijs">
          <div className="wrap">
            <Kicker num="07" label={t("landing.p.kicker")} />
            <h2 className="reveal"><Trans i18nKey="landing.p.h2" components={accent} /></h2>
            <p className="lead reveal">{t("landing.p.lead")}</p>
            <div className="price-grid">
              {/* The free card carries the hero button: it's the product you can
                  actually get today. Pro stays visually secondary until it exists. */}
              <div className="price-card free reveal">
                <div className="price-tier">{t("landing.p.free")}</div>
                <div className="price-amt">€0<small>{t("landing.p.freeAmt")}</small></div>
                <div className="price-perf" aria-hidden="true" />
                <ul className="feat-list">
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.f1")}</span></li>
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.f2")}</span></li>
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.f3")}</span></li>
                </ul>
                <Link className="btn btn-gold btn-lg" to="/signup" style={{ width: "100%" }}>{t("landing.p.freeCta")}</Link>
              </div>
              <div className="price-card reveal">
                <div className="price-tier"><span>{t("landing.p.pro")}</span> <span className="flag">{t("landing.p.proSoon")}</span></div>
                <div className="price-amt">—<small>{t("landing.p.proAmt")}</small></div>
                <div className="price-perf" aria-hidden="true" />
                <ul className="feat-list">
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.pf1")}</span></li>
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.pf2")}</span></li>
                  <li><span className="ck"><Check size={15} /></span><span>{t("landing.p.pf3")}</span></li>
                </ul>
                <Link className="btn btn-ghost btn-lg" to="/signup" style={{ width: "100%" }}>{t("landing.p.proCta")}</Link>
                <p className="pro-note">{t("landing.p.proNote")}</p>
              </div>
            </div>
            <div className="fstrip reveal">
              <span>{t("landing.fs.f1")}</span>
              <span>{t("landing.fs.f2")}</span>
              <span>{t("landing.fs.f3")}</span>
              <span>{t("landing.fs.f4")}</span>
              <span>{t("landing.fs.f5")}</span>
              <span>{t("landing.fs.f6")}</span>
            </div>
          </div>
        </section>

        {/* FAQ — the questions a sceptical trader is already asking himself. */}
        <section className="blk" id="faq">
          <div className="wrap">
            <Kicker num="08" label={t("landing.faq.kicker")} />
            <h2 className="reveal"><Trans i18nKey="landing.faq.h2" components={accent} /></h2>
            <div className="faq-grid">
              <div className="faq-item reveal"><h3>{t("landing.faq.q1")}</h3><p>{t("landing.faq.a1")}</p></div>
              <div className="faq-item reveal"><h3>{t("landing.faq.q2")}</h3><p>{t("landing.faq.a2")}</p></div>
              <div className="faq-item reveal"><h3>{t("landing.faq.q3")}</h3><p>{t("landing.faq.a3")}</p></div>
              <div className="faq-item reveal"><h3>{t("landing.faq.q4")}</h3><p>{t("landing.faq.a4")}</p></div>
            </div>
          </div>
        </section>

        {/* FINAL CTA */}
        <section className="cta-band">
          <div className="wrap">
            <h2 className="reveal"><Trans i18nKey="landing.cta.h2" components={accent} /></h2>
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
