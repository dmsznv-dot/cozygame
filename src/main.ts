import "./style.css";
import { resolveGameConnection } from "./connection";
import * as THREE from "three";
import { Forest } from "./world";
import { paintAvatar } from "./avatar";
import { ForestAudio } from "./audio";
import {
  COLORS,
  SPAWN,
  STATIONS,
  SYMBOLS,
  SIGN_SEQUENCE,
  LIGHT_COUNTS,
  canOccupy,
  distance,
  solved,
  type Snapshot,
} from "../shared/game";
const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
  document.getElementById(id) as T;
const connection = resolveGameConnection(import.meta.env.VITE_GAME_SERVER_URL || '', import.meta.env.VITE_STATIC_HOST === 'true', location.href);
const homePath = import.meta.env.BASE_URL;
document.querySelector<HTMLAnchorElement>('#brand a')!.href = homePath;
if (!connection.url) {
  $('lobby-error').textContent = connection.reason;
  $<HTMLButtonElement>('create').disabled = true;
  $('join-form').querySelector('button')!.disabled = true;
}
const canvas = $<HTMLCanvasElement>("world");
let world: Forest;
try {
  world = new Forest(canvas);
} catch (e) {
  $("fatal").hidden = false;
  throw e;
}
const audio = new ForestAudio();
let color = localStorage.getItem("trail-color") || COLORS[0];
if (!COLORS.includes(color)) color = COLORS[0];
const names = [
  "Медовый",
  "Шалфейный",
  "Небесный",
  "Розовый",
  "Лавандовый",
  "Сливочный",
];
COLORS.forEach((c, i) => {
  const button = document.createElement("button");
  button.className = "swatch";
  button.style.setProperty("--swatch", c);
  button.title = names[i];
  button.setAttribute("aria-label", names[i]);
  button.onclick = () => {
    color = c;
    localStorage.setItem("trail-color", c);
    refreshColor();
  };
  button.dataset.color = c;
  $("colors").append(button);
});
function refreshColor() {
  document.querySelectorAll<HTMLButtonElement>(".swatch").forEach((b) => {
    b.classList.toggle("selected", b.dataset.color === color);
    b.setAttribute("aria-pressed", String(b.dataset.color === color));
  });
  paintAvatar(world.lobbyAvatar, color);
}
refreshColor();
$<HTMLInputElement>("name").value =
  localStorage.getItem("trail-name") || "Путник";
const url = new URL(location.href);
$<HTMLInputElement>("room-code").value = (
  url.searchParams.get("room") || ""
).toUpperCase();
let ws: WebSocket | null = null,
  snapshot: Snapshot | null = null,
  myId = "",
  active = false,
  connecting = false,
  paused = true,
  yaw = 0,
  pitch = 0,
  vy = 0,
  onGround = true,
  pointing = false;
const position = new THREE.Vector3(SPAWN.x, SPAWN.y, SPAWN.z);
const keys = new Set<string>();
let lastSend = 0,
  lastStep = 0,
  lastNotice = "",
  toastUntil = 0,
  lastCount = 0,
  reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let currentCode = "",
  helpFromLobby = false,
  remoteReady = false,
  lockedAt = 0,
  discardNextLook = false;
