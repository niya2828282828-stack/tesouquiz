
/*
 * スマホ向け操作補助
 * ・ダブルタップによる拡大を抑制
 * ・スクロールやピンチ操作は妨げない
 */

(() => {
  let lastTouchEnd = 0;

  document.addEventListener(
    "touchend",
    event => {
      const now = Date.now();
      const elapsed = now - lastTouchEnd;

      // 短時間の連続タップによる拡大を抑制
      if (elapsed > 0 && elapsed < 300) {
        event.preventDefault();
      }

      lastTouchEnd = now;
    },
    { passive: false }
  );
})();
