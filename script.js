
import * as THREE from 'three';

// =============================================
// AVENTURE — DAVI E YAN
// Cidade noturna e dimensão exclusiva do chefão
// =============================================

const game = document.getElementById('game');
const loading = document.getElementById('loading');
const startScreen = document.getElementById('startScreen');
const endScreen = document.getElementById('endScreen');
const message = document.getElementById('message');

let scene, camera, renderer, clock, world;
let running = false;
let finished = false;
let active = 0;
let scrollCount = 0;
let yaw = 0;
let pitch = 0.22;
let elapsed = 0;
let attackCooldown = 0;
let messageTimer = 0;
let currentMap = 'city';

const keys = {};
const obstacles = [];
const enemies = [];
const scrolls = [];
const cityObjects = [];
const bossObjects = [];

const brothers = [
  {
    name: 'Davi',
    color: 0x347fc0,
    hp: 100,
    maxHp: 100,
    damage: 38,
    speed: 7.2,
    x: 0,
    z: 4,
    group: null
  },
  {
    name: 'Yan',
    color: 0xd7a343,
    hp: 100,
    maxHp: 100,
    damage: 30,
    speed: 8.2,
    x: 1.5,
    z: 4,
    group: null
  }
];

const hero = () => brothers[active];

function mat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.86,
    ...extra
  });
}

function mesh(geometry, material, parent, x = 0, y = 0, z = 0) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(x, y, z);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

function box(parent, w, h, d, material, x, y, z) {
  return mesh(
    new THREE.BoxGeometry(w, h, d),
    material,
    parent,
    x, y, z
  );
}

function sphere(parent, radius, material, x, y, z) {
  return mesh(
    new THREE.SphereGeometry(radius, 12, 10),
    material,
    parent,
    x, y, z
  );
}

// =============================================
// NOMES FLUTUANTES
// =============================================

function label(text, color = '#ffe5a2') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;

  const ctx = canvas.getContext('2d');
  ctx.fillStyle = 'rgba(7,10,20,.8)';
  ctx.fillRect(25, 15, 462, 98);

  ctx.font = 'bold 40px Arial';
  ctx.textAlign = 'center';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 77);

  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(canvas),
      transparent: true,
      depthTest: false
    })
  );

  sprite.scale.set(4, 1, 1);
  return sprite;
}

// =============================================
// PERSONAGENS 3D
// =============================================

function createCharacter(color, enemy = false) {
  const group = new THREE.Group();

  const clothes = mat(color);
  const pants = mat(0x252b3a);
  const skin = mat(enemy ? 0x85504b : 0xd6a17c);
  const hair = mat(0x29202a);
  const leather = mat(0x493a35);
  const eyes = mat(0x15131a);

  // Pernas e botas
  box(group, 0.27, 0.55, 0.3, pants, -0.18, 0.35, 0);
  box(group, 0.27, 0.55, 0.3, pants, 0.18, 0.35, 0);

  box(group, 0.32, 0.16, 0.4, leather, -0.18, 0.1, 0.05);
  box(group, 0.32, 0.16, 0.4, leather, 0.18, 0.1, 0.05);

  // Corpo e cabeça
  box(group, 0.8, 0.8, 0.44, clothes, 0, 0.98, 0);
  box(group, 0.82, 0.12, 0.47, leather, 0, 0.72, 0);

  sphere(group, 0.29, skin, 0, 1.72, 0);
  sphere(group, 0.29, hair, 0, 1.89, -0.025);

  box(group, 0.5, 0.13, 0.43, hair, 0, 1.89, 0.08);

  box(group, 0.055, 0.055, 0.035, eyes, -0.105, 1.73, 0.27);
  box(group, 0.055, 0.055, 0.035, eyes, 0.105, 1.73, 0.27);

  // Braços articulados
  const armL = new THREE.Group();
  armL.position.set(-0.48, 1.25, 0);
  group.add(armL);

  box(armL, 0.23, 0.56, 0.25, clothes, 0, -0.19, 0);

  const armR = new THREE.Group();
  armR.position.set(0.48, 1.25, 0);
  group.add(armR);

  box(armR, 0.23, 0.56, 0.25, clothes, 0, -0.19, 0);

  // Espada
  const sword = new THREE.Group();
  sword.position.set(0.53, 0.8, 0);
  group.add(sword);

  box(sword, 0.09, 0.14, 0.12, mat(0xd7ad53), 0, 0, 0);
  box(
    sword, 0.055, 0.8, 0.075,
    mat(0xdce7ed, { metalness: 0.6 }),
    0, 0.44, 0
  );

  box(sword, 0.32, 0.07, 0.1, mat(0xd7ad53), 0, 0.1, 0);
  sword.rotation.z = -0.3;

  group.userData = { armL, armR, sword };

  return group;
}

