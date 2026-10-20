/**
 * SPEC §10.3.3 — physical sky + PMREM IBL.
 *
 * - Visible `SkyMesh` in the main scene on layer 30 (the camera enables it). SkyMesh projects to the
 *   far plane (`position.z = position.w`) and computes its ray from `positionWorld − cameraPosition`,
 *   so it is re-centred on the camera every frame (`follow`): a 200 m box parked at the origin would be
 *   exited by the camera on a 240 m route field (implementation note).
 * - The PMREM is baked from a SEPARATE scene holding a second SkyMesh with the sun disc hidden
 *   (`showSunDisc = 0`, as SkyMesh.js's header recommends for environment maps), through
 *   `pmrem.fromScene(skyScene, 0, 0.1, 400, { size: 128, renderTarget })`, reusing the previous target
 *   so re-bakes allocate nothing.
 * - Harvest level 2: turbidity 20, rayleigh 0.2, cloudCoverage 0.9 (the grey flat sky); level 1 is the
 *   midpoint.
 * - IBL normalisation (implementation note): SkyMesh's Preetham radiance averages ~2–6 scene-linear at
 *   noon (measured in the sandbox) and ~0.003 after dusk, while §10.3.5's envIntensity column assumes an
 *   average sky radiance of ~0.3 ("0.85 × 0.85 × 0.3 ≈ 0.22", the number behind the 1.10 ceiling).
 *   `scene.environmentIntensity = envIntensity × norm`, `norm = clamp(0.3 / L, 0, 200)`, where L is the
 *   env sky's mean luminance seen by a 150° upward probe. At every bake L is predicted synchronously from
 *   `SKY_LUMINANCE_BY_ELEVATION` (measured in the sandbox for the intact sky) times a correction factor;
 *   the env sky is then rendered once into a 16² probe and read back asynchronously, and the measured L
 *   refines `norm` and the correction (which absorbs weather cloud cover and the harvested sky). Colour and
 *   direction still come from the physical sky; only its overall level is normalised, and a time jump
 *   (night → noon) never renders a frame with the previous period's gain.
 */
import { DataUtils, HalfFloatType, PerspectiveCamera, PMREMGenerator, RenderTarget, Scene } from 'three/webgpu';
import type { Vector3, WebGPURenderer } from 'three/webgpu';
import { SkyMesh } from 'three/addons/objects/SkyMesh.js';
import { LAYERS, type HarvestLevel } from '../descriptors.js';
import { DEFAULT_CLOUD_COVERAGE } from './weather.js';

/** §10.3.3 intact values. */
export const SKY_INTACT = Object.freeze({
  turbidity: 3, rayleigh: 1.2, mieCoefficient: 0.004, mieDirectionalG: 0.8,
  cloudCoverage: DEFAULT_CLOUD_COVERAGE, cloudDensity: 0.4, cloudScale: 0.0002, cloudSpeed: 0.00002,
});
/** §10.3.3 harvest level 2 values. */
export const SKY_HARVESTED = Object.freeze({ turbidity: 20, rayleigh: 0.2, cloudCoverage: 0.9 });

export const PMREM_SIZE = 128;

/** Average sky radiance the §10.3.5 envIntensity column is calibrated against. */
export const SKY_REFERENCE_RADIANCE = 0.3;
/** Upper bound of the normalisation gain (keeps the near-black night sky from being amplified into a blue fog). */
export const SKY_MAX_GAIN = 200;
const PROBE_SIZE = 16;

/**
 * Mean luminance of the intact env sky (turbidity 3, rayleigh 1.2, cloud cover 0.35) seen by the 150°
 * upward probe, by sun elevation in degrees — measured in the sandbox on three 0.186 (`[elevation, L]`).
 */
export const SKY_LUMINANCE_BY_ELEVATION: readonly (readonly [number, number])[] = Object.freeze([
  [-90, 0.001377], [-4, 0.001377], [-2, 0.001506], [0, 0.007895], [2, 0.02302], [4, 0.04424], [6, 0.06932], [8, 0.0965],
  [12, 0.1524], [16, 0.2049], [20, 0.2516], [30, 0.3665], [45, 0.576], [60, 0.8421], [70, 1.052], [90, 1.3],
] as const);

