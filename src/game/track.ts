import * as THREE from 'three';
import { ProceduralTextures } from './textures';

export interface TrackSample {
  index: number;
  t: number;
  distance: number;
  position: THREE.Vector3;
  tangent: THREE.Vector3;
  right: THREE.Vector3;
  curvature: number;
}

export interface TrackEnvironment {
  group: THREE.Group;
  curve: THREE.CatmullRomCurve3;
  samples: TrackSample[];
  totalLength: number;
  roadWidth: number;
  halfWidth: number;
  checkpoints: number[]; // sample indices for checkpoints
  streetLampBulbMat: THREE.MeshStandardMaterial;
  outline2D: Array<{ x: number; z: number }>;
  findClosestSample: (x: number, z: number, hintIdx?: number) => {
    sample: TrackSample;
    lateralOffset: number;
    distSq: number;
  };
  getSampleAtDistance: (distance: number) => TrackSample;
  getSurfaceBump: (distance: number, lateral: number) => number;
  dispose: () => void;
}

const CONTROL_POINTS: Array<[number, number, number]> = [
  [-250, 10, -130],
  [-250, 10, 0], // Start / Finish line
  [-250, 11.5, 145],
  [-200, 15.5, 275],
  [-65, 21.5, 335],
  [55, 23.0, 245], // Kelok Toba bend
  [185, 19.5, 310],
  [310, 14.5, 220],
  [355, 10.5, 80],
  [245, 7.5, -15], // Highland Chicane
  [350, 5.5, -135],
  [275, 5.0, -270],
  [125, 6.8, -325], // Warung Village Straight
  [-45, 8.2, -325],
  [-185, 9.2, -260],
];

const SAMPLE_COUNT = 1200;
const ROAD_WIDTH = 15.5;

function createPineTreeGeometry(): {
  trunk: THREE.CylinderGeometry;
  foliage: THREE.ConeGeometry;
} {
  const trunk = new THREE.CylinderGeometry(0.28, 0.45, 3.6, 7);
  trunk.translate(0, 1.8, 0);
  const foliage = new THREE.ConeGeometry(2.6, 8.2, 8);
  foliage.translate(0, 6.8, 0);
  return { trunk, foliage };
}

function buildWarungGroup(textures: ProceduralTextures): {
  group: THREE.Group;
  disposables: Array<{ dispose: () => void }>;
} {
  const disposables: Array<{ dispose: () => void }> = [];
  const group = new THREE.Group();

  const woodMat = new THREE.MeshStandardMaterial({ color: 0x6b4423, roughness: 0.88 });
  const roofMat = new THREE.MeshStandardMaterial({
    color: 0x991b1b,
    metalness: 0.35,
    roughness: 0.55,
  });
  const counterMat = new THREE.MeshStandardMaterial({ color: 0xd97706, roughness: 0.7 });
  const bannerMat = new THREE.MeshStandardMaterial({
    map: textures.warungBanner,
    roughness: 0.6,
  });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfef3c7,
    emissive: 0xfde047,
    emissiveIntensity: 0.9,
  });

  disposables.push(woodMat, roofMat, counterMat, bannerMat, bulbMat);

  // Concrete base slab (bottom-center grounded)
  const baseGeo = new THREE.BoxGeometry(8.5, 0.4, 5.2);
  const baseMesh = new THREE.Mesh(baseGeo, new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.9 }));
  baseMesh.position.y = 0.2;
  baseMesh.receiveShadow = true;
  group.add(baseMesh);
  disposables.push(baseGeo, baseMesh.material as THREE.Material);

  // 4 wooden corner posts
  const postGeo = new THREE.BoxGeometry(0.22, 3.4, 0.22);
  disposables.push(postGeo);
  for (const px of [-3.8, 3.8]) {
    for (const pz of [-2.2, 2.2]) {
      const post = new THREE.Mesh(postGeo, woodMat);
      post.position.set(px, 1.9, pz);
      post.castShadow = true;
      group.add(post);
    }
  }

  // Back wall
  const backGeo = new THREE.BoxGeometry(7.8, 3.1, 0.2);
  const backWall = new THREE.Mesh(backGeo, woodMat);
  backWall.position.set(0, 1.95, -2.2);
  backWall.castShadow = true;
  group.add(backWall);
  disposables.push(backGeo);

  // Slanted zinc roof + front awning
  const roofGeo = new THREE.BoxGeometry(9.2, 0.16, 6.2);
  const roof = new THREE.Mesh(roofGeo, roofMat);
  roof.position.set(0, 3.7, 0.1);
  roof.rotation.x = 0.14;
  roof.castShadow = true;
  group.add(roof);
  disposables.push(roofGeo);

  // Front service counter + wooden bench
  const counterGeo = new THREE.BoxGeometry(6.6, 1.05, 0.85);
  const counter = new THREE.Mesh(counterGeo, counterMat);
  counter.position.set(0, 0.92, 0.9);
  counter.castShadow = true;
  group.add(counter);

  const benchGeo = new THREE.BoxGeometry(5.6, 0.45, 0.55);
  const bench = new THREE.Mesh(benchGeo, woodMat);
  bench.position.set(0, 0.62, 1.95);
  group.add(bench);
  disposables.push(counterGeo, benchGeo);

  // Spanduk "WARUNG KOPI SIDIKALANG"
  const bannerGeo = new THREE.PlaneGeometry(6.8, 1.35);
  const banner = new THREE.Mesh(bannerGeo, bannerMat);
  banner.position.set(0, 3.05, 2.45);
  group.add(banner);
  disposables.push(bannerGeo);

  // Hanging warm bulb
  const bulbGeo = new THREE.SphereGeometry(0.18, 10, 10);
  const bulb = new THREE.Mesh(bulbGeo, bulbMat);
  bulb.position.set(0, 3.15, 1.0);
  group.add(bulb);
  disposables.push(bulbGeo);

  return { group, disposables };
}

