// CTA의 "Other Program" 드롭다운 — 클릭으로 열고, 바깥 클릭/Esc로 닫습니다.
(function () {
  function closeAll(except) {
    document.querySelectorAll('[data-prog-switch].open').forEach(function (sw) {
      if (sw === except) return;
      sw.classList.remove('open');
      var btn = sw.querySelector('.prog-switch-btn');
      if (btn) btn.setAttribute('aria-expanded', 'false');
    });
  }

  // 아래 공간이 모자라면 버튼 위로 펼칩니다 (CTA가 푸터 바로 위에 있어서 필요).
  function place(sw) {
    var btn = sw.querySelector('.prog-switch-btn');
    var menu = sw.querySelector('.prog-switch-menu');
    if (!btn || !menu) return;
    sw.classList.remove('up');
    var GAP = 24;
    var height = menu.offsetHeight; // visibility:hidden 이어도 레이아웃은 잡혀 있음
    var rect = btn.getBoundingClientRect();
    var roomBelow = window.innerHeight - rect.bottom;
    var roomAbove = rect.top;
    if (roomBelow < height + GAP && roomAbove > roomBelow) sw.classList.add('up');
  }

  function init() {
    var switches = document.querySelectorAll('[data-prog-switch]');
    if (!switches.length) return;

    switches.forEach(function (sw) {
      var btn = sw.querySelector('.prog-switch-btn');
      if (!btn) return;
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var willOpen = !sw.classList.contains('open');
        closeAll(sw);
        if (willOpen) place(sw);
        sw.classList.toggle('open', willOpen);
        btn.setAttribute('aria-expanded', String(willOpen));
      });
    });

    window.addEventListener('resize', function () {
      document.querySelectorAll('[data-prog-switch].open').forEach(place);
    }, { passive: true });

    document.addEventListener('click', function (e) {
      document.querySelectorAll('[data-prog-switch].open').forEach(function (sw) {
        if (!sw.contains(e.target)) {
          sw.classList.remove('open');
          var btn = sw.querySelector('.prog-switch-btn');
          if (btn) btn.setAttribute('aria-expanded', 'false');
        }
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      var open = document.querySelector('[data-prog-switch].open');
      if (!open) return;
      closeAll();
      var btn = open.querySelector('.prog-switch-btn');
      if (btn) btn.focus();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
