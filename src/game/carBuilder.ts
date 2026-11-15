import * as THREE from 'three';
import { CarSpec } from './types';
import { ProceduralTextures } from './textures';

export interface CarModelRig {
  root: THREE.Group;
  chassisGroup: THREE.Group; // Suspended body group (pitches/rolls/bounces)
  paintMaterials: THREE.MeshPhysicalMaterial[];
  brakeLightMaterial: THREE.MeshStandardMaterial;
  headlightMaterial: THREE.MeshStandardMaterial;
  frontWheelPivots: THREE.Group[];
  wheelSpinGroups: THREE.Group[];
  steeringWheel: THREE.Group;
  nitroFlames: THREE.Mesh[];
  headlightSpots: THREE.SpotLight[];
  dispose: () => void;
}

function createCarBodyExtrusion(spec: CarSpec): THREE.ExtrudeGeometry {
  const halfL = spec.dimensions.length * 0.5;
  const shape = new THREE.Shape();

  // Side profile in XY (X = Z forward/back, Y = height), extruded along width then rotated
  if (spec.category === 'supercar') {
    shape.moveTo(-halfL, 0.2);
    shape.lineTo(-halfL + 0.1, 0.58);
    shape.lineTo(-halfL * 0.55, 0.72);
    shape.lineTo(-0.3, 0.74);
    shape.lineTo(0.85, 0.62);
    shape.lineTo(halfL - 0.15, 0.42);
    shape.lineTo(halfL, 0.22);
    shape.lineTo(halfL - 0.15, 0.15);
    shape.lineTo(-halfL + 0.15, 0.16);
    shape.closePath();
  } else if (spec.category === 'hypercar') {
    shape.moveTo(-halfL, 0.18);
    shape.lineTo(-halfL + 0.15, 0.56);
    shape.lineTo(-halfL * 0.45, 0.66);
    shape.lineTo(0.25, 0.68);
    shape.lineTo(1.15, 0.52);
    shape.lineTo(halfL, 0.32);
    shape.lineTo(halfL - 0.08, 0.14);
    shape.lineTo(-halfL + 0.12, 0.14);
    shape.closePath();
  } else if (spec.category === 'coupe') {
    shape.moveTo(-halfL, 0.22);
    shape.lineTo(-halfL + 0.08, 0.68);
    shape.lineTo(-halfL * 0.5, 0.74);
    shape.lineTo(0.45, 0.74);
    shape.lineTo(halfL - 0.18, 0.56);
    shape.lineTo(halfL, 0.28);
    shape.lineTo(halfL - 0.12, 0.18);
    shape.lineTo(-halfL + 0.12, 0.18);
    shape.closePath();
  } else if (spec.category === 'sedan') {
    shape.moveTo(-halfL, 0.24);
    shape.lineTo(-halfL + 0.06, 0.74);
    shape.lineTo(-halfL * 0.52, 0.8);
    shape.lineTo(0.55, 0.8);
    shape.lineTo(halfL - 0.12, 0.62);
    shape.lineTo(halfL, 0.32);
    shape.lineTo(halfL - 0.1, 0.2);
    shape.lineTo(-halfL + 0.1, 0.2);
    shape.closePath();
  } else {
    // racecar GT3
    shape.moveTo(-halfL, 0.16);
    shape.lineTo(-halfL + 0.06, 0.66);
    shape.lineTo(-halfL * 0.48, 0.74);
    shape.lineTo(0.55, 0.72);
    shape.lineTo(halfL - 0.12, 0.48);
    shape.lineTo(halfL, 0.2);
    shape.lineTo(halfL - 0.1, 0.13);
    shape.lineTo(-halfL + 0.1, 0.14);
    shape.closePath();
  }

  const width = spec.dimensions.width * 0.88;
  const extrude = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: width,
    bevelEnabled: true,
    bevelThickness: 0.07,
    bevelSize: 0.05,
    bevelSegments: 2,
  });
  // Center depth along Z, then rotate so profile X becomes +Z (car forward) and depth becomes X (car width)
  extrude.translate(0, 0, -width * 0.5);
  extrude.rotateY(-Math.PI * 0.5);
  extrude.computeVertexNormals();
  return extrude;
}

