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

let remote = true; // set false when the console can't be reached -> demo store

const api = {
  async call(endpoint, method = "GET", body = null, base = CONSOLE) {
    if (!remote) return DEMO.call(endpoint, method, body);
    let url = base + "/api/acc/" + endpoint;
    const opt = { method, headers: {} };
    if (method === "GET" && body && body.token) {
      // browsers don't allow a body on GET; carry the token in the query string
      url += "?token=" + encodeURIComponent(body.token);
      body = null;
    }
    if (method === "POST" || method === "PATCH" || method === "PUT" || method === "DELETE") {
      opt.headers["Content-Type"] = "application/json";
      if (body) opt.body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, opt);
    } catch {
      remote = false;
      return DEMO.call(endpoint, method, body);
    }
    return res.json().catch(() => ({}));
  },
  async goai(message) {
    if (!remote) return DEMO.goai(message);
    const res = await fetch(CONSOLE + "/api/goai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message }),
    });
    return res.json().catch(() => ({}));
  },
  async info() {
    const res = await fetch(CONSOLE + "/api/info").catch(() => null);
    if (!res) { remote = false; return null; }
    const data = await res.json().catch(() => null);
    if (!data) { remote = false; return null; }
    remote = true;
    return data;
  },
};

/* ---------- demo store (localStorage fallback when no console is reachable) ---------- */

const DEMO = (() => {
  const KEY = "gcos_demo_db";
  const load = () => {
    try { return JSON.parse(localStorage.getItem(KEY)) || { users: {}, sessions: {} }; }
    catch { return { users: {}, sessions: {} }; }
  };
  const save = (db) => localStorage.setItem(KEY, JSON.stringify(db));
  const uid = (p) => p + Math.random().toString(36).slice(2, 10);
  const toView = (u) => ({
    id: u.id, username: u.username, displayName: u.displayName,
    email: u.email, avatar: u.avatar || "", bio: u.bio || "",
    twoFactorEnabled: u.twoFactorEnabled || false, emailVerified: u.emailVerified || false,
    locale: u.locale || "en-US", theme: u.theme || "dark", goPoints: u.goPoints || 0,
    createdAt: u.createdAt, friendIds: u.friendIds || [],
    devices: u.devices || [], subscriptions: u.subscriptions || [], activity: u.activity || [],
  });
  const err = (error) => ({ ok: false, error });

  return {
    call(endpoint, method, body = {}) {
      const db = load();
      const b = body || {};
      const userByToken = () => {
        const t = b.token;
        if (!t) return null;
        const name = db.sessions[t];
        return name ? db.users[name] || null : null;
      };
      const saveUser = (u) => { db.users[u.username] = u; save(db); };

      if (endpoint === "register" && method === "POST") {
        const username = (b.username || "").trim().toLowerCase();
        if (!username || !b.password) return Promise.resolve(err("username and password are required"));
        if ((b.password || "").length < 4) return Promise.resolve(err("password must be at least 4 characters"));
        if (db.users[username]) return Promise.resolve(err("username already taken"));
        const u = {
          id: uid("u_"), username, displayName: b.displayName || username,
          email: b.email || "", password: String(b.password),
          bio: "", locale: "en-US", theme: "dark",
          twoFactorEnabled: false, emailVerified: false, goPoints: 100,
          createdAt: new Date().toISOString(), friendIds: [], devices: [], subscriptions: [], activity: [],
        };
        db.users[username] = u;
        const token = uid("t_");
        db.sessions[token] = username;
        save(db);
        return Promise.resolve({ ok: true, token, profile: toView(u) });
      }

      if (endpoint === "login" && method === "POST") {
        const username = (b.username || "").trim().toLowerCase();
        const u = db.users[username];
        if (!u || u.password !== b.password) return Promise.resolve(err("invalid username or password"));
        const token = uid("t_");
        db.sessions[token] = username;
        save(db);
        return Promise.resolve({ ok: true, token, profile: toView(u) });
      }

      if (endpoint === "logout" && method === "POST") {
        delete db.sessions[b.token];
        save(db);
        return Promise.resolve({ ok: true });
      }

      const user = userByToken();
      if (!user) return Promise.resolve(err("not authenticated"));

      if (endpoint === "profile") {
        if (method === "GET") return Promise.resolve({ ok: true, profile: toView(user) });
        if (method === "PATCH") {
          if (b.displayName != null) user.displayName = b.displayName;
          if (b.bio != null) user.bio = b.bio;
          if (b.email != null) user.email = b.email;
          if (b.locale != null) user.locale = b.locale;
          if (b.twoFactorEnabled != null) user.twoFactorEnabled = !!b.twoFactorEnabled;
          saveUser(user);
          return Promise.resolve({ ok: true, profile: toView(user) });
        }
      }

      if (endpoint === "devices") {
        if (method === "GET") return Promise.resolve({ ok: true, devices: user.devices || [] });
        if (method === "POST") {
          const dev = { id: uid("d_"), name: b.name || "GoConsoleOS Device", kind: b.kind || "console", os: b.os || "GoConsoleOS", lastSeen: new Date().toISOString() };
          user.devices = user.devices || [];
          user.devices.push(dev);
          saveUser(user);
          return Promise.resolve({ ok: true, device: dev });
        }
        const id = endpoint.split("/")[1];
        if (method === "DELETE" && id) {
          user.devices = (user.devices || []).filter((d) => d.id !== id);
          saveUser(user);
          return Promise.resolve({ ok: true });
        }
      }

      if (endpoint === "map") {
        return Promise.resolve({ ok: true, self: null, devices: user.devices || [] });
      }

      if (endpoint === "subscriptions") {
        if (method === "POST") {
          const startedAt = new Date().toISOString();
          const sub = {
            id: uid("s_"), plan: b.plan, tier: b.plan, isActive: true,
            startedAt, expiresAt: new Date(Date.now() + 30 * 86400000).toISOString(),
          };
          user.subscriptions = user.subscriptions || [];
          user.subscriptions.push(sub);
          saveUser(user);
        }
        return Promise.resolve({ ok: true, subscriptions: user.subscriptions || [] });
      }

      if (endpoint === "activity")
        return Promise.resolve({ ok: true, activity: user.activity || [] });

      if (endpoint === "wallet") {
        if (method === "POST") {
          const amt = parseInt(b.points, 10) || 0;
          user.goPoints = Math.max(0, (user.goPoints || 0) + amt);
          saveUser(user);
        }
        return Promise.resolve({ ok: true, points: user.goPoints || 0 });
      }

      if (endpoint === "friends" && method === "POST") {
        const target = (b.username || "").trim().toLowerCase();
        if (!db.users[target]) return Promise.resolve(err("user not found"));
        user.friendIds = user.friendIds || [];
        if (!user.friendIds.includes(target)) user.friendIds.push(target);
        saveUser(user);
        return Promise.resolve({ ok: true, friends: user.friendIds });
      }

      return Promise.resolve(err("unknown acc endpoint"));
    },
    goai(message) {
      const m = String(message || "").toLowerCase();
      if (m.includes("game")) return { reply: "Demo mode: I'd suggest checking your GoGames library on the console.", suggestions: ["usb health", "performance"] };
      if (m.includes("usb")) return { reply: "Demo mode: your USB drive looks healthy from here.", suggestions: ["my games", "performance"] };
      if (m.includes("performance")) return { reply: "Demo mode: the console is running smoothly.", suggestions: ["my games", "usb health"] };
      return { reply: "Demo mode: connect to your GoConsoleOS console at http://localhost:39210 for the full GoAI experience.", suggestions: ["my games", "usb health"] };
    },
  };
})();

