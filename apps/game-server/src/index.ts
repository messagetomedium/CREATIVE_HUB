import { startCompatibilityServer } from './spike.js';
const server = await startCompatibilityServer(2567);
console.log(`Compatibility lab only: ${server.endpoint}. Browser game remains local.`);
let closing = false;
for (const signal of ['SIGINT', 'SIGTERM'] as const)
  process.on(signal, () => {
    if (!closing) {
      closing = true;
      void server.close();
    }
  });