/** Log-linear interpolation of `SKY_LUMINANCE_BY_ELEVATION`. Pure. */
export function priorSkyLuminance(elevationDeg: number): number {
  const t = SKY_LUMINANCE_BY_ELEVATION;
  if (!(elevationDeg > t[0]![0])) return t[0]![1];
  for (let i = 1; i < t.length; i++) {
    const [e1, l1] = t[i]!;
    if (elevationDeg <= e1) {
      const [e0, l0] = t[i - 1]!;
      const f = (elevationDeg - e0) / (e1 - e0);
      return Math.exp(Math.log(l0) + (Math.log(l1) - Math.log(l0)) * f);
    }
  }
  return t[t.length - 1]![1];
}

/** `clamp(reference / L, 0, maxGain)`; L ≤ 0 → maxGain. Pure. */
export function skyNormalization(meanLuminance: number, reference = SKY_REFERENCE_RADIANCE, maxGain = SKY_MAX_GAIN): number {
  if (!(meanLuminance > 0)) return maxGain;
  return Math.min(maxGain, reference / meanLuminance);
}

const lerp = (a: number, b: number, f: number): number => a + (b - a) * f;

export class SkyController {
  readonly sky: SkyMesh;
  private readonly envSky: SkyMesh;
  private readonly envScene = new Scene();
  private readonly pmrem: PMREMGenerator;
  private target: RenderTarget | null = null;
  private harvest = 0;
  private weatherCoverage: number = SKY_INTACT.cloudCoverage;
  /** Majin vs Tenjin seasons: the winning side's sky (added to the atmosphere after the harvest blend) */
  private moodTurbidity = 0;
  private moodRayleigh = 1;
  private envIntensity = 0.85;
  private norm = skyNormalization(priorSkyLuminance(70));
  private correction = 1;
  private sunElevationDeg = 70;
  private probing = false;
  private readonly probeTarget = new RenderTarget(PROBE_SIZE, PROBE_SIZE, { type: HalfFloatType, depthBuffer: false });
  private readonly probeCamera = new PerspectiveCamera(150, 1, 0.1, 400);
  private disposed = false;

  constructor(private readonly gpu: WebGPURenderer, private readonly scene: Scene) {
    this.probeCamera.position.set(0, 0, 0);
    this.probeCamera.lookAt(0, 1, 0.0001);
    this.probeCamera.updateMatrixWorld();
    this.sky = new SkyMesh();
    this.sky.name = 'ewa:sky';
    this.sky.scale.setScalar(200);
    this.sky.layers.set(LAYERS.sky);   // layer 30: excluded from dumpZone; GTAO skips it (depth = 1)
    this.sky.frustumCulled = false;
    this.sky.castShadow = false;
    this.sky.receiveShadow = false;

    this.envSky = new SkyMesh();
    this.envSky.name = 'ewa:sky-env';
    this.envSky.scale.setScalar(100);
    this.envSky.frustumCulled = false;
    this.envSky.showSunDisc.value = 0;
    this.envScene.add(this.envSky);

    for (const s of [this.sky, this.envSky]) {
      s.mieCoefficient.value = SKY_INTACT.mieCoefficient;
      s.mieDirectionalG.value = SKY_INTACT.mieDirectionalG;
      s.cloudDensity.value = SKY_INTACT.cloudDensity;
      s.cloudScale.value = SKY_INTACT.cloudScale;
      s.cloudSpeed.value = SKY_INTACT.cloudSpeed;
    }
    this.applyAtmosphere();

    this.pmrem = new PMREMGenerator(gpu);
    scene.add(this.sky);
  }

  /** Unit direction toward the sun (the real sun, even below the horizon, §10.3.4). */
  setSunDirection(x: number, y: number, z: number): void {
    this.sky.sunPosition.value.set(x, y, z);
    this.envSky.sunPosition.value.set(x, y, z);
    const len = Math.hypot(x, y, z) || 1;
    this.sunElevationDeg = Math.asin(Math.max(-1, Math.min(1, y / len))) * 180 / Math.PI;
  }

  /** §10.2.6 / §10.3.3: level 2 → grey flat sky; level 1 → midpoint. */
  setHarvest(level: HarvestLevel): void {
    this.harvest = level / 2;
    this.applyAtmosphere();
  }

  /** §10.3.6 weather cloud coverage (harvest level 2 overrides toward 0.9). */
  setCloudCoverage(c: number): void {
    this.weatherCoverage = c;
    this.applyAtmosphere();
  }

