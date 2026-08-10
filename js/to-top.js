/* 맨 위로 버튼
   페이지마다 마크업을 넣지 않도록, 스크립트가 버튼을 직접 만들어 붙인다.
   각 페이지에는 <script src="/js/to-top.js" defer></script> 한 줄만 추가하면 된다. */
(function () {
  var SHOW_AFTER = 480;   // 이만큼 내려가면 나타난다

  function init() {
    if (document.getElementById('toTopBtn')) return;

    var btn = document.createElement('button');
    btn.id = 'toTopBtn';
    btn.className = 'to-top';
    btn.type = 'button';
    btn.setAttribute('aria-label', '맨 위로 이동');
    btn.innerHTML =
      '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"' +
      ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M12 19V5M5 12l7-7 7 7"/></svg>';
    document.body.appendChild(btn);

    var shown = false;
    function onScroll() {
      var should = window.scrollY > SHOW_AFTER;
      if (should === shown) return;
      shown = should;
      btn.classList.toggle('is-visible', shown);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    btn.addEventListener('click', function () {
      var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' });
      /* 스크롤이 끝나면 포커스를 페이지 처음으로 돌려 키보드 사용자가 이어서 탐색하게 한다 */
      var nav = document.getElementById('nav');
      if (nav) {
        var logo = nav.querySelector('a');
        if (logo) setTimeout(function () { logo.focus({ preventScroll: true }); }, reduce ? 0 : 500);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