// =============================================
// CIDADE NOTURNA — PRÉDIOS E RUAS
// =============================================

function addBuilding(x, z, w, h, d, seed = 0) {
  const building = new THREE.Group();
  building.position.set(x, 0, z);
  world.add(building);
  cityObjects.push(building);

  const colors = [
    0x252b3c, 0x34364a, 0x3a3e4d,
    0x282f40, 0x48404b
  ];

  box(
    building, w, h, d,
    mat(colors[seed % colors.length]),
    0, h / 2, 0
  );

  box(
    building, w + 0.2, 0.25, d + 0.2,
    mat(0x171b29), 0, h, 0
  );

  const windows = [
    mat(0xffd985, {
      emissive: 0xffa52f,
      emissiveIntensity: 1.3
    }),
    mat(0x8bd9ff, {
      emissive: 0x2288bb,
      emissiveIntensity: 0.8
    })
  ];

  const floors = Math.max(2, Math.floor(h / 2.6));
  const columns = Math.max(2, Math.floor(w / 1.7));

  for (let floor = 0; floor < floors; floor++) {
    for (let col = 0; col < columns; col++) {
      if (Math.random() < 0.18) continue;

      const wx = -w / 2 + 0.8 +
        col * ((w - 1.2) / Math.max(1, columns - 1));

      const wy = 1.1 + floor * 2.25;
      const windowMaterial = windows[Math.random() < 0.7 ? 0 : 1];

      box(
        building, 0.42, 0.72, 0.06,
        windowMaterial, wx, wy, d / 2 + 0.04
      );

      box(
        building, 0.06, 0.72, 0.05,
        mat(0x171b29), wx, wy, d / 2 + 0.08
      );
    }

    for (let col = 0; col < Math.max(2, Math.floor(w / 2)); col++) {
      if (Math.random() < 0.3) continue;

      const count = Math.max(2, Math.floor(w / 2));
      const wx = -w / 2 + 0.8 +
        col * ((w - 1.2) / Math.max(1, count - 1));

      box(
        building, 0.42, 0.72, 0.06,
        windows[Math.random() < 0.75 ? 0 : 1],
        wx, 1.1 + floor * 2.25, -d / 2 - 0.04
      );
    }
  }

  // Colisão do edifício
  obstacles.push({
    x, z,
    r: Math.max(w, d) * 0.52
  });
}

function addStreetLamp(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  world.add(group);
  cityObjects.push(group);

  const metal = mat(0x202735, { metalness: 0.5 });

  mesh(
    new THREE.CylinderGeometry(0.09, 0.14, 4, 8),
    metal, group, 0, 2, 0
  );

  box(group, 0.7, 0.1, 0.1, metal, 0.25, 3.8, 0);

  sphere(
    group, 0.16,
    mat(0xffd98a, {
      emissive: 0xffb52e,
      emissiveIntensity: 2
    }),
    0.55, 3.65, 0
  );

  const light = new THREE.PointLight(0xffc66b, 10, 13);
  light.position.set(0.55, 3.5, 0);
  group.add(light);
}

