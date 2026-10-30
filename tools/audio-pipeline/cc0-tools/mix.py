# Phase E4 premixes (gitignored tool, deterministic): builds assets-src/audio/cc0/mix/*.wav from the downloaded CC0
# files — the multi-file ambience beds, the low-passed rift theme region, and the layered sfx designs — because the
# ingest takes one file per job. Every input path is relative to assets-src/audio/cc0/. Writes mix/MIXES.json (which
# source files each premix uses) so sources.json can credit every part.
# usage: python _tools/mix.py [name ...]   (no names = all)
import json, os, subprocess, sys
import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, 'mix')
SR = 48000
USED = {}

KI = 'kenney/kenney_interface-sounds/Audio/'
KU = 'kenney/kenney_ui-audio/Audio/'
KX = 'kenney/kenney_impact-sounds/Audio/'
KR = 'kenney/kenney_rpg-audio/Audio/'
KJ = 'kenney/kenney_music-jingles/Audio/'
KS = 'kenney/kenney_sci-fi-sounds/Audio/'
KD = 'kenney/kenney_digital-audio/Audio/'
R1 = 'rubberduck/80-CC0-creature-SFX/'
R2 = 'rubberduck/80-CC0-creature-sfx-2/'
R3 = 'rubberduck/80-CC0-RPG-SFX/'
R4 = 'rubberduck/100-CC0-SFX/'
R5 = 'rubberduck/sfx_100_v2/'
R6 = 'rubberduck/water-splash-slime-sfx/'
R7 = 'rubberduck/100-CC0-wood-metal-SFX/'
R8 = 'rubberduck/sfx_loops/'
AP = 'subs/rpg-sound-pack/pack/'
MS = 'subs/magic-spell-sfx/'
CM = 'subs/cure-magic/'
BW = 'subs/beach-ocean-waves/wave_0%d_cc0-18363__jasinski__alkaibeach.flac'
WW = 'subs/water-waves/wave_0%d_cc0-11505__transitking__wavesound.flac'
A1 = 'ambience/amb_morning.ogg'
A3 = 'ambience/Dark_Rainy_Night.ogg'
A4 = 'ambience/dungeon_ambient_1.ogg'
A5 = 'ambience/crickets.mp3'
A6 = 'ambience/wind-woosh-loop.ogg'
M9 = 'music/entering_the_volcano.wav'
M11 = 'music/song18-crystal-cave.mp3'
M12 = 'music/junkala-post-apocalyptic-wastelands-loop.ogg'

_cur = None


def load(path, rate=1.0, af='', trim=None):
    """decode to 48 kHz stereo float; rate ≠ 1 resamples (pitch and speed together); af = extra ffmpeg filters"""
    USED.setdefault(_cur, set()).add(path)
    chain = [f'aresample={SR}']
    if rate != 1.0:
        chain += [f'asetrate={SR * rate:.3f}', f'aresample={SR}']
    if af:
        chain.append(af)
    cmd = ['ffmpeg', '-v', 'error']
    if trim:
        cmd += ['-ss', str(trim[0]), '-to', str(trim[1])]
    cmd += ['-i', os.path.join(ROOT, path), '-af', ','.join(chain), '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-']
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).T.copy()


def db(g):
    return 10 ** (g / 20)


def rmsnorm(x, target=-20.0):
    """continuous layers: RMS to `target` dBFS, so recipe gains are relative levels"""
    r = float(np.sqrt(np.mean(x ** 2))) + 1e-12
    return (x * (db(target) / r)).astype(np.float32)


def peaknorm(x, target=-3.0):
    """one-shots: peak to `target` dBFS"""
    p = float(np.max(np.abs(x))) + 1e-12
    return (x * (db(target) / p)).astype(np.float32)


def silence(sec):
    return np.zeros((2, int(round(sec * SR))), np.float32)


def place(dst, src, t, gain=0.0):
    i = int(round(t * SR))
    if i >= dst.shape[1]:
        return
    n = min(src.shape[1], dst.shape[1] - i)
    dst[:, i:i + n] += src[:, :n] * db(gain)


def tile(src, sec, offset=0.0, gain=0.0, xfade=0.05):
    """src repeated to sec seconds starting `offset` s into it, with short cross-fades at the joins"""
    n = int(round(sec * SR))
    out = np.zeros((2, n), np.float32)
    src = rmsnorm(src)
    L = src.shape[1]
    f = min(int(xfade * SR), L // 4)
    ramp = np.linspace(0, 1, f, dtype=np.float32) if f > 0 else None
    unit = src.copy()
    if f > 0:  # fold the tail into the head so the loop joins smoothly
        unit[:, :f] = src[:, :f] * ramp + src[:, L - f:] * (1 - ramp)
        unit = unit[:, :L - f]
    rolled = np.roll(unit, -int(offset * SR) % unit.shape[1], axis=1)
    reps = int(np.ceil(n / rolled.shape[1])) + 1
    out[:] = np.tile(rolled, reps)[:, :n]
    return out * db(gain)


def fade(x, fin=0.0, fout=0.0):
    x = x.copy()
    a, b = int(fin * SR), int(fout * SR)
    if a > 0:
        x[:, :a] *= np.linspace(0, 1, a, dtype=np.float32)
    if b > 0:
        x[:, -b:] *= np.linspace(1, 0, b, dtype=np.float32)
    return x


def envelope(x, points):
    """piecewise-linear gain in dB over time: points = [(sec, dB), ...]"""
    t = np.arange(x.shape[1]) / SR
    ts, gs = zip(*points)
    return x * db(np.interp(t, ts, gs)).astype(np.float32)


def scatter(dst, files, every, gain, rng, jitter=0.5, rate=(1.0, 1.0), af='', gain_jitter=3.0, start=0.0):
    """one-shots placed roughly every `every` s (± jitter fraction), random file / rate / gain"""
    t = start + rng.uniform(0, every)
    cache = {}
    while t < dst.shape[1] / SR:
        f = files[rng.integers(len(files))]
        r = round(float(rng.uniform(*rate)), 3)
        key = (f, r)
        if key not in cache:
            cache[key] = peaknorm(load(f, r, af))
        place(dst, cache[key], t, gain + rng.uniform(-gain_jitter, gain_jitter))
        t += every * (1 + rng.uniform(-jitter, jitter))


def write(name, x, peak_db=-1.0):
    os.makedirs(OUT, exist_ok=True)
    pk = float(np.max(np.abs(x))) + 1e-12
    x = x * (db(peak_db) / pk)
    p = os.path.join(OUT, name + '.wav')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-c:a', 'pcm_s24le',
                    '-map_metadata', '-1', '-fflags', '+bitexact', '-flags:a', '+bitexact', p],
                   input=x.T.astype(np.float32).tobytes(), check=True)
    print(f'  {name}.wav  {x.shape[1] / SR:6.2f}s')


BED = 64.0
RECIPES = {}


def ffilter(x, af):
    """run a float stereo buffer through an ffmpeg filter chain"""
    out = subprocess.run(['ffmpeg', '-v', 'error', '-f', 'f32le', '-ar', str(SR), '-ac', '2', '-i', '-', '-af', af, '-f', 'f32le', '-'],
                         input=x.T.astype(np.float32).tobytes(), capture_output=True, check=True).stdout
    return np.frombuffer(out, dtype=np.float32).reshape(-1, 2).T.copy()


def finish_bed(x):
    """beds: RMS −20 dBFS, then a look-ahead limiter at −7 dBFS so the crest factor lets process reach −16 LUFS
    under its −1 dBTP ceiling (drips, strikes and gusts are softened, not removed)"""
    return ffilter(rmsnorm(x), 'alimiter=limit=0.447:attack=5:release=80:level=false')


def recipe(fn):
    RECIPES[fn.__name__] = fn
    return fn


# ─── ambience beds (64 s; ingest keeps the bed's 62 s, process cross-fades 2 s) ─────────────────────────────

@recipe
def bed_grove(rng):
    return load(A1, trim=(0, 63.2))


