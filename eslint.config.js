// G4 (deep review 2026-09-17): ESLint naast tsc. Scope = de TypeScript-bronnen
// (web, extensie, api); type-checked basis zodat floating promises, verkeerde
// awaits en hook-deps-regressies opvallen — de klasse fouten die tsc doorlaat.
//
// Bewust uitgezet (feature-freeze: vangnet toevoegen ≠ 200 bestaande regels
// herschrijven): de unsafe-any-familie + require-await + unbound-method e.d.
// vlaggen bestaand, werkend trust-boundary-/stijlwerk in bulk. Aanzetten =
// een aparte opkuis-sessie ná de beta, regel per regel.
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "dev-dist/**",
      "extension/dist/**",
      "extension/dist-dev/**",
      "extension-build/**",
      "node_modules/**",
      "**/*.js",
      "**/*.mjs",
      "**/*.cjs",
    ],
  },
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: {
          // Root-configs die in géén tsconfig-project zitten (vite.config.ts
          // zit wél in tsconfig.node.json en mag hier dus niet bij).
          allowDefaultProject: ["tailwind.config.ts", "vite.extension.config.ts"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // De codebase gebruikt bewust `void promise` voor fire-and-forget; alles
      // zonder void is een echte vergeten await.
      "@typescript-eslint/no-floating-promises": ["error", { ignoreVoid: true }],
      // Event-handlers krijgen vaak async functies aangereikt; dat is hier een
      // bewust patroon (fouten degraderen lokaal), geen bug-klasse.
      "@typescript-eslint/no-misused-promises": [
        "error",
        { checksVoidReturn: { attributes: false, arguments: false } },
      ],
      // `catch (e)` zonder gebruik is hier idiomatisch (degradatie-paden);
      // _-prefix is de bestaande conventie voor bewust ongebruikte parameters.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", caughtErrors: "none" },
      ],
      // Bulk-opkuis, geen vangnet — zie kop.
      "@typescript-eslint/require-await": "off",
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/unbound-method": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/only-throw-error": "off",
      "@typescript-eslint/no-redundant-type-constituents": "off",
    },
  },
  {
    // tsc (extension/tsconfig, @types/chrome) heeft de casts hier nodig; de
    // project service leest 'm met andere types en vindt ze dan overbodig —
    // de autofix zou precies de cast slopen die `npm run lint` vereist.
    files: ["extension/src/storage.ts"],
    rules: { "@typescript-eslint/no-unnecessary-type-assertion": "off" },
  },
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      // De klassieke twee — dít zijn de review-regressies (deps-arrays).
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  }
);