function buildRoadSign(
  texture: THREE.CanvasTexture,
  isDiamond: boolean
): { group: THREE.Group; disposables: Array<{ dispose: () => void }> } {
  const disposables: Array<{ dispose: () => void }> = [];
  const group = new THREE.Group();

  const poleGeo = new THREE.CylinderGeometry(0.06, 0.07, 3.1, 8);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0xd4d4d8, metalness: 0.7, roughness: 0.3 });
  const pole = new THREE.Mesh(poleGeo, poleMat);
  pole.position.y = 1.55;
  pole.castShadow = true;
  group.add(pole);

  const boardGeo = new THREE.BoxGeometry(1.15, 1.15, 0.06);
  const boardMat = new THREE.MeshStandardMaterial({ map: texture, roughness: 0.35 });
  const backMat = new THREE.MeshStandardMaterial({ color: 0x52525b, roughness: 0.6 });
  const board = new THREE.Mesh(boardGeo, [
    backMat,
    backMat,
    backMat,
    backMat,
    boardMat,
    backMat,
  ]);
  board.position.y = 2.85;
  if (isDiamond) {
    board.rotation.z = Math.PI / 4;
  }
  board.castShadow = true;
  group.add(board);

  disposables.push(poleGeo, poleMat, boardGeo, boardMat, backMat);
  return { group, disposables };
}