/* ---------- auth flow ---------- */

function showAuth() {
  $("auth").hidden = false;
  $("dash").hidden = true;
  $("nav").hidden = true;
}
function showDash() {
  $("auth").hidden = true;
  $("dash").hidden = false;
  $("nav").hidden = false;
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
  renderMap();
  renderSecurity();
  renderWallet();
  renderSubscriptions();
  renderFriends();
  renderActivity();
  showDash();
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

let _map = null;

async function renderMap() {
  const status = $("mapStatus");
  if (typeof L === "undefined") {
    status.textContent = "Map library not loaded - connect this page to your console over the internet to see locations.";
    return;
  }
  const data = await api.call("map", "GET", { token });
  if (!data.ok) { status.textContent = "Map data unavailable."; return; }

  const markers = [];
  if (data.self) {
    markers.push({
      lat: data.self.lat, lng: data.self.lng,
      title: "This console", city: data.self.city, country: data.self.country,
      color: "accent",
    });
  }
  (data.devices || []).forEach((d) => {
    if (typeof d.latitude === "number" && typeof d.longitude === "number" && (d.latitude || d.longitude)) {
      markers.push({
        lat: d.latitude, lng: d.longitude,
        title: d.name, city: d.city, country: d.country,
        color: "device",
      });
    }
  });

  if (!markers.length) {
    status.textContent = "No location yet - the console resolves its own location when it can reach the internet. Try again in a few seconds.";
    return;
  }

  if (!_map) {
    _map = L.map("consoleMap").setView([markers[0].lat, markers[0].lng], 4);
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 18,
    }).addTo(_map);
  }
  _map.eachLayer((l) => { if (l.options && l.options.plotId) _map.removeLayer(l); });

  markers.forEach((m) => {
    const icon = L.divIcon({
      className: "",
      html: "<div style='width:14px;height:14px;border-radius:50%;border:2px solid #fff;background:" +
        (m.color === "accent" ? "#00c9db" : "#7c5cff") + ";box-shadow:0 0 6px rgba(0,0,0,.6)'></div>",
      iconSize: [14, 14], iconAnchor: [7, 7],
    });
    L.marker([m.lat, m.lng], { icon, plotId: true })
      .addTo(_map)
      .bindPopup("<strong>" + esc(m.title) + "</strong><br/>" +
        [m.city, m.country].filter(Boolean).join(", ") || "Unknown location");
  });

  if (markers.length === 1) _map.setView([markers[0].lat, markers[0].lng], 4);
  else _map.fitBounds(markers.map((m) => [m.lat, m.lng]), { padding: [30, 30] });
  status.textContent = markers.length + (markers.length === 1 ? " location plotted." : " locations plotted.");
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

/* password show/hide toggles */
document.querySelectorAll(".pw-toggle").forEach((btn) => {
  btn.onclick = () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    if (input.type === "password") {
      input.type = "text";
      btn.innerHTML = "&#128064;"; // eye-off
    } else {
      input.type = "password";
      btn.innerHTML = "&#128065;"; // eye
    }
  };
});
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
    await refreshDashboard(); // shows dash only if the token is still valid
  } else {
    showAuth();
  }
  addChat("ai", "Hi! I'm GoAI. Ask me about your games, USB health or performance.");
})();
