import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { AI_DRIVERS, CAR_CATALOG, PAINT_COLORS } from './catalog';
import { RacingAudioEngine } from './audio';
import { buildCarModel, buildTrafficCarMesh, CarModelRig } from './carBuilder';
import { createProceduralTextures, ProceduralTextures } from './textures';
import { buildSumatraTrack, TrackEnvironment } from './track';
import {
  CameraMode,
  CarSpec,
  ControlInputs,
  GameMode,
  GameSettings,
  RaceStanding,
  TelemetryData,
} from './types';

interface RacerEntity {
  id: string;
  name: string;
  spec: CarSpec;
  colorHex: string;
  rig: CarModelRig;
  isPlayer: boolean;
  skill: number;

  // Spatial physics state
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  yaw: number;
  yawRate: number;
  steerAngle: number;
  wheelSpin: number;

  // Suspension visual state
  pitch: number;
  roll: number;
  suspY: number;
  suspVelY: number;

  // Gameplay state
  speedMs: number;
  rpm: number;
  gear: number;
  nitro: number;
  isNitro: boolean;
  isDrifting: boolean;
  isBraking: boolean;

  // Track progress
  sampleIdx: number;
  lap: number;
  nextCheckpointIdx: number; // 0..checkpoints.length (checkpoints.length means ready for finish line)
  totalProgress: number; // continuous distance-like progress for ranking
  finished: boolean;
  finishTimeMs: number;
  lapStartMs: number;
  bestLapMs: number;

  // AI target lane
  aiTargetLane: number;
  aiLaneTimer: number;
}

interface TrafficEntity {
  mesh: THREE.Group;
  distance: number;
  laneOffset: number;
  speedMs: number;
}

interface SmokeParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
}

// Pre-allocated math scratch objects (zero GC in render loop)
const _v1 = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _v3 = new THREE.Vector3();
const _forward = new THREE.Vector3();
const _right = new THREE.Vector3();
const _camTargetPos = new THREE.Vector3();
const _camLookTarget = new THREE.Vector3();
const _skyTop = new THREE.Color();
const _skyBot = new THREE.Color();
const _fogColor = new THREE.Color();
const _sunColor = new THREE.Color();

export class RacingEngine {
  private container: HTMLElement;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private isSoftwareGl: boolean;

  private textures: ProceduralTextures;
  private track: TrackEnvironment;
  public audio: RacingAudioEngine;

  // Lighting & Sky
  private sunLight: THREE.DirectionalLight;
  private hemiLight: THREE.HemisphereLight;
  private skyMat: THREE.ShaderMaterial;
  private fog: THREE.FogExp2;

  // Modes & Selection
  private mode: GameMode = 'circuit';
  private isPlaying = false;
  private isPaused = false;
  private showcaseMode: 'menu' | 'garage' = 'menu';
  private selectedCarId: string = CAR_CATALOG[0].id;
  private selectedPaintId: string = PAINT_COLORS[0].id;
  private settings: GameSettings;

  // Active actors
  private showcaseRig: CarModelRig | null = null;
  private racers: RacerEntity[] = [];
  private player: RacerEntity | null = null;
  private traffic: TrafficEntity[] = [];

  // Smoke particle pool
  private smokeParticles: SmokeParticle[] = [];
  private smokeGeo: THREE.BufferGeometry;
  private smokePoints: THREE.Points;
  private smokePositions: Float32Array;
  private smokeCursor = 0;

  // Speed streaks
  private speedLines: THREE.LineSegments;
  private speedLineMat: THREE.LineBasicMaterial;

  // Camera & Controls
  private cameraMode: CameraMode = 'third_person';
  private camCurrentPos = new THREE.Vector3();
  private camCurrentLook = new THREE.Vector3();
  private camShake = 0;
  private garageOrbitAngle = 0.65;
  private garageDragging = false;
  private garageLastX = 0;

  private inputs: ControlInputs = {
    throttle: false,
    brake: false,
    left: false,
    right: false,
    handbrake: false,
    nitro: false,
  };

  // Race timing
  private raceElapsedMs = 0;
  private countdownTimer = -1; // >0 means counting down
  private lastCountdownInt = 4;
  private dayCycleTime = 0; // 0..1

  // Loop management
  private clock = new THREE.Clock();
  private frameId = 0;
  private disposed = false;
  private telemetryAccum = 0;
  private onTelemetry: (data: TelemetryData) => void;
  private onContextLostCb?: (lost: boolean) => void;

