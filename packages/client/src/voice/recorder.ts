/**
 * NPC voice talk: push-to-talk microphone takes and their transcription. The mic stream opens on the first press and
 * stays open until `releaseMic` (the conversation ended), so later presses start without a permission round-trip.
 * A take is decoded and resampled to 16 kHz mono in the browser and posted to whisper.cpp's `whisper-server`
 * (`scripts/voice-stt.mjs`, language en) as WAV.
 */
import { STT_SAMPLE_RATE, encodeWav, rms } from './wav';

export const STT_URL = (import.meta.env['VITE_NPC_STT_URL'] as string | undefined) ?? '/voice/stt/inference';

/** shorter takes are a tap, not speech */
const MIN_TAKE_MS = 300;
/** quieter takes are silence */
const MIN_RMS = 0.005;
/** whisper's well-known inventions on near-silence (subtitle credits, video sign-offs) */
const HALLUCINATION = /subtitles by|amara\.org|thanks? (you )?for watching|please subscribe/i;

let stream: MediaStream | null = null;
let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];
let startedAt = 0;
/** bumped by `releaseMic`: a mic that finishes opening after the talk ended is closed at once */
let generation = 0;

export async function startTake(): Promise<void> {
  if (stream === null) {
    const gen = generation;
    const s = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    if (gen !== generation) {
      s.getTracks().forEach((t) => t.stop());
      throw new DOMException('talk ended', 'AbortError');
    }
    stream = s;
  }
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = (e) => {
    if (e.data.size > 0) chunks.push(e.data);
  };
  recorder.start();
  startedAt = performance.now();
}

/** Ends the take; resolves with 16 kHz mono samples, or null when it was too short or silent. */
export async function stopTake(): Promise<Float32Array | null> {
  const r = recorder;
  recorder = null;
  if (r === null || r.state === 'inactive') return null;
  const stopped = new Promise<void>((resolve) => {
    r.onstop = () => resolve();
  });
  r.stop();
  await stopped;
  if (performance.now() - startedAt < MIN_TAKE_MS || chunks.length === 0) return null;
  const encoded = await new Blob(chunks, { type: r.mimeType }).arrayBuffer();
  const ctx = new AudioContext();
  let decoded: AudioBuffer;
  try {
    decoded = await ctx.decodeAudioData(encoded);
  } finally {
    void ctx.close();
  }
  const offline = new OfflineAudioContext(1, Math.max(1, Math.ceil(decoded.duration * STT_SAMPLE_RATE)), STT_SAMPLE_RATE);
  const src = offline.createBufferSource();
  src.buffer = decoded;
  src.connect(offline.destination);
  src.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  return rms(samples) < MIN_RMS ? null : samples;
}

export function releaseMic(): void {
  generation++;
  if (recorder !== null && recorder.state !== 'inactive') recorder.stop();
  recorder = null;
  stream?.getTracks().forEach((t) => t.stop());
  stream = null;
}

/** English text for a take ('' = nothing intelligible). */
export async function transcribe(samples: Float32Array, signal: AbortSignal): Promise<string> {
  const form = new FormData();
  form.append('file', new Blob([encodeWav(samples)], { type: 'audio/wav' }), 'take.wav');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  const res = await fetch(STT_URL, { method: 'POST', body: form, signal });
  if (!res.ok) throw new Error(`whisper-server answered ${res.status}`);
  const json = (await res.json()) as { text?: string };
  const text = (json.text ?? '').replace(/\[[^\]]*\]|\([^)]*\)/g, '').trim();
  return HALLUCINATION.test(text) ? '' : text;
}
