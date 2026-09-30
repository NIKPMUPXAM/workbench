/* 今日重要事项：我的待办(手动) + 系统聚合提醒(自动)
 * 依赖：index.html 已先加载 okr_board_data.js / inquiry_data.js / media_stats.js
 * 存储：localStorage['wb_todos'] = [{id,text,module,priority,due,done}]
 */
(function () {
  "use strict";
  var STORE = "wb_todos";
  var MODULES = {
    worklog: { name: "工作日志", file: "worklog.html", icon: "📝" },
    inquiry: { name: "询单统计", file: "inquiry.html", icon: "📊" },
    okr: { name: "月工作数据看板", file: "okr-board.html", icon: "📈" },
    media: { name: "外媒运营平台", file: "media-platforms.html", icon: "🌍" },
    docs: { name: "工作汇报与文档", file: "docs.html", icon: "📁" },
    portal: { name: "任意门", file: "portal.html", icon: "🚪" },
    ai: { name: "AI工具", file: "ai-tools.html", icon: "🤖" }
  };
  var PRI = { 高: 0, 中: 1, 低: 2 };
  var PRI_CLASS = { 高: "pri-high", 中: "pri-mid", 低: "pri-low" };

  function load() {
    try { return JSON.parse(localStorage.getItem(STORE) || "[]"); } catch (e) { return []; }
  }
  function save(list) {
    try { localStorage.setItem(STORE, JSON.stringify(list)); } catch (e) {}
  }
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
  function esc(s) {
    return (s == null ? "" : String(s)).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  /* ---------- 我的待办 ---------- */
  function renderTodos() {
    var box = document.getElementById("todoList");
    if (!box) return;
    var list = load();
    var remain = list.filter(function (t) { return !t.done; }).length;
    var badge = document.getElementById("todoCount");
    if (badge) badge.textContent = remain;

    if (!list.length) {
      box.innerHTML = '<div class="empty-state" style="padding:16px"><div class="icon">🗒️</div><div>还没有待办，点「+ 添加」记下今天要做的事</div></div>';
      return;
    }
    list.sort(function (a, b) {
      if (a.done !== b.done) return a.done ? 1 : -1;
      return (PRI[a.priority] || 1) - (PRI[b.priority] || 1);
    });
    box.innerHTML = list.map(function (t) {
      var mod = MODULES[t.module] || { name: "—", file: "#", icon: "📌" };
      var pc = PRI_CLASS[t.priority] || "pri-low";
      var due = t.due ? '<span class="todo-due">📅 ' + esc(t.due) + "</span>" : "";
      var overdue = t.due && !t.done && new Date(t.due + "T23:59").getTime() < Date.now();
      return '<div class="todo-item' + (overdue ? " overdue" : "") + '">' +
        '<label class="todo-check"><input type="checkbox" data-id="' + t.id + '"' + (t.done ? " checked" : "") + "></label>" +
        '<div class="todo-main"><div class="todo-text' + (t.done ? " done" : "") + '">' + esc(t.text) + "</div>" +
        '<div class="todo-meta"><span class="todo-pri ' + pc + '">' + esc(t.priority) + "</span>" + due +
        '<span class="todo-mod">' + mod.icon + " " + mod.name + "</span></div></div>" +
        '<div class="todo-actions"><a class="todo-go" href="' + mod.file + '" title="去处理">去处理 ➜</a>' +
        '<button class="todo-del" data-id="' + t.id + '" title="删除">✕</button></div></div>';
    }).join("");
  }

  function addTodo() {
    var inp = document.getElementById("todoInput");
    var txt = (inp && inp.value || "").trim();
    if (!txt) return;
    var mod = document.getElementById("todoModule");
    var pri = document.getElementById("todoPriority");
    var due = document.getElementById("todoDue");
    var list = load();
    list.push({
      id: uid(),
      text: txt,
      module: mod ? mod.value : "",
      priority: pri ? pri.value : "中",
      due: due ? due.value : "",
      done: false
    });
    save(list);
    if (inp) inp.value = "";
    renderTodos();
  }

  /* ---------- 系统聚合提醒 ---------- */
  function renderAlerts() {
    var box = document.getElementById("alertList");
    if (!box) return;
    var arr = [];

    // 1) OKR 当月完成度待填
    try {
      var ob = window.WB_OKR_BOARD;
      if (ob && ob.months && ob.data) {
        var lm = ob.months[ob.months.length - 1];
        var tasks = ob.data[lm] || [];
        var pend = tasks.filter(function (t) { return !t.note; }).length;
        if (pend > 0) arr.push({ lv: "warn", icon: "📈", text: lm + " 月 OKR 还有 " + pend + " 项完成度待填写", go: "okr-board.html" });
      }
    } catch (e) {}

    // 2) 询单缺日期
    try {
      var is = window.WB_INQUIRY_SEED;
      if (is && is.items) {
        var nd = is.items.filter(function (i) { return !i.date; }).length;
        if (nd > 0) arr.push({ lv: "warn", icon: "📊", text: "询单有 " + nd + " 条缺少日期，待补录", go: "inquiry.html" });
      }
    } catch (e) {}

    // 3) 外媒平台数据待补
    try {
      var ms = window.WB_MEDIA_STATS;
      if (ms) {
        var pend = 0;
        Object.keys(ms).forEach(function (k) {
          if (k === "updated") return;
          var v = ms[k];
          if (!v || typeof v !== "object") return;
          if (Object.keys(v).some(function (f) { return v[f] === "待补"; })) pend++;
        });
        if (pend > 0) arr.push({ lv: "warn", icon: "🌍", text: "外媒运营平台有 " + pend + " 个平台数据待补", go: "media-platforms.html" });
      }
    } catch (e) {}

    // 4) 数据新鲜度（基于各数据源 updated 字段）
    try {
      var ds = [];
      if (window.WB_OKR_BOARD && window.WB_OKR_BOARD.updated) ds.push(window.WB_OKR_BOARD.updated);
      if (window.WB_INQUIRY_SEED && window.WB_INQUIRY_SEED.updated) ds.push(window.WB_INQUIRY_SEED.updated);
      if (window.WB_MEDIA_STATS && window.WB_MEDIA_STATS.updated) ds.push(window.WB_MEDIA_STATS.updated);
      var ts = ds.map(function (s) { return new Date(String(s).replace(/-/g, "/")).getTime(); }).filter(function (x) { return !isNaN(x); });
      if (ts.length) {
        var latest = Math.max.apply(null, ts);
        var days = (Date.now() - latest) / 86400000;
        if (days > 2) arr.push({ lv: "danger", icon: "⚠️", text: "数据已 " + Math.floor(days) + " 天未更新，请检查企微授权 / 代理", go: "#" });
        else arr.push({ lv: "ok", icon: "✅", text: "数据最近更新于 " + new Date(latest).toLocaleDateString("zh-CN"), go: "#" });
      }
    } catch (e) {}

    if (!arr.length) {
      box.innerHTML = '<div class="empty-state" style="padding:16px"><div class="icon">🎉</div><div>暂无待办提醒，一切正常</div></div>';
      return;
    }
    var lvcls = { warn: "al-warn", danger: "al-danger", ok: "al-ok" };
    box.innerHTML = arr.map(function (a) {
      var c = lvcls[a.lv] || "al-warn";
      var go = a.go && a.go !== "#" ? '<a class="al-go" href="' + a.go + '">去处理 ➜</a>' : "";
      return '<div class="alert-item ' + c + '"><span class="al-icon">' + a.icon + '</span><span class="al-text">' + esc(a.text) + "</span>" + go + "</div>";
    }).join("");
  }

  function bind() {
    var addBtn = document.getElementById("todoAdd");
    if (addBtn) addBtn.addEventListener("click", addTodo);
    var inp = document.getElementById("todoInput");
    if (inp) inp.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addTodo(); } });

    document.addEventListener("change", function (e) {
      if (e.target && e.target.matches && e.target.matches(".todo-check input")) {
        var id = e.target.getAttribute("data-id");
        var list = load();
        list.forEach(function (t) { if (t.id === id) t.done = e.target.checked; });
        save(list); renderTodos();
      }
    });
    document.addEventListener("click", function (e) {
      if (e.target && e.target.matches && e.target.matches(".todo-del")) {
        var id = e.target.getAttribute("data-id");
        save(load().filter(function (t) { return t.id !== id; }));
        renderTodos();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", function () { bind(); renderTodos(); renderAlerts(); });
})();
