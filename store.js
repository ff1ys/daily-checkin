/* 每日打卡 · 数据层
 * 所有数据保存在浏览器 localStorage，不上传任何服务器。
 */
(function (global) {
  'use strict';

  var KEY = 'daily-checkin.v1';
  var DEFAULT_SUBJECTS = ['英语', '背单词', '听力', '阅读', '口语', '写作'];
  var INTERVALS = [0, 1, 2, 4, 7, 15, 30, 60]; // 第 n 次复习后隔几天再来
  var MASTER_AT = 5; // 连续答对 5 次自动标记为「已掌握」

  /* ---------- 工具 ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function dateKey(d) {
    d = d || new Date();
    return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
  }
  function fromKey(k) {
    var p = String(k || '').split('-').map(Number);
    return new Date(p[0] || 1970, (p[1] || 1) - 1, p[2] || 1);
  }
  function addDays(d, n) {
    var x = new Date(d.getTime());
    x.setDate(x.getDate() + n);
    return x;
  }
  function uid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }
  function clamp(n, min, max) {
    n = Number(n);
    if (!isFinite(n)) n = min;
    return Math.min(max, Math.max(min, n));
  }
  function num(v, dflt) {
    var n = Number(v);
    return isFinite(n) ? n : dflt;
  }

  /* ---------- 默认状态 ---------- */
  function defaults() {
    return {
      v: 1,
      createdAt: Date.now(),
      settings: {
        studyGoal: 60,
        waterGoal: 8,
        cupMl: 250,
        subjects: DEFAULT_SUBJECTS.slice(),
        lastSubject: '英语',
        theme: 'auto'
      },
      days: {},   // 'YYYY-MM-DD' -> { sessions: [], water: [] }
      words: [],  // 单词本
      timer: { running: false, startedAt: 0, accum: 0, subject: '英语', content: '', mode: 'stopwatch', target: 25 * 60 }
    };
  }

  function normalize(raw) {
    var d = defaults();
    if (!raw || typeof raw !== 'object') return d;
    var s = {
      v: 1,
      createdAt: raw.createdAt || Date.now(),
      settings: Object.assign({}, d.settings, raw.settings || {}),
      days: {},
      words: [],
      timer: Object.assign({}, d.timer, raw.timer || {})
    };

    var cfg = s.settings;
    cfg.studyGoal = clamp(cfg.studyGoal, 0, 720);
    cfg.waterGoal = clamp(cfg.waterGoal, 1, 30);
    cfg.cupMl = clamp(cfg.cupMl, 50, 1500);
    cfg.subjects = Array.isArray(cfg.subjects) && cfg.subjects.length
      ? cfg.subjects.filter(function (x) { return typeof x === 'string' && x.trim(); }).slice(0, 30)
      : d.settings.subjects.slice();
    if (!cfg.subjects.length) cfg.subjects = d.settings.subjects.slice();
    if (['auto', 'light', 'dark'].indexOf(cfg.theme) < 0) cfg.theme = 'auto';
    if (!cfg.lastSubject) cfg.lastSubject = cfg.subjects[0];

    if (raw.days && typeof raw.days === 'object') {
      Object.keys(raw.days).forEach(function (k) {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(k)) return;
        var day = raw.days[k] || {};
        s.days[k] = {
          sessions: (Array.isArray(day.sessions) ? day.sessions : []).filter(function (x) { return x && x.sec > 0; }).map(function (x) {
            return {
              id: x.id || uid(),
              subject: x.subject || '学习',
              content: x.content || '',
              sec: Math.max(1, Math.round(num(x.sec, 0))),
              start: num(x.start, Date.now() - num(x.sec, 0) * 1000),
              end: num(x.end, num(x.start, Date.now() - num(x.sec, 0) * 1000) + num(x.sec, 0) * 1000)
            };
          }),
          water: (Array.isArray(day.water) ? day.water : []).filter(Boolean).map(function (x) {
            return { id: x.id || uid(), ml: Math.max(0, Math.round(num(x.ml, 0))), at: num(x.at, Date.now()) };
          })
        };
      });
    }

    s.words = (Array.isArray(raw.words) ? raw.words : []).filter(function (w) {
      return w && typeof w.word === 'string' && w.word.trim();
    }).map(function (w) {
      var made = num(w.addedAt, Date.now());
      return {
        id: w.id || uid(),
        word: String(w.word).trim(),
        phonetic: String(w.phonetic || '').trim(),
        def: String(w.def || '').trim(),
        example: String(w.example || '').trim(),
        tags: Array.isArray(w.tags) ? w.tags.filter(Boolean).slice(0, 8) : [],
        status: ['new', 'learning', 'mastered'].indexOf(w.status) >= 0 ? w.status : 'new',
        addedAt: made,
        reviews: Math.max(0, Math.round(num(w.reviews, 0))),
        lapses: Math.max(0, Math.round(num(w.lapses, 0))),
        due: /^\d{4}-\d{2}-\d{2}$/.test(String(w.due || '')) ? w.due : dateKey(new Date(made)),
        lastReview: num(w.lastReview, 0)
      };
    });

    var t = s.timer;
    if (t.mode !== 'pomodoro' && t.mode !== 'stopwatch') t.mode = 'stopwatch';
    t.target = clamp(t.target, 60, 4 * 3600);
    t.accum = Math.max(0, num(t.accum, 0));
    t.startedAt = t.running ? num(t.startedAt, Date.now()) : 0;
    if (t.running && !t.startedAt) t.running = false;
    if (!cfg.subjects.length) cfg.subjects = d.settings.subjects.slice();
    if (cfg.subjects.indexOf(t.subject) < 0) t.subject = cfg.lastSubject || cfg.subjects[0];

    return s;
  }

  /* ---------- Store ---------- */
  var Store = {
    state: defaults(),
    _subs: [],

    /* 工具函数，方便 UI 层复用 */
    dateKey: dateKey,
    fromKey: fromKey,
    addDays: addDays,
    uid: uid,

    load: function () {
      try {
        var raw = localStorage.getItem(KEY);
        if (raw) this.state = normalize(JSON.parse(raw));
      } catch (err) {
        console.warn('[打卡] 本地数据读取失败，将从空白开始', err);
      }
      return this.state;
    },

    persist: function () {
      try {
        localStorage.setItem(KEY, JSON.stringify(this.state));
      } catch (err) {
        console.warn('[打卡] 本地保存失败', err);
      }
    },

    save: function () {
      this.persist();
      this.emit();
    },

    emit: function () {
      var st = this.state;
      this._subs.forEach(function (fn) {
        try { fn(st); } catch (err) { console.error(err); }
      });
    },

    subscribe: function (fn) { this._subs.push(fn); },

    /* ---------- 天 ---------- */
    day: function (k, create) {
      var key = k || dateKey();
      var d = this.state.days[key];
      if (!d) {
        if (!create) return { sessions: [], water: [] };
        d = this.state.days[key] = { sessions: [], water: [] };
      }
      if (!Array.isArray(d.sessions)) d.sessions = [];
      if (!Array.isArray(d.water)) d.water = [];
      return d;
    },

    dayStudy: function (k) {
      return this.day(k).sessions.reduce(function (a, s) { return a + (num(s.sec, 0)); }, 0);
    },

    dayWaterCups: function (k) { return this.day(k).water.length; },

    dayWaterMl: function (k) {
      return this.day(k).water.reduce(function (a, w) { return a + num(w.ml, 0); }, 0);
    },

    /* ---------- 学习记录 ---------- */
    addSession: function (o) {
      o = o || {};
      var sec = Math.max(1, Math.round(num(o.sec, 0)));
      var end = num(o.end, Date.now());
      var start = num(o.start, end - sec * 1000);
      var key = dateKey(new Date(start));
      var day = this.day(key, true);
      var subject = (o.subject || this.state.settings.lastSubject || '英语').trim() || '英语';
      var content = String(o.content || '').trim();
      day.sessions.push({ id: uid(), subject: subject, content: content, sec: sec, start: start, end: end });
      day.sessions.sort(function (a, b) { return a.start - b.start; });
      this.state.settings.lastSubject = subject;
      this.save();
      return key;
    },

    deleteSession: function (key, id) {
      var day = this.state.days[key];
      if (!day) return;
      day.sessions = day.sessions.filter(function (s) { return s.id !== id; });
      this.save();
    },

    /* ---------- 计时器 ---------- */
    timerElapsed: function (ref) {
      var t = this.state.timer;
      var now = ref || Date.now();
      return Math.max(0, num(t.accum, 0) + (t.running ? (now - num(t.startedAt, now)) / 1000 : 0));
    },

    timerStart: function (opts) {
      var t = this.state.timer;
      opts = opts || {};
      if (opts.mode) t.mode = opts.mode === 'pomodoro' ? 'pomodoro' : 'stopwatch';
      if (opts.subject) t.subject = opts.subject;
      if (typeof opts.content === 'string') t.content = opts.content;
      if (opts.target) t.target = clamp(opts.target, 60, 4 * 3600);
      if (t.running) return;
      t.startedAt = Date.now();
      t.running = true;
      this.save();
    },

    timerPause: function () {
      var t = this.state.timer;
      if (!t.running) return;
      t.accum = this.timerElapsed();
      t.running = false;
      t.startedAt = 0;
      this.save();
    },

    timerReset: function () {
      var t = this.state.timer;
      t.running = false;
      t.startedAt = 0;
      t.accum = 0;
    },

    /* 结束并保存，返回实际记录的秒数（0 表示太短没有保存） */
    timerFinish: function (minSec) {
      var t = this.state.timer;
      var sec = this.timerElapsed();
      if (t.mode === 'pomodoro') sec = Math.min(sec, t.target);
      sec = Math.round(sec);
      var subject = t.subject || this.state.settings.lastSubject || '英语';
      var content = String(t.content || '').trim();
      this.timerReset();
      if (sec < (minSec == null ? 3 : minSec)) {
        this.save();
        return 0;
      }
      this.addSession({ subject: subject, content: content, sec: sec, start: Date.now() - sec * 1000, end: Date.now() });
      return sec;
    },

    /* ---------- 喝水 ---------- */
    addWater: function (ml) {
      var key = dateKey();
      var day = this.day(key, true);
      var amount = Math.max(10, Math.round(num(ml, this.state.settings.cupMl)));
      day.water.push({ id: uid(), ml: amount, at: Date.now() });
      this.save();
      return amount;
    },

    undoWater: function (key) {
      var k = key || dateKey();
      var day = this.day(k);
      if (!day.water.length) return 0;
      var removed = day.water.pop();
      this.save();
      return removed.ml;
    },

    /* ---------- 单词 ---------- */
    wordById: function (id) {
      return this.state.words.filter(function (w) { return w.id === id; })[0] || null;
    },

    addWord: function (o) {
      o = o || {};
      var w = {
        id: uid(),
        word: String(o.word || '').trim(),
        phonetic: String(o.phonetic || '').trim(),
        def: String(o.def || '').trim(),
        example: String(o.example || '').trim(),
        tags: (Array.isArray(o.tags) ? o.tags : String(o.tags || '').split(/[,，;；\s]+/)).map(function (t) { return String(t).trim(); }).filter(Boolean).slice(0, 8),
        status: 'new',
        addedAt: Date.now(),
        reviews: 0,
        lapses: 0,
        due: dateKey(),
        lastReview: 0
      };
      if (!w.word) return null;
      this.state.words.unshift(w);
      this.save();
      return w;
    },

    updateWord: function (id, patch) {
      var w = this.wordById(id);
      if (!w) return;
      Object.assign(w, patch || {});
      this.save();
    },

    reviewWord: function (id, remembered) {
      var w = this.wordById(id);
      if (!w) return null;
      if (remembered) {
        w.reviews += 1;
        w.status = w.reviews >= MASTER_AT ? 'mastered' : 'learning';
        var idx = Math.min(w.reviews, INTERVALS.length - 1);
        w.due = dateKey(addDays(new Date(), INTERVALS[idx]));
      } else {
        w.lapses += 1;
        w.reviews = Math.max(0, w.reviews - 1);
        w.status = 'learning';
        w.due = dateKey();
      }
      w.lastReview = Date.now();
      this.save();
      return w;
    },

    setWordStatus: function (id, status) {
      var w = this.wordById(id);
      if (!w) return;
      w.status = status;
      w.due = status === 'mastered' ? dateKey(addDays(new Date(), 365)) : dateKey();
      this.save();
    },

    deleteWord: function (id) {
      this.state.words = this.state.words.filter(function (w) { return w.id !== id; });
      this.save();
    },

    dueWords: function () {
      var today = dateKey();
      return this.state.words.filter(function (w) {
        return w.status !== 'mastered' && (!w.due || w.due <= today);
      }).sort(function (a, b) {
        if (a.due !== b.due) return a.due < b.due ? -1 : 1;
        return b.lapses - a.lapses;
      });
    },

    /* ---------- 汇总 ---------- */
    totalStudySec: function () {
      var days = this.state.days, total = 0;
      Object.keys(days).forEach(function (k) {
        (days[k].sessions || []).forEach(function (s) { total += num(s.sec, 0); });
      });
      return total;
    },

    studyDayCount: function () {
      var days = this.state.days, n = 0;
      Object.keys(days).forEach(function (k) {
        if ((days[k].sessions || []).length) n += 1;
      });
      return n;
    },

    totalCups: function () {
      var days = this.state.days, n = 0;
      Object.keys(days).forEach(function (k) { n += (days[k].water || []).length; });
      return n;
    },

    isDayActive: function (k) {
      var d = this.state.days[k];
      if (!d) return false;
      if ((d.sessions || []).length) return true;
      if ((d.water || []).length) return true;
      var self = this;
      return this.state.words.some(function (w) { return self.dateKey(new Date(w.addedAt)) === k; });
    },

    streak: function () {
      var d = new Date();
      var n = 0;
      if (!this.isDayActive(dateKey(d))) d = addDays(d, -1);
      while (n < 3650 && this.isDayActive(dateKey(d))) {
        n += 1;
        d = addDays(d, -1);
      }
      return n;
    },

    /* ---------- 设置 ---------- */
    updateSettings: function (patch) {
      Object.assign(this.state.settings, patch || {});
      var cfg = this.state.settings;
      cfg.studyGoal = clamp(cfg.studyGoal, 0, 720);
      cfg.waterGoal = clamp(cfg.waterGoal, 1, 30);
      cfg.cupMl = clamp(cfg.cupMl, 50, 1500);
      this.save();
    },

    addSubject: function (name) {
      var v = String(name || '').trim().slice(0, 12);
      if (!v) return false;
      if (this.state.settings.subjects.indexOf(v) >= 0) return false;
      this.state.settings.subjects.push(v);
      this.state.settings.lastSubject = v;
      this.save();
      return true;
    },

    removeSubject: function (name) {
      var cfg = this.state.settings;
      if (cfg.subjects.length <= 1) return false;
      cfg.subjects = cfg.subjects.filter(function (s) { return s !== name; });
      if (cfg.lastSubject === name) cfg.lastSubject = cfg.subjects[0];
      this.save();
      return true;
    },

    /* ---------- 数据导入导出 ---------- */
    exportJSON: function () {
      return JSON.stringify(this.state, null, 2);
    },

    importJSON: function (text) {
      var data = JSON.parse(text);
      var next = normalize(data);
      if (!data || typeof data !== 'object' || (!data.days && !data.words)) {
        throw new Error('文件格式不对');
      }
      this.state = next;
      this.save();
      return true;
    },

    clearAll: function () {
      this.state = defaults();
      try { localStorage.removeItem(KEY); } catch (err) { /* ignore */ }
      this.save();
    }
  };

  Store.load = Store.load.bind(Store);
  global.Store = Store;
})(window);
