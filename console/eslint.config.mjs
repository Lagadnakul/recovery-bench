import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Vendored from the @beui registry by `shadcn add`, not written here.
    //
    // These fail two React Compiler rules (setState inside an effect, and
    // reassigning a variable after render). They are upstream's calls to make,
    // and the beUI guidance is explicit that registry internals should not be
    // forked unless there is a reason. Linting code we do not own would force
    // us to either fork it or disable the rule globally -- and disabling it
    // globally would stop catching the same mistake in OUR components, which
    // is where it actually matters. It already caught one in Cells.tsx.
    //
    // The trade is stated rather than hidden: these files are typechecked and
    // exercised by the build, but not linted. Re-run the linter over them after
    // any `shadcn add` upgrade to see whether upstream has fixed them.
    "src/components/motion/**",
    "src/components/agents/**",
  ]),
]);

export default eslintConfig;