function createCabinExtrusion(spec: CarSpec): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape();
  if (spec.category === 'supercar' || spec.category === 'hypercar') {
    shape.moveTo(-1.05, 0.66);
    shape.lineTo(-0.55, 1.06);
    shape.lineTo(0.28, 1.08);
    shape.lineTo(0.95, 0.64);
    shape.closePath();
  } else if (spec.category === 'sedan') {
    shape.moveTo(-1.32, 0.76);
    shape.lineTo(-0.78, 1.26);
    shape.lineTo(0.45, 1.26);
    shape.lineTo(1.05, 0.76);
    shape.closePath();
  } else {
    shape.moveTo(-1.22, 0.7);
    shape.lineTo(-0.62, 1.17);
    shape.lineTo(0.32, 1.17);
    shape.lineTo(0.95, 0.68);
    shape.closePath();
  }

  const cabinW = spec.dimensions.width * 0.62;
  const geo = new THREE.ExtrudeGeometry(shape, {
    steps: 1,
    depth: cabinW,
    bevelEnabled: true,
    bevelThickness: 0.06,
    bevelSize: 0.04,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -cabinW * 0.5);
  geo.rotateY(-Math.PI * 0.5);
  geo.computeVertexNormals();
  return geo;
}

function buildWheelMesh(
  radius: number,
  width: number,
  rimMat: THREE.Material,
  tireMat: THREE.Material,
  caliperMat: THREE.Material,
  sideSign: number
): THREE.Group {
  const wheelSpinGroup = new THREE.Group();

  // Tire rubber cylinder
  const tireGeo = new THREE.CylinderGeometry(radius, radius, width, 24);
  tireGeo.rotateZ(Math.PI * 0.5);
  const tireMesh = new THREE.Mesh(tireGeo, tireMat);
  tireMesh.castShadow = true;
  wheelSpinGroup.add(tireMesh);

  // Outer alloy rim lip
  const rimGeo = new THREE.CylinderGeometry(radius * 0.66, radius * 0.66, width + 0.015, 20);
  rimGeo.rotateZ(Math.PI * 0.5);
  const rimMesh = new THREE.Mesh(rimGeo, rimMat);
  wheelSpinGroup.add(rimMesh);

  // 5-spoke star pattern
  const spokeGeo = new THREE.BoxGeometry(0.03, radius * 1.18, 0.055);
  for (let i = 0; i < 5; i++) {
    const spoke = new THREE.Mesh(spokeGeo, rimMat);
    spoke.rotation.x = (i / 5) * Math.PI;
    spoke.position.x = sideSign * (width * 0.45);
    wheelSpinGroup.add(spoke);
  }

  // Center hub cap
  const hubGeo = new THREE.CylinderGeometry(0.075, 0.075, width + 0.03, 12);
  hubGeo.rotateZ(Math.PI * 0.5);
  const hub = new THREE.Mesh(hubGeo, caliperMat);
  wheelSpinGroup.add(hub);

  return wheelSpinGroup;
}