@recipe
def bed_salt(rng):
    x = silence(BED)
    x += tile(load(R5 + 'sfx100v2_loop_water_02.ogg', af='lowpass=f=3500'), BED, 0.0, 0)
    x += tile(load(R5 + 'sfx100v2_loop_water_03.ogg', 0.94, 'lowpass=f=2500'), BED, 3.1, -4)
    waves = [BW % i for i in (1, 2, 3, 4)] + [WW % i for i in (1, 2, 3, 4)]
    scatter(x, waves, 5.5, -4, rng, 0.35, (0.92, 1.0), 'lowpass=f=6000')
    x += tile(load(A6, 0.9, 'highpass=f=700,lowpass=f=5000'), BED, 1.7, -14)
    scatter(x, [KR + 'creak1.ogg', KR + 'creak2.ogg', KR + 'creak3.ogg'], 13, -20, rng, 0.4, (0.7, 0.85), 'lowpass=f=3000,aecho=0.8:0.5:90:0.3')
    return x


@recipe
def bed_storm(rng):
    x = rmsnorm(load(A3, trim=(176, 176 + BED)))
    x += tile(load(A6, af='lowpass=f=6000'), BED, 0.0, -6)
    x += tile(load(A6, 0.83, 'lowpass=f=3000'), BED, 2.9, -9)
    scatter(x, [R5 + 'sfx100v2_air_01.ogg'], 9, -8, rng, 0.4, (0.8, 1.0))
    scatter(x, [KS + 'forceField_000.ogg', KS + 'forceField_003.ogg'], 11, -26, rng, 0.5, (0.9, 1.1), 'highpass=f=1200')
    return x


@recipe
def bed_vesper(rng):
    x = tile(load(A5), BED, 0.0, -2)
    x += tile(load(A5, 0.96), BED, 5.3, -8)
    x += tile(load(A6, 0.85, 'lowpass=f=2500'), BED, 0.0, -6)
    scatter(x, [BW % i for i in (1, 2, 3, 4)], 8, -20, rng, 0.3, (0.9, 1.0), 'lowpass=f=600')
    bell = load(KX + 'impactBell_heavy_001.ogg', 0.5, 'lowpass=f=2500,aecho=0.8:0.7:240|470:0.35|0.2')
    for t in (11.0, 43.5):
        place(x, peaknorm(bell), t, -16)
    return x


@recipe
def bed_sky(rng):
    x = tile(load(A6), BED, 0.0, 0)
    x += tile(load(A6, 0.79, 'lowpass=f=2000'), BED, 2.2, -3)
    x += tile(load(A6, 1.13, 'highpass=f=1500'), BED, 4.1, -12)
    scatter(x, [R5 + 'sfx100v2_air_01.ogg', R5 + 'sfx100v2_air_02.ogg'], 6.5, -4, rng, 0.4, (0.7, 0.95))
    scatter(x, [R7 + 'wood_cracking_01.ogg', R7 + 'wood_cracking_03.ogg'], 14, -24, rng, 0.4, (1.2, 1.4), 'highpass=f=900,aecho=0.8:0.6:300:0.35')
    return x


@recipe
def bed_capital(rng):
    x = tile(load(R8 + 'water_flowing.ogg'), BED, 0.0, 0)
    x += tile(load(R5 + 'sfx100v2_loop_water_01.ogg', af='highpass=f=300'), BED, 1.3, -6)
    x += tile(load(R5 + 'sfx100v2_loop_highway.ogg', 0.8, 'lowpass=f=350'), BED, 0.0, -14)
    steps = [KX + 'footstep_concrete_00%d.ogg' % i for i in range(5)]
    scatter(x, steps, 0.55, -22, rng, 0.25, (0.95, 1.05), 'aecho=0.8:0.5:60|130:0.35|0.2', start=4.0)
    scatter(x, [R4 + 'bell_01.ogg', R4 + 'bell_03.ogg'], 21, -24, rng, 0.3, (0.6, 0.75), 'lowpass=f=3000,aecho=0.8:0.6:350:0.4')
    scatter(x, [KR + 'cloth1.ogg', KR + 'cloth3.ogg', KR + 'clothBelt.ogg'], 9, -26, rng, 0.5, (0.7, 0.9), 'lowpass=f=4000')
    return x


@recipe
def bed_shrine(rng):
    x = tile(load(A6, 0.88, 'lowpass=f=1600'), BED, 0.0, 0)
    x += tile(load(A5, 0.98), BED, 3.3, -6)
    drone = load(KS + 'spaceEngineLow_002.ogg', 0.75, 'lowpass=f=220,lowpass=f=220')
    x += tile(drone, BED, 0.0, -14, xfade=0.6)
    chimes = [KX + 'impactGlass_light_00%d.ogg' % i for i in range(5)]
    t = 3.0
    while t < BED - 2:
        for k in range(int(rng.integers(2, 5))):
            place(x, peaknorm(load(chimes[rng.integers(5)], float(rng.choice([1.0, 1.12, 1.26, 1.5])), 'aecho=0.8:0.7:180|400:0.4|0.25')), t + k * rng.uniform(0.12, 0.3), -20)
        t += rng.uniform(6, 11)
    return x


@recipe
def bed_forge(rng):
    x = tile(load(R8 + 'machine_08.ogg', af='lowpass=f=1800'), BED, 0.0, 0)
    x += tile(load(R8 + 'machine_11.ogg', 0.9, 'lowpass=f=1200'), BED, 2.0, -3)
    steam = envelope(tile(load(R8 + 'noise_01.ogg', af='highpass=f=1500'), BED, 0.0, 0), [(0, -24), (6, -8), (9, -24), (25, -24), (29, -7), (33, -24), (47, -24), (51, -8), (55, -24), (64, -24)])
    x += steam
    thump = load(KX + 'impactSoft_heavy_000.ogg', 0.6, 'lowpass=f=300,aecho=0.8:0.5:200:0.3')
    for k in range(int(BED / 3.2)):
        place(x, peaknorm(thump), 0.8 + k * 3.2, -12)
    scatter(x, [R7 + 'metal_hit_0%d.ogg' % i for i in (1, 2, 3, 4)], 5.5, -22, rng, 0.5, (0.8, 1.0), 'aecho=0.8:0.6:220:0.35')
    scatter(x, [R3 + 'chain_01.ogg', R3 + 'chain_02.ogg'], 15, -24, rng, 0.4, (0.85, 1.0), 'aecho=0.8:0.5:180:0.3')
    x += tile(load(A6, 0.75, 'lowpass=f=1200'), BED, 1.0, -10)
    return x


@recipe
def bed_cinder(rng):
    x = tile(load(KS + 'thrusterFire_000.ogg', 0.8, 'lowpass=f=700'), BED, 0.0, 0, xfade=0.5)
    x += rmsnorm(load(M9, trim=(40, 40 + BED), af='lowpass=f=250,lowpass=f=250')) * db(-3)
    x += tile(load(R8 + 'water_boiling.ogg', 0.7, 'lowpass=f=1500'), BED, 0.0, -10)
    hammer = [R7 + 'hammer_0%d.ogg' % i for i in (1, 2, 3, 4)]
    t = 2.0
    while t < BED - 2:
        h = load(hammer[rng.integers(4)], float(rng.uniform(0.9, 1.0)), 'aecho=0.8:0.6:240:0.35')
        for k in range(int(rng.integers(2, 4))):
            place(x, peaknorm(h), t + k * 0.62, -16)
        t += rng.uniform(5, 9)
    scatter(x, [R3 + 'spell_fire_07.ogg', R3 + 'spell_fire_06.ogg'], 7, -26, rng, 0.5, (0.8, 1.0), 'highpass=f=1500')
    x += tile(load(A6, 0.8, 'lowpass=f=2500'), BED, 0.0, -12)
    return x


@recipe
def bed_rift(rng):
    x = rmsnorm(load(M12, trim=(226, 226 + BED), af='lowpass=f=400,lowpass=f=400'))
    x += tile(load(A6, 0.7, 'lowpass=f=700'), BED, 0.0, -12)
    scatter(x, [R4 + 'plop_01.ogg', R4 + 'plop_02.ogg', R6 + 'bubble_02.ogg'], 12, -22, rng, 0.35, (0.75, 0.9), 'lowpass=f=2500,aecho=0.8:0.8:400|900:0.4|0.25')
    return x


