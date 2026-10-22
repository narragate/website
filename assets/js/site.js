/* Narragate site behaviour: menu, song player, forms.
   Plain JavaScript, no dependencies. */
(function () {
  'use strict';

  var TRACKS = [{"id": "d1", "n": "1", "title": "Gritty Life", "note": "Ethan in a bar, early on: whiskey, wit and nowhere to go.", "film": "Duet"}, {"id": "d2", "n": "2", "title": "Words", "note": "Annie at choir rehearsal. Ethan hears her and knows.", "film": "Duet"}, {"id": "d3", "n": "3", "title": "We Had a Good Run", "note": "Annie records alone, for Ethan to carry to Nashville.", "film": "Duet"}, {"id": "d4", "n": "4", "title": "Needing Nothing More", "note": "Their first duet, at a café, just before the accident.", "film": "Duet"}, {"id": "d5", "n": "5", "title": "Beverly", "note": "An old, unreleased love song that surfaces in rehab.", "film": "Duet"}, {"id": "d6", "n": "6", "title": "A Love So Fine", "note": "The second duet: love lasts when both can bend.", "film": "Duet"}, {"id": "d7", "n": "7", "title": "With a Little Hope", "note": "Annie, on her own, after Ethan pulls away.", "film": "Duet"}, {"id": "d8", "n": "8", "title": "Reputations", "note": "Ethan’s pride, and what his name has cost him.", "film": "Duet"}, {"id": "d9", "n": "9", "title": "Lookin’ Back Is My Disease", "note": "Ethan counts what he wasted and who he hurt.", "film": "Duet"}, {"id": "d10", "n": "10", "title": "Voice of Angel", "note": "The final scene. Ethan tells Annie the truth.", "film": "Duet"}, {"id": "a1", "n": "1", "title": "Head in the Clouds", "note": "", "film": "Aileen"}, {"id": "a2", "n": "2", "title": "Where Mermaids Sing", "note": "", "film": "Aileen"}, {"id": "a3", "n": "3", "title": "Marked by Love and Shadow", "note": "", "film": "Aileen"}, {"id": "a4", "n": "4", "title": "Loveless Fool", "note": "", "film": "Aileen"}];
  var EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
  var params = new URLSearchParams(window.location.search);

  var store = {
    get: function (k) { try { return window.sessionStorage.getItem(k); } catch (e) { return null; } },
    set: function (k, v) { try { window.sessionStorage.setItem(k, v); } catch (e) { /* storage unavailable */ } }
  };

  // Preview switches for reviewing states that need a live server or real video:
  //   ?form=failure   ?form=sent   ?teaser=ended
  var state = {
    menu: false,
    cur: null,
    paused: false,
    t: 0,
    sent: params.get('form') === 'sent',
    failed: params.get('form') === 'failure',
    teaserEnded: params.get('teaser') === 'ended',
    errs: {}
  };

  try {
    var saved = JSON.parse(store.get('ng-player') || 'null');
    if (saved && TRACKS.some(function (t) { return t.id === saved.cur; })) {
      state.cur = saved.cur;
      state.paused = !!saved.paused;
      state.t = saved.t || 0;
    }
  } catch (e) { /* ignore a bad saved value */ }

  function all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function now() { return TRACKS.filter(function (t) { return t.id === state.cur; })[0] || null; }
  function clock(secs) { var s = secs % 60; return Math.floor(secs / 60) + ':' + (s < 10 ? '0' : '') + s; }
  function focusSoon(id) { window.setTimeout(function () { var el = document.getElementById(id); if (el) { el.focus(); } }, 60); }

  function save() {
    var n = now();
    store.set('ng-player', JSON.stringify({ cur: n ? n.id : null, paused: state.paused, t: state.t }));
  }

  function render() {
    var n = now();
    var playing = !!n && !state.paused;
    var flags = {
      menuOpen: state.menu,
      hasNow: !!n,
      nowOn: playing,
      nowOff: !!n && state.paused,
      notSent: !state.sent,
      sent: state.sent,
      failed: !state.sent && state.failed,
      errName: !!state.errs.name,
      errEmail: !!state.errs.email,
      errConsent: !!state.errs.consent,
      teaserIdle: !state.teaserEnded,
      teaserEnded: state.teaserEnded
    };
    all('[data-if]').forEach(function (el) { el.hidden = !flags[el.getAttribute('data-if')]; });

    all('[data-track]').forEach(function (btn) {
      var on = playing && btn.getAttribute('data-track') === state.cur;
      btn.classList.toggle('on', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', (on ? 'Pause ' : 'Play ') + btn.getAttribute('data-title'));
      all('[data-on]', btn).forEach(function (el) { el.hidden = !on; });
      all('[data-off]', btn).forEach(function (el) { el.hidden = on; });
    });

    var text = {
      nowTitle: n ? n.title : '',
      nowFilm: n ? n.film : '',
      nowNote: n ? n.note : '',
      nowTime: clock(state.t)
    };
    all('[data-bind]').forEach(function (el) { el.textContent = text[el.getAttribute('data-bind')]; });
    all('[data-label="nowLabel"]').forEach(function (el) { el.setAttribute('aria-label', state.paused ? 'Play' : 'Pause'); });

    var root = document.querySelector('.ng');
    if (root) { root.classList.toggle('has-mini', !!n); }
    var opener = document.getElementById('menu-open');
    if (opener) { opener.setAttribute('aria-expanded', state.menu ? 'true' : 'false'); }
    all('[data-invalid]').forEach(function (el) {
      el.setAttribute('aria-invalid', state.errs[el.getAttribute('data-invalid')] ? 'true' : 'false');
    });
    save();
  }

  function set(next) {
    for (var k in next) { if (Object.prototype.hasOwnProperty.call(next, k)) { state[k] = next[k]; } }
    render();
  }

  // ---------------------------------------------------------------- player
  function toggleTrack(id) {
    var playing = state.cur === id && !state.paused;
    if (playing) { set({ paused: true }); }
    else if (state.cur === id) { set({ paused: false }); }
    else { set({ cur: id, paused: false, t: 0 }); }
  }
  function step(dir) {
    var n = now();
    if (!n) { return; }
    var list = TRACKS.filter(function (t) { return t.film === n.film; });
    var i = list.map(function (t) { return t.id; }).indexOf(n.id);
    set({ cur: list[(i + dir + list.length) % list.length].id, paused: false, t: 0 });
  }
  window.setInterval(function () {
    if (state.cur !== null && !state.paused) {
      state.t += 1;
      all('[data-bind="nowTime"]').forEach(function (el) { el.textContent = clock(state.t); });
      save();
    }
  }, 1000);

  // ---------------------------------------------------------------- menu
  function openMenu() { set({ menu: true }); focusSoon('menu-close'); }
  function closeMenu() { set({ menu: false }); focusSoon('menu-open'); }

  var actions = {
    openMenu: openMenu,
    closeMenu: closeMenu,
    toggleNow: function () { set({ paused: !state.paused }); },
    prev: function () { step(-1); },
    next: function () { step(1); },
    stop: function () { set({ cur: null, paused: false, t: 0 }); }
  };

  document.addEventListener('click', function (e) {
    var act = e.target.closest('[data-act]');
    if (act && actions[act.getAttribute('data-act')]) { actions[act.getAttribute('data-act')](); return; }
    var track = e.target.closest('[data-track]');
    if (track) { toggleTrack(track.getAttribute('data-track')); }
  });

  document.addEventListener('keydown', function (e) {
    var sheet = document.getElementById('menu');
    if (!state.menu || !sheet) { return; }
    if (e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (e.key !== 'Tab') { return; }
    var f = all('a[href], button', sheet);
    if (!f.length) { return; }
    var first = f[0];
    var last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });

  // ---------------------------------------------------------------- forms
  // The forms are not connected to a server. Sending shows the confirmation only.
  function checkSoon(key, bad) {
    window.setTimeout(function () {
      if (state.sent) { return; }
      var next = {};
      for (var k in state.errs) { if (Object.prototype.hasOwnProperty.call(state.errs, k)) { next[k] = state.errs[k]; } }
      next[key] = bad;
      set({ errs: next });
    }, 180);
  }
  document.addEventListener('focusout', function (e) {
    var el = e.target;
    if (!el || !el.getAttribute) { return; }
    var kind = el.getAttribute('data-blur');
    if (kind === 'name') { checkSoon('name', !el.value.trim()); }
    if (kind === 'email') { checkSoon('email', !EMAIL_RE.test(el.value.trim())); }
  });
  document.addEventListener('submit', function (e) {
    var form = e.target;
    if (!form.hasAttribute('data-form')) { return; }
    e.preventDefault();
    var f = form.elements;
    var next = {
      name: !f.fullname.value.trim(),
      email: !EMAIL_RE.test(f.email.value.trim()),
      consent: f.consent ? !f.consent.checked : false
    };
    if (next.name || next.email || next.consent) {
      set({ errs: next });
      focusSoon(next.name ? 'fullname' : (next.email ? 'email' : 'consent'));
      return;
    }
    set({ sent: true, errs: {} });
    window.setTimeout(function () {
      var el = document.getElementById('sent');
      if (!el) { return; }
      el.focus({ preventScroll: true });
      var panel = el.closest('.panel');
      if (panel) { panel.scrollIntoView({ block: 'nearest' }); }
    }, 60);
  });

  render();
})();
