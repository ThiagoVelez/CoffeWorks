declare module "katex" {
  const katex: { renderToString(tex: string, opciones?: Record<string, unknown>): string };
  export default katex;
}