@recipe
def bed_marrow(rng):
    x = rmsnorm(load(A4, trim=(0, BED)))
    scatter(x, [KX + 'impactMining_00%d.ogg' % i for i in range(5)], 9, -26, rng, 0.4, (0.85, 1.0), 'lowpass=f=2500,aecho=0.8:0.7:200|450:0.4|0.25')
    scatter(x, [R7 + 'wood_squeak_01.ogg', R7 + 'wood_squeak_02.ogg'], 16, -28, rng, 0.4, (0.6, 0.75), 'lowpass=f=2000,aecho=0.8:0.6:250:0.3')
    return x


# ─── theme region: rift (M12, nothing above 1 kHz) ────────────────────────────────────────────────────────

@recipe
def theme_rift(rng):
    # a quiet, burst-free stretch of "Post Apocalyptic Wastelands" (100–142 s), two-pole 1 kHz low-pass
    return load(M12, trim=(100, 142), af='lowpass=f=1000,lowpass=f=1000')


# ─── sfx designs ──────────────────────────────────────────────────────────────────────────────────────────

def layered(parts, length=None):
    """parts = [(path, t, gain, rate, af)]"""
    srcs = [(peaknorm(load(p, r, af)), t, g) for p, t, g, r, af in parts]
    n = max(int(t * SR) + s.shape[1] for s, t, _ in srcs)
    if length:
        n = int(length * SR)
    x = np.zeros((2, n), np.float32)
    for s, t, g in srcs:
        place(x, s, t, g)
    return x


def sfx(name, parts, length=None, fin=0.0, fout=0.01):
    def fn(rng):
        return fade(layered(parts, length), fin, fout)
    fn.__name__ = name
    RECIPES[name] = fn


for i, (snow, mix_) in enumerate([(3, 1), (4, 2), (0, 3)], start=1):
    sfx(f'step_sand_{i}', [(KX + f'footstep_snow_00{snow}.ogg', 0, 0, 0.82, 'lowpass=f=2400'), (KR + f'footstep0{mix_}.ogg', 0, -8, 0.9, 'lowpass=f=1500')])
    sfx(f'step_gravel_{i}', [(KR + f'footstep0{mix_ + 3}.ogg', 0, 0, 1.0, ''), (R5 + f'sfx100v2_stones_0{i}.ogg', 0.01, -7, 1.15, 'highpass=f=600')], 0.4)
    sfx(f'step_salt_{i}', [(KX + f'footstep_snow_00{(snow + 1) % 5}.ogg', 0, 0, 1.12, 'highpass=f=500'), (KX + f'footstep_concrete_00{i}.ogg', 0, -6, 1.0, '')])
    sfx(f'step_ash_{i}', [(KX + f'footstep_concrete_00{i + 1}.ogg', 0, -2, 0.95, ''), (KX + f'footstep_snow_00{snow}.ogg', 0, -5, 0.75, 'lowpass=f=1200')])
    sfx(f'grass_rustle_{i}', [(KX + f'footstep_grass_00{i + 1}.ogg', 0, 0, 1.08, 'highpass=f=900'), (KR + f'cloth{i + 1}.ogg', 0.03, -9, 1.1, 'highpass=f=1200')])
for i, g in enumerate([0, 2], start=1):
    sfx(f'hit_crit_{i}', [(KX + f'impactPunch_heavy_00{g + 3 if g < 2 else 4}.ogg', 0, 0, 1.0, ''), (KX + f'impactGlass_heavy_00{g}.ogg', 0, -4, 1.0, ''), (KX + f'impactMetal_light_00{g + 1}.ogg', 0.01, -9, 1.0, '')])
    sfx(f'faint_{i}', [(KX + f'impactSoft_heavy_00{3 + g // 2}.ogg', 0.05, 0, 0.85, 'lowpass=f=1500'), (KD + 'lowDown.ogg', 0.18, -12, 0.75, 'lowpass=f=1800'), (R5 + 'sfx100v2_air_02.ogg', 0.25, -12, 0.7, '')], fout=0.2)
    sfx(f'orb_break_{i}', [(KX + f'impactGlass_light_00{g}.ogg', 0, 0, 1.1, ''), (MS + ('magical_2.ogg' if i == 1 else 'magical_5.ogg'), 0.03, -8, 1.2, 'highpass=f=800'), (R5 + 'sfx100v2_air_03.ogg', 0.05, -6, 1.0, '')], fout=0.15)
sfx('flee_1', [(KX + 'footstep_grass_000.ogg', 0.00, 0, 1.25, ''), (KX + 'footstep_grass_002.ogg', 0.16, -3, 1.25, ''), (KX + 'footstep_grass_004.ogg', 0.31, -7, 1.25, ''), (KX + 'footstep_grass_001.ogg', 0.45, -12, 1.25, ''), (R5 + 'sfx100v2_air_02.ogg', 0.05, -8, 1.2, '')], 1.0, fout=0.25)
sfx('switch_1', [(KR + 'metalClick.ogg', 0, 0, 1.2, ''), (KD + 'phaserUp1.ogg', 0.06, -10, 0.8, 'lowpass=f=5000'), (R5 + 'sfx100v2_air_03.ogg', 0.1, -6, 1.0, ''), (KI + 'drop_002.ogg', 0.4, -6, 1.0, '')])
sfx('orb_throw_1', [(AP + 'battle/swing.wav', 0, 0, 1.0, ''), (AP + 'battle/swing2.wav', 0.15, -6, 1.3, 'highpass=f=1500'), (KX + 'impactGeneric_light_000.ogg', 0.62, -6, 1.2, '')])
for i in (1, 2, 3):
    sfx(f'orb_shake_{i}', [(KX + f'impactPlate_light_00{i - 1}.ogg', 0, 0, 1.2, 'lowpass=f=3000'), (KX + f'impactPlate_light_00{i + 1}.ogg', 0.18, -3, 1.25, 'lowpass=f=3000')], 0.5)
sfx('orb_catch_1', [(KR + 'metalLatch.ogg', 0, 0, 1.0, ''), (KD + 'zap1.ogg', 0.05, -18, 1.5, 'highpass=f=2000'), (KI + 'confirmation_002.ogg', 0.35, -6, 1.0, 'lowpass=f=4000')], fout=0.2)
sfx('status_sleep_1', [(KD + 'highDown.ogg', 0, 0, 0.8, 'lowpass=f=3000'), (R5 + 'sfx100v2_air_02.ogg', 0.4, -8, 0.8, 'lowpass=f=2500')], 1.2, fout=0.25)
RECIPES['weather_rain_1'] = lambda rng: envelope(load(R6 + 'loop_rain.ogg', trim=(0, 3.2)), [(0, -24), (1.4, 0), (3.2, 0)])
RECIPES['weather_rain_1'].__name__ = 'weather_rain_1'


@recipe
def weather_hail_1(rng):
    x = envelope(peaknorm(load(R5 + "sfx100v2_air_01.ogg", 0.9)), [(0, -6), (0.6, 0), (2.9, -14)])
    x = np.concatenate([x, silence(max(0, 3.2 - x.shape[1] / SR))], axis=1)
    t = 0.6
    while t < 3.0:
        place(x, peaknorm(load(KX + "impactGlass_light_00%d.ogg" % rng.integers(5), float(rng.uniform(1.3, 1.8)), "highpass=f=2000")), t, -10 + rng.uniform(-6, 0))
        t += rng.uniform(0.03, 0.12)
    return fade(x, 0, 0.3)


@recipe
def weather_sand_1(rng):
    x = tile(load(A6, 1.1, 'highpass=f=400'), 3.2, 0.0, 0)
    x += tile(load(R8 + 'noise_01.ogg', af='highpass=f=3000'), 3.2, 0.0, -8)
    return envelope(x, [(0, -24), (1.6, 0), (2.8, -2), (3.2, -20)])


