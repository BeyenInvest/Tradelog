// esbuild bundelt .css-imports in content scripts als tekststring (--loader:.css=text).
declare module "*.css" {
  const css: string;
  export default css;
}
