// Plausible-analytics (launchplan L6): de wachtrij-stub + init uit het officiële
// snippet. Extern bestand i.p.v. inline, want de CSP staat alleen script-src 'self'
// toe (zelfde reden als theme-init.js). Het eigenlijke script
// (plausible.io/js/pa-….js, async in index.html) leest plausible.o en de wachtrij
// op zodra het geladen is. Cookieloos; localhost wordt door Plausible genegeerd.
window.plausible =
  window.plausible ||
  function () {
    (plausible.q = plausible.q || []).push(arguments);
  };
plausible.init =
  plausible.init ||
  function (i) {
    plausible.o = i || {};
  };
plausible.init();
