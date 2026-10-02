// The Node globals the plain scripts in scripts/ use (avoids a dependency on the `globals` package).
const names = [
  'process',
  'console',
  'fetch',
  'AbortSignal',
  'setTimeout',
  'clearTimeout',
  'URL',
  'URLSearchParams',
  'Buffer',
  'structuredClone',
];

export default { node: Object.fromEntries(names.map((name) => [name, 'readonly'])) };
