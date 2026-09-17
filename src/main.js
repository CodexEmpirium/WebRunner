async function main() {
const { Application, Container, Graphics, Matrix, Rectangle, Sprite, Texture } = globalThis.PIXI;
const levelId = Number(document.body.dataset.level || 1);
const availableLevels = [0, 1];
const meter = 48;
const tile = 64;
const minPitch = Math.PI / 9;
const maxPitch = Math.PI * 7 / 18;

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  yaw: Math.PI / 4,
  pitch: Math.PI / 4,
  projectionY: Math.sin(Math.PI / 4),
  zoom: 1,
  fade: new URLSearchParams(window.location.search).get("fade") === "1" ? 1 : 0,
  transitioning: false,
  keys: new Set(),
  inventory: { coins: 0, health: 0, mana: 0, magic: 0, bombs: 3 },
  player: {
    x: 0,
    y: levelId === 1 ? 360 : 0,
    heading: levelId === 1 ? -Math.PI / 2 : 0,
    speed: 255,
    stride: 0,
    z: 0,
    floorZ: 0,
    vz: 0,
    jumpAge: 0,
    jumpArm: 0,
    grounded: true,
    stance: "stand",
    rollTime: 0,
    rollX: 0,
    rollY: -1,
    attackTime: 0,
    specialTime: 0,
    interactTime: 0,
    holdingBomb: false,
    bombThrowTime: 0,
    lastMoveX: 0,
    lastMoveY: -1
  }
};

const levels = {
  0: {
    name: "Level 0",
    kind: "infinite",
    bounds: [],
    torches: [],
    columns: [],
    waterPools: [],
    coins: [],
    potions: [],
    exit: null
  },
  1: {
    name: "Level 1",
    kind: "dungeon",
    bounds: [
      { x: -300, y: 140, w: 600, h: 460, name: "start" },
      { x: -56, y: 140 - 10 * meter, w: 112, h: 10 * meter, name: "corridor" },
      { x: -380, y: -920, w: 760, h: 580, name: "pool" }
    ],
    platformHeight: 112,
    upperPlatform: { x: -340, y: -910, w: 690, h: 104 },
    exit: { x: 292, y: -910, w: 62, h: 42 },
    waterPools: [
      { x: -248, y: -825, w: 112, h: 420 },
      { x: 155, y: -825, w: 170, h: 420 }
    ],
    coins: [
      { x: -220, y: -770, collected: false },
      { x: -200, y: -665, collected: false },
      { x: -180, y: -500, collected: false },
      { x: 185, y: -742, collected: false },
      { x: 235, y: -610, collected: false },
      { x: 285, y: -455, collected: false }
    ],
    potions: [
      { x: -26, y: -612, type: "health", color: 0x38dd78, glow: 0x36e07d, collected: false },
      { x: 28, y: -612, type: "mana", color: 0x9b58ff, glow: 0xa058ff, collected: false }
    ],
    columns: [
      { x: -150, y: -780 },
      { x: 0, y: -780 },
      { x: 150, y: -780 },
      { x: -150, y: -535 },
      { x: 0, y: -535 },
      { x: 150, y: -535 }
    ],
    torches: [
      { x: -230, y: 140 },
      { x: 230, y: 140 },
      { x: -300, y: 390 },
      { x: 300, y: 390 },
      { x: -56, y: 40 },
      { x: 56, y: -80 },
      { x: -56, y: -210 },
      { x: -260, y: -340 },
      { x: 260, y: -340 },
      { x: -380, y: -655 },
      { x: 380, y: -655 }
    ]
  }
};

const level = levels[levelId] || levels[1];
const hud = buildHud(levelId);
const art = await loadArt();
const app = new Application();
await app.init({
  resizeTo: window,
  background: "#050403",
  antialias: true,
  preference: window.location.protocol === "file:" ? ["canvas"] : ["webgl", "canvas"]
});
document.getElementById("game").appendChild(app.canvas);

const world = new Container();
const overlay = new Graphics();
app.stage.addChild(world, overlay);

const floorLayer = new Container();
const g = new Graphics();
const actorLayer = new Container();
const actorShadow = new Graphics();
const actorSprite = new Sprite(art.action[0][0]);
const actorFx = new Graphics();
actorSprite.anchor.set(0.5, 0.9);
actorLayer.addChild(actorShadow, actorSprite, actorFx);
world.addChild(floorLayer, g, actorLayer);
let floorSpriteCount = 0;

