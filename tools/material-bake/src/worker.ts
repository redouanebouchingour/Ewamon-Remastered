/** Worker-thread entry: receives JobInput messages, answers { ok, meta } or { ok: false, error }. */
import { parentPort } from 'node:worker_threads';
import { runJob } from './job';
import type { JobInput } from './job';

if (!parentPort) throw new Error('worker.ts must run inside a worker thread');
const port = parentPort;
port.on('message', (j: JobInput) => {
  runJob(j).then(
    (meta) => port.postMessage({ ok: true, meta }),
    (e: unknown) => port.postMessage({ ok: false, error: e instanceof Error ? e.message : String(e) }),
  );
});
