import * as THREE from 'three';

export interface ProceduralTextures {
  asphalt: THREE.CanvasTexture;
  kerb: THREE.CanvasTexture;
  checkered: THREE.CanvasTexture;
  gantryBanner: THREE.CanvasTexture;
  terrain: THREE.CanvasTexture;
  signCurveLeft: THREE.CanvasTexture;
  signCurveRight: THREE.CanvasTexture;
  signSpeed80: THREE.CanvasTexture;
  signChevron: THREE.CanvasTexture;
  warungBanner: THREE.CanvasTexture;
  contactShadow: THREE.CanvasTexture;
  dashboardCluster: THREE.CanvasTexture;
  dispose: () => void;
}

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  return [canvas, ctx];
}

function configureTexture(
  canvas: HTMLCanvasElement,
  anisotropy: number,
  repeatX = 1,
  repeatY = 1,
  srgb = true
): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  tex.anisotropy = anisotropy;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export function createProceduralTextures(maxAnisotropy: number): ProceduralTextures {
  const aniso = Math.min(8, Math.max(1, maxAnisotropy));

  // 1. Asphalt Road Texture (512x512, mapped across road width U=0..1, V repeats along track)
  const [asphCanvas, asphCtx] = makeCanvas(512, 512);
  asphCtx.fillStyle = '#26282c';
  asphCtx.fillRect(0, 0, 512, 512);

  // Subtle tire wear bands in both lanes
  const gradL = asphCtx.createLinearGradient(80, 0, 210, 0);
  gradL.addColorStop(0, 'rgba(12,13,15,0)');
  gradL.addColorStop(0.5, 'rgba(12,13,15,0.28)');
  gradL.addColorStop(1, 'rgba(12,13,15,0)');
  asphCtx.fillStyle = gradL;
  asphCtx.fillRect(80, 0, 130, 512);

  const gradR = asphCtx.createLinearGradient(302, 0, 432, 0);
  gradR.addColorStop(0, 'rgba(12,13,15,0)');
  gradR.addColorStop(0.5, 'rgba(12,13,15,0.28)');
  gradR.addColorStop(1, 'rgba(12,13,15,0)');
  asphCtx.fillStyle = gradR;
  asphCtx.fillRect(302, 0, 130, 512);

  // Aggregate mineral speckle
  for (let i = 0; i < 16000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const v = 28 + Math.floor(Math.random() * 34);
    asphCtx.fillStyle = `rgb(${v},${v + 1},${v + 3})`;
    asphCtx.fillRect(x, y, 1.5, 1.5);
  }

  // Edge solid white lines
  asphCtx.fillStyle = '#e5e7eb';
  asphCtx.fillRect(18, 0, 10, 512);
  asphCtx.fillRect(484, 0, 10, 512);

  // Indonesian mountain road center yellow-white dashed markings
  asphCtx.fillStyle = '#facc15';
  asphCtx.fillRect(251, 24, 10, 180);
  asphCtx.fillRect(251, 280, 10, 180);

  const asphalt = configureTexture(asphCanvas, aniso, 1, 1);

  // 2. Red-White Kerb Texture
  const [kerbCanvas, kerbCtx] = makeCanvas(128, 256);
  kerbCtx.fillStyle = '#dc2626';
  kerbCtx.fillRect(0, 0, 128, 128);
  kerbCtx.fillStyle = '#f8fafc';
  kerbCtx.fillRect(0, 128, 128, 128);
  // Subtle concrete wear
  kerbCtx.fillStyle = 'rgba(0,0,0,0.08)';
  for (let i = 0; i < 400; i++) {
    kerbCtx.fillRect(Math.random() * 128, Math.random() * 256, 2, 2);
  }
  const kerb = configureTexture(kerbCanvas, aniso, 1, 1);

  // 3. Checkered Start/Finish Line
  const [chkCanvas, chkCtx] = makeCanvas(512, 128);
  const sq = 32;
  for (let y = 0; y < 128; y += sq) {
    for (let x = 0; x < 512; x += sq) {
      const even = ((x / sq) + (y / sq)) % 2 === 0;
      chkCtx.fillStyle = even ? '#f8fafc' : '#111114';
      chkCtx.fillRect(x, y, sq, sq);
    }
  }
  const checkered = configureTexture(chkCanvas, aniso, 1, 1);

  // 4. Overhead Start/Finish Gantry Banner
  const [gantryCanvas, gantryCtx] = makeCanvas(1024, 192);
  gantryCtx.fillStyle = '#09090b';
  gantryCtx.fillRect(0, 0, 1024, 192);
  gantryCtx.fillStyle = '#dc2626';
  gantryCtx.fillRect(0, 0, 1024, 16);
  gantryCtx.fillRect(0, 176, 1024, 16);
  gantryCtx.fillStyle = '#fafafa';
  gantryCtx.font = 'bold 52px sans-serif';
  gantryCtx.textAlign = 'center';
  gantryCtx.textBaseline = 'middle';
  gantryCtx.fillText('BUKIT BARISAN CIRCUIT  ·  SUMATERA UTARA', 512, 96);
  const gantryBanner = configureTexture(gantryCanvas, aniso, 1, 1);
  gantryBanner.wrapS = THREE.ClampToEdgeWrapping;
  gantryBanner.wrapT = THREE.ClampToEdgeWrapping;

  // 5. Terrain Grass & Highland Texture
  const [terCanvas, terCtx] = makeCanvas(512, 512);
  terCtx.fillStyle = '#2d4c26';
  terCtx.fillRect(0, 0, 512, 512);
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * 512;
    const y = Math.random() * 512;
    const g = 55 + Math.floor(Math.random() * 48);
    const r = Math.floor(g * 0.55);
    const b = Math.floor(g * 0.42);
    terCtx.fillStyle = `rgb(${r},${g},${b})`;
    terCtx.fillRect(x, y, 2, 3);
  }
  const terrain = configureTexture(terCanvas, aniso, 36, 36);

  // 6. Indonesian Traffic Warning Signs (Yellow Diamond)
  const makeWarningSign = (dir: 'left' | 'right'): THREE.CanvasTexture => {
    const [c, ctx] = makeCanvas(256, 256);
    ctx.fillStyle = '#facc15';
    ctx.fillRect(0, 0, 256, 256);
    ctx.strokeStyle = '#111111';
    ctx.lineWidth = 14;
    ctx.strokeRect(14, 14, 228, 228);

    // Draw sharp curve arrow rotated for diamond orientation
    ctx.save();
    ctx.translate(128, 128);
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = '#111111';
    ctx.fillStyle = '#111111';
    ctx.lineWidth = 22;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    if (dir === 'left') {
      ctx.moveTo(26, 66);
      ctx.lineTo(26, 8);
      ctx.quadraticCurveTo(26, -32, -26, -32);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(-54, -32);
      ctx.lineTo(-14, -58);
      ctx.lineTo(-14, -6);
      ctx.closePath();
      ctx.fill();
    } else {
      ctx.moveTo(-26, 66);
      ctx.lineTo(-26, 8);
      ctx.quadraticCurveTo(-26, -32, 26, -32);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(54, -32);
      ctx.lineTo(14, -58);
      ctx.lineTo(14, -6);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    const t = configureTexture(c, aniso, 1, 1);
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
    return t;
  };

  const signCurveLeft = makeWarningSign('left');
  const signCurveRight = makeWarningSign('right');

  // 7. Speed Limit 80 Sign
  const [spdCanvas, spdCtx] = makeCanvas(256, 256);
  spdCtx.fillStyle = '#ffffff';
  spdCtx.fillRect(0, 0, 256, 256);
  spdCtx.strokeStyle = '#dc2626';
  spdCtx.lineWidth = 28;
  spdCtx.beginPath();
  spdCtx.arc(128, 128, 108, 0, Math.PI * 2);
  spdCtx.stroke();
  spdCtx.fillStyle = '#111111';
  spdCtx.font = 'bold 104px sans-serif';
  spdCtx.textAlign = 'center';
  spdCtx.textBaseline = 'middle';
  spdCtx.fillText('80', 128, 134);
  const signSpeed80 = configureTexture(spdCanvas, aniso, 1, 1);

  // 8. Chevron Sharp Turn Sign
  const [chevCanvas, chevCtx] = makeCanvas(256, 256);
  chevCtx.fillStyle = '#facc15';
  chevCtx.fillRect(0, 0, 256, 256);
  chevCtx.fillStyle = '#111111';
  chevCtx.beginPath();
  chevCtx.moveTo(40, 24);
  chevCtx.lineTo(130, 24);
  chevCtx.lineTo(216, 128);
  chevCtx.lineTo(130, 232);
  chevCtx.lineTo(40, 232);
  chevCtx.lineTo(126, 128);
  chevCtx.closePath();
  chevCtx.fill();
  const signChevron = configureTexture(chevCanvas, aniso, 1, 1);

  // 9. Warung Banner ("WARUNG KOPI SIDIKALANG")
  const [warCanvas, warCtx] = makeCanvas(512, 160);
  warCtx.fillStyle = '#b91c1c';
  warCtx.fillRect(0, 0, 512, 160);
  warCtx.fillStyle = '#facc15';
  warCtx.fillRect(0, 0, 512, 22);
  warCtx.fillRect(0, 138, 512, 22);
  warCtx.fillStyle = '#ffffff';
  warCtx.font = 'bold 34px sans-serif';
  warCtx.textAlign = 'center';
  warCtx.fillText('WARUNG KOPI SIDIKALANG', 256, 74);
  warCtx.fillStyle = '#fef08a';
  warCtx.font = 'bold 20px sans-serif';
  warCtx.fillText('MIE GOMAK  ·  KOPI PANAS  ·  GORENGAN', 256, 114);
  const warungBanner = configureTexture(warCanvas, aniso, 1, 1);
  warungBanner.wrapS = THREE.ClampToEdgeWrapping;
  warungBanner.wrapT = THREE.ClampToEdgeWrapping;

  // 10. Soft Radial Contact Shadow
  const [shCanvas, shCtx] = makeCanvas(128, 128);
  const shGrad = shCtx.createRadialGradient(64, 64, 12, 64, 64, 62);
  shGrad.addColorStop(0, 'rgba(0,0,0,0.72)');
  shGrad.addColorStop(0.55, 'rgba(0,0,0,0.38)');
  shGrad.addColorStop(1, 'rgba(0,0,0,0)');
  shCtx.fillStyle = shGrad;
  shCtx.fillRect(0, 0, 128, 128);
  const contactShadow = configureTexture(shCanvas, 1, 1, 1, true);
  contactShadow.wrapS = THREE.ClampToEdgeWrapping;
  contactShadow.wrapT = THREE.ClampToEdgeWrapping;

  // 11. Car Dashboard Digital Cluster
  const [dashCanvas, dashCtx] = makeCanvas(512, 192);
  dashCtx.fillStyle = '#09090b';
  dashCtx.fillRect(0, 0, 512, 192);
  dashCtx.strokeStyle = '#ef4444';
  dashCtx.lineWidth = 4;
  dashCtx.strokeRect(8, 8, 496, 176);
  // Arc gauge
  dashCtx.strokeStyle = '#3f3f46';
  dashCtx.lineWidth = 14;
  dashCtx.beginPath();
  dashCtx.arc(140, 125, 72, Math.PI * 0.85, Math.PI * 2.15);
  dashCtx.stroke();
  dashCtx.strokeStyle = '#ef4444';
  dashCtx.beginPath();
  dashCtx.arc(140, 125, 72, Math.PI * 1.65, Math.PI * 2.15);
  dashCtx.stroke();
  dashCtx.fillStyle = '#ffffff';
  dashCtx.font = 'bold 42px monospace';
  dashCtx.fillText('RPM', 102, 134);
  dashCtx.fillStyle = '#e4e4e7';
  dashCtx.font = 'bold 24px sans-serif';
  dashCtx.fillText('RACE TELEMETRY', 270, 62);
  dashCtx.fillStyle = '#ef4444';
  dashCtx.font = 'bold 34px monospace';
  dashCtx.fillText('GEAR  TRACK', 270, 122);
  const dashboardCluster = configureTexture(dashCanvas, aniso, 1, 1);

  return {
    asphalt,
    kerb,
    checkered,
    gantryBanner,
    terrain,
    signCurveLeft,
    signCurveRight,
    signSpeed80,
    signChevron,
    warungBanner,
    contactShadow,
    dashboardCluster,
    dispose: () => {
      asphalt.dispose();
      kerb.dispose();
      checkered.dispose();
      gantryBanner.dispose();
      terrain.dispose();
      signCurveLeft.dispose();
      signCurveRight.dispose();
      signSpeed80.dispose();
      signChevron.dispose();
      warungBanner.dispose();
      contactShadow.dispose();
      dashboardCluster.dispose();
    },
  };
}