async function loadArt() {
  const loadImage = (path) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load artwork: ${path}`));
    image.src = new URL(path, window.location.href).href;
  });
  const [runImage, actionImage, floorImage, wallImage] = await Promise.all([
    loadImage("./assets/art/rogue-run-sheet.png"),
    loadImage("./assets/art/rogue-action-sheet.png"),
    loadImage("./assets/art/dungeon-floor.png"),
    loadImage("./assets/art/dungeon-wall.png")
  ]);
  const sliceSheet = (image) => {
    const base = Texture.from(image);
    const cellWidth = Math.floor(image.naturalWidth / 4);
    const cellHeight = Math.floor(image.naturalHeight / 4);
    return Array.from({ length: 4 }, (_, row) => Array.from({ length: 4 }, (_, column) => new Texture({
      source: base.source,
      frame: new Rectangle(column * cellWidth, row * cellHeight, cellWidth, cellHeight)
    })));
  };
  const floor = Texture.from(floorImage);
  const wall = Texture.from(wallImage);
  floor.source.addressMode = "repeat";
  wall.source.addressMode = "repeat";
  return { run: sliceSheet(runImage), action: sliceSheet(actionImage), floor, wall };
}

function buildHud(currentLevel) {
  const root = document.createElement("div");
  root.className = "hud";
  root.innerHTML = `
    <div class="top-hud">
      <form class="level-jump" id="levelJump">
        <label for="levelInput">Go to Level</label>
        <input id="levelInput" type="number" inputmode="numeric" min="0" max="1" step="1" value="${currentLevel}">
        <button type="submit">Go</button>
      </form>
      <div class="inventory">
        <span>Coins <b id="coinCount">0</b></span>
        <span>Health <b id="healthCount">0</b></span>
        <span>Mana <b id="manaCount">0</b></span>
        <span>Magic <b id="magicCount">0</b></span>
        <span>Bombs <b id="bombCount">3</b></span>
      </div>
      <div class="status-line" id="statusLine">World mode</div>
    </div>
    <div class="item-menu hidden" id="itemMenu">
      <span>1 Health</span>
      <span>2 Mana</span>
      <span>3 Magic</span>
      <span>4 Bomb</span>
    </div>
    <div class="hint hint-left">
      <div class="keys">
        <div class="key key-up">&#9650;</div>
        <div class="key key-left">&#9664;</div>
        <div class="key key-down">&#9660;</div>
        <div class="key key-right">&#9654;</div>
        <div class="key space-key">SPACE</div>
      </div>
      <div class="hint-label">Run jump sprint</div>
    </div>
    <div class="hint hint-right">
      <div class="mouse"><div class="mouse-wheel"></div></div>
      <div class="hint-label">Move mouse to rotate and tilt</div>
    </div>`;
  document.body.appendChild(root);

  const refs = {
    levelJump: root.querySelector("#levelJump"),
    levelInput: root.querySelector("#levelInput"),
    itemMenu: root.querySelector("#itemMenu"),
    statusLine: root.querySelector("#statusLine"),
    coinCount: root.querySelector("#coinCount"),
    healthCount: root.querySelector("#healthCount"),
    manaCount: root.querySelector("#manaCount"),
    magicCount: root.querySelector("#magicCount"),
    bombCount: root.querySelector("#bombCount")
  };

  refs.levelInput.addEventListener("input", () => {
    refs.levelInput.value = refs.levelInput.value.replace(/\D/g, "");
  });
  refs.levelJump.addEventListener("submit", (event) => {
    event.preventDefault();
    const target = Number(refs.levelInput.value);
    if (!Number.isInteger(target) || !availableLevels.includes(target)) {
      refs.levelInput.value = String(currentLevel);
      return;
    }
    window.location.href = `level${target}.html`;
  });
  return refs;
}

function refreshInventory() {
  hud.coinCount.textContent = state.inventory.coins;
  hud.healthCount.textContent = state.inventory.health;
  hud.manaCount.textContent = state.inventory.mana;
  hud.magicCount.textContent = state.inventory.magic;
  hud.bombCount.textContent = state.inventory.bombs;
}

function setStatus(text) {
  hud.statusLine.textContent = text;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function hash(x, y, salt = 0) {
  let n = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt, 1442695041);
  n = (n ^ (n >>> 13)) >>> 0;
  n = Math.imul(n, 1274126177) >>> 0;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
}

function rotate(x, y, angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return { x: x * c - y * s, y: x * s + y * c };
}

function worldToScreen(x, y, z = 0) {
  const p = rotate(x - state.player.x, y - state.player.y, -state.yaw);
  return {
    x: state.width / 2 + p.x * state.zoom,
    y: state.height / 2 + p.y * state.projectionY * state.zoom - (z - state.player.floorZ) * state.zoom
  };
}

function groundDirection(angle) {
  const screenAngle = angle - state.yaw;
  const x = Math.cos(screenAngle);
  const y = Math.sin(screenAngle) * state.projectionY;
  const len = Math.hypot(x, y) || 1;
  return { x: x / len, y: y / len };
}

function color(value) {
  return (value << 16) | (value << 8) | value;
}

function rectWorld(rect, fill, stroke = 0x080605, alpha = 1) {
  poly([
    worldToScreen(rect.x, rect.y),
    worldToScreen(rect.x + rect.w, rect.y),
    worldToScreen(rect.x + rect.w, rect.y + rect.h),
    worldToScreen(rect.x, rect.y + rect.h)
  ], fill, stroke, 3, alpha);
}

function poly(points, fill, stroke = null, lineWidth = 1, alpha = 1) {
  g.poly(points.flatMap((point) => [point.x, point.y])).fill({ color: fill, alpha });
  if (stroke !== null) {
    g.stroke({ color: stroke, width: lineWidth, alpha: 1 });
  }
}

function centeredRect(x, y, w, h, fill, stroke = null) {
  g.rect(Math.round(x - w / 2), Math.round(y - h / 2), w, h).fill(fill);
  if (stroke !== null) g.stroke({ color: stroke, width: 2 });
}

function line(a, b, stroke, width = 2, alpha = 1) {
  g.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: stroke, width, alpha });
}

function tileCorners(tx, ty) {
  const x = tx * tile;
  const y = ty * tile;
  return [
    worldToScreen(x, y),
    worldToScreen(x + tile, y),
    worldToScreen(x + tile, y + tile),
    worldToScreen(x, y + tile)
  ];
}

function drawTile(gx, gy) {
  let sprite = floorLayer.children[floorSpriteCount];
  if (!sprite) {
    sprite = new Sprite(art.floor);
    sprite.anchor.set(0.5);
    floorLayer.addChild(sprite);
  }
  floorSpriteCount += 1;
  sprite.visible = true;
  sprite.texture = art.floor;
  const center = worldToScreen(gx * tile + tile / 2, gy * tile + tile / 2);
  const c = Math.cos(state.yaw);
  const s = Math.sin(state.yaw);
  const scaleX = tile * state.zoom / art.floor.width;
  const scaleY = tile * state.zoom / art.floor.height;
  sprite.setFromMatrix(new Matrix(
    c * scaleX,
    -s * state.projectionY * scaleX,
    s * scaleY,
    c * state.projectionY * scaleY,
    center.x,
    center.y
  ));
  const shade = 210 + Math.floor(hash(gx, gy, 12) * 38);
  sprite.tint = color(shade);
  sprite.alpha = 0.98;
}

function pointInRect(x, y, rect, pad = 0) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

function pointInRawWalkable(x, y) {
  if (level.kind === "infinite") return true;
  return level.bounds.some((rect) => pointInRect(x, y, rect));
}

function pointInWalkable(x, y, radius = 0) {
  if (level.kind === "infinite") return true;
  const samples = [[x, y], [x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]];
  const inBounds = samples.every(([sx, sy]) => pointInRawWalkable(sx, sy));
  const inColumn = level.columns.some((column) => Math.hypot(x - column.x, y - column.y) < 28 + radius);
  return inBounds && !inColumn;
}

function groundElevation(x, y) {
  if (level.kind !== "dungeon") return 0;
  const stair = { x: -370, y: -842, w: 100, h: 454 };
  if (pointInRect(x, y, stair)) {
    const progress = clamp((-y - 388) / stair.h, 0, 1);
    return progress * level.platformHeight;
  }
  if (pointInRect(x, y, level.upperPlatform)) return level.platformHeight;
  return 0;
}

function drawInfiniteFloor() {
  const baseX = Math.floor(state.player.x / tile);
  const baseY = Math.floor(state.player.y / tile);
  for (let gy = baseY - 14; gy <= baseY + 14; gy += 1) {
    for (let gx = baseX - 14; gx <= baseX + 14; gx += 1) {
      const dist = Math.hypot((gx + 0.5) * tile - state.player.x, (gy + 0.5) * tile - state.player.y);
      if (dist <= tile * 13.2) drawTile(gx, gy);
    }
  }
}

function drawDungeonFloor() {
  for (const rect of level.bounds) {
    const startX = Math.floor(rect.x / tile);
    const endX = Math.floor((rect.x + rect.w) / tile);
    const startY = Math.floor(rect.y / tile);
    const endY = Math.floor((rect.y + rect.h) / tile);
    for (let gy = startY; gy <= endY; gy += 1) {
      for (let gx = startX; gx <= endX; gx += 1) {
        if (pointInRect(gx * tile + tile / 2, gy * tile + tile / 2, rect, tile)) drawTile(gx, gy);
      }
    }
    rectWorld(rect, 0x000000, 0x080605, 0);
  }
  for (const pool of level.waterPools) {
    rectWorld(pool, 0x153d43, 0x6b9492, 0.88);
    const wave = (performance.now() * 0.025) % 46;
    for (let y = pool.y + 24 - wave; y < pool.y + pool.h; y += 46) {
      const start = worldToScreen(pool.x + 16, y);
      const end = worldToScreen(pool.x + pool.w - 16, y + 10);
      line(start, end, 0x9bc9c2, 2, 0.2);
    }
    rectWorld({ x: pool.x + 7, y: pool.y + 7, w: pool.w - 14, h: pool.h - 14 }, 0x2b7276, null, 0.12);
  }
  drawWalls();
  drawUpperPlatform();
  drawStairs();
  drawSceneObjects();
}

function drawWalls() {
  const segments = [
    [-300, 140, -56, 140, 0x241e18], [56, 140, 300, 140, 0x241e18], [300, 140, 300, 600, 0x191510],
    [300, 600, -300, 600, 0x2d261e], [-300, 600, -300, 140, 0x17130f], [-56, 140, -56, -340, 0x17130f],
    [56, -340, 56, 140, 0x191510], [-380, -340, -56, -340, 0x241e18], [56, -340, 380, -340, 0x241e18],
    [380, -340, 380, -920, 0x191510], [380, -920, 354, -920, 0x2d261e], [292, -920, -380, -920, 0x2d261e],
    [-380, -920, -380, -340, 0x17130f]
  ];
  for (const [x1, y1, x2, y2, fill] of segments) {
    const midpointY = (y1 + y2) / 2;
    const wallHeight = midpointY <= -340 ? 138 : midpointY < 140 ? 98 : 80;
    drawWallSegment(x1, y1, x2, y2, fill, wallHeight);
  }
}

function drawWallSegment(x1, y1, x2, y2, fill, wallHeight) {
  const h = wallHeight * state.zoom;
  const a = worldToScreen(x1, y1);
  const b = worldToScreen(x2, y2);
  const face = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }];
  g.poly(face.flatMap((point) => [point.x, point.y])).fill({
    texture: art.wall,
    color: 0xd2c4ae,
    matrix: new Matrix().scale(0.13),
    alpha: 1
  }).stroke({ color: 0x050403, width: 3 });
  g.poly(face.flatMap((point) => [point.x, point.y])).fill({ color: fill, alpha: 0.1 });
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const length = Math.hypot(dx, dy) || 1;
  const lipX = -dy / length * 9;
  const lipY = dx / length * 9;
  poly([
    { x: a.x, y: a.y - h }, { x: b.x, y: b.y - h },
    { x: b.x + lipX, y: b.y - h + lipY }, { x: a.x + lipX, y: a.y - h + lipY }
  ], 0x625541, 0x100d0a, 2, 0.72);
  line({ x: a.x, y: a.y - h + 2 }, { x: b.x, y: b.y - h + 2 }, 0xb09a70, 1, 0.38);
  const smokeCount = Math.max(3, Math.ceil(length / 82));
  for (let i = 0; i <= smokeCount; i += 1) {
    const t = i / smokeCount;
    const drift = Math.sin(performance.now() * 0.00055 + i * 2.1 + x1 * 0.01) * 9;
    const smokeX = a.x + dx * t + drift;
    const smokeY = a.y + dy * t - h - 7 - Math.cos(i * 1.7) * 6;
    const random = hash(Math.round(x1 + t * 100), Math.round(y1), i);
    const size = (24 + random * 24) * state.zoom;
    g.circle(smokeX - size * 0.25, smokeY + size * 0.03, size * 0.34)
      .fill({ color: 0x71695e, alpha: 0.065 });
    g.circle(smokeX + size * 0.12, smokeY - size * 0.13, size * 0.42)
      .fill({ color: 0x5b554d, alpha: 0.075 });
    g.circle(smokeX + size * 0.42, smokeY + size * 0.06, size * 0.29)
      .fill({ color: 0x3a3732, alpha: 0.08 });
    g.circle(smokeX + drift * 0.25, smokeY - size * 0.54, size * 0.27)
      .fill({ color: 0x171614, alpha: 0.11 });
  }
}

function texturedFace(points, texture, tint = 0xffffff, alpha = 1, scale = 0.13) {
  g.poly(points.flatMap((point) => [point.x, point.y])).fill({
    texture,
    color: tint,
    matrix: new Matrix().scale(scale),
    alpha
  }).stroke({ color: 0x080706, width: 2 });
}

function drawUpperPlatform() {
  const rect = level.upperPlatform;
  const z = level.platformHeight;
  const groundShadow = [
    worldToScreen(rect.x + 8, rect.y + 12),
    worldToScreen(rect.x + rect.w + 20, rect.y + 12),
    worldToScreen(rect.x + rect.w + 20, rect.y + rect.h + 28),
    worldToScreen(rect.x + 8, rect.y + rect.h + 28)
  ];
  poly(groundShadow, 0x000000, null, 1, 0.58);
  const top = [
    worldToScreen(rect.x, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y + rect.h, z),
    worldToScreen(rect.x, rect.y + rect.h, z)
  ];
  const frontTopLeft = top[3];
  const frontTopRight = top[2];
  const frontBottomRight = worldToScreen(rect.x + rect.w, rect.y + rect.h, z - 38);
  const frontBottomLeft = worldToScreen(rect.x, rect.y + rect.h, z - 38);
  texturedFace([frontTopLeft, frontTopRight, frontBottomRight, frontBottomLeft], art.wall, 0xc0ad91, 1, 0.1);
  const leftBottomBack = worldToScreen(rect.x, rect.y, z - 38);
  texturedFace([top[0], top[3], frontBottomLeft, leftBottomBack], art.wall, 0x95856f, 1, 0.1);
  poly(top, 0x514b42, 0x080706, 2, 1);
  texturedFace(top, art.floor, 0xf0dfc3, 0.7, 0.11);
  line(top[3], top[2], 0xe2c88f, 4, 0.9);
  for (let x = rect.x + 80; x < rect.x + rect.w; x += 92) {
    line(worldToScreen(x, rect.y + 6, z + 0.5), worldToScreen(x, rect.y + rect.h - 6, z + 0.5), 0x17130f, 1.5, 0.52);
  }

  for (let x = rect.x + 48; x < rect.x + rect.w - 30; x += 118) {
    const braceTop = worldToScreen(x, rect.y + rect.h, z - 38);
    const braceBottom = worldToScreen(x + 18, rect.y + rect.h + 30, z - 82);
    poly([
      { x: braceTop.x - 6, y: braceTop.y }, { x: braceTop.x + 6, y: braceTop.y },
      { x: braceBottom.x + 5, y: braceBottom.y }, { x: braceBottom.x - 5, y: braceBottom.y }
    ], 0x332b22, 0x090706, 1.5, 0.95);
  }

  drawElevatedExit();
}

function drawElevatedExit() {
  const z = level.platformHeight;
  const x1 = level.exit.x;
  const x2 = level.exit.x + level.exit.w;
  const y = -919;
  const height = 112;
  const bottomLeft = worldToScreen(x1, y, z);
  const bottomRight = worldToScreen(x2, y, z);
  const topRight = worldToScreen(x2, y, z + height);
  const topLeft = worldToScreen(x1, y, z + height);
  poly([bottomLeft, bottomRight, topRight, topLeft], 0x24150f, 0xb5904e, 4, 1);
  for (let i = 1; i < 4; i += 1) {
    const t = i / 4;
    line(
      { x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * t, y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * t },
      { x: topLeft.x + (topRight.x - topLeft.x) * t, y: topLeft.y + (topRight.y - topLeft.y) * t },
      0x7a4a2b,
      2,
      0.75
    );
  }
  line(topLeft, topRight, 0xe2c078, 5, 0.9);
  line(bottomLeft, topLeft, 0x72552e, 4, 0.95);
  line(bottomRight, topRight, 0x72552e, 4, 0.95);
  g.circle(bottomRight.x - 9 * state.zoom, bottomRight.y - 42 * state.zoom, 3 * state.zoom).fill(0xd4a64e);
}

function drawStairs() {
  const steps = 12;
  const width = 100;
  const depth = 42;
  const stride = 37;
  const startY = -430;
  for (let i = steps - 1; i >= 0; i -= 1) {
    const z = level.platformHeight * (i + 1) / steps;
    const previousZ = level.platformHeight * i / steps;
    const rect = { x: -370, y: startY - i * stride, w: width, h: depth };
    const top = [
      worldToScreen(rect.x, rect.y, z), worldToScreen(rect.x + rect.w, rect.y, z),
      worldToScreen(rect.x + rect.w, rect.y + rect.h, z), worldToScreen(rect.x, rect.y + rect.h, z)
    ];
    const riser = [
      top[3], top[2],
      worldToScreen(rect.x + rect.w, rect.y + rect.h, previousZ),
      worldToScreen(rect.x, rect.y + rect.h, previousZ)
    ];
    poly(riser, 0x3a332a, 0x080706, 2, 1);
    texturedFace(riser, art.wall, 0xb09c7f, 0.8, 0.09);
    poly(top, 0x575047, 0x080706, 2, 1);
    texturedFace(top, art.floor, 0xe0d1b7, 0.72, 0.1);
    line(top[3], top[2], 0xe0c88e, 2.2, 0.8);
  }
}

function objectScreenY(object) {
  return worldToScreen(object.x, object.y).y;
}

function drawSceneObjects() {
  const objects = [
    ...level.columns.map((o) => ({ ...o, kind: "column" })),
    ...level.torches.map((o) => ({ ...o, kind: "torch" })),
    ...level.coins.filter((o) => !o.collected).map((o) => ({ ...o, kind: "coin" })),
    ...level.potions.filter((o) => !o.collected).map((o) => ({ ...o, kind: "potion" }))
  ].sort((a, b) => objectScreenY(a) - objectScreenY(b));
  for (const object of objects) {
    if (object.kind === "column") drawColumn(object);
    if (object.kind === "torch") drawTorch(object);
    if (object.kind === "coin") drawCoin(object);
    if (object.kind === "potion") drawPotion(object);
  }
}

function drawColumn(column) {
  const p = worldToScreen(column.x, column.y);
  const z = 70 * state.zoom;
  const s = state.zoom;
  g.ellipse(p.x + 9 * s, p.y + 8 * s, 28 * s, 11 * s).fill({ color: 0x000000, alpha: 0.44 });
  poly([
    { x: p.x - 13 * s, y: p.y - 9 * s }, { x: p.x + 13 * s, y: p.y - 9 * s },
    { x: p.x + 9 * s, y: p.y - z + 7 * s }, { x: p.x - 9 * s, y: p.y - z + 7 * s }
  ], 0x3d382f, 0x0a0806, 2);
  poly([
    { x: p.x - 9 * s, y: p.y - z + 7 * s }, { x: p.x + 9 * s, y: p.y - z + 7 * s },
    { x: p.x + 5 * s, y: p.y - z + 13 * s }, { x: p.x - 5 * s, y: p.y - z + 13 * s }
  ], 0x71634d, null, 1, 0.5);
  centeredRect(p.x, p.y - z - 2 * s, 42 * s, 11 * s, 0x332d25, 0x090706);
  centeredRect(p.x, p.y - z - 10 * s, 32 * s, 8 * s, 0x51483a, 0x090706);
  centeredRect(p.x, p.y - 2 * s, 42 * s, 12 * s, 0x2b261f, 0x090706);
  centeredRect(p.x, p.y - 10 * s, 32 * s, 8 * s, 0x574b3a, 0x090706);
  line({ x: p.x - 3 * s, y: p.y - 20 * s }, { x: p.x + 1 * s, y: p.y - 42 * s }, 0x17130f, 2, 0.7);
}

function drawCoin(coin) {
  const p = worldToScreen(coin.x, coin.y);
  const bob = Math.sin(performance.now() * 0.004 + coin.x) * 3 * state.zoom;
  const y = p.y - 8 * state.zoom + bob;
  g.ellipse(p.x + 3, p.y + 3, 10 * state.zoom, 4 * state.zoom).fill({ color: 0x000000, alpha: 0.38 });
  g.ellipse(p.x, y, 8 * state.zoom, 11 * state.zoom).fill(0xd9a936).stroke({ color: 0x51300d, width: 2 });
  g.ellipse(p.x, y, 4.5 * state.zoom, 7 * state.zoom).stroke({ color: 0xffe29a, width: 1.5, alpha: 0.7 });
  line({ x: p.x - 2, y: y - 7 }, { x: p.x + 2, y: y + 4 }, 0xfff1bd, 1.5, 0.8);
}

function drawPotion(potion) {
  const p = worldToScreen(potion.x, potion.y);
  const s = state.zoom;
  const pulse = 1 + Math.sin(performance.now() * 0.004 + potion.x) * 0.08;
  g.circle(p.x, p.y - 10 * s, 31 * s * pulse).fill({ color: potion.glow, alpha: 0.16 });
  g.ellipse(p.x + 3 * s, p.y + 3 * s, 13 * s, 5 * s).fill({ color: 0x000000, alpha: 0.42 });
  g.roundRect(p.x - 10 * s, p.y - 25 * s, 20 * s, 25 * s, 7 * s)
    .fill({ color: potion.color, alpha: 0.9 }).stroke({ color: 0x170e18, width: 2.5 });
  g.roundRect(p.x - 4 * s, p.y - 34 * s, 8 * s, 11 * s, 2 * s)
    .fill(0x685646).stroke({ color: 0x170e18, width: 2 });
  g.circle(p.x - 4 * s, p.y - 17 * s, 3 * s).fill({ color: 0xffffff, alpha: 0.56 });
  line({ x: p.x - 7 * s, y: p.y - 4 * s }, { x: p.x + 7 * s, y: p.y - 4 * s }, 0xe8d9bd, 2, 0.48);
}

function drawTorch(torch) {
  const p = worldToScreen(torch.x, torch.y);
  const s = state.zoom;
  const flicker = Math.sin(performance.now() * 0.018 + torch.x * 0.04) * 3 * s;
  line({ x: p.x - 8 * s, y: p.y }, { x: p.x + 7 * s, y: p.y - 13 * s }, 0x17100a, 6 * s, 1);
  centeredRect(p.x + 5 * s, p.y - 17 * s, 8 * s, 24 * s, 0x3f2816, 0x100906);
  line({ x: p.x + 1 * s, y: p.y - 22 * s }, { x: p.x + 9 * s, y: p.y - 11 * s }, 0x9d7041, 2, 0.7);
  g.circle(p.x + 5 * s, p.y - 33 * s, (50 + flicker) * s).fill({ color: 0xd85c22, alpha: 0.15 });
  poly([
    { x: p.x + 5 * s, y: p.y - (54 + flicker) * s },
    { x: p.x + 15 * s, y: p.y - 33 * s },
    { x: p.x + 5 * s, y: p.y - 20 * s },
    { x: p.x - 5 * s, y: p.y - 33 * s }
  ], 0xe56b24, 0x5a1f0c, 1.5);
  poly([
    { x: p.x + 5 * s, y: p.y - (47 + flicker * 0.5) * s },
    { x: p.x + 11 * s, y: p.y - 33 * s },
    { x: p.x + 5 * s, y: p.y - 25 * s },
    { x: p.x, y: p.y - 34 * s }
  ], 0xffd56b, null, 1);
}

function limb(from, to, width, fill, stroke) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  poly([
    { x: from.x + nx * width, y: from.y + ny * width },
    { x: from.x - nx * width, y: from.y - ny * width },
    { x: to.x - nx * width, y: to.y - ny * width },
    { x: to.x + nx * width, y: to.y + ny * width }
  ], fill, stroke, 2);
}

function drawLegacyCharacter() {
  const baseX = state.width / 2;
  const baseY = state.height / 2 + 8;
  const player = state.player;
  const moving = isMoving();
  const run = moving ? player.stride : -0.2;
  const bob = moving ? Math.abs(Math.sin(run)) * 3 : 0;
  const forward = groundDirection(player.heading);
  const side = { x: -forward.y, y: forward.x };
  const nearSign = side.y >= 0 ? 1 : -1;
  const farSign = -nearSign;
  const lean = moving ? 5 : 1;
  const capeLift = moving ? Math.max(0, Math.sin(run + Math.PI * 0.35)) * 6 : 1;
  const bodyScale = player.stance === "crawl" ? 0.52 : player.stance === "crouch" ? 0.74 : 1;
  const stanceDrop = player.stance === "crawl" ? 17 : player.stance === "crouch" ? 9 : 0;
  const attackPose = player.attackTime > 0 ? Math.sin((1 - player.attackTime / 0.28) * Math.PI) : 0;
  const specialPose = player.specialTime > 0 ? Math.sin((1 - player.specialTime / 0.35) * Math.PI) : 0;

  function p(x, z, y) {
    return { x: baseX + side.x * x + forward.x * z, y: baseY + side.y * x + forward.y * z + y * bodyScale + stanceDrop - bob - player.z };
  }

  const shadowScale = 1 - clamp(player.z / 230, 0, 0.45);
  g.ellipse(baseX - forward.x * 6, baseY + 9, 31 * shadowScale, 12 * shadowScale).fill({ color: 0x000000, alpha: 0.42 });

  const airTuck = player.grounded ? 0 : clamp(player.z / 95, 0, 1);
  const leg = (sign, phase, dark) => {
    const swing = Math.sin(phase);
    const lift = moving ? Math.max(0, Math.cos(phase)) * 7 : 0;
    const bend = moving ? Math.max(0.15, Math.cos(phase) * 0.5 + 0.5) : 0.35;
    const hip = p(sign * 8, 0, -29);
    const knee = p(sign * (8 + bend * 5), 8 + swing * 12 - airTuck * 5, -16 - lift * 0.8 - airTuck * 12);
    const foot = p(sign * 12, 16 + swing * 25 - airTuck * 10, -1 - lift - airTuck * 18);
    limb(hip, knee, 6, dark ? 0x171512 : 0x211d18, 0x070605);
    limb(knee, foot, 5, dark ? 0x11100e : 0x181511, 0x060504);
    centeredRect(knee.x, knee.y, 11, 9, dark ? 0x24211d : 0x343029, 0x070605);
    poly([p(sign * 4, 11 + swing * 25 - airTuck * 10, -lift - airTuck * 18), p(sign * 20, 11 + swing * 25 - airTuck * 10, -lift - airTuck * 18), p(sign * 19, 27 + swing * 25 - airTuck * 10, 2 - lift - airTuck * 18), p(sign * 6, 29 + swing * 25 - airTuck * 10, 2 - lift - airTuck * 18)], 0x0d0c0b, 0x030302, 2);
  };

  const arm = (sign, phase, carriesBlade) => {
    const swing = Math.sin(phase);
    const bladeSide = carriesBlade ? attackPose : 0;
    const specialSide = carriesBlade ? 0 : specialPose;
    const shoulder = p(sign * 18, 5 + lean, -56);
    const elbow = p(sign * (21 - player.jumpArm * 7), 7 - swing * 13 + player.jumpArm * 15 + bladeSide * 20 + specialSide * 8, -36 - player.jumpArm * 54);
    const hand = p(sign * (17 - player.jumpArm * 9), 12 - swing * 24 + player.jumpArm * 24 + bladeSide * 42 + specialSide * 16, -19 - player.jumpArm * 92 - specialSide * 12);
    limb(shoulder, elbow, 5, 0x211b15, 0x070605);
    limb(elbow, hand, 4, 0x9d8361, 0x21160d);
    centeredRect(elbow.x, elbow.y, 8, 8, 0x2c2822, 0x070605);
    centeredRect(hand.x, hand.y, 7, 7, 0xa88861, 0x21160d);
    if (!carriesBlade && player.holdingBomb) {
      g.circle(hand.x, hand.y, 16).fill({ color: 0xff7430, alpha: 0.22 });
      centeredRect(hand.x, hand.y - 3, 12, 12, 0x15120f, 0x050403);
      centeredRect(hand.x + 5, hand.y - 13, 4, 5, 0xf0a13a);
    }
    if (carriesBlade) {
      const tip = p(sign * 18, 42 - swing * 24 + player.jumpArm * 26 + attackPose * 46, -7 - player.jumpArm * 82);
      const bladeBase = p(sign * 17, 22 - swing * 24 + player.jumpArm * 18 + attackPose * 28, -13 - player.jumpArm * 72);
      poly([{ x: hand.x, y: hand.y }, { x: bladeBase.x + side.x * sign * 3, y: bladeBase.y + side.y * sign * 3 }, tip, { x: bladeBase.x - side.x * sign * 3, y: bladeBase.y - side.y * sign * 3 }], 0xcbb276, 0x6f5e42, 1);
    }
  };

  const farPhase = farSign < 0 ? run : run + Math.PI;
  const nearPhase = nearSign < 0 ? run : run + Math.PI;
  leg(farSign, farPhase, true);
  poly([p(-19, -6, -56), p(19, -6, -56), p(23, -38 - capeLift, -10), p(4, -44 - capeLift, 0), p(-22, -38 - capeLift, -10)], 0x2b150b, 0x070302, 2);
  poly([p(-10, -8, -51), p(10, -8, -51), p(12, -30 - capeLift, -14), p(-12, -30 - capeLift, -14)], 0x4b2614);
  if (player.jumpArm < 0.08) arm(farSign, nearPhase, farSign === 1);
  if (player.jumpArm < 0.08) poly([p(-16, -16, -43), p(16, -16, -43), p(23, -38 - capeLift, -10), p(4, -44 - capeLift, 0), p(-22, -38 - capeLift, -10)], 0x35190d, 0x070302, 2);
  poly([p(-17, 6 + lean, -59), p(17, 6 + lean, -59), p(12, 2, -28), p(-12, 2, -28)], 0x2b241c, 0x070605, 2);
  poly([p(-10, 8 + lean, -55), p(10, 8 + lean, -55), p(8, 5, -31), p(-8, 5, -31)], 0x5a4936);
  line(p(-12, 9, -54), p(9, 4, -31), 0x1a120c, 3);
  line(p(12, 9, -54), p(-9, 4, -31), 0x1a120c, 3);
  poly([p(-14, 3, -31), p(14, 3, -31), p(14, 3, -23), p(-14, 3, -23)], 0x17130f, 0x070605, 2);
  centeredRect(p(0, 9, -27).x, p(0, 9, -27).y, 8, 6, 0xa58954, 0x2a1c0d);
  poly([p(-25, 5, -60), p(-11, 6, -61), p(-10, 8, -51), p(-25, 6, -51)], 0x211812, 0x050403, 2);
  poly([p(11, 6, -61), p(25, 5, -60), p(25, 6, -51), p(10, 8, -51)], 0x2a1f16, 0x050403, 2);
  poly([p(-15, 7, -67), p(15, 7, -67), p(15, 8, -55), p(-15, 8, -55)], 0x15120f, 0x050403, 2);
  poly([p(0, 8 + lean, -101), p(18, 8 + lean, -78), p(12, 13 + lean, -67), p(-12, 13 + lean, -67), p(-18, 8 + lean, -78)], 0x11100e, 0x050403, 2);
  centeredRect(p(0, 11 + lean, -86).x, p(0, 11 + lean, -79).y, 14, 14, 0xa17b58, 0x24170d);
  poly([p(-12, 15 + lean, -90), p(12, 15 + lean, -90), p(10, 17 + lean, -75), p(-10, 17 + lean, -75)], 0x1d1b18, 0x050403, 2);
  centeredRect(p(0, 19 + lean, -82).x, p(0, 19 + lean, -82).y, 10, 4, 0x070605);
  leg(nearSign, nearPhase, false);
  if (player.jumpArm >= 0.08) arm(farSign, nearPhase, farSign === 1);
  arm(nearSign, nearSign < 0 ? run + Math.PI : run, nearSign === 1);

  if (player.bombThrowTime > 0) {
    const progress = 1 - player.bombThrowTime / 0.5;
    const bomb = worldToScreen(
      player.x + Math.cos(player.heading) * 480 * progress,
      player.y + Math.sin(player.heading) * 480 * progress,
      player.floorZ
    );
    centeredRect(bomb.x, bomb.y - Math.sin(progress * Math.PI) * 70, 13, 13, 0x15120f, 0x050403);
  }
}

function actorDirectionRow() {
  const direction = groundDirection(state.player.heading);
  if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x > 0 ? 3 : 1;
  return direction.y > 0 ? 0 : 2;
}

function drawCharacter() {
  const player = state.player;
  const moving = isMoving();
  const row = actorDirectionRow();
  let column = 0;
  let sheet = art.action;
  if (player.attackTime > 0) {
    column = 1;
  } else if (!player.grounded || player.jumpArm > 0.12) {
    column = 3;
  } else if (player.stance !== "stand") {
    column = 2;
  } else if (moving) {
    sheet = art.run;
    column = Math.floor((((player.stride % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 0.5)) % 4;
  }

  actorShadow.clear();
  actorFx.clear();
  const baseX = state.width / 2;
  const baseY = state.height / 2 + 18;
  const shadowScale = 1 - clamp(player.z / 240, 0, 0.48);
  actorShadow.ellipse(baseX + 4, baseY + 2, 34 * shadowScale * state.zoom, 12 * shadowScale * state.zoom)
    .fill({ color: 0x000000, alpha: 0.52 });

  actorSprite.texture = sheet[row][column];
  actorSprite.position.set(baseX, baseY - player.z);
  const stanceScale = player.stance === "crawl" ? 0.84 : player.stance === "crouch" ? 0.91 : 1;
  const scale = 0.42 * state.zoom * stanceScale;
  actorSprite.scale.set(scale, scale * (player.stance === "crawl" ? 0.82 : 1));
  actorSprite.rotation = player.rollTime > 0 ? (1 - player.rollTime / 0.46) * Math.PI * 2 : 0;
  actorSprite.alpha = 1;

  if (player.attackTime > 0) {
    const attackProgress = 1 - player.attackTime / 0.28;
    const start = -1.15 + attackProgress * 0.65;
    actorFx.arc(baseX, baseY - 46 - player.z, 62 * state.zoom, start, start + 1.25)
      .stroke({ color: 0xf3d69a, width: 5 * state.zoom, alpha: 0.42 });
    actorFx.arc(baseX, baseY - 46 - player.z, 69 * state.zoom, start + 0.12, start + 1.05)
      .stroke({ color: 0xffffff, width: 1.5 * state.zoom, alpha: 0.72 });
  }

  if (player.holdingBomb) {
    const handX = baseX + (row === 1 ? -35 : 35) * state.zoom;
    const handY = baseY - 66 * state.zoom - player.z;
    actorFx.circle(handX, handY, 18 * state.zoom).fill({ color: 0xff6b27, alpha: 0.13 });
    actorFx.circle(handX, handY, 9 * state.zoom).fill(0x181512).stroke({ color: 0x6c5b44, width: 2 });
    actorFx.moveTo(handX + 4, handY - 8).lineTo(handX + 8, handY - 16)
      .stroke({ color: 0xf6a43a, width: 2.5, alpha: 0.95 });
  }

  if (player.bombThrowTime > 0) {
    const progress = 1 - player.bombThrowTime / 0.5;
    const bomb = worldToScreen(player.x + Math.cos(player.heading) * 480 * progress, player.y + Math.sin(player.heading) * 480 * progress);
    const bombY = bomb.y - Math.sin(progress * Math.PI) * 70;
    actorFx.circle(bomb.x, bombY, 8 * state.zoom).fill(0x181512).stroke({ color: 0x877052, width: 2 });
    actorFx.circle(bomb.x + 4, bombY - 7, 5 * state.zoom).fill({ color: 0xff7a2e, alpha: 0.3 });
  }
}

function drawLight() {
  const radius = Math.min(state.width, state.height) * 0.34;
  g.circle(state.width / 2, state.height / 2, radius).fill({ color: 0xf0a85a, alpha: 0.045 });
}

function isMoving() {
  return state.keys.has("ArrowUp") || state.keys.has("ArrowDown") || state.keys.has("ArrowLeft") || state.keys.has("ArrowRight") ||
    state.keys.has("KeyW") || state.keys.has("KeyA") || state.keys.has("KeyS") || state.keys.has("KeyD");
}

function update(delta) {
  let mx = 0;
  let my = 0;
  if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) my -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) my += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) mx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) mx += 1;

  const player = state.player;
  const moving = mx !== 0 || my !== 0;
  const sprinting = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight");
  if (moving) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.lastMoveX = mx;
    player.lastMoveY = my;
    const worldMove = rotate(mx, my, state.yaw);
    const stanceSpeed = player.stance === "crawl" ? 0.28 : player.stance === "crouch" ? 0.45 : 1;
    const speed = player.speed * (sprinting && player.stance === "stand" ? 1.75 : 1) * stanceSpeed;
    movePlayer(worldMove.x * speed * delta, worldMove.y * speed * delta);
    player.heading = Math.atan2(worldMove.y, worldMove.x);
    player.stride += delta * (sprinting ? 12 : 15);
  } else {
    player.stride *= Math.pow(0.0008, delta);
  }

  if (player.rollTime > 0) {
    const worldMove = rotate(player.rollX, player.rollY, state.yaw);
    movePlayer(worldMove.x * player.speed * 2.2 * delta, worldMove.y * player.speed * 2.2 * delta);
    player.heading = Math.atan2(worldMove.y, worldMove.x);
    player.rollTime = Math.max(0, player.rollTime - delta);
  }
  if (!player.grounded) {
    player.jumpAge += delta;
    player.vz -= 1380 * delta;
    player.z += player.vz * delta;
    if (player.z <= 0) {
      player.z = 0;
      player.vz = 0;
      player.jumpAge = 0;
      player.grounded = true;
    }
  }
  player.jumpArm += ((player.grounded ? 0 : clamp(1 - player.jumpAge / 0.34, 0, 1)) - player.jumpArm) * (1 - Math.exp(-(player.grounded ? 18 : 24) * delta));
  player.attackTime = Math.max(0, player.attackTime - delta);
  player.specialTime = Math.max(0, player.specialTime - delta);
  player.interactTime = Math.max(0, player.interactTime - delta);
  player.bombThrowTime = Math.max(0, player.bombThrowTime - delta);

  if (level.kind === "dungeon") {
    player.floorZ = groundElevation(player.x, player.y);
    collectItems();
    const targetZoom = pointInRect(player.x, player.y, level.bounds[1], 26) ? 1.65 : 1;
    state.zoom += (targetZoom - state.zoom) * (1 - Math.exp(-5 * delta));
    if (!state.transitioning && player.floorZ >= level.platformHeight * 0.85 && pointInRect(player.x, player.y, level.exit, 10)) {
      state.transitioning = true;
      state.fade = 0;
    }
    if (state.transitioning) {
      state.fade = Math.min(1, state.fade + delta);
      if (state.fade >= 1) window.location.href = "level0.html?fade=1";
    }
  } else if (state.fade > 0) {
    state.fade = Math.max(0, state.fade - delta);
  }
}

function movePlayer(dx, dy) {
  const player = state.player;
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const maxStepHeight = 18;
  let currentElevation = groundElevation(player.x, player.y);
  const nextXElevation = groundElevation(nextX, player.y);
  if (pointInWalkable(nextX, player.y, 16) && Math.abs(nextXElevation - currentElevation) <= maxStepHeight) {
    player.x = nextX;
    currentElevation = nextXElevation;
  }
  const nextYElevation = groundElevation(player.x, nextY);
  if (pointInWalkable(player.x, nextY, 16) && Math.abs(nextYElevation - currentElevation) <= maxStepHeight) {
    player.y = nextY;
    currentElevation = nextYElevation;
  }
  player.floorZ = currentElevation;
}

function collectItems() {
  for (const coin of level.coins) {
    if (!coin.collected && Math.hypot(state.player.x - coin.x, state.player.y - coin.y) < 26) {
      coin.collected = true;
      state.inventory.coins += 1;
      refreshInventory();
    }
  }
  for (const potion of level.potions) {
    if (!potion.collected && Math.hypot(state.player.x - potion.x, state.player.y - potion.y) < 28) {
      potion.collected = true;
      state.inventory[potion.type] += 1;
      refreshInventory();
    }
  }
}

function render() {
  g.clear();
  overlay.clear();
  floorSpriteCount = 0;
  if (level.kind === "infinite") drawInfiniteFloor();
  else drawDungeonFloor();
  for (let i = floorSpriteCount; i < floorLayer.children.length; i += 1) floorLayer.children[i].visible = false;
  drawLight();
  drawCharacter();
  if (state.fade > 0) overlay.rect(0, 0, state.width, state.height).fill({ color: 0x000000, alpha: state.fade });
}

function chooseItem(slot) {
  hud.itemMenu.classList.add("hidden");
  if (slot === 4) {
    if (state.inventory.bombs > 0) {
      state.player.holdingBomb = true;
      setStatus("Bomb ready");
    } else setStatus("No bombs");
    return;
  }
  const type = ["health", "mana", "magic"][slot - 1];
  if (state.inventory[type] > 0) {
    state.inventory[type] -= 1;
    refreshInventory();
    setStatus(`Used ${type}`);
  } else setStatus(`No ${type}`);
}

function useWeapon() {
  state.player.attackTime = 0.28;
  setStatus(state.player.holdingBomb ? "Sword with bomb" : "Sword strike");
}

function specialAction() {
  if (state.player.holdingBomb) {
    state.player.holdingBomb = false;
    state.inventory.bombs = Math.max(0, state.inventory.bombs - 1);
    state.player.bombThrowTime = 0.5;
    state.player.specialTime = 0.3;
    refreshInventory();
    setStatus("Bomb thrown");
  } else {
    state.player.specialTime = 0.35;
    setStatus("Special action");
  }
}

function toggleCrouch(moving) {
  const player = state.player;
  if (player.stance === "stand") {
    player.stance = "crouch";
    setStatus("Crouch");
  } else if (player.stance === "crouch" && moving) {
    player.stance = "crawl";
    setStatus("Crawl");
  } else {
    player.stance = "stand";
    setStatus("Stand");
  }
}

window.addEventListener("resize", () => {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
});

window.addEventListener("keydown", (event) => {
  if (!hud.itemMenu.classList.contains("hidden") && ["Digit1", "Digit2", "Digit3", "Digit4"].includes(event.code)) {
    event.preventDefault();
    chooseItem(Number(event.code.slice(-1)));
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    const player = state.player;
    const moving = isMoving();
    if (player.stance === "crawl") {
      player.stance = "crouch";
      setStatus("Crouch");
      return;
    }
    if (player.stance === "crouch" && moving) {
      player.rollTime = 0.45;
      player.rollX = player.lastMoveX;
      player.rollY = player.lastMoveY;
      player.stance = "stand";
      setStatus("Jump roll");
      return;
    }
    if (!event.repeat && player.grounded) {
      player.grounded = false;
      player.vz = player.stance === "crouch" ? 426 : 520;
      player.jumpAge = 0;
      player.jumpArm = 1;
    }
    return;
  }
  if (event.code === "ControlLeft") {
    event.preventDefault();
    toggleCrouch(isMoving());
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    hud.itemMenu.classList.toggle("hidden");
    setStatus(hud.itemMenu.classList.contains("hidden") ? "World mode" : "Choose 1-4");
    return;
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    state.player.interactTime = 0.3;
    setStatus("Interact");
    return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    event.preventDefault();
    state.keys.add(event.code);
  }
});

window.addEventListener("keyup", (event) => state.keys.delete(event.code));

app.canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== app.canvas) app.canvas.requestPointerLock();
});

app.canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) useWeapon();
  if (event.button === 2) specialAction();
});
app.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

window.addEventListener("mousemove", (event) => {
  if (document.pointerLockElement === app.canvas) {
    state.yaw += event.movementX * 0.006;
    state.pitch = clamp(state.pitch + event.movementY * 0.0035, minPitch, maxPitch);
  } else {
    state.yaw += clamp((event.clientX - state.width / 2) / (state.width / 2), -1, 1) * 0.0008;
    state.pitch = clamp(state.pitch - clamp((state.height / 2 - event.clientY) / (state.height / 2), -1, 1) * 0.00035, minPitch, maxPitch);
  }
  state.projectionY = Math.sin(state.pitch);
});

refreshInventory();
let lastTime = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  update(delta);
  render();
});
}

main().catch((error) => {
  console.error("WebRunner failed to start", error);
  const diagnostic = document.createElement("pre");
  diagnostic.className = "runtime-error";
  diagnostic.textContent = `WebRunner failed to start\n${error.stack || error.message}`;
  document.body.appendChild(diagnostic);
});
