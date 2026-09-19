async function main() {
const { Application, Container, Graphics, Matrix, Rectangle, Sprite, Texture } = globalThis.PIXI;
const levelKey = document.body.dataset.level || "1";
const isTutorial = levelKey === "tutorial";
const levelId = isTutorial ? null : Number(levelKey);
const availableLevels = [0, 1];
const meter = 48;
const tile = 64;
const minPitch = Math.PI / 9;
const maxPitch = Math.PI * 7 / 18;
const bombThrowDuration = 0.82;
const bombReleaseTime = 0.47;
const gravity = 980;

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
  yaw: Math.PI / 4,
  pitch: Math.PI / 4,
  projectionY: Math.sin(Math.PI / 4),
  zoom: 1,
  fade: new URLSearchParams(window.location.search).get("fade") === "1" ? 1 : 0,
  transitioning: false,
  transitionTarget: null,
  transitionDelay: 0,
  keys: new Set(),
  projectiles: [],
  explosions: [],
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
    stealth: false,
    bombThrowTime: 0,
    landTime: 0,
    lastMoveX: 0,
    lastMoveY: -1,
    health: 100,
    maxHealth: 100,
    contactDamageCooldown: 0,
    hitFlash: 0
  },
  tutorial: isTutorial ? {
    step: 0,
    advancing: false,
    movementKeys: new Set(),
    sprintDistance: 0,
    jumpStarted: false,
    portalActive: false,
    portalPull: false,
    portalDive: false,
    portalDiveTime: 0,
    portalHidden: false,
    portal: { x: 0, y: -10 * meter }
  } : null
};
const levels = {
  tutorial: {
    name: "Tutorial",
    kind: "tutorial",
    bounds: [{ x: -12 * meter, y: -12 * meter, w: 24 * meter, h: 24 * meter, name: "training" }],
    torches: [],
    columns: [],
    waterPools: [],
    coins: [],
    potions: [],
    exit: null
  },
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
    ],
    enemies: [
      { x: -82, y: -690, phase: 0.08 },
      { x: 92, y: -505, phase: 0.58 }
    ]
  }
};

const level = levels[levelKey] || levels[1];
state.enemies = (level.enemies || []).map((enemy, index) => ({
  id: `dungeon-slime-${index + 1}`,
  name: "Dungeon Slime",
  enemyClass: "jumpingBlob",
  x: enemy.x,
  y: enemy.y,
  originX: enemy.x,
  originY: enemy.y,
  targetX: enemy.x,
  targetY: enemy.y,
  heading: Math.PI / 2,
  z: 0,
  health: 100,
  maxHealth: 100,
  contactDamage: 10,
  jumpClock: enemy.phase * 1.7,
  cycleDuration: 1.7,
  alive: true,
  visual: null
}));
const tutorialSteps = [
  { title: "Movement", instruction: "Move once in every direction.", command: "W A S D" },
  { title: "Sprint", instruction: "Hold Shift while moving for 3 meters.", command: "SHIFT + W A S D" },
  { title: "Jump", instruction: "Jump and land on your feet.", command: "SPACE" },
  { title: "Attack", instruction: "Strike once with your sword.", command: "LEFT CLICK" },
  { title: "Item Belt", instruction: "Open your item belt.", command: "E" },
  { title: "Ready Bomb", instruction: "Select the bomb from your item belt.", command: "4" },
  { title: "Throw Bomb", instruction: "Throw the readied bomb.", command: "RIGHT CLICK" }
];
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
const entityLayer = new Container();
const effectsLayer = new Graphics();
const occlusionLayer = new Graphics();
actorSprite.anchor.set(0.5, 0.9);
actorLayer.addChild(actorShadow, actorSprite, actorFx);
entityLayer.sortableChildren = true;
entityLayer.addChild(actorLayer);
world.addChild(floorLayer, g, entityLayer, effectsLayer, occlusionLayer);
let floorSpriteCount = 0;

async function loadArt() {
  const loadImage = (path) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load artwork: ${path}`));
    image.src = new URL(path, window.location.href).href;
  });
  const [runImage, runStealthImage, actionImage, lowImage, crawlImage, bombImage, bombCombatImage, slimeImage, floorImage, wallImage] = await Promise.all([
    loadImage("./assets/art/rogue-run-v3-clean.png"),
    loadImage("./assets/art/rogue-run-stealth-v2-clean.png"),
    loadImage("./assets/art/rogue-action-v2-clean.png"),
    loadImage("./assets/art/rogue-low-v2-clean.png"),
    loadImage("./assets/art/rogue-crawl-v3-clean.png"),
    loadImage("./assets/art/rogue-bomb-v3-clean.png"),
    loadImage("./assets/art/rogue-bomb-v2-clean.png"),
    loadImage("./assets/art/enemy-dungeon-slime-clean.png"),
    loadImage("./assets/art/dungeon-floor.png"),
    loadImage("./assets/art/dungeon-wall.png")
  ]);
  const sliceSheet = (image, columns, rows, horizontalInset = 0) => {
    const base = Texture.from(image);
    const cellWidth = Math.floor(image.naturalWidth / columns);
    const cellHeight = Math.floor(image.naturalHeight / rows);
    return Array.from({ length: rows }, (_, row) => Array.from({ length: columns }, (_, column) => new Texture({
      source: base.source,
      frame: new Rectangle(
        column * cellWidth + horizontalInset,
        row * cellHeight,
        cellWidth - horizontalInset * 2,
        cellHeight
      )
    })));
  };
  const floor = Texture.from(floorImage);
  const wall = Texture.from(wallImage);
  floor.source.addressMode = "repeat";
  wall.source.addressMode = "repeat";
  return {
    run: sliceSheet(runImage, 8, 8),
    runStealth: sliceSheet(runStealthImage, 4, 8),
    action: sliceSheet(actionImage, 4, 8),
    low: sliceSheet(lowImage, 6, 8),
    crawl: sliceSheet(crawlImage, 6, 8),
    bomb: sliceSheet(bombImage, 7, 8),
    bombCombat: sliceSheet(bombCombatImage, 3, 8),
    slime: sliceSheet(slimeImage, 8, 8),
    floor,
    wall
  };
}

function buildHud(currentLevel) {
  const root = document.createElement("div");
  root.className = `hud${isTutorial ? " tutorial-hud" : ""}`;
  const levelControl = isTutorial ? `
      <div class="tutorial-title">Initiate's Trial</div>` : `
      <form class="level-jump" id="levelJump">
        <label for="levelInput">Go to Level</label>
        <input id="levelInput" type="number" inputmode="numeric" min="0" max="1" step="1" value="${currentLevel}">
        <button type="submit">Go</button>
      </form>`;
  const tutorialPanel = isTutorial ? `
    <section class="tutorial-panel" id="tutorialPanel" aria-live="polite">
      <div class="tutorial-count" id="tutorialCount">Lesson 1 / ${tutorialSteps.length}</div>
      <div class="tutorial-copy">
        <strong id="tutorialStep">Movement</strong>
        <span id="tutorialInstruction">Move once in every direction.</span>
      </div>
      <div class="tutorial-command" id="tutorialCommand">W A S D</div>
      <div class="tutorial-progress"><i id="tutorialProgress"></i></div>
    </section>` : "";
  root.innerHTML = `
    <div class="top-hud">
      ${levelControl}
      <div class="inventory">
        <span>HP <b id="playerHealth">100</b></span>
        <span>Coins <b id="coinCount">0</b></span>
        <span>Health <b id="healthCount">0</b></span>
        <span>Mana <b id="manaCount">0</b></span>
        <span>Magic <b id="magicCount">0</b></span>
        <span>Bombs <b id="bombCount">3</b></span>
      </div>
      <div class="status-line" id="statusLine">World mode</div>
    </div>
    ${tutorialPanel}
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
        <div class="key space-key${isTutorial ? " tutorial-concealed" : ""}" id="spaceHint">SPACE</div>
      </div>
      <div class="hint-label" id="movementHint">${isTutorial ? "Movement unlocked" : "Run jump sprint"}</div>
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
    playerHealth: root.querySelector("#playerHealth"),
    coinCount: root.querySelector("#coinCount"),
    healthCount: root.querySelector("#healthCount"),
    manaCount: root.querySelector("#manaCount"),
    magicCount: root.querySelector("#magicCount"),
    bombCount: root.querySelector("#bombCount")
  };

  refs.tutorialPanel = root.querySelector("#tutorialPanel");
  refs.tutorialCount = root.querySelector("#tutorialCount");
  refs.tutorialStep = root.querySelector("#tutorialStep");
  refs.tutorialInstruction = root.querySelector("#tutorialInstruction");
  refs.tutorialCommand = root.querySelector("#tutorialCommand");
  refs.tutorialProgress = root.querySelector("#tutorialProgress");
  refs.spaceHint = root.querySelector("#spaceHint");
  refs.movementHint = root.querySelector("#movementHint");

  if (refs.levelInput) {
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
  }
  return refs;
}