function createTree(x, z, scale = 1) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.scale.setScalar(scale);
  world.add(group);
  cityObjects.push(group);

  mesh(
    new THREE.CylinderGeometry(0.22, 0.35, 2.1, 7),
    mat(0x382c2b), group, 0, 1.05, 0
  );

  sphere(group, 1.05, mat(0x142b2a), 0, 2.5, 0);
  sphere(group, 0.8, mat(0x1c3b35), 0.35, 2.9, 0.1);

  obstacles.push({ x, z, r: 0.8 * scale });
}

function createRuins(x, z) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  world.add(group);
  cityObjects.push(group);

  const stone = mat(0x55596a);

  box(group, 10, 0.5, 1.5, stone, 0, 0.25, -3);
  box(group, 10, 0.5, 1.5, stone, 0, 0.25, 3);

  for (const side of [-1, 1]) {
    for (const p of [-3, 0, 3]) {
      box(group, 1, 3.5, 1, stone, side * 4, 1.75, p);
    }
  }

  obstacles.push(
    { x: x - 4, z, r: 0.7 },
    { x: x + 4, z, r: 0.7 }
  );
}

// =============================================
// PERGAMINHOS
// =============================================

function createScroll(x, z, index) {
  const group = new THREE.Group();
  group.position.set(x, 1, z);

  mesh(
    new THREE.CylinderGeometry(0.12, 0.12, 0.85, 12),
    mat(0xf2d48a), group
  );

  mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.13, 12),
    mat(0xd7ad53), group, 0, 0.45, 0
  );

  mesh(
    new THREE.CylinderGeometry(0.14, 0.14, 0.13, 12),
    mat(0xd7ad53), group, 0, -0.45, 0
  );

  const glow = new THREE.PointLight(0xffcf66, 2.5, 8);
  glow.position.y = 0.4;
  group.add(glow);

  const ring = mesh(
    new THREE.TorusGeometry(0.65, 0.04, 8, 24),
    mat(0xffd36e, {
      emissive: 0x9d5a10,
      emissiveIntensity: 0.7
    }),
    group, 0, -0.7, 0
  );

  ring.rotation.x = Math.PI / 2;

  world.add(group);
  scrolls.push({ group, x, z, index, found: false });
}

// =============================================
// INIMIGOS E CHEFÃO
// =============================================

function createEnemy(x, z, boss = false) {
  const enemy = {
    x, z,
    hp: boss ? 600 : 55,
    maxHp: boss ? 600 : 55,
    speed: boss ? 3 : 2.1 + Math.random() * 1.3,
    damage: boss ? 18 : 6 + Math.floor(Math.random() * 5),
    boss,
    alive: true,
    cooldown: Math.random(),
    group: null
  };

  enemy.group = createCharacter(
    boss
      ? 0x682a87
      : Math.random() < 0.5 ? 0x9a293c : 0x4c5267,
    true
  );

  if (boss) {
    enemy.group.scale.setScalar(2.1);
  }

  enemy.group.position.set(x, 0, z);

  const tag = label(
    boss ? 'SENHOR DAS SOMBRAS' : 'INIMIGO',
    boss ? '#e0a3ff' : '#ff9da9'
  );

  tag.position.y = boss ? 5 : 2.7;
  enemy.group.add(tag);

  world.add(enemy.group);
  enemies.push(enemy);
}

// =============================================
// MAPA 1: CIDADE NOTURNA
// =============================================

