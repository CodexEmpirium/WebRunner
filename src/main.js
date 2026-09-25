async function main() {
const { Application, Container, Graphics, Matrix, Rectangle, Sprite, Texture, TilingSprite } = globalThis.PIXI;
const levelKey = document.body.dataset.level || "1";
const isTutorial = levelKey === "tutorial";
const levelId = isTutorial ? null : Number(levelKey);
const isLevelOneOne = levelKey === "1.1";
const isLevelOneTwo = levelKey === "1.2";
const query = new URLSearchParams(window.location.search);
const isAssetPreload = query.get("preload") === "1";
const geometryTestCoarse = query.has("geometryTestCoarse") && query.get("geometryTestCoarse") !== "0";
const geometryTestFine = query.has("geometryTestFine") && query.get("geometryTestFine") !== "0";
const geometryTestMode = geometryTestFine ? "fine" : geometryTestCoarse ? "coarse" : null;
const geometryTestFocus = query.get("geometryFocus") || "door";
const geometryTestView = query.get("geometryView")?.toLowerCase() || null;
const geometryTestYaw = query.has("cameraYaw") ? Number(query.get("cameraYaw")) : Number.NaN;
const geometryTestPitch = query.has("cameraPitch") ? Number(query.get("cameraPitch")) : Number.NaN;
const availableLevels = [0, "1.1", "1.2"];
const meter = 48;
const tile = 64;
const levelOnePlanScale = 2;
const itemPickupRadius = meter * 2;
const waterBasinInset = meter * 0.5;
const waterBasinDepth = meter * 0.5;
const waterSurfaceElevation = 0.5;
const waterWadingClearance = meter * 0.1;
const waterFlowSpeed = 0.008 * 1.2;
const torchVisibilityArc = Math.PI * 4 / 3;
const columnRadius = meter * 0.5;
const playerCollisionRadius = 16;
const floorRenderRadius = 11.2;
const defaultCameraZoom = 1.65;
const extendedSightCameraZoom = 1;
const platformCameraZoomScale = 0.85;
const platformCameraZoom = 0.52 * platformCameraZoomScale;
const platformTopElevation = 26;
const platformDeathDepth = meter;
const characterStandingHeight = meter * 1.6;
const raisedPlatformThickness = 38;
const raisedPlatformClearance = meter * 3;
const ledgeGrabReach = meter * 0.48;
const ledgeVerticalReach = meter * 1.55;
const ledgeShimmySpeed = meter * 1.35;
const ledgeClimbDuration = 0.62;
const ledgeHandAnchors = [0.26, 0.24, 0.22, 0.28, 0.22, 0.28, 0.25, 0.18];
const magicSwordBladeMaps = {
  idle: [
    [[0.38, 0.73], [0.34, 0.87]], [[0.37, 0.74], [0.31, 0.86]],
    [[0.38, 0.61], [0.32, 0.82]], [[0.39, 0.55], [0.33, 0.76]],
    [[0.39, 0.61], [0.34, 0.78]], [[0.58, 0.56], [0.67, 0.72]],
    [[0.56, 0.57], [0.64, 0.73]], [[0.44, 0.72], [0.39, 0.88]]
  ],
  walk: [
    [[0.36, 0.54], [0.24, 0.80]], [[0.28, 0.51], [0.08, 0.72]],
    [[0.24, 0.48], [0.07, 0.55]], [[0.27, 0.49], [0.10, 0.60]],
    [[0.78, 0.55], [0.85, 0.70]], [[0.78, 0.50], [0.94, 0.57]],
    [[0.77, 0.54], [0.94, 0.68]], [[0.35, 0.56], [0.24, 0.80]]
  ],
  crouch: [
    [[0.42, 0.69], [0.34, 0.86]], [[0.38, 0.57], [0.28, 0.71]],
    [[0.37, 0.56], [0.27, 0.66]], [[0.38, 0.57], [0.25, 0.72]],
    [[0.63, 0.59], [0.80, 0.71]], [[0.58, 0.58], [0.75, 0.70]],
    [[0.58, 0.59], [0.76, 0.71]], [[0.58, 0.66], [0.74, 0.79]]
  ],
  strike: [
    [[0.40, 0.75], [0.30, 0.91]], [[0.44, 0.76], [0.33, 0.92]],
    [[0.38, 0.48], [0.21, 0.48]], [[0.38, 0.47], [0.27, 0.30]],
    [[0.62, 0.48], [0.72, 0.31]], [[0.62, 0.47], [0.75, 0.31]],
    [[0.63, 0.48], [0.84, 0.48]], [[0.60, 0.72], [0.72, 0.91]]
  ]
};
const magicSwordHiddenFrames = {
  crouch: {
    4: new Set([0, 1, 2, 4])
  }
};
const minPitch = Math.PI / 9;
const maxPitch = Math.PI * 7 / 18;
const bombThrowDuration = 0.82;
const bombReleaseTime = 0.47;
const doorTraversalTiming = { align: 0.2, open: 0.48, pass: 0.72, close: 0.48 };
const gravity = 980;
const elevatedExitHeight = 112;
const elevatedChamberWallHeight = raisedPlatformClearance + elevatedExitHeight + meter * 0.75;
const elevatedExitKnob = { across: 0.82, up: 0.43 };
const geometryViewYaw = { north: 0, east: Math.PI / 2, south: Math.PI, west: -Math.PI / 2 };
if (geometryTestMode && geometryTestView && !(geometryTestView in geometryViewYaw)) {
  throw new Error(`Unknown geometry view: ${geometryTestView}`);
}
const progressStorageKey = "webrunner-progress-v1";
const importedSaveStorageKey = "webrunner-imported-save-v1";
const settingsStorageKey = "webrunner-settings-v1";
const worldStateStorageKey = "webrunner-world-state-v1";
const abilityGroups = {
  mana: {
    duration: 20,
    options: [
      { id: "extendedSight", label: "Extended Sight" },
      { id: "superSprint", label: "Super Sprint" }
    ]
  },
  magic: {
    duration: 40,
    options: [
      { id: "magicField", label: "Magic Field" },
      { id: "magicSword", label: "Magic Sword" }
    ]
  }
};

function readSettings() {
  let stored = {};
  try {
    stored = JSON.parse(window.localStorage.getItem(settingsStorageKey) || "{}");
  } catch {
    stored = {};
  }
  const graphics = ["low", "medium", "high"].includes(stored.graphics) ? stored.graphics : "high";
  const volume = Number(stored.volume);
  return {
    graphics,
    volume: Number.isFinite(volume) ? clamp(volume, 0, 1) : 0.8
  };
}

function readImportedSave() {
  if (query.get("load") !== "1") return null;
  try {
    const snapshot = JSON.parse(window.sessionStorage.getItem(importedSaveStorageKey) || "null");
    window.sessionStorage.removeItem(importedSaveStorageKey);
    if (!snapshot || snapshot.version !== 1 || String(snapshot.level) !== levelKey) {
      throw new Error("Saved game does not match this level.");
    }
    return snapshot;
  } catch (error) {
    throw new Error(`Unable to restore saved game: ${error.message}`);
  }
}

function readProgress() {
  const resetLevel = query.get("reset") === "1";
  let stored = {};
  try {
    stored = JSON.parse(window.sessionStorage.getItem(progressStorageKey) || "{}");
  } catch {
    stored = {};
  }
  const numberValue = (name, fallback, minimum = 0, maximum = 9999) => {
    const value = resetLevel ? Number.NaN : Number(query.get(name) ?? stored[name]);
    return Number.isFinite(value) ? Math.max(minimum, Math.min(maximum, value)) : fallback;
  };
  const abilityValue = (group) => {
    const value = query.get(`${group}Ability`) ?? stored[`${group}Ability`];
    return abilityGroups[group].options.some((option) => option.id === value) ? value : null;
  };
  return {
    hp: numberValue("hp", 100, 0, 100),
    coins: numberValue("coins", 0),
    health: numberValue("health", 0),
    mana: numberValue("mana", 0),
    magic: numberValue("magic", 0),
    bombs: numberValue("bombs", 3),
    holdingBomb: (query.get("holdingBomb") ?? stored.holdingBomb) === "1",
    manaAbility: abilityValue("mana"),
    manaTime: numberValue("manaTime", 0, 0, abilityGroups.mana.duration),
    magicAbility: abilityValue("magic"),
    magicTime: numberValue("magicTime", 0, 0, abilityGroups.magic.duration)
  };
}

const savedProgress = readProgress();
const loadedGame = readImportedSave();
const savedSettings = readSettings();

const state = {
  width: window.innerWidth,
  height: window.innerHeight,
    yaw: isLevelOneTwo ? 0 : geometryTestMode && geometryTestView in geometryViewYaw
    ? geometryViewYaw[geometryTestView]
    : geometryTestMode && Number.isFinite(geometryTestYaw)
      ? geometryTestYaw
      : geometryTestFine ? -Math.PI / 4 : Math.PI / 4,
  pitch: geometryTestMode && Number.isFinite(geometryTestPitch) ? clamp(geometryTestPitch, minPitch, maxPitch) : Math.PI / 4,
  projectionY: Math.sin(geometryTestMode && Number.isFinite(geometryTestPitch) ? clamp(geometryTestPitch, minPitch, maxPitch) : Math.PI / 4),
  zoom: isLevelOneTwo ? platformCameraZoom : geometryTestFine ? 1.25 : geometryTestCoarse ? 0.55 : defaultCameraZoom,
  fade: query.get("fade") === "1" ? 1 : 0,
  fadeSpeed: query.get("fastFade") === "1" ? 4 : 1,
  transitioning: false,
  transitionTarget: null,
  transitionDelay: 0,
  transitionFadeSpeed: 1,
  doorSequence: null,
  paused: false,
  pausePanel: "main",
  settings: savedSettings,
  keys: new Set(),
  projectiles: [],
  explosions: [],
  scorches: [],
  itemMenuMode: "items",
  inventory: { coins: savedProgress.coins, health: savedProgress.health, mana: savedProgress.mana, magic: savedProgress.magic, bombs: savedProgress.bombs },
  effects: {
    mana: { id: savedProgress.manaTime > 0 ? savedProgress.manaAbility : null, remaining: savedProgress.manaAbility ? savedProgress.manaTime : 0 },
    magic: { id: savedProgress.magicTime > 0 ? savedProgress.magicAbility : null, remaining: savedProgress.magicAbility ? savedProgress.magicTime : 0 }
  },
  discoveredSecrets: new Set(),
  player: {
    x: isLevelOneOne && geometryTestFine
      ? (geometryTestFocus === "water" ? -200 : geometryTestFocus === "columns" ? -120 : 250) * levelOnePlanScale
      : isLevelOneTwo ? -920 : 0,
    y: isLevelOneOne
      ? (geometryTestMode ? (["water", "columns"].includes(geometryTestFocus) ? -650 : -850) * levelOnePlanScale : 360 * levelOnePlanScale)
      : isLevelOneTwo ? 0 : 0,
    heading: isLevelOneOne ? -Math.PI / 2 : 0,
    speed: 255,
    stride: 0,
    z: 0,
    floorZ: isLevelOneTwo ? platformTopElevation : 0,
    vz: 0,
    jumpAge: 0,
    jumpArm: 0,
    grounded: true,
    stance: "stand",
    rollTime: 0,
    rollX: 0,
    rollY: -1,
    rollDirection: 1,
    attackTime: 0,
    specialTime: 0,
    interactTime: 0,
    holdingBomb: savedProgress.holdingBomb && savedProgress.bombs > 0,
    stealth: false,
    bombThrowTime: 0,
    landTime: 0,
    lastMoveX: 0,
    lastMoveY: -1,
    health: savedProgress.hp,
    maxHealth: 100,
    contactDamageCooldown: 0,
    hitFlash: 0,
    ledge: null,
    ledgeGrabCooldown: 0
    ,falling: false
    ,fallTime: 0
  },
  tutorial: isTutorial ? {
    step: 0,
    advancing: false,
    advanceTimer: 0,
    movementKeys: new Set(),
    sprintDistance: 0,
    jumpStarted: false,
    stanceActions: new Set(),
    lowMovement: new Set(),
    crouchJumpStarted: false,
    portalActive: false,
    portalPull: false,
    portalDive: false,
    portalDiveTime: 0,
    portalHidden: false,
    portal: { x: 0, y: 0 }
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
  "1.1": {
    name: "Level 1.1",
    kind: "dungeon",
    bounds: [
      { x: -300, y: 140, w: 600, h: 460, name: "start" },
      { x: -56, y: 140 - 10 * meter, w: 112, h: 10 * meter, name: "corridor" },
      { x: -380, y: -920, w: 760, h: 580, name: "pool" }
    ],
    platformHeight: raisedPlatformClearance,
    upperPlatform: { x: -380, y: -920, w: 760, h: 114 },
    stairs: { x: -380, bottomY: -430, w: 110, treadDepth: 42, steps: 12 },
    exit: { x: 292, y: -920, w: 62, h: 42 },
    doors: [
      { id: "exit", x: 292, y: -920, w: 62, height: elevatedExitHeight, normalX: 0, normalY: 1, elevation: "platform", target: "level1-2.html?fade=1&entry=entrance" }
    ],
    waterPools: [
      { x: -248, y: -920, w: 112, h: 515 },
      { x: 136, y: -920, w: 112, h: 515 }
    ],
    coins: [
      { x: -220, y: -770, collected: false },
      { x: -200, y: -665, collected: false },
      { x: -180, y: -500, collected: false },
      { x: 220, y: -770, collected: false },
      { x: 200, y: -665, collected: false },
      { x: 180, y: -500, collected: false }
    ],
    potions: [
      { x: -28, y: -612, type: "health", color: 0x38dd78, glow: 0x36e07d, collected: false },
      { x: 28, y: -612, type: "mana", color: 0x9b58ff, glow: 0xa058ff, collected: false }
    ],
    columns: [
      { x: -120, y: -780 },
      { x: 0, y: -780 },
      { x: 120, y: -780 },
      { x: -120, y: -535 },
      { x: 0, y: -535 },
      { x: 120, y: -535 }
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
      { x: -165, y: 360, phase: 0.18 },
      { x: 165, y: 360, phase: 0.68 },
      { x: 0, y: -100, phase: 0.38 },
      { x: -82, y: -690, phase: 0.08, activation: "corridorHalfway" },
      { x: 92, y: -505, phase: 0.58, activation: "corridorHalfway" },
      { x: 20, y: -430, phase: 0.84, activation: "corridorHalfway" }
    ],
    vines: [
      { id: "start-back-left", x: -180, y: 140, tangentX: 1, tangentY: 0, size: "small", middleCount: 0, width: 44, topZ: 73, height: 62 },
      { id: "start-left", x: -300, y: 410, tangentX: 0, tangentY: 1, size: "small", middleCount: 0, width: 42, topZ: 72, height: 59, mirror: true },
      { id: "start-right", x: 300, y: 500, tangentX: 0, tangentY: 1, size: "small", middleCount: 0, width: 39, topZ: 70, height: 55 },
      { id: "corridor-left", x: -56, y: -15, tangentX: 0, tangentY: 1, size: "small", middleCount: 1, width: 48, topZ: 91, height: 82 },
      { id: "corridor-right", x: 56, y: -220, tangentX: 0, tangentY: 1, size: "small", middleCount: 0, width: 43, topZ: 89, height: 72, mirror: true },
      { id: "chamber-front-left", x: -250, y: -340, tangentX: 1, tangentY: 0, size: "medium", middleCount: 1, width: 86, topZ: 228, height: 194 },
      { id: "chamber-back-left", x: -290, y: -920, tangentX: 1, tangentY: 0, size: "large", middleCount: 1, width: 108, topZ: 232, height: 208, mirror: true },
      { id: "chamber-back-center", x: -65, y: -920, tangentX: 1, tangentY: 0, size: "medium", middleCount: 2, width: 82, topZ: 226, height: 202 },
      { id: "chamber-back-right", x: 210, y: -920, tangentX: 1, tangentY: 0, size: "large", middleCount: 1, width: 102, topZ: 230, height: 204 },
      { id: "chamber-left", x: -380, y: -650, tangentX: 0, tangentY: 1, size: "medium", middleCount: 1, width: 84, topZ: 224, height: 188 },
      { id: "chamber-right", x: 380, y: -520, tangentX: 0, tangentY: 1, size: "medium", middleCount: 1, width: 80, topZ: 220, height: 184, mirror: true }
    ],
    secrets: [
      {
        id: "western-cache",
        name: "Western Cache",
        areas: [
          { x: -430, y: 330, w: 130, h: 90, kind: "tunnel" },
          { x: -650, y: 230, w: 220, h: 290, kind: "room" }
        ],
        opening: { x: -300, y: 330, w: 0, h: 90 },
        control: {
          id: "western-cache-lever",
          type: "lever",
          x: -300,
          y: 450,
          z: 42,
          radius: meter * 0.9,
          blockedBy: [{ type: "enemy", id: "dungeon-slime-1" }]
        }
      },
      {
        id: "eastern-passage",
        name: "Eastern Passage",
        areas: [
          { x: 380, y: -665, w: 130, h: 90, kind: "tunnel" },
          { x: 510, y: -790, w: 220, h: 340, kind: "room" }
        ],
        opening: { x: 380, y: -665, w: 0, h: 90 },
        control: {
          id: "eastern-passage-button",
          type: "button",
          x: 210,
          y: -920,
          z: 164,
          radius: meter * 0.9,
          minFloorZ: 100
        }
      }
    ]
  },
  "1.2": {
    name: "Level 1.2",
    kind: "platform",
    bounds: [{ x: -1040, y: -180, w: 2080, h: 360, name: "room" }],
    backWall: { x: -1040, y: -180, w: 2080, height: 180 },
    platforms: [
      { x: -988, y: -180, w: 340, h: 264, name: "entrance" },
      { x: -504, y: -180, w: 240, h: 264, name: "platform-2" },
      { x: -120, y: -180, w: 240, h: 264, name: "platform-3" },
      { x: 264, y: -180, w: 240, h: 264, name: "platform-4" },
      { x: 648, y: -180, w: 340, h: 264, name: "exit-platform" }
    ],
    doors: [
      { id: "entrance", x: -901, y: -180, w: 62, height: 112, normalX: 0, normalY: 1, elevation: "platform", target: "level1.html?fade=1&entry=exit" },
      { id: "exit", x: 904, y: -180, w: 62, height: 112, normalX: 0, normalY: 1, elevation: "platform", target: "level0.html?fade=1" }
    ],
    exit: { x: 904, y: -180, w: 62, h: 72 },
    vines: [
      { id: "platform-wall-1", x: -1010, y: -180, tangentX: 1, tangentY: 0, size: "medium", middleCount: 1, width: 76, topZ: 196, height: 150, mirror: true },
      { id: "platform-wall-2", x: -650, y: -180, tangentX: 1, tangentY: 0, size: "large", middleCount: 1, width: 94, topZ: 198, height: 164 },
      { id: "platform-wall-3", x: -175, y: -180, tangentX: 1, tangentY: 0, size: "small", middleCount: 1, width: 58, topZ: 194, height: 142 },
      { id: "platform-wall-4", x: 300, y: -180, tangentX: 1, tangentY: 0, size: "medium", middleCount: 1, width: 80, topZ: 197, height: 158, mirror: true },
      { id: "platform-wall-5", x: 710, y: -180, tangentX: 1, tangentY: 0, size: "large", middleCount: 1, width: 92, topZ: 199, height: 168 }
    ],
    torches: [],
    columns: [],
    waterPools: [],
    coins: [],
    potions: [
      { x: 935, y: 18, type: "magic", color: 0x71d8ff, glow: 0x87e5ff, collected: false }
    ],
    enemies: []
  }
};

function scaleLevelPlan(level, factor) {
  const scaleRect = (rect) => {
    rect.x *= factor;
    rect.y *= factor;
    rect.w *= factor;
    rect.h *= factor;
  };
  const scalePoint = (point) => {
    point.x *= factor;
    point.y *= factor;
  };
  level.planScale = factor;
  level.bounds.forEach(scaleRect);
  scaleRect(level.upperPlatform);
  level.stairs.x *= factor;
  level.stairs.bottomY *= factor;
  level.stairs.w *= factor;
  level.stairs.steps *= factor;
  scaleRect(level.exit);
  level.doors?.forEach((door) => {
    door.x *= factor;
    door.y *= factor;
    door.w *= factor;
  });
  level.waterPools.forEach(scaleRect);
  level.coins.forEach(scalePoint);
  level.potions.forEach(scalePoint);
  level.columns.forEach(scalePoint);
  level.torches.forEach(scalePoint);
  level.enemies.forEach(scalePoint);
  level.vines?.forEach(scalePoint);
  level.secrets?.forEach((secret) => {
    secret.areas.forEach(scaleRect);
    scaleRect(secret.opening);
    scalePoint(secret.control);
  });
}

scaleLevelPlan(levels["1.1"], levelOnePlanScale);

function stairGeometry(levelPlan) {
  const stair = levelPlan.stairs;
  const topY = levelPlan.upperPlatform.y + levelPlan.upperPlatform.h - stair.treadDepth;
  const stride = (stair.bottomY - topY) / (stair.steps - 1);
  return {
    ...stair,
    topY,
    stride,
    bottomEdge: stair.bottomY + stair.treadDepth,
    topEdge: topY + stair.treadDepth
  };
}

function validateDungeonGeometry(levelPlan) {
  const room = levelPlan.bounds.find((rect) => rect.name === "pool");
  const platform = levelPlan.upperPlatform;
  const stair = stairGeometry(levelPlan);
  const epsilon = 0.01;
  const assertTouching = (condition, message) => {
    if (!condition) throw new Error(`Invalid Level 1.1 geometry: ${message}`);
  };

  assertTouching(Math.abs(platform.x - room.x) <= epsilon, "upper platform must meet the left wall");
  assertTouching(Math.abs(platform.x + platform.w - (room.x + room.w)) <= epsilon, "upper platform must meet the right wall");
  assertTouching(Math.abs(platform.y - room.y) <= epsilon, "upper platform must meet the back wall");
  assertTouching(Math.abs(stair.x - platform.x) <= epsilon, "stairs must meet the left wall");
  assertTouching(Math.abs(stair.topEdge - (platform.y + platform.h)) <= epsilon, "stairs must meet the platform landing");
  assertTouching(stair.x + stair.w <= platform.x + platform.w + epsilon, "stairs must terminate within the platform");
  assertTouching(levelPlan.exit.x >= platform.x && levelPlan.exit.x + levelPlan.exit.w <= platform.x + platform.w, "exit must sit on the platform");
  assertTouching(Math.abs(levelPlan.exit.y - room.y) <= epsilon, "exit must align with the back wall");
  assertTouching(elevatedChamberWallHeight > levelPlan.platformHeight + elevatedExitHeight, "back wall must extend above the exit");
  assertTouching(
    levelPlan.platformHeight - raisedPlatformThickness >= characterStandingHeight + meter * 0.5,
    "raised platforms must leave standing clearance underneath"
  );
}

function validateDungeonFineGeometry(levelPlan) {
  const headerHeight = elevatedChamberWallHeight - levelPlan.platformHeight - elevatedExitHeight;
  const stair = stairGeometry(levelPlan);
  const stairBounds = { x: stair.x, y: stair.topY, w: stair.w, h: stair.bottomEdge - stair.topY };
  const assertDetail = (condition, message) => {
    if (!condition) throw new Error(`Invalid Level 1.1 detail geometry: ${message}`);
  };

  assertDetail(levelPlan.exit.w > 0 && levelPlan.exit.h > 0, "exit footprint must have positive dimensions");
  assertDetail(headerHeight > 0, "doorway must retain masonry above the door");
  assertDetail(elevatedExitKnob.across > 0 && elevatedExitKnob.across < 1, "doorknob must remain within the door width");
  assertDetail(elevatedExitKnob.up > 0 && elevatedExitKnob.up < 1, "doorknob must remain within the door height");
  for (const pool of levelPlan.waterPools) {
    assertDetail(pool.w > waterBasinInset * 2 && pool.h > waterBasinInset * 2, "water pool must contain its inset deep basin");
    assertDetail(Math.abs(pool.y - levelPlan.bounds.find((rect) => rect.name === "pool").y) <= 0.01, "water pool must terminate at the back wall");
  }
  const [leftPool, rightPool] = [...levelPlan.waterPools].sort((a, b) => a.x - b.x);
  assertDetail(levelPlan.waterPools.length === 2, "second chamber must contain two mirrored water pools");
  assertDetail(Math.abs(leftPool.x + leftPool.w + rightPool.x) <= 0.01, "water pools must mirror across the chamber centerline");
  assertDetail(Math.abs(leftPool.y - rightPool.y) <= 0.01 && Math.abs(leftPool.w - rightPool.w) <= 0.01 && Math.abs(leftPool.h - rightPool.h) <= 0.01, "water pools must have matching dimensions");
  for (const column of levelPlan.columns) {
    assertDetail(!pointInRect(column.x, column.y, stairBounds, columnRadius), "column footprint must not intersect the stairs");
    assertDetail(!levelPlan.waterPools.some((pool) => pointInRect(column.x, column.y, pool, columnRadius)), "column footprint must remain on solid ground");
  }
  const pointsAreMirrored = (points) => points.every((point) => points.some((candidate) =>
    Math.abs(candidate.x + point.x) <= 0.01 && Math.abs(candidate.y - point.y) <= 0.01
  ));
  assertDetail(pointsAreMirrored(levelPlan.columns), "column rows must mirror across the chamber centerline");
  assertDetail(pointsAreMirrored(levelPlan.coins), "pool coins must mirror across the chamber centerline");
  assertDetail(levelPlan.coins.every((coin) => levelPlan.waterPools.some((pool) => pointInRect(coin.x, coin.y, pool))), "pool coins must remain inside a water pool");
  assertDetail(pointsAreMirrored(levelPlan.potions), "central potions must mirror across the chamber centerline");
  for (const torch of levelPlan.torches) {
    const onWallBoundary = levelPlan.bounds.some((rect) => {
      const withinX = torch.x >= rect.x - 0.01 && torch.x <= rect.x + rect.w + 0.01;
      const withinY = torch.y >= rect.y - 0.01 && torch.y <= rect.y + rect.h + 0.01;
      return (withinX && (Math.abs(torch.y - rect.y) <= 0.01 || Math.abs(torch.y - (rect.y + rect.h)) <= 0.01)) ||
        (withinY && (Math.abs(torch.x - rect.x) <= 0.01 || Math.abs(torch.x - (rect.x + rect.w)) <= 0.01));
    });
    assertDetail(onWallBoundary, `torch at ${torch.x},${torch.y} must be mounted on an active-area wall`);
  }
  const vineIds = new Set();
  for (const vine of levelPlan.vines || []) {
    const horizontalWall = levelPlan.bounds.some((rect) =>
      vine.x >= rect.x - 0.01 && vine.x <= rect.x + rect.w + 0.01 &&
      (Math.abs(vine.y - rect.y) <= 0.01 || Math.abs(vine.y - (rect.y + rect.h)) <= 0.01)
    );
    const verticalWall = levelPlan.bounds.some((rect) =>
      vine.y >= rect.y - 0.01 && vine.y <= rect.y + rect.h + 0.01 &&
      (Math.abs(vine.x - rect.x) <= 0.01 || Math.abs(vine.x - (rect.x + rect.w)) <= 0.01)
    );
    const wallHeight = vine.y <= -340 * levelPlan.planScale
      ? elevatedChamberWallHeight
      : vine.y < 140 * levelPlan.planScale ? 98 : 80;
    assertDetail(!vineIds.has(vine.id), `vine id ${vine.id} must be unique`);
    assertDetail(["small", "medium", "large"].includes(vine.size), `vine ${vine.id} must use a supported asset size`);
    assertDetail(horizontalWall || verticalWall, `vine ${vine.id} must be anchored to a wall boundary`);
    assertDetail((horizontalWall && vine.tangentX !== 0 && vine.tangentY === 0) || (verticalWall && vine.tangentX === 0 && vine.tangentY !== 0), `vine ${vine.id} must follow its wall plane`);
    assertDetail(vine.topZ <= wallHeight && vine.topZ - vine.height >= 0, `vine ${vine.id} must fit within its wall height`);
    vineIds.add(vine.id);
  }
  const secretIds = new Set();
  const controlIds = new Set();
  for (const secret of levelPlan.secrets || []) {
    assertDetail(!secretIds.has(secret.id), `secret id ${secret.id} must be unique`);
    assertDetail(Array.isArray(secret.areas) && secret.areas.length > 0, `secret ${secret.id} must contain an area`);
    assertDetail(secret.areas.every((area) => area.w > 0 && area.h > 0), `secret ${secret.id} areas must have positive dimensions`);
    assertDetail((secret.opening.w === 0) !== (secret.opening.h === 0), `secret ${secret.id} opening must follow one wall axis`);
    assertDetail(secret.control && ["button", "lever"].includes(secret.control.type), `secret ${secret.id} must have a button or lever`);
    assertDetail(!controlIds.has(secret.control.id), `secret control id ${secret.control.id} must be unique`);
    assertDetail(secret.control.radius > 0, `secret control ${secret.control.id} must have an interaction radius`);
    secretIds.add(secret.id);
    controlIds.add(secret.control.id);
  }
  const delayedSlimes = levelPlan.enemies.filter((enemy) => enemy.activation === "corridorHalfway");
  assertDetail(delayedSlimes.length === 3, "second chamber must contain three corridor-gated slimes");
  assertDetail(delayedSlimes.every((enemy) => pointInRect(enemy.x, enemy.y, levelPlan.bounds.find((rect) => rect.name === "pool"))), "corridor-gated slimes must start in the second chamber");
}

function validateOrthogonalGeometryViews() {
  const epsilon = 0.0001;
  const project = (x, y, z, yaw, pitch) => {
    const point = rotate(x, y, -yaw);
    return { x: point.x, y: point.y * Math.sin(pitch) - z };
  };
  const sameVector = (a, b, c, d) => Math.abs((b.x - a.x) - (d.x - c.x)) <= epsilon &&
    Math.abs((b.y - a.y) - (d.y - c.y)) <= epsilon;

  for (const yaw of Object.values(geometryViewYaw)) {
    for (const pitch of [minPitch, Math.PI / 4, maxPitch]) {
      const origin = project(0, 0, 0, yaw, pitch);
      const east = project(100, 0, 0, yaw, pitch);
      const north = project(0, -100, 0, yaw, pitch);
      const offset = project(240, 180, 0, yaw, pitch);
      const offsetEast = project(340, 180, 0, yaw, pitch);
      const offsetNorth = project(240, 80, 0, yaw, pitch);
      if (!sameVector(origin, east, offset, offsetEast) || !sameVector(origin, north, offset, offsetNorth)) {
        throw new Error("Invalid orthogonal projection: parallel geometry changes with position");
      }
    }
  }
}

function platformTraversalBounds(levelPlan) {
  return {
    west: Math.min(...levelPlan.platforms.map((platform) => platform.x)),
    east: Math.max(...levelPlan.platforms.map((platform) => platform.x + platform.w)),
    north: Math.max(...levelPlan.platforms.map((platform) => platform.y)),
    south: Math.min(...levelPlan.platforms.map((platform) => platform.y + platform.h))
  };
}

function fittedPlatformCameraZoom(levelPlan, viewportWidth) {
  const traversal = platformTraversalBounds(levelPlan);
  return clamp(
    viewportWidth * 0.92 * platformCameraZoomScale / (traversal.east - traversal.west),
    platformCameraZoom,
    1.8 * platformCameraZoomScale
  );
}

function validateDoorGeometry(levelPlan, label) {
  const doors = levelPlan.doors || [];
  const ids = new Set();
  const epsilon = 0.01;
  const assertDoor = (condition, message) => {
    if (!condition) throw new Error(`Invalid ${label} door geometry: ${message}`);
  };

  for (const door of doors) {
    const normalLength = Math.hypot(door.normalX, door.normalY);
    assertDoor(door.id && !ids.has(door.id), `door id ${door.id || "<missing>"} must be unique`);
    assertDoor(Number.isFinite(door.x) && Number.isFinite(door.y), `door ${door.id} must have a finite position`);
    assertDoor(door.w > 0 && door.height > 0, `door ${door.id} must have positive dimensions`);
    assertDoor(Math.abs(normalLength - 1) <= epsilon, `door ${door.id} must have a unit inward normal`);
    assertDoor(typeof door.target === "string" && door.target.length > 0, `door ${door.id} must have a destination`);
    ids.add(door.id);
  }

  if (levelPlan.kind === "dungeon") {
    const exitDoor = doors.find((door) => door.id === "exit");
    assertDoor(exitDoor, "elevated exit must have a configured door");
    assertDoor(
      Math.abs(exitDoor.x - levelPlan.exit.x) <= epsilon &&
        Math.abs(exitDoor.y - levelPlan.exit.y) <= epsilon &&
        Math.abs(exitDoor.w - levelPlan.exit.w) <= epsilon,
      "elevated exit door must match the wall opening"
    );
  }
}

function validatePlatformLevelGeometry(levelPlan) {
  const epsilon = 0.01;
  const assertPlatform = (condition, message) => {
    if (!condition) throw new Error(`Invalid Level 1.2 geometry: ${message}`);
  };
  const entrancePlatform = levelPlan.platforms.find((platform) => platform.name === "entrance");
  const exitPlatform = levelPlan.platforms.find((platform) => platform.name === "exit-platform");
  const entranceDoor = levelPlan.doors.find((door) => door.id === "entrance");
  const exitDoor = levelPlan.doors.find((door) => door.id === "exit");
  const magicPotion = levelPlan.potions.find((potion) => potion.type === "magic");
  const middlePlatforms = levelPlan.platforms.filter((platform) => !["entrance", "exit-platform"].includes(platform.name));
  const orderedPlatforms = [...levelPlan.platforms].sort((a, b) => a.x - b.x);
  const platformGaps = orderedPlatforms.slice(1).map((platform, index) => platform.x - (orderedPlatforms[index].x + orderedPlatforms[index].w));
  const traversal = platformTraversalBounds(levelPlan);

  assertPlatform(levelPlan.platforms.every((platform) => Math.abs(platform.y - levelPlan.backWall.y) <= epsilon), "every platform must meet the back wall");
  assertPlatform(levelPlan.platforms.every((platform) => platform.h > 0 && platform.w > 0), "platform footprints must have positive dimensions");
  assertPlatform(traversal.south > traversal.north, "platforms must share a north/south traversal lane");
  assertPlatform(Math.abs(entrancePlatform.x - traversal.west) <= epsilon, "entrance platform must form the west movement boundary");
  assertPlatform(Math.abs(entrancePlatform.x + entrancePlatform.w - traversal.east) > epsilon, "entrance platform cannot also form the east movement boundary");
  assertPlatform(Math.abs(exitPlatform.x + exitPlatform.w - traversal.east) <= epsilon, "exit platform must form the east movement boundary");
  assertPlatform(middlePlatforms.every((platform) => platform.w < entrancePlatform.w && platform.w < exitPlatform.w), "middle platforms must remain smaller than the entrance and exit platforms");
  assertPlatform(platformGaps.every((gap) => Math.abs(gap - 144) <= epsilon), "platform gaps must remain ten percent closer than the original layout");
  assertPlatform(magicPotion && pointInRect(magicPotion.x, magicPotion.y, exitPlatform), "magic potion must sit on the exit platform");
  assertPlatform(entranceDoor.x >= entrancePlatform.x && entranceDoor.x + entranceDoor.w <= entrancePlatform.x + entrancePlatform.w, "entrance door must align with the entrance platform");
  assertPlatform(exitDoor.x >= exitPlatform.x && exitDoor.x + exitDoor.w <= exitPlatform.x + exitPlatform.w, "exit door must align with the exit platform");
  assertPlatform(levelPlan.doors.every((door) => Math.abs(door.y - levelPlan.backWall.y) <= epsilon), "doors must sit against the back wall");
  assertPlatform(levelPlan.vines.every((vine) => Math.abs(vine.y - levelPlan.backWall.y) <= epsilon), "wall vines must sit against the back wall");
  assertPlatform(levelPlan.vines.every((vine) => vine.topZ <= platformTopElevation + levelPlan.backWall.height && vine.topZ - vine.height >= platformTopElevation), "wall vines must fit on the back wall");
  assertPlatform(platformDeathDepth === meter, "death plane must be exactly one meter below platform height");
}

validateDungeonGeometry(levels["1.1"]);
validateDungeonFineGeometry(levels["1.1"]);
validatePlatformLevelGeometry(levels["1.2"]);
validateDoorGeometry(levels["1.1"], "Level 1.1");
validateDoorGeometry(levels["1.2"], "Level 1.2");
validateOrthogonalGeometryViews();

const level = levels[levelKey] || levels["1.1"];
function doorElevation(levelPlan, door) {
  if (door.elevation === "platform") {
    return levelPlan.kind === "dungeon" ? levelPlan.platformHeight : platformTopElevation;
  }
  return Number(door.elevation) || 0;
}

function placePlayerAtEntryDoor(entryId) {
  const door = (level.doors || []).find((candidate) => candidate.id === entryId);
  if (!door) return;
  const inwardDistance = meter * 1.7;
  state.player.x = door.x + door.w / 2 + door.normalX * inwardDistance;
  state.player.y = door.y + door.normalY * inwardDistance;
  state.player.heading = Math.atan2(door.normalY, door.normalX);
  state.player.floorZ = doorElevation(level, door);
  state.player.z = 0;
  state.player.vz = 0;
  state.player.grounded = true;
}

const levelSecretIds = new Set((level.secrets || []).map((secret) => secret.id));
function readWorldSecretState() {
  try {
    const stored = JSON.parse(window.sessionStorage.getItem(worldStateStorageKey) || "{}");
    return stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {};
  } catch {
    return {};
  }
}
const storedWorldState = readWorldSecretState();
state.discoveredSecrets = new Set(
  (Array.isArray(storedWorldState[levelKey]) ? storedWorldState[levelKey] : [])
    .filter((secretId) => levelSecretIds.has(secretId))
);

function persistSecretDiscovery() {
  try {
    const worldState = readWorldSecretState();
    worldState[levelKey] = [...state.discoveredSecrets];
    window.sessionStorage.setItem(worldStateStorageKey, JSON.stringify(worldState));
  } catch {
    // Secret discovery remains active until this page is closed.
  }
}

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
  activation: enemy.activation || null,
  active: !enemy.activation,
  alive: true,
  deathTime: 0,
  removed: false,
  visual: null
}));
const tutorialSteps = [
  { title: "Movement", instruction: "Move once in every direction.", command: "W A S D" },
  { title: "Sprint", instruction: "Hold Shift while moving for 3 meters.", command: "SHIFT + W A S D" },
  { title: "Jump", instruction: "Jump and land on your feet.", command: "SPACE" },
  { title: "Stay Low", instruction: "Crouch, then enter a crawl while moving.", command: "LEFT CTRL" },
  { title: "Low Movement", instruction: "Move while crouched and while crawling.", command: "W A S D + LEFT CTRL" },
  { title: "Crouch Jump", instruction: "Crouch, move forward or backward, then jump.", command: "LEFT CTRL + W/S + SPACE" },
  { title: "Attack", instruction: "Strike once with your sword.", command: "LEFT CLICK" },
  { title: "Item Belt", instruction: "Open your item belt.", command: "E" },
  { title: "Ready Bomb", instruction: "Select the bomb from your item belt.", command: "4" },
  { title: "Throw Bomb", instruction: "Throw the readied bomb.", command: "RIGHT CLICK" }
];
const tutorialStep = {
  movement: 0,
  sprint: 1,
  jump: 2,
  stances: 3,
  lowMovement: 4,
  crouchJump: 5,
  attack: 6,
  items: 7,
  selectItem: 8,
  special: 9
};
if (loadedGame) restoreGameSnapshot(loadedGame);
else placePlayerAtEntryDoor(query.get("entry"));
if (isLevelOneTwo && !geometryTestMode) {
  state.yaw = 0;
  state.pitch = Math.PI / 4;
  state.projectionY = Math.sin(state.pitch);
  state.zoom = fittedPlatformCameraZoom(level, state.width);
}
const hud = isAssetPreload ? null : buildHud(levelId);
const levelMusic = document.getElementById("levelMusic");
let resumeMusicAfterPause = false;
const art = await loadArt();
if (isAssetPreload) {
  window.parent.postMessage({ type: "webrunner-assets-ready", level: levelKey }, "*");
  return;
}
const app = new Application();
const graphicsResolution = (quality) => quality === "low"
  ? 0.75
  : quality === "medium"
    ? 1
    : Math.min(window.devicePixelRatio || 1, 2);
