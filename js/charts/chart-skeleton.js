/**
 * Shared themed skeleton + error states for charts 05–08.
 * window.ChartSkeleton(kind, label) -> skeleton HTML  (kind: "stack"|"waffle"|"grouped"|"ridge")
 * window.ChartError(label, message) -> themed error HTML
 */
(function () {
  function stack() {
    return [
      '<div class="ph-skel ph-skel--stack">',
      '  <div class="ph-stackbar">',
      '    <span class="ph-bone" style="flex:1.0"></span>',
      '    <span class="ph-bone" style="flex:0.8"></span>',
      '    <span class="ph-bone" style="flex:1.9"></span>',
      '    <span class="ph-bone" style="flex:2.6"></span>',
      '    <span class="ph-bone" style="flex:1.5"></span>',
      '    <span class="ph-bone" style="flex:1.0"></span>',
      '  </div>',
      '  <div class="ph-legend">',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(79,111,136,0.5)"></span><span class="ph-bone ph-bar" style="width:96px"></span></div>',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(125,155,181,0.5)"></span><span class="ph-bone ph-bar" style="width:78px"></span></div>',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(243,178,74,0.5)"></span><span class="ph-bone ph-bar" style="width:108px"></span></div>',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(239,106,28,0.5)"></span><span class="ph-bone ph-bar" style="width:84px"></span></div>',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(207,65,23,0.5)"></span><span class="ph-bone ph-bar" style="width:100px"></span></div>',
      '    <div class="ph-row"><span class="ph-bone ph-sw" style="background:rgba(138,71,51,0.5)"></span><span class="ph-bone ph-bar" style="width:70px"></span></div>',
      '  </div>',
      '</div>'
    ].join("");
  }
  function waffle() {
    return '<div class="ph-skel ph-skel--waffle"><div class="ph-bone ph-waffle"></div></div>';
  }
  function grouped() {
    var cluster = function (h1, h2, h3) {
      return '<div class="ph-cluster">' +
        '<span class="ph-bone" style="height:' + h1 + '%;background:rgba(246,192,83,0.16)"></span>' +
        '<span class="ph-bone" style="height:' + h2 + '%;background:rgba(224,82,31,0.16)"></span>' +
        '<span class="ph-bone" style="height:' + h3 + '%;background:rgba(125,155,181,0.16)"></span>' +
        '</div>';
    };
    return '<div class="ph-skel ph-skel--grouped">' +
      cluster(42, 30, 54) + cluster(62, 48, 38) + cluster(80, 66, 34) + '</div>';
  }
  function ridge() {
    return [
      '<div class="ph-skel ph-skel--ridge">',
      '  <svg class="ph-ridge" viewBox="0 0 320 150" preserveAspectRatio="none" aria-hidden="true">',
      '    <path d="M0,72 C60,22 110,32 160,56 C210,80 260,40 320,62 L320,150 L0,150 Z" fill="rgba(239,106,58,0.18)"></path>',
      '    <path d="M0,100 C50,72 120,82 170,96 C220,110 270,86 320,100 L320,150 L0,150 Z" fill="rgba(243,178,74,0.16)"></path>',
      '    <path d="M0,128 C70,110 130,118 190,122 C250,126 290,116 320,124 L320,150 L0,150 Z" fill="rgba(125,155,181,0.16)"></path>',
      '  </svg>',
      '</div>'
    ].join("");
  }
  var KINDS = { stack: stack, waffle: waffle, grouped: grouped, ridge: ridge };
  window.ChartSkeleton = function (kind, label) {
    var body = (KINDS[kind] || waffle)();
    return '<div class="ph ph--inline">' + body +
      '<div class="ph-foot"><span class="ph-pulse"></span> ' + (label || "Rendering") + '</div></div>';
  };
  window.ChartError = function (label, message) {
    return '<div class="ph ph--inline ph--error">' +
      '<div class="ph-skel">' +
      '  <svg class="ph-err-ic" width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">' +
      '    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path>' +
      '    <line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line>' +
      '  </svg>' +
      '  <div class="ph-err-title">' + (label || "Chart") + ' could not load</div>' +
      '  <div class="ph-err-msg">' + (message || "") + '</div>' +
      '</div></div>';
  };
})();