function createCityMap() {
  currentMap = 'city';

  scene.background = new THREE.Color(0x070b1a);
  scene.fog = new THREE.Fog(0x070b1a, 35, 105);

  const ground = mesh(
    new THREE.PlaneGeometry(180, 180),
    mat(0x202633), world, 0, -0.1, 0
  );

  ground.rotation.x = -Math.PI / 2;
  cityObjects.push(ground);

  const road = mesh(
    new THREE.PlaneGeometry(18, 175),
    mat(0x10151f), world, 0, -0.04, 0
  );

  road.rotation.x = -Math.PI / 2;
  cityObjects.push(road);

  const crossRoad = mesh(
    new THREE.PlaneGeometry(175, 15),
    mat(0x10151f), world, 0, -0.035, 14
  );

  crossRoad.rotation.x = -Math.PI / 2;
  cityObjects.push(crossRoad);

  const sidewalkMaterial = mat(0x414552);

  for (const x of [-11, 11]) {
    const sidewalk = mesh(
      new THREE.PlaneGeometry(3, 175),
      sidewalkMaterial, world, x, -0.02, 0
    );

    sidewalk.rotation.x = -Math.PI / 2;
    cityObjects.push(sidewalk);
  }

  // Prédios distribuídos pelos quarteirões
  const buildings = [
    [-25, -25], [-42, -18], [-27, 3],
    [-42, 22], [-26, 39],
    [25, -28], [43, -25], [27, -5],
    [44, 8], [28, 36], [45, 40],
    [-70, -45], [-70, -10], [-70, 28],
    [70, -43], [70, -5], [70, 30]
  ];

  buildings.forEach((position, i) => {
    addBuilding(
      position[0],
      position[1],
      7 + Math.random() * 5,
      9 + Math.random() * 19,
      7 + Math.random() * 6,
      i
    );
  });

  for (let i = 0; i < 24; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) *
      (14 + Math.random() * 70);

    const z = -78 + Math.random() * 150;

    if (Math.abs(z) < 9) continue;
    addStreetLamp(x, z);
  }

  for (let i = 0; i < 18; i++) {
    const x = (Math.random() < 0.5 ? -1 : 1) *
      (15 + Math.random() * 65);

    const z = -75 + Math.random() * 150;

    if (Math.abs(z) < 12) continue;
    createTree(x, z, 0.7 + Math.random() * 0.5);
  }

  createRuins(-30, 48);

  // Portal roxo na extremidade da cidade
  const portal = new THREE.Group();
  portal.position.set(0, 0, -78);
  world.add(portal);
  cityObjects.push(portal);

  const ring = mesh(
    new THREE.TorusGeometry(3, 0.25, 12, 40),
    mat(0x9d56ff, {
      emissive: 0x681eff,
      emissiveIntensity: 2
    }),
    portal, 0, 3.2, 0
  );

  ring.rotation.y = Math.PI / 2;

  box(portal, 0.4, 6.5, 0.5, mat(0x44415b), -3, 3.2, 0);
  box(portal, 0.4, 6.5, 0.5, mat(0x44415b), 3, 3.2, 0);

  const portalLight = new THREE.PointLight(0x9d56ff, 35, 20);
  portalLight.position.set(0, 3.2, 0);
  portal.add(portalLight);

  // 54 inimigos espalhados pela cidade
  for (let i = 0; i < 54; i++) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const x = side * (12 + Math.random() * 55);
    let z = -68 + Math.random() * 135;

    if (Math.abs(z) < 7) z += 15;

    createEnemy(x, z);
  }

  // Cinco pergaminhos
  createScroll(-32, -12, 0);
  createScroll(36, -42, 1);
  createScroll(-61, 20, 2);
  createScroll(54, 28, 3);
  createScroll(0, 53, 4);

  document.getElementById('mapName').textContent = 'Cidade Noturna';
}

// =============================================
// MAPA 2: DIMENSÃO SOMBRIA DO CHEFÃO
// =============================================

