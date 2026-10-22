// usage: node scripts/voice-stt.mjs [--port 8178] [--model <ggml .bin>] — the local Dutch speech-to-text server for NPC voice talk
// (packages/client/src/voice). Runs whisper.cpp's `whisper-server` (`brew install whisper-cpp`) with language nl; the client's Vite
// dev server proxies /voice/stt to it. Default model: ~/.cache/ewamon-voice/ggml-large-v3-turbo-q5_0.bin, fetched once with
//   curl -L -o ~/.cache/ewamon-voice/ggml-large-v3-turbo-q5_0.bin https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
const arg = (name, fallback) => {
  const i = process.argv.indexOf(name);
  return i >= 0 && process.argv[i + 1] !== undefined ? process.argv[i + 1] : fallback;
};
const port = arg('--port', '8178');
const model = arg('--model', join(homedir(), '.cache', 'ewamon-voice', 'ggml-large-v3-turbo-q5_0.bin'));
if (!existsSync(model)) {
  console.error(`voice-stt: no whisper model at ${model} (see the usage line at the top of this script)`);
  process.exit(1);
}
const p = spawn('whisper-server', ['-m', model, '-l', 'nl', '--host', '127.0.0.1', '--port', port, '-nt'], { stdio: 'inherit' });
p.on('error', (e) => {
  console.error(`voice-stt: could not start whisper-server (${e.message}); install it with: brew install whisper-cpp`);
  process.exit(1);
});
p.on('exit', (c) => process.exit(c ?? 0));
for (const s of ['SIGINT', 'SIGTERM']) process.on(s, () => p.kill());
