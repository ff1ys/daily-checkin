/* 每日打卡 · 界面与交互 */
(function () {
  'use strict';

  var S = window.Store;
  if (!S) return;

  /* ================= 小工具 ================= */
  var WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  var WEEK1 = ['日', '一', '二', '三', '四', '五', '六'];

  function pad2(n) { return String(n).padStart(2, '0'); }
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function todayKey() { return S.dateKey(new Date()); }

  function hms(sec) {
    sec = Math.max(0, Math.floor(Number(sec) || 0));
    var h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
    return pad2(h) + ':' + pad2(m) + ':' + pad2(s);
  }
  function humanDur(sec) {
    sec = Math.max(0, Math.round(Number(sec) || 0));
    if (sec < 60) return sec + ' 秒';
    var m = Math.round(sec / 60);
    if (m < 60) return m + ' 分钟';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' 小时' + (r ? ' ' + r + ' 分' : '');
  }
  function timeText(ts) {
    var d = new Date(ts);
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }
  function dateLabel(key) {
    if (!key) return '';
    var tk = todayKey();
    if (key === tk) return '今天';
    if (key === S.dateKey(S.addDays(new Date(), -1))) return '昨天';
    var d = S.fromKey(key);
    var md = (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日';
    if (d.getFullYear() !== new Date().getFullYear()) return d.getFullYear() + ' 年 ' + md;
    return md;
  }
  function greet() {
    var h = new Date().getHours();
    if (h < 5) return '凌晨好';
    if (h < 11) return '早上好';
    if (h < 14) return '中午好';
    if (h < 18) return '下午好';
    return '晚上好';
  }
  function lastDays(n) {
    var out = [];
    for (var i = n - 1; i >= 0; i--) {
      var d = S.addDays(new Date(), -i);
      out.push({ key: S.dateKey(d), d: d });
    }
    return out;
  }
  function haptic() {
    try { if (navigator.vibrate) navigator.vibrate(8); } catch (e) { /* ignore */ }
  }

  var toastTimer = null;
  function toast(msg) {
    var el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.classList.remove('show'); }, 1900);
  }

  /* ================= 图标 ================= */
  var ICON = {
    today: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2.6v2M12 19.4v2M2.6 12h2M19.4 12h2M5.2 5.2l1.4 1.4M17.4 17.4l1.4 1.4M18.8 5.2l-1.4 1.4M6.6 17.4l-1.4 1.4"/></svg>',
    study: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7.2v5.1l3.2 2"/></svg>',
    words: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 6.6C10.2 4.9 7 4.4 4.5 4.6v13.6c2.5-.2 5.7.3 7.5 2 1.8-1.7 5-2.2 7.5-2V4.6c-2.5-.2-5.7.3-7.5 2z"/><path d="M12 6.6v13.6"/></svg>',
    water: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2s5.8 6.2 5.8 10.2a5.8 5.8 0 0 1-11.6 0C6.2 9.4 12 3.2 12 3.2z"/></svg>',
    me: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="8.2" r="3.6"/><path d="M4.8 20c1.1-3.7 3.8-5.4 7.2-5.4s6.1 1.7 7.2 5.4"/></svg>',
    search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4 4"/></svg>'
  };

  /* ================= 状态 ================= */
  var ui = { tab: 'today', filter: 'all', q: '', review: null };

  /* ================= 弹层 ================= */
  var sheetEl = null;

  function openSheet(title, body, footer, onMount) {
    closeSheet();
    var wrap = document.createElement('div');
    wrap.className = 'sheet-wrap';
    wrap.innerHTML = '<div class="sheet" role="dialog" aria-modal="true">' +
      '<div class="sheet-grip"></div>' +
      (title ? '<div class="sheet-head"><h2>' + esc(title) + '</h2><button class="icon-btn" data-act="sheet-close" aria-label="关闭">✕</button></div>' : '') +
      '<div class="sheet-body">' + body + '</div>' +
      (footer ? '<div class="sheet-foot">' + footer + '</div>' : '') +
      '</div>';
    document.getElementById('overlay-root').appendChild(wrap);
    sheetEl = wrap;
    document.body.classList.add('locked');
    wrap.addEventListener('click', function (e) { if (e.target === wrap) closeSheet(); });
    if (onMount) onMount(wrap.querySelector('.sheet'));
    var first = wrap.querySelector('input:not([type=date]), textarea');
    if (first) setTimeout(function () { first.focus(); }, 160);
  }

  function closeSheet() {
    if (sheetEl && sheetEl.parentNode) sheetEl.parentNode.removeChild(sheetEl);
    sheetEl = null;
    if (!ui.review) document.body.classList.remove('locked');
  }

  function confirmSheet(title, desc, okText, onOk) {
    openSheet('', '<div class="confirm"><h3>' + esc(title) + '</h3><p>' + esc(desc) + '</p></div>',
      '<div class="sheet-actions"><button class="btn flex1" data-act="sheet-close">取消</button><button class="btn danger flex1" id="confirm-ok">' + esc(okText) + '</button></div>',
      function (panel) {
        $('#confirm-ok', panel).addEventListener('click', function () {
          closeSheet();
          onOk();
        });
      });
  }

  /* ================= 主渲染 ================= */
  var views = { today: viewToday, study: viewStudy, words: viewWords, water: viewWater, me: viewMe };

  function render() {
    applyTheme();
    var snap = snapshotForm();
    $$('.view').forEach(function (v) {
      v.classList.toggle('active', v.dataset.view === ui.tab);
    });
    var root = $('[data-view="' + ui.tab + '"]');
    if (root) root.innerHTML = views[ui.tab]();
    renderTabbar();
    restoreForm(snap);
    syncTicker();
    updateLive();
  }

  function snapshotForm() {
    var snap = { active: null, values: {} };
    var ae = document.activeElement;
    $$('input, textarea, select').forEach(function (n) {
      var key = n.id || n.name;
      if (!key) return;
      snap.values[key] = n.type === 'checkbox' ? n.checked : n.value;
      if (n === ae) {
        snap.active = { key: key, start: n.selectionStart, end: n.selectionEnd };
      }
    });
    return snap;
  }

  function restoreForm(snap) {
    var root = $('[data-view="' + ui.tab + '"]');
    if (!root) return;
    Object.keys(snap.values).forEach(function (k) {
      var n = null;
      try { n = root.querySelector('#' + CSS.escape(k)) || root.querySelector('[name="' + CSS.escape(k) + '"]'); } catch (e) { n = null; }
      if (!n) return;
      if (n.type === 'checkbox') n.checked = !!snap.values[k];
      else if (n.value !== snap.values[k]) n.value = snap.values[k];
    });
    if (snap.active) {
      var el = null;
      try { el = root.querySelector('#' + CSS.escape(snap.active.key)); } catch (e) { el = null; }
      if (el) {
        el.focus({ preventScroll: true });
        try { el.setSelectionRange(snap.active.start, snap.active.end); } catch (e) { /* ignore */ }
      }
    }
  }

  function applyTheme() {
    var th = S.state.settings.theme;
    document.documentElement.dataset.theme = th === 'auto' ? '' : th;
  }

  function renderTabbar() {
    var items = [
      ['today', '今日', ICON.today],
      ['study', '学习', ICON.study],
      ['words', '单词', ICON.words],
      ['water', '喝水', ICON.water],
      ['me', '我的', ICON.me]
    ];
    $('#tabbar').innerHTML = items.map(function (it) {
      return '<button class="tab' + (ui.tab === it[0] ? ' on' : '') + '" data-act="tab" data-tab="' + it[0] + '" aria-label="' + it[1] + '">' +
        '<span class="tab-ico">' + it[2] + '</span><span class="tab-txt">' + it[1] + '</span></button>';
    }).join('');
  }

  /* ================= 今日 ================= */
  function viewToday() {
    var tk = todayKey();
    var cfg = S.state.settings;
    var t = S.state.timer;
    var pending = S.timerElapsed();
    var total = S.dayStudy(tk) + pending;
    var goalSec = Math.max(60, cfg.studyGoal * 60);
    var pct = Math.min(100, Math.round(total / goalSec * 100));
    var cups = S.dayWaterCups(tk);
    var ml = S.dayWaterMl(tk);
    var wordsToday = S.state.words.filter(function (w) { return S.dateKey(new Date(w.addedAt)) === tk; }).length;
    var due = S.dueWords().length;
    var streak = S.streak();
    var d = new Date();
    var content = String(t.content || '').trim();

    var hero;
    if (t.running) {
      hero = '<div class="hero-top"><span class="hero-label">正在学习 · ' + esc(t.subject) + '</span><span>' + (t.mode === 'pomodoro' ? '番茄钟' : '正计时') + '</span></div>' +
        '<div class="hero-time" data-live="today">' + hms(total) + '</div>' +
        '<div class="hero-sub">本次 <span data-live="session">' + hms(pending) + '</span>' + (content ? ' · ' + esc(content) : '') + '</div>' +
        '<div class="hero-actions"><button class="btn white" data-act="timer-pause">⏸ 暂停</button><button class="btn solid" data-act="timer-finish">✓ 结束保存</button></div>';
    } else if (t.accum > 0) {
      hero = '<div class="hero-top"><span class="hero-label">未保存的计时</span><span>' + esc(t.subject) + '</span></div>' +
        '<div class="hero-time" data-live="today">' + hms(total) + '</div>' +
        '<div class="hero-sub">本次 <span data-live="session">' + hms(pending) + '</span>' + (content ? ' · ' + esc(content) : '') + '</div>' +
        '<div class="hero-actions"><button class="btn white" data-act="timer-start">▶ 继续</button><button class="btn solid" data-act="timer-finish">✓ 结束保存</button></div>';
    } else {
      hero = '<div class="hero-top"><span class="hero-label">今日学习</span><span>目标 ' + cfg.studyGoal + ' 分钟</span></div>' +
        '<div class="hero-time" data-live="today">' + hms(total) + '</div>' +
        '<div class="hero-bar"><i style="width:' + pct + '%"></i></div>' +
        '<div class="hero-meta"><span>' + (pct >= 100 ? '今日目标已达成 🎉' : '完成 ' + pct + '%') + '</span><span>' +
        (pct >= 100 ? '保持住' : '还差 ' + humanDur(goalSec - total)) + '</span></div>' +
        '<div class="hero-actions"><button class="btn solid" data-act="timer-start">▶ 开始学习</button><button class="btn white" data-act="manual-open">补记一笔</button></div>';
    }

    var dots = '';
    var dotN = Math.min(10, Math.max(cups, cfg.waterGoal));
    for (var i = 0; i < dotN; i++) dots += '<i class="' + (i < cups ? 'on' : '') + '"></i>';

    var sessions = S.day(tk).sessions.slice().sort(function (a, b) { return b.start - a.start; });
    var waterEntries = S.day(tk).water;
    var timeline = '';
    if (waterEntries.length) {
      var lastAt = waterEntries[waterEntries.length - 1].at;
      timeline += rowHTML('💧', cups + ' 杯水', '共 ' + ml + ' ml · 最近 ' + timeText(lastAt), '', 'water');
    }
    sessions.forEach(function (s) {
      timeline += rowHTML(esc((s.subject || '学').slice(0, 1)), esc(s.content || s.subject), esc(s.subject) + ' · ' + timeText(s.start) + ' – ' + timeText(s.end), humanDur(s.sec), 'study');
    });
    if (!timeline) {
      timeline = '<div class="empty"><div class="big">🌱</div><b>今天还没有记录</b>点上面的按钮，开始第一段学习吧</div>';
    }

    return '' +
      '<header class="hello">' +
      '  <div><div class="date">' + (d.getMonth() + 1) + ' 月 ' + d.getDate() + ' 日 · ' + WEEK[d.getDay()] + '</div>' +
      '  <h1>' + greet() + '</h1><p>' + (pct >= 100 && cups >= cfg.waterGoal ? '今天的目标都完成了，了不起' : '今天也进步一点点') + '</p></div>' +
      (streak > 0 ? '<div class="streak">🔥 连续 ' + streak + ' 天</div>' : '') +
      '</header>' +
      '<section class="hero">' + hero + '</section>' +
      '<div class="grid2" style="margin-top:12px">' +
      '  <div class="card mini" data-act="tab" data-tab="water">' +
      '    <div class="mini-top"><span>喝水</span><span class="mini-ico water">💧</span></div>' +
      '    <div class="mini-num">' + cups + '<small>/ ' + cfg.waterGoal + ' 杯</small></div>' +
      '    <div class="dots">' + dots + '</div>' +
      '    <button class="mini-btn" data-act="water-add">+ 1 杯 · ' + cfg.cupMl + 'ml</button>' +
      '  </div>' +
      '  <div class="card mini" data-act="tab" data-tab="words">' +
      '    <div class="mini-top"><span>单词</span><span class="mini-ico amber">Aa</span></div>' +
      '    <div class="mini-num">' + wordsToday + '<small>今日新增</small></div>' +
      '    <div class="mini-sub">待复习 ' + due + ' 个</div>' +
      '    <button class="mini-btn amber" data-act="' + (due ? 'review-start' : 'word-add') + '">' + (due ? '去复习' : '添加生词') + '</button>' +
      '  </div>' +
      '</div>' +
      '<div class="sec"><b>今日记录</b><button class="link" data-act="manual-open">+ 补记</button></div>' +
      '<div class="card list-card">' + timeline + '</div>' +
      '<div class="sec"><b>今日小结</b><span>保持节奏</span></div>' +
      '<div class="stats">' +
      stat('学习时长', Math.round(total / 60), '分钟') +
      stat('喝水', cups, '杯') +
      stat('新词', wordsToday, '个') +
      stat('待复习', due, '个') +
      '</div>';
  }

  function rowHTML(ico, title, sub, right, kind) {
    return '<div class="row">' +
      '<div class="row-ico ' + (kind || '') + '">' + ico + '</div>' +
      '<div class="row-main"><div class="row-title">' + title + '</div><div class="row-sub">' + (sub || '') + '</div></div>' +
      (right ? '<div class="row-val">' + right + '</div>' : '') +
      '</div>';
  }

  function stat(k, v, unit) {
    return '<div class="stat"><div class="k">' + k + '</div><div class="v">' + v + '<small>' + unit + '</small></div></div>';
  }

  /* ================= 学习 ================= */
  function viewStudy() {
    var t = S.state.timer;
    var elapsed = S.timerElapsed();
    var isPomo = t.mode === 'pomodoro';
    var display = isPomo ? Math.max(0, t.target - elapsed) : elapsed;
    var subj = t.subject || S.state.settings.lastSubject || '英语';
    var content = String(t.content || '');

    var subjChips = S.state.settings.subjects.map(function (s) {
      return '<button class="chip' + (s === subj ? ' on' : '') + '" data-act="subject" data-name="' + esc(s) + '">' + esc(s) + '</button>';
    }).join('');

    var targetChips = [15, 25, 45].map(function (m) {
      return '<button class="chip' + (t.target === m * 60 ? ' on' : '') + '" data-act="target" data-sec="' + (m * 60) + '">' + m + ' 分钟</button>';
    }).join('');

    var actions;
    if (t.running) {
      actions = '<button class="btn ghost" data-act="timer-pause">⏸ 暂停</button><button class="btn primary" data-act="timer-finish">结束并保存</button>';
    } else if (t.accum > 0) {
      actions = '<button class="btn ghost" data-act="timer-start">▶ 继续</button><button class="btn primary" data-act="timer-finish">结束并保存</button>';
    } else {
      actions = '<button class="btn primary block" data-act="timer-start">▶ 开始计时</button>';
    }

    var groups = Object.keys(S.state.days).filter(function (k) {
      return (S.state.days[k].sessions || []).length;
    }).sort(function (a, b) { return a < b ? 1 : -1; }).slice(0, 20);

    var history = groups.map(function (k) {
      var list = S.state.days[k].sessions.slice().sort(function (a, b) { return b.start - a.start; });
      return '<div class="day-group">' +
        '<div class="day-head"><b>' + dateLabel(k) + '</b><span>' + humanDur(S.dayStudy(k)) + ' · ' + list.length + ' 段</span></div>' +
        '<div class="card list-card">' + list.map(function (s) {
          return '<div class="row tap" data-act="session-open" data-day="' + k + '" data-id="' + s.id + '">' +
            '<div class="row-ico">' + esc((s.subject || '学').slice(0, 1)) + '</div>' +
            '<div class="row-main"><div class="row-title">' + esc(s.content || s.subject) + '</div>' +
            '<div class="row-sub">' + esc(s.subject) + ' · ' + timeText(s.start) + ' – ' + timeText(s.end) + '</div></div>' +
            '<div class="row-val">' + humanDur(s.sec) + '</div></div>';
        }).join('') + '</div></div>';
    }).join('');

    if (!history) {
      history = '<div class="empty"><div class="big">📖</div><b>还没有学习记录</b>用上面的计时器，或手动补记一笔</div>';
    }

    return '' +
      '<div class="page-head"><h1>学习</h1><span class="sub">计时 · 记录内容</span></div>' +
      '<section class="card timer-card">' +
      '<div class="seg">' +
      '<button class="seg-btn' + (!isPomo ? ' on' : '') + '" data-act="mode" data-mode="stopwatch">正计时</button>' +
      '<button class="seg-btn' + (isPomo ? ' on' : '') + '" data-act="mode" data-mode="pomodoro">番茄钟</button>' +
      '</div>' +
      '<div class="timer-time' + (isPomo ? ' small' : '') + '" data-live="study">' + hms(display) + '</div>' +
      '<div class="timer-hint">' + (isPomo
        ? (t.running ? '专注中，倒计时结束会自动记录' : '倒计时 ' + Math.round(t.target / 60) + ' 分钟，专注一段时间')
        : (t.running ? '正在计时，可以切到别的页面' : (t.accum > 0 ? '已暂停，继续或保存' : '准备好就开始吧'))) + '</div>' +
      (isPomo && !t.running ? '<div class="chips" style="justify-content:center;margin-bottom:6px">' + targetChips + '</div>' : '') +
      '<div class="chips timer-subject">' + subjChips + '</div>' +
      '<input class="input" id="timer-content" placeholder="在学什么？（可选）例：精读 Unit 3 课文，整理 20 个生词" value="' + esc(content) + '" maxlength="80">' +
      '<div class="timer-actions">' + actions + '</div>' +
      '</section>' +
      '<button class="btn ghost block" style="margin-top:12px" data-act="manual-open">＋ 手动补记一段</button>' +
      '<div class="sec"><b>学习记录</b><span>' + S.studyDayCount() + ' 天 · 共 ' + humanDur(S.totalStudySec()) + '</span></div>' +
      history +
      '<div style="height:8px"></div>';
  }

  /* ================= 单词本 ================= */
  function viewWords() {
    var all = S.state.words;
    var due = S.dueWords();
    var mastered = all.filter(function (w) { return w.status === 'mastered'; }).length;

    var filters = [
      ['all', '全部 ' + all.length],
      ['due', '待复习 ' + due.length],
      ['new', '生词 ' + all.filter(function (w) { return w.status === 'new'; }).length],
      ['mastered', '已掌握 ' + mastered]
    ];
    var chips = filters.map(function (f) {
      return '<button class="chip' + (ui.filter === f[0] ? ' on' : '') + '" data-act="filter" data-f="' + f[0] + '">' + f[1] + '</button>';
    }).join('');

    return '' +
      '<div class="page-head"><h1>单词本</h1><span class="sub">' + all.length + ' 个词</span></div>' +
      '<div class="word-tools">' +
      '<button class="btn primary flex1" data-act="' + (due.length ? 'review-start' : 'word-add') + '">' + (due.length ? '开始复习 · ' + due.length + ' 个' : '＋ 添加生词') + '</button>' +
      '<button class="btn ghost" data-act="word-add" aria-label="添加单词">＋</button>' +
      '</div>' +
      '<div class="search" style="margin-bottom:10px">' + ICON.search +
      '<input id="word-q" placeholder="搜索单词、释义或标签" value="' + esc(ui.q) + '" autocomplete="off">' +
      '</div>' +
      '<div class="chips" style="margin-bottom:12px">' + chips + '</div>' +
      '<div id="word-list">' + wordListHTML() + '</div>' +
      '<div style="height:8px"></div>';
  }

  function wordListHTML() {
    var q = String(ui.q || '').trim().toLowerCase();
    var list = S.state.words.filter(function (w) {
      if (ui.filter === 'due') { if (w.status === 'mastered' || (w.due && w.due > todayKey())) return false; }
      if (ui.filter === 'new' && w.status !== 'new') return false;
      if (ui.filter === 'mastered' && w.status !== 'mastered') return false;
      if (!q) return true;
      return (w.word + ' ' + w.def + ' ' + w.phonetic + ' ' + w.tags.join(' ')).toLowerCase().indexOf(q) >= 0;
    });
    list.sort(function (a, b) { return b.addedAt - a.addedAt; });

    if (!list.length) {
      var msg = S.state.words.length
        ? '<div class="empty"><div class="big">🔍</div><b>没有匹配的单词</b>换个关键词试试</div>'
        : '<div class="empty"><div class="big">📒</div><b>单词本还是空的</b>遇到不认识的词，随手记下来<br>复习时它会自己出现</div>';
      return msg;
    }

    return list.map(function (w) {
      var badge = w.status === 'mastered' ? '<span class="badge mastered">已掌握</span>'
        : (w.status === 'new' ? '<span class="badge">生词</span>' : '<span class="badge learning">复习中</span>');
      if (w.status !== 'mastered' && (!w.due || w.due <= todayKey())) badge = '<span class="badge due">待复习</span>';
      return '<button class="word-row" data-act="word-open" data-id="' + w.id + '">' +
        '<div class="wr-main">' +
        '<div class="wr-top"><span class="wr-word">' + esc(w.word) + '</span>' +
        (w.phonetic ? '<span class="wr-ph">/' + esc(w.phonetic) + '/</span>' : '') + '</div>' +
        '<div class="wr-def">' + esc(w.def || '（暂无释义）') + '</div>' +
        '</div>' + badge + '</button>';
    }).join('');
  }

  function dueText(w) {
    if (w.status === 'mastered') return '已掌握';
    if (!w.due || w.due <= todayKey()) return '今天';
    if (w.due === S.dateKey(S.addDays(new Date(), 1))) return '明天';
    return dateLabel(w.due);
  }

  /* ================= 喝水 ================= */
  function viewWater() {
    var tk = todayKey();
    var cfg = S.state.settings;
    var cups = S.dayWaterCups(tk);
    var ml = S.dayWaterMl(tk);
    var goal = cfg.waterGoal;
    var pct = Math.min(1, cups / goal);
    var left = Math.max(0, goal - cups);

    var days = lastDays(7);
    var values = days.map(function (x) { return S.dayWaterCups(x.key); });
    var labels = days.map(function (x) { return WEEK1[x.d.getDay()]; });
    var chart = barChart(values, labels, { goal: goal, fmt: function (v) { return v; }, color: 'var(--water)' });

    var cupsHtml = '';
    for (var i = 0; i < Math.max(goal, cups); i++) {
      cupsHtml += '<div class="cup' + (i < cups ? ' on' : '') + '"><i></i></div>';
    }

    var entries = S.day(tk).water.slice().reverse();
    var list = entries.length
      ? entries.map(function (w) {
        return '<div class="row"><div class="row-ico water">💧</div>' +
          '<div class="row-main"><div class="row-title">' + w.ml + ' ml</div><div class="row-sub">' + timeText(w.at) + '</div></div>' +
          '<div class="row-val">+1 杯</div></div>';
      }).join('')
      : '<div class="empty"><div class="big">🥤</div><b>还没有喝水记录</b>喝一杯，点一下上面的按钮</div>';

    var wStreak = waterStreak();

    return '' +
      '<div class="page-head"><h1>喝水</h1><span class="sub">目标 ' + goal + ' 杯 / ' + (goal * cfg.cupMl) + ' ml</span></div>' +
      '<section class="card" style="padding:16px 16px 18px">' +
      '<div class="ring-wrap">' + ringSVG(pct) +
      '<div class="ring-center"><div class="ring-cups">' + cups + '<small> / ' + goal + '</small></div>' +
      '<div class="ring-label">' + (left ? '还差 ' + left + ' 杯' : '今日达标 🎉') + '</div></div>' +
      '</div>' +
      '<div class="cup-row">' + cupsHtml + '</div>' +
      '<div class="water-actions">' +
      '<button class="btn primary" data-act="water-add" style="flex:1.6">＋ 喝了一杯（' + cfg.cupMl + 'ml）</button>' +
      '<button class="btn ghost" data-act="water-undo"' + (cups ? '' : ' disabled') + '>撤销</button>' +
      '</div>' +
      '<div class="hero-meta" style="color:var(--muted);margin-top:12px;font-size:12px">' +
      '<span>今日 ' + ml + ' ml</span><span>连续达标 ' + wStreak + ' 天</span></div>' +
      '</section>' +
      '<div class="sec"><b>最近 7 天</b><span>杯 / 天</span></div>' +
      '<div class="card" style="padding:12px 10px 4px">' + chart + '</div>' +
      '<div class="sec"><b>今日记录</b><span>' + entries.length + ' 次</span></div>' +
      '<div class="card list-card">' + list + '</div>' +
      '<div class="sec"><b>饮水设置</b><span>按自己习惯来</span></div>' +
      '<div class="card set-list">' +
      setStep('waterGoal', '每日目标', '杯数', S.state.settings.waterGoal, '杯', 1, 1, 30) +
      setStep('cupMl', '单杯容量', '一个杯子大概多少', S.state.settings.cupMl, 'ml', 50, 100, 1000) +
      '</div>' +
      '<div style="height:8px"></div>';
  }

  function waterStreak() {
    var goal = S.state.settings.waterGoal;
    var d = new Date(), n = 0;
    if (S.dayWaterCups(S.dateKey(d)) < goal) d = S.addDays(d, -1);
    while (n < 3650 && S.dayWaterCups(S.dateKey(d)) >= goal) {
      n += 1;
      d = S.addDays(d, -1);
    }
    return n;
  }

  function ringSVG(pct) {
    var r = 86, c = 2 * Math.PI * r;
    var off = c * (1 - Math.min(1, Math.max(0, pct)));
    return '<svg class="ring" viewBox="0 0 200 200" aria-hidden="true">' +
      '<defs><linearGradient id="wg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#41cdf5"/><stop offset="1" stop-color="#2f7df6"/></linearGradient></defs>' +
      '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="var(--soft-2)" stroke-width="13"/>' +
      '<circle cx="100" cy="100" r="' + r + '" fill="none" stroke="url(#wg)" stroke-width="13" stroke-linecap="round" ' +
      'stroke-dasharray="' + c.toFixed(1) + '" stroke-dashoffset="' + off.toFixed(1) + '" transform="rotate(-90 100 100)"/>' +
      '</svg>';
  }

  function barChart(values, labels, opts) {
    opts = opts || {};
    var color = opts.color || 'var(--primary)';
    var goal = opts.goal || 0;
    var W = 320, H = 130, padT = 20, padB = 22, padL = 2, padR = 2;
    var n = values.length;
    var max = Math.max.apply(null, values.concat([goal, 1]));
    var slot = (W - padL - padR) / n;
    var bw = Math.min(20, slot * 0.46);
    var chartH = H - padT - padB;
    var s = '<svg class="chart" viewBox="0 0 ' + W + ' ' + H + '" role="img">';

    if (goal > 0) {
      var gy = padT + chartH - chartH * Math.min(goal, max) / max;
      s += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + gy.toFixed(1) + '" y2="' + gy.toFixed(1) +
        '" stroke="var(--line)" stroke-width="1" stroke-dasharray="3 4"/>';
    }

    values.forEach(function (v, i) {
      var h = Math.max(v > 0 ? 3 : 2, chartH * v / max);
      var x = padL + slot * i + (slot - bw) / 2;
      var y = padT + chartH - h;
      var isLast = i === n - 1;
      s += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) +
        '" rx="' + Math.min(5, bw / 2).toFixed(1) + '" style="fill:' + (isLast ? color : 'var(--soft-2)') + '"/>';
      if (v > 0) {
        s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (y - 5).toFixed(1) + '" text-anchor="middle" font-size="9.5" style="fill:var(--muted)">' + v + '</text>';
      }
      s += '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - 5) + '" text-anchor="middle" font-size="9.5" style="fill:' + (isLast ? 'var(--text)' : 'var(--muted)') + '">' + labels[i] + '</text>';
    });

    s += '</svg>';
    return s;
  }

  /* ================= 我的 ================= */
  function viewMe() {
    var cfg = S.state.settings;
    var totalSec = S.totalStudySec();
    var hours = totalSec / 3600;
    var totalVal = hours >= 1 ? hours.toFixed(1) : Math.round(totalSec / 60);
    var totalUnit = hours >= 1 ? '小时' : '分钟';
    var all = S.state.words;
    var mastered = all.filter(function (w) { return w.status === 'mastered'; }).length;

    var days = lastDays(7);
    var studyVals = days.map(function (x) { return Math.round(S.dayStudy(x.key) / 60); });
    var labels = days.map(function (x) { return WEEK1[x.d.getDay()]; });
    var studyChart = barChart(studyVals, labels, { goal: cfg.studyGoal, color: 'var(--primary)' });

    var themes = { auto: '跟随系统', light: '浅色', dark: '深色' };

    var subjects = cfg.subjects.map(function (s) {
      return '<span class="tag">' + esc(s) + '<button data-act="subject-del" data-name="' + esc(s) + '" aria-label="删除">✕</button></span>';
    }).join('');

    return '' +
      '<div class="page-head"><h1>我的</h1><span class="sub">数据都在本机</span></div>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">累计学习</div><div class="v">' + totalVal + '<small>' + totalUnit + '</small></div></div>' +
      '<div class="stat"><div class="k">连续打卡</div><div class="v">' + S.streak() + '<small>天</small></div></div>' +
      '<div class="stat"><div class="k">学习天数</div><div class="v">' + S.studyDayCount() + '<small>天</small></div></div>' +
      '<div class="stat"><div class="k">单词总数</div><div class="v">' + all.length + '<small>个</small></div></div>' +
      '<div class="stat"><div class="k">已掌握</div><div class="v">' + mastered + '<small>个</small></div></div>' +
      '<div class="stat"><div class="k">喝水累计</div><div class="v">' + S.totalCups() + '<small>杯</small></div></div>' +
      '</div>' +
      '<div class="sec"><b>最近 7 天学习</b><span>分钟 / 天</span></div>' +
      '<div class="card" style="padding:12px 10px 4px">' + studyChart + '</div>' +
      '<div class="sec"><b>目标</b><span>想改就改</span></div>' +
      '<div class="card set-list">' +
      setStep('studyGoal', '每日学习', '到点就算完成', cfg.studyGoal, '分钟', 15, 0, 720) +
      setStep('waterGoal', '每日喝水', '', cfg.waterGoal, '杯', 1, 1, 30) +
      setRow('外观', themes[cfg.theme] || '跟随系统', '<button class="btn sm ghost" data-act="theme">切换</button>') +
      '</div>' +
      '<div class="sec"><b>科目</b><span>学习时可选</span></div>' +
      '<div class="card">' +
      '<div class="tag-list">' + subjects + '</div>' +
      '<div class="add-subject"><input class="input" id="new-subject" placeholder="添加科目，如：语法" maxlength="12"><button class="btn sm primary" data-act="subject-add">添加</button></div>' +
      '</div>' +
      '<div class="sec"><b>数据</b><span>换手机也不丢</span></div>' +
      '<div class="card set-list">' +
      setRow('导出数据', '保存为 JSON 文件', '<button class="btn sm ghost" data-act="export">导出</button>') +
      setRow('导入数据', '从备份文件恢复', '<button class="btn sm ghost" data-act="import">导入</button>') +
      setRow('清空数据', '删除本机全部记录', '<button class="btn sm danger" data-act="clear">清空</button>') +
      '</div>' +
      '<div class="empty" style="padding:22px 10px 6px">奉DAILY v1.0<br>数据只保存在这台设备的浏览器里</div>' +
      '<div style="height:8px"></div>';
  }

  function setRow(title, desc, right) {
    return '<div class="set-row"><div><div class="t">' + title + '</div>' + (desc ? '<div class="d">' + desc + '</div>' : '') + '</div>' + right + '</div>';
  }

  function setStep(key, title, desc, value, unit, step, min, max) {
    return '<div class="set-row"><div><div class="t">' + title + '</div>' + (desc ? '<div class="d">' + desc + '</div>' : '') + '</div>' +
      '<div class="step">' +
      '<button data-act="step" data-key="' + key + '" data-delta="-' + step + '" aria-label="减少">−</button>' +
      '<div class="val">' + value + '<small>' + unit + '</small></div>' +
      '<button data-act="step" data-key="' + key + '" data-delta="' + step + '" aria-label="增加">＋</button>' +
      '</div></div>';
  }

  /* ================= 弹层内容 ================= */
  function openWordForm(word) {
    var w = word || {};
    var isEdit = !!word;
    openSheet(isEdit ? '编辑单词' : '添加生词',
      '<form id="word-form" autocomplete="off"' + (isEdit ? ' data-id="' + w.id + '"' : '') + '>' +
      '<label class="field"><span>单词</span><input class="input" name="word" value="' + esc(w.word || '') + '" placeholder="consistency" autocapitalize="off" spellcheck="false"></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>音标（可选）</span><input class="input" name="phonetic" value="' + esc(w.phonetic || '') + '" placeholder="kənˈsɪstənsi"></label>' +
      '<label class="field"><span>标签（可选）</span><input class="input" name="tags" value="' + esc((w.tags || []).join(' ')) + '" placeholder="考研 Unit3"></label>' +
      '</div>' +
      '<label class="field"><span>释义</span><input class="input" name="def" value="' + esc(w.def || '') + '" placeholder="n. 一致性；坚持"></label>' +
      '<label class="field"><span>例句（可选）</span><textarea class="input" name="example" placeholder="Consistency is the key to progress.">' + esc(w.example || '') + '</textarea></label>' +
      '</form>',
      '<button class="btn primary block" type="submit" form="word-form">' + (isEdit ? '保存修改' : '保存到单词本') + '</button>');
  }

  function saveWordForm(form) {
    var fd = new FormData(form);
    var word = String(fd.get('word') || '').trim();
    var def = String(fd.get('def') || '').trim();
    if (!word) { toast('先写一个单词吧'); return; }
    if (!def) { toast('再补一句释义'); return; }
    var payload = {
      word: word,
      def: def,
      phonetic: String(fd.get('phonetic') || '').trim(),
      example: String(fd.get('example') || '').trim(),
      tags: String(fd.get('tags') || '')
    };
    if (form.dataset.id) {
      payload.tags = String(payload.tags).split(/[,，;；\s]+/).filter(Boolean).slice(0, 8);
      S.updateWord(form.dataset.id, payload);
      toast('已更新');
    } else {
      S.addWord(payload);
      toast('已加入单词本');
    }
    closeSheet();
    haptic();
  }

  function openWordSheet(id) {
    var w = S.wordById(id);
    if (!w) return;
    var tags = w.tags.length ? '<div class="word-meta">' + w.tags.map(function (t) { return '<span>#' + esc(t) + '</span>'; }).join('') + '</div>' : '';
    var body = '' +
      (w.phonetic ? '<div class="word-ph">/' + esc(w.phonetic) + '/</div>' : '') +
      '<div class="word-def">' + esc(w.def || '（暂无释义）') + '</div>' +
      (w.example ? '<div class="word-ex">' + esc(w.example) + '</div>' : '') +
      tags +
      '<div class="word-meta">' +
      '<span>加入于 ' + dateLabel(S.dateKey(new Date(w.addedAt))) + '</span>' +
      '<span>复习 ' + w.reviews + ' 次</span>' +
      '<span>忘记 ' + w.lapses + ' 次</span>' +
      '<span>下次：' + dueText(w) + '</span>' +
      '</div>' +
      (w.status !== 'mastered'
        ? '<div class="word-actions"><button class="btn danger" data-act="word-bad" data-id="' + w.id + '">不记得</button>' +
        '<button class="btn green" data-act="word-ok" data-id="' + w.id + '">记得</button></div>'
        : '') +
      '<div class="word-actions" style="margin-top:10px">' +
      '<button class="btn" data-act="word-edit" data-id="' + w.id + '">编辑</button>' +
      '<button class="btn" data-act="word-master" data-id="' + w.id + '">' + (w.status === 'mastered' ? '取消掌握' : '标记已掌握') + '</button>' +
      '<button class="btn danger" data-act="word-del" data-id="' + w.id + '">删除</button>' +
      '</div>';
    openSheet(w.word, body, '');
  }

  function openManual() {
    var subjects = S.state.settings.subjects.map(function (s) {
      return '<option' + (s === S.state.settings.lastSubject ? ' selected' : '') + '>' + esc(s) + '</option>';
    }).join('');
    openSheet('补记学习',
      '<form id="manual-form">' +
      '<label class="field"><span>日期</span><input class="input" type="date" name="date" value="' + todayKey() + '" max="' + todayKey() + '"></label>' +
      '<div class="field-row">' +
      '<label class="field"><span>时长（分钟）</span><input class="input" type="number" name="minutes" inputmode="numeric" min="1" max="720" placeholder="45"></label>' +
      '<label class="field"><span>科目</span><select class="input" name="subject">' + subjects + '</select></label>' +
      '</div>' +
      '<label class="field"><span>学习内容</span><input class="input" name="content" placeholder="例：精读 Unit 3，整理了 20 个生词" maxlength="80"></label>' +
      '</form>',
      '<button class="btn primary block" type="submit" form="manual-form">保存记录</button>');
  }

  function saveManual(form) {
    var fd = new FormData(form);
    var date = String(fd.get('date') || todayKey());
    var min = Number(fd.get('minutes'));
    var subject = String(fd.get('subject') || '英语');
    var content = String(fd.get('content') || '').trim();
    if (!min || min <= 0) { toast('填一下时长'); return; }
    if (date > todayKey()) { toast('日期不能选未来'); return; }
    var start;
    if (date === todayKey()) {
      start = new Date();
      start.setSeconds(0, 0);
    } else {
      start = new Date(date + 'T20:00:00');
      if (isNaN(start.getTime())) start = new Date();
    }
    var sec = Math.round(min * 60);
    S.addSession({ subject: subject, content: content, sec: sec, start: start.getTime(), end: start.getTime() + sec * 1000 });
    closeSheet();
    toast('已记录 ' + humanDur(sec));
    haptic();
  }

  function openSession(dayKey, id) {
    var sess = S.day(dayKey).sessions.filter(function (s) { return s.id === id; })[0];
    if (!sess) return;
    var body = '<div class="word-def">' + esc(sess.content || sess.subject) + '</div>' +
      '<div class="word-meta">' +
      '<span>' + dateLabel(dayKey) + '</span>' +
      '<span>' + esc(sess.subject) + '</span>' +
      '<span>' + timeText(sess.start) + ' – ' + timeText(sess.end) + '</span>' +
      '<span>' + humanDur(sess.sec) + '</span>' +
      '</div>' +
      '<div class="word-actions"><button class="btn danger flex1" data-act="session-del" data-day="' + dayKey + '" data-id="' + id + '">删除这段记录</button></div>';
    openSheet('学习记录', body, '');
  }

  /* ================= 复习 ================= */
  function startReview() {
    var list = S.dueWords().slice(0, 40);
    if (!list.length) {
      toast('今天没有待复习的单词');
      return;
    }
    ui.review = { ids: list.map(function (w) { return w.id; }), i: 0, ok: 0, bad: 0, revealed: false, done: false };
    renderReview();
    document.body.classList.add('locked');
  }

  function renderReview() {
    var root = $('#review-root');
    if (!root) {
      root = document.createElement('div');
      root.id = 'review-root';
      document.body.appendChild(root);
    }
    var r = ui.review;
    if (!r) { root.innerHTML = ''; return; }
    if (r.done) { root.innerHTML = reviewResultHTML(r); return; }
    var w = S.wordById(r.ids[r.i]);
    if (!w) { r.done = true; renderReview(); return; }
    var progress = Math.round(r.i / r.ids.length * 100);

    root.innerHTML = '<div class="review">' +
      '<div class="review-top"><span class="k">' + (r.i + 1) + ' / ' + r.ids.length + '</span>' +
      '<button class="icon-btn" data-act="rev-close" aria-label="退出复习">✕</button></div>' +
      '<div class="review-bar"><i style="width:' + progress + '%"></i></div>' +
      '<div class="review-stage"><div class="review-card"' + (r.revealed ? '' : ' data-act="rev-reveal"') + '>' +
      '<div class="rw">' + esc(w.word) + '</div>' +
      (w.phonetic ? '<div class="rp">/' + esc(w.phonetic) + '/</div>' : '') +
      (r.revealed
        ? (w.def ? '<div class="rd">' + esc(w.def) + '</div>' : '<div class="rd muted">（这个词还没写释义）</div>') +
        (w.example ? '<div class="re">' + esc(w.example) + '</div>' : '')
        : '<div class="hint">先在心里想一想，再轻点卡片 👀</div>') +
      '</div></div>' +
      '<div class="review-foot">' +
      (r.revealed
        ? '<button class="btn danger" data-act="rev-bad">不记得</button><button class="btn green" data-act="rev-ok">记得</button>'
        : '<button class="btn primary block" data-act="rev-reveal">显示释义</button>') +
      '</div></div>';
  }

  function reviewResultHTML(r) {
    var total = r.ok + r.bad;
    var pct = total ? Math.round(r.ok / total * 100) : 0;
    return '<div class="review">' +
      '<div class="review-top"><span class="k">复习完成</span><button class="icon-btn" data-act="rev-done" aria-label="关闭">✕</button></div>' +
      '<div class="review-stage"><div class="review-card review-result">' +
      '<div class="big">' + (pct >= 80 ? '🎉' : '💪') + '</div>' +
      '<h2>' + (pct >= 80 ? '记得很牢' : '再巩固一下') + '</h2>' +
      '<p>' + (r.bad ? '忘了的 ' + r.bad + ' 个词，明天还会再出现。' : '全部记得，明天继续保持！') + '</p>' +
      '<div class="nums"><div class="ok"><b>' + r.ok + '</b>记得</div><div class="bad"><b>' + r.bad + '</b>不记得</div></div>' +
      '<button class="btn primary block" data-act="rev-done">完成</button>' +
      '</div></div></div>';
  }

  function answerReview(ok) {
    var r = ui.review;
    if (!r || r.done) return;
    S.reviewWord(r.ids[r.i], ok);
    if (ok) r.ok += 1; else r.bad += 1;
    r.i += 1;
    r.revealed = false;
    if (r.i >= r.ids.length) r.done = true;
    haptic();
    renderReview();
  }

  function closeReview() {
    var root = $('#review-root');
    if (root) root.innerHTML = '';
    ui.review = null;
    if (!sheetEl) document.body.classList.remove('locked');
    render();
  }

  /* ================= 计时 ================= */
  var tickHandle = null;

  function syncTicker() {
    var running = S.state.timer.running;
    if (running && !tickHandle) {
      tickHandle = setInterval(onTick, 1000);
    } else if (!running && tickHandle) {
      clearInterval(tickHandle);
      tickHandle = null;
    }
  }

  function onTick() {
    var t = S.state.timer;
    if (!t.running) { syncTicker(); return; }
    if (t.mode === 'pomodoro' && S.timerElapsed() >= t.target) { finishTimer(true); return; }
    updateLive();
  }

  function updateLive() {
    var t = S.state.timer;
    var e = S.timerElapsed();
    var disp = t.mode === 'pomodoro' ? Math.max(0, t.target - e) : e;
    $$('[data-live="study"]').forEach(function (n) { n.textContent = hms(disp); });
    $$('[data-live="session"]').forEach(function (n) { n.textContent = hms(e); });
    $$('[data-live="today"]').forEach(function (n) { n.textContent = hms(S.dayStudy(todayKey()) + e); });
    document.title = t.running ? '⏱ ' + hms(disp) + ' · 奉DAILY' : '奉DAILY · 学习 / 单词 / 喝水';
  }

  function startTimer(mode) {
    var t = S.state.timer;
    var contentEl = $('#timer-content');
    var content = contentEl ? contentEl.value : t.content;
    S.timerStart({ mode: mode || t.mode, subject: t.subject, content: content, target: t.target });
    haptic();
  }

  function finishTimer(auto) {
    var sec = S.timerFinish();
    if (!sec) {
      toast('太短啦，没有记录');
      render();
      return;
    }
    toast(auto ? '番茄钟完成 🍅 已记录 ' + humanDur(sec) : '已记录 ' + humanDur(sec));
    haptic();
  }

  /* ================= 数据 ================= */
  function exportData() {
    try {
      var blob = new Blob([S.exportJSON()], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '奉DAILY-' + todayKey() + '.json';
      document.body.appendChild(a);
      a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 1500);
      toast('已导出备份文件');
    } catch (e) {
      toast('导出失败，换个浏览器试试');
    }
  }

  function importData(file) {
    if (!file) return;
    file.text().then(function (text) {
      try {
        S.importJSON(text);
        toast('已恢复 ' + S.state.words.length + ' 个单词');
        render();
      } catch (e) {
        toast('文件读不出来，可能不是备份文件');
      }
    }).catch(function () { toast('读取文件失败'); });
  }

  /* ================= 事件 ================= */
  function onClick(e) {
    var node = e.target.closest('[data-act]');
    if (!node) return;
    var act = node.dataset.act;
    var id = node.dataset.id;

    switch (act) {
      case 'tab':
        ui.tab = node.dataset.tab;
        closeSheet();
        render();
        break;

      case 'sheet-close':
        closeSheet();
        break;

      case 'timer-start':
        startTimer(node.dataset.mode);
        break;
      case 'timer-pause':
        S.timerPause();
        haptic();
        break;
      case 'timer-finish':
        finishTimer(false);
        break;

      case 'mode':
        if (S.state.timer.running) { toast('计时中不能切换模式'); break; }
        S.state.timer.mode = node.dataset.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
        S.save();
        break;
      case 'target':
        if (S.state.timer.running) { toast('计时中不能改时长'); break; }
        S.state.timer.target = Number(node.dataset.sec) || 1500;
        S.save();
        break;
      case 'subject':
        if (S.state.timer.running) { toast('计时中不能换科目'); break; }
        S.state.timer.subject = node.dataset.name;
        S.state.settings.lastSubject = node.dataset.name;
        S.save();
        break;

      case 'manual-open':
        openManual();
        break;

      case 'water-add':
        S.addWater();
        haptic();
        toast('+1 杯，已记录 💧');
        break;
      case 'water-undo': {
        var ml = S.undoWater();
        if (ml) { toast('已撤销一杯（' + ml + 'ml）'); haptic(); }
        else toast('今天还没有喝水记录');
        break;
      }

      case 'review-start':
        startReview();
        break;
      case 'rev-reveal':
        if (ui.review && !ui.review.revealed) { ui.review.revealed = true; renderReview(); }
        break;
      case 'rev-ok':
        answerReview(true);
        break;
      case 'rev-bad':
        answerReview(false);
        break;
      case 'rev-close':
        closeReview();
        break;
      case 'rev-done':
        closeReview();
        break;

      case 'word-add':
        openWordForm(null);
        break;
      case 'word-open':
        openWordSheet(id);
        break;
      case 'word-edit': {
        var w = S.wordById(id);
        if (w) openWordForm(w);
        break;
      }
      case 'word-ok':
        S.reviewWord(id, true);
        closeSheet();
        toast('记得 👍 下次见');
        haptic();
        break;
      case 'word-bad':
        S.reviewWord(id, false);
        closeSheet();
        toast('没关系，明天再来一次');
        haptic();
        break;
      case 'word-master': {
        var wm = S.wordById(id);
        if (wm) {
          var toMastered = wm.status !== 'mastered';
          S.setWordStatus(id, toMastered ? 'mastered' : 'learning');
          closeSheet();
          toast(toMastered ? '已标记为掌握 ✨' : '已放回复习');
        }
        break;
      }
      case 'word-del': {
        var wd = S.wordById(id);
        confirmSheet('删除这个单词？', (wd ? wd.word + ' ' : '') + '删除后不会出现在复习里，记录也无法找回。', '删除', function () {
          S.deleteWord(id);
          toast('已删除');
        });
        break;
      }
      case 'filter':
        ui.filter = node.dataset.f;
        render();
        break;

      case 'session-open':
        openSession(node.dataset.day, node.dataset.id);
        break;
      case 'session-del': {
        var day = node.dataset.day, sid = node.dataset.id;
        confirmSheet('删除这条学习记录？', '删除后时长统计会相应减少。', '删除', function () {
          S.deleteSession(day, sid);
          toast('已删除');
        });
        break;
      }

      case 'step': {
        var key = node.dataset.key;
        var delta = Number(node.dataset.delta);
        var cur = S.state.settings[key];
        var next = cur + delta;
        if (key === 'studyGoal') next = Math.max(15, Math.min(720, next));
        if (key === 'waterGoal') next = Math.max(1, Math.min(30, next));
        if (key === 'cupMl') next = Math.max(50, Math.min(1500, next));
        if (next !== cur) S.updateSettings({ [key]: next });
        break;
      }
      case 'theme': {
        var order = ['auto', 'light', 'dark'];
        var i = order.indexOf(S.state.settings.theme);
        S.updateSettings({ theme: order[(i + 1) % 3] });
        toast('外观：' + ({ auto: '跟随系统', light: '浅色', dark: '深色' }[S.state.settings.theme]));
        break;
      }
      case 'subject-add': {
        var input = $('#new-subject');
        var name = input ? input.value : '';
        if (input) input.value = '';
        if (S.addSubject(name)) {
          toast('已添加科目');
          haptic();
        } else {
          toast('科目为空或已存在');
        }
        break;
      }
      case 'subject-del':
        if (S.state.settings.subjects.length <= 1) { toast('至少留一个科目'); break; }
        confirmSheet('删除科目「' + node.dataset.name + '」？', '已记录的学习不会丢，只是以后不能选它了。', '删除', function () {
          S.removeSubject(node.dataset.name);
        });
        break;

      case 'export':
        exportData();
        break;
      case 'import':
        var fi = $('#import-file');
        if (fi) fi.click();
        break;
      case 'clear':
        confirmSheet('清空全部数据？', '学习记录、单词本、喝水记录都会被删除，且无法恢复。建议先导出备份。', '全部清空', function () {
          S.clearAll();
          toast('已清空，重新开始');
        });
        break;
    }
  }

  function onInput(e) {
    var n = e.target;
    if (n.id === 'timer-content') {
      S.state.timer.content = n.value;
    } else if (n.id === 'word-q') {
      ui.q = n.value;
      var list = $('#word-list');
      if (list) list.innerHTML = wordListHTML();
    }
  }

  function onSubmit(e) {
    var f = e.target;
    if (f.id === 'word-form') {
      e.preventDefault();
      saveWordForm(f);
    } else if (f.id === 'manual-form') {
      e.preventDefault();
      saveManual(f);
    }
  }

  function onKey(e) {
    if (e.key !== 'Escape') return;
    if (sheetEl) { closeSheet(); return; }
    if (ui.review) closeReview();
  }

  function init() {
    S.load();
    applyTheme();

    var fi = document.createElement('input');
    fi.type = 'file';
    fi.id = 'import-file';
    fi.accept = 'application/json,.json';
    fi.style.display = 'none';
    document.body.appendChild(fi);
    fi.addEventListener('change', function () {
      importData(fi.files && fi.files[0]);
      fi.value = '';
    });

    S.subscribe(function () { render(); });
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) render();
    });

    render();

    // 跨过零点时自动切换到新的一天
    var lastDay = todayKey();
    setInterval(function () {
      var k = todayKey();
      if (k !== lastDay) { lastDay = k; render(); }
    }, 20000);

    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () { /* offline 支持不可用也没关系 */ });
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