function createBossMap() {
  currentMap = 'boss';

  scene.background = new THREE.Color(0x10071d);
  scene.fog = new THREE.Fog(0x10071d, 25, 90);

  const floor = mesh(
    new THREE.PlaneGeometry(110, 110),
    mat(0x21172d), world, 0, -0.1, 0
  );

  floor.rotation.x = -Math.PI / 2;
  bossObjects.push(floor);

  // Grande arena circular
  const platform = mesh(
    new THREE.CylinderGeometry(25, 27, 1.5, 12),
    mat(0x373047), world, 0, 0, 0
  );

  bossObjects.push(platform);

  // Pilares e cristais roxos
  for (let i = 0; i < 18; i++) {
    const angle = i * Math.PI * 2 / 18;
    const x = Math.cos(angle) * 34;
    const z = Math.sin(angle) * 34;

    const pillar = mesh(
      new THREE.CylinderGeometry(
        0.8, 1.3, 5 + Math.random() * 4, 6
      ),
      mat(0x4a3b58), world, x, 2.5, z
    );

    bossObjects.push(pillar);

    const crystal = mesh(
      new THREE.OctahedronGeometry(0.8),
      mat(0xa94cff, {
        emissive: 0x7020ff,
        emissiveIntensity: 1.5
      }),
      world, x, 5.4, z
    );

    bossObjects.push(crystal);

    const light = new THREE.PointLight(0x7a26ff, 4, 12);
    light.position.set(x, 4, z);
    world.add(light);
    bossObjects.push(light);
  }

  // Fendas mágicas no chão
  for (let i = 0; i < 12; i++) {
    const crack = mesh(
      new THREE.BoxGeometry(0.12, 0.03, Math.random() * 9 + 3),
      mat(0x9e39ff, {
        emissive: 0x6d16ff,
        emissiveIntensity: 2
      }),
      world,
      (Math.random() - 0.5) * 38,
      0.8,
      (Math.random() - 0.5) * 38
    );

    crack.rotation.y = Math.random() * Math.PI;
    bossObjects.push(crack);
  }

  const magicLight = new THREE.PointLight(0x9b65ff, 45, 70);
  magicLight.position.set(0, 22, 0);
  world.add(magicLight);
  bossObjects.push(magicLight);

  // O chefão aparece somente neste mapa
  createEnemy(0, 0, true);

  // Dez guardas da dimensão
  for (let i = 0; i < 10; i++) {
    const angle = i * Math.PI * 2 / 10;
    const radius = 14 + Math.random() * 9;

    createEnemy(
      Math.cos(angle) * radius,
      Math.sin(angle) * radius
    );
  }

  brothers.forEach((p, i) => {
    p.x = i ? 1.5 : -1.5;
    p.z = 20;
    p.group.position.set(p.x, 0, p.z);
  });

  document.getElementById('mapName').textContent = 'Dimensão Sombria';

  yaw = Math.PI;
  pitch = 0.25;

  notify('DIMENSÃO SOMBRIA: derrote o Senhor das Sombras!');
}

// =============================================
// TROCA DE MAPA
// =============================================

function clearMap() {
  for (const object of [...cityObjects, ...bossObjects]) {
    world.remove(object);
  }

  cityObjects.length = 0;
  bossObjects.length = 0;

  for (const enemy of enemies) {
    world.remove(enemy.group);
  }

  enemies.length = 0;

  for (const scroll of scrolls) {
    world.remove(scroll.group);
  }

  scrolls.length = 0;
  obstacles.length = 0;
}

function enterBossMap() {
  if (currentMap !== 'city') return;

  if (scrollCount < 5) {
    notify(`Portal selado! Faltam ${5 - scrollCount} pergaminho(s).`);
    return;
  }

  clearMap();
  createBossMap();
  updateHUD();
}

function returnCityMap() {
  clearMap();
  createCityMap();

  brothers.forEach((p, i) => {
    p.x = i ? 1.5 : 0;
    p.z = 4;
    p.group.position.set(p.x, 0, p.z);
  });

  yaw = 0;
  updateHUD();
}

// =============================================
// INTERFACE E MOVIMENTAÇÃO
// =============================================

function updateHUD() {
  const p = hero();

  document.getElementById('heroName').textContent = p.name;
  document.getElementById('health').textContent =
    `${Math.ceil(p.hp)} / ${p.maxHp}`;

  document.getElementById('healthBar').style.width =
    `${Math.max(0, p.hp / p.maxHp * 100)}%`;

  document.getElementById('scrolls').textContent =
    `${scrollCount} / 5`;
}

