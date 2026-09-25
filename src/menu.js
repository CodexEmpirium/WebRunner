(() => {
  const loadButton = document.getElementById("loadGame");
  const newGame = document.getElementById("newGame");
  const tutorialGame = document.getElementById("tutorialGame");
  const fileInput = document.getElementById("saveFile");
  const status = document.getElementById("menuStatus");
  const optionsButton = document.getElementById("menuOptions");
  const optionsBack = document.getElementById("menuOptionsBack");
  const primaryView = document.getElementById("mainMenuPrimary");
  const optionsView = document.getElementById("mainMenuOptions");
  const graphicsQuality = document.getElementById("menuGraphicsQuality");
  const masterVolume = document.getElementById("menuMasterVolume");
  const backgroundVideo = document.getElementById("menuBackgroundVideo");
  const backgroundPlaceholder = document.getElementById("menuBackgroundPlaceholder");
  const titleMusic = document.getElementById("titleMusic");
  const importedSaveKey = "webrunner-imported-save-v1";
  const progressStorageKey = "webrunner-progress-v1";
  const settingsStorageKey = "webrunner-settings-v1";
  const worldStateStorageKey = "webrunner-world-state-v1";

  function readSettings() {
    try {
      const stored = JSON.parse(window.localStorage.getItem(settingsStorageKey) || "{}");
      return {
        graphics: ["low", "medium", "high"].includes(stored.graphics) ? stored.graphics : "high",
        volume: Number.isFinite(Number(stored.volume)) ? Math.max(0, Math.min(1, Number(stored.volume))) : 0.8
      };
    } catch {
      return { graphics: "high", volume: 0.8 };
    }
  }

  const settings = readSettings();

  function applySettings() {
    document.documentElement.dataset.graphics = settings.graphics;
    document.documentElement.style.setProperty("--master-volume", settings.volume);
    document.querySelectorAll("audio").forEach((audio) => {
      audio.volume = settings.volume;
    });
    if (backgroundVideo) backgroundVideo.volume = 0;
    try {
      window.localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
    } catch {
      // Settings remain active until this page is closed.
    }
  }

  function showOptions(show) {
    primaryView.classList.toggle("hidden", show);
    optionsView.classList.toggle("hidden", !show);
    (show ? graphicsQuality : optionsButton).focus();
  }

  function hasMusicSource(audio) {
    return Boolean(audio?.currentSrc || audio?.getAttribute("src") || audio?.querySelector("source[src]"));
  }

  function startTitleMusic() {
    if (!hasMusicSource(titleMusic)) return;
    titleMusic.volume = settings.volume;
    titleMusic.play().then(() => {
      window.removeEventListener("pointerdown", startTitleMusic);
      window.removeEventListener("keydown", startTitleMusic);
    }).catch(() => {
      // A later interaction can retry if the browser blocks this attempt.
    });
  }

  function fail(message) {
    status.textContent = message;
    status.classList.add("error");
  }

  function readSave(text) {
    const documentNode = new DOMParser().parseFromString(text, "application/xml");
    if (documentNode.querySelector("parsererror")) throw new Error("The selected file is not valid XML.");
    const root = documentNode.documentElement;
    if (root.tagName !== "webrunnerSave" || root.getAttribute("version") !== "1") {
      throw new Error("This save-file version is not supported.");
    }
    const stateNode = root.querySelector("state");
    if (!stateNode) throw new Error("The save file does not contain game state.");
    const snapshot = JSON.parse(stateNode.textContent);
    if (!snapshot || snapshot.version !== 1 || !["tutorial", "0", "1.1", "1.2"].includes(String(snapshot.level))) {
      throw new Error("The saved game state is incomplete.");
    }
    return snapshot;
  }

  function clearRunState() {
    try {
      window.sessionStorage.removeItem(importedSaveKey);
      window.sessionStorage.removeItem(progressStorageKey);
      window.sessionStorage.removeItem(worldStateStorageKey);
    } catch {
      // Navigation still starts a new game when session storage is unavailable.
    }
  }

  newGame.addEventListener("click", clearRunState);
  tutorialGame?.addEventListener("click", clearRunState);
  optionsButton.addEventListener("click", () => showOptions(true));
  optionsBack.addEventListener("click", () => showOptions(false));
  graphicsQuality.addEventListener("change", () => {
    settings.graphics = graphicsQuality.value;
    applySettings();
  });
  masterVolume.addEventListener("input", () => {
    settings.volume = Number(masterVolume.value) / 100;
    applySettings();
  });
  window.addEventListener("keydown", (event) => {
    if (event.code === "Escape" && !optionsView.classList.contains("hidden")) {
      event.preventDefault();
      showOptions(false);
    }
  });
  loadButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    status.classList.remove("error");
    status.textContent = "Loading saved game...";
    try {
      const snapshot = readSave(await file.text());
      window.sessionStorage.removeItem(worldStateStorageKey);
      window.sessionStorage.setItem(importedSaveKey, JSON.stringify(snapshot));
      const target = snapshot.level === "tutorial"
        ? "tutorial.html"
        : snapshot.level === "1.1"
          ? "level1.html"
          : snapshot.level === "1.2"
            ? "level1-2.html"
            : `level${snapshot.level}.html`;
      window.location.href = `${target}?load=1&fade=1`;
    } catch (error) {
      fail(error.message || "Unable to load the selected save file.");
      fileInput.value = "";
    }
  });

  graphicsQuality.value = settings.graphics;
  masterVolume.value = String(Math.round(settings.volume * 100));
  applySettings();
  window.addEventListener("pointerdown", startTitleMusic);
  window.addEventListener("keydown", startTitleMusic);

  backgroundVideo.addEventListener("loadeddata", () => {
    backgroundVideo.classList.add("ready");
    backgroundPlaceholder.classList.add("hidden");
  });
})();