@recipe
def weather_sun_1(rng):
    x = load(R5 + 'sfx100v2_air_01.ogg', 0.85, 'areverse,lowpass=f=4000')
    place(x, peaknorm(load(MS + "magical_3.ogg", 1.0, "highpass=f=1500")), max(0, x.shape[1] / SR - 1.2), -10)
    return fade(x, 0.1, 0.4)


@recipe
def wind_gust_2(rng):
    return envelope(tile(load(A6, 0.92), 2.6, 1.0, 0), [(0, -30), (1.1, 0), (2.6, -30)])


@recipe
def raid_phase_1(rng):
    return fade(layered([(KS + 'lowFrequency_explosion_000.ogg', 0, 0, 0.9, ''), (KX + 'impactGlass_heavy_001.ogg', 0, -6, 0.8, ''), (KS + 'spaceEngineLow_000.ogg', 0.6, -10, 0.8, 'lowpass=f=400,afade=t=in:d=1.2')], 2.0), 0, 0.2)


@recipe
def raid_roar_1(rng):
    return fade(layered([(R2 + 'monster_20.ogg', 0, 0, 0.62, ''), (R3 + 'creature_roar_03.ogg', 0.05, -4, 0.7, ''), (R2 + 'roar_05.ogg', 0.1, -8, 0.6, 'lowpass=f=900')]), 0, 0.3)


sfx('cry_steel_1', [(AP + 'NPC/ogre/ogre2.wav', 0, 0, 1.05, ''), (R7 + 'metal_spring_01.ogg', 0.02, -10, 1.0, 'aecho=0.8:0.4:40:0.3')])
sfx('cry_fairy_1', [(R1 + 'cute_04.ogg', 0, 0, 1.33, ''), (KI + 'glass_005.ogg', 0.05, -10, 1.0, 'aecho=0.8:0.5:70:0.3')])
sfx('cry_fairy_2', [(R1 + 'cute_06.ogg', 0, 0, 1.4, ''), (KI + 'glass_006.ogg', 0.12, -10, 1.12, 'aecho=0.8:0.5:70:0.3')])
sfx('cry_cosmic_1', [(R1 + 'monster_04.ogg', 0, 0, 0.8, 'aecho=0.8:0.7:180|420:0.45|0.3')], fout=0.25)
sfx('cry_cosmic_2', [(R1 + 'monster_07.ogg', 0, 0, 0.85, 'aecho=0.8:0.7:200|460:0.45|0.3')], fout=0.25)
sfx('move_water_1', [(R5 + 'sfx100v2_loop_water_01.ogg', 0, 0, 1.0, 'afade=t=in:d=0.6')], 0.8, fout=0.08)
sfx('move_grass_1', [(KR + 'cloth2.ogg', 0, -2, 0.9, 'highpass=f=700'), (KX + 'footstep_grass_003.ogg', 0.1, -3, 1.1, 'highpass=f=700'), (R7 + 'wood_cracking_01.ogg', 0.55, 0, 1.2, '')], 0.8)
sfx('impact_grass_1', [(R7 + 'wood_hit_03.ogg', 0, 0, 1.1, ''), (KX + 'footstep_grass_004.ogg', 0.02, -4, 1.2, 'highpass=f=1200')])
sfx('move_ice_1', [(KI + 'glass_005.ogg', 0.0, -6, 1.5, ''), (KI + 'glass_006.ogg', 0.12, -5, 1.68, ''), (KI + 'glass_002.ogg', 0.25, -4, 1.33, ''), (KI + 'glass_003.ogg', 0.4, -3, 1.78, ''), (R5 + 'sfx100v2_air_02.ogg', 0, -8, 1.3, 'highpass=f=2000')], 0.8)
sfx('move_ground_1', [(KS + 'spaceEngineLow_001.ogg', 0, 0, 0.7, 'lowpass=f=300,afade=t=in:d=0.6'), (KX + 'impactMining_003.ogg', 0.45, -10, 0.7, 'lowpass=f=1500')], 0.8)
sfx('move_flying_1', [(AP + 'inventory/cloth-heavy.wav', 0, 0, 0.9, ''), (AP + 'inventory/cloth-heavy.wav', 0.28, -1, 0.85, ''), (R5 + 'sfx100v2_air_02.ogg', 0.1, -6, 1.0, '')], 0.8)
sfx('impact_flying_1', [(AP + 'battle/swing3.wav', 0, 0, 0.9, ''), (KX + 'impactSoft_medium_000.ogg', 0.12, -2, 1.3, '')])
sfx('move_bug_1', [(KS + 'engineCircular_001.ogg', 0, 0, 2.2, 'highpass=f=300,afade=t=in:d=0.4')], 0.8)
sfx('move_ghost_1', [(R5 + 'sfx100v2_air_01.ogg', 0, 0, 0.75, 'areverse,lowpass=f=2500')], 0.8, fin=0.05)
RECIPES['move_ghost_2'] = lambda rng: fade(load('subs/ghost-breath/ghostbreath.flac', 1.1, 'areverse', trim=(0.0, 1.0)), 0.05, 0.05)
RECIPES['move_ghost_2'].__name__ = 'move_ghost_2'
sfx('impact_ghost_1', [(KX + 'impactWood_heavy_001.ogg', 0, 0, 0.8, 'lowpass=f=900,aecho=0.8:0.7:110|240:0.5|0.3')], fout=0.1)
sfx('move_dragon_1', [(R1 + 'breath.ogg', 0, 0, 0.6, 'areverse'), (R2 + 'roar_04.ogg', 0.35, -10, 0.7, 'lowpass=f=800')], 0.8)
sfx('impact_dragon_1', [(KS + 'explosionCrunch_002.ogg', 0, 0, 0.85, ''), (R2 + 'roar_06.ogg', 0.02, -9, 0.75, 'lowpass=f=1200')])
sfx('move_dark_1', [(R5 + 'sfx100v2_air_01.ogg', 0, 0, 0.6, 'lowpass=f=1200'), (AP + 'battle/magic1.wav', 0.1, -10, 0.6, 'lowpass=f=1500')], 0.8)
sfx('move_cosmic_1', [(KS + 'spaceEngineLow_003.ogg', 0, 0, 0.6, 'lowpass=f=250,afade=t=in:d=0.6'), (MS + 'magical_3.ogg', 0.1, -8, 1.2, 'highpass=f=2000')], 0.8)
sfx('impact_cosmic_1', [(KS + 'lowFrequency_explosion_001.ogg', 0, 0, 0.9, ''), (KI + 'glass_004.ogg', 0.02, -6, 0.75, 'aecho=0.8:0.6:120:0.4')])
sfx('bell_toll_1', [(KX + 'impactBell_heavy_001.ogg', 0, 0, 0.55, 'lowpass=f=2200,aecho=0.8:0.85:300|700|1300:0.5|0.35|0.2')], 3.5, fout=0.6)
sfx('door_heavy_1', [(R7 + 'metal_open_01.ogg', 0, 0, 0.8, 'lowpass=f=3000'), (R7 + 'metal_slam_01.ogg', 1.0, -2, 0.75, 'lowpass=f=2500')])
sfx('lens_hum_1', [(KS + 'spaceEngineSmall_000.ogg', 0, 0, 0.7, 'lowpass=f=1500,afade=t=in:d=1.2'), (KD + 'phaserUp1.ogg', 0.9, -16, 0.5, 'highpass=f=1500')], 3.0, fout=0.6)
sfx('lore_tablet_1', [(R3 + 'stones_02.ogg', 0, -2, 0.7, 'lowpass=f=1500'), (KS + 'spaceEngineLow_004.ogg', 0, -4, 0.6, 'lowpass=f=300,afade=t=in:d=0.5'), (MS + 'magical_3.ogg', 0.5, -12, 1.0, 'highpass=f=2500')], 2.0, fout=0.4)
sfx('ui_witness_1', [(KR + 'metalClick.ogg', 0, 0, 1.3, ''), (R4 + 'bell_03.ogg', 0.15, -6, 1.12, 'lowpass=f=6000')], 1.6, fout=0.3)