function toast(message: string, seconds = 4) {
  $("toast").textContent = message;
  $("toast").classList.add("visible");
  toastUntil = performance.now() + seconds * 1000;
}
function send(data: unknown) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data));
}
function action(a: unknown) {
  send({ type: "action", action: a });
  audio.click();
}
function setConnecting(value: boolean) {
  connecting = value;
  $<HTMLButtonElement>("create").disabled = value;
  $<HTMLButtonElement>("join-form").querySelector("button")!.disabled = value;
}
function connect(code: string, reconnecting = false) {
  if (connecting || !connection.url) return;
  setConnecting(true);
  $("lobby-error").textContent = "";
  if (ws) {
    ws.onclose = null;
    ws.close();
  }
  ws = new WebSocket(connection.url);
  const saved = code ? sessionStorage.getItem(`trail-session-${code}`) : null;
  ws.onopen = () => {
    const name = $<HTMLInputElement>("name").value.trim() || "Путник";
    localStorage.setItem("trail-name", name);
    send({ type: "join", code, name, color, token: saved || undefined });
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.type === "error") {
      $("lobby-error").textContent = m.message;
      setConnecting(false);
      if (active) {
        toast(m.message, 9);
        if (reconnecting) {
          paused = true;
          openMenu();
        }
      }
      return;
    }
    if (m.type === "welcome") {
      myId = m.id;
      snapshot = m.snapshot;
      currentCode = snapshot!.code;
      sessionStorage.setItem(`trail-session-${currentCode}`, m.token);
      const p = snapshot!.players.find((p) => p.id === myId)!;
      position.set(p.pos.x, p.pos.y, p.pos.z);
      yaw = p.yaw;
      pitch = p.pitch;
      setConnecting(false);
      document.body.classList.remove("disconnected");
      remoteReady = true;
      active = true;
      document.body.classList.add("playing");
      $("lobby").hidden = true;
      $("hud").hidden = false;
      world.lobbyAvatar.visible = false;
      world.companion.visible = false;
      const inviteUrl = new URL(location.href);
      inviteUrl.searchParams.set("room", currentCode);
      history.replaceState({}, "", inviteUrl);
      $("room-label").textContent =
        `Комната ${currentCode} · прогресс хранится до перезапуска сервера`;
      paused = true;
      openMenu();
      $("modal-title").textContent = reconnecting
        ? "Вы снова вместе"
        : "Добро пожаловать в лес";
      $("modal-desc").textContent =
        "Нажмите «Вернуться на тропу», чтобы управлять мышью.";
      toast("Ссылка на вашу прогулку — в кнопке «Пригласить»", 7);
      audio.start();
      updateUI();
    }
    if (m.type === "correction") {
      position.set(m.pos.x, m.pos.y, m.pos.z);
      vy = 0;
    }
    if (m.type === "state") {
      snapshot = m.snapshot;
      updateUI();
    }
  };
  ws.onerror = () => {
    if (!active) {
      $("lobby-error").textContent =
        "Не удалось связаться с сервером. Попробуйте ещё раз.";
      setConnecting(false);
    }
  };
  ws.onclose = (e) => {
    setConnecting(false);
    remoteReady = false;
    if (active) {
      keys.clear();
      document.body.classList.add("disconnected");
      toast(
        e.code === 4001
          ? "Эта сессия открыта в другой вкладке."
          : "Связь прервалась. Пробуем вернуться в комнату…",
        20,
      );
      if (e.code !== 4001) {
        reconnectTimer = setTimeout(() => connect(currentCode, true), 2000);
      }
    }
  };
}
$("create").onclick = () => connect("");
$("join-form").onsubmit = (e) => {
  e.preventDefault();
  const code = $<HTMLInputElement>("room-code").value.trim().toUpperCase();
  if (!/^[A-F0-9]{6}$/.test(code)) {
    $("lobby-error").textContent = "Введите шестизначный код из приглашения.";
    return;
  }
  connect(code);
};
async function copyInvite() {
  if (!currentCode) return;
  const invite = new URL(location.href);
  invite.searchParams.set("room", currentCode);
  try {
    await navigator.clipboard.writeText(invite.href);
    toast("Приглашение скопировано. Отправьте его другу.");
    $("copy-menu").textContent = "Ссылка скопирована ✓";
  } catch {
    openMenu();
    $("room-label").textContent = `Код: ${currentCode}. Ссылка: ${invite.href}`;
  }
}
$("invite").onclick = copyInvite;
$("copy-menu").onclick = copyInvite;
function openMenu() {
  paused = true;
  keys.clear();
  if (document.pointerLockElement) document.exitPointerLock();
  $("overlay").hidden = false;
  $("modal-title").textContent = "Небольшая передышка";
  $("modal-desc").textContent = "Лес подождёт. Друг продолжает гулять.";
  $("copy-menu").hidden = !active;
  $("leave").hidden = !active;
  $("resume").innerHTML = active
    ? "Вернуться на тропу <span>↗</span>"
    : "Всё понятно <span>↗</span>";
}
$("leave").onclick = () => {
  active = false;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  ws?.close();
  location.href = homePath;
};
$("menu-button").onclick = openMenu;
$("lobby-help").onclick = () => {
  helpFromLobby = true;
  openMenu();
  $("modal-title").textContent = "Гулять. Замечать. Быть рядом.";
  $("modal-desc").textContent =
    "Игра для двух компьютеров с мышью и клавиатурой.";
};
$("resume").onclick = async () => {
  if (helpFromLobby && !active) {
    $("overlay").hidden = true;
    helpFromLobby = false;
    return;
  }
  if (!active) return;
  audio.start();
  try {
    await canvas.requestPointerLock();
    $("overlay").hidden = true;
    paused = false;
  } catch {
    toast("Нажмите на лес, чтобы включить управление мышью.");
    $("overlay").hidden = true;
    paused = true;
  }
};
canvas.onclick = () => {
  if (active && paused && $("overlay").hidden) void canvas.requestPointerLock();
};
document.addEventListener("pointerlockchange", () => {
  if (document.pointerLockElement === canvas) {
    lockedAt = performance.now();
    discardNextLook = true;
    paused = false;
    $("overlay").hidden = true;
  } else if (active) {
    paused = true;
    keys.clear();
    openMenu();
  }
});
document.addEventListener("mousemove", (e) => {
  if (discardNextLook) {
    discardNextLook = false;
    return;
  }
  if (Math.abs(e.movementX) > 250 || Math.abs(e.movementY) > 250) return;
  if (
    active &&
    !paused &&
    document.pointerLockElement === canvas &&
    performance.now() - lockedAt > 150
  ) {
    yaw -= e.movementX * 0.002;
    pitch = Math.max(-1.35, Math.min(1.35, pitch - e.movementY * 0.002));
  }
});
$<HTMLInputElement>("volume").oninput = (e) =>
  audio.setVolume(Number((e.target as HTMLInputElement).value) / 100);
