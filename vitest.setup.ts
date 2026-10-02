/**
 * No test may touch the network. Every test runs over saved fixtures; a call reaching the real
 * `fetch` is a mistake, so it fails loudly instead of silently making a request.
 */
const blocked = async (input: unknown): Promise<never> => {
  const target = typeof input === 'string' ? input : String(input);
  throw new Error(
    `Network access is disabled in tests. Something tried to fetch ${target}. ` +
      'Tests run over the saved fixtures in fixtures/.',
  );
};

globalThis.fetch = blocked as unknown as typeof fetch;