export function buildCarModel(
  spec: CarSpec,
  paintHex: string,
  textures: ProceduralTextures,
  options: { isPlayer?: boolean; isSoftwareGl?: boolean } = {}
): CarModelRig {
  const disposables: Array<{ dispose: () => void }> = [];
  const root = new THREE.Group();
  const chassisGroup = new THREE.Group();
  root.add(chassisGroup);

  const paintMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(paintHex),
    metalness: 0.72,
    roughness: 0.22,
    clearcoat: 1.0,
    clearcoatRoughness: 0.08,
    envMapIntensity: 1.35,
  });
  const carbonMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    metalness: 0.35,
    roughness: 0.48,
  });
  const tireMat = new THREE.MeshStandardMaterial({
    color: 0x141416,
    metalness: 0.05,
    roughness: 0.88,
  });
  const rimMat = new THREE.MeshStandardMaterial({
    color: 0xd4d4d8,
    metalness: 0.92,
    roughness: 0.18,
  });
  const caliperMat = new THREE.MeshStandardMaterial({
    color: 0xdc2626,
    metalness: 0.4,
    roughness: 0.35,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0x0b1220,
    metalness: 0.1,
    roughness: 0.05,
    clearcoat: 1.0,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const headlightMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeef6ff,
    emissiveIntensity: 2.2,
    roughness: 0.1,
  });
  const brakeLightMat = new THREE.MeshStandardMaterial({
    color: 0xef4444,
    emissive: 0xdc2626,
    emissiveIntensity: 1.4,
    roughness: 0.15,
  });
  const interiorMat = new THREE.MeshStandardMaterial({
    color: 0x1c1c20,
    metalness: 0.1,
    roughness: 0.78,
  });
  const dashMat = new THREE.MeshStandardMaterial({
    map: textures.dashboardCluster,
    emissiveMap: textures.dashboardCluster,
    emissive: 0xffffff,
    emissiveIntensity: 0.8,
    roughness: 0.3,
  });

  disposables.push(
    paintMat,
    carbonMat,
    tireMat,
    rimMat,
    caliperMat,
    glassMat,
    headlightMat,
    brakeLightMat,
    interiorMat,
    dashMat
  );

  // 1. Primary sculpted car body
  const bodyGeo = createCarBodyExtrusion(spec);
  disposables.push(bodyGeo);
  const bodyMesh = new THREE.Mesh(bodyGeo, paintMat);
  bodyMesh.castShadow = true;
  bodyMesh.receiveShadow = true;
  chassisGroup.add(bodyMesh);

  // 2. Muscular wheel arch fenders
  const halfTrack = spec.dimensions.trackWidth * 0.5;
  const halfWheelbase = spec.dimensions.wheelbase * 0.5;
  const archGeo = new THREE.BoxGeometry(0.22, 0.36, 0.88);
  disposables.push(archGeo);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const arch = new THREE.Mesh(archGeo, paintMat);
      arch.position.set(sx * (halfTrack - 0.03), 0.44, sz * halfWheelbase);
      arch.castShadow = true;
      chassisGroup.add(arch);
    }
  }

  // 3. Tinted greenhouse cabin + A-pillars (transparent glass so cockpit view works!)
  const cabinGeo = createCabinExtrusion(spec);
  disposables.push(cabinGeo);
  const cabinMesh = new THREE.Mesh(cabinGeo, glassMat);
  cabinMesh.renderOrder = 2;
  chassisGroup.add(cabinMesh);

  // Roof cap
  const roofCapGeo = new THREE.BoxGeometry(
    spec.dimensions.width * 0.56,
    0.05,
    spec.category === 'sedan' ? 1.15 : 0.82
  );
  disposables.push(roofCapGeo);
  const roofCap = new THREE.Mesh(roofCapGeo, spec.category === 'racecar' ? carbonMat : paintMat);
  roofCap.position.set(0, spec.dimensions.height - 0.04, -0.14);
  roofCap.castShadow = true;
  chassisGroup.add(roofCap);

  // 4. Front Splitter, Side Skirts & Rear Diffuser (Carbon Fiber)
  const halfL = spec.dimensions.length * 0.5;
  const splitterGeo = new THREE.BoxGeometry(spec.dimensions.width * 0.96, 0.06, 0.36);
  const skirtGeo = new THREE.BoxGeometry(0.14, 0.08, spec.dimensions.wheelbase * 0.8);
  const diffuserGeo = new THREE.BoxGeometry(spec.dimensions.width * 0.88, 0.14, 0.28);
  disposables.push(splitterGeo, skirtGeo, diffuserGeo);

  const splitter = new THREE.Mesh(splitterGeo, carbonMat);
  splitter.position.set(0, 0.17, halfL - 0.08);
  chassisGroup.add(splitter);

  for (const sx of [-1, 1]) {
    const skirt = new THREE.Mesh(skirtGeo, carbonMat);
    skirt.position.set(sx * (spec.dimensions.width * 0.47), 0.19, 0);
    chassisGroup.add(skirt);
  }

  const diffuser = new THREE.Mesh(diffuserGeo, carbonMat);
  diffuser.position.set(0, 0.2, -halfL + 0.06);
  chassisGroup.add(diffuser);

  // 5. Category-specific Aero Wing / Spoiler / Roof Scoop
  if (spec.category === 'racecar' || spec.category === 'hypercar' || spec.category === 'supercar') {
    const wingW = spec.category === 'racecar' ? spec.dimensions.width * 1.02 : spec.dimensions.width * 0.88;
    const wingY = spec.category === 'racecar' ? 1.05 : spec.category === 'hypercar' ? 0.94 : 0.88;
    const wingBladeGeo = new THREE.BoxGeometry(wingW, 0.05, 0.32);
    const pylonGeo = new THREE.BoxGeometry(0.05, wingY - 0.62, 0.22);
    const endplateGeo = new THREE.BoxGeometry(0.04, 0.22, 0.38);
    disposables.push(wingBladeGeo, pylonGeo, endplateGeo);

    const wing = new THREE.Mesh(wingBladeGeo, carbonMat);
    wing.position.set(0, wingY, -halfL + 0.12);
    wing.rotation.x = 0.12;
    wing.castShadow = true;
    chassisGroup.add(wing);

    for (const sx of [-0.36, 0.36]) {
      const pylon = new THREE.Mesh(pylonGeo, carbonMat);
      pylon.position.set(sx, 0.62 + (wingY - 0.62) * 0.5, -halfL + 0.18);
      chassisGroup.add(pylon);
    }
    for (const sx of [-1, 1]) {
      const plate = new THREE.Mesh(endplateGeo, paintMat);
      plate.position.set(sx * wingW * 0.5, wingY, -halfL + 0.12);
      chassisGroup.add(plate);
    }
  } else if (spec.category === 'coupe') {
    const duckGeo = new THREE.BoxGeometry(spec.dimensions.width * 0.8, 0.1, 0.18);
    disposables.push(duckGeo);
    const duck = new THREE.Mesh(duckGeo, carbonMat);
    duck.position.set(0, 0.76, -halfL + 0.16);
    duck.rotation.x = -0.35;
    chassisGroup.add(duck);
  }

  if (spec.category === 'racecar' || spec.category === 'hypercar') {
    const scoopGeo = new THREE.BoxGeometry(0.32, 0.12, 0.58);
    disposables.push(scoopGeo);
    const scoop = new THREE.Mesh(scoopGeo, carbonMat);
    scoop.position.set(0, spec.dimensions.height + 0.03, -0.35);
    chassisGroup.add(scoop);
  }

  // 6. Side Mirrors
  const mirrorGeo = new THREE.BoxGeometry(0.18, 0.08, 0.12);
  disposables.push(mirrorGeo);
  for (const sx of [-1, 1]) {
    const mirror = new THREE.Mesh(mirrorGeo, paintMat);
    mirror.position.set(sx * (spec.dimensions.width * 0.44), 0.82, 0.56);
    chassisGroup.add(mirror);
  }

  // 7. LED Headlights & Taillights + Exhausts
  const hlGeo = new THREE.BoxGeometry(0.34, 0.07, 0.12);
  const tlGeo = new THREE.BoxGeometry(0.46, 0.075, 0.09);
  const exhGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.16, 12);
  exhGeo.rotateX(Math.PI * 0.5);
  disposables.push(hlGeo, tlGeo, exhGeo);

  for (const sx of [-1, 1]) {
    const hl = new THREE.Mesh(hlGeo, headlightMat);
    hl.position.set(sx * (spec.dimensions.width * 0.32), 0.46, halfL - 0.12);
    chassisGroup.add(hl);

    const tl = new THREE.Mesh(tlGeo, brakeLightMat);
    tl.position.set(sx * (spec.dimensions.width * 0.29), 0.6, -halfL + 0.08);
    chassisGroup.add(tl);

    const exh = new THREE.Mesh(exhGeo, rimMat);
    exh.position.set(sx * 0.36, 0.24, -halfL + 0.02);
    chassisGroup.add(exh);
  }

  // 8. Nitro Exhaust Flame Cones
  const flameGeo = new THREE.ConeGeometry(0.09, 0.65, 10);
  flameGeo.rotateX(-Math.PI * 0.5);
  const flameMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.88,
  });
  disposables.push(flameGeo, flameMat);
  const nitroFlames: THREE.Mesh[] = [];
  for (const sx of [-0.36, 0.36]) {
    const flame = new THREE.Mesh(flameGeo, flameMat);
    flame.position.set(sx, 0.24, -halfL - 0.32);
    flame.visible = false;
    chassisGroup.add(flame);
    nitroFlames.push(flame);
  }

  // 9. Cockpit Interior (Dashboard, Digital Cluster, Bucket Seats, Rotating Steering Wheel)
  const dashBodyGeo = new THREE.BoxGeometry(spec.dimensions.width * 0.6, 0.24, 0.42);
  const clusterPlaneGeo = new THREE.PlaneGeometry(0.36, 0.14);
  const seatGeo = new THREE.BoxGeometry(0.42, 0.58, 0.42);
  disposables.push(dashBodyGeo, clusterPlaneGeo, seatGeo);

  const dashBody = new THREE.Mesh(dashBodyGeo, interiorMat);
  dashBody.position.set(0, 0.72, 0.58);
  chassisGroup.add(dashBody);

  const cluster = new THREE.Mesh(clusterPlaneGeo, dashMat);
  cluster.position.set(spec.dimensions.cockpitOffset[0], 0.82, 0.365);
  cluster.rotation.y = Math.PI;
  chassisGroup.add(cluster);

  for (const sx of [-0.32, 0.32]) {
    const seat = new THREE.Mesh(seatGeo, interiorMat);
    seat.position.set(sx, 0.56, -0.2);
    seat.rotation.x = -0.18;
    chassisGroup.add(seat);
  }

  // Steering wheel group
  const steeringWheel = new THREE.Group();
  steeringWheel.position.set(spec.dimensions.cockpitOffset[0], 0.82, 0.32);
  steeringWheel.rotation.x = -0.28;
  const swRingGeo = new THREE.TorusGeometry(0.145, 0.02, 8, 20);
  const swSpokeGeo = new THREE.BoxGeometry(0.26, 0.025, 0.02);
  const swTopMarkGeo = new THREE.BoxGeometry(0.03, 0.045, 0.03);
  disposables.push(swRingGeo, swSpokeGeo, swTopMarkGeo);

  steeringWheel.add(new THREE.Mesh(swRingGeo, carbonMat));
  steeringWheel.add(new THREE.Mesh(swSpokeGeo, rimMat));
  const topMark = new THREE.Mesh(swTopMarkGeo, caliperMat);
  topMark.position.set(0, 0.145, 0);
  steeringWheel.add(topMark);
  chassisGroup.add(steeringWheel);

  // 10. Four Composite Wheels (Front Steer Pivots + Spin Groups)
  const frontWheelPivots: THREE.Group[] = [];
  const wheelSpinGroups: THREE.Group[] = [];
  const r = spec.dimensions.wheelRadius;
  const w = spec.dimensions.wheelWidth;

  const wheelPositions: Array<{ x: number; z: number; isFront: boolean }> = [
    { x: -halfTrack, z: halfWheelbase, isFront: true },
    { x: halfTrack, z: halfWheelbase, isFront: true },
    { x: -halfTrack, z: -halfWheelbase, isFront: false },
    { x: halfTrack, z: -halfWheelbase, isFront: false },
  ];

  for (const wp of wheelPositions) {
    const pivot = new THREE.Group();
    pivot.position.set(wp.x, r, wp.z);
    const spinGroup = buildWheelMesh(r, w, rimMat, tireMat, caliperMat, Math.sign(wp.x));
    pivot.add(spinGroup);
    root.add(pivot);
    wheelSpinGroups.push(spinGroup);
    if (wp.isFront) {
      frontWheelPivots.push(pivot);
    }
  }

  // 11. Grounded Contact Shadow Plane beneath car
  const shadowGeo = new THREE.PlaneGeometry(spec.dimensions.width * 1.45, spec.dimensions.length * 1.25);
  shadowGeo.rotateX(-Math.PI * 0.5);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: textures.contactShadow,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
  });
  disposables.push(shadowGeo, shadowMat);
  const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
  shadowPlane.position.y = 0.025;
  root.add(shadowPlane);

  // 12. Real Headlight SpotLights (player car only, disabled on software GL for perf)
  const headlightSpots: THREE.SpotLight[] = [];
  if (options.isPlayer && !options.isSoftwareGl) {
    for (const sx of [-0.58, 0.58]) {
      const spot = new THREE.SpotLight(0xfff5e4, 0, 55, Math.PI * 0.22, 0.55, 1.5);
      spot.position.set(sx, 0.58, halfL - 0.1);
      spot.target.position.set(sx * 1.3, 0.0, halfL + 22);
      chassisGroup.add(spot);
      chassisGroup.add(spot.target);
      headlightSpots.push(spot);
    }
  }

  return {
    root,
    chassisGroup,
    paintMaterials: [paintMat],
    brakeLightMaterial: brakeLightMat,
    headlightMaterial: headlightMat,
    frontWheelPivots,
    wheelSpinGroups,
    steeringWheel,
    nitroFlames,
    headlightSpots,
    dispose: () => {
      for (const d of disposables) d.dispose();
    },
  };
}