$<HTMLSelectElement>("quality").onchange = (e) =>
  world.quality((e.target as HTMLSelectElement).value === "high");
const near = (key: keyof typeof STATIONS, range = 3.7) =>
  distance(position, STATIONS[key]) < range;
function interact() {
  if (!snapshot) return;
  const held = snapshot.balls.find((b) => b.heldBy === myId);
  if (held) {
    throwBall();
    return;
  }
  if (near("lever")) {
    action({ kind: "lever" });
    return;
  }
  const ball = snapshot.balls.find(
    (b) => !b.heldBy && distance(position, b.pos) < 3,
  );
  if (ball) action({ kind: "pickup" });
}
function throwBall() {
  const dir = new THREE.Vector3();
  world.camera.getWorldDirection(dir);
  action({ kind: "throw", direction: { x: dir.x, y: dir.y, z: dir.z } });
}
document.addEventListener("keydown", (e) => {
  if (active && e.code === "Escape") {
    openMenu();
    return;
  }
  if (!active || paused || !remoteReady) return;
  if (
    ["Space", "ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(
      e.code,
    )
  )
    e.preventDefault();
  keys.add(e.code);
  if (e.repeat) return;
  if (e.code === "Space" && onGround) {
    vy = 5.6;
    onGround = false;
    audio.tone(120, 0.1, 0.12);
  }
  if (e.code === "KeyE") interact();
  if (e.code === "KeyQ") {
    pointing = true;
    toast("Вы показываете другу направление", 1.5);
  }
  if (e.code === "ArrowLeft" || e.code === "ArrowRight")
    action({ kind: "lane", value: e.code === "ArrowLeft" ? -1 : 1 });
  if (e.code.startsWith("Digit")) {
    const n = Number(e.code.slice(5));
    if (near("signPanel") && n >= 1 && n <= 4)
      action({ kind: "symbol", value: n - 1 });
    else if (near("lightPanel") && n >= 1 && n <= 9)
      action({ kind: "number", value: n });
  }
});
document.addEventListener("keyup", (e) => {
  keys.delete(e.code);
  if (e.code === "KeyQ") pointing = false;
});
window.addEventListener("blur", () => {
  keys.clear();
  pointing = false;
});
document.addEventListener("mousedown", (e) => {
  if (
    e.button === 0 &&
    active &&
    !paused &&
    document.pointerLockElement === canvas &&
    snapshot?.balls.some((b) => b.heldBy === myId)
  )
    throwBall();
});
function updateUI() {
  if (!snapshot) return;
  const s = snapshot;
  const friend = s.players.find((p) => p.id !== myId);
  $("partner").textContent = friend
    ? friend.online
      ? `● ${friend.name} рядом`
      : `○ ${friend.name} вернётся…`
    : "○ Ждём друга…";
  const flags = [s.progress.signs, s.progress.throwDone, s.progress.lights];
  const labels = ["Знаки", "Броски", "Светлячки"];
  $("progress").innerHTML = flags
    .map(
      (f, i) =>
        `<span class="${f ? "done" : ""}">${f ? "●" : "◌"} ${labels[i]}</span>`,
    )
    .join("");
  const count = flags.filter(Boolean).length;
  if (count > lastCount) {
    audio.success();
    lastCount = count;
  }
  $("objective").textContent = solved(s.progress)
    ? "Мост открыт. Встретьте вечер вместе"
    : "Зажгите три огонька";
  if (s.progress.notice && lastNotice !== s.progress.notice) {
    lastNotice = s.progress.notice;
    toast(lastNotice);
  }
}
function context() {
  if (!snapshot) return;
  const s = snapshot,
    held = s.balls.some((b) => b.heldBy === myId);
  let prompt = "",
    panel = "",
    place = "Тихая тропа";
  if (position.z > 10) place = "Поляна встреч";
  if (position.z < -43) {
    place = "Наш вечер";
    prompt = "Вы нашли дорогу вместе. Можно просто побыть здесь ♡";
  }
  if (near("signPlate", 7)) {
    place = "Домик лесных знаков";
    if (s.signObserver === myId) {
      panel =
        '<h3>Лесные знаки</h3><p>Покажите или назовите другу эти рисунки по порядку. Оставайтесь на круге.</p><div class="symbols">' +
        SIGN_SEQUENCE.map(
          (i) => `<span class="symbol">${["◒", "☾", "☀", "≈"][i]}</span>`,
        ).join("") +
        "</div><p>Лист · луна · солнце · волна — у друга есть все четыре.</p>";
    } else
      prompt =
        "Встаньте на каменный круг внутри домика, чтобы увидеть рисунки.";
  }
  if (near("signPanel")) {
    place = "Лесные знаки";
    panel = `<h3>Соберите рисунки</h3><p>Пусть друг встанет на круг в домике и назовёт последовательность.</p><div class="key-list">1 — лист ◒ &nbsp; 2 — луна ☾<br>3 — солнце ☀ &nbsp; 4 — волна ≈</div><p>${s.progress.signs ? "Готово ✓" : `Совпало ${s.progress.signIndex} из 3`}</p>`;
    prompt = "Нажмите 1–4, чтобы выбрать рисунок";
  }
  if (near("rack", 9)) {
    place = "По ту сторону ручья";
    if (held) prompt = "ЛКМ — бросить • Цельтесь немного выше корзины";
    else if (s.balls.some((b) => !b.heldBy && distance(position, b.pos) < 3))
      prompt = "E — взять светящийся шар";
  }
  if (near("lever")) {
    place = "По ту сторону ручья";
    panel = `<h3>Помогите попасть</h3><p>Держите рычаг, пока друг бросает шары. Передвигайте корзину стрелками ← →.</p><p>В корзине: ${s.progress.throws} / 3</p>`;
    prompt =
      s.progress.operator === myId
        ? "← → — двигать корзину • E — отпустить"
        : "E — взяться за рычаг";
  }
  if (near("lightPlate", 5)) {
    place = "Светлячки";
    if (s.lightObserver === myId) {
      panel = `<h3>Сосчитайте огоньки</h3><p>Друг видит таблицу кодов с другой стороны стены. Назовите ему количество горящих ламп.</p><p>Раунд ${Math.min(3, s.progress.lightRound + 1)} из 3</p>`;
      prompt = "Оставайтесь на круге, пока друг вводит код";
    } else prompt = "Встаньте на круг у фонарей";
  }
  if (near("lightPanel")) {
    place = "Светлячки";
    panel = `<h3>Огни → код</h3><p>Спросите друга, сколько ламп горит.</p><div class="key-list">1 огонь → 4 &nbsp; 2 огня → 7<br>3 огня → 2 &nbsp; 4 огня → 9<br>5 огней → 5</div><p>${s.progress.lights ? "Готово ✓" : `Раунд ${s.progress.lightRound + 1} из 3`}</p>`;
    prompt = "Нажмите цифру кода (1–9)";
  }
  if (position.z < -31 && position.z > -36 && !solved(s.progress))
    prompt = "Три огонька соберут мост. Найдите все загадки вместе.";
  $("prompt").textContent = prompt;
  $("context-panel").hidden = !panel;
  if ($("context-panel").innerHTML !== panel)
    $("context-panel").innerHTML = panel;
  $("place-name").textContent = place;
}
let previous = performance.now();
function frame(now: number) {
  requestAnimationFrame(frame);
  const dt = Math.min((now - previous) / 1000, 0.05);
  previous = now;
  if (active && snapshot) {
    if (!paused && remoteReady) {
      const forward = Number(keys.has("KeyW")) - Number(keys.has("KeyS"));
      const side = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
      const length = Math.hypot(forward, side) || 1;
      const speed = keys.has("ShiftLeft") ? 6 : 4;
      const dx =
          ((-Math.sin(yaw) * forward + Math.cos(yaw) * side) * speed * dt) /
          length,
        dz =
          ((-Math.cos(yaw) * forward - Math.sin(yaw) * side) * speed * dt) /
          length;
      if (canOccupy(position.x + dx, position.z, snapshot.progress))
        position.x += dx;
      if (canOccupy(position.x, position.z + dz, snapshot.progress))
        position.z += dz;
      vy -= 14 * dt;
      position.y += vy * dt;
      if (position.y <= SPAWN.y) {
        position.y = SPAWN.y;
        vy = 0;
        onGround = true;
      }
      if ((forward || side) && onGround && now - lastStep > 430) {
        audio.step(position.z < -35);
        lastStep = now;
      }
    }
    world.camera.position.copy(position);
    world.camera.rotation.order = "YXZ";
    world.camera.rotation.set(pitch, yaw, 0);
    if (now - lastSend > 50 && remoteReady) {
      send({
        type: "move",
        pos: { x: position.x, y: position.y, z: position.z },
        yaw,
        pitch,
        point: pointing,
      });
      lastSend = now;
    }
    world.apply(snapshot, myId);
    context();
    audio.update(position.z);
  }
  if (now > toastUntil) $("toast").classList.remove("visible");
  world.render(now / 1000, !active);
}
requestAnimationFrame(frame);
// Read-only diagnostics used by browser QA, useful for future level development.
Object.defineProperty(window, "trail", {
  get: () => ({
    position: { x: position.x, y: position.y, z: position.z },
    snapshot,
    myId,
    paused,
    yaw,
    pitch,
    drawCalls: world.renderer.info.render.calls,
  }),
});
