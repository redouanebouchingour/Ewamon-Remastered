/**
 * Minimal RIFF/WAVE codec: PCM 16/24/32-bit integer and 32-bit float in, PCM 16-bit or float 32 out.
 * Planar `Float32Array` per channel in memory. Pure TS so the loop finder and the tests need no ffmpeg.
 */

export interface PcmAudio {
  readonly sampleRate: number;
  /** one Float32Array per channel, all the same length, nominal range [-1, 1] */
  readonly channels: readonly Float32Array[];
}

export function frames(a: PcmAudio): number {
  return a.channels[0]?.length ?? 0;
}

export function durationOf(a: PcmAudio): number {
  return frames(a) / a.sampleRate;
}

/** Mono mixdown (mean of channels). */
export function mixdown(a: PcmAudio): Float32Array {
  const n = frames(a);
  const out = new Float32Array(n);
  const k = a.channels.length;
  if (k === 0) return out;
  for (const ch of a.channels) for (let i = 0; i < n; i++) out[i]! += ch[i]!;
  if (k > 1) for (let i = 0; i < n; i++) out[i]! /= k;
  return out;
}

export function decodeWav(buf: Uint8Array): PcmAudio {
  const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const tag = (o: number): string => String.fromCharCode(buf[o]!, buf[o + 1]!, buf[o + 2]!, buf[o + 3]!);
  if (buf.byteLength < 12 || tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('wav: not a RIFF/WAVE file');
  let off = 12;
  let fmt: { format: number; channels: number; rate: number; bits: number } | null = null;
  let data: { start: number; len: number } | null = null;
  while (off + 8 <= buf.byteLength) {
    const id = tag(off);
    const len = dv.getUint32(off + 4, true);
    const body = off + 8;
    if (id === 'fmt ') {
      let format = dv.getUint16(body, true);
      if (format === 0xfffe && len >= 40) format = dv.getUint16(body + 24, true); // WAVE_FORMAT_EXTENSIBLE sub-format
      fmt = { format, channels: dv.getUint16(body + 2, true), rate: dv.getUint32(body + 4, true), bits: dv.getUint16(body + 14, true) };
    } else if (id === 'data') {
      data = { start: body, len: Math.min(len, buf.byteLength - body) };
    }
    off = body + len + (len & 1);
  }
  if (fmt === null || data === null) throw new Error('wav: missing fmt or data chunk');
  const { format, channels: nch, rate, bits } = fmt;
  const bytesPer = bits / 8;
  const n = Math.floor(data.len / (bytesPer * nch));
  const chans = Array.from({ length: nch }, () => new Float32Array(n));
  let p = data.start;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      let v: number;
      if (format === 3 && bits === 32) v = dv.getFloat32(p, true);
      else if (format === 1 && bits === 16) v = dv.getInt16(p, true) / 32768;
      else if (format === 1 && bits === 24) {
        const x = buf[p]! | (buf[p + 1]! << 8) | (buf[p + 2]! << 16);
        v = ((x << 8) >> 8) / 8388608;
      } else if (format === 1 && bits === 32) v = dv.getInt32(p, true) / 2147483648;
      else throw new Error(`wav: unsupported format ${format} / ${bits}-bit`);
      chans[c]![i] = v;
      p += bytesPer;
    }
  }
  return { sampleRate: rate, channels: chans };
}

/** Encode as PCM 16-bit (default, what providers return) or IEEE float 32 (lossless intermediate for `process`). */
export function encodeWav(a: PcmAudio, bits: 16 | 32 = 16): Uint8Array {
  const nch = a.channels.length;
  const n = frames(a);
  const bytesPer = bits / 8;
  const dataLen = n * nch * bytesPer;
  const buf = new Uint8Array(44 + dataLen);
  const dv = new DataView(buf.buffer);
  const put = (o: number, s: string): void => {
    for (let i = 0; i < 4; i++) buf[o + i] = s.charCodeAt(i);
  };
  put(0, 'RIFF');
  dv.setUint32(4, 36 + dataLen, true);
  put(8, 'WAVE');
  put(12, 'fmt ');
  dv.setUint32(16, 16, true);
  dv.setUint16(20, bits === 32 ? 3 : 1, true);
  dv.setUint16(22, nch, true);
  dv.setUint32(24, a.sampleRate, true);
  dv.setUint32(28, a.sampleRate * nch * bytesPer, true);
  dv.setUint16(32, nch * bytesPer, true);
  dv.setUint16(34, bits, true);
  put(36, 'data');
  dv.setUint32(40, dataLen, true);
  let p = 44;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < nch; c++) {
      const v = a.channels[c]![i]!;
      if (bits === 32) dv.setFloat32(p, v, true);
      else dv.setInt16(p, Math.max(-32768, Math.min(32767, Math.round(v * 32767))), true);
      p += bytesPer;
    }
  }
  return buf;
}

/** Wrap raw little-endian PCM16 (what a provider returns for `pcm_*` formats) in a WAV container. */
export function pcm16ToWav(raw: Uint8Array, sampleRate: number, channels: number): Uint8Array {
  const n = Math.floor(raw.byteLength / (2 * channels));
  const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
  const chans = Array.from({ length: channels }, () => new Float32Array(n));
  for (let i = 0; i < n; i++) for (let c = 0; c < channels; c++) chans[c]![i] = dv.getInt16((i * channels + c) * 2, true) / 32768;
  return encodeWav({ sampleRate, channels: chans }, 16);
}

/** Copy of `a` restricted to frames [start, end). */
export function slice(a: PcmAudio, start: number, end: number): PcmAudio {
  const s = Math.max(0, Math.min(frames(a), start));
  const e = Math.max(s, Math.min(frames(a), end));
  return { sampleRate: a.sampleRate, channels: a.channels.map((ch) => ch.slice(s, e)) };
}

export function scale(a: PcmAudio, gain: number): PcmAudio {
  return { sampleRate: a.sampleRate, channels: a.channels.map((ch) => ch.map((v) => Math.fround(v * gain))) };
}

export function peakAbs(a: PcmAudio): number {
  let m = 0;
  for (const ch of a.channels) for (let i = 0; i < ch.length; i++) m = Math.max(m, Math.abs(ch[i]!));
  return m;
}