  /** Majin vs Tenjin seasons: the winning side's sky over Solenne (0 / 1 restore it). */
  setMood(turbidityAdd: number, rayleighMul: number): void {
    this.moodTurbidity = turbidityAdd;
    this.moodRayleigh = rayleighMul;
    this.applyAtmosphere();
  }

  /** `scene.environmentIntensity` (§10.3.5 envIntensity × weather). */
  setEnvironmentIntensity(v: number): void {
    this.envIntensity = v;
    this.scene.environmentIntensity = v * this.norm;
  }

  get environmentIntensity(): number { return this.envIntensity; }

  /** The current sky normalisation gain (see the header). */
  get normalization(): number { return this.norm; }

  private applyAtmosphere(): void {
    const h = this.harvest;
    const turbidity = lerp(SKY_INTACT.turbidity, SKY_HARVESTED.turbidity, h);
    const rayleigh = lerp(SKY_INTACT.rayleigh, SKY_HARVESTED.rayleigh, h);
    const coverage = lerp(this.weatherCoverage, SKY_HARVESTED.cloudCoverage, h);
    for (const s of [this.sky, this.envSky]) {
      s.turbidity.value = Math.max(1, turbidity + this.moodTurbidity);
      s.rayleigh.value = rayleigh * this.moodRayleigh;
      s.cloudCoverage.value = coverage;
    }
  }

  /** Re-centres the visible sky on the camera (no allocation). */
  follow(cameraPosition: Vector3): void {
    this.sky.position.copy(cameraPosition);
  }

  /** Bakes the PMREM from the env sky scene into the reused target and binds it as `scene.environment`. */
  bake(): void {
    if (this.disposed) return;
    const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 400, this.target ? { size: PMREM_SIZE, renderTarget: this.target } : { size: PMREM_SIZE });
    this.target = rt;
    if (this.scene.environment !== rt.texture) this.scene.environment = rt.texture;
    const el = this.sunElevationDeg;
    this.norm = skyNormalization(priorSkyLuminance(el) * this.correction);   // synchronous prediction
    this.scene.environmentIntensity = this.envIntensity * this.norm;
    this.probe(el);
  }

  /** Renders the env sky once into the 16² probe and reads its mean luminance back (async, one in flight). */
  private probe(elevationDeg: number): void {
    if (this.probing || this.disposed) return;
    this.probing = true;
    const gpu = this.gpu;
    const prev = gpu.getRenderTarget();
    gpu.setRenderTarget(this.probeTarget);
    gpu.render(this.envScene, this.probeCamera);
    gpu.setRenderTarget(prev);
    gpu.readRenderTargetPixelsAsync(this.probeTarget, 0, 0, PROBE_SIZE, PROBE_SIZE).then((buf) => {
      this.probing = false;
      if (this.disposed) return;
      const data = buf as Uint16Array;
      let sum = 0;
      const n = PROBE_SIZE * PROBE_SIZE;
      for (let i = 0; i < n; i++) {
        const r = DataUtils.fromHalfFloat(data[i * 4]!);
        const g = DataUtils.fromHalfFloat(data[i * 4 + 1]!);
        const b = DataUtils.fromHalfFloat(data[i * 4 + 2]!);
        sum += 0.2126 * r + 0.7152 * g + 0.0722 * b;
      }
      const measured = sum / n;
      this.correction = Math.min(20, Math.max(0.05, measured / priorSkyLuminance(elevationDeg)));
      if (Math.abs(this.sunElevationDeg - elevationDeg) < 2) {   // still the same sky: use the measurement
        this.norm = skyNormalization(measured);
        this.scene.environmentIntensity = this.envIntensity * this.norm;
      }
    }, () => { this.probing = false; });
  }

  get environmentTarget(): RenderTarget | null { return this.target; }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.scene.remove(this.sky);
    if (this.scene.environment === this.target?.texture) this.scene.environment = null;
    this.sky.geometry.dispose();
    (this.sky.material as { dispose(): void }).dispose();
    this.envSky.geometry.dispose();
    (this.envSky.material as { dispose(): void }).dispose();
    this.target?.dispose();
    this.target = null;
    this.probeTarget.dispose();
    this.pmrem.dispose();
  }
}