function notify(text) {
  message.textContent = text;
  messageTimer = 3.5;
}

function distance(a, b) {
  return Math.hypot(a.x - b.x, a.z - b.z);
}

function blocked(x, z, radius = 0.6) {
  if (Math.abs(x) > 87 || Math.abs(z) > 87) {
    return true;
  }

  return obstacles.some(o =>
    Math.hypot(x - o.x, z - o.z) < radius + o.r
  );
}

function moveEntity(entity, dx, dz, radius = 0.6) {
  if (!blocked(entity.x + dx, entity.z, radius)) {
    entity.x += dx;
  }

  if (!blocked(entity.x, entity.z + dz, radius)) {
    entity.z += dz;
  }

  if (entity.group) {
    entity.group.position.set(entity.x, 0, entity.z);
  }
}

function switchBrother() {
  if (!running || finished) return;

  active = 1 - active;
  notify(`Agora você controla ${hero().name}!`);
  updateHUD();
}

// =============================================
// COLETAR PERGAMINHOS E USAR PORTAIS
// =============================================

function collectOrPortal() {
  if (!running || finished) return;

  const p = hero();

  const scroll = scrolls.find(s =>
    !s.found && distance(p, s) < 3.5
  );

  if (scroll) {
    scroll.found = true;
    scrollCount++;

    world.remove(scroll.group);

    notify(`Pergaminho encontrado! ${scrollCount}/5`);

    if (scrollCount === 5) {
      notify('Todos encontrados! Vá ao portal roxo e aperte E.');
    }

    updateHUD();
    return;
  }

  if (
    currentMap === 'city' &&
    Math.hypot(p.x, p.z + 78) < 7
  ) {
    enterBossMap();
    return;
  }

  if (
    currentMap === 'boss' &&
    Math.hypot(p.x, p.z - 42) < 6
  ) {
    returnCityMap();
    return;
  }

  notify('Procure um pergaminho ou aproxime-se do portal.');
}

// =============================================
// COMBATE
// =============================================

function attack() {
  if (!running || finished || attackCooldown > 0) return;

  attackCooldown = 0.48;

  const p = hero();
  let target = null;
  let nearest = 4;

  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    const d = distance(p, enemy);

    if (d < nearest) {
      nearest = d;
      target = enemy;
    }
  }

  p.group.userData.armR.rotation.x = -1;

  if (!target) {
    notify('Nenhum inimigo ao alcance!');
    return;
  }

  target.hp -= p.damage;

  if (target.hp <= 0) {
    target.alive = false;
    world.remove(target.group);

    if (target.boss) {
      finish(true);
      return;
    }

    p.hp = Math.min(p.maxHp, p.hp + 5);
    notify('Inimigo derrotado! +5 de vida.');
  } else {
    notify(`${p.name} causou ${p.damage} de dano!`);
  }

  updateHUD();
}

// =============================================
// CÂMERA
// =============================================

function updateCamera(dt) {
  const p = hero();

  const target = new THREE.Vector3(p.x, 1.3, p.z);

  const offset = new THREE.Vector3(
    Math.sin(yaw) * 10,
    4.5 + pitch * 3,
    Math.cos(yaw) * 10
  );

  camera.position.lerp(
    target.clone().add(offset),
    1 - Math.exp(-6 * dt)
  );

  camera.lookAt(target);
}

// =============================================
// VITÓRIA E DERROTA
// =============================================

function finish(win) {
  running = false;
  finished = true;

  document.getElementById('endTitle').textContent =
    win ? 'VITÓRIA!' : 'FIM DA AVENTURA';

  document.getElementById('endText').textContent = win
    ? 'Davi e Yan derrotaram o Senhor das Sombras e salvaram a cidade!'
    : 'Os irmãos foram derrotados. Tente novamente!';

  endScreen.classList.remove('hidden');
}

