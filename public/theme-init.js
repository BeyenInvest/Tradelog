// Applies the light theme before first paint (no flash of the wrong theme).
// External file rather than an inline <script>: the CSP (vercel.json) only
// allows script-src 'self', which silently blocked the inline version.
(function () {
  try {
    // Light is the brand's base theme: a stored choice wins, everyone else
    // (including system-dark users) starts light. Keep in sync with
    // getInitialTheme in src/hooks/useTheme.tsx.
    var stored = localStorage.getItem("theme");
    if (stored !== "dark") document.documentElement.classList.add("light");
  } catch (e) {
    document.documentElement.classList.add("light");
  }
})();
