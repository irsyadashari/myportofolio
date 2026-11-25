// Screenshot reels: each .shots strip becomes a centered carousel that advances on its own.
// It plays only while visible, holds while the visitor hovers, swipes or uses the keyboard,
// has a pause button, and never autoplays for people who ask for reduced motion.
(function () {
  var INTERVAL = 3200;   // ms per screenshot
  var HOLD = 6000;       // ms to wait after the visitor interacts before playing again
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2c.5-.3.5-1 0-1.3l-8-5.2c-.5-.3-1.2.1-1.2.7z" fill="currentColor"/></svg>';

  function setupReel(strip) {
    var imgs = Array.prototype.slice.call(strip.querySelectorAll('img'));
    if (imgs.length < 2) return;
    imgs.forEach(function (img) { img.loading = 'eager'; });

    var label = (strip.getAttribute('aria-label') || 'Screenshots').replace(/, scroll sideways$/, '');
    var index = 0;
    var timer = null;
    var visible = false;
    var userPaused = reduceMotion;
    var holdUntil = 0;
    var hovering = false;

    // Controls: one dot per screenshot plus a play/pause button.
    var controls = document.createElement('div');
    controls.className = 'reel-controls';
    var dots = document.createElement('div');
    dots.className = 'reel-dots';
    imgs.forEach(function (_, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('aria-label', label + ', screenshot ' + (i + 1) + ' of ' + imgs.length);
      b.addEventListener('click', function () { hold(); go(i); });
      dots.appendChild(b);
    });
    var toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'reel-toggle';
    toggle.addEventListener('click', function () {
      userPaused = !userPaused;
      holdUntil = 0;
      sync();
    });
    controls.appendChild(dots);
    controls.appendChild(toggle);
    strip.parentNode.insertBefore(controls, strip.nextSibling);
    strip.style.setProperty('--reel-ms', INTERVAL + 'ms');
    strip.classList.add('reel-ready');

    function centerOf(img) {
      return img.offsetLeft + img.offsetWidth / 2 - strip.clientWidth / 2;
    }

    function go(i, instant) {
      index = (i + imgs.length) % imgs.length;
      strip.scrollTo({ left: centerOf(imgs[index]), behavior: instant || reduceMotion ? 'auto' : 'smooth' });
      mark(index);
      restartTimer();
    }

    function mark(i) {
      imgs.forEach(function (img, n) { img.classList.toggle('is-active', n === i); });
      Array.prototype.forEach.call(dots.children, function (d, n) {
        if (n === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    function playing() {
      return visible && !userPaused && !hovering && Date.now() >= holdUntil && !document.hidden;
    }

    function restartTimer() {
      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(INTERVAL, holdUntil - Date.now()));
    }

    function tick() {
      if (playing()) go(index + 1);
      else restartTimer();
      sync();
    }

    function sync() {
      var on = playing();
      strip.classList.toggle('is-playing', on);
      toggle.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE;
      toggle.setAttribute('aria-label', (userPaused ? 'Play ' : 'Pause ') + label);
    }

    function hold() {
      holdUntil = Date.now() + HOLD;
      sync();
      restartTimer();
    }

    // Keep the active screenshot in step with manual swipes and scrolls.
    var raf = 0;
    strip.addEventListener('scroll', function () {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(function () {
        var mid = strip.scrollLeft + strip.clientWidth / 2;
        var best = 0, bestDist = Infinity;
        imgs.forEach(function (img, n) {
          var d = Math.abs(img.offsetLeft + img.offsetWidth / 2 - mid);
          if (d < bestDist) { bestDist = d; best = n; }
        });
        if (best !== index) { index = best; mark(index); }
      });
    }, { passive: true });

    ['pointerdown', 'wheel', 'touchstart', 'keydown'].forEach(function (ev) {
      strip.addEventListener(ev, hold, { passive: true });
    });
    strip.addEventListener('mouseenter', function () { hovering = true; sync(); });
    strip.addEventListener('mouseleave', function () { hovering = false; sync(); restartTimer(); });
    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(index - 1); }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        sync();
        if (visible) restartTimer();
      }, { threshold: 0.5 }).observe(strip);
    } else {
      visible = true;
    }
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('resize', function () { go(index, true); });

    go(0, true);
    sync();
  }

  Array.prototype.forEach.call(document.querySelectorAll('.shots'), setupReel);
})();