await app.init({
  resizeTo: window,
  background: "#050403",
  antialias: state.settings.graphics !== "low",
  resolution: graphicsResolution(state.settings.graphics),
  preference: window.location.protocol === "file:" ? ["canvas"] : ["webgl", "canvas"]
});
document.getElementById("game").appendChild(app.canvas);

const world = new Container();
const overlay = new Graphics();
app.stage.addChild(world, overlay);

const floorLayer = new Container();
const waterLayer = new Container();
const wallTextureLayer = new Container();
const g = new Graphics();
const scenerySpriteLayer = new Container();
const elevatedLayer = new Graphics();
const elevatedSceneryLayer = new Container();
const actorLayer = new Container();
const actorShadow = new Graphics();
const actorAura = new Graphics();
const actorSprite = new Sprite(art.action[0][0]);
const actorFx = new Graphics();
const entityLayer = new Container();
const effectsLayer = new Graphics();
const occlusionSpriteLayer = new Container();
const occlusionWallTextureLayer = new Container();
const occlusionLayer = new Graphics();
const occlusionDecorationLayer = new Container();
actorSprite.anchor.set(0.5, 0.9);
actorLayer.addChild(actorShadow, actorAura, actorSprite, actorFx);
entityLayer.sortableChildren = true;
entityLayer.addChild(actorLayer);
world.addChild(floorLayer, waterLayer, wallTextureLayer, g, scenerySpriteLayer, elevatedLayer, elevatedSceneryLayer, entityLayer, effectsLayer, occlusionSpriteLayer, occlusionWallTextureLayer, occlusionLayer, occlusionDecorationLayer);
let floorSpriteCount = 0;
const waterSprites = [];
const wallTextureSprites = new Map();
const occlusionWallTextureSprites = new Map();
const scenerySprites = new Map();
const elevatedScenerySprites = new Map();
const occlusionSprites = new Map();
const vineSprites = new Map();
const occlusionVineSprites = new Map();