@recipe
def ui_stinger_thinning_1(rng):
    # a music-box phrase of "Crystal Cave" that forgets itself: notes drop out one by one, the tone dulls
    x = load(M11, trim=(17.9, 22.2))
    t = np.arange(x.shape[1]) / SR
    gate = np.ones_like(t)
    for a, b in ((1.6, 1.9), (2.3, 2.7), (2.9, 3.3), (3.4, 4.3)):
        gate[(t >= a) & (t < b)] = 0.15
    gate = np.convolve(gate, np.ones(480) / 480, mode='same')
    x = x * gate.astype(np.float32)
    y = load(M11, trim=(17.9, 22.2), af='lowpass=f=700')
    w = np.clip(t / 3.5, 0, 1).astype(np.float32)
    n = min(x.shape[1], y.shape[1])
    out = x[:, :n] * (1 - w[:n]) + y[:, :n] * gate[:n].astype(np.float32) * w[:n]
    return envelope(out, [(0, 0), (2.0, -2), (4.2, -18)])



# ─── signature moves (client battle/signatures.ts): one layered design per move, played from the cinematic's `aim`
# frame (the charge) — t = 0 is the charge, the impact transient sits at windup + travel (the timeline's damage frame).

def _shots(path, times, gain, rate=1.0, af=''):
    return [(path, t, gain, rate, af) for t in times]


# Hollow Crescent (impact 0.68): a dark swell and a ghostly breath, the slash, a crunching cut and an ominous ring
sfx('sig_hollow_crescent_1', [
    (R5 + 'sfx100v2_air_01.ogg', 0.0, -4, 0.7, 'areverse,lowpass=f=2500'),
    (KS + 'spaceEngineLow_002.ogg', 0.0, -8, 0.6, 'lowpass=f=600,afade=t=in:d=0.4'),
    ('subs/ghost-breath/ghostbreath.flac', 0.1, -12, 0.9, 'areverse'),
    (AP + 'battle/swing3.wav', 0.42, -2, 0.8, ''),
    (R3 + 'blade_02.ogg', 0.45, -6, 1.0, ''),
    (KS + 'explosionCrunch_002.ogg', 0.68, 0, 0.8, ''),
    (KX + 'impactGlass_heavy_001.ogg', 0.68, -6, 0.7, ''),
    (KX + 'impactBell_heavy_001.ogg', 0.70, -14, 0.5, 'lowpass=f=1500,aecho=0.8:0.7:180|400:0.4|0.25'),
], 1.8, fout=0.4)

# Vendetta Volley (rounds 0.42 + 0.046·i, the last lands 0.84): cannons hum and a lock tone, eight shots, metal pings,
# casings, the fireball
sfx('sig_vendetta_volley_1', [
    (KS + 'forceField_001.ogg', 0.0, -8, 0.8, 'afade=t=in:d=0.3'),
    (KD + 'phaserUp3.ogg', 0.05, -10, 0.6, ''),
    (KD + 'twoTone1.ogg', 0.30, -12, 1.0, ''),
    *_shots(R4 + 'shot_01.ogg', [0.42, 0.512, 0.604, 0.696], -2),
    *_shots(R4 + 'shot_02.ogg', [0.466, 0.558, 0.65, 0.742], -4),
    *_shots(KX + 'impactMetal_heavy_001.ogg', [0.52, 0.61, 0.70, 0.79], -14, 1.2),
    *_shots(KX + 'impactPlate_light_001.ogg', [0.75, 0.9, 1.05], -18, 1.6),
    (KS + 'explosionCrunch_000.ogg', 0.84, 0, 0.9, ''),
    (KS + 'lowFrequency_explosion_000.ogg', 0.84, -10, 1.0, ''),
], 2.0, fout=0.4)

# Cosmic Pyre (impact 0.84): five star-fires kindle, fire gathers, the comet launches and lands as a roaring pillar
sfx('sig_cosmic_pyre_1', [
    *[(KI + f'glass_00{i + 1}.ogg', 0.02 + 0.07 * i, -12, 1.2 + 0.1 * i, '') for i in range(5)],
    (R3 + 'spell_fire_03.ogg', 0.10, -6, 0.8, ''),
    (KS + 'thrusterFire_001.ogg', 0.48, -4, 0.9, ''),
    (R5 + 'sfx100v2_air_02.ogg', 0.50, -8, 0.8, ''),
    (R3 + 'spell_fire_06.ogg', 0.84, 0, 0.7, ''),
    (KS + 'lowFrequency_explosion_001.ogg', 0.84, 0, 1.0, ''),
    (KS + 'thrusterFire_003.ogg', 0.86, -6, 0.6, 'lowpass=f=2500'),
], 2.0, fout=0.5)

# Sparking Grace (impact 0.66): a sparkling rising ribbon, a dancing zap, a crackling bloom with a shimmer tail
sfx('sig_sparking_grace_1', [
    (KD + 'phaserUp2.ogg', 0.0, -6, 1.2, ''),
    (MS + 'magical_5.ogg', 0.05, -8, 1.3, ''),
    *[(KI + f'glass_00{i}.ogg', t, -14, 1.6, '') for i, t in ((2, 0.15), (4, 0.25), (6, 0.35))],
    (KD + 'zapTwoTone.ogg', 0.42, -4, 1.0, ''),
    (KD + 'laser4.ogg', 0.48, -8, 1.3, ''),
    (KS + 'forceField_002.ogg', 0.66, -4, 1.4, ''),
    (KX + 'impactGlass_light_002.ogg', 0.66, -6, 1.4, ''),
    (MS + 'magical_3.ogg', 0.70, -8, 1.4, ''),
], 1.6, fout=0.4)

# Sunbreaker Barrage (fists land 0.55 + 0.07·i, the sun-burst 0.90): a radiant swell, six punches, a cracking blast
sfx('sig_sunbreaker_barrage_1', [
    (MS + 'magical_7_0.ogg', 0.0, -8, 0.8, ''),
    (KS + 'thrusterFire_000.ogg', 0.0, -10, 0.7, 'lowpass=f=2000,afade=t=in:d=0.3'),
    *[(KX + f'impactPunch_heavy_00{i % 5}.ogg', 0.55 + 0.07 * i, -2 - (i % 2), 1.0, '') for i in range(6)],
    *[(AP + 'battle/swing.wav', 0.50 + 0.07 * i, -14, 1.2, '') for i in range(6)],
    (KS + 'explosionCrunch_003.ogg', 0.90, 0, 0.9, ''),
    (KX + 'impactGlass_heavy_002.ogg', 0.92, -4, 0.8, ''),
    (KS + 'lowFrequency_explosion_000.ogg', 0.90, -4, 1.0, ''),
], 2.0, fout=0.4)

# Foxfire Voltage (wisps launch 0.46+, land 0.68–0.84, the cage 0.84): crackling foxfire, launches, zaps, the cage
# snapping shut, a paralysing buzz
sfx('sig_foxfire_voltage_1', [
    (R3 + 'spell_fire_01.ogg', 0.0, -6, 1.3, ''),
    (KS + 'forceField_000.ogg', 0.05, -10, 1.2, ''),
    *[(KD + f'laser{n}.ogg', t, -10 - 2 * k, 1.2, '') for k, (n, t) in enumerate(((2, 0.46), (3, 0.52), (5, 0.58)))],
    *[(KD + f'zap{n}.ogg', t, g, 1.2, '') for n, t, g in ((1, 0.68, -8), (2, 0.74, -8), (1, 0.80, -6))],
    (KD + 'zapThreeToneDown.ogg', 0.84, -2, 1.0, ''),
    (KS + 'forceField_003.ogg', 0.84, -11, 0.9, ''),
    (KS + 'impactMetal_002.ogg', 0.84, -6, 1.0, ''),
    (KS + 'computerNoise_001.ogg', 0.95, -20, 1.0, 'highpass=f=2000'),
], 1.9, fout=0.4)