function refreshInventory() {
  hud.playerHealth.textContent = state.player.health;
  hud.coinCount.textContent = state.inventory.coins;
  hud.healthCount.textContent = state.inventory.health;
  hud.manaCount.textContent = state.inventory.mana;
  hud.magicCount.textContent = state.inventory.magic;
  hud.bombCount.textContent = state.inventory.bombs;
}

function setStatus(text) {
  hud.statusLine.textContent = text;
}

function tutorialActionUnlocked(action) {
  if (!isTutorial || state.tutorial.portalActive) return true;
  const unlockStep = { movement: 0, sprint: 1, jump: 2, attack: 3, items: 4, selectItem: 5, special: 6 };
  return state.tutorial.step >= unlockStep[action];
}

function tutorialProgress() {
  if (!isTutorial) return 0;
  const tutorial = state.tutorial;
  if (tutorial.advancing) return 1;
  if (tutorial.step === 0) return tutorial.movementKeys.size / 4;
  if (tutorial.step === 1) return clamp(tutorial.sprintDistance / (3 * meter), 0, 1);
  return 0;
}

function refreshTutorialHud() {
  if (!isTutorial) return;
  const tutorial = state.tutorial;
  if (tutorial.portalActive) {
    hud.tutorialCount.textContent = "Training complete";
    hud.tutorialStep.textContent = "The Way Forward";
    hud.tutorialInstruction.textContent = "A portal has opened. Step into its center.";
    hud.tutorialCommand.textContent = "ENTER PORTAL";
    hud.tutorialProgress.style.width = "100%";
    hud.movementHint.textContent = "All actions unlocked";
    hud.spaceHint.classList.remove("tutorial-concealed");
    return;
  }
  const lesson = tutorialSteps[tutorial.step];
  hud.tutorialCount.textContent = `Lesson ${tutorial.step + 1} / ${tutorialSteps.length}`;
  hud.tutorialStep.textContent = tutorial.advancing ? `${lesson.title} complete` : lesson.title;
  hud.tutorialInstruction.textContent = tutorial.advancing ? "Preparing the next lesson..." : lesson.instruction;
  hud.tutorialCommand.textContent = tutorial.advancing ? "COMPLETE" : lesson.command;
  hud.tutorialProgress.style.width = `${tutorialProgress() * 100}%`;
  if (tutorial.step >= 2) hud.spaceHint.classList.remove("tutorial-concealed");
  hud.movementHint.textContent = tutorial.step === 0 ? "Movement unlocked" : tutorial.step === 1 ? "Sprint unlocked" : "Move jump sprint";
}

function completeTutorialStep(expectedStep) {
  if (!isTutorial || state.tutorial.step !== expectedStep || state.tutorial.advancing) return;
  state.tutorial.advancing = true;
  setStatus("Lesson complete");
  refreshTutorialHud();
  window.setTimeout(() => {
    if (expectedStep === tutorialSteps.length - 1) {
      state.tutorial.portalActive = true;
      state.tutorial.advancing = false;
      hud.itemMenu.classList.add("hidden");
      setStatus("Portal opened");
    } else {
      state.tutorial.step += 1;
      state.tutorial.advancing = false;
      setStatus(tutorialSteps[state.tutorial.step].title);
    }
    refreshTutorialHud();
  }, 650);
}