export function buildTrafficCarMesh(colorHex: string): THREE.Group {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color(colorHex),
    metalness: 0.35,
    roughness: 0.4,
  });
  const glassMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    metalness: 0.6,
    roughness: 0.15,
  });
  const wheelMat = new THREE.MeshStandardMaterial({
    color: 0x18181b,
    roughness: 0.85,
  });

  // Indonesian MPV / Minibus silhouette (Avanza / Kijang style)
  const lower = new THREE.Mesh(new THREE.BoxGeometry(1.76, 0.68, 4.3), bodyMat);
  lower.position.y = 0.62;
  lower.castShadow = true;
  group.add(lower);

  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.64, 2.7), glassMat);
  cabin.position.set(0, 1.24, -0.22);
  group.add(cabin);

  const roof = new THREE.Mesh(new THREE.BoxGeometry(1.64, 0.08, 2.65), bodyMat);
  roof.position.set(0, 1.58, -0.22);
  group.add(roof);

  const hlMat = new THREE.MeshBasicMaterial({ color: 0xfef9c3 });
  const tlMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });
  for (const sx of [-0.62, 0.62]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.14, 0.05), hlMat);
    hl.position.set(sx, 0.68, 2.16);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.16, 0.05), tlMat);
    tl.position.set(sx, 0.72, -2.16);
    group.add(tl);
  }

  const wheelGeo = new THREE.CylinderGeometry(0.32, 0.32, 0.24, 14);
  wheelGeo.rotateZ(Math.PI * 0.5);
  for (const sx of [-0.82, 0.82]) {
    for (const sz of [-1.35, 1.35]) {
      const w = new THREE.Mesh(wheelGeo, wheelMat);
      w.position.set(sx, 0.32, sz);
      group.add(w);
    }
  }

  return group;
}
