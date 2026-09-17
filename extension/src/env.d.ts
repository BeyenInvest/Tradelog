// Compile-time defines (esbuild --define). __BEYEN_HARNESS__ is alléén true in
// de dev-harnas-build (build:ext:dev) en opent daar de shadow root voor
// DOM-inspectie; in de echte build is het false en blijft de root closed (F4a).
declare const __BEYEN_HARNESS__: boolean;