// =============================================
// REINICIAR
// =============================================

function resetGame() {
  scrollCount = 0;
  active = 0;
  elapsed = 0;
  finished = false;
  attackCooldown = 0;

  clearMap();

  brothers.forEach((p, i) => {
    p.hp = 100;
    p.x = i * 1.5;
    p.z = 4;
    p.group.position.set(p.x, 0, p.z);
  });

  createCityMap();
  updateHUD();
}

// =============================================
// ATUALIZAÇÃO DO MUNDO
// =============================================

function update(dt) {
  if (!running || finished) return;

  elapsed += dt;
  attackCooldown = Math.max(0, attackCooldown - dt);
  messageTimer = Math.max(0, messageTimer - dt);

  if (messageTimer === 0) {
    message.textContent = currentMap === 'boss'
      ? 'Dimensão Sombria • Derrote o chefão'
      : `Cidade Noturna • Pergaminhos: ${scrollCount}/5`;
  }

  const p = hero();

  let forward = 0;
  let sideways = 0;

  if (keys.w || keys.arrowup) forward++;
  if (keys.s || keys.arrowdown) forward--;
  if (keys.a || keys.arrowleft) sideways--;
  if (keys.d || keys.arrowright) sideways++;

  if (forward || sideways) {
    const length = Math.hypot(forward, sideways);

    forward /= length;
    sideways /= length;

    const dx =
      Math.sin(yaw) * forward +
      Math.cos(yaw) * sideways;

    const dz =
      Math.cos(yaw) * forward -
      Math.sin(yaw) * sideways;

    const speed = p.speed * (keys.shift ? 1.5 : 1);

    moveEntity(p, dx * speed * dt, dz * speed * dt);

    p.group.rotation.y = Math.atan2(dx, dz);

    p.group.userData.armL.rotation.x =
      Math.sin(elapsed * 10) * 0.25;

    p.group.userData.armR.rotation.x =
      -Math.sin(elapsed * 10) * 0.25;
  }

  // O irmão acompanha o jogador
  const companion = brothers[1 - active];

  if (distance(companion, p) > 2.5) {
    const angle = Math.atan2(
      p.x - companion.x,
      p.z - companion.z
    );

    moveEntity(
      companion,
      Math.sin(angle) * 4 * dt,
      Math.cos(angle) * 4 * dt
    );

    companion.group.rotation.y = angle;
  }

  // IA dos inimigos
  for (const enemy of enemies) {
    if (!enemy.alive) continue;

    enemy.cooldown -= dt;

    const target =
      distance(enemy, p) < distance(enemy, companion)
        ? p
        : companion;

    const d = distance(enemy, target);

    if (d < 30 && d > 1.6) {
      moveEntity(
        enemy,
        (target.x - enemy.x) / d * enemy.speed * dt,
        (target.z - enemy.z) / d * enemy.speed * dt,
        enemy.boss ? 1.5 : 0.6
      );

      enemy.group.rotation.y = Math.atan2(
        target.x - enemy.x,
        target.z - enemy.z
      );
    }

    if (d < (enemy.boss ? 3.3 : 1.8) && enemy.cooldown <= 0) {
      target.hp = Math.max(0, target.hp - enemy.damage);
      enemy.cooldown = enemy.boss ? 0.9 : 1.15;

      notify(
        `${enemy.boss ? 'O chefão' : 'Um inimigo'} atingiu ${target.name}!`
      );

      updateHUD();

      if (target.hp <= 0) {
        finish(false);
        return;
      }
    }
  }

  // Animação dos pergaminhos
  for (const scroll of scrolls) {
    if (!scroll.found) {
      scroll.group.position.y =
        1 + Math.sin(elapsed * 2 + scroll.index) * 0.22;

      scroll.group.rotation.y += dt * 0.7;
    }
  }

  updateCamera(dt);
  updateHUD();
}

// =============================================
// LOOP DO JOGO
// =============================================