# Kamehameha (beam fires 0.70, hits 1.00, holds to ~1.6): a long rising ki hum, the beam's roar, the blast
sfx('sig_kamehameha_1', [
    (KS + 'spaceEngineSmall_002.ogg', 0.0, -6, 0.7, 'afade=t=in:d=0.6'),
    (KD + 'phaserUp6.ogg', 0.05, -8, 0.5, ''),
    (KS + 'forceField_001.ogg', 0.30, -10, 1.0, ''),
    (KS + 'laserLarge_002.ogg', 0.70, 0, 0.7, ''),
    (KS + 'thrusterFire_002.ogg', 0.72, -8, 0.8, ''),
    (KS + 'spaceEngineLarge_001.ogg', 0.72, -6, 0.9, 'lowpass=f=2000'),
    (KS + 'lowFrequency_explosion_000.ogg', 1.00, 0, 1.0, ''),
    (KS + 'explosionCrunch_001.ogg', 1.00, -3, 1.0, ''),
    (KX + 'impactPunch_heavy_003.ogg', 1.00, -2, 0.8, ''),
], 2.3, fout=0.6)

# Cosmic Miracle (stars fall 0.46–0.90, the nova 0.90, healing after): cure chimes, falling pews, a bright nova, a cure
sfx('sig_cosmic_miracle_1', [
    (CM + 'Cure3.wav', 0.0, -6, 1.0, ''),
    *_shots(KD + 'highDown.ogg', [0.46, 0.58, 0.70], -12, 1.3),
    *[(KI + f'glass_00{i}.ogg', t + 0.1, -14, 1.4, '') for i, t in ((3, 0.46), (5, 0.58), (1, 0.70))],
    (MS + 'magical_1_0.ogg', 0.90, 0, 1.0, ''),
    (KX + 'impactGlass_heavy_001.ogg', 0.90, -4, 1.3, ''),
    (KS + 'lowFrequency_explosion_001.ogg', 0.90, -8, 1.2, 'lowpass=f=1800'),
    (CM + 'Cure6.wav', 1.00, -17, 1.0, ''),
], 2.4, fout=0.6)

# Stellar Devour (engulfs 0.84, collapses 1.17–1.29, pops 1.34): a deep inhale and drone, the drift, the swallow,
# a whirring spin-up, the collapse and a pop
sfx('sig_stellar_devour_1', [
    (R5 + 'sfx100v2_air_01.ogg', 0.0, -7, 0.5, 'areverse,lowpass=f=900'),
    (KS + 'spaceEngineLow_003.ogg', 0.0, -9, 0.5, 'lowpass=f=300,afade=t=in:d=0.4'),
    (KD + 'phaserDown2.ogg', 0.48, -10, 0.5, ''),
    (KS + 'lowFrequency_explosion_001.ogg', 0.84, 0, 0.7, ''),
    (KX + 'impactPunch_heavy_002.ogg', 0.84, -3, 0.6, ''),
    (R2 + 'roar_06.ogg', 0.86, -10, 0.5, 'lowpass=f=800'),
    (KS + 'engineCircular_002.ogg', 0.90, -8, 0.8, ''),
    (KD + 'lowDown.ogg', 1.17, -6, 0.7, ''),
    (KS + 'explosionCrunch_004.ogg', 1.34, -2, 1.2, ''),
    (MS + 'magical_6_0.ogg', 1.36, -10, 0.8, ''),
], 2.2, fout=0.5)

# Bankai Sever (the red line 0.20, glint 0.42, flash-step 0.52, cuts 0.64 / 0.665): pressure, the blade drawn, a glint,
# a whoosh, a beat of silence, two cuts and an eerie ring
sfx('sig_bankai_sever_1', [
    (KS + 'spaceEngineLow_000.ogg', 0.0, -10, 0.55, 'lowpass=f=400,afade=t=in:d=0.2,afade=t=out:st=0.4:d=0.12'),
    (R5 + 'sfx100v2_air_01.ogg', 0.0, -13, 0.6, 'areverse,afade=t=out:st=0.45:d=0.08'),
    (AP + 'battle/sword-unsheathe3.wav', 0.20, -11, 0.9, ''),
    (KI + 'glass_003.ogg', 0.42, -10, 2.0, ''),
    (AP + 'battle/swing2.wav', 0.52, -2, 1.3, ''),
    (R3 + 'blade_01.ogg', 0.64, 0, 1.1, ''),
    (R3 + 'blade_03.ogg', 0.665, -2, 1.0, ''),
    (KX + 'impactMetal_heavy_002.ogg', 0.64, -2, 0.7, ''),
    (KX + 'impactBell_heavy_000.ogg', 0.68, -16, 0.5, 'lowpass=f=1200,aecho=0.8:0.7:200|450:0.4|0.25'),
], 2.0, fout=0.5)

# Rift Collapse (cracks 0–0.25, the tear 0.44, implosion 0.71, slams shut 0.80, shards after): low glass cracks, a
# descending tear, a rising suck, the slam and tinkling shards
sfx('sig_rift_collapse_1', [
    *[(KX + f'impactGlass_light_00{i}.ogg', t, -10, 0.7, '') for i, t in ((0, 0.02), (1, 0.08), (2, 0.15), (3, 0.22))],
    (KS + 'forceField_004.ogg', 0.0, -10, 0.6, ''),
    (R5 + 'sfx100v2_air_02.ogg', 0.44, -4, 0.6, ''),
    (KD + 'phaserDown3.ogg', 0.44, -10, 0.5, ''),
    (KD + 'phaserUp4.ogg', 0.60, -6, 0.6, ''),
    (KS + 'explosionCrunch_002.ogg', 0.80, 0, 0.8, ''),
    (KX + 'impactGlass_heavy_003.ogg', 0.80, -2, 0.8, ''),
    *[(R5 + f'sfx100v2_glass_0{i}.ogg', t, g, 1.2, '') for i, t, g in ((1, 0.90, -10), (2, 1.00, -12), (3, 1.12, -14), (4, 1.25, -16))],
], 2.0, fout=0.5)

# Aurora Requiem (the crystal 0.80, cracks 1.10, shatters 1.22): a cold shimmer and wind, chimes along the trail, the
# freeze, a crack, the shatter
sfx('sig_aurora_requiem_1', [
    (MS + 'magical_4.ogg', 0.0, -6, 0.7, ''),
    (A6, 0.0, -12, 0.8, 'afade=t=in:d=0.3,afade=t=out:st=0.9:d=0.6'),
    *[(KI + f'glass_00{i}.ogg', t, -10, 1.5, '') for i, t in ((1, 0.46), (2, 0.54), (3, 0.62), (4, 0.70))],
    (KS + 'forceField_002.ogg', 0.80, -7, 0.6, ''),
    (KX + 'impactGlass_heavy_000.ogg', 0.80, 0, 1.3, ''),
    (R5 + 'sfx100v2_glass_03.ogg', 1.10, -6, 0.9, ''),
    (KX + 'impactGlass_light_001.ogg', 1.12, -8, 1.0, ''),
    (KX + 'impactGlass_heavy_004.ogg', 1.22, 0, 1.0, ''),
    (R5 + 'sfx100v2_glass_05.ogg', 1.24, -4, 1.0, ''),
], 2.2, fout=0.5)

