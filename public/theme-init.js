// Applies the light theme before first paint (no flash of the wrong theme).
// External file rather than an inline <script>: the CSP (vercel.json) only
// allows script-src 'self', which silently blocked the inline version.
(function () {
  try {
    var stored = localStorage.getItem("theme");
    var light = stored === "light" || (stored !== "dark" && window.matchMedia("(prefers-color-scheme: light)").matches);
    if (light) document.documentElement.classList.add("light");
  } catch (e) {}
})();