function animate() {
  requestAnimationFrame(animate);

  const dt = Math.min(clock.getDelta(), 0.05);

  update(dt);
  renderer.render(scene, camera);
}

// =============================================
// INICIALIZAÇÃO DO THREE.JS
// =============================================

function init() {
  scene = new THREE.Scene();

  scene.background = new THREE.Color(0x070b1a);
  scene.fog = new THREE.Fog(0x070b1a, 35, 105);

  camera = new THREE.PerspectiveCamera(
    65,
    game.clientWidth / game.clientHeight,
    0.1,
    300
  );

  renderer = new THREE.WebGLRenderer({
    antialias: true
  });

  renderer.setPixelRatio(
    Math.min(window.devicePixelRatio, 1.5)
  );

  renderer.setSize(game.clientWidth, game.clientHeight);

  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  game.prepend(renderer.domElement);

  scene.add(
    new THREE.HemisphereLight(0x9da9ff, 0x171222, 1.5)
  );

  const moon = new THREE.DirectionalLight(0x9bb5ff, 1.6);
  moon.position.set(-30, 45, 20);
  moon.castShadow = true;
  moon.shadow.mapSize.set(1024, 1024);
  scene.add(moon);

  world = new THREE.Group();
  scene.add(world);

  brothers.forEach(p => {
    p.group = createCharacter(p.color);

    const nameTag = label(p.name);
    nameTag.position.y = 2.7;

    p.group.add(nameTag);
    world.add(p.group);
  });

  resetGame();

  clock = new THREE.Clock();

  loading.classList.add('done');

  updateCamera(1);
  animate();
}

// =============================================
// CONTROLES DO JOGADOR
// =============================================

window.addEventListener('keydown', event => {
  const key = event.key.toLowerCase();

  if (
    ['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' ']
      .includes(key)
  ) {
    event.preventDefault();
  }

  keys[key] = true;

  if (event.repeat) return;

  if (key === 'q') switchBrother();
  if (key === 'e') collectOrPortal();
  if (key === ' ') attack();
});

window.addEventListener('keyup', event => {
  keys[event.key.toLowerCase()] = false;
});

// Mouse para controlar a câmera
let mouseDown = false;
let lastX = 0;
let lastY = 0;

game.addEventListener('mousedown', event => {
  if (event.button !== 0) return;

  mouseDown = true;
  lastX = event.clientX;
  lastY = event.clientY;
});

window.addEventListener('mouseup', () => {
  mouseDown = false;
});

window.addEventListener('mousemove', event => {
  if (!mouseDown || !running) return;

  yaw -= (event.clientX - lastX) * 0.006;

  pitch = THREE.MathUtils.clamp(
    pitch - (event.clientY - lastY) * 0.003,
    -0.1,
    0.8
  );

  lastX = event.clientX;
  lastY = event.clientY;
});

// =============================================
// BOTÕES E REDIMENSIONAMENTO
// =============================================

document.getElementById('startButton').addEventListener('click', () => {
  startScreen.classList.add('hidden');
  running = true;
  notify('A aventura começou! Sobreviva à cidade noturna.');
});

document.getElementById('restartButton').addEventListener('click', () => {
  endScreen.classList.add('hidden');
  resetGame();
  running = true;
  notify('Nova aventura iniciada!');
});

window.addEventListener('resize', () => {
  if (!renderer || !camera) return;

  camera.aspect = game.clientWidth / game.clientHeight;
  camera.updateProjectionMatrix();

  renderer.setSize(game.clientWidth, game.clientHeight);
});

// =============================================
// TRATAMENTO DE ERROS
// =============================================

try {
  init();
} catch (error) {
  console.error('Erro ao iniciar AVENTURE:', error);

  loading.classList.add('done');

  const errorBox = document.getElementById('errorBox');
  errorBox.classList.remove('hidden');

  document.getElementById('errorText').textContent =
    'Erro: ' + error.message +
    '. Confira a conexão e abra pelo Live Server.';
}