# Cosmic Convergence (four element orbs wheel in over the charge 0.00-0.50 and fuse at 0.45, the sphere crosses
# 0.50-0.80, bursts on the impact at 0.80 in four rings): a rising shimmer, one sound per element as its orb enters
# (water, stone, fire, wind), the fusing hum, the release whoosh, a low boom with a glass strike and a bell, chimes
# rising out of the burst
sfx('sig_cosmic_convergence_1', [
    (MS + 'magical_4.ogg', 0.0, -8, 0.7, 'afade=t=in:d=0.2'),
    (R5 + 'sfx100v2_loop_water_01.ogg', 0.04, -14, 1.1, 'afade=t=out:st=0.2:d=0.1'),
    (R3 + 'stones_02.ogg', 0.14, -12, 0.9, 'lowpass=f=2500'),
    (R3 + 'spell_fire_06.ogg', 0.24, -12, 1.0, ''),
    (R5 + 'sfx100v2_air_01.ogg', 0.32, -12, 1.1, 'afade=t=out:st=0.2:d=0.1'),
    (KS + 'forceField_002.ogg', 0.42, -8, 0.8, ''),
    (R5 + 'sfx100v2_air_02.ogg', 0.50, -6, 1.2, 'afade=t=out:st=0.25:d=0.05'),
    (MS + 'magical_5.ogg', 0.52, -10, 1.0, 'highpass=f=800'),
    (KS + 'lowFrequency_explosion_001.ogg', 0.80, -4, 1.0, ''),
    (KX + 'impactGlass_heavy_000.ogg', 0.80, -2, 1.0, ''),
    (KX + 'impactBell_heavy_004.ogg', 0.81, -8, 1.2, 'aecho=0.8:0.6:160:0.3'),
    *[(KI + f'glass_00{i}.ogg', 0.86 + 0.07 * k, -12, 1.2 + 0.1 * k, '') for k, i in enumerate((1, 2, 3, 4))],
    (KS + 'spaceEngineLow_002.ogg', 0.90, -16, 0.6, 'lowpass=f=500,afade=t=in:d=0.1,afade=t=out:st=0.3:d=0.2'),
], 2.0, fout=0.5)


# Crimson Lotus Prison (sky petals open 0.00-0.33, the dragon 0.46-0.80, the lotus closes 0.80, its heart burns 0.90-1.06,
# strains 1.10, shatters 1.22): a cold shimmer, a glass chime per petal, a rushing roar, the snap shut with a low thump,
# a crimson swell, a crack, the shatter
sfx('sig_crimson_lotus_prison_1', [
    (MS + 'magical_4.ogg', 0.0, -8, 0.6, ''),
    *[(KI + f'glass_00{i}.ogg', 0.02 + 0.06 * k, -14, 1.3 + 0.05 * k, '') for k, i in enumerate((1, 2, 3, 4, 5, 6))],
    (R5 + 'sfx100v2_air_01.ogg', 0.40, -14, 0.8, 'afade=t=out:st=0.3:d=0.1'),
    (R2 + 'roar_06.ogg', 0.46, -16, 0.8, 'lowpass=f=3000,afade=t=out:st=0.28:d=0.06'),
    (KS + 'forceField_002.ogg', 0.80, -7, 0.6, ''),
    (KX + 'impactGlass_heavy_000.ogg', 0.80, 0, 1.1, ''),
    (KS + 'lowFrequency_explosion_001.ogg', 0.80, -6, 1.0, ''),
    (KS + 'spaceEngineLow_002.ogg', 0.90, -14, 0.6, 'lowpass=f=500,afade=t=in:d=0.15,afade=t=out:st=0.2:d=0.12'),
    (R5 + 'sfx100v2_glass_03.ogg', 1.10, -6, 0.9, ''),
    (KX + 'impactGlass_heavy_004.ogg', 1.22, 0, 1.0, ''),
    (R5 + 'sfx100v2_glass_05.ogg', 1.24, -4, 1.0, ''),
], 2.2, fout=0.5)

# Demon Lord's Descent (astaroth dissolves into smoke 0.00-0.20, its eyes flare 0.26, the clover sigil draws under the foe
# 0.34-0.66, it drops 0.64-0.94, the greatsword lands on the impact at 0.94 and the katana crosses it at 0.97, ash after):
# a reversed breath and a low rumble, a short growl, a dark falling phaser, the drop's whoosh, then a heavy metal strike
# with a low boom, two blade cuts, a crunch and an eerie low ring
sfx('sig_demon_lords_descent_1', [
    (R5 + 'sfx100v2_air_01.ogg', 0.0, -16, 0.55, 'areverse,lowpass=f=900'),
    (KS + 'spaceEngineLow_000.ogg', 0.0, -19, 0.5, 'lowpass=f=300,afade=t=in:d=0.3,afade=t=out:st=0.7:d=0.2'),
    (R2 + 'roar_06.ogg', 0.26, -19, 0.6, 'lowpass=f=1200,afade=t=out:st=0.3:d=0.08'),
    (KS + 'forceField_004.ogg', 0.34, -25, 0.7, 'lowpass=f=1500,afade=t=out:st=0.4:d=0.15'),
    (KD + 'phaserDown2.ogg', 0.40, -22, 0.6, ''),
    (AP + 'battle/swing2.wav', 0.64, -10, 0.8, ''),
    (R5 + 'sfx100v2_air_02.ogg', 0.66, -15, 0.7, 'afade=t=out:st=0.22:d=0.06'),
    (KX + 'impactMetal_heavy_002.ogg', 0.94, 0, 0.6, ''),
    (KS + 'lowFrequency_explosion_001.ogg', 0.94, -3, 0.8, ''),
    (R3 + 'blade_01.ogg', 0.94, -2, 0.9, ''),
    (R3 + 'blade_03.ogg', 0.97, -3, 1.1, ''),
    (KS + 'explosionCrunch_004.ogg', 0.95, -6, 1.0, ''),
    (KX + 'impactBell_heavy_000.ogg', 0.98, -18, 0.5, 'lowpass=f=1200,aecho=0.8:0.7:200|450:0.4|0.25'),
    (KS + 'spaceEngineLow_002.ogg', 1.02, -20, 0.6, 'lowpass=f=500,afade=t=in:d=0.1,afade=t=out:st=0.3:d=0.3'),
], 2.2, fout=0.5)

# Thermal Shock (the seam opens and the fire and ice cores circle each other over the charge 0.00-0.70, faster and
# faster; the helix fires at 0.70 and hits at 1.00, holding to ~1.6): a cold shimmer under a fire swell, a fire crackle
# and a glass chime trading places as the cores circle, quickening, the helix's beam roar with a fire thrust and a cold
# rush, then the split blast: a low boom, a fire burst and a heavy glass shatter together, a hiss of steam after
sfx('sig_thermal_shock_1', [
    (MS + 'magical_4.ogg', 0.0, -8, 0.7, 'afade=t=in:d=0.2'),
    (R3 + 'spell_fire_06.ogg', 0.0, -12, 0.8, 'afade=t=in:d=0.3'),
    *[(R3 + 'spell_fire_06.ogg' if k % 2 == 0 else KI + f'glass_00{1 + k // 2}.ogg', t, -14 if k % 2 == 0 else -12, 1.2 + 0.04 * k, 'afade=t=out:st=0.12:d=0.06')
      for k, t in enumerate((0.12, 0.26, 0.37, 0.46, 0.53, 0.59, 0.64))],
    (KS + 'forceField_002.ogg', 0.40, -10, 0.8, ''),
    (KS + 'laserLarge_002.ogg', 0.70, 0, 0.75, ''),
    (KS + 'thrusterFire_002.ogg', 0.72, -8, 0.8, ''),
    (A6, 0.72, -12, 1.1, 'afade=t=out:st=0.4:d=0.3'),
    (KS + 'lowFrequency_explosion_000.ogg', 1.00, 0, 1.0, ''),
    (R3 + 'spell_fire_06.ogg', 1.00, -3, 0.7, ''),
    (KX + 'impactGlass_heavy_000.ogg', 1.00, -2, 1.0, ''),
    (KX + 'impactGlass_heavy_004.ogg', 1.04, -5, 1.1, ''),
    (R5 + 'sfx100v2_glass_05.ogg', 1.08, -8, 1.0, ''),
    (R5 + 'sfx100v2_air_02.ogg', 1.15, -12, 0.8, 'highpass=f=2500,afade=t=out:st=0.4:d=0.3'),
], 2.3, fout=0.6)


