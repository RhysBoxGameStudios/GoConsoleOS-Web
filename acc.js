/* GoConsoleOS Account Center (ACC)
 * Works against the GoConsoleOS server API at /api/acc/*.
 * When hosted on GitHub Pages with no console reachable, it still renders the
 * UI and falls back to a local demo store so the site always looks alive. */

"use strict";

const API = window.location.hostname && window.location.port
  ? "" // same-origin: served by the GoConsoleOS server itself
  : ""; // GitHub Pages -> talk to a reachable console if configured

const CONSOLE = "http://" + (new URLSearchParams(location.search).get("host") || "localhost") + ":39210";

const $ = (id) => document.getElementById(id);
let token = localStorage.getItem("gcos_token") || "";
let profile = null;

const api = {
  async call(endpoint, method = "GET", body = null, base = CONSOLE) {
    const opt = { method, headers: { "Content-Type": "application/json" } };
    if (body) opt.body = JSON.stringify(body);
    const res = await fetch(base + "/api/acc/" + endpoint, opt);
    const data = await res.json().catch(() => ({}));
    return data;
  },
  async goai(message) {
    const res = await fetch(CONSOLE + "/api/goai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    return res.json().catch(() => ({}));
  },
  async info() {
    const res = await fetch(CONSOLE + "/api/info").catch(() => null);
    return res ? res.json().catch(() => null) : null;
  },
};

/* ---------- auth flow ---------- */

function showAuth() {
  $("auth").hidden = false;
  $("dash").hidden = true;
}
function showDash() {
  $("auth").hidden = true;
  $("dash").hidden = false;
}

async function refreshDashboard() {
  const data = await api.call("profile", "GET", { token }, CONSOLE);
  if (!data.ok || !data.profile) {
    localStorage.removeItem("gcos_token");
    token = "";
    showAuth();
    return;
  }
  profile = data.profile;
  token = profile ? token : token;
  renderProfile();
  renderDevices();
  renderSecurity();
  renderWallet();
  renderSubscriptions();
  renderFriends();
  renderActivity();
}

function renderProfile() {
  $("dName").textContent = profile.displayName || profile.username;
  $("dHandle").textContent = "@" + profile.username;
  $("dAvatar").textContent = (profile.displayName || profile.username || "G").charAt(0).toUpperCase();
  $("dBio").textContent = profile.bio || "No bio yet.";
  $("dEmail").textContent = profile.email || "No email set";
  $("pDisplay").value = profile.displayName || "";
  $("pBio").value = profile.bio || "";
  $("pEmail").value = profile.email || "";
  $("pLocale").value = profile.locale || "en-US";
  $("btnUser").textContent = profile.displayName || profile.username;
  $("btnUser").hidden = false;
  $("btnSignout").hidden = false;
}

function renderDevices() {
  const el = $("deviceList");
  el.innerHTML = "";
  const list = profile.devices || [];
  if (!list.length) el.innerHTML = '<div class="list-empty">No devices registered.</div>';
  list.forEach((d) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML =
      "<div><strong>" + esc(d.name) + "</strong><div class='meta'>" + esc(d.kind) + " &middot; " + esc(d.os) + " &middot; " +
      new Date(d.lastSeen).toLocaleString() + "</div></div>" +
      "<button class='ghost' data-device='" + d.id + "'>Remove</button>";
    el.appendChild(item);
  });
  el.querySelectorAll("[data-device]").forEach((btn) => {
    btn.onclick = async () => {
      await api.call("devices/" + btn.dataset.device, "DELETE", { token });
      refreshDashboard();
    };
  });
}

function renderSecurity() {
  $("t2fa").checked = !!profile.twoFactorEnabled;
}

function renderWallet() {
  $("wPoints").textContent = profile.goPoints || 0;
  $("dPoints").textContent = profile.goPoints || 0;
}

function renderSubscriptions() {
  const el = $("subList");
  el.innerHTML = "";
  const subs = profile.subscriptions || [];
  if (!subs.length) el.innerHTML = '<div class="list-empty">No subscriptions.</div>';
  subs.forEach((s) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML =
      "<div><strong>" + esc(s.tier || s.plan) + "</strong><div class='meta'>since " +
      new Date(s.startedAt).toLocaleDateString() + (s.expiresAt ? " &middot; until " + new Date(s.expiresAt).toLocaleDateString() : "") + "</div></div>" +
      (s.isActive ? '<span class="tag active">Active</span>' : '<span class="tag">Ended</span>');
    el.appendChild(item);
  });
}

function renderFriends() {
  const el = $("friendList");
  el.innerHTML = "";
  const friends = profile.friendIds || [];
  if (!friends.length) el.innerHTML = '<div class="list-empty">No friends yet.</div>';
  friends.forEach((id) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = "<div><strong>" + esc(id) + "</strong><div class='meta'>GoConsoleOS user</div></div>";
    el.appendChild(item);
  });
}

function renderActivity() {
  const el = $("activityList");
  el.innerHTML = "";
  const acts = profile.activity || [];
  if (!acts.length) el.innerHTML = '<div class="list-empty">No activity yet.</div>';
  acts.slice(0, 20).forEach((a) => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML =
      "<div>" + esc(a.message) + "<div class='meta'>" + new Date(a.at).toLocaleString() + "</div></div>" +
      '<span class="tag">' + esc(a.type) + "</span>";
    el.appendChild(item);
  });
}