function startTransition(target, delay = 0) {
  if (state.transitioning) return;
  state.transitioning = true;
  state.transitionTarget = target;
  state.transitionDelay = delay;
  state.fade = 0;
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

function cameraDepth(x, y) {
  return rotate(x - state.player.x, y - state.player.y, -state.yaw).y;
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

function poly(points, fill, stroke = null, lineWidth = 1, alpha = 1, target = g) {
  target.poly(points.flatMap((point) => [point.x, point.y])).fill({ color: fill, alpha });
  if (stroke !== null) {
    target.stroke({ color: stroke, width: lineWidth, alpha: 1 });
  }
}

function centeredRect(x, y, w, h, fill, stroke = null, target = g) {
  target.rect(Math.round(x - w / 2), Math.round(y - h / 2), w, h).fill(fill);
  if (stroke !== null) target.stroke({ color: stroke, width: 2 });
}

function line(a, b, stroke, width = 2, alpha = 1, target = g) {
  target.moveTo(a.x, a.y).lineTo(b.x, b.y).stroke({ color: stroke, width, alpha });
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
  return samples.every(([sx, sy]) => pointInRawWalkable(sx, sy));
}

function groundElevation(x, y) {
  if (level.kind !== "dungeon") return 0;
  const stair = { x: -370, y: -842, w: 100, h: 454 };
  if (pointInRect(x, y, stair)) {
    const progress = clamp((-y - 388) / stair.h, 0, 1);
    return progress * level.platformHeight;
  }
  if (pointInRect(x, y, level.upperPlatform)) return level.platformHeight;
  for (const column of level.columns) {
    if (Math.hypot(x - column.x, y - column.y) <= 24) return 70;
  }
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

function drawTutorialFloor() {
  const boundary = level.bounds[0];
  const baseX = Math.floor(state.player.x / tile);
  const baseY = Math.floor(state.player.y / tile);
  for (let gy = baseY - 14; gy <= baseY + 14; gy += 1) {
    for (let gx = baseX - 14; gx <= baseX + 14; gx += 1) {
      const centerX = gx * tile + tile / 2;
      const centerY = gy * tile + tile / 2;
      const dist = Math.hypot(centerX - state.player.x, centerY - state.player.y);
      if (dist <= tile * 13.2 && pointInRect(centerX, centerY, boundary)) drawTile(gx, gy);
    }
  }
  if (state.tutorial.portalActive) drawPortal();
}

function drawPortal() {
  const portal = state.tutorial.portal;
  const p = worldToScreen(portal.x, portal.y);
  const pulse = 1 + Math.sin(performance.now() * 0.004) * 0.08;
  const s = state.zoom;
  g.ellipse(p.x, p.y, 82 * s * pulse, 32 * s * pulse)
    .fill({ color: 0x2c0e38, alpha: 0.32 });
  g.ellipse(p.x, p.y, 66 * s, 25 * s)
    .fill({ color: 0x030204, alpha: 0.96 })
    .stroke({ color: 0xb45bd6, width: 4 * s, alpha: 0.9 });
  g.ellipse(p.x, p.y, 47 * s, 17 * s)
    .stroke({ color: 0x63d4ca, width: 2 * s, alpha: 0.66 });
  for (let i = 0; i < 7; i += 1) {
    const angle = performance.now() * 0.0012 + i * Math.PI * 2 / 7;
    const radius = 42 + Math.sin(angle * 2.4) * 7;
    const mote = worldToScreen(
      portal.x + Math.cos(angle) * radius,
      portal.y + Math.sin(angle) * radius,
      12 + Math.sin(angle * 1.7) * 10
    );
    g.circle(mote.x, mote.y, (2.5 + (i % 2)) * s)
      .fill({ color: i % 2 ? 0x7ce0d3 : 0xcf72ee, alpha: 0.78 });
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
  const fadeHeight = Math.max(4, h * 0.05);
  const fadeSteps = 5;
  for (let i = 0; i < fadeSteps; i += 1) {
    const lower = i / fadeSteps;
    const upper = (i + 1) / fadeSteps;
    poly([
      { x: a.x, y: a.y - h + fadeHeight * lower },
      { x: b.x, y: b.y - h + fadeHeight * lower },
      { x: b.x, y: b.y - h + fadeHeight * upper },
      { x: a.x, y: a.y - h + fadeHeight * upper }
    ], 0x8a8883, null, 1, 0.72 - i * 0.11);
  }
}

function texturedFace(points, texture, tint = 0xffffff, alpha = 1, scale = 0.13, target = g) {
  target.poly(points.flatMap((point) => [point.x, point.y])).fill({
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
  texturedFace(top, art.floor, 0xf0dfc3, 1, 0.11);
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

function drawElevatedExit(target = g) {
  const z = level.platformHeight;
  const x1 = level.exit.x;
  const x2 = level.exit.x + level.exit.w;
  const y = -919;
  const height = 112;
  const bottomLeft = worldToScreen(x1, y, z);
  const bottomRight = worldToScreen(x2, y, z);
  const topRight = worldToScreen(x2, y, z + height);
  const topLeft = worldToScreen(x1, y, z + height);
  poly([bottomLeft, bottomRight, topRight, topLeft], 0x24150f, 0xb5904e, 4, 1, target);
  for (let i = 1; i < 4; i += 1) {
    const t = i / 4;
    line(
      { x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * t, y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * t },
      { x: topLeft.x + (topRight.x - topLeft.x) * t, y: topLeft.y + (topRight.y - topLeft.y) * t },
      0x7a4a2b,
      2,
      0.75,
      target
    );
  }
  line(topLeft, topRight, 0xe2c078, 5, 0.9, target);
  line(bottomLeft, topLeft, 0x72552e, 4, 0.95, target);
  line(bottomRight, topRight, 0x72552e, 4, 0.95, target);
  target.circle(bottomRight.x - 9 * state.zoom, bottomRight.y - 42 * state.zoom, 3 * state.zoom).fill(0xd4a64e);
}

function drawStairs(target = g, foregroundOnly = false) {
  const steps = 12;
  const width = 100;
  const depth = 42;
  const stride = 37;
  const startY = -430;
  for (let i = steps - 1; i >= 0; i -= 1) {
    const z = level.platformHeight * (i + 1) / steps;
    const previousZ = level.platformHeight * i / steps;
    const rect = { x: -370, y: startY - i * stride, w: width, h: depth };
    if (foregroundOnly && cameraDepth(rect.x + rect.w / 2, rect.y + rect.h / 2) <= 10) continue;
    const top = [
      worldToScreen(rect.x, rect.y, z), worldToScreen(rect.x + rect.w, rect.y, z),
      worldToScreen(rect.x + rect.w, rect.y + rect.h, z), worldToScreen(rect.x, rect.y + rect.h, z)
    ];
    const riser = [
      top[3], top[2],
      worldToScreen(rect.x + rect.w, rect.y + rect.h, previousZ),
      worldToScreen(rect.x, rect.y + rect.h, previousZ)
    ];
    poly(riser, 0x3a332a, 0x080706, 2, 1, target);
    texturedFace(riser, art.wall, 0xb09c7f, 0.8, 0.09, target);
    poly(top, 0x575047, 0x080706, 2, 1, target);
    texturedFace(top, art.floor, 0xe0d1b7, 1, 0.1, target);
    line(top[3], top[2], 0xe0c88e, 2.2, 0.8, target);
  }
}

function drawUpperPlatformOccluder() {
  const rect = level.upperPlatform;
  const playerOnPlatform = state.player.floorZ >= level.platformHeight - 8 && pointInRect(state.player.x, state.player.y, rect, 8);
  if (playerOnPlatform || cameraDepth(rect.x + rect.w / 2, rect.y + rect.h / 2) <= 10) return;
  const z = level.platformHeight;
  const top = [
    worldToScreen(rect.x, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y + rect.h, z),
    worldToScreen(rect.x, rect.y + rect.h, z)
  ];
  const front = [
    top[3], top[2],
    worldToScreen(rect.x + rect.w, rect.y + rect.h, z - 38),
    worldToScreen(rect.x, rect.y + rect.h, z - 38)
  ];
  poly(front, 0x3a332a, 0x080706, 2, 1, occlusionLayer);
  texturedFace(front, art.wall, 0xc0ad91, 1, 0.1, occlusionLayer);
  poly(top, 0x514b42, 0x080706, 2, 1, occlusionLayer);
  texturedFace(top, art.floor, 0xf0dfc3, 1, 0.11, occlusionLayer);
  line(top[3], top[2], 0xe2c88f, 4, 0.9, occlusionLayer);
}

function drawForegroundOccluders() {
  if (level.kind !== "dungeon") return;
  const playerOnPlatform = state.player.floorZ >= level.platformHeight - 8 && pointInRect(state.player.x, state.player.y, level.upperPlatform, 8);
  drawUpperPlatformOccluder();
  if (cameraDepth(level.exit.x + level.exit.w / 2, level.exit.y + level.exit.h / 2) > 8) drawElevatedExit(occlusionLayer);
  drawStairs(occlusionLayer, true);
  const columns = level.columns
    .filter(() => !playerOnPlatform)
    .filter((column) => cameraDepth(column.x, column.y) > 8)
    .filter((column) => !(state.player.floorZ >= 62 && Math.hypot(state.player.x - column.x, state.player.y - column.y) < 30))
    .sort((a, b) => cameraDepth(a.x, a.y) - cameraDepth(b.x, b.y));
  for (const column of columns) drawColumn(column, occlusionLayer);
  for (const coin of level.coins) {
    if (!coin.collected && cameraDepth(coin.x, coin.y) > 8) drawCoin(coin, occlusionLayer);
  }
  for (const potion of level.potions) {
    if (!potion.collected && cameraDepth(potion.x, potion.y) > 8) drawPotion(potion, occlusionLayer);
  }
}

function objectScreenY(object) {
  return worldToScreen(object.x, object.y).y;
}

function drawSceneObjects() {
  const objects = [
    { x: level.upperPlatform.x + level.upperPlatform.w / 2, y: level.upperPlatform.y + level.upperPlatform.h, kind: "upperPlatform" },
    ...level.columns.map((o) => ({ ...o, kind: "column" })),
    ...level.torches.map((o) => ({ ...o, kind: "torch" })),
    ...level.coins.filter((o) => !o.collected).map((o) => ({ ...o, kind: "coin" })),
    ...level.potions.filter((o) => !o.collected).map((o) => ({ ...o, kind: "potion" }))
  ].sort((a, b) => objectScreenY(a) - objectScreenY(b));
  for (const object of objects) {
    if (object.kind === "upperPlatform") drawUpperPlatform();
    if (object.kind === "column") drawColumn(object);
    if (object.kind === "torch") drawTorch(object);
    if (object.kind === "coin") drawCoin(object);
    if (object.kind === "potion") drawPotion(object);
  }
}

function drawColumn(column, target = g) {
  const p = worldToScreen(column.x, column.y);
  const z = 70 * state.zoom;
  const s = state.zoom;
  target.ellipse(p.x + 9 * s, p.y + 8 * s, 28 * s, 11 * s).fill({ color: 0x000000, alpha: 0.44 });
  poly([
    { x: p.x - 13 * s, y: p.y - 9 * s }, { x: p.x + 13 * s, y: p.y - 9 * s },
    { x: p.x + 9 * s, y: p.y - z + 7 * s }, { x: p.x - 9 * s, y: p.y - z + 7 * s }
  ], 0x3d382f, 0x0a0806, 2, 1, target);
  poly([
    { x: p.x - 9 * s, y: p.y - z + 7 * s }, { x: p.x + 9 * s, y: p.y - z + 7 * s },
    { x: p.x + 5 * s, y: p.y - z + 13 * s }, { x: p.x - 5 * s, y: p.y - z + 13 * s }
  ], 0x71634d, null, 1, 0.5, target);
  centeredRect(p.x, p.y - z - 2 * s, 42 * s, 11 * s, 0x332d25, 0x090706, target);
  centeredRect(p.x, p.y - z - 10 * s, 32 * s, 8 * s, 0x51483a, 0x090706, target);
  centeredRect(p.x, p.y - 2 * s, 42 * s, 12 * s, 0x2b261f, 0x090706, target);
  centeredRect(p.x, p.y - 10 * s, 32 * s, 8 * s, 0x574b3a, 0x090706, target);
  line({ x: p.x - 3 * s, y: p.y - 20 * s }, { x: p.x + 1 * s, y: p.y - 42 * s }, 0x17130f, 2, 0.7, target);
}

function drawCoin(coin, target = g) {
  const p = worldToScreen(coin.x, coin.y);
  const bob = Math.sin(performance.now() * 0.004 + coin.x) * 3 * state.zoom;
  const y = p.y - 8 * state.zoom + bob;
  target.ellipse(p.x + 3, p.y + 3, 10 * state.zoom, 4 * state.zoom).fill({ color: 0x000000, alpha: 0.38 });
  target.ellipse(p.x, y, 8 * state.zoom, 11 * state.zoom).fill(0xd9a936).stroke({ color: 0x51300d, width: 2 });
  target.ellipse(p.x, y, 4.5 * state.zoom, 7 * state.zoom).stroke({ color: 0xffe29a, width: 1.5, alpha: 0.7 });
  line({ x: p.x - 2, y: y - 7 }, { x: p.x + 2, y: y + 4 }, 0xfff1bd, 1.5, 0.8, target);
}

function drawPotion(potion, target = g) {
  const p = worldToScreen(potion.x, potion.y);
  const s = state.zoom;
  const pulse = 1 + Math.sin(performance.now() * 0.004 + potion.x) * 0.08;
  target.circle(p.x, p.y - 10 * s, 31 * s * pulse).fill({ color: potion.glow, alpha: 0.16 });
  target.ellipse(p.x + 3 * s, p.y + 3 * s, 13 * s, 5 * s).fill({ color: 0x000000, alpha: 0.42 });
  target.roundRect(p.x - 10 * s, p.y - 25 * s, 20 * s, 25 * s, 7 * s)
    .fill({ color: potion.color, alpha: 0.9 }).stroke({ color: 0x170e18, width: 2.5 });
  target.roundRect(p.x - 4 * s, p.y - 34 * s, 8 * s, 11 * s, 2 * s)
    .fill(0x685646).stroke({ color: 0x170e18, width: 2 });
  target.circle(p.x - 4 * s, p.y - 17 * s, 3 * s).fill({ color: 0xffffff, alpha: 0.56 });
  line({ x: p.x - 7 * s, y: p.y - 4 * s }, { x: p.x + 7 * s, y: p.y - 4 * s }, 0xe8d9bd, 2, 0.48, target);
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

function directionRowForHeading(heading) {
  const direction = groundDirection(heading);
  const angle = Math.atan2(direction.y, direction.x);
  return ((Math.round((angle - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
}

function actorDirectionRow() {
  return directionRowForHeading(state.player.heading);
}

function drawCharacter() {
  const player = state.player;
  actorLayer.visible = !state.tutorial?.portalHidden;
  if (!actorLayer.visible) return;
  const moving = isMoving();
  const row = actorDirectionRow();
  let column = 0;
  let sheet = art.action;
  const throwProgress = player.bombThrowTime > 0 ? 1 - player.bombThrowTime / bombThrowDuration : 0;
  if (player.rollTime > 0) {
    sheet = art.low;
    column = 3 + Math.floor((1 - player.rollTime / 0.55) * 3) % 3;
  } else if (player.bombThrowTime > 0) {
    sheet = art.bomb;
    column = Math.min(6, Math.floor(throwProgress * 7));
  } else if (player.holdingBomb && player.attackTime > 0) {
    sheet = art.bombCombat;
    column = 2;
  } else if (player.holdingBomb) {
    sheet = art.bomb;
    column = 0;
  } else if (player.attackTime > 0) {
    column = 1;
  } else if (!player.grounded || player.jumpArm > 0.12) {
    column = 2;
  } else if (player.landTime > 0) {
    column = 3;
  } else if (player.stance === "crouch") {
    sheet = art.low;
    column = moving ? Math.floor(player.stride / (Math.PI * 0.75)) % 3 : 0;
  } else if (player.stance === "crawl") {
    sheet = art.crawl;
    column = moving ? Math.floor(player.stride / (Math.PI / 3)) % 6 : 0;
  } else if (moving) {
    sheet = player.stealth ? art.runStealth : art.run;
    const frameCount = player.stealth ? 4 : 8;
    column = Math.floor((((player.stride % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI * 2 / frameCount)) % frameCount;
  }

  actorShadow.clear();
  actorFx.clear();
  const baseX = state.width / 2;
  const baseY = state.height / 2 + 18;
  actorLayer.zIndex = baseY;
  const shadowScale = 1 - clamp(player.z / 240, 0, 0.48);
  actorShadow.ellipse(baseX + 4, baseY + 2, 34 * shadowScale * state.zoom, 12 * shadowScale * state.zoom)
    .fill({ color: 0x000000, alpha: 0.52 });

  actorSprite.texture = sheet[row][column];
  const rolling = player.rollTime > 0;
  actorSprite.anchor.set(0.5, rolling ? 0.5 : player.stance === "crawl" ? 0.76 : player.stance === "crouch" ? 0.82 : 0.9);
  const targetHeight = rolling ? 112 : player.stance === "crawl" ? 112 : player.stance === "crouch" ? 124 : 142;
  let scale = targetHeight / actorSprite.texture.height * state.zoom;
  let poseX = 0;
  let poseY = 0;
  let poseRotation = 0;
  if (player.bombThrowTime > 0) {
    const stage = Math.min(5, Math.floor(throwProgress * 6));
    const direction = groundDirection(player.heading);
    const stageLean = [-2, -6, -10, 8, 11, 3][stage] * state.zoom;
    poseX = direction.x * stageLean;
    poseY = direction.y * stageLean - [0, 2, 5, 7, 3, 0][stage] * state.zoom;
    poseRotation = [-0.01, -0.035, -0.065, 0.045, 0.025, 0][stage] * (row >= 4 ? -1 : 1);
    scale *= [1, 0.985, 0.97, 1.025, 1.01, 1][stage];
  }
  actorSprite.position.set(baseX + poseX, baseY + poseY - player.z - (rolling ? targetHeight * state.zoom * 0.4 : 0));
  actorSprite.scale.set(scale);
  actorSprite.rotation = rolling ? (1 - player.rollTime / 0.55) * Math.PI * 2 : poseRotation;
  actorSprite.alpha = 1;

  if (player.stealth && sheet !== art.runStealth && player.rollTime <= 0) {
    const hoodYFactor = player.stance === "crawl" ? 0.2 : player.stance === "crouch" ? 0.62 : 0.72;
    const hoodX = actorSprite.x;
    const hoodY = actorSprite.y - targetHeight * state.zoom * hoodYFactor;
    const hoodRadius = (player.stance === "crawl" ? 12 : 17) * state.zoom;
    if (row >= 3 && row <= 5) {
      actorFx.ellipse(hoodX, hoodY, hoodRadius * 1.05, hoodRadius * 1.18)
        .fill(0x1a1512).stroke({ color: 0x080706, width: 2.2 * state.zoom });
      actorFx.moveTo(hoodX - hoodRadius, hoodY + hoodRadius * 0.35)
        .lineTo(hoodX, hoodY + hoodRadius * 1.45)
        .lineTo(hoodX + hoodRadius, hoodY + hoodRadius * 0.35)
        .fill(0x241915);
    } else {
      actorFx.arc(hoodX, hoodY, hoodRadius, Math.PI * 0.88, Math.PI * 2.12)
        .stroke({ color: 0x1a1512, width: 8 * state.zoom });
      actorFx.arc(hoodX, hoodY, hoodRadius + 2 * state.zoom, Math.PI * 0.9, Math.PI * 2.1)
        .stroke({ color: 0x080706, width: 2 * state.zoom, alpha: 0.9 });
    }
  }

  if (player.attackTime > 0) {
    const attackProgress = 1 - player.attackTime / 0.28;
    const start = -1.15 + attackProgress * 0.65;
    actorFx.arc(baseX, baseY - 46 - player.z, 62 * state.zoom, start, start + 1.25)
      .stroke({ color: 0xf3d69a, width: 5 * state.zoom, alpha: 0.42 });
    actorFx.arc(baseX, baseY - 46 - player.z, 69 * state.zoom, start + 0.12, start + 1.05)
      .stroke({ color: 0xffffff, width: 1.5 * state.zoom, alpha: 0.72 });
  }

}

function createEnemyVisual(enemy) {
  const container = new Container();
  const shadow = new Graphics();
  const sprite = new Sprite(art.slime[0][0]);
  const healthBar = new Graphics();
  sprite.anchor.set(0.5, 0.9);
  container.addChild(shadow, sprite, healthBar);
  entityLayer.addChild(container);
  enemy.visual = { container, shadow, sprite, healthBar };
}

function slimeAnimationColumn(enemy) {
  const t = enemy.jumpClock / enemy.cycleDuration;
  if (t < 0.14) return 0;
  if (t < 0.25) return 1;
  if (t < 0.34) return 2;
  if (t < 0.48) return 3;
  if (t < 0.59) return 4;
  if (t < 0.76) return 5;
  if (t < 0.88) return 6;
  return 7;
}

function drawEnemies() {
  for (const enemy of state.enemies) {
    if (!enemy.visual) createEnemyVisual(enemy);
    const { container, shadow, sprite, healthBar } = enemy.visual;
    container.visible = enemy.alive;
    if (!enemy.alive) continue;
    const base = worldToScreen(enemy.x, enemy.y, groundElevation(enemy.x, enemy.y));
    const row = directionRowForHeading(enemy.heading);
    const column = slimeAnimationColumn(enemy);
    shadow.clear();
    healthBar.clear();
    shadow.ellipse(base.x + 3 * state.zoom, base.y + 3 * state.zoom, 34 * state.zoom, 12 * state.zoom)
      .fill({ color: 0x000000, alpha: 0.48 });
    sprite.texture = art.slime[row][column];
    const scale = 78 / sprite.texture.height * state.zoom;
    sprite.scale.set(scale);
    sprite.position.set(base.x, base.y - enemy.z * state.zoom);
    if (enemy.health < enemy.maxHealth) {
      const width = 48 * state.zoom;
      const y = sprite.y - 70 * state.zoom;
      healthBar.roundRect(base.x - width / 2, y, width, 6 * state.zoom, 2 * state.zoom)
        .fill({ color: 0x120d09, alpha: 0.92 });
      healthBar.roundRect(base.x - width / 2 + 1, y + 1, (width - 2) * enemy.health / enemy.maxHealth, 4 * state.zoom, 1.5 * state.zoom)
        .fill(0xaac53a);
    }
    container.zIndex = base.y;
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

function chooseSlimeLanding(enemy) {
  enemy.originX = enemy.x;
  enemy.originY = enemy.y;
  const dx = state.player.x - enemy.x;
  const dy = state.player.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const travel = Math.min(108, distance);
  const variation = (hash(Math.round(enemy.x), Math.round(enemy.y), Math.floor(performance.now() / 1000)) - 0.5) * 34;
  const candidateX = enemy.x + dx / distance * travel - dy / distance * variation;
  const candidateY = enemy.y + dy / distance * travel + dx / distance * variation;
  const chamber = level.bounds[2];
  if (pointInWalkable(candidateX, candidateY, 22) && pointInRect(candidateX, candidateY, chamber, -22) && groundElevation(candidateX, candidateY) < 8) {
    enemy.targetX = candidateX;
    enemy.targetY = candidateY;
    enemy.heading = Math.atan2(candidateY - enemy.y, candidateX - enemy.x);
  } else {
    enemy.targetX = enemy.x;
    enemy.targetY = enemy.y;
    enemy.heading = Math.atan2(dy, dx);
  }
}

function updateEnemies(delta) {
  const player = state.player;
  player.contactDamageCooldown = Math.max(0, player.contactDamageCooldown - delta);
  player.hitFlash = Math.max(0, player.hitFlash - delta);
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    enemy.jumpClock += delta;
    if (enemy.jumpClock >= enemy.cycleDuration) {
      enemy.jumpClock %= enemy.cycleDuration;
      chooseSlimeLanding(enemy);
    }
    const t = enemy.jumpClock / enemy.cycleDuration;
    if (t >= 0.25 && t <= 0.88) {
      const q = clamp((t - 0.25) / 0.63, 0, 1);
      const eased = q * q * (3 - 2 * q);
      enemy.x = enemy.originX + (enemy.targetX - enemy.originX) * eased;
      enemy.y = enemy.originY + (enemy.targetY - enemy.originY) * eased;
      enemy.z = Math.sin(q * Math.PI) * 62;
    } else {
      if (t > 0.88) {
        enemy.x = enemy.targetX;
        enemy.y = enemy.targetY;
      }
      enemy.z = 0;
    }
    const sameHeight = Math.abs((groundElevation(enemy.x, enemy.y) + enemy.z) - (player.floorZ + player.z)) < 30;
    if (sameHeight && Math.hypot(player.x - enemy.x, player.y - enemy.y) < 34 && player.contactDamageCooldown <= 0) {
      player.health = Math.max(0, player.health - enemy.contactDamage);
      player.contactDamageCooldown = 2;
      player.hitFlash = 0.24;
      refreshInventory();
      setStatus(`${enemy.name} dealt ${enemy.contactDamage} damage`);
    }
  }
}

function blastPathClear(explosion, enemy) {
  const targetZ = groundElevation(enemy.x, enemy.y) + enemy.z + 18;
  for (let step = 1; step < 10; step += 1) {
    const t = step / 10;
    const x = explosion.x + (enemy.x - explosion.x) * t;
    const y = explosion.y + (enemy.y - explosion.y) * t;
    const z = explosion.z + (targetZ - explosion.z) * t;
    if (!pointInRawWalkable(x, y) || groundElevation(x, y) > z + 5) return false;
    if (level.columns.some((column) => Math.hypot(x - column.x, y - column.y) < 25 && z < 76)) return false;
  }
  return true;
}

function explodeBomb(projectile) {
  const explosion = { x: projectile.x, y: projectile.y, z: Math.max(projectile.z, groundElevation(projectile.x, projectile.y)), age: 0, duration: 0.52 };
  state.explosions.push(explosion);
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const enemyZ = groundElevation(enemy.x, enemy.y) + enemy.z + 18;
    const distance = Math.hypot(enemy.x - explosion.x, enemy.y - explosion.y, enemyZ - explosion.z);
    if (distance <= meter && blastPathClear(explosion, enemy)) {
      enemy.health = Math.max(0, enemy.health - 50);
      enemy.alive = enemy.health > 0;
    }
  }
  const defeated = state.enemies.filter((enemy) => !enemy.alive).length;
  setStatus(defeated ? `Bomb impact - ${defeated} slime${defeated === 1 ? "" : "s"} defeated` : "Bomb impact");
}

function updateBombs(delta) {
  for (const projectile of state.projectiles) {
    if (projectile.exploded) continue;
    if (projectile.releaseDelay > 0) {
      projectile.releaseDelay -= delta;
      projectile.x = state.player.x;
      projectile.y = state.player.y;
      projectile.z = state.player.floorZ + state.player.z + 58;
      if (projectile.releaseDelay > 0) continue;
      projectile.released = true;
    }
    const previousX = projectile.x;
    const previousY = projectile.y;
    const previousZ = projectile.z;
    const nextX = projectile.x + projectile.vx * delta;
    const nextY = projectile.y + projectile.vy * delta;
    const nextZ = projectile.z + projectile.vz * delta;
    projectile.vz -= gravity * delta;
    const hitWall = !pointInWalkable(nextX, nextY, 5) ||
      level.columns.some((column) => Math.hypot(nextX - column.x, nextY - column.y) < 25 && nextZ < 76);
    const floorZ = groundElevation(nextX, nextY);
    if (hitWall || nextZ <= floorZ + 5) {
      projectile.x = hitWall ? previousX : nextX;
      projectile.y = hitWall ? previousY : nextY;
      projectile.z = hitWall ? previousZ : floorZ;
      projectile.exploded = true;
      explodeBomb(projectile);
    } else {
      projectile.x = nextX;
      projectile.y = nextY;
      projectile.z = nextZ;
    }
  }
  state.projectiles = state.projectiles.filter((projectile) => !projectile.exploded);
  for (const explosion of state.explosions) explosion.age += delta;
  state.explosions = state.explosions.filter((explosion) => explosion.age < explosion.duration);
}

function drawBombEffects() {
  effectsLayer.clear();
  for (const projectile of state.projectiles) {
    if (!projectile.released) continue;
    const p = worldToScreen(projectile.x, projectile.y, projectile.z);
    effectsLayer.circle(p.x, p.y, 9 * state.zoom).fill(0x15120f).stroke({ color: 0x8e7856, width: 2 * state.zoom });
    effectsLayer.moveTo(p.x + 3 * state.zoom, p.y - 7 * state.zoom)
      .lineTo(p.x + 7 * state.zoom, p.y - 14 * state.zoom)
      .stroke({ color: 0xd9b36b, width: 2 * state.zoom });
    effectsLayer.circle(p.x + 8 * state.zoom, p.y - 15 * state.zoom, 4 * state.zoom).fill(0xff8a35);
  }
  for (const explosion of state.explosions) {
    const progress = explosion.age / explosion.duration;
    const p = worldToScreen(explosion.x, explosion.y, explosion.z);
    const radius = meter * state.zoom * Math.sin(progress * Math.PI);
    effectsLayer.ellipse(p.x, p.y, radius, radius * state.projectionY)
      .fill({ color: 0xf06a24, alpha: 0.28 * (1 - progress) })
      .stroke({ color: 0xffcf6a, width: 4 * state.zoom, alpha: 0.8 * (1 - progress) });
    effectsLayer.circle(p.x, p.y - radius * 0.3, radius * 0.48)
      .fill({ color: 0xffa43b, alpha: 0.38 * (1 - progress) });
    for (let i = 0; i < 8; i += 1) {
      const angle = i * Math.PI / 4 + progress;
      effectsLayer.circle(p.x + Math.cos(angle) * radius * 0.78, p.y + Math.sin(angle) * radius * 0.42, 3 * state.zoom)
        .fill({ color: i % 2 ? 0xffd27a : 0xb9381f, alpha: 1 - progress });
    }
  }
}

function update(delta) {
  let mx = 0;
  let my = 0;
  if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) my -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) my += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) mx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) mx += 1;

  const player = state.player;
  let moving = mx !== 0 || my !== 0;
  const sprinting = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight");
  const tutorial = state.tutorial;

  if (tutorial?.portalActive && !tutorial.portalDive && Math.hypot(player.x - tutorial.portal.x, player.y - tutorial.portal.y) <= 1.25 * meter) {
    tutorial.portalPull = true;
  }

  if (tutorial?.portalPull && !tutorial.portalDive) {
    const dx = tutorial.portal.x - player.x;
    const dy = tutorial.portal.y - player.y;
    const distance = Math.hypot(dx, dy);
    moving = true;
    if (distance > 0.1 * meter) {
      const travel = Math.min(player.speed * 1.15 * delta, distance);
      movePlayer(dx / distance * travel, dy / distance * travel);
      player.heading = Math.atan2(dy, dx);
      player.stride += delta * 14;
    } else {
      player.x = tutorial.portal.x;
      player.y = tutorial.portal.y;
      player.grounded = false;
      player.vz = 500;
      player.jumpAge = 0;
      player.jumpArm = 1;
      tutorial.portalDive = true;
      tutorial.portalDiveTime = 0;
      tutorial.portalHidden = false;
      startTransition("level1.html?fade=1", 0.28);
    }
  } else if (moving && !tutorial?.portalDive && player.rollTime <= 0) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.lastMoveX = mx;
    player.lastMoveY = my;
    const worldMove = rotate(mx, my, state.yaw);
    const stanceSpeed = player.stance === "crawl" ? 0.28 : player.stance === "crouch" ? 0.45 : 1;
    const speed = player.speed * (sprinting && player.stance === "stand" ? 1.75 : 1) * stanceSpeed;
    const distance = movePlayer(worldMove.x * speed * delta, worldMove.y * speed * delta);
    if (tutorial && tutorial.step === 1 && sprinting && !tutorial.advancing) {
      tutorial.sprintDistance += distance;
      refreshTutorialHud();
      if (tutorial.sprintDistance >= 3 * meter) completeTutorialStep(1);
    }
    player.heading = Math.atan2(worldMove.y, worldMove.x);
    player.stride += delta * (sprinting ? 12 : 15);
  } else {
    player.stride *= Math.pow(0.0008, delta);
  }

  if (tutorial?.portalDive) {
    tutorial.portalDiveTime += delta;
    if (tutorial.portalDiveTime >= 0.2) tutorial.portalHidden = true;
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
      player.landTime = 0.18;
      if (tutorial?.jumpStarted && tutorial.step === 2) {
        tutorial.jumpStarted = false;
        completeTutorialStep(2);
      }
    }
  }
  player.jumpArm += ((player.grounded ? 0 : clamp(1 - player.jumpAge / 0.34, 0, 1)) - player.jumpArm) * (1 - Math.exp(-(player.grounded ? 18 : 24) * delta));
  player.attackTime = Math.max(0, player.attackTime - delta);
  player.specialTime = Math.max(0, player.specialTime - delta);
  player.interactTime = Math.max(0, player.interactTime - delta);
  player.bombThrowTime = Math.max(0, player.bombThrowTime - delta);
  player.landTime = Math.max(0, player.landTime - delta);

  if (level.kind === "dungeon") {
    player.floorZ = groundElevation(player.x, player.y);
    collectItems();
    const targetZoom = pointInRect(player.x, player.y, level.bounds[1], 26) ? 1.65 : 1;
    state.zoom += (targetZoom - state.zoom) * (1 - Math.exp(-5 * delta));
    if (!state.transitioning && player.floorZ >= level.platformHeight * 0.85 && pointInRect(player.x, player.y, level.exit, 10)) {
      startTransition("level0.html?fade=1");
    }
  }

  updateBombs(delta);
  updateEnemies(delta);

  if (state.transitioning) {
    state.transitionDelay = Math.max(0, state.transitionDelay - delta);
    if (state.transitionDelay === 0) state.fade = Math.min(1, state.fade + delta);
    if (state.fade >= 1 && state.transitionTarget) window.location.href = state.transitionTarget;
  } else if (state.fade > 0) {
    state.fade = Math.max(0, state.fade - delta);
  }
}

function movePlayer(dx, dy) {
  const player = state.player;
  const startX = player.x;
  const startY = player.y;
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const maxStepHeight = 18;
  let currentElevation = groundElevation(player.x, player.y);
  let airborneWorldZ = currentElevation + player.z;
  const canTraverse = (elevation) => player.grounded
    ? Math.abs(elevation - currentElevation) <= maxStepHeight
    : elevation <= airborneWorldZ + 2;
  const applyElevation = (elevation) => {
    if (!player.grounded) player.z = Math.max(0, airborneWorldZ - elevation);
    currentElevation = elevation;
  };
  const nextXElevation = groundElevation(nextX, player.y);
  if (pointInWalkable(nextX, player.y, 16) && canTraverse(nextXElevation)) {
    player.x = nextX;
    applyElevation(nextXElevation);
  }
  const nextYElevation = groundElevation(player.x, nextY);
  if (pointInWalkable(player.x, nextY, 16) && canTraverse(nextYElevation)) {
    player.y = nextY;
    applyElevation(nextYElevation);
  }
  player.floorZ = currentElevation;
  return Math.hypot(player.x - startX, player.y - startY);
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
  occlusionLayer.clear();
  floorSpriteCount = 0;
  if (level.kind === "infinite") drawInfiniteFloor();
  else if (level.kind === "tutorial") drawTutorialFloor();
  else drawDungeonFloor();
  for (let i = floorSpriteCount; i < floorLayer.children.length; i += 1) floorLayer.children[i].visible = false;
  drawLight();
  drawCharacter();
  drawEnemies();
  drawBombEffects();
  drawForegroundOccluders();
  if (state.player.hitFlash > 0) {
    overlay.rect(0, 0, state.width, state.height).fill({ color: 0x8e1914, alpha: state.player.hitFlash * 0.6 });
  }
  if (state.fade > 0) overlay.rect(0, 0, state.width, state.height).fill({ color: 0x000000, alpha: state.fade });
}

function chooseItem(slot) {
  if (isTutorial && state.tutorial.step === 5 && slot !== 4) {
    setStatus("Select bomb with 4");
    return;
  }
  hud.itemMenu.classList.add("hidden");
  if (slot === 4) {
    if (state.inventory.bombs > 0) {
      state.player.holdingBomb = true;
      setStatus("Bomb ready");
      if (isTutorial && state.tutorial.step === 5) completeTutorialStep(5);
    } else setStatus("No bombs");
    return;
  }
  const type = ["health", "mana", "magic"][slot - 1];
  if (state.inventory[type] > 0) {
    state.inventory[type] -= 1;
    if (type === "health") state.player.health = Math.min(state.player.maxHealth, state.player.health + 35);
    refreshInventory();
    setStatus(`Used ${type}`);
  } else setStatus(`No ${type}`);
}

function useWeapon() {
  state.player.attackTime = 0.28;
  const forwardX = Math.cos(state.player.heading);
  const forwardY = Math.sin(state.player.heading);
  const target = state.enemies
    .filter((enemy) => enemy.alive)
    .map((enemy) => {
      const dx = enemy.x - state.player.x;
      const dy = enemy.y - state.player.y;
      const distance = Math.hypot(dx, dy);
      const facing = distance > 0 ? (dx * forwardX + dy * forwardY) / distance : 1;
      const sameHeight = Math.abs((groundElevation(enemy.x, enemy.y) + enemy.z) - (state.player.floorZ + state.player.z)) < 58;
      return { enemy, distance, facing, sameHeight };
    })
    .filter((candidate) => candidate.distance <= 100 && candidate.facing >= 0.15 && candidate.sameHeight)
    .sort((a, b) => a.distance - b.distance)[0]?.enemy;
  if (target) {
    target.health = Math.max(0, target.health - 25);
    target.alive = target.health > 0;
    setStatus(target.alive ? `${target.name}: ${target.health} health` : `${target.name} defeated`);
  } else {
    setStatus(state.player.holdingBomb ? "Sword with bomb" : "Sword strike");
  }
  if (isTutorial && state.tutorial.step === 3) completeTutorialStep(3);
}

function specialAction() {
  if (state.player.holdingBomb) {
    const heading = state.player.heading;
    state.player.holdingBomb = false;
    state.inventory.bombs = Math.max(0, state.inventory.bombs - 1);
    state.player.bombThrowTime = bombThrowDuration;
    state.player.specialTime = bombThrowDuration;
    state.projectiles.push({
      x: state.player.x,
      y: state.player.y,
      z: state.player.floorZ + state.player.z + 58,
      vx: Math.cos(heading) * 520,
      vy: Math.sin(heading) * 520,
      vz: 390,
      releaseDelay: bombReleaseTime,
      released: false,
      exploded: false
    });
    refreshInventory();
    setStatus("Bomb thrown");
    if (isTutorial && state.tutorial.step === 6) completeTutorialStep(6);
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
    if (!tutorialActionUnlocked("selectItem")) {
      setStatus("Complete the current lesson");
      return;
    }
    chooseItem(Number(event.code.slice(-1)));
    return;
  }
  if (event.code === "Space") {
    event.preventDefault();
    if (!tutorialActionUnlocked("jump")) {
      setStatus("Complete the current lesson");
      return;
    }
    const player = state.player;
    const moving = isMoving();
    if (player.stance === "crawl") {
      player.stance = "crouch";
      setStatus("Crouch");
      return;
    }
    if (player.stance === "crouch" && moving) {
      player.rollTime = 0.55;
      player.rollX = player.lastMoveX;
      player.rollY = player.lastMoveY;
      player.stance = "stand";
      player.grounded = false;
      player.vz = 360;
      player.jumpAge = 0;
      player.jumpArm = 0;
      setStatus("Jump roll");
      return;
    }
    if (!event.repeat && player.grounded) {
      player.grounded = false;
      player.vz = player.stance === "crouch" ? 426 : 520;
      player.jumpAge = 0;
      player.jumpArm = 1;
      if (isTutorial && state.tutorial.step === 2) state.tutorial.jumpStarted = true;
    }
    return;
  }
  if (event.code === "ControlLeft") {
    event.preventDefault();
    if (isTutorial && !state.tutorial.portalActive) {
      setStatus("Complete training first");
      return;
    }
    toggleCrouch(isMoving());
    return;
  }
  if (event.code === "KeyQ" && !event.repeat) {
    event.preventDefault();
    if (isTutorial && !state.tutorial.portalActive) {
      setStatus("Complete training first");
      return;
    }
    state.player.stealth = !state.player.stealth;
    setStatus(state.player.stealth ? "Stealth mode" : "Stealth off");
    return;
  }
  if (event.code === "KeyE") {
    event.preventDefault();
    if (!tutorialActionUnlocked("items")) {
      setStatus("Complete the current lesson");
      return;
    }
    hud.itemMenu.classList.toggle("hidden");
    setStatus(hud.itemMenu.classList.contains("hidden") ? "World mode" : "Choose 1-4");
    if (isTutorial && state.tutorial.step === 4 && !hud.itemMenu.classList.contains("hidden")) completeTutorialStep(4);
    return;
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    if (isTutorial && !state.tutorial.portalActive) {
      setStatus("Complete training first");
      return;
    }
    state.player.interactTime = 0.3;
    setStatus("Interact");
    return;
  }
  if (["ShiftLeft", "ShiftRight"].includes(event.code) && !tutorialActionUnlocked("sprint")) {
    event.preventDefault();
    setStatus("Complete the current lesson");
    return;
  }
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft", "ShiftRight"].includes(event.code)) {
    event.preventDefault();
    state.keys.add(event.code);
    if (isTutorial && state.tutorial.step === 0 && !state.tutorial.advancing) {
      const direction = {
        ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right"
      }[event.code];
      if (direction) {
        state.tutorial.movementKeys.add(direction);
        refreshTutorialHud();
        if (state.tutorial.movementKeys.size === 4) completeTutorialStep(0);
      }
    }
  }
});

window.addEventListener("keyup", (event) => state.keys.delete(event.code));

app.canvas.addEventListener("click", () => {
  if (document.pointerLockElement !== app.canvas) app.canvas.requestPointerLock();
});

app.canvas.addEventListener("mousedown", (event) => {
  if (event.button === 0) {
    if (tutorialActionUnlocked("attack")) useWeapon();
    else setStatus("Complete the current lesson");
  }
  if (event.button === 2) {
    if (tutorialActionUnlocked("special")) specialAction();
    else setStatus("Complete the current lesson");
  }
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
refreshTutorialHud();
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