  constructor(
    container: HTMLElement,
    initialSettings: GameSettings,
    onTelemetry: (data: TelemetryData) => void,
    onContextLost?: (lost: boolean) => void
  ) {
    this.container = container;
    this.settings = { ...initialSettings };
    this.onTelemetry = onTelemetry;
    this.onContextLostCb = onContextLost;
    this.audio = new RacingAudioEngine();
    this.audio.setVolume(initialSettings.volume);
    this.audio.setMuted(initialSettings.muted);

    // 1. Detect Software WebGL
    this.isSoftwareGl = (() => {
      try {
        const probe = document.createElement('canvas').getContext('webgl2');
        if (!probe) return true;
        const ext = probe.getExtension('WEBGL_debug_renderer_info');
        const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
        const gpu = String(probe.getParameter(param));
        probe.getExtension('WEBGL_lose_context')?.loseContext();
        return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
      } catch {
        return true;
      }
    })();

    // 2. Initialize Renderer
    this.renderer = new THREE.WebGLRenderer({
      antialias: !this.isSoftwareGl,
      powerPreference: 'high-performance',
    });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.setPixelRatio(
      this.isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, this.settings.highQuality ? 2 : 1.35)
    );
    this.renderer.shadowMap.enabled = !this.isSoftwareGl && this.settings.highQuality;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.setSize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);

    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    container.appendChild(this.renderer.domElement);

    this.renderer.domElement.addEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.addEventListener('webglcontextrestored', this.handleContextRestored);

    // 3. Scene & Studio Environment Map
    this.scene = new THREE.Scene();
    this.fog = new THREE.FogExp2(0x9ac5db, 0.00165);
    this.scene.fog = this.fog;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    pmrem.dispose();

    // 4. Camera
    const aspect = (container.clientWidth || window.innerWidth) / (container.clientHeight || window.innerHeight);
    this.camera = new THREE.PerspectiveCamera(62, aspect, 0.15, 1600);

    // 5. Sky Gradient Dome
    const skyGeo = new THREE.SphereGeometry(1100, 24, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(0x1d4ed8) },
        bottomColor: { value: new THREE.Color(0xbae6fd) },
      },
      vertexShader: `
        varying vec3 vWorldPos;
        void main() {
          vec4 wp = modelMatrix * vec4(position, 1.0);
          vWorldPos = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }
      `,
      fragmentShader: `
        uniform vec3 topColor;
        uniform vec3 bottomColor;
        varying vec3 vWorldPos;
        void main() {
          float h = normalize(vWorldPos).y;
          float t = clamp(pow(max(h, 0.0), 0.55), 0.0, 1.0);
          gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);
        }
      `,
    });
    this.scene.add(new THREE.Mesh(skyGeo, this.skyMat));

    // 6. Lighting Rig (Sun + Hemisphere)
    this.hemiLight = new THREE.HemisphereLight(0x93c5fd, 0x3f4e32, 0.72);
    this.scene.add(this.hemiLight);

    this.sunLight = new THREE.DirectionalLight(0xfff5e0, 1.85);
    this.sunLight.position.set(140, 210, 120);
    this.sunLight.castShadow = !this.isSoftwareGl && this.settings.highQuality;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    const d = 65;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 420;
    this.sunLight.shadow.bias = -0.0005;
    this.sunLight.shadow.normalBias = 0.02;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);

    // 7. Procedural Textures & Sumatran Mountain Track
    this.textures = createProceduralTextures(this.renderer.capabilities.getMaxAnisotropy());
    this.track = buildSumatraTrack(this.textures, this.isSoftwareGl);
    this.scene.add(this.track.group);

    // 8. Tire Smoke Particle Pool
    const maxSmoke = 180;
    this.smokePositions = new Float32Array(maxSmoke * 3);
    for (let i = 0; i < maxSmoke; i++) {
      this.smokeParticles.push({
        active: false,
        pos: new THREE.Vector3(0, -100, 0),
        vel: new THREE.Vector3(),
        life: 0,
        maxLife: 0.75,
      });
      this.smokePositions[i * 3 + 1] = -100;
    }
    this.smokeGeo = new THREE.BufferGeometry();
    this.smokeGeo.setAttribute('position', new THREE.BufferAttribute(this.smokePositions, 3));
    const smokeMat = new THREE.PointsMaterial({
      color: 0xe5e7eb,
      size: 1.15,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
    });
    this.smokePoints = new THREE.Points(this.smokeGeo, smokeMat);
    this.smokePoints.frustumCulled = false;
    this.scene.add(this.smokePoints);

    // 9. Speed Lines attached to camera
    const streakCount = 36;
    const streakPos = new Float32Array(streakCount * 6);
    for (let i = 0; i < streakCount; i++) {
      const angle = (i / streakCount) * Math.PI * 2;
      const rad = 2.4 + Math.random() * 1.6;
      const x = Math.cos(angle) * rad;
      const y = Math.sin(angle) * rad * 0.65;
      streakPos[i * 6] = x;
      streakPos[i * 6 + 1] = y;
      streakPos[i * 6 + 2] = -3.0;
      streakPos[i * 6 + 3] = x * 1.15;
      streakPos[i * 6 + 4] = y * 1.15;
      streakPos[i * 6 + 5] = -7.5;
    }
    const streakGeo = new THREE.BufferGeometry();
    streakGeo.setAttribute('position', new THREE.BufferAttribute(streakPos, 3));
    this.speedLineMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0,
    });
    this.speedLines = new THREE.LineSegments(streakGeo, this.speedLineMat);
    this.camera.add(this.speedLines);
    this.scene.add(this.camera);

    // 10. Build Initial Showcase Car
    this.rebuildShowcaseCar();
    this.applyTimeOfDay(0.2);

    if (!this.isSoftwareGl) {
      this.renderer.compile(this.scene, this.camera);
    }

    // Bind resize & garage drag listeners
    window.addEventListener('resize', this.handleResize);
    this.renderer.domElement.addEventListener('pointerdown', this.handlePointerDown);
    window.addEventListener('pointermove', this.handlePointerMove);
    window.addEventListener('pointerup', this.handlePointerUp);

    this.clock.start();
    this.tick();
  }

  private handleContextLost = (e: Event) => {
    e.preventDefault();
    this.onContextLostCb?.(true);
  };

  private handleContextRestored = () => {
    this.onContextLostCb?.(false);
  };

  private handlePointerDown = (e: PointerEvent) => {
    if (!this.isPlaying && this.showcaseMode === 'garage') {
      this.garageDragging = true;
      this.garageLastX = e.clientX;
    }
  };

  private handlePointerMove = (e: PointerEvent) => {
    if (this.garageDragging && !this.isPlaying) {
      const dx = e.clientX - this.garageLastX;
      this.garageLastX = e.clientX;
      this.garageOrbitAngle -= dx * 0.008;
    }
  };

  private handlePointerUp = () => {
    this.garageDragging = false;
  };

  private handleResize = () => {
    if (this.disposed) return;
    const w = this.container.clientWidth || window.innerWidth;
    const h = this.container.clientHeight || window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
  };

  public setShowcaseMode(mode: 'menu' | 'garage'): void {
    this.showcaseMode = mode;
    if (mode === 'garage') {
      this.garageOrbitAngle = 0.72;
    }
  }

  public setSelectedCar(carId: string, paintId: string): void {
    const changed = carId !== this.selectedCarId || paintId !== this.selectedPaintId;
    this.selectedCarId = carId;
    this.selectedPaintId = paintId;
    if (changed && !this.isPlaying) {
      this.rebuildShowcaseCar();
    }
  }

  public updateSettings(next: GameSettings): void {
    this.settings = { ...next };
    this.audio.setVolume(next.volume);
    this.audio.setMuted(next.muted);
    if (!this.isSoftwareGl) {
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, next.highQuality ? 2 : 1.35));
      this.renderer.shadowMap.enabled = next.highQuality;
      this.sunLight.castShadow = next.highQuality;
    }
  }

  public setInput<K extends keyof ControlInputs>(key: K, value: boolean): void {
    this.inputs[key] = value;
  }

  public clearInputs(): void {
    this.inputs.throttle = false;
    this.inputs.brake = false;
    this.inputs.left = false;
    this.inputs.right = false;
    this.inputs.handbrake = false;
    this.inputs.nitro = false;
  }

  public cycleCamera(): CameraMode {
    const order: CameraMode[] = ['third_person', 'cockpit', 'bumper'];
    const next = order[(order.indexOf(this.cameraMode) + 1) % order.length];
    this.cameraMode = next;
    return next;
  }

  public setPaused(paused: boolean): void {
    this.isPaused = paused;
    this.audio.setDrivingActive(this.isPlaying && !paused);
    if (!paused) {
      this.clock.getDelta();
    }
  }

  public resetPlayerToTrack(): void {
    if (!this.player) return;
    const closest = this.track.findClosestSample(
      this.player.pos.x,
      this.player.pos.z,
      this.player.sampleIdx
    );
    this.player.pos.copy(closest.sample.position);
    this.player.vel.set(0, 0, 0);
    this.player.speedMs = 0;
    this.player.yawRate = 0;
    this.player.yaw = Math.atan2(closest.sample.tangent.x, closest.sample.tangent.z);
    this.player.sampleIdx = closest.sample.index;
  }

  private clearRaceActors(): void {
    for (const r of this.racers) {
      this.scene.remove(r.rig.root);
      r.rig.dispose();
    }
    this.racers = [];
    this.player = null;

    for (const t of this.traffic) {
      this.scene.remove(t.mesh);
    }
    this.traffic = [];
  }

  private rebuildShowcaseCar(): void {
    if (this.showcaseRig) {
      this.scene.remove(this.showcaseRig.root);
      this.showcaseRig.dispose();
      this.showcaseRig = null;
    }
    if (this.isPlaying) return;

    const spec = CAR_CATALOG.find((c) => c.id === this.selectedCarId) ?? CAR_CATALOG[0];
    const paint = PAINT_COLORS.find((p) => p.id === this.selectedPaintId) ?? PAINT_COLORS[0];
    const rig = buildCarModel(spec, paint.hex, this.textures, {
      isPlayer: false,
      isSoftwareGl: this.isSoftwareGl,
    });

    const sf = this.track.samples[0];
    rig.root.position.copy(sf.position);
    rig.root.rotation.y = Math.atan2(sf.tangent.x, sf.tangent.z);
    this.scene.add(rig.root);
    this.showcaseRig = rig;
  }

  public stopRaceToMenu(): void {
    this.isPlaying = false;
    this.isPaused = false;
    this.audio.setDrivingActive(false);
    this.clearRaceActors();
    this.speedLineMat.opacity = 0;
    this.camera.fov = 62;
    this.camera.updateProjectionMatrix();
    this.rebuildShowcaseCar();
  }

  public startRace(mode: GameMode): void {
    this.mode = mode;
    this.isPlaying = true;
    this.isPaused = false;
    this.raceElapsedMs = 0;
    this.cameraMode = 'third_person';
    this.clearInputs();

    if (this.showcaseRig) {
      this.scene.remove(this.showcaseRig.root);
      this.showcaseRig.dispose();
      this.showcaseRig = null;
    }
    this.clearRaceActors();

    const playerSpec = CAR_CATALOG.find((c) => c.id === this.selectedCarId) ?? CAR_CATALOG[0];
    const playerPaint = PAINT_COLORS.find((p) => p.id === this.selectedPaintId) ?? PAINT_COLORS[0];

    const createRacer = (
      id: string,
      name: string,
      spec: CarSpec,
      colorHex: string,
      isPlayer: boolean,
      gridIndex: number,
      skill: number
    ): RacerEntity => {
      const rig = buildCarModel(spec, colorHex, this.textures, {
        isPlayer,
        isSoftwareGl: this.isSoftwareGl,
      });

      // Staggered 2-column starting grid behind Start/Finish line
      const row = Math.floor(gridIndex / 2);
      const col = gridIndex % 2 === 0 ? -1 : 1;
      const distBack = 8 + row * 9.5;
      const sample = this.track.getSampleAtDistance(this.track.totalLength - distBack);
      const pos = sample.position.clone().addScaledVector(sample.right, col * 3.1);
      const yaw = Math.atan2(sample.tangent.x, sample.tangent.z);

      rig.root.position.copy(pos);
      rig.root.rotation.y = yaw;
      this.scene.add(rig.root);

      return {
        id,
        name,
        spec,
        colorHex,
        rig,
        isPlayer,
        skill,
        pos,
        vel: new THREE.Vector3(),
        yaw,
        yawRate: 0,
        steerAngle: 0,
        wheelSpin: 0,
        pitch: 0,
        roll: 0,
        suspY: 0,
        suspVelY: 0,
        speedMs: 0,
        rpm: 1100,
        gear: 1,
        nitro: 100,
        isNitro: false,
        isDrifting: false,
        isBraking: false,
        sampleIdx: sample.index,
        lap: 1,
        nextCheckpointIdx: 0,
        totalProgress: -distBack,
        finished: false,
        finishTimeMs: 0,
        lapStartMs: 0,
        bestLapMs: 0,
        aiTargetLane: col * 2.8,
        aiLaneTimer: 1 + Math.random() * 2,
      };
    };

    if (mode === 'circuit') {
      // 5 AI opponents + Player starting in P6 (grid index 5) for exciting overtakes
      AI_DRIVERS.forEach((ai, idx) => {
        const aiSpec = CAR_CATALOG.find((c) => c.id === ai.carId) ?? CAR_CATALOG[0];
        this.racers.push(
          createRacer(`ai_${idx}`, ai.name, aiSpec, ai.colorHex, false, idx, ai.skill)
        );
      });
      this.player = createRacer(
        'player',
        'Pembalap (Anda)',
        playerSpec,
        playerPaint.hex,
        true,
        5,
        1.0
      );
      this.racers.push(this.player);
      this.countdownTimer = 3.2;
      this.lastCountdownInt = 4;
    } else if (mode === 'timetrial') {
      this.player = createRacer(
        'player',
        'Pembalap (Anda)',
        playerSpec,
        playerPaint.hex,
        true,
        0,
        1.0
      );
      this.racers.push(this.player);
      this.countdownTimer = 3.2;
      this.lastCountdownInt = 4;
    } else {
      // Free Drive with 8 ambient Indonesian traffic vehicles
      this.player = createRacer(
        'player',
        'Pembalap (Anda)',
        playerSpec,
        playerPaint.hex,
        true,
        0,
        1.0
      );
      this.racers.push(this.player);
      this.countdownTimer = -1;

      const trafficColors = ['#e2e8f0', '#334155', '#991b1b', '#0f766e', '#d97706', '#1e3a8a'];
      for (let i = 0; i < 8; i++) {
        const mesh = buildTrafficCarMesh(trafficColors[i % trafficColors.length]);
        this.scene.add(mesh);
        this.traffic.push({
          mesh,
          distance: ((i + 1) / 9) * this.track.totalLength,
          laneOffset: i % 2 === 0 ? 3.4 : -3.4,
          speedMs: 14 + (i % 3) * 3.5, // ~50-75 km/h mountain cruising
        });
      }
    }

    // Snap camera immediately behind player at start
    if (this.player) {
      const fwdX = Math.sin(this.player.yaw);
      const fwdZ = Math.cos(this.player.yaw);
      this.camCurrentPos.set(
        this.player.pos.x - fwdX * 7.2,
        this.player.pos.y + 2.6,
        this.player.pos.z - fwdZ * 7.2
      );
      this.camCurrentLook.set(
        this.player.pos.x + fwdX * 6,
        this.player.pos.y + 1.0,
        this.player.pos.z + fwdZ * 6
      );
      this.camera.position.copy(this.camCurrentPos);
      this.camera.lookAt(this.camCurrentLook);
    }

    this.audio.unlock();
    this.audio.setDrivingActive(true);
    this.emitTelemetry();
  }

  private applyTimeOfDay(cycle01: number): string {
    // 0.0 = Crisp Sumatran Midday; 1.0 = Warm Golden Afternoon Sunset
    let blend = 0;
    let label = 'Siang Cerah';

    if (this.settings.timeOfDay === 'day') {
      blend = 0.05;
      label = 'Siang Cerah';
    } else if (this.settings.timeOfDay === 'afternoon') {
      blend = 0.92;
      label = 'Sore Emas';
    } else {
      blend = 0.5 - 0.5 * Math.cos(cycle01 * Math.PI * 2);
      label = blend < 0.45 ? 'Siang Cerah' : blend < 0.72 ? 'Menjelang Sore' : 'Sore Emas';
    }

    // Sun angle drops from 62 deg (day) down to 14 deg (golden afternoon)
    const sunElev = THREE.MathUtils.lerp(1.08, 0.25, blend);
    const sunAzim = THREE.MathUtils.lerp(0.65, 1.85, blend);
    const sunDist = 240;
    const sunOffsetX = Math.cos(sunElev) * Math.cos(sunAzim) * sunDist;
    const sunOffsetY = Math.sin(sunElev) * sunDist;
    const sunOffsetZ = Math.cos(sunElev) * Math.sin(sunAzim) * sunDist;

    const focusPos = this.player ? this.player.pos : this.track.samples[0].position;
    this.sunLight.position.set(
      focusPos.x + sunOffsetX,
      focusPos.y + sunOffsetY,
      focusPos.z + sunOffsetZ
    );
    this.sunLight.target.position.copy(focusPos);

    // Colors
    _sunColor.setHex(0xfff5e0).lerp(new THREE.Color(0xff8c42), blend);
    this.sunLight.color.copy(_sunColor);
    this.sunLight.intensity = THREE.MathUtils.lerp(1.9, 1.45, blend);

    _skyTop.setHex(0x1d4ed8).lerp(new THREE.Color(0x312e81), blend);
    _skyBot.setHex(0xbae6fd).lerp(new THREE.Color(0xfdba74), blend);
    this.skyMat.uniforms.topColor.value.copy(_skyTop);
    this.skyMat.uniforms.bottomColor.value.copy(_skyBot);

    _fogColor.setHex(0x9ac5db).lerp(new THREE.Color(0xd99166), blend);
    this.fog.color.copy(_fogColor);

    this.hemiLight.color.setHex(0x93c5fd).lerp(new THREE.Color(0xfdba74), blend);
    this.hemiLight.groundColor.setHex(0x3f4e32).lerp(new THREE.Color(0x27272a), blend);
    this.hemiLight.intensity = THREE.MathUtils.lerp(0.75, 0.52, blend);

    // Street lamps & player headlight beams illuminate during afternoon
    this.track.streetLampBulbMat.emissiveIntensity = THREE.MathUtils.lerp(0.15, 2.2, blend);
    if (this.player) {
      for (const spot of this.player.rig.headlightSpots) {
        spot.intensity = blend > 0.55 ? (blend - 0.55) * 95 : 0;
      }
    }

    return label;
  }

  private spawnSmoke(x: number, y: number, z: number): void {
    const p = this.smokeParticles[this.smokeCursor];
    this.smokeCursor = (this.smokeCursor + 1) % this.smokeParticles.length;
    p.active = true;
    p.pos.set(x + (Math.random() - 0.5) * 0.4, y + 0.18, z + (Math.random() - 0.5) * 0.4);
    p.vel.set((Math.random() - 0.5) * 1.4, 0.9 + Math.random() * 0.8, (Math.random() - 0.5) * 1.4);
    p.life = 0;
    p.maxLife = 0.55 + Math.random() * 0.35;
  }

  private stepSmoke(dt: number): void {
    let dirty = false;
    for (let i = 0; i < this.smokeParticles.length; i++) {
      const p = this.smokeParticles[i];
      if (!p.active) continue;
      p.life += dt;
      if (p.life >= p.maxLife) {
        p.active = false;
        this.smokePositions[i * 3 + 1] = -100;
      } else {
        p.pos.addScaledVector(p.vel, dt);
        this.smokePositions[i * 3] = p.pos.x;
        this.smokePositions[i * 3 + 1] = p.pos.y;
        this.smokePositions[i * 3 + 2] = p.pos.z;
      }
      dirty = true;
    }
    if (dirty) {
      (this.smokeGeo.attributes.position as THREE.BufferAttribute).needsUpdate = true;
    }
  }

  private stepRacerPhysics(r: RacerEntity, dt: number, canMove: boolean): void {
    const phys = r.spec.physics;
    let throttle = 0;
    let brake = 0;
    let steerInput = 0;
    let handbrake = false;
    let wantNitro = false;

    if (canMove) {
      if (r.isPlayer && !r.finished) {
        throttle = this.inputs.throttle ? 1 : 0;
        brake = this.inputs.brake ? 1 : 0;
        steerInput = (this.inputs.left ? 1 : 0) - (this.inputs.right ? 1 : 0);
        handbrake = this.inputs.handbrake;
        wantNitro = this.inputs.nitro;
      } else {
        // AI Controller (also drives player car gently after finish line)
        const aiOut = this.computeAiControls(r, dt);
        throttle = aiOut.throttle;
        brake = aiOut.brake;
        steerInput = aiOut.steer;
        handbrake = aiOut.handbrake;
        wantNitro = aiOut.nitro;
      }
    }

    // Smooth steering angle
    const targetSteer = steerInput * 0.58;
    r.steerAngle = THREE.MathUtils.damp(r.steerAngle, targetSteer, 11, dt);

    // Local basis vectors
    _forward.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
    _right.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));

    const forwardVel = r.vel.dot(_forward);
    const lateralVel = r.vel.dot(_right);

    // Nitro logic
    r.isNitro = wantNitro && r.nitro > 1.5 && throttle > 0.1 && forwardVel > 4;
    if (r.isNitro) {
      r.nitro = Math.max(0, r.nitro - 24 * dt);
    } else {
      const rechargeRate = r.isDrifting ? 14 : 5.5;
      r.nitro = Math.min(100, r.nitro + rechargeRate * dt);
    }

    const maxSpeedMs = (phys.maxSpeedKmh / 3.6) * (r.isNitro ? 1.18 : 1.0) * (r.isPlayer ? 1.0 : r.skill);
    const engineForce = phys.engineForce * (r.isNitro ? phys.nitroBoost : 1.0) * (r.isPlayer ? 1.0 : r.skill);

    // Longitudinal acceleration / braking / reverse
    let accel = 0;
    r.isBraking = false;
    if (throttle > 0) {
      const speedRatio = Math.max(0, forwardVel / maxSpeedMs);
      const torqueCurve = Math.max(0.15, 1.0 - speedRatio * 0.82);
      accel += throttle * engineForce * torqueCurve;
    }
    if (brake > 0) {
      if (forwardVel > 1.5) {
        accel -= brake * phys.brakeForce;
        r.isBraking = true;
      } else {
        // Reverse gear
        accel -= brake * engineForce * 0.45;
      }
    }
    if (handbrake && Math.abs(forwardVel) > 2) {
      accel -= Math.sign(forwardVel) * phys.brakeForce * 0.28;
      r.isBraking = true;
    }

    // Aerodynamic & rolling drag
    const drag = -forwardVel * (0.045 + Math.abs(forwardVel) * 0.0022);
    const newForwardVel = THREE.MathUtils.clamp(
      forwardVel + (accel + drag) * dt,
      -maxSpeedMs * 0.32,
      maxSpeedMs
    );

    // Steering & Drifting lateral grip
    const speedFactor = THREE.MathUtils.clamp(Math.abs(newForwardVel) / 8.5, 0, 1);
    const reverseSign = newForwardVel >= -0.2 ? 1 : -1;
    const highSpeedStability = 1.0 / (1.0 + Math.abs(newForwardVel) * 0.014);
    const turnMultiplier = handbrake ? 1.28 : 1.0;

    const targetYawRate =
      steerInput * phys.turnRate * speedFactor * highSpeedStability * turnMultiplier * reverseSign;
    r.yawRate = THREE.MathUtils.damp(r.yawRate, targetYawRate, 10, dt);
    r.yaw += r.yawRate * dt;

    const grip = handbrake ? phys.driftGrip : phys.lateralGrip;
    const newLateralVel = lateralVel * Math.exp(-grip * dt);

    r.isDrifting =
      Math.abs(newForwardVel) > 10 &&
      (handbrake || Math.abs(lateralVel) > 3.6);

    // Reconstruct world velocity
    _forward.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
    _right.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
    r.vel.copy(_forward).multiplyScalar(newForwardVel).addScaledVector(_right, newLateralVel);
    r.speedMs = r.vel.length();

    // Advance position
    r.pos.addScaledVector(r.vel, dt);

    // Project onto track & handle boundaries / height / elevation
    const proj = this.track.findClosestSample(r.pos.x, r.pos.z, r.sampleIdx);
    const prevSampleIdx = r.sampleIdx;
    r.sampleIdx = proj.sample.index;

    // Guardrail Boundary Collision
    const maxLat = this.track.halfWidth - r.spec.dimensions.width * 0.42;
    if (Math.abs(proj.lateralOffset) > maxLat) {
      const sign = Math.sign(proj.lateralOffset);
      const excess = Math.abs(proj.lateralOffset) - maxLat;
      // Push inside guardrail
      r.pos.addScaledVector(proj.sample.right, -sign * excess);
      // Reflect/dampen outward velocity component
      const outwardVel = r.vel.dot(proj.sample.right) * sign;
      if (outwardVel > 0) {
        r.vel.addScaledVector(proj.sample.right, -sign * outwardVel * 1.35);
        r.vel.multiplyScalar(0.84);
        if (r.isPlayer && outwardVel > 3.5) {
          this.audio.playCollision(outwardVel / 25);
          this.camShake = Math.min(0.45, outwardVel * 0.015);
        }
      }
    }

    // Track surface elevation + suspension spring-damper for uneven asphalt/kerbs
    const groundY = proj.sample.position.y;
    const bump = this.track.getSurfaceBump(proj.sample.distance, proj.lateralOffset);
    const targetSuspY = bump * (0.6 + Math.min(1.2, r.speedMs / 35));
    const stiff = 120 * phys.suspensionStiffness;
    const damp = 14;
    const forceY = (targetSuspY - r.suspY) * stiff - r.suspVelY * damp;
    r.suspVelY += forceY * dt;
    r.suspY = THREE.MathUtils.clamp(r.suspY + r.suspVelY * dt, -0.18, 0.18);
    r.pos.y = groundY;

    // Pitch (acceleration squat / braking dive) & Body Roll (cornering G)
    const targetPitch = THREE.MathUtils.clamp(-accel * 0.0022, -0.055, 0.055);
    const targetRoll = THREE.MathUtils.clamp(r.yawRate * r.speedMs * 0.0018, -0.09, 0.09);
    r.pitch = THREE.MathUtils.damp(r.pitch, targetPitch, 9, dt);
    r.roll = THREE.MathUtils.damp(r.roll, targetRoll, 9, dt);

    // Automatic 6-Speed Gearbox & RPM Calculation
    const kmh = r.speedMs * 3.6;
    const prevGear = r.gear;
    if (newForwardVel < -0.8) {
      r.gear = -1;
      r.rpm = 1400 + Math.min(6000, Math.abs(kmh) * 85);
    } else if (kmh < 2 && throttle === 0) {
      r.gear = 0;
      r.rpm = 1050;
    } else {
      const gearBounds = [0, 48, 92, 140, 192, 245, 360];
      let g = 1;
      for (let i = 1; i <= 6; i++) {
        if (kmh > gearBounds[i] && i < 6) g = i + 1;
      }
      r.gear = g;
      const gMin = gearBounds[g - 1] * 0.68;
      const gMax = gearBounds[g];
      const norm = THREE.MathUtils.clamp((kmh - gMin) / Math.max(10, gMax - gMin), 0, 1);
      r.rpm = THREE.MathUtils.lerp(r.rpm, 1800 + norm * 6500 + (r.isNitro ? 500 : 0), Math.min(1, dt * 12));
    }

    if (r.isPlayer && prevGear !== r.gear && r.gear > 0 && prevGear > 0) {
      this.audio.playGearShift();
    }

    // Update 3D Model Rig
    r.rig.root.position.copy(r.pos);
    r.rig.root.rotation.y = r.yaw;

    // Slope alignment along track pitch
    const slopePitch = -Math.asin(THREE.MathUtils.clamp(proj.sample.tangent.y, -0.45, 0.45));
    r.rig.chassisGroup.position.y = r.suspY;
    r.rig.chassisGroup.rotation.x = r.pitch + slopePitch;
    r.rig.chassisGroup.rotation.z = r.roll;

    // Wheels spin & front steering
    r.wheelSpin += (newForwardVel / r.spec.dimensions.wheelRadius) * dt;
    for (const pivot of r.rig.frontWheelPivots) {
      pivot.rotation.y = r.steerAngle;
    }
    for (const spinGroup of r.rig.wheelSpinGroups) {
      spinGroup.rotation.x = r.wheelSpin;
    }
    r.rig.steeringWheel.rotation.z = -r.steerAngle * 2.2;

    // Brake light glow & nitro exhaust flames
    r.rig.brakeLightMaterial.emissiveIntensity = r.isBraking ? 4.2 : 1.3;
    for (const flame of r.rig.nitroFlames) {
      flame.visible = r.isNitro;
      if (r.isNitro) {
        flame.scale.set(1, 1, 0.75 + Math.random() * 0.55);
      }
    }

    // Drift tire smoke
    if (r.isDrifting && Math.random() < 0.7) {
      const backZ = -r.spec.dimensions.wheelbase * 0.5;
      const halfT = r.spec.dimensions.trackWidth * 0.48;
      for (const sx of [-1, 1]) {
        const wx = r.pos.x + _forward.x * backZ + _right.x * sx * halfT;
        const wz = r.pos.z + _forward.z * backZ + _right.z * sx * halfT;
        this.spawnSmoke(wx, r.pos.y, wz);
      }
    }

    // Checkpoint & Lap Progress Tracking
    this.updateRacerProgress(r, prevSampleIdx);
  }

  private updateRacerProgress(r: RacerEntity, prevIdx: number): void {
    const N = this.track.samples.length;
    const cps = this.track.checkpoints;

    // Check sector checkpoints sequentially
    if (r.nextCheckpointIdx < cps.length) {
      const targetCp = cps[r.nextCheckpointIdx];
      const distAhead = (r.sampleIdx - targetCp + N) % N;
      if (distAhead < 28) {
        r.nextCheckpointIdx++;
      }
    } else {
      // Crossed Start/Finish line (wrapped from > N*0.85 to < N*0.15)
      if (prevIdx > N * 0.85 && r.sampleIdx < N * 0.15) {
        const lapTime = this.raceElapsedMs - r.lapStartMs;
        if (lapTime > 4000 && (r.bestLapMs === 0 || lapTime < r.bestLapMs)) {
          r.bestLapMs = lapTime;
        }
        r.lapStartMs = this.raceElapsedMs;
        r.nextCheckpointIdx = 0;

        if (this.mode !== 'freedrive' && r.lap >= this.settings.laps) {
          r.finished = true;
          r.finishTimeMs = this.raceElapsedMs;
          if (r.isPlayer && this.mode === 'timetrial') {
            const bestKey = 'rrs_best_timetrial_ms';
            const prev = Number(localStorage.getItem(bestKey) || '0');
            if (prev === 0 || r.bestLapMs < prev) {
              localStorage.setItem(bestKey, String(Math.round(r.bestLapMs)));
            }
          }
        } else {
          r.lap++;
        }
      }
    }

    // Monotonic progress metric for race standings
    const frac = r.sampleIdx / N;
    // Prevent premature jump before crossing start line at race start
    if (r.lap === 1 && r.nextCheckpointIdx === 0 && frac > 0.85) {
      r.totalProgress = (frac - 1) * this.track.totalLength;
    } else {
      r.totalProgress = ((r.lap - 1) + frac) * this.track.totalLength;
    }
  }

  private computeAiControls(
    r: RacerEntity,
    dt: number
  ): { throttle: number; brake: number; steer: number; handbrake: boolean; nitro: boolean } {
    const N = this.track.samples.length;

    // Periodic lane shifts & overtaking avoidance
    r.aiLaneTimer -= dt;
    if (r.aiLaneTimer <= 0) {
      r.aiLaneTimer = 1.8 + Math.random() * 2.5;
      r.aiTargetLane = (Math.random() - 0.5) * (this.track.roadWidth * 0.52);
    }

    // Check for cars directly ahead to overtake
    for (const other of this.racers) {
      if (other === r) continue;
      const dist = r.pos.distanceTo(other.pos);
      if (dist < 14) {
        _v1.subVectors(other.pos, r.pos);
        _forward.set(Math.sin(r.yaw), 0, Math.cos(r.yaw));
        if (_v1.dot(_forward) > 1.5) {
          _right.set(Math.cos(r.yaw), 0, -Math.sin(r.yaw));
          const lat = _v1.dot(_right);
          r.aiTargetLane = lat >= 0 ? -3.8 : 3.8;
        }
      }
    }

    // Look ahead along spline
    const lookSteps = Math.floor(14 + r.speedMs * 0.55);
    const targetSample = this.track.samples[(r.sampleIdx + lookSteps) % N];
    const farSample = this.track.samples[(r.sampleIdx + lookSteps + 26) % N];

    _v2.copy(targetSample.position).addScaledVector(targetSample.right, r.aiTargetLane);
    _v3.subVectors(_v2, r.pos);
    const targetYaw = Math.atan2(_v3.x, _v3.z);
    let angleDiff = targetYaw - r.yaw;
    while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;
    while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;

    const steer = THREE.MathUtils.clamp(angleDiff * 2.2, -1, 1);

    // Corner speed target based on upcoming curvature
    const upcomingCurv = Math.max(Math.abs(targetSample.curvature), Math.abs(farSample.curvature));
    const desiredCornerSpeed = upcomingCurv > 0.16 ? 26 : upcomingCurv > 0.09 ? 42 : 95;
    const targetSpeed = desiredCornerSpeed * (0.9 + r.skill * 0.14);

    let throttle = 1;
    let brake = 0;
    if (r.speedMs > targetSpeed + 4) {
      throttle = 0;
      brake = 0.85;
    } else if (r.speedMs > targetSpeed) {
      throttle = 0.25;
    }

    // Slight rubber-banding to keep circuit races competitive
    if (!r.isPlayer && this.player && this.mode === 'circuit') {
      const gap = this.player.totalProgress - r.totalProgress;
      if (gap > 90) throttle = 1;
    }

    const nitro = !r.isPlayer && upcomingCurv < 0.06 && r.nitro > 45 && Math.abs(angleDiff) < 0.1;
    return { throttle, brake, steer, handbrake: false, nitro };
  }

  private resolveCarCollisions(): void {
    for (let i = 0; i < this.racers.length; i++) {
      for (let j = i + 1; j < this.racers.length; j++) {
        const a = this.racers[i];
        const b = this.racers[j];
        const dx = b.pos.x - a.pos.x;
        const dz = b.pos.z - a.pos.z;
        const minDist = 2.65;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.0001 && dSq < minDist * minDist) {
          const d = Math.sqrt(dSq);
          const nx = dx / d;
          const nz = dz / d;
          const overlap = (minDist - d) * 0.5;
          a.pos.x -= nx * overlap;
          a.pos.z -= nz * overlap;
          b.pos.x += nx * overlap;
          b.pos.z += nz * overlap;

          // Relative velocity along collision normal
          const rvx = b.vel.x - a.vel.x;
          const rvz = b.vel.z - a.vel.z;
          const relNormal = rvx * nx + rvz * nz;
          if (relNormal < 0) {
            const impulse = -relNormal * 0.72;
            a.vel.x -= nx * impulse;
            a.vel.z -= nz * impulse;
            b.vel.x += nx * impulse;
            b.vel.z += nz * impulse;
            a.vel.multiplyScalar(0.92);
            b.vel.multiplyScalar(0.92);

            if (a.isPlayer || b.isPlayer) {
              this.audio.playCollision(Math.abs(relNormal) / 22);
              this.camShake = Math.min(0.45, Math.abs(relNormal) * 0.018);
            }
          }
        }
      }
    }

    // Player vs Free Drive Traffic collisions
    if (this.player && this.traffic.length > 0) {
      const p = this.player;
      for (const tr of this.traffic) {
        const dx = tr.mesh.position.x - p.pos.x;
        const dz = tr.mesh.position.z - p.pos.z;
        const minDist = 2.7;
        const dSq = dx * dx + dz * dz;
        if (dSq > 0.0001 && dSq < minDist * minDist) {
          const d = Math.sqrt(dSq);
          const nx = dx / d;
          const nz = dz / d;
          const overlap = minDist - d;
          p.pos.x -= nx * overlap;
          p.pos.z -= nz * overlap;
          const projVel = p.vel.x * nx + p.vel.z * nz;
          if (projVel > 0) {
            p.vel.x -= nx * projVel * 1.4;
            p.vel.z -= nz * projVel * 1.4;
            p.vel.multiplyScalar(0.75);
            this.audio.playCollision(projVel / 20);
            this.camShake = Math.min(0.5, projVel * 0.02);
          }
        }
      }
    }
  }

  private stepTraffic(dt: number): void {
    for (const tr of this.traffic) {
      tr.distance = (tr.distance + tr.speedMs * dt) % this.track.totalLength;
      const s = this.track.getSampleAtDistance(tr.distance);
      tr.mesh.position.copy(s.position).addScaledVector(s.right, tr.laneOffset);
      tr.mesh.rotation.y = Math.atan2(s.tangent.x, s.tangent.z);
    }
  }

  private updateCamera(dt: number): void {
    if (!this.isPlaying || !this.player) {
      // Showcase Orbit Camera around selected car
      const sf = this.track.samples[0];
      if (this.showcaseMode === 'menu') {
        this.garageOrbitAngle += dt * 0.22;
      }
      const dist = this.showcaseMode === 'garage' ? 5.6 : 6.4;
      const height = this.showcaseMode === 'garage' ? 1.85 : 2.1;
      const cx = sf.position.x + Math.sin(this.garageOrbitAngle) * dist;
      const cz = sf.position.z + Math.cos(this.garageOrbitAngle) * dist;
      _camTargetPos.set(cx, sf.position.y + height, cz);
      _camLookTarget.set(sf.position.x, sf.position.y + 0.72, sf.position.z);

      this.camera.position.lerp(_camTargetPos, 1 - Math.exp(-8 * dt));
      this.camera.lookAt(_camLookTarget);
      return;
    }

    const p = this.player;
    _forward.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    _right.set(Math.cos(p.yaw), 0, -Math.sin(p.yaw));

    // Dynamic FOV with speed & nitro
    const speedNorm = THREE.MathUtils.clamp(p.speedMs / 78, 0, 1);
    const targetFov =
      this.cameraMode === 'cockpit'
        ? 72 + speedNorm * 8
        : 62 + speedNorm * 13 + (p.isNitro ? 5.5 : 0);
    this.camera.fov = THREE.MathUtils.damp(this.camera.fov, targetFov, 7, dt);
    this.camera.updateProjectionMatrix();

    // Speed lines opacity
    const streakIntensity =
      p.speedMs > 42 || p.isNitro ? THREE.MathUtils.clamp((p.speedMs - 38) / 35 + (p.isNitro ? 0.35 : 0), 0, 0.55) : 0;
    this.speedLineMat.opacity = THREE.MathUtils.damp(this.speedLineMat.opacity, streakIntensity, 8, dt);

    if (this.cameraMode === 'third_person') {
      const followDist = 6.3 + speedNorm * 1.1;
      const followH = 2.25 + speedNorm * 0.25;
      _camTargetPos
        .copy(p.pos)
        .addScaledVector(_forward, -followDist)
        .add(new THREE.Vector3(0, followH, 0));

      _camLookTarget
        .copy(p.pos)
        .addScaledVector(_forward, 8.5)
        .add(new THREE.Vector3(0, 1.05, 0));

      const posLambda = 11.5;
      this.camCurrentPos.x = THREE.MathUtils.damp(this.camCurrentPos.x, _camTargetPos.x, posLambda, dt);
      this.camCurrentPos.y = THREE.MathUtils.damp(this.camCurrentPos.y, _camTargetPos.y, posLambda, dt);
      this.camCurrentPos.z = THREE.MathUtils.damp(this.camCurrentPos.z, _camTargetPos.z, posLambda, dt);

      this.camCurrentLook.x = THREE.MathUtils.damp(this.camCurrentLook.x, _camLookTarget.x, 15, dt);
      this.camCurrentLook.y = THREE.MathUtils.damp(this.camCurrentLook.y, _camLookTarget.y, 15, dt);
      this.camCurrentLook.z = THREE.MathUtils.damp(this.camCurrentLook.z, _camLookTarget.z, 15, dt);

      this.camera.position.copy(this.camCurrentPos);
      this.camera.lookAt(this.camCurrentLook);
    } else if (this.cameraMode === 'cockpit') {
      const [ox, oy, oz] = p.spec.dimensions.cockpitOffset;
      _v1.set(ox, oy + p.suspY * 0.6, oz);
      _v1.applyAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
      this.camera.position.copy(p.pos).add(_v1);

      _camLookTarget
        .copy(this.camera.position)
        .addScaledVector(_forward, 25)
        .add(new THREE.Vector3(0, -0.6 + p.pitch * 6, 0));
      this.camera.lookAt(_camLookTarget);
    } else {
      // Bumper camera
      const [bx, by, bz] = p.spec.dimensions.bumperOffset;
      _v1.set(bx, by + p.suspY, bz);
      _v1.applyAxisAngle(THREE.Object3D.DEFAULT_UP, p.yaw);
      this.camera.position.copy(p.pos).add(_v1);

      _camLookTarget
        .copy(this.camera.position)
        .addScaledVector(_forward, 26)
        .add(new THREE.Vector3(0, -0.3 + p.pitch * 5, 0));
      this.camera.lookAt(_camLookTarget);
    }

    // Impact shake
    if (this.camShake > 0.005) {
      this.camera.position.x += (Math.random() - 0.5) * this.camShake;
      this.camera.position.y += (Math.random() - 0.5) * this.camShake * 0.7;
      this.camShake = THREE.MathUtils.damp(this.camShake, 0, 12, dt);
    }
  }

  private emitTelemetry(): void {
    const timeLabel = this.applyTimeOfDay(this.dayCycleTime);
    if (!this.player) return;

    const p = this.player;
    const sorted = [...this.racers].sort((a, b) => {
      if (a.finished && b.finished) return a.finishTimeMs - b.finishTimeMs;
      if (a.finished) return -1;
      if (b.finished) return 1;
      return b.totalProgress - a.totalProgress;
    });

    const standings: RaceStanding[] = sorted.map((r, i) => ({
      id: r.id,
      name: r.name,
      carName: r.spec.name,
      isPlayer: r.isPlayer,
      position: i + 1,
      lap: r.lap,
      totalProgress: r.totalProgress,
      finished: r.finished,
      finishTimeMs: r.finishTimeMs,
      bestLapMs: r.bestLapMs,
    }));

    const playerRank = standings.find((s) => s.isPlayer)?.position ?? 1;

    // Wrong way check
    const closest = this.track.samples[p.sampleIdx];
    _forward.set(Math.sin(p.yaw), 0, Math.cos(p.yaw));
    const wrongWay = p.speedMs > 5 && _forward.dot(closest.tangent) < -0.35;

    const countdownInt = this.countdownTimer > 0 ? Math.ceil(this.countdownTimer) : this.countdownTimer > -0.8 ? 0 : -1;

    this.onTelemetry({
      speedKmh: Math.round(p.speedMs * 3.6),
      rpm: Math.round(p.rpm),
      maxRpm: 8500,
      gear: p.gear,
      nitro: Math.round(p.nitro),
      isNitroActive: p.isNitro,
      isDrifting: p.isDrifting,
      isBraking: p.isBraking,
      lap: Math.min(p.lap, this.settings.laps),
      totalLaps: this.mode === 'freedrive' ? 0 : this.settings.laps,
      position: playerRank,
      totalRacers: this.racers.length,
      raceTimeMs: Math.round(this.raceElapsedMs),
      currentLapMs: Math.round(Math.max(0, this.raceElapsedMs - p.lapStartMs)),
      bestLapMs: Math.round(p.bestLapMs),
      countdown: countdownInt,
      checkpointIndex: p.nextCheckpointIdx,
      totalCheckpoints: this.track.checkpoints.length,
      cameraMode: this.cameraMode,
      timeOfDayLabel: timeLabel,
      wrongWay,
      standings,
      minimapRacers: this.racers.map((r) => ({
        x: r.pos.x,
        z: r.pos.z,
        isPlayer: r.isPlayer,
        color: r.isPlayer ? '#ef4444' : '#fafafa',
      })),
      trackOutline: this.track.outline2D,
      raceFinished: p.finished,
      isVictory: this.mode === 'timetrial' ? true : playerRank === 1,
    });
  }

  private tick = () => {
    if (this.disposed) return;

    const rawDt = this.clock.getDelta();
    const dt = Math.min(rawDt, 0.05);

    if (!this.isPaused) {
      // Advance Day/Afternoon cycle slowly
      this.dayCycleTime = (this.dayCycleTime + dt / 110) % 1;
      this.applyTimeOfDay(this.dayCycleTime);

      if (this.isPlaying) {
        // Countdown handling
        let canMove = true;
        if (this.countdownTimer > 0) {
          this.countdownTimer -= dt;
          const curInt = Math.ceil(this.countdownTimer);
          if (curInt < this.lastCountdownInt && curInt >= 1) {
            this.lastCountdownInt = curInt;
            this.audio.playCountdownBeep(false);
          }
          if (this.countdownTimer <= 0) {
            this.audio.playCountdownBeep(true);
            this.countdownTimer = -0.01;
            for (const r of this.racers) {
              r.lapStartMs = 0;
            }
          } else {
            canMove = false;
          }
        } else {
          if (this.countdownTimer > -1.0) {
            this.countdownTimer -= dt;
          }
          this.raceElapsedMs += dt * 1000;
        }

        for (const r of this.racers) {
          this.stepRacerPhysics(r, dt, canMove);
        }
        this.resolveCarCollisions();
        this.stepTraffic(dt);
        this.stepSmoke(dt);

        // Update player audio
        if (this.player) {
          const rpmRatio = THREE.MathUtils.clamp((this.player.rpm - 1000) / 7500, 0, 1);
          const throttleLoad = this.inputs.throttle ? 1 : 0.15;
          const skidAmt = this.player.isDrifting ? 1.0 : 0;
          this.audio.updateTelemetry(rpmRatio, throttleLoad, skidAmt, this.player.isNitro);
        }

        this.telemetryAccum += dt;
        if (this.telemetryAccum >= 0.045) {
          this.telemetryAccum = 0;
          this.emitTelemetry();
        }
      }

      this.updateCamera(dt);
    }

    this.renderer.render(this.scene, this.camera);

    if (this.isSoftwareGl) {
      this.afterDraw(this.tick);
    } else {
      this.frameId = requestAnimationFrame(this.tick);
    }
  };

  private afterDraw(cb: () => void): void {
    const gl = this.renderer.getContext() as WebGL2RenderingContext;
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    gl.flush();
    const poll = () => {
      if (this.disposed) {
        if (sync) gl.deleteSync(sync);
        return;
      }
      const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
      if (state === gl.UNSIGNALED) {
        this.frameId = window.setTimeout(poll, 5);
      } else {
        if (sync) gl.deleteSync(sync);
        this.frameId = window.setTimeout(cb, 80);
      }
    };
    this.frameId = window.setTimeout(poll, 5);
  }

  public dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.frameId);
    clearTimeout(this.frameId);

    window.removeEventListener('resize', this.handleResize);
    this.renderer.domElement.removeEventListener('pointerdown', this.handlePointerDown);
    window.removeEventListener('pointermove', this.handlePointerMove);
    window.removeEventListener('pointerup', this.handlePointerUp);
    this.renderer.domElement.removeEventListener('webglcontextlost', this.handleContextLost);
    this.renderer.domElement.removeEventListener('webglcontextrestored', this.handleContextRestored);

    this.clearRaceActors();
    if (this.showcaseRig) {
      this.scene.remove(this.showcaseRig.root);
      this.showcaseRig.dispose();
    }
    this.track.dispose();
    this.textures.dispose();
    this.smokeGeo.dispose();
    this.audio.dispose();

    this.renderer.dispose();
    if (this.renderer.domElement.parentNode) {
      this.renderer.domElement.parentNode.removeChild(this.renderer.domElement);
    }
  }
}
