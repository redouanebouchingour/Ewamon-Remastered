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