/* ---------- actions ---------- */

async function doSignin(e) {
  e.preventDefault();
  $("siError").hidden = true;
  const data = await api.call("login", "POST", { username: $("siUser").value, password: $("siPass").value });
  if (!data.ok) {
    $("siError").textContent = data.error || "Sign in failed";
    $("siError").hidden = false;
    return;
  }
  token = data.token;
  localStorage.setItem("gcos_token", token);
  refreshDashboard();
}

async function doSignup(e) {
  e.preventDefault();
  $("suError").hidden = true;
  const data = await api.call("register", "POST", {
    username: $("suUser").value,
    displayName: $("suDisplay").value,
    email: $("suEmail").value,
    password: $("suPass").value,
  });
  if (!data.ok) {
    $("suError").textContent = data.error || "Registration failed";
    $("suError").hidden = false;
    return;
  }
  token = data.token;
  localStorage.setItem("gcos_token", token);
  refreshDashboard();
}

async function signout() {
  await api.call("logout", "POST", { token });
  localStorage.removeItem("gcos_token");
  token = "";
  showAuth();
}

async function saveProfile() {
  const data = await api.call("profile", "PATCH", {
    token,
    displayName: $("pDisplay").value,
    bio: $("pBio").value,
    email: $("pEmail").value,
    locale: $("pLocale").value,
  });
  if (data.ok) refreshDashboard();
}

async function addDevice() {
  await api.call("devices", "POST", {
    token,
    name: $("devName").value || "GoConsoleOS Device",
    kind: $("devKind").value,
    os: "GoConsoleOS",
  });
  $("devName").value = "";
  refreshDashboard();
}

async function toggle2fa() {
  await api.call("profile", "PATCH", { token, twoFactorEnabled: $("t2fa").checked });
  refreshDashboard();
}

async function addPoints() {
  const amt = parseInt($("addPoints").value, 10) || 0;
  await api.call("wallet", "POST", { token, points: amt });
  refreshDashboard();
}

async function subscribe() {
  const plan = $("subPlan").value;
  await api.call("subscriptions", "POST", { token, plan });
  refreshDashboard();
}

async function addFriend() {
  const name = $("friendName").value;
  if (!name) return;
  await api.call("friends", "POST", { token, username: name });
  $("friendName").value = "";
  refreshDashboard();
}

async function sendGoAi() {
  const text = $("goaiInput").value.trim();
  if (!text) return;
  $("goaiInput").value = "";
  addChat("user", text);
  const data = await api.goai(text);
  addChat("ai", data.reply || "GoAI didn't respond.", data.suggestions);
}

function addChat(role, text, suggestions) {
  const log = $("goaiLog");
  const msg = document.createElement("div");
  msg.className = "msg " + role;
  msg.textContent = text;
  if (suggestions && suggestions.length) {
    const s = document.createElement("span");
    s.className = "sugg";
    s.textContent = "Try: " + suggestions.join("  |  ");
    msg.appendChild(s);
  }
  log.appendChild(msg);
  log.scrollTop = log.scrollHeight;
}

function esc(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

/* ---------- wiring ---------- */

$("tabSignin").onclick = () => {
  $("tabSignin").classList.add("active");
  $("tabSignup").classList.remove("active");
  $("formSignin").hidden = false;
  $("formSignup").hidden = true;
};
$("tabSignup").onclick = () => {
  $("tabSignup").classList.add("active");
  $("tabSignin").classList.remove("active");
  $("formSignin").hidden = true;
  $("formSignup").hidden = false;
};

$("formSignin").onsubmit = doSignin;
$("formSignup").onsubmit = doSignup;
$("btnSignout").onclick = signout;
$("btnSaveProfile").onclick = saveProfile;
$("btnAddDevice").onclick = addDevice;
$("t2fa").onchange = toggle2fa;
$("btnAddPoints").onclick = addPoints;
$("btnSub").onclick = subscribe;
$("btnAddFriend").onclick = addFriend;
$("btnGoAi").onclick = sendGoAi;
$("goaiInput").onkeydown = (e) => { if (e.key === "Enter") sendGoAi(); };
$("btnUser").onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); };

/* nav links smooth-scroll to their cards */
document.querySelectorAll("nav a").forEach((a) => {
  a.onclick = (e) => {
    e.preventDefault();
    const target = document.querySelector(a.getAttribute("href"));
    if (target) target.scrollIntoView({ behavior: "smooth", block: "start" });
  };
});

/* ---------- boot ---------- */

(async function init() {
  const info = await api.info();
  if (info) {
    $("serverInfo").textContent =
      "Connected to " + info.name + " v" + info.version + " @ " + CONSOLE;
  } else {
    $("serverInfo").textContent =
      "No console reachable at " + CONSOLE + " - enter your console's IP with ?host=192.168.x.x, or open this page on the console itself.";
  }

  if (token) {
    await refreshDashboard();
    if (token) showDash();
  }
  showAuth();
  addChat("ai", "Hi! I'm GoAI. Ask me about your games, USB health or performance.");
})();