async function loadArt() {
  const loadImage = (path) => new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Unable to load artwork: ${path}`));
    image.src = new URL(path, window.location.href).href;
  });
  const [runImage, runStealthImage, actionImage, lowImage, crawlImage, bombImage, bombWalkImage, bombCombatImage, ledgeImage, slimeImage, slimeDeathImage, floorImage, wallImage, columnImage, coinImage, waterImage, potionImage] = await Promise.all([
    loadImage("./assets/art/rogue-run-v3-clean.png"),
    loadImage("./assets/art/rogue-run-stealth-v2-clean.png"),
    loadImage("./assets/art/rogue-action-v2-clean.png"),
    loadImage("./assets/art/rogue-crouch-v1-clean.png"),
    loadImage("./assets/art/rogue-crawl-v3-clean.png"),
    loadImage("./assets/art/rogue-bomb-v3-clean.png"),
    loadImage("./assets/art/rogue-bomb-walk-v1-clean.png"),
    loadImage("./assets/art/rogue-bomb-v2-clean.png"),
    loadImage("./assets/art/rogue-ledge-v1-clean.png"),
    loadImage("./assets/art/enemy-dungeon-slime-clean.png"),
    loadImage("./assets/art/enemy-dungeon-slime-death-v1-clean.png"),
    loadImage("./assets/art/dungeon-floor.png"),
    loadImage("./assets/art/dungeon-wall.png"),
    loadImage("./assets/art/level1-column-v1.png"),
    loadImage("./assets/art/level1-coin-spin-v1-clean.png"),
    loadImage("./assets/art/level1-water-v1.png"),
    loadImage("./assets/art/potion-collectibles-v1.png")
  ]);
  const vineImages = await Promise.all(
    ["small", "medium", "large"].flatMap((size) => ["base", "middle", "tip"].map((part) =>
      loadImage(`./assets/art/vines/vine-${size}-${part}-v1.png`)
    ))
  );
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
  const wallCropX = Math.round(wallImage.naturalWidth * 0.08);
  const wallCanvas = document.createElement("canvas");
  wallCanvas.width = wallImage.naturalWidth - wallCropX * 2;
  wallCanvas.height = wallImage.naturalHeight;
  wallCanvas.getContext("2d").drawImage(
    wallImage,
    wallCropX,
    0,
    wallCanvas.width,
    wallCanvas.height,
    0,
    0,
    wallCanvas.width,
    wallCanvas.height
  );
  const wall = Texture.from(wallCanvas);
  const water = Texture.from(waterImage);
  floor.source.addressMode = "repeat";
  wall.source.addressMode = "repeat";
  water.source.addressMode = "repeat";
  const vines = {};
  let vineImageIndex = 0;
  for (const size of ["small", "medium", "large"]) {
    vines[size] = {};
    for (const part of ["base", "middle", "tip"]) {
      vines[size][part] = Texture.from(vineImages[vineImageIndex]);
      vineImageIndex += 1;
    }
  }
  return {
    run: sliceSheet(runImage, 8, 8),
    runStealth: sliceSheet(runStealthImage, 4, 8),
    action: sliceSheet(actionImage, 4, 8),
    low: sliceSheet(lowImage, 6, 8),
    crawl: sliceSheet(crawlImage, 6, 8),
    bomb: sliceSheet(bombImage, 7, 8),
    bombWalk: sliceSheet(bombWalkImage, 6, 8),
    bombCombat: sliceSheet(bombCombatImage, 3, 8),
    ledge: sliceSheet(ledgeImage, 14, 8),
    slime: sliceSheet(slimeImage, 8, 8),
    slimeDeath: sliceSheet(slimeDeathImage, 4, 8),
    column: Texture.from(columnImage),
    coin: sliceSheet(coinImage, 8, 1)[0],
    potion: sliceSheet(potionImage, 3, 1)[0],
    floor,
    wall,
    water,
    vines
  };
}

function buildHud(currentLevel) {
  const root = document.createElement("div");
  root.className = `hud${isTutorial ? " tutorial-hud" : ""}`;
  const levelControl = isTutorial ? `
      <div class="tutorial-title">Initiate's Trial</div>
      <button class="skip-tutorial" id="skipTutorial" type="button">Skip Tutorial</button>` : `
      <form class="level-jump" id="levelJump">
        <label for="levelInput">Go to Level</label>
        <input id="levelInput" type="number" inputmode="decimal" min="0" max="1.2" step="0.1" value="${currentLevel}">
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
    <div class="active-effects hidden" id="activeEffects" aria-live="polite"></div>
    ${tutorialPanel}
    <div class="item-menu hidden" id="itemMenu">
      <strong id="itemMenuTitle">Use Item</strong>
      <div class="item-options" id="itemMenuOptions"></div>
    </div>
    ${isTutorial ? `
    <div class="confirm-overlay hidden" id="skipConfirm">
      <section class="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="skipConfirmTitle">
        <strong id="skipConfirmTitle">Skip Tutorial and Start Level 1.1: Are you sure?</strong>
        <div class="confirm-actions">
          <button type="button" id="confirmSkip">Ok</button>
          <button type="button" id="cancelSkip">Cancel</button>
        </div>
      </section>
    </div>` : ""}
    <div class="pause-overlay hidden" id="pauseOverlay">
      <section class="pause-dialog" role="dialog" aria-modal="true" aria-labelledby="pauseTitle">
        <div class="pause-panel" id="pauseMain">
          <h2 class="pause-title" id="pauseTitle">Paused</h2>
          <div class="pause-actions">
            <button class="pause-button" id="pauseResume" type="button">Resume</button>
            <button class="pause-button" id="pauseOptions" type="button">Options</button>
            <button class="pause-button" id="pauseSave" type="button">Save Game</button>
            <button class="pause-button pause-button-danger" id="pauseExit" type="button">Exit</button>
          </div>
          <p class="pause-save-status" id="pauseSaveStatus" role="status" aria-live="polite"></p>
        </div>
        <div class="pause-panel hidden" id="pauseOptionsPanel">
          <h2 class="pause-subtitle">Options</h2>
          <div class="pause-options">
            <label class="pause-option">Graphics
              <select id="graphicsQuality">
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </label>
            <label class="pause-option">Audio
              <input id="masterVolume" type="range" min="0" max="100" step="1">
            </label>
          </div>
          <button class="pause-button" id="pauseOptionsBack" type="button">Back</button>
        </div>
        <div class="pause-panel hidden" id="pauseExitPanel">
          <h2 class="pause-subtitle">Are you sure?</h2>
          <div class="pause-actions">
            <button class="pause-button pause-button-danger" id="confirmExit" type="button">Exit</button>
            <button class="pause-button" id="cancelExit" type="button">Back</button>
          </div>
        </div>
      </section>
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
    itemMenuTitle: root.querySelector("#itemMenuTitle"),
    itemMenuOptions: root.querySelector("#itemMenuOptions"),
    activeEffects: root.querySelector("#activeEffects"),
    statusLine: root.querySelector("#statusLine"),
    playerHealth: root.querySelector("#playerHealth"),
    coinCount: root.querySelector("#coinCount"),
    healthCount: root.querySelector("#healthCount"),
    manaCount: root.querySelector("#manaCount"),
    magicCount: root.querySelector("#magicCount"),
    bombCount: root.querySelector("#bombCount"),
    pauseOverlay: root.querySelector("#pauseOverlay"),
    pauseMain: root.querySelector("#pauseMain"),
    pauseOptionsPanel: root.querySelector("#pauseOptionsPanel"),
    pauseExitPanel: root.querySelector("#pauseExitPanel"),
    pauseResume: root.querySelector("#pauseResume"),
    pauseOptions: root.querySelector("#pauseOptions"),
    pauseSave: root.querySelector("#pauseSave"),
    pauseExit: root.querySelector("#pauseExit"),
    pauseSaveStatus: root.querySelector("#pauseSaveStatus"),
    graphicsQuality: root.querySelector("#graphicsQuality"),
    masterVolume: root.querySelector("#masterVolume"),
    pauseOptionsBack: root.querySelector("#pauseOptionsBack"),
    confirmExit: root.querySelector("#confirmExit"),
    cancelExit: root.querySelector("#cancelExit")
  };

  refs.graphicsQuality.value = state.settings.graphics;
  refs.masterVolume.value = String(Math.round(state.settings.volume * 100));
  refs.pauseResume.addEventListener("click", resumeGame);
  refs.pauseOptions.addEventListener("click", () => showPausePanel("options"));
  refs.pauseExit.addEventListener("click", () => showPausePanel("exit"));
  refs.pauseOptionsBack.addEventListener("click", () => showPausePanel("main"));
  refs.cancelExit.addEventListener("click", () => showPausePanel("main"));
  refs.confirmExit.addEventListener("click", () => {
    saveProgress();
    window.location.href = "index.html";
  });
  refs.pauseSave.addEventListener("click", () => {
    downloadSaveGame();
    refs.pauseSaveStatus.textContent = "Game saved";
  });
  refs.graphicsQuality.addEventListener("change", () => {
    state.settings.graphics = refs.graphicsQuality.value;
    persistSettings();
    applyGraphicsSettings();
  });
  refs.masterVolume.addEventListener("input", () => {
    state.settings.volume = Number(refs.masterVolume.value) / 100;
    persistSettings();
    applyAudioSettings();
  });

  refs.tutorialPanel = root.querySelector("#tutorialPanel");
  refs.tutorialCount = root.querySelector("#tutorialCount");
  refs.tutorialStep = root.querySelector("#tutorialStep");
  refs.tutorialInstruction = root.querySelector("#tutorialInstruction");
  refs.tutorialCommand = root.querySelector("#tutorialCommand");
  refs.tutorialProgress = root.querySelector("#tutorialProgress");
  refs.spaceHint = root.querySelector("#spaceHint");
  refs.movementHint = root.querySelector("#movementHint");
  refs.skipTutorial = root.querySelector("#skipTutorial");
  refs.skipConfirm = root.querySelector("#skipConfirm");
  refs.confirmSkip = root.querySelector("#confirmSkip");
  refs.cancelSkip = root.querySelector("#cancelSkip");

  if (refs.skipTutorial) {
    const closeSkipConfirmation = () => refs.skipConfirm.classList.add("hidden");
    refs.skipTutorial.addEventListener("click", () => {
      restoreBrowserCursor();
      refs.skipConfirm.classList.remove("hidden");
      refs.cancelSkip.focus();
    });
    refs.cancelSkip.addEventListener("click", closeSkipConfirmation);
    refs.confirmSkip.addEventListener("click", () => {
      refs.skipConfirm.classList.add("hidden");
      startTransition("level1.html?fade=1");
    });
    refs.skipConfirm.addEventListener("click", (event) => {
      if (event.target === refs.skipConfirm) closeSkipConfirmation();
    });
  }

  if (refs.levelInput) {
    refs.levelInput.addEventListener("input", () => {
      refs.levelInput.value = refs.levelInput.value.replace(/[^0-9.]/g, "");
    });
    refs.levelJump.addEventListener("submit", (event) => {
      event.preventDefault();
      if (state.doorSequence || state.transitioning) return;
      const target = Number(refs.levelInput.value);
      const targetKey = refs.levelInput.value.trim();
      if (!availableLevels.some((level) => String(level) === targetKey)) {
        refs.levelInput.value = String(currentLevel);
        return;
      }
      window.location.href = targetWithProgress(targetKey === "1.1" ? "level1.html" : targetKey === "1.2" ? "level1-2.html" : `level${targetKey}.html`);
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

function abilityOption(group, id) {
  return abilityGroups[group].options.find((option) => option.id === id);
}

function effectActive(group, id = null) {
  const effect = state.effects[group];
  return effect.remaining > 0 && effect.id && (!id || effect.id === id);
}

function refreshEffectsHud() {
  const active = Object.entries(state.effects)
    .filter(([group]) => effectActive(group))
    .map(([group, effect]) => ({ group, effect, option: abilityOption(group, effect.id) }));
  const markup = active.map(({ group, effect, option }) =>
    `<span class="effect-${group}">${option.label} <b>${Math.ceil(effect.remaining)}s</b></span>`).join("");
  if (hud.activeEffects.innerHTML !== markup) hud.activeEffects.innerHTML = markup;
  hud.activeEffects.classList.toggle("hidden", active.length === 0);
  document.documentElement.classList.toggle("extended-sight", effectActive("mana", "extendedSight"));
}

function showItemMenu(mode = "items") {
  state.itemMenuMode = mode;
  const options = mode === "items"
    ? ["Health", "Mana", "Magic", "Bomb"]
    : abilityGroups[mode].options.map((option) => option.label);
  hud.itemMenuTitle.textContent = mode === "items"
    ? "Use Item"
    : `${mode === "mana" ? "Mana" : "Magic"} Ability - ${abilityGroups[mode].duration}s`;
  hud.itemMenuOptions.innerHTML = options.map((label, index) => `<span>${index + 1} ${label}</span>`).join("");
  hud.itemMenu.classList.remove("hidden");
}

function closeItemMenu() {
  hud.itemMenu.classList.add("hidden");
  state.itemMenuMode = "items";
}

function setStatus(text) {
  hud.statusLine.textContent = text;
}

function tutorialActionUnlocked(action) {
  if (!isTutorial || state.tutorial.portalActive) return true;
  const unlockStep = { ...tutorialStep, stance: tutorialStep.stances };
  return state.tutorial.step >= unlockStep[action];
}

function tutorialProgress() {
  if (!isTutorial) return 0;
  const tutorial = state.tutorial;
  if (tutorial.advancing) return 1;
  if (tutorial.step === tutorialStep.movement) return tutorial.movementKeys.size / 4;
  if (tutorial.step === tutorialStep.sprint) return clamp(tutorial.sprintDistance / (3 * meter), 0, 1);
  if (tutorial.step === tutorialStep.stances) return tutorial.stanceActions.size / 2;
  if (tutorial.step === tutorialStep.lowMovement) return tutorial.lowMovement.size / 2;
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
  if (tutorial.step >= tutorialStep.jump) hud.spaceHint.classList.remove("tutorial-concealed");
  hud.movementHint.textContent = tutorial.step === tutorialStep.movement
    ? "Movement unlocked"
    : tutorial.step === tutorialStep.sprint
      ? "Sprint unlocked"
      : tutorial.step >= tutorialStep.stances
        ? "Move jump sprint crouch"
        : "Move jump sprint";
}

function completeTutorialStep(expectedStep) {
  if (!isTutorial || state.tutorial.step !== expectedStep || state.tutorial.advancing) return;
  state.tutorial.advancing = true;
  state.tutorial.advanceTimer = 0.65;
  setStatus("Lesson complete");
  refreshTutorialHud();
}

function updateTutorialAdvance(delta) {
  if (!state.tutorial?.advancing) return;
  state.tutorial.advanceTimer = Math.max(0, state.tutorial.advanceTimer - delta);
  if (state.tutorial.advanceTimer > 0) return;
  if (state.tutorial.step === tutorialSteps.length - 1) {
    state.tutorial.portalActive = true;
    state.tutorial.advancing = false;
    closeItemMenu();
    setStatus("Portal opened");
  } else {
    state.tutorial.step += 1;
    state.tutorial.advancing = false;
    setStatus(tutorialSteps[state.tutorial.step].title);
  }
  refreshTutorialHud();
}

function gameProgress() {
  return {
    hp: state.player.health,
    coins: state.inventory.coins,
    health: state.inventory.health,
    mana: state.inventory.mana,
    magic: state.inventory.magic,
    bombs: state.inventory.bombs,
    holdingBomb: state.player.holdingBomb ? "1" : "0",
    manaAbility: state.effects.mana.id || "",
    manaTime: state.effects.mana.remaining.toFixed(2),
    magicAbility: state.effects.magic.id || "",
    magicTime: state.effects.magic.remaining.toFixed(2)
  };
}

function gameSnapshot() {
  const tutorial = state.tutorial ? {
    ...state.tutorial,
    movementKeys: [...state.tutorial.movementKeys],
    stanceActions: [...state.tutorial.stanceActions],
    lowMovement: [...state.tutorial.lowMovement]
  } : null;
  const worldSecrets = readWorldSecretState();
  worldSecrets[levelKey] = [...state.discoveredSecrets];
  const doorSequence = state.doorSequence ? {
    ...state.doorSequence,
    doorId: state.doorSequence.door.id
  } : null;
  if (doorSequence) delete doorSequence.door;
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    level: levelKey,
    camera: { yaw: state.yaw, pitch: state.pitch, zoom: state.zoom },
    player: { ...state.player, ledge: state.player.ledge ? { ...state.player.ledge } : null },
    inventory: { ...state.inventory },
    effects: {
      mana: { ...state.effects.mana },
      magic: { ...state.effects.magic }
    },
    collectibles: {
      coins: level.coins.map((coin) => Boolean(coin.collected)),
      potions: level.potions.map((potion) => Boolean(potion.collected))
    },
    enemies: state.enemies.map(({ visual, ...enemy }) => ({ ...enemy })),
    projectiles: state.projectiles.map((projectile) => ({ ...projectile })),
    explosions: state.explosions.map((explosion) => ({ ...explosion })),
    scorches: state.scorches.map((scorch) => ({ ...scorch })),
    secrets: [...state.discoveredSecrets],
    worldSecrets,
    tutorial,
    doorSequence
  };
}

function restoreGameSnapshot(snapshot) {
  const finite = (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  state.yaw = finite(snapshot.camera?.yaw, state.yaw);
  state.pitch = clamp(finite(snapshot.camera?.pitch, state.pitch), minPitch, maxPitch);
  state.projectionY = Math.sin(state.pitch);
  state.zoom = finite(snapshot.camera?.zoom, state.zoom);

  const playerFields = [
    "x", "y", "heading", "speed", "stride", "z", "floorZ", "vz", "jumpAge", "jumpArm",
    "grounded", "stance", "rollTime", "rollX", "rollY", "rollDirection", "attackTime",
    "specialTime", "interactTime", "holdingBomb", "stealth", "bombThrowTime", "landTime",
    "lastMoveX", "lastMoveY", "health", "maxHealth", "contactDamageCooldown", "hitFlash",
    "ledgeGrabCooldown"
  ];
  for (const field of playerFields) {
    if (snapshot.player && field in snapshot.player) state.player[field] = snapshot.player[field];
  }
  state.player.health = clamp(finite(state.player.health, 100), 0, state.player.maxHealth);
  state.player.stance = ["stand", "crouch", "crawl"].includes(state.player.stance) ? state.player.stance : "stand";
  state.player.ledge = snapshot.player?.ledge ? { ...snapshot.player.ledge } : null;

  const savedDoorSequence = snapshot.doorSequence;
  const savedDoor = (level.doors || []).find((door) => door.id === savedDoorSequence?.doorId);
  if (savedDoor) {
    const totalDuration = Object.values(doorTraversalTiming).reduce((sum, duration) => sum + duration, 0);
    state.doorSequence = {
      door: savedDoor,
      elapsed: clamp(finite(savedDoorSequence.elapsed, 0), 0, totalDuration),
      phase: ["align", "open", "pass", "close"].includes(savedDoorSequence.phase) ? savedDoorSequence.phase : "align",
      startX: finite(savedDoorSequence.startX, state.player.x),
      startY: finite(savedDoorSequence.startY, state.player.y),
      approachX: finite(savedDoorSequence.approachX, state.player.x),
      approachY: finite(savedDoorSequence.approachY, state.player.y),
      exitX: finite(savedDoorSequence.exitX, state.player.x),
      exitY: finite(savedDoorSequence.exitY, state.player.y),
      openAmount: clamp(finite(savedDoorSequence.openAmount, 0), 0, 1),
      transitionStarted: false
    };
  }

  for (const key of Object.keys(state.inventory)) {
    state.inventory[key] = Math.max(0, Math.floor(finite(snapshot.inventory?.[key], state.inventory[key])));
  }
  for (const group of Object.keys(state.effects)) {
    const saved = snapshot.effects?.[group];
    const valid = abilityGroups[group].options.some((option) => option.id === saved?.id);
    state.effects[group].id = valid ? saved.id : null;
    state.effects[group].remaining = valid ? clamp(finite(saved.remaining, 0), 0, abilityGroups[group].duration) : 0;
  }

  snapshot.collectibles?.coins?.forEach((collected, index) => {
    if (level.coins[index]) level.coins[index].collected = Boolean(collected);
  });
  snapshot.collectibles?.potions?.forEach((collected, index) => {
    if (level.potions[index]) level.potions[index].collected = Boolean(collected);
  });
  for (const savedEnemy of snapshot.enemies || []) {
    const enemy = state.enemies.find((candidate) => candidate.id === savedEnemy.id);
    if (!enemy) continue;
    for (const field of ["x", "y", "originX", "originY", "targetX", "targetY", "heading", "z", "health", "maxHealth", "contactDamage", "jumpClock", "cycleDuration", "activation", "active", "alive", "deathTime", "removed"]) {
      if (field in savedEnemy) enemy[field] = savedEnemy[field];
    }
  }
  state.projectiles = Array.isArray(snapshot.projectiles) ? snapshot.projectiles.map((item) => ({ ...item })) : [];
  state.explosions = Array.isArray(snapshot.explosions) ? snapshot.explosions.map((item) => ({ ...item })) : [];
  state.scorches = Array.isArray(snapshot.scorches) ? snapshot.scorches.map((item) => ({ ...item })) : [];
  const savedWorldSecrets = snapshot.worldSecrets && typeof snapshot.worldSecrets === "object" && !Array.isArray(snapshot.worldSecrets)
    ? snapshot.worldSecrets
    : {};
  const savedLevelSecrets = Array.isArray(savedWorldSecrets[levelKey]) ? savedWorldSecrets[levelKey] : snapshot.secrets;
  state.discoveredSecrets = new Set((Array.isArray(savedLevelSecrets) ? savedLevelSecrets : []).filter((secretId) => levelSecretIds.has(secretId)));
  try {
    window.sessionStorage.setItem(worldStateStorageKey, JSON.stringify(savedWorldSecrets));
  } catch {
    // The restored current-level discovery still remains active in memory.
  }
  persistSecretDiscovery();

  if (state.tutorial && snapshot.tutorial) {
    const savedTutorial = snapshot.tutorial;
    for (const field of ["step", "advancing", "advanceTimer", "sprintDistance", "jumpStarted", "crouchJumpStarted", "portalActive", "portalPull", "portalDive", "portalDiveTime", "portalHidden"]) {
      if (field in savedTutorial) state.tutorial[field] = savedTutorial[field];
    }
    state.tutorial.portal = { ...state.tutorial.portal, ...savedTutorial.portal };
    state.tutorial.movementKeys = new Set(savedTutorial.movementKeys || []);
    state.tutorial.stanceActions = new Set(savedTutorial.stanceActions || []);
    state.tutorial.lowMovement = new Set(savedTutorial.lowMovement || []);
  }
}

function downloadSaveGame() {
  const payload = JSON.stringify(gameSnapshot()).replaceAll("]]>", "]]]]><![CDATA[>");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<webrunnerSave version="1">\n  <state encoding="json"><![CDATA[${payload}]]></state>\n</webrunnerSave>\n`;
  const blob = new Blob([xml], { type: "application/xml" });
  const link = document.createElement("a");
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  link.href = URL.createObjectURL(blob);
  link.download = `webrunner-${levelKey}-${timestamp}.xml`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 0);
}

function persistSettings() {
  try {
    window.localStorage.setItem(settingsStorageKey, JSON.stringify(state.settings));
  } catch {
    // Settings remain active for the current session when storage is unavailable.
  }
}

function applyGraphicsSettings() {
  document.documentElement.dataset.graphics = state.settings.graphics;
  const resolution = graphicsResolution(state.settings.graphics);
  if (app.renderer.resolution !== resolution) {
    app.renderer.resolution = resolution;
    app.renderer.resize(window.innerWidth, window.innerHeight);
  }
}

function applyAudioSettings() {
  document.documentElement.style.setProperty("--master-volume", state.settings.volume);
  document.querySelectorAll("audio").forEach((audio) => {
    audio.volume = state.settings.volume;
  });
}

function hasMusicSource(audio) {
  return Boolean(audio?.currentSrc || audio?.getAttribute("src") || audio?.querySelector("source[src]"));
}

function startLevelMusic() {
  if (!hasMusicSource(levelMusic) || state.paused) return;
  levelMusic.volume = state.settings.volume;
  levelMusic.play().then(() => {
    window.removeEventListener("pointerdown", startLevelMusic);
    window.removeEventListener("keydown", startLevelMusic);
  }).catch(() => {
    // A later interaction can retry if the browser blocks this attempt.
  });
}

function showPausePanel(panel) {
  state.pausePanel = panel;
  hud.pauseMain.classList.toggle("hidden", panel !== "main");
  hud.pauseOptionsPanel.classList.toggle("hidden", panel !== "options");
  hud.pauseExitPanel.classList.toggle("hidden", panel !== "exit");
  const focusTarget = panel === "options"
    ? hud.graphicsQuality
    : panel === "exit"
      ? hud.cancelExit
      : hud.pauseResume;
  focusTarget.focus();
}

function pauseGame() {
  if (state.paused || state.transitioning) return;
  state.paused = true;
  state.keys.clear();
  closeItemMenu();
  restoreBrowserCursor();
  resumeMusicAfterPause = Boolean(levelMusic && !levelMusic.paused);
  levelMusic?.pause();
  hud.pauseSaveStatus.textContent = "";
  hud.pauseOverlay.classList.remove("hidden");
  showPausePanel("main");
}

function resumeGame() {
  if (!state.paused) return;
  state.paused = false;
  state.keys.clear();
  hud.pauseOverlay.classList.add("hidden");
  lastTime = performance.now();
  if (resumeMusicAfterPause || hasMusicSource(levelMusic)) startLevelMusic();
  resumeMusicAfterPause = false;
  app.canvas.focus();
}

function saveProgress() {
  try {
    window.sessionStorage.setItem(progressStorageKey, JSON.stringify(gameProgress()));
  } catch {
    // URL parameters still carry progress when local-file storage is unavailable.
  }
}

function targetWithProgress(target) {
  const url = new URL(target, window.location.href);
  for (const [name, value] of Object.entries(gameProgress())) url.searchParams.set(name, String(value));
  saveProgress();
  return url.href;
}

function startTransition(target, delay = 0, fadeSpeed = 1) {
  if (state.transitioning) return;
  state.transitioning = true;
  state.transitionTarget = targetWithProgress(target);
  state.transitionDelay = delay;
  state.transitionFadeSpeed = fadeSpeed;
  state.fade = 0;
}

function updateTransition(delta) {
  if (state.transitioning) {
    state.transitionDelay = Math.max(0, state.transitionDelay - delta);
    if (state.transitionDelay === 0) state.fade = Math.min(1, state.fade + delta * state.transitionFadeSpeed);
    if (state.fade >= 1 && state.transitionTarget) window.location.href = state.transitionTarget;
  } else if (state.fade > 0) {
    state.fade = Math.max(0, state.fade - delta * state.fadeSpeed);
  }
}

function beginDoorTraversal(door) {
  if (state.doorSequence || state.transitioning || !door.target) return false;
  const centerX = door.x + door.w / 2;
  const centerY = door.y;
  const approachDistance = playerCollisionRadius + 3;
  state.keys.clear();
  closeItemMenu();
  Object.assign(state.player, {
    stance: "stand",
    grounded: true,
    z: 0,
    vz: 0,
    rollTime: 0,
    attackTime: 0,
    specialTime: 0,
    interactTime: 0,
    bombThrowTime: 0,
    ledge: null,
    floorZ: doorElevation(level, door),
    heading: Math.atan2(-door.normalY, -door.normalX)
  });
  state.doorSequence = {
    door,
    elapsed: 0,
    phase: "align",
    startX: state.player.x,
    startY: state.player.y,
    approachX: centerX + door.normalX * approachDistance,
    approachY: centerY + door.normalY * approachDistance,
    exitX: centerX - door.normalX * meter * 0.72,
    exitY: centerY - door.normalY * meter * 0.72,
    openAmount: 0,
    transitionStarted: false
  };
  setStatus("Opening door");
  return true;
}

function nearbyDoor() {
  const player = state.player;
  return (level.doors || []).find((door) => {
    if (!door.target || Math.abs(player.floorZ + player.z - doorElevation(level, door)) > 18) return false;
    const centerX = door.x + door.w / 2;
    const dx = player.x - centerX;
    const dy = player.y - door.y;
    const inwardDistance = dx * door.normalX + dy * door.normalY;
    const tangentDistance = Math.abs(dx * -door.normalY + dy * door.normalX);
    return inwardDistance >= -2 && inwardDistance <= meter * 1.12 && tangentDistance <= door.w / 2 + 5;
  });
}

function tryStartDoorTraversal() {
  const door = nearbyDoor();
  return door ? beginDoorTraversal(door) : false;
}

function updateDoorTraversal(delta) {
  const sequence = state.doorSequence;
  if (!sequence) return;
  const timing = doorTraversalTiming;
  const alignEnd = timing.align;
  const openEnd = alignEnd + timing.open;
  const passEnd = openEnd + timing.pass;
  const closeEnd = passEnd + timing.close;
  sequence.elapsed = Math.min(closeEnd, sequence.elapsed + delta);

  if (sequence.elapsed < alignEnd) {
    sequence.phase = "align";
    const progress = sequence.elapsed / timing.align;
    const eased = progress * progress * (3 - 2 * progress);
    state.player.x = sequence.startX + (sequence.approachX - sequence.startX) * eased;
    state.player.y = sequence.startY + (sequence.approachY - sequence.startY) * eased;
    sequence.openAmount = 0;
  } else if (sequence.elapsed < openEnd) {
    sequence.phase = "open";
    const progress = (sequence.elapsed - alignEnd) / timing.open;
    sequence.openAmount = progress * progress * (3 - 2 * progress);
    state.player.x = sequence.approachX;
    state.player.y = sequence.approachY;
  } else if (sequence.elapsed < passEnd) {
    if (sequence.phase !== "pass") setStatus("Passing through door");
    sequence.phase = "pass";
    sequence.openAmount = 1;
    const progress = (sequence.elapsed - openEnd) / timing.pass;
    const eased = progress * progress * (3 - 2 * progress);
    state.player.x = sequence.approachX + (sequence.exitX - sequence.approachX) * eased;
    state.player.y = sequence.approachY + (sequence.exitY - sequence.approachY) * eased;
    state.player.stride += delta * 13;
  } else {
    if (sequence.phase !== "close") setStatus("Closing door");
    sequence.phase = "close";
    const progress = (sequence.elapsed - passEnd) / timing.close;
    sequence.openAmount = 1 - progress * progress * (3 - 2 * progress);
    state.player.x = sequence.exitX;
    state.player.y = sequence.exitY;
    if (sequence.elapsed >= closeEnd && !sequence.transitionStarted) {
      sequence.openAmount = 0;
      sequence.transitionStarted = true;
      startTransition(sequence.door.target);
    }
  }
}

function preloadDestination(target) {
  if (!target || window.location.protocol !== "file:") return;
  const frame = document.createElement("iframe");
  const url = new URL(target, window.location.href);
  url.searchParams.delete("fade");
  url.searchParams.set("preload", "1");
  frame.src = url.href;
  frame.title = "Level asset preload";
  frame.setAttribute("aria-hidden", "true");
  frame.style.display = "none";
  const release = (event) => {
    if (event.source !== frame.contentWindow || event.data?.type !== "webrunner-assets-ready") return;
    window.removeEventListener("message", release);
    frame.remove();
  };
  window.addEventListener("message", release);
  document.body.appendChild(frame);
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
  const cameraX = level.kind === "platform" ? 0 : state.player.x;
  const cameraY = level.kind === "platform" ? 0 : state.player.y;
  const cameraFloor = level.kind === "platform" ? 0 : state.player.floorZ;
  const p = rotate(x - cameraX, y - cameraY, -state.yaw);
  return {
    x: state.width / 2 + p.x * state.zoom,
    y: state.height / 2 + p.y * state.projectionY * state.zoom - (z - cameraFloor) * state.zoom
  };
}

function cameraDepth(x, y) {
  const cameraX = level.kind === "platform" ? 0 : state.player.x;
  const cameraY = level.kind === "platform" ? 0 : state.player.y;
  return rotate(x - cameraX, y - cameraY, -state.yaw).y;
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

function outlineWorldRect(rect, stroke, width = 3, alpha = 1, target = g) {
  const z = waterSurfaceElevation + 0.2;
  const corners = [
    worldToScreen(rect.x, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y, z),
    worldToScreen(rect.x + rect.w, rect.y + rect.h, z),
    worldToScreen(rect.x, rect.y + rect.h, z)
  ];
  for (let index = 0; index < corners.length; index += 1) {
    line(corners[index], corners[(index + 1) % corners.length], stroke, width, alpha, target);
  }
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

function strokedArc(target, x, y, radius, start, end, stroke, width = 2, alpha = 1) {
  target.moveTo(x + Math.cos(start) * radius, y + Math.sin(start) * radius);
  target.arc(x, y, radius, start, end).stroke({ color: stroke, width, alpha });
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

function projectedSprite(sprite, rect, z, texture) {
  sprite.visible = true;
  sprite.texture = texture;
  sprite.anchor.set(0.5);
  const center = worldToScreen(rect.x + rect.w / 2, rect.y + rect.h / 2, z);
  const c = Math.cos(state.yaw);
  const s = Math.sin(state.yaw);
  const scaleX = rect.w * state.zoom / texture.width;
  const scaleY = rect.h * state.zoom / texture.height;
  sprite.setFromMatrix(new Matrix(c * scaleX, -s * state.projectionY * scaleX, s * scaleY, c * state.projectionY * scaleY, center.x, center.y));
}

function drawWaterPool(pool, index) {
  let sprite = waterSprites[index];
  if (!sprite) {
    sprite = new TilingSprite({ texture: art.water, width: art.water.width, height: art.water.height });
    waterSprites[index] = sprite;
    waterLayer.addChild(sprite);
  }
  projectedSprite(sprite, pool, waterSurfaceElevation, art.water);
  sprite.tilePosition.y = -(performance.now() * waterFlowSpeed % art.water.height);
  sprite.alpha = 0.82;
  sprite.tint = 0xbad6cf;
}

function waterBasinRect(pool) {
  return {
    x: pool.x + waterBasinInset,
    y: pool.y + waterBasinInset,
    w: pool.w - waterBasinInset * 2,
    h: pool.h - waterBasinInset * 2
  };
}

function playerInDeepWater() {
  const playerFeetElevation = state.player.floorZ + state.player.z;
  return level.kind === "dungeon"
    && playerFeetElevation <= waterSurfaceElevation + waterWadingClearance
    && level.waterPools.some((pool) => pointInRect(
      state.player.x,
      state.player.y,
      waterBasinRect(pool)
    ));
}

function objectSprite(key, texture, foreground = false, elevated = false) {
  const sprites = foreground ? occlusionSprites : elevated ? elevatedScenerySprites : scenerySprites;
  const layer = foreground ? occlusionSpriteLayer : elevated ? elevatedSceneryLayer : scenerySpriteLayer;
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = new Sprite(texture);
    sprites.set(key, sprite);
    layer.addChild(sprite);
  }
  sprite.visible = true;
  sprite.texture = texture;
  return sprite;
}

function pointInRect(x, y, rect, pad = 0) {
  return x >= rect.x - pad && x <= rect.x + rect.w + pad && y >= rect.y - pad && y <= rect.y + rect.h + pad;
}

function pointInDiscoveredSecret(x, y, pad = 0) {
  return (level.secrets || []).some((secret) =>
    state.discoveredSecrets.has(secret.id) && secret.areas.some((area) => pointInRect(x, y, area, pad))
  );
}

function pointInRawWalkable(x, y) {
  if (level.kind === "infinite") return true;
  if (level.kind === "platform") return pointInRect(x, y, level.bounds[0]);
  if (level.bounds.some((rect) => pointInRect(x, y, rect))) return true;
  return pointInDiscoveredSecret(x, y);
}

function pointInWalkable(x, y, radius = 0) {
  if (level.kind === "infinite") return true;
  const samples = [[x, y], [x - radius, y], [x + radius, y], [x, y - radius], [x, y + radius]];
  return samples.every(([sx, sy]) => pointInRawWalkable(sx, sy));
}

function groundElevation(x, y, highestReachableSurface = Number.POSITIVE_INFINITY) {
  if (level.kind === "platform") {
    return level.platforms.some((platform) => pointInRect(x, y, platform)) ? platformTopElevation : -9999;
  }
  if (level.kind !== "dungeon") return 0;
  const stairPlan = stairGeometry(level);
  const stairBounds = {
    x: stairPlan.x,
    y: stairPlan.topY,
    w: stairPlan.w,
    h: stairPlan.bottomEdge - stairPlan.topY
  };
  if (pointInRect(x, y, stairBounds)) {
    const progress = clamp((stairPlan.bottomEdge - y) / (stairPlan.bottomEdge - stairPlan.topEdge), 0, 1);
    return progress * level.platformHeight;
  }
  if (pointInRect(x, y, level.upperPlatform) && level.platformHeight <= highestReachableSurface) {
    return level.platformHeight;
  }
  for (const column of level.columns) {
    if (Math.hypot(x - column.x, y - column.y) <= columnRadius) return 70;
  }
  for (const pool of level.waterPools) {
    if (pointInRect(x, y, waterBasinRect(pool))) return -waterBasinDepth;
  }
  return 0;
}

function columnBlocksMovement(x, y, worldZ) {
  if (level.kind !== "dungeon" || worldZ >= 68) return false;
  return level.columns.some((column) => (
    Math.hypot(x - column.x, y - column.y) < columnRadius + playerCollisionRadius
  ));
}

function ledgeCandidates() {
  if (level.kind !== "dungeon") return [];
  const candidates = [];
  const platform = level.upperPlatform;
  const stair = stairGeometry(level);
  const edgeY = platform.y + platform.h;
  const minX = Math.max(platform.x, stair.x + stair.w) + playerCollisionRadius;
  const maxX = platform.x + platform.w - playerCollisionRadius;
  const edgeX = clamp(state.player.x, minX, maxX);
  if (state.player.y >= edgeY - 2) {
    const lowerZ = groundElevation(edgeX, edgeY + playerCollisionRadius + 4);
    candidates.push({
      kind: "walkway",
      x: edgeX,
      y: edgeY,
      distance: Math.hypot(state.player.x - edgeX, state.player.y - edgeY),
      topZ: level.platformHeight,
      lowerZ,
      normalX: 0,
      normalY: 1,
      tangentX: 1,
      tangentY: 0,
      along: edgeX - minX,
      length: maxX - minX,
      originX: minX,
      originY: edgeY,
      allowShimmy: maxX - minX > meter * 1.25,
      climbX: edgeX,
      climbY: edgeY - playerCollisionRadius - 4
    });
  }

  for (const column of level.columns) {
    const dx = state.player.x - column.x;
    const dy = state.player.y - column.y;
    const distanceFromCenter = Math.hypot(dx, dy) || 1;
    if (distanceFromCenter < columnRadius - 2) continue;
    const normalX = dx / distanceFromCenter;
    const normalY = dy / distanceFromCenter;
    const x = column.x + normalX * columnRadius;
    const y = column.y + normalY * columnRadius;
    const lowerZ = groundElevation(
      column.x + normalX * (columnRadius + playerCollisionRadius + 4),
      column.y + normalY * (columnRadius + playerCollisionRadius + 4)
    );
    candidates.push({
      kind: "column",
      x,
      y,
      distance: Math.abs(distanceFromCenter - columnRadius),
      topZ: 70,
      lowerZ,
      normalX,
      normalY,
      tangentX: -normalY,
      tangentY: normalX,
      along: 0,
      length: 0,
      originX: x,
      originY: y,
      allowShimmy: false,
      climbX: column.x,
      climbY: column.y
    });
  }
  return candidates;
}

function tryGrabLedge() {
  const player = state.player;
  if (player.grounded || player.ledge || player.ledgeGrabCooldown > 0 || player.rollTime > 0 || player.stance !== "stand") return false;
  const feetZ = player.floorZ + player.z;
  const candidate = ledgeCandidates()
    .filter((ledge) => ledge.distance <= ledgeGrabReach && feetZ <= ledge.topZ + 10 && feetZ >= ledge.topZ - ledgeVerticalReach)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!candidate) return false;

  player.ledge = { ...candidate, mode: "hang", age: 0, motion: 0, motionTime: 0, climbTime: 0 };
  player.x = candidate.x;
  player.y = candidate.y;
  player.floorZ = candidate.lowerZ;
  player.z = Math.max(0, candidate.topZ - candidate.lowerZ);
  player.vz = 0;
  player.grounded = false;
  player.heading = Math.atan2(-candidate.normalY, -candidate.normalX);
  player.jumpAge = 0;
  player.jumpArm = 0;
  player.attackTime = 0;
  player.specialTime = 0;
  player.interactTime = 0;
  if (!hud.itemMenu.classList.contains("hidden")) closeItemMenu();
  setStatus(candidate.kind === "column" ? "Column ledge grabbed" : "Ledge grabbed");
  return true;
}

function startLedgeClimb() {
  const ledge = state.player.ledge;
  if (!ledge || ledge.mode === "climb") return;
  ledge.mode = "climb";
  ledge.climbTime = 0;
  ledge.motion = 0;
  setStatus("Climb up");
}

function releaseLedge(jumpAway = false) {
  const player = state.player;
  const ledge = player.ledge;
  if (!ledge) return;
  player.x += ledge.normalX * (jumpAway ? 12 : 7);
  player.y += ledge.normalY * (jumpAway ? 12 : 7);
  player.floorZ = ledge.lowerZ;
  player.z = Math.max(0, ledge.topZ - ledge.lowerZ - 6);
  player.vz = jumpAway ? 250 : -80;
  player.grounded = false;
  player.ledge = null;
  player.ledgeGrabCooldown = jumpAway ? 0.5 : 0.38;
  setStatus(jumpAway ? "Ledge jump" : "Ledge released");
}

function updateLedge(delta) {
  const player = state.player;
  const ledge = player.ledge;
  if (!ledge) return;
  ledge.age += delta;
  player.vz = 0;
  player.floorZ = ledge.lowerZ;
  player.z = Math.max(0, ledge.topZ - ledge.lowerZ);
  player.heading = Math.atan2(-ledge.normalY, -ledge.normalX);

  if (ledge.mode === "climb") {
    ledge.climbTime += delta;
    if (ledge.climbTime >= ledgeClimbDuration) {
      player.x = ledge.climbX;
      player.y = ledge.climbY;
      player.floorZ = ledge.topZ;
      player.z = 0;
      player.vz = 0;
      player.grounded = true;
      player.ledge = null;
      player.ledgeGrabCooldown = 0.28;
      player.landTime = 0.12;
      setStatus("Climbed up");
    }
    return;
  }

  if (state.keys.has("KeyW") || state.keys.has("ArrowUp")) {
    startLedgeClimb();
    return;
  }

  const lateral = (state.keys.has("KeyD") || state.keys.has("ArrowRight") ? 1 : 0)
    - (state.keys.has("KeyA") || state.keys.has("ArrowLeft") ? 1 : 0);
  ledge.motion = ledge.allowShimmy ? lateral : 0;
  if (ledge.motion !== 0) {
    ledge.motionTime += delta;
    ledge.along = clamp(ledge.along + ledge.motion * ledgeShimmySpeed * delta, 0, ledge.length);
    player.x = ledge.originX + ledge.tangentX * ledge.along;
    player.y = ledge.originY + ledge.tangentY * ledge.along;
    ledge.x = player.x;
    ledge.y = player.y;
    ledge.climbX = player.x - ledge.normalX * (playerCollisionRadius + 4);
    ledge.climbY = player.y - ledge.normalY * (playerCollisionRadius + 4);
  } else {
    ledge.motionTime = 0;
  }
}

function drawInfiniteFloor() {
  const baseX = Math.floor(state.player.x / tile);
  const baseY = Math.floor(state.player.y / tile);
  const radius = floorRenderRadius * (effectActive("mana", "extendedSight") ? 1.5 : 1);
  const extent = Math.ceil(radius) + 1;
  for (let gy = baseY - extent; gy <= baseY + extent; gy += 1) {
    for (let gx = baseX - extent; gx <= baseX + extent; gx += 1) {
      const dist = Math.hypot((gx + 0.5) * tile - state.player.x, (gy + 0.5) * tile - state.player.y);
      if (dist <= tile * radius) drawTile(gx, gy);
    }
  }
}

function drawTutorialFloor() {
  const baseX = Math.floor(state.player.x / tile);
  const baseY = Math.floor(state.player.y / tile);
  const radius = floorRenderRadius * (effectActive("mana", "extendedSight") ? 1.5 : 1);
  const bounds = level.bounds[0];
  const extent = Math.ceil(radius) + 1;
  for (let gy = baseY - extent; gy <= baseY + extent; gy += 1) {
    for (let gx = baseX - extent; gx <= baseX + extent; gx += 1) {
      const centerX = gx * tile + tile / 2;
      const centerY = gy * tile + tile / 2;
      const dist = Math.hypot(centerX - state.player.x, centerY - state.player.y);
      if (dist <= tile * radius && pointInRect(centerX, centerY, bounds)) drawTile(gx, gy);
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
  level.waterPools.forEach((pool, index) => {
    const basin = waterBasinRect(pool);
    drawWaterPool(pool, index);
    rectWorld(pool, 0x153d43, 0x9ab1a8, 0.08);
    rectWorld(basin, 0x343a3b, null, 0.5);
    rectWorld({ x: pool.x + 7, y: pool.y + 7, w: pool.w - 14, h: pool.h - 14 }, 0x2b7276, null, 0.06);
    outlineWorldRect(basin, 0x8eb4b1, 4.5, 0.82);
  });
  drawDiscoveredSecrets();
  drawWalls();
  drawSecretControls();
  drawWallVines();
  drawSceneObjects();
  drawStairs(elevatedLayer);
  drawUpperPlatform(elevatedLayer);
}

function drawDiscoveredSecrets() {
  for (const secret of level.secrets || []) {
    if (!state.discoveredSecrets.has(secret.id)) continue;
    for (const area of secret.areas) {
      const corners = [
        worldToScreen(area.x, area.y, 0),
        worldToScreen(area.x + area.w, area.y, 0),
        worldToScreen(area.x + area.w, area.y + area.h, 0),
        worldToScreen(area.x, area.y + area.h, 0)
      ];
      poly(corners, area.kind === "tunnel" ? 0x526267 : 0x445157, 0x84969a, 2.5, 0.2);
      const outwardNormals = [{ x: 0, y: -1 }, { x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }];
      const revealedAreas = (level.secrets || [])
        .filter((candidate) => state.discoveredSecrets.has(candidate.id))
        .flatMap((candidate) => candidate.areas);
      for (let index = 0; index < corners.length; index += 1) {
        const next = (index + 1) % corners.length;
        const edgeWorld = [
          { x: area.x + area.w / 2, y: area.y },
          { x: area.x + area.w, y: area.y + area.h / 2 },
          { x: area.x + area.w / 2, y: area.y + area.h },
          { x: area.x, y: area.y + area.h / 2 }
        ][index];
        const normal = outwardNormals[index];
        const joinsWalkableArea = [...level.bounds, ...revealedAreas].some((rect) =>
          rect !== area && pointInRect(edgeWorld.x + normal.x * 2, edgeWorld.y + normal.y * 2, rect)
        );
        if (joinsWalkableArea) continue;
        const topA = { x: corners[index].x, y: corners[index].y - 42 * state.zoom };
        const topB = { x: corners[next].x, y: corners[next].y - 42 * state.zoom };
        poly([corners[index], corners[next], topB, topA], 0x566166, 0x91a0a2, 1.5, 0.1);
      }
    }
  }
}

function secretControlBlocked(control) {
  for (const blocker of control.blockedBy || []) {
    if (blocker.type === "enemy") {
      const enemy = state.enemies.find((candidate) => candidate.id === blocker.id);
      if (enemy?.alive && !enemy.removed) return true;
    }
    if (blocker.type === "secret" && !state.discoveredSecrets.has(blocker.id)) return true;
    if (blocker.type === "movingWall" && !state.discoveredSecrets.has(blocker.openedBy)) return true;
    if (blocker.type === "item") {
      const collection = blocker.collection === "potions" ? level.potions : level.coins;
      const item = collection.find((candidate) => candidate.id === blocker.id);
      if (item && !item.collected) return true;
    }
    if (blocker.type === "coin") {
      const coin = level.coins.find((candidate) => candidate.id === blocker.id);
      if (coin && !coin.collected) return true;
    }
    if (blocker.type === "potion") {
      const potion = level.potions.find((candidate) => candidate.id === blocker.id);
      if (potion && !potion.collected) return true;
    }
  }
  return false;
}

function drawSecretControls() {
  for (const secret of level.secrets || []) {
    const control = secret.control;
    const active = state.discoveredSecrets.has(secret.id);
    const p = worldToScreen(control.x, control.y, control.z);
    const s = state.zoom;
    const plateColor = active ? 0x47664e : 0x302d28;
    g.roundRect(p.x - 12 * s, p.y - 15 * s, 24 * s, 30 * s, 3 * s)
      .fill({ color: plateColor, alpha: 0.96 })
      .stroke({ color: 0x100e0b, width: 2 * s });
    if (control.type === "button") {
      g.circle(p.x, p.y, 6 * s)
        .fill(active ? 0x78b087 : 0x8f513d)
        .stroke({ color: 0x17120e, width: 2 * s });
    } else {
      const leverEnd = active
        ? { x: p.x + 8 * s, y: p.y + 8 * s }
        : { x: p.x - 7 * s, y: p.y - 18 * s };
      line({ x: p.x, y: p.y + 5 * s }, leverEnd, active ? 0x99b49a : 0xb5a075, 5 * s, 1);
      g.circle(leverEnd.x, leverEnd.y, 5 * s).fill(active ? 0x6e9b75 : 0x6d392c);
    }
  }
}

function drawWallVines(foreground = false, forceVisible = null) {
  if (!level.vines || !art.vines) return;
  const sprites = foreground ? occlusionVineSprites : vineSprites;
  const layer = foreground ? occlusionDecorationLayer : scenerySpriteLayer;
  const overlap = 0.1;

  for (const vine of level.vines) {
    if (foreground && cameraDepth(vine.x, vine.y) <= 8 && !forceVisible?.(vine)) continue;
    const textures = art.vines[vine.size] || art.vines.medium;
    const parts = ["base", ...Array(vine.middleCount || 0).fill("middle"), "tip"];
    const moduleHeight = vine.height / (parts.length - overlap * (parts.length - 1));
    const moduleStep = moduleHeight * (1 - overlap);
    const mirror = vine.mirror ? -1 : 1;

    parts.forEach((part, index) => {
      const texture = textures[part];
      const key = `${vine.id}:${index}`;
      let sprite = sprites.get(key);
      if (!sprite) {
        sprite = new Sprite(texture);
        sprite.anchor.set(0, 0);
        sprites.set(key, sprite);
        layer.addChild(sprite);
      }

      const topZ = vine.topZ - index * moduleStep;
      const bottomZ = topZ - moduleHeight;
      const halfWidth = vine.width / 2;
      const leftX = vine.x - vine.tangentX * halfWidth * mirror;
      const leftY = vine.y - vine.tangentY * halfWidth * mirror;
      const rightX = vine.x + vine.tangentX * halfWidth * mirror;
      const rightY = vine.y + vine.tangentY * halfWidth * mirror;
      const topLeft = worldToScreen(leftX, leftY, topZ);
      const topRight = worldToScreen(rightX, rightY, topZ);
      const bottomLeft = worldToScreen(leftX, leftY, bottomZ);

      sprite.visible = true;
      sprite.texture = texture;
      sprite.alpha = (vine.alpha || 0.94) * (state.settings.graphics === "low" ? 0.78 : 1);
      sprite.tint = 0xf4ead2;
      sprite.setFromMatrix(new Matrix(
        (topRight.x - topLeft.x) / texture.width,
        (topRight.y - topLeft.y) / texture.width,
        (bottomLeft.x - topLeft.x) / texture.height,
        (bottomLeft.y - topLeft.y) / texture.height,
        topLeft.x,
        topLeft.y
      ));
    });
  }
}

function drawPlatformRoom() {
  const room = level.bounds[0];
  rectWorld(room, 0x0c1014, 0x29333b, 1);
  const wall = level.backWall;
  drawWallSegment(
    wall.x,
    wall.y,
    wall.x + wall.w,
    wall.y,
    0x241e18,
    wall.height,
    g,
    platformTopElevation,
    true,
    `platform-back-wall:${wall.x}:${wall.y}:${wall.w}`
  );
  for (const door of level.doors) {
    if (!doorOccludesPlayer(door)) drawConfiguredDoor(door, g);
  }
  drawWallVines();
  for (const platform of level.platforms) {
    drawPlatformPrism(platform, platformTopElevation, elevatedLayer, true);
  }
  drawSceneObjects(elevatedLayer, true);
}

function splitWallAtSecretOpenings(segment) {
  const [x1, y1, x2, y2, fill] = segment;
  const vertical = Math.abs(x1 - x2) < 0.01;
  const horizontal = Math.abs(y1 - y2) < 0.01;
  if (!vertical && !horizontal) return [segment];

  const start = vertical ? y1 : x1;
  const end = vertical ? y2 : x2;
  const length = end - start;
  let spans = [{ from: 0, to: 1 }];
  for (const secret of level.secrets || []) {
    if (!state.discoveredSecrets.has(secret.id)) continue;
    const opening = secret.opening;
    const matches = vertical
      ? opening.w === 0 && Math.abs(opening.x - x1) < 0.01
      : opening.h === 0 && Math.abs(opening.y - y1) < 0.01;
    if (!matches) continue;
    const openingStart = vertical ? opening.y : opening.x;
    const openingEnd = openingStart + (vertical ? opening.h : opening.w);
    const cutFrom = clamp(Math.min((openingStart - start) / length, (openingEnd - start) / length), 0, 1);
    const cutTo = clamp(Math.max((openingStart - start) / length, (openingEnd - start) / length), 0, 1);
    spans = spans.flatMap((span) => {
      if (cutTo <= span.from || cutFrom >= span.to) return [span];
      const pieces = [];
      if (cutFrom > span.from) pieces.push({ from: span.from, to: cutFrom });
      if (cutTo < span.to) pieces.push({ from: cutTo, to: span.to });
      return pieces;
    });
  }
  return spans
    .filter((span) => span.to - span.from > 0.0001)
    .map((span) => [
      x1 + (x2 - x1) * span.from,
      y1 + (y2 - y1) * span.from,
      x1 + (x2 - x1) * span.to,
      y1 + (y2 - y1) * span.to,
      fill
    ]);
}

function drawWalls(target = g, foregroundOnly = false, forceExitWall = false) {
  const planScale = level.planScale || 1;
  const s = (value) => value * planScale;
  const segments = [
    [s(-300), s(140), s(-56), s(140), 0x241e18], [s(56), s(140), s(300), s(140), 0x241e18], [s(300), s(140), s(300), s(600), 0x191510],
    [s(300), s(600), s(-300), s(600), 0x2d261e], [s(-300), s(600), s(-300), s(140), 0x17130f], [s(-56), s(140), s(-56), s(-340), 0x17130f],
    [s(56), s(-340), s(56), s(140), 0x191510], [s(-380), s(-340), s(-56), s(-340), 0x241e18], [s(56), s(-340), s(380), s(-340), 0x241e18],
    [s(380), s(-340), s(380), s(-920), 0x191510], [s(380), s(-920), s(354), s(-920), 0x2d261e], [s(292), s(-920), s(-380), s(-920), 0x2d261e],
    [s(-380), s(-920), s(-380), s(-340), 0x17130f]
  ];
  for (const [x1, y1, x2, y2, fill] of segments.flatMap(splitWallAtSecretOpenings)) {
    const exitWallSegment = forceExitWall && Math.abs(y1 - level.exit.y) <= 0.01 && Math.abs(y2 - level.exit.y) <= 0.01;
    const visible = foregroundOnly && !exitWallSegment ? clipSegmentInFront(x1, y1, x2, y2) : { x1, y1, x2, y2 };
    if (!visible) continue;
    const midpointY = (y1 + y2) / 2;
    const wallHeight = midpointY <= s(-340) ? elevatedChamberWallHeight : midpointY < s(140) ? 98 : 80;
    const textureOffset = Math.hypot(visible.x1 - x1, visible.y1 - y1);
    drawWallSegment(
      visible.x1,
      visible.y1,
      visible.x2,
      visible.y2,
      fill,
      wallHeight,
      target,
      0,
      true,
      `wall:${x1}:${y1}:${x2}:${y2}:${wallHeight}`,
      textureOffset,
      visible.clippedStart,
      visible.clippedEnd
    );
  }
  drawElevatedDoorwayWall(target, foregroundOnly && !forceExitWall);
  drawWaterTunnels(target, foregroundOnly);
}

function clipSegmentInFront(x1, y1, x2, y2, margin = 8) {
  const depth1 = cameraDepth(x1, y1) - margin;
  const depth2 = cameraDepth(x2, y2) - margin;
  if (depth1 <= 0 && depth2 <= 0) return null;
  if (depth1 > 0 && depth2 > 0) return { x1, y1, x2, y2, clippedStart: false, clippedEnd: false };

  const ratio = depth1 / (depth1 - depth2);
  const cutX = x1 + (x2 - x1) * ratio;
  const cutY = y1 + (y2 - y1) * ratio;
  return depth1 > 0
    ? { x1, y1, x2: cutX, y2: cutY, clippedStart: false, clippedEnd: true }
    : { x1: cutX, y1: cutY, x2, y2, clippedStart: true, clippedEnd: false };
}

function drawWaterTunnels(target = g, foregroundOnly = false) {
  const tunnelHeight = 74;
  const y = level.bounds.find((rect) => rect.name === "pool").y - 0.5;
  for (const pool of level.waterPools) {
    const inset = 7;
    const visible = foregroundOnly
      ? clipSegmentInFront(pool.x + inset, y, pool.x + pool.w - inset, y)
      : { x1: pool.x + inset, y1: y, x2: pool.x + pool.w - inset, y2: y };
    if (!visible) continue;
    const x1 = visible.x1;
    const x2 = visible.x2;
    const bottomLeft = worldToScreen(x1, y, 0);
    const bottomRight = worldToScreen(x2, y, 0);
    const topRight = worldToScreen(x2, y, tunnelHeight);
    const topLeft = worldToScreen(x1, y, tunnelHeight);
    poly([bottomLeft, bottomRight, topRight, topLeft], 0x020607, null, 1, 0.96, target);
    line(bottomLeft, bottomRight, 0x172526, 3, 1, target);
    line(topLeft, topRight, 0x172526, 3, 1, target);
    if (!visible.clippedStart) line(bottomLeft, topLeft, 0x172526, 3, 1, target);
    if (!visible.clippedEnd) line(bottomRight, topRight, 0x172526, 3, 1, target);
    if (x2 - x1 > 16) {
      line(
        worldToScreen(x1 + 8, y - 0.2, 10),
        worldToScreen(x2 - 8, y - 0.2, 10),
        0x32666a,
        2,
        0.72,
        target
      );
    }
  }
}

function drawWallSegment(
  x1,
  y1,
  x2,
  y2,
  fill,
  wallHeight,
  target = g,
  baseZ = 0,
  finishTop = true,
  textureKey = null,
  textureOffset = 0,
  clippedStart = false,
  clippedEnd = false
) {
  const h = wallHeight * state.zoom;
  const a = worldToScreen(x1, y1, baseZ);
  const b = worldToScreen(x2, y2, baseZ);
  const face = [{ x: a.x, y: a.y }, { x: b.x, y: b.y }, { x: b.x, y: b.y - h }, { x: a.x, y: a.y - h }];
  drawWallTextureSprite(x1, y1, x2, y2, wallHeight, baseZ, target === occlusionLayer, textureKey, textureOffset);
  target.poly(face.flatMap((point) => [point.x, point.y])).fill({ color: fill, alpha: 0.34 });
  line(face[0], face[1], 0x050403, 3, 1, target);
  line(face[3], face[2], 0x050403, 3, 1, target);
  if (!clippedStart) line(face[0], face[3], 0x050403, 3, 1, target);
  if (!clippedEnd) line(face[1], face[2], 0x050403, 3, 1, target);
  if (finishTop) {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const length = Math.hypot(dx, dy) || 1;
    const lipX = -dy / length * 9;
    const lipY = dx / length * 9;
    const lip = [
      { x: a.x, y: a.y - h }, { x: b.x, y: b.y - h },
      { x: b.x + lipX, y: b.y - h + lipY }, { x: a.x + lipX, y: a.y - h + lipY }
    ];
    poly(lip, 0x4b443b, null, 1, 1, target);
    line(lip[0], lip[1], 0x100d0a, 2, 1, target);
    line(lip[3], lip[2], 0x100d0a, 2, 1, target);
    if (!clippedStart) line(lip[0], lip[3], 0x100d0a, 2, 1, target);
    if (!clippedEnd) line(lip[1], lip[2], 0x100d0a, 2, 1, target);
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
      ], 0x77746f, null, 1, 0.36 - i * 0.065, target);
    }
  }
}

function drawWallTextureSprite(x1, y1, x2, y2, wallHeight, baseZ, foreground, textureKey = null, textureOffset = 0) {
  const sprites = foreground ? occlusionWallTextureSprites : wallTextureSprites;
  const layer = foreground ? occlusionWallTextureLayer : wallTextureLayer;
  const key = textureKey || `${x1}:${y1}:${x2}:${y2}:${wallHeight}:${baseZ}`;
  let sprite = sprites.get(key);
  if (!sprite) {
    sprite = new TilingSprite({ texture: art.wall, width: 1, height: 1 });
    sprite.anchor.set(0, 0);
    sprite.tileScale.set(0.28);
    sprites.set(key, sprite);
    layer.addChild(sprite);
  }

  const segmentLength = Math.hypot(x2 - x1, y2 - y1) || 1;
  const a = worldToScreen(x1, y1, baseZ);
  const b = worldToScreen(x2, y2, baseZ);
  sprite.visible = true;
  sprite.width = segmentLength;
  sprite.height = wallHeight;
  sprite.alpha = 0.96;
  sprite.tint = 0xc9b99f;
  sprite.tilePosition.set(-textureOffset, 0);
  sprite.setFromMatrix(new Matrix(
    (b.x - a.x) / segmentLength,
    (b.y - a.y) / segmentLength,
    0,
    -state.zoom,
    a.x,
    a.y
  ));
}

function drawElevatedDoorwayWall(target = g, foregroundOnly = false) {
  const x1 = level.exit.x;
  const x2 = level.exit.x + level.exit.w;
  const y = level.exit.y;
  const visible = foregroundOnly ? clipSegmentInFront(x1, y, x2, y) : { x1, y1: y, x2, y2: y };
  if (!visible) return;
  const textureOffset = Math.hypot(visible.x1 - x1, visible.y1 - y);

  drawWallSegment(visible.x1, visible.y1, visible.x2, visible.y2, 0x2d261e, level.platformHeight, target, 0, false, `door-base:${x1}:${x2}`, textureOffset, visible.clippedStart, visible.clippedEnd);
  const headerBase = level.platformHeight + elevatedExitHeight;
  drawWallSegment(
    visible.x1,
    visible.y1,
    visible.x2,
    visible.y2,
    0x2d261e,
    elevatedChamberWallHeight - headerBase,
    target,
    headerBase,
    true,
    `door-header:${x1}:${x2}`,
    textureOffset,
    visible.clippedStart,
    visible.clippedEnd
  );
}

function texturedFace(points, texture, tint = 0xffffff, alpha = 1, scale = 0.13, target = g) {
  target.poly(points.flatMap((point) => [point.x, point.y])).fill({
    texture,
    color: tint,
    matrix: new Matrix().scale(scale),
    alpha
  }).stroke({ color: 0x080706, width: 2 });
}

function drawPlatformPrism(rect, z, target = g, fadeBottom = false) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.w, y: rect.y },
    { x: rect.x + rect.w, y: rect.y + rect.h },
    { x: rect.x, y: rect.y + rect.h }
  ];
  const top = corners.map((corner) => worldToScreen(corner.x, corner.y, z));
  const centerDepth = cameraDepth(rect.x + rect.w / 2, rect.y + rect.h / 2);
  const visibleSides = corners.map((corner, index) => {
    const nextIndex = (index + 1) % corners.length;
    const next = corners[nextIndex];
    return {
      index,
      nextIndex,
      depth: cameraDepth((corner.x + next.x) / 2, (corner.y + next.y) / 2)
    };
  }).filter((side) => side.depth >= centerDepth)
    .sort((a, b) => a.depth - b.depth);

  for (const side of visibleSides) {
    const a = corners[side.index];
    const b = corners[side.nextIndex];
    const platformDepth = fadeBottom ? 92 : raisedPlatformThickness;
    const bottomB = worldToScreen(b.x, b.y, z - platformDepth);
    const bottomA = worldToScreen(a.x, a.y, z - platformDepth);
    const face = [
      top[side.index],
      top[side.nextIndex],
      bottomB,
      bottomA
    ];
    poly(face, side.index % 2 ? 0x4b4338 : 0x373129, 0x080706, 2, 1, target);
    texturedFace(face, art.wall, side.index % 2 ? 0xb5a287 : 0x95856f, 1, 0.1, target);
    if (fadeBottom) {
      const topA = top[side.index];
      const topB = top[side.nextIndex];
      const interpolate = (from, to, amount) => ({
        x: from.x + (to.x - from.x) * amount,
        y: from.y + (to.y - from.y) * amount
      });
      const bands = 7;
      for (let band = 0; band < bands; band += 1) {
        const start = band / bands;
        const end = (band + 1) / bands;
        poly([
          interpolate(topA, bottomA, start),
          interpolate(topB, bottomB, start),
          interpolate(topB, bottomB, end),
          interpolate(topA, bottomA, end)
        ], 0x000000, null, 1, 0.06 + band * 0.135, target);
      }
    }
  }
  poly(top, 0x4c4942, 0x080706, 2, 1, target);
  texturedFace(top, art.floor, 0xf0dfc3, 1, 0.11, target);
  for (let x = rect.x + 80; x < rect.x + rect.w; x += 92) {
    line(worldToScreen(x, rect.y + 6, z + 0.5), worldToScreen(x, rect.y + rect.h - 6, z + 0.5), 0x17130f, 1.5, 0.52, target);
  }
  for (const side of visibleSides) line(top[side.index], top[side.nextIndex], 0xe2c88f, 3, 0.82, target);
  return top;
}

function drawUpperPlatform(target = g) {
  const rect = level.upperPlatform;
  const z = level.platformHeight;
  drawPlatformPrism(rect, z, target);
  drawElevatedExit(target);
}

function drawElevatedExit(target = g) {
  const door = level.doors.find((candidate) => candidate.id === "exit");
  if (!door) return;
  const foreground = target === occlusionLayer;
  const shouldRenderInForeground = doorOccludesPlayer(door) || playerHasExitedDoor(door);
  if (foreground === shouldRenderInForeground) drawConfiguredDoor(door, target);
}

function configuredDoorOpenAmount(door) {
  return state.doorSequence?.door.id === door.id ? state.doorSequence.openAmount : 0;
}

function doorOccludesPlayer(door) {
  const doorDepth = cameraDepth(door.x + door.w / 2, door.y);
  const playerDepth = cameraDepth(state.player.x, state.player.y);
  return doorDepth > playerDepth + 2;
}

function playerHasExitedDoor(door) {
  const sequence = state.doorSequence;
  if (!sequence || sequence.door.id !== door.id) return false;
  const dx = state.player.x - (door.x + door.w / 2);
  const dy = state.player.y - door.y;
  return dx * door.normalX + dy * door.normalY < 0;
}

function drawConfiguredDoor(door, target = g) {
  drawWoodenDoor(door, doorElevation(level, door), configuredDoorOpenAmount(door), target);
}

function drawWoodenDoor(door, z, openAmount = 0, target = g) {
  const x1 = door.x;
  const x2 = door.x + door.w;
  const y = door.y + 0.5;
  const height = door.height;
  const closedBottomLeft = worldToScreen(x1, y, z);
  const closedBottomRight = worldToScreen(x2, y, z);
  const closedTopRight = worldToScreen(x2, y, z + height);
  const closedTopLeft = worldToScreen(x1, y, z + height);
  poly([closedBottomLeft, closedBottomRight, closedTopRight, closedTopLeft], 0x050403, 0x080706, 2, 1, target);

  const angle = clamp(openAmount, 0, 1) * Math.PI / 2;
  const tangentX = door.normalY;
  const tangentY = -door.normalX;
  const freeX = x1 + tangentX * door.w * Math.cos(angle) + door.normalX * door.w * Math.sin(angle);
  const freeY = y + tangentY * door.w * Math.cos(angle) + door.normalY * door.w * Math.sin(angle);
  const bottomLeft = worldToScreen(x1, y, z);
  const bottomRight = worldToScreen(freeX, freeY, z);
  const topRight = worldToScreen(freeX, freeY, z + height);
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
  line(closedTopLeft, closedTopRight, 0xe2c078, 5, 0.9, target);
  line(closedBottomLeft, closedTopLeft, 0x72552e, 4, 0.95, target);
  line(closedBottomRight, closedTopRight, 0x72552e, 4, 0.95, target);
  line(topLeft, topRight, 0xe2c078, 5, 0.9, target);
  const knob = {
    x: bottomLeft.x + (bottomRight.x - bottomLeft.x) * elevatedExitKnob.across + (topLeft.x - bottomLeft.x) * elevatedExitKnob.up,
    y: bottomLeft.y + (bottomRight.y - bottomLeft.y) * elevatedExitKnob.across + (topLeft.y - bottomLeft.y) * elevatedExitKnob.up
  };
  target.circle(knob.x, knob.y, 3 * state.zoom).fill(0xd4a64e).stroke({ color: 0x4d3217, width: 1.5 * state.zoom });
}

function drawStairs(target = g, foregroundOnly = false) {
  const stair = stairGeometry(level);
  for (let i = 0; i < stair.steps; i += 1) {
    const z = level.platformHeight * (i + 1) / stair.steps;
    const previousZ = level.platformHeight * i / stair.steps;
    const rect = { x: stair.x, y: stair.bottomY - i * stair.stride, w: stair.w, h: stair.treadDepth };
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
    poly(riser, 0x40382f, 0x080706, 2, 1, target);
    texturedFace(riser, art.wall, 0xb09c7f, 1, 0.09, target);
    poly(top, 0x504c45, 0x080706, 2, 1, target);
    texturedFace(top, art.floor, 0xe0d1b7, 1, 0.1, target);
    line(top[3], top[2], 0xe0c88e, 2.2, 0.8, target);
  }
}

function drawUpperPlatformOccluder() {
  const rect = level.upperPlatform;
  const playerOnPlatform = state.player.floorZ >= level.platformHeight - 8 && pointInRect(state.player.x, state.player.y, rect, 8);
  if (playerOnPlatform || cameraDepth(rect.x + rect.w / 2, rect.y + rect.h / 2) <= 10) return;
  drawPlatformPrism(rect, level.platformHeight, occlusionLayer);
}

function drawForegroundOccluders() {
  if (level.kind === "platform") {
    const crossedDoor = level.doors.find(playerHasExitedDoor);
    if (crossedDoor) {
      const wall = level.backWall;
      drawWallSegment(
        wall.x,
        wall.y,
        wall.x + wall.w,
        wall.y,
        0x241e18,
        wall.height,
        occlusionLayer,
        platformTopElevation,
        true,
        `platform-back-wall:${wall.x}:${wall.y}:${wall.w}`
      );
      drawWallVines(true, () => true);
      for (const door of level.doors) drawConfiguredDoor(door, occlusionLayer);
      return;
    }
    for (const door of level.doors) {
      if (doorOccludesPlayer(door)) drawConfiguredDoor(door, occlusionLayer);
    }
    return;
  }
  if (level.kind !== "dungeon") return;
  const crossedDoor = level.doors.find(playerHasExitedDoor);
  const playerOnPlatform = state.player.floorZ >= level.platformHeight - 8 && pointInRect(state.player.x, state.player.y, level.upperPlatform, 8);
  drawStairs(occlusionLayer, true);
  drawUpperPlatformOccluder();
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
  drawWalls(occlusionLayer, true, Boolean(crossedDoor));
  drawWallVines(true, crossedDoor
    ? (vine) => Math.abs(vine.y - crossedDoor.y) <= 0.01
    : null);
  drawElevatedExit(occlusionLayer);
}

function objectScreenY(object) {
  return worldToScreen(object.x, object.y).y;
}

function drawSceneObjects(target = g, elevated = false) {
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
    if (object.kind === "potion") drawPotion(object, target, elevated);
  }
}

function drawColumn(column, target = g) {
  const p = worldToScreen(column.x, column.y);
  const s = state.zoom;
  target.ellipse(p.x + 9 * s, p.y + 7 * s, 34 * s, 12 * s).fill({ color: 0x000000, alpha: 0.48 });
  const foreground = target === occlusionLayer;
  const sprite = objectSprite(`column:${column.x}:${column.y}`, art.column, foreground);
  sprite.anchor.set(0.5, 0.94);
  const scale = 112 * s / art.column.height;
  sprite.scale.set(scale);
  sprite.position.set(p.x, p.y + 5 * s);
  sprite.tint = 0xf2e7d0;
}

function drawCoin(coin, target = g) {
  const p = worldToScreen(coin.x, coin.y);
  const bob = Math.sin(performance.now() * 0.004 + coin.x) * 3 * state.zoom;
  const y = p.y - 24 * state.zoom + bob;
  target.ellipse(p.x + 5, p.y + 4, 30 * state.zoom, 12 * state.zoom).fill({ color: 0x000000, alpha: 0.38 });
  const frame = Math.floor(performance.now() / 115 + hash(coin.x, coin.y, 31) * art.coin.length) % art.coin.length;
  const texture = art.coin[frame];
  const foreground = target === occlusionLayer;
  const sprite = objectSprite(`coin:${coin.x}:${coin.y}`, texture, foreground);
  sprite.anchor.set(0.5);
  const scale = 87 * state.zoom / texture.height;
  sprite.scale.set(scale);
  sprite.position.set(p.x, y);
  sprite.tint = 0xffefbd;
}

function drawPotion(potion, target = g, elevated = false) {
  const z = elevated ? platformTopElevation : 0;
  const p = worldToScreen(potion.x, potion.y, z);
  const s = state.zoom;
  const pulse = 1 + Math.sin(performance.now() * 0.004 + potion.x) * 0.08;
  const bob = Math.sin(performance.now() * 0.0035 + potion.y) * 2.2 * s;
  target.circle(p.x, p.y - 24 * s + bob, 32 * s * pulse).fill({ color: potion.glow, alpha: 0.18 });
  target.ellipse(p.x + 4 * s, p.y + 4 * s, 18 * s, 6 * s).fill({ color: 0x000000, alpha: 0.46 });
  const textureIndex = { health: 0, mana: 1, magic: 2 }[potion.type] ?? 0;
  const texture = art.potion[textureIndex];
  const foreground = target === occlusionLayer;
  const sprite = objectSprite(`potion:${potion.type}:${potion.x}:${potion.y}`, texture, foreground, elevated);
  sprite.anchor.set(0.5, 0.93);
  const scale = 62 * s / texture.height;
  sprite.scale.set(scale);
  sprite.position.set(p.x, p.y + 2 * s + bob);
  sprite.tint = 0xffffff;
}

function interiorTorchMount(torch) {
  const epsilon = 0.1;
  const inset = meter * 0.2;
  const candidates = [];
  for (const rect of level.bounds) {
    const withinX = torch.x >= rect.x - epsilon && torch.x <= rect.x + rect.w + epsilon;
    const withinY = torch.y >= rect.y - epsilon && torch.y <= rect.y + rect.h + epsilon;
    if (withinX && Math.abs(torch.y - rect.y) <= epsilon) candidates.push({ normalX: 0, normalY: 1 });
    if (withinX && Math.abs(torch.y - (rect.y + rect.h)) <= epsilon) candidates.push({ normalX: 0, normalY: -1 });
    if (withinY && Math.abs(torch.x - rect.x) <= epsilon) candidates.push({ normalX: 1, normalY: 0 });
    if (withinY && Math.abs(torch.x - (rect.x + rect.w)) <= epsilon) candidates.push({ normalX: -1, normalY: 0 });
  }
  const explicitNormal = Number.isFinite(torch.normalX) && Number.isFinite(torch.normalY)
    ? { normalX: torch.normalX, normalY: torch.normalY }
    : null;
  const inward = explicitNormal || candidates.find((candidate) => pointInRawWalkable(
    torch.x + candidate.normalX * inset,
    torch.y + candidate.normalY * inset
  )) || candidates[0] || { normalX: 0, normalY: 0 };
  return {
    wallX: torch.x,
    wallY: torch.y,
    normalX: inward.normalX,
    normalY: inward.normalY,
    x: torch.x + inward.normalX * inset,
    y: torch.y + inward.normalY * inset
  };
}

function drawTorch(torch) {
  const planScale = level.planScale || 1;
  const roomWallHeight = torch.y <= -340 * planScale ? elevatedChamberWallHeight : torch.y < 140 * planScale ? 98 : 80;
  const flameHeight = 54;
  const mountZ = Math.max(8, roomWallHeight * 0.95 - flameHeight);
  const mount = interiorTorchMount(torch);
  const inwardViewNormal = rotate(mount.normalX, mount.normalY, -state.yaw).y;
  if (inwardViewNormal < Math.cos(torchVisibilityArc / 2)) return;
  const shaftBase = worldToScreen(
    mount.wallX + mount.normalX * meter * 0.13,
    mount.wallY + mount.normalY * meter * 0.13,
    mountZ + 3
  );
  const shaftTop = worldToScreen(
    mount.wallX + mount.normalX * meter * 0.23,
    mount.wallY + mount.normalY * meter * 0.23,
    mountZ + 27
  );
  const wallLow = worldToScreen(mount.wallX, mount.wallY, mountZ + 5);
  const wallHigh = worldToScreen(mount.wallX, mount.wallY, mountZ + 15);
  const s = state.zoom;
  const flicker = Math.sin(performance.now() * 0.018 + torch.x * 0.04) * 3;
  const flameShoulder = 9;
  const innerTop = 23 + flicker * 0.5;
  line(wallLow, shaftBase, 0x17100a, 6 * s, 1);
  line(wallHigh, shaftBase, 0x9d7041, 2 * s, 0.75);
  line(shaftBase, shaftTop, 0x100906, 11 * s, 1);
  line(shaftBase, shaftTop, 0x3f2816, 7 * s, 1);
  line(
    { x: shaftBase.x - 2 * s, y: shaftBase.y - 2 * s },
    { x: shaftTop.x - 2 * s, y: shaftTop.y + 2 * s },
    0x9d7041,
    2 * s,
    0.7
  );
  g.circle(shaftTop.x, shaftTop.y - flameShoulder * s, (48 + flicker) * s).fill({ color: 0xd85c22, alpha: 0.15 });
  poly([
    { x: shaftTop.x, y: shaftTop.y - (flameHeight - 24) * s },
    { x: shaftTop.x + 10 * s, y: shaftTop.y - flameShoulder * s },
    { x: shaftTop.x, y: shaftTop.y + 4 * s },
    { x: shaftTop.x - 10 * s, y: shaftTop.y - flameShoulder * s }
  ], 0xe56b24, 0x5a1f0c, 1.5);
  poly([
    { x: shaftTop.x, y: shaftTop.y - innerTop * s },
    { x: shaftTop.x + 6 * s, y: shaftTop.y - flameShoulder * s },
    { x: shaftTop.x, y: shaftTop.y },
    { x: shaftTop.x - 5 * s, y: shaftTop.y - flameShoulder * s }
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

function movementInputDirectionRow() {
  let x = 0;
  let y = 0;
  if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) y -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) y += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) x -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) x += 1;
  if (x === 0 && y === 0) return null;
  const angle = Math.atan2(y * state.projectionY, x);
  return ((Math.round((angle - Math.PI / 2) / (Math.PI / 4)) % 8) + 8) % 8;
}

function actorTexturePoint(point) {
  const localX = (point[0] - actorSprite.anchor.x) * actorSprite.texture.width * actorSprite.scale.x;
  const localY = (point[1] - actorSprite.anchor.y) * actorSprite.texture.height * actorSprite.scale.y;
  const cosine = Math.cos(actorSprite.rotation);
  const sine = Math.sin(actorSprite.rotation);
  return {
    x: actorSprite.x + localX * cosine - localY * sine,
    y: actorSprite.y + localX * sine + localY * cosine
  };
}

function drawMagicSwordBlade(row, mode, frame) {
  if (magicSwordHiddenFrames[mode]?.[row]?.has(frame)) return;
  const blade = magicSwordBladeMaps[mode][row];
  const base = actorTexturePoint(blade[0]);
  const tip = actorTexturePoint(blade[1]);
  const dx = tip.x - base.x;
  const dy = tip.y - base.y;
  const length = Math.hypot(dx, dy) || 1;
  const normalX = -dy / length;
  const normalY = dx / length;
  const pulse = 1 + Math.sin(performance.now() * 0.012) * 0.08;
  const bladePolygon = (baseWidth, tipWidth) => [
    base.x + normalX * baseWidth, base.y + normalY * baseWidth,
    tip.x + normalX * tipWidth, tip.y + normalY * tipWidth,
    tip.x - normalX * tipWidth, tip.y - normalY * tipWidth,
    base.x - normalX * baseWidth, base.y - normalY * baseWidth
  ];

  actorFx.poly(bladePolygon(7 * state.zoom * pulse, 4.5 * state.zoom * pulse))
    .fill({ color: 0x3ecfff, alpha: 0.2 });
  actorFx.poly(bladePolygon(3.8 * state.zoom, 1.8 * state.zoom))
    .fill({ color: 0x68dfff, alpha: 0.58 })
    .stroke({ color: 0xbcefff, width: 1.8 * state.zoom, alpha: 0.92 });
  line(base, tip, 0xe8fbff, 1.2 * state.zoom, 0.96, actorFx);
  actorFx.circle(tip.x, tip.y, 3.5 * state.zoom * pulse)
    .fill({ color: 0x9ceaff, alpha: 0.3 });
}

function drawCharacter() {
  const player = state.player;
  actorLayer.visible = !state.tutorial?.portalHidden;
  if (!actorLayer.visible) return;
  const moving = isMoving() || state.doorSequence?.phase === "pass";
  let row = actorDirectionRow();
  let column = 0;
  let sheet = art.action;
  const throwProgress = player.bombThrowTime > 0 ? 1 - player.bombThrowTime / bombThrowDuration : 0;
  if (player.ledge) {
    const ledge = player.ledge;
    sheet = art.ledge;
    row = (row + 4) % 8;
    if (ledge.mode === "climb") {
      column = 10 + Math.min(3, Math.floor(ledge.climbTime / ledgeClimbDuration * 4));
    } else if (ledge.age < 0.2) {
      column = Math.min(1, Math.floor(ledge.age / 0.1));
    } else if (ledge.age < 0.34) {
      column = 2;
    } else if (ledge.motion < 0) {
      column = 4 + Math.floor(ledge.motionTime * 9) % 3;
    } else if (ledge.motion > 0) {
      column = 7 + Math.floor(ledge.motionTime * 9) % 3;
    } else {
      column = 3;
    }
  } else if (player.rollTime > 0) {
    sheet = art.low;
    column = 3 + Math.floor((1 - player.rollTime / 0.55) * 3) % 3;
  } else if (player.bombThrowTime > 0) {
    sheet = art.bomb;
    column = Math.min(6, Math.floor(throwProgress * 7));
  } else if (player.holdingBomb && player.attackTime > 0) {
    sheet = art.bombCombat;
    column = 2;
  } else if (player.holdingBomb && moving) {
    sheet = art.bombWalk;
    row = movementInputDirectionRow() ?? row;
    column = Math.floor(player.stride / (Math.PI / 3)) % 6;
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
  actorAura.clear();
  actorFx.clear();
  const playerScreen = worldToScreen(player.x, player.y, player.floorZ);
  const baseX = level.kind === "platform" ? playerScreen.x : state.width / 2;
  const baseY = (level.kind === "platform" ? playerScreen.y : state.height / 2) + 18;
  const inDeepWater = playerInDeepWater();
  actorLayer.zIndex = baseY;
  const shadowScale = 1 - clamp(player.z / 240, 0, 0.48);
  actorShadow.ellipse(baseX + 4, baseY + 2, 34 * shadowScale * state.zoom, 12 * shadowScale * state.zoom)
    .fill({ color: inDeepWater ? 0x092e34 : 0x000000, alpha: inDeepWater ? 0.16 : 0.52 });

  actorSprite.texture = sheet[row][column];
  const rolling = player.rollTime > 0;
  actorSprite.anchor.set(0.5, player.ledge ? ledgeHandAnchors[row] : rolling ? 0.5 : player.stance === "crawl" ? 0.76 : player.stance === "crouch" ? 0.82 : 0.9);
  const targetHeight = player.ledge ? 142 : rolling ? 112 : player.stance === "crawl" ? 112 : player.stance === "crouch" ? 124 : 142;
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
  actorSprite.rotation = rolling ? (1 - player.rollTime / 0.55) * Math.PI * 2 * player.rollDirection : poseRotation;
  actorSprite.alpha = 1;

  const auraPulse = 1 + Math.sin(performance.now() * 0.007) * 0.045;
  const auraCenterY = actorSprite.y - targetHeight * state.zoom * 0.48;
  if (effectActive("mana")) {
    actorAura.ellipse(actorSprite.x, auraCenterY, 42 * state.zoom * auraPulse, targetHeight * state.zoom * 0.52 * auraPulse)
      .stroke({ color: 0x51d7ee, width: 7 * state.zoom, alpha: 0.22 });
  }
  if (effectActive("magic")) {
    const fieldActive = effectActive("magic", "magicField");
    actorAura.ellipse(actorSprite.x, auraCenterY, (fieldActive ? 53 : 45) * state.zoom * auraPulse, targetHeight * state.zoom * (fieldActive ? 0.58 : 0.53) * auraPulse)
      .fill({ color: fieldActive ? 0x6d8cff : 0x678dff, alpha: fieldActive ? 0.07 : 0.035 })
      .stroke({ color: fieldActive ? 0x9eb8ff : 0x79aaff, width: (fieldActive ? 8 : 5) * state.zoom, alpha: fieldActive ? 0.32 : 0.2 });
  }

  if (player.stealth && sheet !== art.runStealth && player.rollTime <= 0) {
    const hoodYFactor = player.stance === "crawl" ? 0.2 : player.stance === "crouch" ? 0.62 : 0.72;
    const hoodX = actorSprite.x;
    const hoodY = player.ledge
      ? actorSprite.y + 25 * state.zoom
      : actorSprite.y - targetHeight * state.zoom * hoodYFactor;
    const hoodRadius = (player.stance === "crawl" ? 12 : 17) * state.zoom;
    if (row >= 3 && row <= 5) {
      actorFx.ellipse(hoodX, hoodY, hoodRadius * 1.05, hoodRadius * 1.18)
        .fill(0x1a1512).stroke({ color: 0x080706, width: 2.2 * state.zoom });
      actorFx.moveTo(hoodX - hoodRadius, hoodY + hoodRadius * 0.35)
        .lineTo(hoodX, hoodY + hoodRadius * 1.45)
        .lineTo(hoodX + hoodRadius, hoodY + hoodRadius * 0.35)
        .fill(0x241915);
    } else {
      strokedArc(actorFx, hoodX, hoodY, hoodRadius, Math.PI * 0.88, Math.PI * 2.12, 0x1a1512, 8 * state.zoom);
      strokedArc(actorFx, hoodX, hoodY, hoodRadius + 2 * state.zoom, Math.PI * 0.9, Math.PI * 2.1, 0x080706, 2 * state.zoom, 0.9);
    }
  }

  if (player.attackTime > 0) {
    const attackProgress = 1 - player.attackTime / 0.28;
    const attackDirection = groundDirection(player.heading);
    const facingAngle = Math.atan2(attackDirection.y, attackDirection.x);
    const sweepOffset = (attackProgress - 0.5) * 0.5;
    const start = facingAngle - 0.68 + sweepOffset;
    const end = facingAngle + 0.68 + sweepOffset;
    const centerX = baseX + attackDirection.x * 10 * state.zoom;
    const centerY = baseY - 46 - player.z + attackDirection.y * 10 * state.zoom;
    const magicSword = effectActive("magic", "magicSword");
    strokedArc(actorFx, centerX, centerY, 62 * state.zoom, start, end, magicSword ? 0x66d9ff : 0xf3d69a, (magicSword ? 8 : 5) * state.zoom, magicSword ? 0.62 : 0.42);
    strokedArc(actorFx, centerX, centerY, 69 * state.zoom, start + 0.12, end - 0.12, magicSword ? 0xdaf8ff : 0xffffff, 1.5 * state.zoom, 0.82);
  }

  if (
    effectActive("magic", "magicSword") &&
    !player.ledge &&
    player.rollTime <= 0 &&
    player.bombThrowTime <= 0 &&
    player.grounded &&
    player.stance !== "crawl"
  ) {
    const bladeMode = player.attackTime > 0
      ? "strike"
      : player.stance === "crouch" ? "crouch" : moving ? "walk" : "idle";
    drawMagicSwordBlade(row, bladeMode, column);
  }

  if (effectActive("mana", "superSprint") && moving && player.stance === "stand") {
    const direction = groundDirection(player.heading);
    for (let i = 0; i < 5; i += 1) {
      const spread = (i - 2) * 12 * state.zoom;
      const start = {
        x: baseX - direction.x * (26 + i * 11) * state.zoom - direction.y * spread,
        y: baseY - 28 * state.zoom - direction.y * (17 + i * 7) * state.zoom + direction.x * spread * 0.35
      };
      const end = { x: start.x - direction.x * 46 * state.zoom, y: start.y - direction.y * 28 * state.zoom };
      line(start, end, i % 2 ? 0x7de8ff : 0xc8f8ff, (i % 2 ? 2.5 : 1.5) * state.zoom, 0.42 - i * 0.045, actorAura);
    }
  }

  if (inDeepWater) {
    const stanceDepth = player.stance === "stand" ? 33 : player.stance === "crouch" ? 22 : 12;
    const surfaceY = baseY - stanceDepth * state.zoom;
    const lowerY = baseY + 12 * state.zoom;
    const time = performance.now();
    const ripple = Math.sin(time * 0.004) * 1.6 * state.zoom;
    const movingWake = moving ? 1 : 0;
    const direction = groundDirection(player.heading);

    actorFx.roundRect(
      baseX - 34 * state.zoom,
      surfaceY,
      68 * state.zoom,
      lowerY - surfaceY,
      12 * state.zoom
    ).fill({ color: 0x18575d, alpha: 0.3 });
    actorFx.ellipse(baseX, surfaceY + ripple, 42 * state.zoom, 8 * state.zoom)
      .fill({ color: 0x4b9296, alpha: 0.16 })
      .stroke({ color: 0xa8cbc7, width: 1.3 * state.zoom, alpha: 0.4 });
    strokedArc(actorFx, baseX, surfaceY + 2 * state.zoom + ripple, 28 * state.zoom, 0.12, Math.PI - 0.12, 0xc1d9d4, 1.1 * state.zoom, 0.3);

    if (movingWake) {
      const wakeX = baseX - direction.x * 20 * state.zoom;
      const wakeY = surfaceY - direction.y * 8 * state.zoom;
      const wakePulse = (time * 0.018) % 1;
      for (let i = 0; i < 2; i += 1) {
        const spread = (wakePulse + i * 0.5) % 1;
        actorFx.ellipse(
          wakeX - direction.x * spread * 18 * state.zoom,
          wakeY - direction.y * spread * 8 * state.zoom,
          (18 + spread * 26) * state.zoom,
          (4 + spread * 4) * state.zoom
        ).stroke({ color: 0xb7d7d2, width: 1 * state.zoom, alpha: 0.25 * (1 - spread) });
      }
      const splashPhase = Math.sin(player.stride * 2);
      actorFx.circle(baseX + splashPhase * 12 * state.zoom, surfaceY - 2 * state.zoom, 2.1 * state.zoom)
        .fill({ color: 0xd1e5e0, alpha: 0.38 });
    }
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
    container.visible = !enemy.removed;
    if (enemy.removed) continue;
    const base = worldToScreen(enemy.x, enemy.y, groundElevation(enemy.x, enemy.y));
    const row = directionRowForHeading(enemy.heading);
    const dying = !enemy.alive;
    const column = dying
      ? Math.min(3, Math.floor(enemy.deathAge / enemy.deathDuration * 4))
      : slimeAnimationColumn(enemy);
    shadow.clear();
    healthBar.clear();
    shadow.ellipse(base.x + 3 * state.zoom, base.y + 3 * state.zoom, 34 * state.zoom, 12 * state.zoom)
      .fill({ color: 0x000000, alpha: 0.48 });
    sprite.texture = dying ? art.slimeDeath[row][column] : art.slime[row][column];
    const scale = (dying ? 82 : 78) / sprite.texture.height * state.zoom;
    sprite.scale.set(scale);
    sprite.position.set(base.x, base.y - enemy.z * state.zoom);
    sprite.alpha = dying ? clamp(enemy.deathTime / 0.22, 0, 1) : 1;
    if (!dying && enemy.health < enemy.maxHealth) {
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
  const radius = Math.min(state.width, state.height) * 0.34 * 0.75 * (effectActive("mana", "extendedSight") ? 1.5 : 1);
  g.circle(state.width / 2, state.height / 2, radius).fill({ color: 0xf0a85a, alpha: 0.045 });
}

function updateEffects(delta) {
  for (const [group, effect] of Object.entries(state.effects)) {
    if (effect.remaining <= 0) continue;
    effect.remaining = Math.max(0, effect.remaining - delta);
    if (effect.remaining === 0) {
      const option = abilityOption(group, effect.id);
      effect.id = null;
      setStatus(`${option?.label || group} expired`);
    }
  }
  refreshEffectsHud();
}

function isMoving() {
  return state.keys.has("ArrowUp") || state.keys.has("ArrowDown") || state.keys.has("ArrowLeft") || state.keys.has("ArrowRight") ||
    state.keys.has("KeyW") || state.keys.has("KeyA") || state.keys.has("KeyS") || state.keys.has("KeyD");
}

function walkableRegionIndex(x, y) {
  return level.bounds.findIndex((rect) => pointInRect(x, y, rect, 2));
}

function slimeNavigationGoal(enemy) {
  const planScale = level.planScale || 1;
  const enemyRegion = walkableRegionIndex(enemy.x, enemy.y);
  const playerRegion = walkableRegionIndex(state.player.x, state.player.y);
  if (state.player.floorZ > 20 && groundElevation(enemy.x, enemy.y) < 20) return { x: -320 * planScale, y: -410 * planScale };
  if (enemyRegion === playerRegion || enemyRegion < 0 || playerRegion < 0) return state.player;
  if (enemyRegion === 2) return { x: 0, y: -330 * planScale };
  if (enemyRegion === 1 && playerRegion === 0) return { x: 0, y: 150 * planScale };
  if (enemyRegion === 1 && playerRegion === 2) return { x: 0, y: -330 * planScale };
  return { x: 0, y: 130 * planScale };
}

function slimePathClear(enemy, targetX, targetY) {
  let previousElevation = groundElevation(enemy.x, enemy.y);
  for (let step = 1; step <= 8; step += 1) {
    const t = step / 8;
    const x = enemy.x + (targetX - enemy.x) * t;
    const y = enemy.y + (targetY - enemy.y) * t;
    const elevation = groundElevation(x, y);
    if (pointInDiscoveredSecret(x, y)) return false;
    if (!pointInWalkable(x, y, 22) || Math.abs(elevation - previousElevation) > 36) return false;
    if (level.columns.some((column) => Math.hypot(x - column.x, y - column.y) < 43)) return false;
    previousElevation = elevation;
  }
  return true;
}

function chooseSlimeLanding(enemy) {
  enemy.originX = enemy.x;
  enemy.originY = enemy.y;
  const goal = slimeNavigationGoal(enemy);
  const dx = goal.x - enemy.x;
  const dy = goal.y - enemy.y;
  const distance = Math.hypot(dx, dy) || 1;
  const travel = Math.min(108, distance);
  const variation = (hash(Math.round(enemy.x), Math.round(enemy.y), Math.floor(performance.now() / 1000)) - 0.5) * 34;
  let candidateX = enemy.x + dx / distance * travel - dy / distance * variation;
  let candidateY = enemy.y + dy / distance * travel + dx / distance * variation;
  if (!slimePathClear(enemy, candidateX, candidateY)) {
    candidateX = enemy.x + dx / distance * travel * 0.72;
    candidateY = enemy.y + dy / distance * travel * 0.72;
  }
  if (slimePathClear(enemy, candidateX, candidateY)) {
    enemy.targetX = candidateX;
    enemy.targetY = candidateY;
    enemy.heading = Math.atan2(candidateY - enemy.y, candidateX - enemy.x);
  } else {
    enemy.targetX = enemy.x;
    enemy.targetY = enemy.y;
    enemy.heading = Math.atan2(dy, dx);
  }
}

function defeatEnemy(enemy) {
  if (!enemy.alive) return false;
  enemy.alive = false;
  enemy.deathAge = 0;
  enemy.deathDuration = 1.2;
  enemy.deathTime = enemy.deathDuration;
  enemy.z = 0;
  return true;
}

function secondChamberEncounterTriggered() {
  if (level.kind !== "dungeon") return false;
  const corridor = level.bounds.find((rect) => rect.name === "corridor");
  return corridor && state.player.y < corridor.y + corridor.h / 2;
}

function damagePlayer(amount, source) {
  const player = state.player;
  if (effectActive("magic", "magicField")) {
    player.contactDamageCooldown = 0.25;
    setStatus(`Magic Field blocked ${source}`);
    return false;
  }
  player.health = Math.max(0, player.health - amount);
  player.hitFlash = 0.24;
  refreshInventory();
  setStatus(`${source} dealt ${amount} damage`);
  return true;
}

function updateEnemies(delta) {
  const player = state.player;
  player.contactDamageCooldown = Math.max(0, player.contactDamageCooldown - delta);
  player.hitFlash = Math.max(0, player.hitFlash - delta);
  for (const enemy of state.enemies) {
    if (!enemy.alive) {
      if (!enemy.removed) {
        enemy.deathAge += delta;
        enemy.deathTime = Math.max(0, enemy.deathTime - delta);
        if (enemy.deathTime === 0) enemy.removed = true;
      }
      continue;
    }
    if (!enemy.active && enemy.activation === "corridorHalfway" && secondChamberEncounterTriggered()) {
      enemy.active = true;
      enemy.originX = enemy.x;
      enemy.originY = enemy.y;
      enemy.targetX = enemy.x;
      enemy.targetY = enemy.y;
      enemy.jumpClock = 0;
    }
    enemy.jumpClock += delta;
    if (enemy.jumpClock >= enemy.cycleDuration) {
      enemy.jumpClock %= enemy.cycleDuration;
      if (enemy.active) {
        chooseSlimeLanding(enemy);
      } else {
        enemy.originX = enemy.x;
        enemy.originY = enemy.y;
        enemy.targetX = enemy.x;
        enemy.targetY = enemy.y;
      }
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
      player.contactDamageCooldown = 1;
      damagePlayer(enemy.contactDamage, enemy.name);
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
  const explosion = { x: projectile.x, y: projectile.y, z: Math.max(projectile.z, groundElevation(projectile.x, projectile.y)), age: 0, duration: 0.82 };
  state.explosions.push(explosion);
  state.scorches.push({ ...explosion, age: 0, duration: 4.5 });
  let defeated = 0;
  for (const enemy of state.enemies) {
    if (!enemy.alive) continue;
    const enemyZ = groundElevation(enemy.x, enemy.y) + enemy.z + 18;
    const distance = Math.hypot(enemy.x - explosion.x, enemy.y - explosion.y, enemyZ - explosion.z);
    if (distance <= meter && blastPathClear(explosion, enemy)) {
      enemy.health = Math.max(0, enemy.health - 50);
      if (enemy.health === 0 && defeatEnemy(enemy)) defeated += 1;
    }
  }
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
  for (const scorch of state.scorches) scorch.age += delta;
  state.scorches = state.scorches.filter((scorch) => scorch.age < scorch.duration);
}

function drawBombEffects() {
  effectsLayer.clear();
  for (const scorch of state.scorches) {
    const p = worldToScreen(scorch.x, scorch.y, scorch.z + 1);
    const fade = clamp((scorch.duration - scorch.age) / 1.2, 0, 1);
    effectsLayer.ellipse(p.x, p.y, 34 * state.zoom, 15 * state.zoom)
      .fill({ color: 0x090604, alpha: 0.5 * fade })
      .stroke({ color: 0x4e2415, width: 2 * state.zoom, alpha: 0.42 * fade });
  }
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
    const radius = meter * 1.12 * state.zoom * Math.sin(progress * Math.PI);
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
  updateTutorialAdvance(delta);
  updateEffects(delta);
  if (state.doorSequence) {
    updateDoorTraversal(delta);
    updateTransition(delta);
    return;
  }
  let mx = 0;
  let my = 0;
  if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) my -= 1;
  if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) my += 1;
  if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) mx -= 1;
  if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) mx += 1;

  const player = state.player;
  const previousPlayerZ = player.z;
  let moving = mx !== 0 || my !== 0;
  if (level.kind === "platform" && player.falling) {
    player.fallTime += delta;
  }
  const sprinting = state.keys.has("ShiftLeft") || state.keys.has("ShiftRight");
  const tutorial = state.tutorial;
  player.ledgeGrabCooldown = Math.max(0, player.ledgeGrabCooldown - delta);

  if (!player.ledge && tutorial?.portalActive && !tutorial.portalDive && Math.hypot(player.x - tutorial.portal.x, player.y - tutorial.portal.y) <= 1.25 * meter) {
    tutorial.portalPull = true;
  }

  if (player.ledge) {
    updateLedge(delta);
    moving = player.ledge?.motion !== 0;
  } else if (tutorial?.portalPull && !tutorial.portalDive) {
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
  } else if (moving && !tutorial?.portalDive && player.rollTime <= 0 && (!player.falling || level.kind === "platform")) {
    const len = Math.hypot(mx, my);
    mx /= len;
    my /= len;
    player.lastMoveX = mx;
    player.lastMoveY = my;
    const worldMove = rotate(mx, my, state.yaw);
    const stanceSpeed = player.stance === "crawl" ? 0.28 : player.stance === "crouch" ? 0.45 : 1;
    const abilitySpeed = effectActive("mana", "superSprint") && player.stance === "stand" ? 2 : 1;
    const speed = player.speed * (sprinting && player.stance === "stand" ? 1.75 : 1) * stanceSpeed * abilitySpeed;
    const distance = movePlayer(worldMove.x * speed * delta, worldMove.y * speed * delta);
    if (tutorial && tutorial.step === tutorialStep.sprint && sprinting && !tutorial.advancing) {
      tutorial.sprintDistance += distance;
      refreshTutorialHud();
      if (tutorial.sprintDistance >= 3 * meter) completeTutorialStep(tutorialStep.sprint);
    }
    if (tutorial && tutorial.step === tutorialStep.lowMovement && !tutorial.advancing && ["crouch", "crawl"].includes(player.stance)) {
      tutorial.lowMovement.add(player.stance);
      refreshTutorialHud();
      if (tutorial.lowMovement.size === 2) completeTutorialStep(tutorialStep.lowMovement);
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
  if (!player.ledge) tryGrabLedge();
  if (!player.grounded && !player.ledge) {
    player.jumpAge += delta;
    player.vz -= 1380 * delta;
    player.z += player.vz * delta;
    if (player.z <= 0 && !(level.kind === "platform" && player.falling)) {
      player.z = 0;
      player.vz = 0;
      player.jumpAge = 0;
      player.grounded = true;
      player.landTime = 0.18;
      if (tutorial?.jumpStarted && tutorial.step === tutorialStep.jump) {
        tutorial.jumpStarted = false;
        completeTutorialStep(tutorialStep.jump);
      }
      if (tutorial?.crouchJumpStarted && tutorial.step === tutorialStep.crouchJump) {
        tutorial.crouchJumpStarted = false;
        completeTutorialStep(tutorialStep.crouchJump);
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
    if (!player.ledge) {
      const feetZ = player.floorZ + player.z;
      const supportReach = feetZ + (player.grounded ? waterBasinDepth : 2);
      const supportZ = groundElevation(player.x, player.y, supportReach);
      if (supportZ !== player.floorZ) {
        player.floorZ = supportZ;
        if (!player.grounded) player.z = Math.max(0, feetZ - supportZ);
      }
    }
    collectItems();
    if (!state.transitioning) tryStartDoorTraversal();
  } else if (level.kind === "platform") {
    const supported = level.platforms.some((platform) => pointInRect(player.x, player.y, platform, -playerCollisionRadius * 0.15));
    if (!player.falling && !supported) {
      player.falling = true;
      player.fallTime = 0;
      player.grounded = false;
      if (player.vz < 0) player.vz = 0;
      setStatus("Falling");
    }
    const crossedPlatformHeight = previousPlayerZ >= 0 && player.z <= 0;
    const landingPlatform = level.platforms.find((platform) => pointInRect(
      player.x,
      player.y,
      platform,
      playerCollisionRadius * 0.35
    ));
    const withinLandingHeight = player.z >= -waterBasinDepth && player.z <= meter * 0.35;
    if (player.falling && landingPlatform && player.vz <= 0 && (crossedPlatformHeight || withinLandingHeight)) {
      const landingInset = playerCollisionRadius * 0.15;
      player.x = clamp(player.x, landingPlatform.x + landingInset, landingPlatform.x + landingPlatform.w - landingInset);
      player.y = clamp(player.y, landingPlatform.y + landingInset, landingPlatform.y + landingPlatform.h - landingInset);
      player.falling = false;
      player.fallTime = 0;
      player.floorZ = platformTopElevation;
      player.z = 0;
      player.vz = 0;
      player.grounded = true;
      player.landTime = 0.18;
      setStatus("Landed");
    }
    player.floorZ = platformTopElevation;
    collectItems();
    if (player.falling && player.floorZ + player.z <= platformTopElevation - platformDeathDepth && !state.transitioning) {
      player.health = 0;
      refreshInventory();
      startTransition("level1-2.html?fade=1&fastFade=1&reset=1", 0.03, 4);
    }
    if (!state.transitioning) tryStartDoorTraversal();
  }
  const geometryZoom = geometryTestFine ? 1.25 : geometryTestCoarse ? 0.55 : 1;
  const gameplayZoom = level.kind === "platform"
    ? fittedPlatformCameraZoom(level, state.width)
    : effectActive("mana", "extendedSight") ? extendedSightCameraZoom : defaultCameraZoom;
  const targetZoom = geometryTestMode ? geometryZoom : gameplayZoom;
  state.zoom += (targetZoom - state.zoom) * (1 - Math.exp(-5 * delta));

  updateBombs(delta);
  updateEnemies(delta);

  updateTransition(delta);
}

function movePlayer(dx, dy) {
  const player = state.player;
  const startX = player.x;
  const startY = player.y;
  if (level.kind === "platform") {
    const traversal = platformTraversalBounds(level);
    const nextX = clamp(player.x + dx, traversal.west + playerCollisionRadius, traversal.east - playerCollisionRadius);
    const nextY = clamp(player.y + dy, traversal.north + playerCollisionRadius, traversal.south - playerCollisionRadius);
    player.x = nextX;
    player.y = nextY;
    player.floorZ = platformTopElevation;
    return Math.hypot(player.x - startX, player.y - startY);
  }
  const nextX = player.x + dx;
  const nextY = player.y + dy;
  const maxStepHeight = waterBasinDepth;
  let currentElevation = player.floorZ;
  let airborneWorldZ = player.floorZ + player.z;
  const canTraverse = (elevation) => player.grounded
    ? elevation <= currentElevation + maxStepHeight
    : elevation <= airborneWorldZ + 2;
  const applyElevation = (elevation) => {
    if (player.grounded && elevation < currentElevation - maxStepHeight) {
      airborneWorldZ = currentElevation;
      player.grounded = false;
      player.vz = 0;
      player.jumpAge = 0;
      player.jumpArm = 0;
    }
    if (!player.grounded) player.z = Math.max(0, airborneWorldZ - elevation);
    currentElevation = elevation;
  };
  const reachableSurfaceZ = () => airborneWorldZ + (player.grounded ? maxStepHeight : 2);
  const nextXElevation = groundElevation(nextX, player.y, reachableSurfaceZ());
  if (
    pointInWalkable(nextX, player.y, playerCollisionRadius)
    && !columnBlocksMovement(nextX, player.y, airborneWorldZ)
    && canTraverse(nextXElevation)
  ) {
    player.x = nextX;
    applyElevation(nextXElevation);
  }
  const nextYElevation = groundElevation(player.x, nextY, reachableSurfaceZ());
  if (
    pointInWalkable(player.x, nextY, playerCollisionRadius)
    && !columnBlocksMovement(player.x, nextY, airborneWorldZ)
    && canTraverse(nextYElevation)
  ) {
    player.y = nextY;
    applyElevation(nextYElevation);
  }
  player.floorZ = currentElevation;
  return Math.hypot(player.x - startX, player.y - startY);
}

function collectItems() {
  for (const coin of level.coins) {
    if (!coin.collected && Math.hypot(state.player.x - coin.x, state.player.y - coin.y) <= itemPickupRadius) {
      coin.collected = true;
      state.inventory.coins += 1;
      refreshInventory();
    }
  }
  for (const potion of level.potions) {
    if (!potion.collected && Math.hypot(state.player.x - potion.x, state.player.y - potion.y) <= itemPickupRadius) {
      potion.collected = true;
      state.inventory[potion.type] += 1;
      refreshInventory();
    }
  }
}

function render() {
  g.clear();
  elevatedLayer.clear();
  overlay.clear();
  occlusionLayer.clear();
  floorSpriteCount = 0;
  for (const sprite of waterSprites) sprite.visible = false;
  for (const sprite of wallTextureSprites.values()) sprite.visible = false;
  for (const sprite of occlusionWallTextureSprites.values()) sprite.visible = false;
  for (const sprite of scenerySprites.values()) sprite.visible = false;
  for (const sprite of elevatedScenerySprites.values()) sprite.visible = false;
  for (const sprite of occlusionSprites.values()) sprite.visible = false;
  for (const sprite of vineSprites.values()) sprite.visible = false;
  for (const sprite of occlusionVineSprites.values()) sprite.visible = false;
  if (level.kind === "infinite") drawInfiniteFloor();
  else if (level.kind === "tutorial") drawTutorialFloor();
  else if (level.kind === "platform") drawPlatformRoom();
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
  if (state.itemMenuMode !== "items") {
    const group = state.itemMenuMode;
    const option = abilityGroups[group].options[slot - 1];
    if (!option) {
      setStatus("Choose ability 1 or 2");
      return;
    }
    if (state.inventory[group] <= 0) {
      closeItemMenu();
      setStatus(`No ${group}`);
      return;
    }
    state.inventory[group] -= 1;
    state.effects[group].id = option.id;
    state.effects[group].remaining = abilityGroups[group].duration;
    closeItemMenu();
    refreshInventory();
    refreshEffectsHud();
    setStatus(`${option.label}: ${abilityGroups[group].duration} seconds`);
    return;
  }
  if (isTutorial && state.tutorial.step === tutorialStep.selectItem && slot !== 4) {
    setStatus("Select bomb with 4");
    return;
  }
  if (slot === 4) {
    closeItemMenu();
    if (state.inventory.bombs > 0) {
      state.player.holdingBomb = true;
      setStatus("Bomb ready");
      if (isTutorial && state.tutorial.step === tutorialStep.selectItem) completeTutorialStep(tutorialStep.selectItem);
    } else setStatus("No bombs");
    return;
  }
  const type = ["health", "mana", "magic"][slot - 1];
  if (!type || state.inventory[type] <= 0) {
    closeItemMenu();
    setStatus(`No ${type || "item"}`);
    return;
  }
  if (type === "mana" || type === "magic") {
    showItemMenu(type);
    setStatus(`Choose ${type} ability 1-2`);
    return;
  }
  closeItemMenu();
  state.inventory.health -= 1;
  state.player.health = Math.min(state.player.maxHealth, state.player.health + 35);
  refreshInventory();
  setStatus("Used health");
}

function useWeapon() {
  if (state.player.ledge) {
    setStatus("Both hands are on the ledge");
    return;
  }
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
    const damage = effectActive("magic", "magicSword") ? 125 : 25;
    target.health = Math.max(0, target.health - damage);
    if (target.health === 0) defeatEnemy(target);
    setStatus(target.alive ? `${target.name}: ${target.health} health` : `${target.name} defeated`);
  } else {
    setStatus(state.player.holdingBomb ? "Sword with bomb" : "Sword strike");
  }
  if (isTutorial && state.tutorial.step === tutorialStep.attack) completeTutorialStep(tutorialStep.attack);
}

function tryActivateSecretControl() {
  const forwardX = Math.cos(state.player.heading);
  const forwardY = Math.sin(state.player.heading);
  const candidate = (level.secrets || [])
    .filter((secret) => !state.discoveredSecrets.has(secret.id))
    .map((secret) => {
      const control = secret.control;
      const dx = control.x - state.player.x;
      const dy = control.y - state.player.y;
      const distance = Math.hypot(dx, dy);
      const facing = distance > 0 ? (dx * forwardX + dy * forwardY) / distance : 1;
      return { secret, control, distance, facing };
    })
    .filter(({ control, distance, facing }) =>
      distance <= control.radius &&
      facing >= 0.1 &&
      state.player.floorZ >= (control.minFloorZ || 0) &&
      state.player.floorZ <= (control.maxFloorZ ?? Number.POSITIVE_INFINITY)
    )
    .sort((a, b) => a.distance - b.distance)[0];
  if (!candidate) return false;
  if (secretControlBlocked(candidate.control)) {
    state.player.specialTime = 0.35;
    setStatus("The mechanism is obstructed");
    return true;
  }

  state.discoveredSecrets.add(candidate.secret.id);
  state.player.specialTime = 0.35;
  persistSecretDiscovery();
  setStatus(`${candidate.secret.name} revealed`);
  return true;
}

function specialAction() {
  if (state.player.ledge) {
    setStatus("Both hands are on the ledge");
    return;
  }
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
    if (isTutorial && state.tutorial.step === tutorialStep.special) completeTutorialStep(tutorialStep.special);
  } else if (tryActivateSecretControl()) {
    // The control interaction supplies its own status and animation state.
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

function restoreBrowserCursor() {
  try {
    if (document.pointerLockElement && document.exitPointerLock) document.exitPointerLock();
  } catch {
    // Cursor styling must still be restored if the browser rejects an unlock request.
  }
  document.documentElement.classList.remove("pointer-locked");
  document.body.style.cursor = "default";
  app.canvas.style.cursor = "crosshair";
}

window.addEventListener("resize", () => {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
});

window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && event.code === "KeyW") event.preventDefault();
  if (isTutorial && hud.skipConfirm && !hud.skipConfirm.classList.contains("hidden")) {
    event.preventDefault();
    if (event.code === "Escape") hud.skipConfirm.classList.add("hidden");
    return;
  }
  if (event.code === "Escape") {
    event.preventDefault();
    if (state.paused) {
      if (state.pausePanel === "main") resumeGame();
      else showPausePanel("main");
    } else {
      pauseGame();
    }
    return;
  }
  if (state.paused) {
    event.preventDefault();
    return;
  }
  if (state.doorSequence || state.transitioning) {
    event.preventDefault();
    return;
  }
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
    if (state.player.ledge) {
      if (!event.repeat) releaseLedge(true);
      return;
    }
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
      const lateralJump = Math.abs(player.lastMoveX) >= Math.abs(player.lastMoveY);
      if (lateralJump) {
        player.rollTime = 0.55;
        player.rollX = player.lastMoveX;
        player.rollY = player.lastMoveY;
        player.rollDirection = player.lastMoveX < 0 ? -1 : 1;
        player.stance = "stand";
        player.grounded = false;
        player.vz = 360;
        player.jumpAge = 0;
        player.jumpArm = 0;
        setStatus("Jump roll");
      } else {
        player.stance = "stand";
        player.grounded = false;
        player.vz = 426;
        player.jumpAge = 0;
        player.jumpArm = 1;
        if (isTutorial && state.tutorial.step === tutorialStep.crouchJump) state.tutorial.crouchJumpStarted = true;
        setStatus("Crouch jump");
      }
      return;
    }
    if (!event.repeat && player.grounded) {
      player.grounded = false;
      player.vz = player.stance === "crouch" ? 426 : 520;
      player.jumpAge = 0;
      player.jumpArm = 1;
      if (isTutorial && state.tutorial.step === tutorialStep.jump) state.tutorial.jumpStarted = true;
    }
    return;
  }
  if (event.code === "ControlLeft") {
    event.preventDefault();
    if (event.repeat) return;
    if (state.player.ledge) {
      releaseLedge(false);
      return;
    }
    if (!tutorialActionUnlocked("stance")) {
      setStatus("Complete the current lesson");
      return;
    }
    toggleCrouch(isMoving());
    if (isTutorial && state.tutorial.step === tutorialStep.stances && ["crouch", "crawl"].includes(state.player.stance)) {
      state.tutorial.stanceActions.add(state.player.stance);
      refreshTutorialHud();
      if (state.tutorial.stanceActions.size === 2) completeTutorialStep(tutorialStep.stances);
    }
    return;
  }
  if (event.code === "KeyQ" && !event.repeat) {
    event.preventDefault();
    if (state.player.ledge) {
      setStatus("Both hands are on the ledge");
      return;
    }
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
    if (state.player.ledge) {
      setStatus("Both hands are on the ledge");
      return;
    }
    if (!tutorialActionUnlocked("items")) {
      setStatus("Complete the current lesson");
      return;
    }
    const opening = hud.itemMenu.classList.contains("hidden");
    if (opening) showItemMenu("items");
    else closeItemMenu();
    setStatus(opening ? "Choose item 1-4" : "World mode");
    if (isTutorial && state.tutorial.step === tutorialStep.items && opening) completeTutorialStep(tutorialStep.items);
    return;
  }
  if (event.code === "KeyF") {
    event.preventDefault();
    if (state.player.ledge) {
      setStatus("Both hands are on the ledge");
      return;
    }
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
    if (isTutorial && state.tutorial.step === tutorialStep.movement && !state.tutorial.advancing) {
      const direction = {
        ArrowUp: "up", KeyW: "up", ArrowDown: "down", KeyS: "down",
        ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right"
      }[event.code];
      if (direction) {
        state.tutorial.movementKeys.add(direction);
        refreshTutorialHud();
        if (state.tutorial.movementKeys.size === 4) completeTutorialStep(tutorialStep.movement);
      }
    }
  }
});

window.addEventListener("keyup", (event) => state.keys.delete(event.code));

document.addEventListener("pointerlockchange", () => {
  if (!document.pointerLockElement) restoreBrowserCursor();
});
document.addEventListener("pointerlockerror", restoreBrowserCursor);
window.addEventListener("blur", () => {
  state.keys.clear();
  restoreBrowserCursor();
});
window.addEventListener("focus", restoreBrowserCursor);
window.addEventListener("pageshow", restoreBrowserCursor);
window.addEventListener("pagehide", restoreBrowserCursor);
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState !== "visible") {
    state.keys.clear();
    restoreBrowserCursor();
  }
});
restoreBrowserCursor();

app.canvas.addEventListener("mousedown", (event) => {
  if (state.paused || state.doorSequence || state.transitioning) return;
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
  if (state.paused || state.doorSequence || state.transitioning || level.kind === "platform") return;
  state.yaw += event.movementX * 0.006;
  state.pitch = clamp(state.pitch + event.movementY * 0.0035, minPitch, maxPitch);
  state.projectionY = Math.sin(state.pitch);
});

refreshInventory();
refreshEffectsHud();
refreshTutorialHud();
applyGraphicsSettings();
applyAudioSettings();
window.addEventListener("pointerdown", startLevelMusic);
window.addEventListener("keydown", startLevelMusic);
preloadDestination(isTutorial ? "level1.html" : isLevelOneOne ? "level1-2.html" : isLevelOneTwo ? "level0.html" : null);
let lastTime = performance.now();
app.ticker.add(() => {
  const now = performance.now();
  const delta = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  if (!state.paused) {
    update(delta);
    render();
  }
});
}

main().catch((error) => {
  console.error("Dungeon Runner: Felicity's Call failed to start", error);
  const diagnostic = document.createElement("pre");
  diagnostic.className = "runtime-error";
  diagnostic.textContent = `Dungeon Runner: Felicity's Call failed to start\n${error.stack || error.message}`;
  document.body.appendChild(diagnostic);
});