export function buildSumatraTrack(
  textures: ProceduralTextures,
  isSoftwareGl: boolean
): TrackEnvironment {
  const group = new THREE.Group();
  const disposables: Array<{ dispose: () => void }> = [];

  const curvePts = CONTROL_POINTS.map(([x, y, z]) => new THREE.Vector3(x, y, z));
  const curve = new THREE.CatmullRomCurve3(curvePts, true, 'catmullrom', 0.45);
  const totalLength = curve.getLength();

  // Sample spline uniformly by arc length
  const samples: TrackSample[] = [];
  const up = new THREE.Vector3(0, 1, 0);

  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const u = i / SAMPLE_COUNT;
    const position = curve.getPointAt(u);
    const tangent = curve.getTangentAt(u).normalize();
    const right = new THREE.Vector3().crossVectors(tangent, up).normalize();
    samples.push({
      index: i,
      t: u,
      distance: u * totalLength,
      position,
      tangent,
      right,
      curvature: 0,
    });
  }

  // Compute curvature for AI corner speed & kerb/chevron placement
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const prev = samples[(i - 4 + SAMPLE_COUNT) % SAMPLE_COUNT];
    const next = samples[(i + 4) % SAMPLE_COUNT];
    const dTan = new THREE.Vector3().subVectors(next.tangent, prev.tangent);
    const sign = Math.sign(dTan.dot(samples[i].right)) || 1;
    samples[i].curvature = dTan.length() * sign;
  }

  // 1. Build Road Ribbon BufferGeometry
  const halfW = ROAD_WIDTH * 0.5;
  const roadPos: number[] = [];
  const roadNorm: number[] = [];
  const roadUv: number[] = [];
  const roadIndices: number[] = [];

  const kerbPos: number[] = [];
  const kerbNorm: number[] = [];
  const kerbUv: number[] = [];
  const kerbIndices: number[] = [];

  const kerbWidth = 1.15;

  for (let i = 0; i <= SAMPLE_COUNT; i++) {
    const s = samples[i % SAMPLE_COUNT];
    const vCoord = (i / SAMPLE_COUNT) * (totalLength / 18);

    const leftEdge = s.position.clone().addScaledVector(s.right, -halfW);
    const rightEdge = s.position.clone().addScaledVector(s.right, halfW);

    roadPos.push(leftEdge.x, leftEdge.y + 0.04, leftEdge.z);
    roadPos.push(rightEdge.x, rightEdge.y + 0.04, rightEdge.z);
    roadNorm.push(0, 1, 0, 0, 1, 0);
    roadUv.push(0, vCoord, 1, vCoord);

    // Outer kerbs along road edges
    const leftOuter = s.position.clone().addScaledVector(s.right, -(halfW + kerbWidth));
    const rightOuter = s.position.clone().addScaledVector(s.right, halfW + kerbWidth);
    const kerbV = (i / SAMPLE_COUNT) * (totalLength / 4);

    // 4 vertices per ring for left & right kerbs
    kerbPos.push(
      leftOuter.x,
      leftOuter.y + 0.02,
      leftOuter.z,
      leftEdge.x,
      leftEdge.y + 0.07,
      leftEdge.z,
      rightEdge.x,
      rightEdge.y + 0.07,
      rightEdge.z,
      rightOuter.x,
      rightOuter.y + 0.02,
      rightOuter.z
    );
    kerbNorm.push(0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0);
    kerbUv.push(0, kerbV, 1, kerbV, 0, kerbV, 1, kerbV);

    if (i < SAMPLE_COUNT) {
      const r0 = i * 2;
      roadIndices.push(r0, r0 + 1, r0 + 2, r0 + 1, r0 + 3, r0 + 2);

      const k0 = i * 4;
      // Left kerb quad
      kerbIndices.push(k0, k0 + 1, k0 + 4, k0 + 1, k0 + 5, k0 + 4);
      // Right kerb quad
      kerbIndices.push(k0 + 2, k0 + 3, k0 + 6, k0 + 3, k0 + 7, k0 + 6);
    }
  }

  const roadGeo = new THREE.BufferGeometry();
  roadGeo.setAttribute('position', new THREE.Float32BufferAttribute(roadPos, 3));
  roadGeo.setAttribute('normal', new THREE.Float32BufferAttribute(roadNorm, 3));
  roadGeo.setAttribute('uv', new THREE.Float32BufferAttribute(roadUv, 2));
  roadGeo.setIndex(roadIndices);
  roadGeo.computeVertexNormals();

  const roadMat = new THREE.MeshStandardMaterial({
    map: textures.asphalt,
    roughness: 0.78,
    metalness: 0.05,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
  const roadMesh = new THREE.Mesh(roadGeo, roadMat);
  roadMesh.receiveShadow = true;
  group.add(roadMesh);
  disposables.push(roadGeo, roadMat);

  const kerbGeo = new THREE.BufferGeometry();
  kerbGeo.setAttribute('position', new THREE.Float32BufferAttribute(kerbPos, 3));
  kerbGeo.setAttribute('normal', new THREE.Float32BufferAttribute(kerbNorm, 3));
  kerbGeo.setAttribute('uv', new THREE.Float32BufferAttribute(kerbUv, 2));
  kerbGeo.setIndex(kerbIndices);
  kerbGeo.computeVertexNormals();

  const kerbMat = new THREE.MeshStandardMaterial({
    map: textures.kerb,
    roughness: 0.72,
  });
  const kerbMesh = new THREE.Mesh(kerbGeo, kerbMat);
  kerbMesh.receiveShadow = true;
  group.add(kerbMesh);
  disposables.push(kerbGeo, kerbMat);

  // 2. Start/Finish Checkered Line & Overhead Gantry
  const startSample = samples[Math.floor((130 / totalLength) * SAMPLE_COUNT) % SAMPLE_COUNT];
  // Actually index ~ 75 is near (-250, 10, 0). Let's find exact closest sample to (-250, 0)!
  let startIdx = 0;
  let bestStartDist = Infinity;
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const dx = samples[i].position.x - -250;
    const dz = samples[i].position.z - 0;
    const d = dx * dx + dz * dz;
    if (d < bestStartDist) {
      bestStartDist = d;
      startIdx = i;
    }
  }

  // Rotate samples so index 0 IS the exact Start/Finish line!
  const rotatedSamples: TrackSample[] = [];
  for (let i = 0; i < SAMPLE_COUNT; i++) {
    const src = samples[(startIdx + i) % SAMPLE_COUNT];
    rotatedSamples.push({
      ...src,
      index: i,
      t: i / SAMPLE_COUNT,
      distance: (i / SAMPLE_COUNT) * totalLength,
    });
  }
  samples.length = 0;
  samples.push(...rotatedSamples);

  const sfSample = samples[0];
  const sfAngle = Math.atan2(sfSample.tangent.x, sfSample.tangent.z);

  const chkGeo = new THREE.PlaneGeometry(ROAD_WIDTH - 0.6, 3.6);
  chkGeo.rotateX(-Math.PI * 0.5);
  const chkMat = new THREE.MeshStandardMaterial({
    map: textures.checkered,
    roughness: 0.6,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
  });
  const chkMesh = new THREE.Mesh(chkGeo, chkMat);
  chkMesh.position.copy(sfSample.position).add(new THREE.Vector3(0, 0.08, 0));
  chkMesh.rotation.y = sfAngle;
  chkMesh.receiveShadow = true;
  group.add(chkMesh);
  disposables.push(chkGeo, chkMat);

  // Overhead Start/Finish Gantry
  const gantryGroup = new THREE.Group();
  gantryGroup.position.copy(sfSample.position);
  gantryGroup.rotation.y = sfAngle;
  const trussMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.8,
    roughness: 0.3,
  });
  const pillarGeo = new THREE.BoxGeometry(0.85, 8.2, 0.85);
  const beamGeo = new THREE.BoxGeometry(ROAD_WIDTH + 4.5, 1.9, 1.1);
  const bannerGeo = new THREE.PlaneGeometry(ROAD_WIDTH + 2.8, 1.65);
  const bannerMat = new THREE.MeshStandardMaterial({
    map: textures.gantryBanner,
    emissiveMap: textures.gantryBanner,
    emissive: 0xffffff,
    emissiveIntensity: 0.35,
  });
  disposables.push(trussMat, pillarGeo, beamGeo, bannerGeo, bannerMat);

  for (const sx of [-1, 1]) {
    const pillar = new THREE.Mesh(pillarGeo, trussMat);
    pillar.position.set(sx * (halfW + 1.8), 4.1, 0);
    pillar.castShadow = true;
    gantryGroup.add(pillar);
  }
  const beam = new THREE.Mesh(beamGeo, trussMat);
  beam.position.set(0, 7.6, 0);
  beam.castShadow = true;
  gantryGroup.add(beam);

  for (const dir of [-1, 1]) {
    const banner = new THREE.Mesh(bannerGeo, bannerMat);
    banner.position.set(0, 7.6, dir * 0.58);
    if (dir < 0) banner.rotation.y = Math.PI;
    gantryGroup.add(banner);
  }
  group.add(gantryGroup);

  // 3. Checkpoint indices (4 sectors around loop)
  const checkpoints = [
    Math.floor(SAMPLE_COUNT * 0.25),
    Math.floor(SAMPLE_COUNT * 0.5),
    Math.floor(SAMPLE_COUNT * 0.75),
  ];

  // Subtle red/white checkpoint side pylons so players see sector gates
  const cpPylonGeo = new THREE.CylinderGeometry(0.18, 0.22, 4.2, 10);
  const cpPylonMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    emissive: 0x7f1d1d,
    emissiveIntensity: 0.45,
    roughness: 0.35,
  });
  disposables.push(cpPylonGeo, cpPylonMat);
  for (const cpIdx of checkpoints) {
    const s = samples[cpIdx];
    for (const side of [-1, 1]) {
      const p = new THREE.Mesh(cpPylonGeo, cpPylonMat);
      p.position.copy(s.position).addScaledVector(s.right, side * (halfW + 1.5));
      p.position.y += 2.1;
      group.add(p);
    }
  }

  // 4. Expansive Sumatran Highland Terrain & Danau Toba Basin
  const terrainSize = 1350;
  const segs = isSoftwareGl ? 96 : 140;
  const terrainGeo = new THREE.PlaneGeometry(terrainSize, terrainSize, segs, segs);
  terrainGeo.rotateX(-Math.PI * 0.5);
  const posAttr = terrainGeo.attributes.position as THREE.BufferAttribute;
  const colors = new Float32Array(posAttr.count * 3);

  // Fast grid spatial hash of track points for terrain height blending
  for (let i = 0; i < posAttr.count; i++) {
    const vx = posAttr.getX(i);
    const vz = posAttr.getZ(i);

    // Find nearest track sample (coarse step 8, then refine)
    let minD2 = Infinity;
    let nearestIdx = 0;
    for (let j = 0; j < SAMPLE_COUNT; j += 8) {
      const dx = vx - samples[j].position.x;
      const dz = vz - samples[j].position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD2) {
        minD2 = d2;
        nearestIdx = j;
      }
    }
    for (let j = -6; j <= 6; j++) {
      const idx = (nearestIdx + j + SAMPLE_COUNT) % SAMPLE_COUNT;
      const dx = vx - samples[idx].position.x;
      const dz = vz - samples[idx].position.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < minD2) {
        minD2 = d2;
        nearestIdx = idx;
      }
    }

    const distToRoad = Math.sqrt(minD2);
    const roadY = samples[nearestIdx].position.y;

    // Natural Bukit Barisan mountain ridges + central Danau Toba lake valley
    const radial = Math.sqrt(vx * vx + vz * vz);
    const hillWave =
      Math.sin(vx * 0.015) * Math.cos(vz * 0.013) * 14 +
      Math.sin(vx * 0.032 + vz * 0.021) * 6;
    const outerMountain = Math.max(0, (radial - 340) * 0.24) + Math.max(0, Math.sin(vx * 0.008) * 12);
    const innerLakeBasin = radial < 165 ? -10 * (1 - radial / 165) : 0;

    let naturalY = 6 + hillWave + outerMountain + innerLakeBasin;
    if (radial < 140) {
      naturalY = Math.min(naturalY, -1.5);
    }

    // Smooth blend from roadbed (within 10m -> roadY - 0.12) out to 42m
    let finalY: number;
    if (distToRoad < halfW + 1.8) {
      finalY = roadY - 0.14;
    } else if (distToRoad < 46) {
      const t = (distToRoad - (halfW + 1.8)) / (46 - (halfW + 1.8));
      const smooth = t * t * (3 - 2 * t);
      finalY = THREE.MathUtils.lerp(roadY - 0.14, naturalY, smooth);
    } else {
      finalY = naturalY;
    }

    posAttr.setY(i, finalY);

    // Vertex color variation: lush emerald grass, darker pine slopes, rocky cliff faces
    const slopeColor = new THREE.Color(0x3a642f);
    if (finalY > 28) {
      slopeColor.setHex(0x4b5563); // volcanic mountain rock high up
    } else if (finalY < 1.2) {
      slopeColor.setHex(0x8a7554); // lakeshore sand/earth
    } else if (distToRoad < halfW + 3.5) {
      slopeColor.setHex(0x4d5e3a); // roadside verge
    } else {
      const shade = 0.85 + 0.25 * Math.sin(vx * 0.05 + vz * 0.04);
      slopeColor.multiplyScalar(shade);
    }
    colors[i * 3] = slopeColor.r;
    colors[i * 3 + 1] = slopeColor.g;
    colors[i * 3 + 2] = slopeColor.b;
  }

  terrainGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  terrainGeo.computeVertexNormals();

  const terrainMat = new THREE.MeshStandardMaterial({
    map: textures.terrain,
    vertexColors: true,
    roughness: 0.94,
    metalness: 0.02,
  });
  const terrainMesh = new THREE.Mesh(terrainGeo, terrainMat);
  terrainMesh.receiveShadow = true;
  group.add(terrainMesh);
  disposables.push(terrainGeo, terrainMat);

  // Shimmering Danau Toba Mountain Lake in the central valley
  const lakeGeo = new THREE.CircleGeometry(155, 48);
  lakeGeo.rotateX(-Math.PI * 0.5);
  const lakeMat = new THREE.MeshPhysicalMaterial({
    color: 0x0e4d64,
    metalness: 0.15,
    roughness: 0.12,
    clearcoat: 0.9,
    clearcoatRoughness: 0.08,
  });
  const lakeMesh = new THREE.Mesh(lakeGeo, lakeMat);
  lakeMesh.position.set(10, 0.35, -10);
  group.add(lakeMesh);
  disposables.push(lakeGeo, lakeMat);

  // 5. Instanced Guardrails (Pagar Pembatas) along track edges
  const railPostGeo = new THREE.BoxGeometry(0.14, 0.85, 0.14);
  const railBeamGeo = new THREE.BoxGeometry(0.12, 0.34, 4.2);
  const railMat = new THREE.MeshStandardMaterial({
    color: 0xcbd5e1,
    metalness: 0.78,
    roughness: 0.32,
  });
  disposables.push(railPostGeo, railBeamGeo, railMat);

  const railSteps = 220;
  const railPostInst = new THREE.InstancedMesh(railPostGeo, railMat, railSteps * 2);
  const railBeamInst = new THREE.InstancedMesh(railBeamGeo, railMat, railSteps * 2);
  railPostInst.castShadow = true;
  const dummy = new THREE.Object3D();
  let rIdx = 0;

  for (let i = 0; i < railSteps; i++) {
    const s = samples[Math.floor((i / railSteps) * SAMPLE_COUNT)];
    const yaw = Math.atan2(s.tangent.x, s.tangent.z);
    for (const side of [-1, 1]) {
      const p = s.position.clone().addScaledVector(s.right, side * (halfW + 1.35));
      dummy.position.set(p.x, p.y + 0.42, p.z);
      dummy.rotation.set(0, yaw, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      railPostInst.setMatrixAt(rIdx, dummy.matrix);

      dummy.position.set(p.x, p.y + 0.62, p.z);
      dummy.updateMatrix();
      railBeamInst.setMatrixAt(rIdx, dummy.matrix);
      rIdx++;
    }
  }
  railPostInst.instanceMatrix.needsUpdate = true;
  railBeamInst.instanceMatrix.needsUpdate = true;
  railPostInst.computeBoundingSphere();
  railBeamInst.computeBoundingSphere();
  group.add(railPostInst, railBeamInst);

  // 6. Instanced Street Lamps (Lampu Jalan)
  const lampCount = 48;
  const lampPoleGeo = new THREE.CylinderGeometry(0.08, 0.12, 6.2, 8);
  lampPoleGeo.translate(0, 3.1, 0);
  const lampBulbGeo = new THREE.BoxGeometry(0.75, 0.16, 0.36);
  const lampPoleMat = new THREE.MeshStandardMaterial({
    color: 0x3f3f46,
    metalness: 0.8,
    roughness: 0.35,
  });
  const streetLampBulbMat = new THREE.MeshStandardMaterial({
    color: 0xfffbeb,
    emissive: 0xfbbf24,
    emissiveIntensity: 0.2,
    roughness: 0.2,
  });
  disposables.push(lampPoleGeo, lampBulbGeo, lampPoleMat, streetLampBulbMat);

  const lampPoleInst = new THREE.InstancedMesh(lampPoleGeo, lampPoleMat, lampCount);
  const lampBulbInst = new THREE.InstancedMesh(lampBulbGeo, streetLampBulbMat, lampCount);

  for (let i = 0; i < lampCount; i++) {
    const s = samples[Math.floor((i / lampCount) * SAMPLE_COUNT)];
    const side = i % 2 === 0 ? -1 : 1;
    const p = s.position.clone().addScaledVector(s.right, side * (halfW + 2.1));
    const yaw = Math.atan2(s.tangent.x, s.tangent.z);

    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, yaw, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    lampPoleInst.setMatrixAt(i, dummy.matrix);

    // Offset bulb inward over the road shoulder
    const bulbPos = p.clone().addScaledVector(s.right, -side * 1.1);
    dummy.position.set(bulbPos.x, p.y + 6.1, bulbPos.z);
    dummy.updateMatrix();
    lampBulbInst.setMatrixAt(i, dummy.matrix);
  }
  lampPoleInst.instanceMatrix.needsUpdate = true;
  lampBulbInst.instanceMatrix.needsUpdate = true;
  lampPoleInst.computeBoundingSphere();
  lampBulbInst.computeBoundingSphere();
  group.add(lampPoleInst, lampBulbInst);

  // 7. Instanced Tropical Highland Pine & Broadleaf Trees (Pepohonan Sumatera Utara)
  const { trunk: trunkGeo, foliage: foliageGeo } = createPineTreeGeometry();
  const trunkMat = new THREE.MeshStandardMaterial({ color: 0x5c4033, roughness: 0.92 });
  const foliageMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.84 });
  disposables.push(trunkGeo, foliageGeo, trunkMat, foliageMat);

  const treeTransforms: Array<{ x: number; y: number; z: number; scale: number; color: THREE.Color }> = [];
  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 420; i++) {
    const s = samples[Math.floor(rand() * SAMPLE_COUNT)];
    const side = rand() > 0.5 ? 1 : -1;
    const offset = halfW + 6.5 + rand() * 58;
    const tx = s.position.x + s.right.x * side * offset;
    const tz = s.position.z + s.right.z * side * offset;

    // Ensure tree isn't inside lake or on another road segment
    const radial = Math.sqrt(tx * tx + tz * tz);
    if (radial < 158) continue;

    let tooClose = false;
    for (let j = 0; j < SAMPLE_COUNT; j += 15) {
      const dx = tx - samples[j].position.x;
      const dz = tz - samples[j].position.z;
      if (dx * dx + dz * dz < (halfW + 4.5) * (halfW + 4.5)) {
        tooClose = true;
        break;
      }
    }
    if (tooClose) continue;

    const ty = s.position.y + (offset > 22 ? Math.sin(tx * 0.02) * 3 : 0);
    const shade = new THREE.Color().setHSL(0.28 + rand() * 0.07, 0.45 + rand() * 0.2, 0.2 + rand() * 0.14);
    treeTransforms.push({
      x: tx,
      y: ty - 0.3,
      z: tz,
      scale: 0.82 + rand() * 0.72,
      color: shade,
    });
  }

  const trunkInst = new THREE.InstancedMesh(trunkGeo, trunkMat, treeTransforms.length);
  const foliageInst = new THREE.InstancedMesh(foliageGeo, foliageMat, treeTransforms.length);
  foliageInst.castShadow = !isSoftwareGl;
  foliageInst.receiveShadow = true;

  for (let i = 0; i < treeTransforms.length; i++) {
    const t = treeTransforms[i];
    dummy.position.set(t.x, t.y, t.z);
    dummy.rotation.set(0, rand() * Math.PI * 2, 0);
    dummy.scale.setScalar(t.scale);
    dummy.updateMatrix();
    trunkInst.setMatrixAt(i, dummy.matrix);
    foliageInst.setMatrixAt(i, dummy.matrix);
    foliageInst.setColorAt(i, t.color);
  }
  trunkInst.instanceMatrix.needsUpdate = true;
  foliageInst.instanceMatrix.needsUpdate = true;
  if (foliageInst.instanceColor) foliageInst.instanceColor.needsUpdate = true;
  trunkInst.computeBoundingSphere();
  foliageInst.computeBoundingSphere();
  group.add(trunkInst, foliageInst);

  // 8. Roadside Indonesian Warung Pinggir Jalan (3 scenic locations)
  const warungFractions = [0.14, 0.56, 0.84];
  for (const frac of warungFractions) {
    const s = samples[Math.floor(frac * SAMPLE_COUNT)];
    const side = frac === 0.56 ? -1 : 1;
    const { group: warung, disposables: wDisp } = buildWarungGroup(textures);
    disposables.push(...wDisp);
    const pos = s.position.clone().addScaledVector(s.right, side * (halfW + 6.8));
    warung.position.set(pos.x, pos.y - 0.15, pos.z);
    const yaw = Math.atan2(s.tangent.x, s.tangent.z) + (side > 0 ? -Math.PI * 0.5 : Math.PI * 0.5);
    warung.rotation.y = yaw;
    group.add(warung);
  }

  // 9. Indonesian Traffic Signs (Rambu Lalu Lintas) & Corner Chevrons
  const signSpots = [
    { frac: 0.1, tex: textures.signSpeed80, diamond: false, side: 1 },
    { frac: 0.21, tex: textures.signCurveRight, diamond: true, side: 1 },
    { frac: 0.34, tex: textures.signCurveLeft, diamond: true, side: 1 },
    { frac: 0.52, tex: textures.signSpeed80, diamond: false, side: 1 },
    { frac: 0.68, tex: textures.signCurveRight, diamond: true, side: 1 },
    { frac: 0.88, tex: textures.signCurveLeft, diamond: true, side: 1 },
  ];

  for (const sp of signSpots) {
    const s = samples[Math.floor(sp.frac * SAMPLE_COUNT)];
    const { group: sign, disposables: sDisp } = buildRoadSign(sp.tex, sp.diamond);
    disposables.push(...sDisp);
    const pos = s.position.clone().addScaledVector(s.right, sp.side * (halfW + 2.4));
    sign.position.set(pos.x, pos.y - 0.1, pos.z);
    // Face approaching driver
    sign.rotation.y = Math.atan2(-s.tangent.x, -s.tangent.z);
    group.add(sign);
  }

  // Chevron boards along sharp high-curvature bends
  const chevGeo = new THREE.BoxGeometry(1.4, 1.4, 0.12);
  const chevMat = new THREE.MeshStandardMaterial({ map: textures.signChevron, roughness: 0.4 });
  disposables.push(chevGeo, chevMat);
  for (let i = 0; i < SAMPLE_COUNT; i += 22) {
    const s = samples[i];
    if (Math.abs(s.curvature) > 0.14) {
      const outerSide = s.curvature > 0 ? -1 : 1;
      const chev = new THREE.Mesh(chevGeo, chevMat);
      const pos = s.position.clone().addScaledVector(s.right, outerSide * (halfW + 2.1));
      chev.position.set(pos.x, pos.y + 1.4, pos.z);
      chev.rotation.y = Math.atan2(-s.tangent.x, -s.tangent.z);
      if (s.curvature < 0) chev.rotation.y += Math.PI;
      group.add(chev);
    }
  }

  // Track 2D outline for minimap HUD
  const outline2D: Array<{ x: number; z: number }> = [];
  for (let i = 0; i < SAMPLE_COUNT; i += 12) {
    outline2D.push({ x: samples[i].position.x, z: samples[i].position.z });
  }

  // Fast closest sample finder using hint index window
  const _diff = new THREE.Vector3();
  function findClosestSample(x: number, z: number, hintIdx?: number) {
    let bestIdx = 0;
    let bestDistSq = Infinity;

    if (hintIdx !== undefined && hintIdx >= 0) {
      const windowRadius = 45;
      for (let offset = -windowRadius; offset <= windowRadius; offset++) {
        const idx = (hintIdx + offset + SAMPLE_COUNT) % SAMPLE_COUNT;
        const p = samples[idx].position;
        const dx = x - p.x;
        const dz = z - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = idx;
        }
      }
      // Fallback full scan if player teleported or went far off-track
      if (bestDistSq > 45 * 45) {
        for (let i = 0; i < SAMPLE_COUNT; i += 4) {
          const p = samples[i].position;
          const dx = x - p.x;
          const dz = z - p.z;
          const d2 = dx * dx + dz * dz;
          if (d2 < bestDistSq) {
            bestDistSq = d2;
            bestIdx = i;
          }
        }
      }
    } else {
      for (let i = 0; i < SAMPLE_COUNT; i += 4) {
        const p = samples[i].position;
        const dx = x - p.x;
        const dz = z - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = i;
        }
      }
      const center = bestIdx;
      for (let o = -4; o <= 4; o++) {
        const idx = (center + o + SAMPLE_COUNT) % SAMPLE_COUNT;
        const p = samples[idx].position;
        const dx = x - p.x;
        const dz = z - p.z;
        const d2 = dx * dx + dz * dz;
        if (d2 < bestDistSq) {
          bestDistSq = d2;
          bestIdx = idx;
        }
      }
    }

    const sample = samples[bestIdx];
    _diff.set(x - sample.position.x, 0, z - sample.position.z);
    const lateralOffset = _diff.dot(sample.right);
    return { sample, lateralOffset, distSq: bestDistSq };
  }

  function getSampleAtDistance(distance: number): TrackSample {
    const wrapped = ((distance % totalLength) + totalLength) % totalLength;
    const idx = Math.floor((wrapped / totalLength) * SAMPLE_COUNT) % SAMPLE_COUNT;
    return samples[idx];
  }

  function getSurfaceBump(distance: number, lateral: number): number {
    // Subtle asphalt ripples + pronounced rumble when riding on kerbs
    const roadRipple = Math.sin(distance * 0.45) * 0.015 + Math.sin(distance * 1.35) * 0.008;
    const onKerb = Math.abs(lateral) > halfW - 0.5 ? Math.sin(distance * 3.8) * 0.045 : 0;
    return roadRipple + onKerb;
  }

  return {
    group,
    curve,
    samples,
    totalLength,
    roadWidth: ROAD_WIDTH,
    halfWidth: halfW,
    checkpoints,
    streetLampBulbMat,
    outline2D,
    findClosestSample,
    getSampleAtDistance,
    getSurfaceBump,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}
