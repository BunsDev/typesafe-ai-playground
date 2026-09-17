import { isSoftwareRenderer, renderPixelRatio } from "./render-quality";
import * as THREE from "three";
import type { GameState } from "../types/doom";
import { angleDifference } from "./gameLoop";
import { verticalFieldOfView } from "./doom-camera";

/** Rendering is read-only. Geometry never decides hits, movement or Jev features. */
export function createDoomScene(canvas: HTMLCanvasElement, initial: GameState) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: "low-power",
  });
  const software = isSoftwareRenderer(renderer.getContext());
  canvas.dataset.renderQuality = software ? "software-balanced" : "hardware";
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color("#101624");
  scene.fog = new THREE.Fog("#101624", 4, 15);
  const camera = new THREE.PerspectiveCamera(65, 1, 0.04, 22);
  scene.add(camera);
  const headlamp = new THREE.PointLight(0xc7e9ff, 3, 7, 1.5);
  camera.add(headlamp);
  scene.add(new THREE.HemisphereLight(0xb8dfff, 0x34213d, 2.5));
  const light = new THREE.DirectionalLight(0xffffff, 2);
  light.position.set(3, 8, 2);
  scene.add(light);
  const pink = new THREE.MeshStandardMaterial({
    color: 0xdf538f,
    roughness: 0.6,
    metalness: 0.1,
  });
  const steel = new THREE.MeshStandardMaterial({
    color: 0x3e5069,
    roughness: 0.8,
    metalness: 0.3,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x141d2b,
    roughness: 0.7,
  });
  const glow = new THREE.MeshBasicMaterial({ color: 0x72daf9 });
  const hot = new THREE.MeshBasicMaterial({ color: 0xff75ca });
  const gold = new THREE.MeshBasicMaterial({ color: 0xffd772 });
  const green = new THREE.MeshBasicMaterial({ color: 0x71f5c7 });
  const boxGeometry = new THREE.BoxGeometry(1, 1, 1);
  const box = (
    parent: THREE.Object3D,
    x: number,
    y: number,
    z: number,
    w: number,
    h: number,
    d: number,
    mat: THREE.Material,
  ) => {
    const mesh = new THREE.Mesh(boxGeometry, mat);
    mesh.position.set(x, y, z);
    mesh.scale.set(w, h, d);
    parent.add(mesh);
    return mesh;
  };
  const wallCanvas = document.createElement("canvas");
  wallCanvas.width = 128;
  wallCanvas.height = 256;
  const panel = wallCanvas.getContext("2d")!;
  panel.fillStyle = "#7b8fa7";
  panel.fillRect(0, 0, 128, 256);
  panel.fillStyle = "#53677f";
  panel.fillRect(3, 3, 122, 250);
  panel.strokeStyle = "#a6b7c8";
  panel.lineWidth = 2;
  panel.strokeRect(7, 9, 114, 238);
  panel.fillStyle = "#304259";
  panel.fillRect(12, 155, 104, 2);
  for (const y of [18, 238])
    for (const x of [16, 112]) {
      panel.fillStyle = "#b5c7d8";
      panel.fillRect(x, y, 3, 3);
    }
  for (let y = 174; y < 220; y += 7) {
    panel.fillStyle = "#3b4e64";
    panel.fillRect(76, y, 32, 2);
  }
  const wallTexture = new THREE.CanvasTexture(wallCanvas);
  wallTexture.colorSpace = THREE.SRGBColorSpace;
  const wallMaterial = new THREE.MeshStandardMaterial({
    map: wallTexture,
    roughness: 0.82,
    metalness: 0.12,
  });
  const floorCanvas = document.createElement("canvas");
  floorCanvas.width = floorCanvas.height = 128;
  const ctx = floorCanvas.getContext("2d")!;
  ctx.fillStyle = "#293347";
  ctx.fillRect(0, 0, 128, 128);
  ctx.strokeStyle = "#435069";
  ctx.lineWidth = 3;
  ctx.strokeRect(2, 2, 124, 124);
  ctx.fillStyle = "#566078";
  for (const x of [10, 118])
    for (const y of [10, 118]) ctx.fillRect(x, y, 3, 3);
  const floorTexture = new THREE.CanvasTexture(floorCanvas);
  floorTexture.wrapS = floorTexture.wrapT = THREE.RepeatWrapping;
  floorTexture.repeat.set(15, 11);
  floorTexture.colorSpace = THREE.SRGBColorSpace;
  const floorMat = new THREE.MeshStandardMaterial({
    map: floorTexture,
    roughness: 0.95,
  });
  box(scene, 7.5, -0.08, 5.5, 15, 0.16, 11, floorMat);
  box(scene, 7.5, 2.4, 5.5, 15, 0.12, 11, dark);
  const doors = new Map<string, THREE.Group>();
  initial.map.forEach((row, z) =>
    [...row].forEach((tile, x) => {
      if (tile === "#") {
        box(scene, x + 0.5, 1.15, z + 0.5, 1, 2.3, 1, wallMaterial);
        box(scene, x + 0.5, 0.12, z + 0.5, 1.012, 0.24, 1.012, dark);
        box(
          scene,
          x + 0.5,
          1.85,
          z + 0.5,
          1.014,
          0.035,
          1.014,
          (x + z) % 3 ? glow : hot,
        );
        box(scene, x + 0.5, 2.17, z + 0.5, 1.012, 0.22, 1.012, dark);
      }
      if (tile === "D") {
        const door = new THREE.Group();
        door.position.set(x + 0.5, 0, z + 0.5);
        scene.add(door);
        doors.set(`${x},${z}`, door);
        box(door, 0, 1.12, 0, 0.96, 2.24, 0.96, pink);
        box(door, 0, 1.15, -0.49, 0.05, 2.1, 0.02, hot);
        box(door, 0, 1.15, 0.49, 0.05, 2.1, 0.02, hot);
        box(door, -0.49, 1.15, 0, 0.02, 2.1, 0.05, hot);
        box(door, 0.49, 1.15, 0, 0.02, 2.1, 0.05, hot);
        for (const side of [-1, 1])
          box(door, 0.5 * side, 0.95, 0, 0.02, 0.15, 0.3, gold);
      }
    }),
  );
  // Physical ceiling strips: original procedural assets, no external models/textures.
  for (const x of [2.5, 5.5, 9.5, 12.5])
    for (const z of [2.5, 5.5, 8.5])
      box(scene, x, 2.31, z, 0.12, 0.025, 0.65, glow);
  const enemies = new Map<string, THREE.Group>();
  initial.enemies.forEach((enemy) => {
    const bot = new THREE.Group();
    scene.add(bot);
    enemies.set(enemy.id, bot);
    box(bot, 0, 0.65, 0, 0.62, 0.7, 0.4, pink);
    box(bot, 0, 1.13, 0, 0.57, 0.4, 0.44, steel);
    box(bot, -0.13, 1.17, 0.231, 0.09, 0.11, 0.025, hot);
    box(bot, 0.13, 1.17, 0.231, 0.09, 0.11, 0.025, hot);
    box(bot, 0, 1.42, 0, 0.04, 0.18, 0.04, steel);
    const antenna = new THREE.Mesh(new THREE.SphereGeometry(0.065, 8, 6), hot);
    antenna.position.set(0, 1.53, 0);
    bot.add(antenna);
    const shadow = new THREE.Mesh(
      new THREE.CircleGeometry(0.45, 16),
      new THREE.MeshBasicMaterial({
        color: 0x080c17,
        transparent: true,
        opacity: 0.45,
        depthWrite: false,
      }),
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    bot.add(shadow);
    box(bot, -0.19, 0.18, 0, 0.2, 0.35, 0.24, dark);
    box(bot, 0.19, 0.18, 0, 0.2, 0.35, 0.24, dark);
    box(bot, -0.42, 0.63, 0, 0.16, 0.55, 0.23, steel);
    box(bot, 0.42, 0.63, 0, 0.16, 0.55, 0.23, steel);
    box(bot, 0, 0.67, 0.21, 0.18, 0.18, 0.04, hot);
    bot.position.set(enemy.x, 0, enemy.y);
  });
  const items = new Map<string, THREE.Group>();
  initial.items.forEach((item) => {
    const group = new THREE.Group();
    group.position.set(item.x, 0.25, item.y);
    scene.add(group);
    items.set(item.id, group);
    box(group, 0, 0, 0, 0.32, 0.3, 0.32, steel);
    const mat = item.kind === "health" ? green : gold;
    for (const side of [-1, 1]) {
      box(group, 0, 0, 0.17 * side, 0.22, 0.06, 0.015, mat);
      box(group, 0, 0, 0.17 * side, 0.06, 0.22, 0.015, mat);
    }
    box(group, 0, 0.17, 0, 0.22, 0.015, 0.22, mat);
  });
  const gun = new THREE.Group();
  camera.add(gun);
  box(gun, 0.17, -0.22, -0.43, 0.17, 0.15, 0.4, steel);
  box(gun, 0.17, -0.3, -0.29, 0.1, 0.22, 0.1, dark);
  box(gun, 0.17, -0.13, -0.48, 0.09, 0.025, 0.26, pink);
  box(gun, 0.17, -0.11, -0.58, 0.025, 0.035, 0.025, glow);
  const muzzle = box(gun, 0.17, -0.21, -0.68, 0.2, 0.2, 0.12, gold);
  muzzle.visible = false;
  const shotLight = new THREE.PointLight(0xffcf7a, 0, 4);
  camera.add(shotLight);
  let state = initial,
    shownAngle = initial.player.angle,
    shotUntil = 0,
    lastShots = initial.shots;
  camera.position.set(initial.player.x, 0.82, initial.player.y);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
  let disposed = false,
    lastTime = 0,
    needsRender = true,
    renderUntil = performance.now() + 350;
  const draw = (now: number) => {
    if (disposed || document.hidden || (!needsRender && now > renderUntil))
      return;
    if (software && now >= lastTime && now - lastTime < 1000 / 24) return;
    const delta = Math.min(0.05, (now - (lastTime || now)) / 1000);
    lastTime = now;
    const settled = now >= renderUntil;
    const mix = reduced.matches || settled ? 1 : Math.min(1, delta * 22);
    needsRender = !settled;
    camera.position.x += (state.player.x - camera.position.x) * mix;
    camera.position.z += (state.player.y - camera.position.z) * mix;
    shownAngle += angleDifference(state.player.angle, shownAngle) * mix;
    camera.lookAt(
      camera.position.x + Math.cos(shownAngle),
      0.82,
      camera.position.z + Math.sin(shownAngle),
    );
    for (const enemy of state.enemies) {
      const bot = enemies.get(enemy.id)!;
      bot.visible = enemy.health > 0;
      bot.position.x += (enemy.x - bot.position.x) * mix;
      bot.position.z += (enemy.y - bot.position.z) * mix;
      bot.rotation.y = Math.atan2(
        state.player.x - enemy.x,
        state.player.y - enemy.y,
      );
    }
    for (const item of state.items) {
      const mesh = items.get(item.id)!;
      mesh.visible = !item.collected;
      mesh.rotation.y = reduced.matches ? 0 : state.tick * 0.12;
    }
    for (const [key, door] of doors) {
      const [x, z] = key.split(",").map(Number);
      door.visible = state.map[z][x] === "D";
    }
    const shooting = now < shotUntil;
    muzzle.visible = shooting;
    shotLight.intensity = shooting ? 4 : 0;
    gun.position.z = shooting && !reduced.matches ? 0.055 : 0;
    renderer.render(scene, camera);
    canvas.dataset.rendered = "true";
    canvas.dataset.tick = String(state.tick);
    canvas.dataset.angle = String(state.player.angle);
  };
  const resize = () => {
    const width = Math.max(1, canvas.clientWidth),
      height = Math.max(1, canvas.clientHeight);
    renderer.setPixelRatio(
      renderPixelRatio(width, height, window.devicePixelRatio, software),
    );
    renderer.setSize(width, height, false);
    renderUntil = performance.now() + 350;
    needsRender = true;
    camera.aspect = width / height;
    camera.fov = verticalFieldOfView(camera.aspect);
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  renderer.setAnimationLoop(draw);
  return {
    update(next: GameState) {
      needsRender = true;
      renderUntil = performance.now() + 350;
      if (next.tick < state.tick) {
        camera.position.set(next.player.x, 0.82, next.player.y);
        shownAngle = next.player.angle;
        shotUntil = 0;
      }
      if (next.shots > lastShots) shotUntil = performance.now() + 95;
      lastShots = next.shots;
      state = next;
    },
    dispose() {
      disposed = true;
      observer.disconnect();
      renderer.setAnimationLoop(null);
      const geometries = new Set<THREE.BufferGeometry>(),
        materials = new Set<THREE.Material>();
      scene.traverse((object) => {
        if (object instanceof THREE.Mesh) {
          geometries.add(object.geometry);
          for (const material of Array.isArray(object.material)
            ? object.material
            : [object.material])
            materials.add(material);
        }
      });
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      floorTexture.dispose();
      wallTexture.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
