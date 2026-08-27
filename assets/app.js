// ========== 多页面工作台公共脚本 ==========
(function () {
    'use strict';

    // ---------- 移动端侧边栏 ----------
    var menuToggle = document.getElementById('menuToggle');
    var sidebar = document.getElementById('sidebar');
    var overlay = document.getElementById('sidebarOverlay');

    function openSidebar() { if (sidebar) sidebar.classList.add('open'); if (overlay) overlay.classList.add('show'); }
    function closeSidebar() { if (sidebar) sidebar.classList.remove('open'); if (overlay) overlay.classList.remove('show'); }

    if (menuToggle && sidebar) {
        menuToggle.addEventListener('click', function () {
            if (sidebar.classList.contains('open')) closeSidebar(); else openSidebar();
        });
    }
    if (overlay) overlay.addEventListener('click', closeSidebar);

    // 点击导航（移动端）后收起
    document.querySelectorAll('.nav-item').forEach(function (item) {
        item.addEventListener('click', function () {
            if (window.innerWidth <= 1024) closeSidebar();
        });
    });

    // ---------- 日期显示 ----------
    function updateDate() {
        var now = new Date();
        var cd = document.getElementById('currentDate');
        if (cd) cd.textContent = now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' });
        var start = new Date(now.getFullYear(), now.getMonth(), 1);
        var dow = start.getDay();
        var adj = dow === 0 ? 6 : dow - 1;
        var week = Math.ceil((now.getDate() + adj) / 7);
        var cw = document.getElementById('currentWeek');
        if (cw) cw.textContent = '第' + week + '周';
        var sd = document.getElementById('sidebarDate');
        if (sd && cd && cw) sd.textContent = cd.textContent + ' · ' + cw.textContent;
    }
    updateDate();

    // ---------- 通用询单登记表（支持多表，按 data-key 区分存储） ----------
    function getInquiryRowHTML() {
        return '<td><input type="date" placeholder="选择日期"></td>' +
            '<td><select>' +
                '<option value="">— 选择来源 —</option>' +
                '<option value="tiktok">TikTok</option>' +
                '<option value="instagram">Instagram</option>' +
                '<option value="facebook">Facebook</option>' +
                '<option value="youtube">YouTube</option>' +
                '<option value="twitter">推特 X</option>' +
                '<option value="douyin">抖音</option>' +
                '<option value="mic">中国制造网</option>' +
                '<option value="other">其他</option>' +
            '</select></td>' +
            '<td><input type="text" placeholder="客户名/公司名"></td>' +
            '<td><input type="text" placeholder="业务员姓名"></td>' +
            '<td><input type="text" placeholder="客户大致需求描述..."></td>' +
            '<td style="text-align:center;"><button type="button" class="row-del" title="删除此行">🗑</button></td>';
    }

    function initInquiryTable(table) {
        if (!table) return;
        var key = table.getAttribute('data-key') || 'wb_inquiry';
        var body = table.querySelector('tbody');
        if (!body) return;
        try {
            var saved = localStorage.getItem(key);
            if (saved) {
                var data = JSON.parse(saved);
                if (data && data.rows) body.innerHTML = data.rows;
            }
        } catch (e) {}
        function save() {
            try {
                localStorage.setItem(key, JSON.stringify({ rows: body.innerHTML, savedAt: new Date().toLocaleString('zh-CN') }));
            } catch (e) {}
        }
        function bindDelete() {
            body.querySelectorAll('.row-del').forEach(function (btn) {
                btn.onclick = function () {
                    if (!confirm('确定删除该询单记录？')) return;
                    var tr = btn.closest('tr');
                    if (tr) tr.remove();
                    save();
                };
            });
            // 老数据行缺删除列时自动补一列
            body.querySelectorAll('tr').forEach(function (tr) {
                if (tr.children.length < 6) {
                    var td = document.createElement('td');
                    td.style.textAlign = 'center';
                    td.innerHTML = '<button type="button" class="row-del" title="删除此行">🗑</button>';
                    tr.appendChild(td);
                }
            });
        }
        body.addEventListener('input', save);
        body.addEventListener('change', save);
        var moduleBody = table.closest('.module-body');
        var btn = moduleBody ? moduleBody.querySelector('.btn-add-row') : null;
        if (btn) {
            btn.addEventListener('click', function () {
                var row = document.createElement('tr');
                row.innerHTML = getInquiryRowHTML();
                body.appendChild(row);
                bindDelete();
                save();
            });
        }
        bindDelete();
        // 同步询单真实行数到总览快照
        try {
            var rows = body.querySelectorAll('tr');
            var cnt = 0;
            rows.forEach(function (tr) {
                var filled = false;
                tr.querySelectorAll('input, select').forEach(function (inp) { if (inp.value && inp.value.trim()) filled = true; });
                if (filled) cnt++;
            });
            pushOverview({ inquiryTotal: cnt });
        } catch (e) {}
    }

    document.querySelectorAll('.inquiry-table').forEach(initInquiryTable);

    // ---------- 总览数据同步（跨页共享快照 wb_overview） ----------
    function pushOverview(partial) {
        try {
            var ov = JSON.parse(localStorage.getItem('wb_overview') || '{}');
            for (var k in partial) ov[k] = partial[k];
            ov.updatedAt = new Date().toISOString();
            localStorage.setItem('wb_overview', JSON.stringify(ov));
        } catch (e) {}
    }

    // 中国制造网页：核心指标 → 快照 + 顶部大数字同步
    (function () {
        var links = document.getElementById('pfLinks');
        var got = document.getElementById('pfInquiry');
        var vid = document.getElementById('pfVideos');
        var bnLinks = document.getElementById('bnLinks');
        var bnVideos = document.getElementById('bnVideos');
        function sync() {
            var p = {};
            if (links) p.linksDone = parseInt(links.textContent, 10) || 0;
            if (got) p.inquiryGot = parseInt(got.textContent, 10) || 0;
            if (vid) p.videosDone = parseInt(vid.textContent, 10) || 0;
            pushOverview(p);
            if (bnLinks) bnLinks.textContent = p.linksDone;
            if (bnVideos) bnVideos.textContent = p.videosDone;
        }
        if (links || got || vid) {
            sync();
            [links, got, vid].forEach(function (el) {
                if (!el) return;
                el.addEventListener('input', sync);
                el.addEventListener('blur', sync);
            });
        }
    })();

    // 工作日志页：日志条数 → 快照（app.js 在 seed 之前执行，seed 也会再写一次）
    (function () {
        var raw = localStorage.getItem('wb_worklog');
        if (raw) { try { pushOverview({ logCount: JSON.parse(raw).length || 0 }); } catch (e) {} }
    })();

    // 总览页：读取快照填充指标（抽成函数，供同步完成后二次渲染）
    function renderOverview() {
        var ov = {};
        try { ov = JSON.parse(localStorage.getItem('wb_overview') || '{}'); } catch (e) {}
        function setNum(id, val) { var el = document.getElementById(id); if (el) el.innerHTML = val; }
        if (document.getElementById('ovInquiry')) {
            setNum('ovInquiry', (ov.inquiryTotal !== undefined ? ov.inquiryTotal : 6) + ' <small>/ 5</small>');
            setNum('ovLog', (ov.logCount !== undefined ? ov.logCount : 11) + ' <small>天</small>');
            setNum('ovLinks', (ov.linksDone !== undefined ? ov.linksDone : 45) + ' <small>/ 300</small>');
            setNum('ovInquiryGot', (ov.inquiryGot !== undefined ? ov.inquiryGot : 0) + ' <small>/ 10</small>');
            setNum('ovVideos', (ov.videosDone !== undefined ? ov.videosDone : 5) + ' <small>/ 9</small>');
        }
    }
    renderOverview();
    // 同步完成（跨设备数据合并后）重渲染总览数字，避免首屏读到旧 localStorage
    document.addEventListener('wb:synced', renderOverview);

    // ---------- 内容创作：AI文案生成（标题/正文/话题 结构化展示） ----------
    function initCopyCreator() {
        var platformSel = document.getElementById('ccPlatform');
        var langSel = document.getElementById('ccLang');
        var topicInput = document.getElementById('ccTopic');
        var sellingInput = document.getElementById('ccSelling');
        var toneSel = document.getElementById('ccTone');
        var titleBox = document.getElementById('ccTitle');
        var bodyBox = document.getElementById('ccBody');
        var tagsBox = document.getElementById('ccTags');
        var genBtn = document.getElementById('ccGenerate');
        var copyBtn = document.getElementById('ccCopy');
        var chatBtn = document.getElementById('ccChat');
        if (!genBtn || !titleBox || !bodyBox || !tagsBox) return;

        var platformName = { tiktok: 'TikTok', instagram: 'Instagram', facebook: 'Facebook', youtube: 'YouTube', douyin: '抖音', twitter: '推特 X' };

        function tagsZh(topic, platform) {
            var base = '#' + topic.replace(/\s+/g, '') + ' #好物推荐 #种草 #外贸爆品';
            var extra = { tiktok: ' #tiktokfinds #日常好物', instagram: ' #instagood #reels', facebook: ' #分享', youtube: ' #测评 #教程', douyin: ' #抖音好物 #带货', twitter: ' #twitterfinds #tweet' };
            return base + (extra[platform] || '');
        }
        function tagsEn(topic, platform) {
            var t = topic.replace(/\s+/g, '');
            var base = '#' + t + ' #musthave #review #finds';
            var extra = { tiktok: ' #tiktokfinds', instagram: ' #instagood', facebook: ' #share', youtube: ' #howto', douyin: ' #douyin', twitter: ' #twitter' };
            return base + (extra[platform] || '');
        }
        function ctaZh(platform) {
            return {
                tiktok: '👇 主页看同款，评论区扣1优先发链接',
                instagram: '📩 私信拿链接，更多好物在主页',
                facebook: '👍 点赞 + 转发，让更多朋友看到',
                youtube: '🔔 订阅频道，每周更新实测',
                douyin: '👇 左下角小黄车，手慢无',
                twitter: '🔁 转发 + 关注，私信拿链接'
            }[platform] || '👇 主页了解详情';
        }
        function ctaEn(platform) {
            return {
                tiktok: '👇 Link in bio, comment "1" for priority',
                instagram: '📩 DM for the link, more on my page',
                facebook: '👍 Like & share with friends',
                youtube: '🔔 Subscribe for weekly reviews',
                douyin: '👇 Tap the cart, hurry up',
                twitter: '🔁 RT + follow, DM for the link'
            }[platform] || '👇 Check my profile';
        }
        function genZh(platform, topic, points, tone) {
            var pts = points.length ? points.join('，') : '它真的好用到回购';
            var titleMap = {
                hook: '别划走！这款' + topic + '我愿称之为年度宝藏 🔥',
                pro: '深度测评｜' + topic + '到底值不值得买？',
                casual: '日常分享｜最近真的被' + topic + '圈粉了 😌',
                promo: '活动价来了｜' + topic + '闭眼入不亏 💰'
            };
            var bodyMap = {
                hook: '刷到就是缘分！今天按头安利 ' + topic + '。它能做到：' + pts + '。信我，用过就回不去了！',
                pro: '实测下来：' + pts + '。优缺点都摆在这，看完你自己判断。',
                casual: topic + '真的拯救了我的日常 😌 它能做到：' + pts + '，已经回购第N次了。',
                promo: pts + '，现在下单还送福利，手慢无！'
            };
            return {
                title: titleMap[tone] || titleMap.hook,
                body: (bodyMap[tone] || bodyMap.hook) + '\n\n' + ctaZh(platform),
                tags: tagsZh(topic, platform)
            };
        }
        function genEn(platform, topic, points, tone) {
            var pts = points.length ? points.join(', ') : 'it is honestly a game changer';
            var titleMap = {
                hook: 'Stop scrolling! This ' + topic + ' is the BEST find of the year 🔥',
                pro: 'Honest review: Is the ' + topic + ' worth it?',
                casual: 'Daily share｜I am officially obsessed with this ' + topic + ' 😌',
                promo: 'Limited deal｜Grab the ' + topic + ' before it is gone 💰'
            };
            var bodyMap = {
                hook: 'You need this in your life! Today I am obsessed with ' + topic + '. What makes it great: ' + pts + '. Trust me, no regrets!',
                pro: 'Here is the real test: ' + pts + '. Pros and cons all laid out, you decide.',
                casual: topic + ' literally upgraded my daily routine 😌 What makes it great: ' + pts + ', already repurchased.',
                promo: pts + ', grab it now with free gifts while stock lasts!'
            };
            return {
                title: titleMap[tone] || titleMap.hook,
                body: (bodyMap[tone] || bodyMap.hook) + '\n\n' + ctaEn(platform),
                tags: tagsEn(topic, platform)
            };
        }
        function buildCopy() {
            var platform = platformSel.value;
            var lang = langSel.value;
            var topic = (topicInput.value || '').trim() || '你的产品';
            var points = (sellingInput.value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
            var tone = toneSel.value;
            var z = genZh(platform, topic, points, tone);
            if (lang === 'en') { var e = genEn(platform, topic, points, tone); return e; }
            if (lang === 'bi') {
                var e2 = genEn(platform, topic, points, tone);
                return { title: z.title + ' / ' + e2.title, body: z.body + '\n\n——————\n\n' + e2.body, tags: z.tags + '  ' + e2.tags };
            }
            return z;
        }
        function buildChatPrompt() {
            var platform = platformSel.value;
            var lang = langSel.value;
            var tone = toneSel.value;
            var topic = (topicInput.value || '').trim() || '（请自行补充产品/主题）';
            var points = (sellingInput.value || '').split(/[,，]/).map(function (s) { return s.trim(); }).filter(Boolean);
            var toneZh = { hook: '吸睛种草', pro: '专业测评', casual: '轻松日常', promo: '促销转化' }[tone] || '自然';
            var langZh = { zh: '中文', en: '英文', bi: '中英双语' }[lang] || '中文';
            var pts = points.length ? points.join('、') : '（用户未填写，请自行发挥）';
            return '你是一名资深跨境电商内容运营，请为 ' + platformName[platform] + ' 平台撰写一条' + langZh + '营销文案。\n' +
                '产品/主题：' + topic + '\n' +
                '核心卖点：' + pts + '\n' +
                '文案风格：' + toneZh + '\n' +
                '要求：符合该平台用户习惯与语气，包含吸引点击的标题、清晰正文卖点、行动号召（CTA）和合适的话题标签，篇幅适合 ' + platformName[platform] + '。直接输出文案，不要解释。';
        }
        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () { flash(copyBtn, '✅ 已复制'); }, function () { fallbackCopy(text); });
            } else { fallbackCopy(text); }
        }
        function fallbackCopy(text) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
                flash(copyBtn, '✅ 已复制');
            } catch (e) { flash(copyBtn, '⚠️ 请手动复制'); }
        }
        function flash(btn, msg) {
            var old = btn.textContent;
            btn.textContent = msg;
            setTimeout(function () { btn.textContent = old; }, 1300);
        }

        genBtn.addEventListener('click', function () {
            var c = buildCopy();
            titleBox.value = c.title; bodyBox.value = c.body; tagsBox.value = c.tags;
            titleBox.focus();
        });
        copyBtn.addEventListener('click', function () {
            var t = [titleBox.value, bodyBox.value, tagsBox.value].map(function (x) { return (x || '').trim(); }).filter(Boolean).join('\n\n');
            if (!t) { flash(copyBtn, '⚠️ 先生成'); return; }
            copyText(t);
        });
        chatBtn.addEventListener('click', function () {
            copyText(buildChatPrompt());
            window.open('https://chat.openai.com/', '_blank', 'noopener');
        });
    }
    initCopyCreator();

    // 侧边栏实时时钟（日期+时间，精确到秒）
    (function () {
        var el = document.getElementById('sidebarClock');
        if (!el) return;
        function pad(n) { return n < 10 ? '0' + n : '' + n; }
        function tick() {
            var d = new Date();
            el.textContent = d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()) +
                ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds());
        }
        tick();
        setInterval(tick, 1000);
    })();

    // 刷新按钮：强制绕过缓存，拉取最新文件
    var refreshBtn = document.getElementById('refreshBtn');
    if (refreshBtn) refreshBtn.addEventListener('click', function () {
        var base = location.href.split('?')[0];
        location.href = base + '?_t=' + Date.now();
    });

    // 深/浅色切换
    var themeBtn = document.getElementById('themeBtn');
    function applyTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            if (themeBtn) themeBtn.textContent = '🌞 浅色';
        } else {
            document.documentElement.setAttribute('data-theme', 'light');
            if (themeBtn) themeBtn.textContent = '🌓 深色';
        }
    }
    var savedTheme = 'light';
    try { savedTheme = localStorage.getItem('wb_theme') || 'light'; } catch (e) {}
    applyTheme(savedTheme);
    if (themeBtn) themeBtn.addEventListener('click', function () {
        var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
        applyTheme(next);
        try { localStorage.setItem('wb_theme', next); } catch (e) {}
    });

    // 模块折叠 / 展开（点击 .module-toggle 收起对应 .module-body）
    document.querySelectorAll('.module-toggle').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var header = btn.closest('.module-header');
            var body = header ? header.nextElementSibling : null;
            if (!body || !body.classList.contains('module-body')) return;
            var collapsed = body.classList.toggle('collapsed');
            btn.classList.toggle('collapsed', collapsed);
            btn.textContent = collapsed ? '▸' : '▾';
        });
    });

    // 共享空间（任意门）：一键打开文件资源管理器
    // - 本地以 file:// 打开时：直接唤起资源管理器跳转到对应文件夹（真正一键打开）
    // - 通过 https 分享链接打开时：浏览器出于安全会拦截 file:// 跳转，因此直接尝试跳转 +
    //   复制路径，并提示用本地启动器以获得一键打开体验（不弹出下载）
    // 使用事件委托，兼容动态新增的链接
    (function () {
        function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }
        function toast(msg, ms) {
            var t = document.getElementById('wbToast');
            if (!t) {
                t = document.createElement('div');
                t.id = 'wbToast';
                t.style.cssText = 'position:fixed;left:50%;bottom:28px;transform:translateX(-50%);' +
                    'background:rgba(20,28,40,.94);color:#fff;padding:12px 18px;border-radius:10px;' +
                    'font-size:13px;max-width:86vw;z-index:9999;box-shadow:0 8px 24px rgba(0,0,0,.25);' +
                    'opacity:0;transition:opacity .2s;pointer-events:none;line-height:1.6;';
                document.body.appendChild(t);
            }
            t.innerHTML = msg;
            t.style.opacity = '1';
            clearTimeout(t._timer);
            t._timer = setTimeout(function () { t.style.opacity = '0'; }, ms || 4600);
        }
        function fallbackCopy(text) {
            try {
                var ta = document.createElement('textarea');
                ta.value = text; document.body.appendChild(ta); ta.select();
                document.execCommand('copy'); document.body.removeChild(ta);
            } catch (e) {}
        }
        function copyText(text) {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(text).then(function () {}, function () { fallbackCopy(text); });
            } else { fallbackCopy(text); }
        }

        document.addEventListener('click', function (e) {
            var a = e.target.closest('.file-link');
            if (!a) return;
            e.preventDefault();
            var url = a.getAttribute('href') || '';
            var unc = url.replace(/^file:\/\//, '\\\\').replace(/\//g, '\\');
            copyText(unc);
            // 直接尝试唤起资源管理器（本地 file:// 打开时生效，即真正一键打开）
            try { window.location.href = url; } catch (err) {}
            if (location.protocol !== 'file:') {
                toast('📋 路径已复制。用「打开工作台(本地).bat」启动本页，点击即可<strong>直接打开</strong>资源管理器', 5000);
            }
        });
    })();

    // 通用：可编辑文本持久化（通过 data-store 指定 localStorage 键）
    document.querySelectorAll('[contenteditable][data-store]').forEach(function (el) {
        var key = el.getAttribute('data-store');
        try { var v = localStorage.getItem(key); if (v !== null) el.innerHTML = v; } catch (e) {}
        el.addEventListener('input', function () {
            try { localStorage.setItem(key, el.innerHTML); } catch (e) {}
        });
    });

    // ========== 数据同步 / 跨电脑备份（导出 / 导入 JSON） ==========
    // 数据默认只存在本机浏览器（localStorage + IndexedDB），换电脑看不到。
    // 导出：把所有工作台数据打包成一个 JSON 文件；导入：在另一台电脑恢复，
    // 也可把该文件放进云盘随时同步。
    (function () {
        var SYNC_PREFIX = ['wb_', 'workbench_'];
        function isWbKey(k) {
            for (var i = 0; i < SYNC_PREFIX.length; i++) if (k.indexOf(SYNC_PREFIX[i]) === 0) return true;
            return false;
        }
        function pad(n) { return (n < 10 ? '0' : '') + n; }
        function tsName() {
            var d = new Date();
            return '工作台数据备份_' + d.getFullYear() + pad(d.getMonth() + 1) + pad(d.getDate()) + '_' + pad(d.getHours()) + pad(d.getMinutes()) + '.json';
        }
        function collectLS() {
            var out = {};
            try {
                for (var i = 0; i < localStorage.length; i++) {
                    var k = localStorage.key(i);
                    if (isWbKey(k)) { try { out[k] = localStorage.getItem(k); } catch (e) {} }
                }
            } catch (e) {}
            return out;
        }
        function openDB() {
            return new Promise(function (resolve, reject) {
                if (!window.indexedDB) { reject(); return; }
                var r = indexedDB.open('wb_files_db', 1);
                r.onupgradeneeded = function (e) {
                    var d = e.target.result;
                    if (!d.objectStoreNames.contains('files')) d.createObjectStore('files', { keyPath: 'id' });
                };
                r.onsuccess = function (e) { resolve(e.target.result); };
                r.onerror = function () { reject(); };
            });
        }
        function collectFiles() {
            return new Promise(function (resolve) {
                openDB().then(function (db) {
                    try {
                        var tx = db.transaction('files', 'readonly');
                        var cur = tx.objectStore('files').openCursor();
                        var out = [];
                        cur.onsuccess = function (e) {
                            var c = e.target.result;
                            if (c) { out.push(c.value); c.continue(); } else resolve(out);
                        };
                        cur.onerror = function () { resolve(out); };
                    } catch (e) { resolve([]); }
                }).catch(function () { resolve([]); });
            });
        }
        function exportAll() {
            collectFiles().then(function (files) {
                var data = {
                    app: 'personal-workbench', version: 1,
                    exportedAt: new Date().toISOString(),
                    localStorage: collectLS(), files: files
                };
                var name = tsName();
                var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                var url = URL.createObjectURL(blob);
                var a = document.createElement('a');
                a.href = url; a.download = name;
                document.body.appendChild(a); a.click(); a.remove();
                setTimeout(function () { try { URL.revokeObjectURL(url); } catch (e) {} }, 2000);
                setStatus('✅ 已导出：' + name + '（含 ' + files.length + ' 个文件、' + Object.keys(data.localStorage).length + ' 项数据），复制到另一台电脑后「导入备份」即可', true);
            });
        }
        function importAll(file) {
            return new Promise(function (resolve, reject) {
                var reader = new FileReader();
                reader.onload = function () {
                    try {
                        var data = JSON.parse(reader.result);
                        if (!data || !data.localStorage) { reject(new Error('文件格式不正确')); return; }
                        Object.keys(data.localStorage).forEach(function (k) {
                            try { localStorage.setItem(k, data.localStorage[k]); } catch (e) {}
                        });
                        var files = data.files || [];
                        if (!files.length) { resolve(); return; }
                        openDB().then(function (db) {
                            var tx = db.transaction('files', 'readwrite');
                            var store = tx.objectStore('files');
                            files.forEach(function (rec) { try { store.put(rec); } catch (e) {} });
                            tx.oncomplete = function () { resolve(); };
                            tx.onerror = function () { resolve(); };
                        }).catch(function () { resolve(); });
                    } catch (e) { reject(e); }
                };
                reader.onerror = function () { reject(reader.error); };
                reader.readAsText(file);
            });
        }

        // ---- UI ----
        var modal, statusEl;
        function setStatus(msg, ok) {
            if (!statusEl) return;
            statusEl.innerHTML = msg;
            statusEl.className = 'sync-status' + (ok ? ' ok' : ' err');
        }
        function openModal() { if (modal) modal.style.display = 'flex'; }
        function closeModal() { if (modal) modal.style.display = 'none'; }
        function buildUI() {
            var actions = document.querySelector('.sidebar-actions');
            if (actions && !document.getElementById('syncBtn')) {
                var b = document.createElement('button');
                b.className = 'sidebar-btn'; b.id = 'syncBtn';
                b.title = '数据备份 / 同步到其他电脑';
                b.textContent = '🔄 数据同步';
                b.addEventListener('click', openModal);
                actions.appendChild(b);
            }
            if (document.getElementById('syncModal')) { modal = document.getElementById('syncModal'); statusEl = document.getElementById('syncStatus'); return; }
            modal = document.createElement('div');
            modal.id = 'syncModal'; modal.className = 'sync-modal-overlay';
            modal.innerHTML =
                '<div class="sync-card">' +
                '  <div class="sync-head"><span>🔄 数据同步 · 跨电脑备份</span><button class="sync-close" id="syncClose" title="关闭">✕</button></div>' +
                '  <div class="sync-body">' +
                '    <p class="sync-tip">数据默认只存在<strong>本机浏览器</strong>，换电脑打开会看不到。点「导出备份」下载一份 JSON，复制到另一台电脑后点「导入备份」即可恢复全部数据；也可把该文件放进云盘随时同步。</p>' +
                '    <div class="sync-actions">' +
                '      <button class="sync-btn sync-export" id="syncExport">⬇️ 导出备份（下载 JSON）</button>' +
                '      <button class="sync-btn sync-import" id="syncImport">⬆️ 导入备份（选择文件）</button>' +
                '      <input type="file" id="syncFile" accept="application/json,.json" hidden>' +
                '    </div>' +
                '    <div class="sync-status" id="syncStatus"></div>' +
                '  </div>' +
                '</div>';
            document.body.appendChild(modal);
            statusEl = document.getElementById('syncStatus');
            document.getElementById('syncClose').addEventListener('click', closeModal);
            modal.addEventListener('click', function (e) { if (e.target === modal) closeModal(); });
            document.getElementById('syncExport').addEventListener('click', function () {
                try { exportAll(); } catch (e) { setStatus('❌ 导出失败：' + (e && e.message || e), false); }
            });
            document.getElementById('syncImport').addEventListener('click', function () { document.getElementById('syncFile').click(); });
            document.getElementById('syncFile').addEventListener('change', function (e) {
                var f = e.target.files && e.target.files[0];
                if (!f) return;
                if (!confirm('导入会覆盖本机现有同名数据，确定继续？\n（建议先点「导出备份」留一份当前数据）')) { e.target.value = ''; return; }
                setStatus('⏳ 正在导入：' + f.name + ' …', true);
                importAll(f).then(function () {
                    setStatus('✅ 导入完成，即将刷新页面以加载数据…', true);
                    setTimeout(function () { location.reload(); }, 900);
                }).catch(function (err) {
                    setStatus('❌ 导入失败：' + (err && err.message || err), false);
                    e.target.value = '';
                });
            });
        }
        if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildUI);
        else buildUI();
    })();

    console.log('🚀 多页面工作台已加载 | 数据自动保存已启用');

    // ---------- 顶部「当前分享链接」小条（自动拉取服务端维护的公网链接） ----------
    (function () {
        try {
            var bar = document.createElement('div');
            bar.className = 'share-bar';
            bar.innerHTML = '<span class="share-bar-label">🌐 当前分享链接</span>' +
                '<a class="share-bar-link" target="_blank" rel="noopener"></a>' +
                '<button class="share-bar-copy" type="button">复制</button>';
            document.body.appendChild(bar);
            var linkEl = bar.querySelector('.share-bar-link');
            var copyBtn = bar.querySelector('.share-bar-copy');
            var lastLink = '';

            function render(link) {
                if (link && link !== lastLink) {
                    lastLink = link;
                    linkEl.href = link;
                    linkEl.textContent = link.replace(/^https?:\/\//, '');
                    bar.style.display = 'flex';
                } else if (!link) {
                    bar.style.display = 'none';
                }
            }

            copyBtn.addEventListener('click', function () {
                if (!lastLink) return;
                var done = function () { copyBtn.textContent = '已复制'; setTimeout(function () { copyBtn.textContent = '复制'; }, 1500); };
                if (navigator.clipboard && navigator.clipboard.writeText) {
                    navigator.clipboard.writeText(lastLink).then(done, function () { fallbackCopy(lastLink); done(); });
                } else { fallbackCopy(lastLink); done(); }
            });

            function fallbackCopy(text) {
                try {
                    var ta = document.createElement('textarea');
                    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
                    document.body.appendChild(ta); ta.select();
                    document.execCommand('copy'); document.body.removeChild(ta);
                } catch (e) {}
            }

            function fetchLink() {
                try {
                    var xhr = new XMLHttpRequest();
                    xhr.open('GET', '/api/link', true);
                    xhr.onreadystatechange = function () {
                        if (xhr.readyState === 4) {
                            if (xhr.status === 200) {
                                try { render(JSON.parse(xhr.responseText).link || ''); }
                                catch (e) { render(''); }
                            } else { render(''); }
                            setTimeout(fetchLink, 30000); // 每 30s 刷新一次当前链接
                        }
                    };
                    xhr.send();
                } catch (e) { setTimeout(fetchLink, 30000); }
            }
            fetchLink();
        } catch (e) {}
    })();
})();