# ─── bond cinematics (client battle/bond.ts) ─────────────────────────────────────────────────────────────────────────
# A trainer's Majin / Tenjin transformation, from the `bond` frame (t = 0): two heartbeats that speed up and close in
# (BOND_BEATS: the trainer's deeper, the creature's higher), a drone rising under them, a breath of silence, then the
# answer at BOND_LOCK_MS 2.40 (Majin: the crack; Tenjin: the bell) and the form's burst at BOND_BURST_MS 2.70 (Majin: the
# roar; Tenjin: the choir). Keep these numbers equal to bond.ts.
BOND_TRAINER = (0.38, 0.94, 1.42, 1.82, 2.12)
BOND_CREATURE = (0.60, 1.08, 1.50, 1.85, 2.12)
BOND_LOCK, BOND_BURST = 2.40, 2.70


def _heartbeats(times, rate, lub, dub):
    """lub-dub per beat: a low soft thump, a quieter second 0.13 s later; each beat a little louder than the last"""
    out = []
    for i, t in enumerate(times):
        g = -16 + min(i, 3) * 2
        out.append((KX + f'impactSoft_heavy_00{lub}.ogg', t, g, rate, 'lowpass=f=260,lowpass=f=260'))
        out.append((KX + f'impactPunch_heavy_00{lub}.ogg', t, g - 10, rate * 0.9, 'lowpass=f=400'))
        out.append((KX + f'impactSoft_heavy_00{dub}.ogg', t + 0.13, g - 6, rate * 1.1, 'lowpass=f=300,lowpass=f=300'))
    return out


def _bond(hits, length):
    """the heartbeats, the drone and the riser, ducked to a breath of silence before the lock, then `hits` on top"""
    bed = layered([
        *_heartbeats(BOND_TRAINER, 0.55, 1, 2),
        *_heartbeats(BOND_CREATURE, 0.72, 3, 4),
        (KS + 'spaceEngineLow_002.ogg', 0.0, -14, 0.55, 'lowpass=f=420,afade=t=in:d=1.6,afade=t=out:st=1.9:d=0.25'),
        (R5 + 'sfx100v2_air_01.ogg', 0.18, -12, 1.2, 'areverse'),  # a reversed whoosh whose peak ends at 2.38
    ], length)
    bed = envelope(bed, [(0, 0), (2.24, 0), (2.32, -14), (2.38, -40), (length, -40)])
    x = layered(hits, length)
    return x + bed


def _choir(sec, notes=(220.0, 277.18, 329.63, 440.0, 554.37), attack=0.35, release=0.9):
    """an 'aah' chord: three detuned voices per note, additive saws shaped by vowel formants, a slow vibrato"""
    n = int(sec * SR)
    tt = np.arange(n) / SR
    vib = 1 + 0.004 * np.sin(2 * np.pi * 5.3 * tt)
    formants = ((800, 160, 1.0), (1150, 220, 0.6), (2900, 320, 0.25))
    out = np.zeros((2, n), np.float32)
    for ni, f0 in enumerate(notes):
        for vi, cents in enumerate((-7, 0, 6)):
            f = f0 * 2 ** (cents / 1200)
            phase = 2 * np.pi * np.cumsum(f * vib) / SR
            v = np.zeros(n)
            for k in range(1, int(4200 / f) + 1):
                w = sum(a * np.exp(-((k * f - c) / bw) ** 2) for c, bw, a in formants) + 0.05
                v += w * np.sin(k * phase) / k
            pan = 0.5 + 0.35 * ((vi - 1) * 0.6 + (ni - 2) * 0.15)
            out[0] += (v * (1 - pan)).astype(np.float32)
            out[1] += (v * pan).astype(np.float32)
    env = np.minimum(1, tt / attack) * np.clip((sec - tt) / release, 0, 1)
    return peaknorm(ffilter(out * env.astype(np.float32), 'aecho=0.8:0.6:70|130:0.3|0.2,highpass=f=150'))


@recipe
def bond_majin_1(rng):
    x = _bond([
        (KS + 'forceField_003.ogg', 0.9, -18, 0.5, 'lowpass=f=900,afade=t=in:d=0.8,afade=t=out:st=1.2:d=0.2'),
        # the lock: the strike cracks, glass splits, a crunch and a floor thump
        (KX + 'impactGlass_heavy_002.ogg', BOND_LOCK, 3, 0.75, ''),
        (R7 + 'wood_cracking_02.ogg', BOND_LOCK + 0.01, -4, 1.1, 'highpass=f=300'),
        (KS + 'explosionCrunch_001.ogg', BOND_LOCK + 0.02, -3, 0.85, ''),
        (KS + 'lowFrequency_explosion_001.ogg', BOND_LOCK, -5, 1.0, ''),
        (KX + 'impactGlass_medium_003.ogg', BOND_LOCK + 0.12, -9, 0.9, ''),
        # the burst: a blast, the roar, the floor drop
        (KS + 'explosionCrunch_003.ogg', BOND_BURST, -1, 0.8, ''),
        (R2 + 'monster_20.ogg', BOND_BURST, 0, 0.62, ''),
        (R3 + 'creature_roar_03.ogg', BOND_BURST + 0.04, -3, 0.7, ''),
        (R2 + 'roar_05.ogg', BOND_BURST + 0.08, -9, 0.6, 'lowpass=f=900'),
        (KS + 'lowFrequency_explosion_000.ogg', BOND_BURST, -4, 0.9, ''),
    ], 4.0)
    return fade(x, 0, 0.5)


@recipe
def bond_tenjin_1(rng):
    x = _bond([
        (CM + 'Cure3.wav', 1.0, -20, 0.8, 'afade=t=in:d=1.0,afade=t=out:st=0.9:d=0.3'),
        # the lock: one great bell over a soft floor thump, chimes rising as the seams flow
        (KX + 'impactBell_heavy_002.ogg', BOND_LOCK, 3, 0.7, 'aecho=0.8:0.7:220|480:0.45|0.3'),
        (KX + 'impactSoft_heavy_000.ogg', BOND_LOCK, -6, 0.6, 'lowpass=f=300'),
        *[(KI + f'glass_00{i}.ogg', BOND_LOCK + 0.05 + 0.06 * j, -10, 1.2 + 0.12 * j, '') for j, i in enumerate((1, 2, 3, 4, 5))],
        # the burst: a bright bell strike, the cure shimmer (the choir is placed below)
        (KX + 'impactBell_heavy_004.ogg', BOND_BURST, -4, 1.4, 'aecho=0.8:0.6:160:0.35'),
        (CM + 'Cure6.wav', BOND_BURST, -6, 1.0, ''),
        (MS + 'magical_6_0.ogg', BOND_BURST, -10, 0.9, 'highpass=f=600'),
    ], 4.0)
    place(x, _choir(1.3, release=0.6), BOND_BURST - 0.05, -2)
    return fade(x, 0, 0.4)

# the signature designs play over the whole battle mix: compressed and limited so the loudness pass reaches its target
# without the true-peak clamp (they are then raised +6 dB in the manifest)
def _sig_loud(fn):
    def loud(rng):
        return ffilter(fn(rng), 'acompressor=threshold=0.08:ratio=6:attack=3:release=120:makeup=3,alimiter=limit=0.7:level=false')
    loud.__name__ = fn.__name__
    loud.__wrapped__ = fn
    return loud


for _n in [n for n in RECIPES if n.startswith(('sig_', 'bond_'))]:
    RECIPES[_n] = _sig_loud(RECIPES[_n])


def main():
    global _cur
    names = sys.argv[1:] or sorted(RECIPES)
    manifest_path = os.path.join(OUT, 'MIXES.json')
    manifest = json.load(open(manifest_path)) if os.path.exists(manifest_path) else {}
    for name in names:
        _cur = name
        rng = np.random.default_rng(abs(hash_name(name)))
        x = RECIPES[name](rng)
        if name.startswith('bed_'):
            x = finish_bed(x)
        write(name, x)
        manifest[name + '.wav'] = sorted(USED.get(name, []))
    os.makedirs(OUT, exist_ok=True)
    json.dump(dict(sorted(manifest.items())), open(manifest_path, 'w'), indent=1)


def hash_name(s):
    h = 2166136261
    for c in s.encode():
        h = ((h ^ c) * 16777619) & 0xFFFFFFFF
    return h


if __name__ == '__main__':
    main()
