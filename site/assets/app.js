// 개 신고 현장 가이드 — data.json(빌드 결과)을 읽어 화면을 그린다.
(function () {
  "use strict";
  var D = null;
  var $bar = document.getElementById("appbar");
  var $view = document.getElementById("view");
  var $tabs = document.getElementById("tabs");
  var query = "";

  var ICON = {
    back: '<path d="M15 5l-7 7 7 7"/>',
    star: '<path d="M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z"/>',
    home: '<path d="M3.5 11 12 4l8.5 7"/><path d="M6 9.5V20h12V9.5"/>',
    law: '<path d="M6 3h9l3 3v15H6z"/><path d="M9 10h6M9 14h6M9 18h4"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>'
  };
  function svg(name) { return '<svg viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + "</svg>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function strip(h) { return String(h).replace(/<[^>]+>/g, " "); }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ""); }

  // ---- 즐겨찾기 (이 기기에만 저장) ----
  function favs() { try { return JSON.parse(localStorage.getItem("favs") || "[]"); } catch (e) { return []; } }
  function setFavs(a) { try { localStorage.setItem("favs", JSON.stringify(a)); } catch (e) { /* 저장 불가 환경 */ } }
  function toggleFav(id) { var a = favs(), i = a.indexOf(id); if (i < 0) a.unshift(id); else a.splice(i, 1); setFavs(a); }

  // ---- 공통 조각 ----
  function bar(title, back, extra) {
    $bar.innerHTML = (back ? '<button class="iconbtn" data-act="back" aria-label="뒤로">' + svg("back") + "</button>" : "") +
      '<div class="t">' + esc(title) + "</div>" + (extra || "");
  }
  function tabs(active) {
    var items = [["home", "홈", "#/"], ["law", "법령", "#/law"], ["star", "즐겨찾기", "#/fav"]];
    $tabs.innerHTML = '<div class="in">' + items.map(function (t) {
      return '<button class="' + (active === t[0] ? "on" : "") + '" data-go="' + t[2] + '">' + svg(t[0]) + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function badge(v) { return '<span class="v v-' + esc(v) + '">' + esc(v) + "</span>"; }
  function catName(id) { var c = D.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : ""; }
  function caseRow(c) {
    return '<a class="case" href="#/k/' + encodeURIComponent(c.id) + '"><span class="tx"><b>' + esc(c.title) + "</b><small>" +
      esc(catName(c.cat) + (c.group ? " · " + c.group : "")) + "</small></span>" + badge(c.verdict) + "</a>";
  }

  // ---- 화면들 ----
  function viewHome() {
    bar("개 신고 현장 가이드", false, '<span class="d">' + esc(D.updated) + "</span>");
    tabs("home");
    var h = '<label class="search">' + svg("search") +
      '<input id="q" type="search" enterkeyhint="search" placeholder="예: 엘리베이터 소변, 줄 놓침, 입마개" autocomplete="off" value="' + esc(query) + '" aria-label="사례 검색">' +
      (query ? '<button class="clear" data-act="clear" aria-label="검색어 지우기">×</button>' : "") + "</label>";
    h += '<div id="results">' + (query ? results() : homeBody()) + "</div>";
    $view.innerHTML = h;
    var q = document.getElementById("q");
    q.addEventListener("input", function () {
      query = q.value;
      document.getElementById("results").innerHTML = query.trim() ? results() : homeBody();
      try { history.replaceState(null, "", query.trim() ? "#/s/" + encodeURIComponent(query) : "#/"); } catch (e) { /* 무시 */ }
    });
  }
  function homeBody() {
    var h = '<div class="cats">' + D.categories.map(function (c) {
      return '<a class="cat" href="#/c/' + encodeURIComponent(c.id) + '" style="text-decoration:none;color:inherit"><b>' + esc(c.name) +
        "</b><span>" + esc(c.summary) + "</span><i>" + c.cases.length + "건</i></a>";
    }).join("") + "</div>";
    if (D.home) h += '<div class="sect">현장 핵심</div><div class="card prose">' + D.home + "</div>";
    h += '<p class="foot">현장 참고용 자료입니다. 최종 판단은 법령 원문과 관서 방침을 따르세요.<br>최종 수정 ' + esc(D.updated) +
      ' · <a href="https://github.com/' + D.repo + '" target="_blank" rel="noopener">내용 수정(GitHub)</a></p>';
    return h;
  }
  function results() {
    var words = query.trim().split(/\s+/).map(norm).filter(Boolean);
    var scored = [];
    Object.keys(D.cases).forEach(function (id) {
      var c = D.cases[id];
      var title = norm(c.title + " " + c.keywords + " " + c.group);
      var all = title + norm(catName(c.cat) + strip(c.action) + strip(c.note) + c.checks.join(" ") +
        c.laws.map(function (l) { return l.law + l.penalty + l.note; }).join(" "));
      var score = 0, ok = words.every(function (w) {
        if (title.indexOf(w) >= 0) { score += 3; return true; }
        if (all.indexOf(w) >= 0) { score += 1; return true; }
        return false;
      });
      if (ok) scored.push([score, c]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    if (!scored.length) return '<p class="empty">찾는 사례가 없습니다. 다른 낱말로 검색하거나 아래 홈에서 상황을 고르세요.</p>';
    return '<div class="sect">검색 결과 ' + scored.length + '건</div><div class="list">' + scored.map(function (s) { return caseRow(s[1]); }).join("") + "</div>";
  }
  function viewCat(id) {
    var c = D.categories.filter(function (x) { return x.id === id; })[0];
    if (!c) return notFound();
    bar(c.name, true, '<span class="d">' + c.cases.length + "건</span>");
    tabs("home");
    var h = c.intro ? '<div class="card prose">' + c.intro + "</div>" : "";
    var groups = [];
    c.cases.forEach(function (cid) { var g = D.cases[cid].group || ""; if (groups.indexOf(g) < 0) groups.push(g); });
    groups.forEach(function (g) {
      if (g) h += '<div class="sect">' + esc(g) + "</div>";
      h += '<div class="list">' + c.cases.filter(function (cid) { return (D.cases[cid].group || "") === g; })
        .map(function (cid) { return caseRow(D.cases[cid]); }).join("") + "</div>";
    });
    $view.innerHTML = h;
  }
  function viewCase(id) {
    var c = D.cases[id];
    if (!c) return notFound();
    var fav = favs().indexOf(id) >= 0;
    bar(catName(c.cat), true, '<button class="iconbtn' + (fav ? " on" : "") + '" data-act="fav" data-id="' + esc(id) + '" aria-label="즐겨찾기" aria-pressed="' + fav + '">' + svg("star") + "</button>");
    tabs("home");
    var h = '<div class="casehead">' + badge(c.verdict) + "<h1>" + esc(c.title) + "</h1></div>";
    if (c.laws.length) h += '<div class="card"><h3>적용법조 · 처벌</h3>' + c.laws.map(function (l) {
      return '<div class="law"><span class="n">' + esc(l.law) + '</span><span class="p">' + esc(l.penalty) + "</span>" + (l.note ? '<span class="h">' + esc(l.note) + "</span>" : "") + "</div>";
    }).join("") + "</div>";
    if (c.checks.length) h += '<div class="card"><h3>현장 확인사항</h3><ul class="chk">' + c.checks.map(function (x, i) {
      return '<li><label><input type="checkbox" id="ck-' + i + '"><span>' + esc(x) + "</span></label></li>";
    }).join("") + "</ul></div>";
    if (c.action) h += '<div class="card"><h3>처리방향</h3><div class="prose">' + c.action + "</div></div>";
    if (c.note) h += '<div class="card"><h3>참고</h3><div class="prose">' + c.note + "</div></div>";
    if (c.photos.length) h += '<div class="card"><h3>참고 그림</h3><div class="photos">' + c.photos.map(function (p) {
      return '<figure class="photo"><a href="' + esc(p.src) + '" target="_blank" rel="noopener"><img src="' + esc(p.src) + '" alt="' + esc(p.caption) + '" loading="lazy"></a>' +
        (p.caption ? "<figcaption>" + esc(p.caption) + "</figcaption>" : "") + "</figure>";
    }).join("") + "</div></div>";
    h += '<div class="status' + (c.verified ? " done" : "") + '">' + (c.verified ? "✓ 법령 원문 대조 완료" : "! 일부 해석 확인 중 · 관서 방침을 함께 확인하세요") + "</div>";
    h += '<p class="editlink"><a href="https://github.com/' + D.repo + "/edit/main/" + encodeURI(c.path) + '" target="_blank" rel="noopener">GitHub에서 이 사례 수정</a></p>';
    $view.innerHTML = h;
  }
  function viewLaws() {
    bar("법령", false);
    tabs("law");
    $view.innerHTML = '<p class="note-muted">개 관련 조문만 모았습니다. 원문은 각 조문의 국가법령정보센터 링크에서 확인하세요.</p><div class="list lawlist">' +
      D.laws.map(function (l) {
        return '<a class="case" href="#/law/' + encodeURIComponent(l.id) + '"><span class="tx"><b>' + esc(l.name) + "</b><small>시행 " + esc(l.effective) + " · 조문 " + l.articles.length + "개</small></span></a>";
      }).join("") + "</div>";
  }
  function viewLaw(id) {
    var l = D.laws.filter(function (x) { return x.id === id; })[0];
    if (!l) return notFound();
    bar(l.name, true);
    tabs("law");
    var h = (l.intro ? '<div class="note-muted prose">' + l.intro + "</div>" : "") + '<div class="card">';
    h += l.articles.map(function (a) {
      return '<section class="art"><h2>' + esc(a.title) + '</h2><div class="prose">' + a.html + "</div>" +
        (a.url ? '<a class="src" href="' + a.url + '" target="_blank" rel="noopener">국가법령정보센터에서 보기</a>' : "") + "</section>";
    }).join("") + "</div>";
    h += '<p class="note-muted">시행일 ' + esc(l.effective) + ' 기준 · <a href="https://github.com/' + D.repo + "/edit/main/" + encodeURI(l.path) + '" target="_blank" rel="noopener">GitHub에서 수정</a></p>';
    $view.innerHTML = h;
  }
  function viewFav() {
    bar("즐겨찾기", false);
    tabs("star");
    var a = favs().filter(function (id) { return D.cases[id]; });
    $view.innerHTML = a.length ? '<div class="list">' + a.map(function (id) { return caseRow(D.cases[id]); }).join("") + "</div>" :
      '<p class="empty">사례 화면 오른쪽 위의 ☆를 누르면 여기에 모입니다.<br>즐겨찾기는 이 휴대폰에만 저장됩니다.</p>';
  }
  function notFound() {
    bar("찾을 수 없음", true);
    tabs("home");
    $view.innerHTML = '<p class="empty">이 사례는 이름이 바뀌었거나 삭제되었습니다. 홈에서 다시 찾아 주세요.</p>';
  }

  // ---- 이동 ----
  function route() {
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var p = h.split("/");
    if (p[0] === "c") viewCat(p.slice(1).join("/"));
    else if (p[0] === "k") viewCase(p.slice(1).join("/"));
    else if (p[0] === "law" && p[1]) viewLaw(p.slice(1).join("/"));
    else if (p[0] === "law") viewLaws();
    else if (p[0] === "fav") viewFav();
    else { if (p[0] === "s") query = p.slice(1).join("/"); viewHome(); }
    if (p[0] !== "s") window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var b = e.target.closest("[data-act],[data-go]");
    if (!b) return;
    if (b.dataset.go) {
      if (b.dataset.go === "#/") query = "";
      if (location.hash === b.dataset.go || (b.dataset.go === "#/" && !location.hash)) route(); else location.hash = b.dataset.go;
      return;
    }
    var act = b.dataset.act;
    if (act === "back") { if (history.length > 1) history.back(); else location.hash = "#/"; }
    else if (act === "clear") { query = ""; if (location.hash === "#/" || !location.hash) route(); else location.hash = "#/"; }
    else if (act === "fav") { toggleFav(b.dataset.id); viewCase(b.dataset.id); }
  });
  window.addEventListener("hashchange", route);

  fetch("data.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) { D = d; route(); })
    .catch(function () { $view.innerHTML = '<p class="empty">자료를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.</p>'; });

  if ("serviceWorker" in navigator && location.protocol === "https:" && /github\.io$/.test(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* 오프라인 기능 없이 동작 */ });
  }
})();
