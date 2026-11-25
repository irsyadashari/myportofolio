// Screenshot reels: each .shots strip becomes a centered carousel that advances on its own.
// Visitors can swipe, drag with the mouse, use the arrow buttons or keys, or tap any faded
// screenshot to bring it to the center. Autoplay pauses briefly after an interaction, stays
// paused while the reel is off screen, and never starts for people who ask for reduced motion.
(function () {
  var INTERVAL = 3200;   // ms per screenshot
  var HOLD = 5000;       // ms to wait after the visitor interacts before playing again
  var DRAG_THRESHOLD = 6;
  var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var ICON_PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/><rect x="9.5" y="2.5" width="3" height="11" rx="1" fill="currentColor"/></svg>';
  var ICON_PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M4.5 2.8v10.4c0 .6.7 1 1.2.6l8-5.2c.5-.3.5-1 0-1.3l-8-5.2c-.5-.3-1.2.1-1.2.7z" fill="currentColor"/></svg>';
  var ICON_PREV = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 3 5 8l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  var ICON_NEXT = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="m6 3 5 5-5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function button(cls, html, label, onClick) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = cls;
    if (html) b.innerHTML = html;
    if (label) b.setAttribute('aria-label', label);
    b.addEventListener('click', onClick);
    return b;
  }

  function setupReel(strip) {
    var imgs = Array.prototype.slice.call(strip.querySelectorAll('img'));
    if (imgs.length < 2) return;

    var label = (strip.getAttribute('aria-label') || 'Screenshots').replace(/, scroll sideways$/, '');
    var index = 0;
    var timer = null;
    var visible = false;
    var userPaused = reduceMotion;
    var holdUntil = 0;
    var lastWidth = window.innerWidth;

    imgs.forEach(function (img, i) {
      img.loading = 'eager';
      img.draggable = false;
      img.addEventListener('click', function () {
        if (dragMoved) return;          // a drag, not a tap
        hold();
        go(i);
      });
    });

    // Controls: previous, one dot per screenshot, next, play/pause.
    var controls = document.createElement('div');
    controls.className = 'reel-controls';
    var prev = button('reel-btn', ICON_PREV, 'Previous ' + label, function () { hold(); go(index - 1); });
    var next = button('reel-btn', ICON_NEXT, 'Next ' + label, function () { hold(); go(index + 1); });
    var dots = document.createElement('div');
    dots.className = 'reel-dots';
    imgs.forEach(function (_, i) {
      dots.appendChild(button('', '', label + ', screenshot ' + (i + 1) + ' of ' + imgs.length,
        function () { hold(); go(i); }));
    });
    var toggle = button('reel-btn reel-toggle', '', '', function () {
      userPaused = !userPaused;
      holdUntil = 0;
      sync();
      restartTimer();
    });
    controls.appendChild(prev);
    controls.appendChild(dots);
    controls.appendChild(next);
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
      imgs.forEach(function (img, n) {
        img.classList.toggle('is-active', n === i);
        img.setAttribute('aria-current', n === i ? 'true' : 'false');
      });
      Array.prototype.forEach.call(dots.children, function (d, n) {
        if (n === i) d.setAttribute('aria-current', 'true'); else d.removeAttribute('aria-current');
      });
    }

    function playing() {
      return visible && !userPaused && Date.now() >= holdUntil && !document.hidden;
    }

    function restartTimer() {
      clearTimeout(timer);
      timer = setTimeout(tick, Math.max(INTERVAL, holdUntil - Date.now() + INTERVAL / 2));
      sync();
    }

    function tick() {
      if (playing()) go(index + 1);
      else restartTimer();
    }

    function sync() {
      strip.classList.toggle('is-playing', playing());
      toggle.innerHTML = userPaused ? ICON_PLAY : ICON_PAUSE;
      toggle.setAttribute('aria-label', (userPaused ? 'Play ' : 'Pause ') + label);
    }

    function hold() {
      holdUntil = Date.now() + HOLD;
      restartTimer();
    }

    // Keep the highlighted screenshot in step with manual swipes, drags and scrolls.
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

    // Mouse drag to scroll (touch screens already swipe natively).
    var dragging = false, dragMoved = false, startX = 0, startLeft = 0;
    strip.addEventListener('pointerdown', function (e) {
      dragMoved = false;
      if (e.pointerType !== 'mouse' || e.button !== 0) { if (e.pointerType !== 'mouse') hold(); return; }
      dragging = true;
      startX = e.clientX;
      startLeft = strip.scrollLeft;
      hold();
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - startX;
      if (!dragMoved && Math.abs(dx) > DRAG_THRESHOLD) {
        dragMoved = true;
        strip.classList.add('is-dragging');
      }
      if (dragMoved) strip.scrollLeft = startLeft - dx;
    });
    window.addEventListener('pointerup', function () {
      if (!dragging) return;
      dragging = false;
      if (dragMoved) {
        strip.classList.remove('is-dragging');
        go(index);                     // settle on the nearest screenshot
        setTimeout(function () { dragMoved = false; }, 0);
      }
    });

    // Only a sideways wheel or trackpad swipe counts as using the reel; page scrolling does not.
    strip.addEventListener('wheel', function (e) {
      if (Math.abs(e.deltaX) > Math.abs(e.deltaY)) hold();
    }, { passive: true });

    strip.addEventListener('keydown', function (e) {
      if (e.key === 'ArrowRight') { e.preventDefault(); hold(); go(index + 1); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); hold(); go(index - 1); }
    });

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(function (entries) {
        visible = entries[0].isIntersecting;
        restartTimer();
      }, { threshold: 0.3 }).observe(strip);
    } else {
      visible = true;
    }
    document.addEventListener('visibilitychange', function () { restartTimer(); });

    // Re-center only when the width really changes; phones fire resize when the address bar moves.
    window.addEventListener('resize', function () {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      strip.scrollTo({ left: centerOf(imgs[index]), behavior: 'auto' });
    });

    go(0, true);
  }

  Array.prototype.forEach.call(document.querySelectorAll('.shots'), setupReel);
})();
