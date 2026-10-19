
/*
 * スマホ向け操作補助
 * ・通常の連続タップを妨げない
 * ・タップイベントを一律にキャンセルしない
 * ・ダブルタップによる拡大は mobile.css の
 *   touch-action: manipulation で抑制する
 */

(() => {
  "use strict";

  // 対応ブラウザで、操作設定が適用されていることを確認できるようにする
  document.documentElement.classList.add("mobile-interaction-ready");
})();
