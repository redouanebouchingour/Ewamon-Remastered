// SPEC §20.2.1 (3): class-name typing for CSS Modules; no generated .d.ts per file.
declare module '*.module.css' {
  const classes: Readonly<Record<string, string>>;
  export default classes;
}
