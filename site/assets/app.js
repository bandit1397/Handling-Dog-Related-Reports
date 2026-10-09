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
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    leash: '<circle cx="7" cy="7" r="3.5"/><path d="M9.5 9.5 19 19M15.5 19H19v-3.5"/>',
    shield: '<path d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6z"/><path d="M12 8v5M12 16v.5"/>',
    drop: '<path d="M12 3.5s6 6.3 6 10.8a6 6 0 0 1-12 0c0-4.5 6-10.8 6-10.8z"/>',
    aid: '<rect x="3.5" y="5.5" width="17" height="13" rx="3"/><path d="M12 9v6M9 12h6"/>',
    warn: '<path d="M12 4 21 20H3z"/><path d="M12 10v4M12 17v.5"/>',
    tag: '<path d="M3.5 12.5 11 5h8v8l-7.5 7.5z"/><circle cx="15.5" cy="8.5" r="1.5"/>',
    more: '<circle cx="6" cy="12" r="1.7"/><circle cx="12" cy="12" r="1.7"/><circle cx="18" cy="12" r="1.7"/>',
    scale: '<path d="M12 4v16M7 20h10M5 7h14M5 7l-2.5 6a2.5 2.5 0 0 0 5 0zM19 7l-2.5 6a2.5 2.5 0 0 0 5 0z"/>',
    check: '<path d="M4 12.5 9 17.5 20 6.5"/>',
    arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
    info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
    image: '<rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="m4 18 5-5 4 4 3-3 4 4"/>',
    bolt: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
    chev: '<path d="M9 5l7 7-7 7"/>'
  };
  function svg(name, cls) { return '<svg class="' + (cls || "") + '" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + "</svg>"; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  function strip(h) { return String(h).replace(/<[^>]+>/g, " "); }
  function norm(s) { return String(s).toLowerCase().replace(/\s+/g, ""); }

  // ---- 즐겨찾기 (이 기기에만 저장) ----
  function favs() { try { return JSON.parse(localStorage.getItem("favs") || "[]"); } catch (e) { return []; } }
  function setFavs(a) { try { localStorage.setItem("favs", JSON.stringify(a)); } catch (e) { /* 저장 불가 환경 */ } }
  function toggleFav(id) { var a = favs(), i = a.indexOf(id); if (i < 0) a.unshift(id); else a.splice(i, 1); setFavs(a); }

  // ---- 상황별 색과 아이콘 ----
  function catOf(id) { return D.categories.filter(function (x) { return x.id === id; })[0]; }
  function catName(id) { var c = catOf(id); return c ? c.name : ""; }
  function catStyle(id) {
    var n = (D.categories.map(function (x) { return x.id; }).indexOf(id) % 8) + 1;
    return "--c:var(--c" + n + ");--cs:var(--c" + n + "s)";
  }
  function catIcon(name) {
    if (/목줄|안전조치/.test(name)) return "leash";
    if (/맹견|입마개/.test(name)) return "shield";
    if (/배설|대변|소변/.test(name)) return "drop";
    if (/물림|상해/.test(name)) return "aid";
    if (/위험|행패/.test(name)) return "warn";
    if (/인식표|등록/.test(name)) return "tag";
    return "more";
  }
  // 처벌 문구로 종류를 가려 색을 정한다
  function sevOf(t) {
    t = strip(t);
    if (/범칙금/.test(t)) return ["s-ticket", "범칙금"];
    if (/과태료/.test(t)) return ["s-fine", "과태료"];
    if (/징역|금고|벌금|구류/.test(t)) return ["s-crime", "형사"];
    if (/민사|손해배상/.test(t)) return ["s-civil", "민사"];
    return ["", ""];
  }

  // ---- 공통 조각 ----
  function bar(title, back, extra, center) {
    $bar.className = "appbar" + (center ? " center" : "");
    $bar.innerHTML =(back ? '<button class="iconbtn" data-act="back" aria-label="뒤로">' + svg("back") + "</button>" : "") +
      '<div class="t">' + esc(title) + "</div>" + (extra || "");
  }
  function tabs(active) {
    var items = [["home", "홈", "#/"], ["law", "법령", "#/law"], ["star", "즐겨찾기", "#/fav"]];
    $tabs.innerHTML = '<div class="in">' + items.map(function (t) {
      return '<button class="' + (active === t[0] ? "on" : "") + '" data-go="' + t[2] + '">' + svg(t[0]) + t[1] + "</button>";
    }).join("") + "</div>";
  }
  function badge(v) { return '<span class="v v-' + esc(v) + '">' + esc(v) + "</span>"; }
  function card(kind, icon, title, body, sub) {
    return '<section class="card ' + kind + '"><div class="hd">' + svg(icon, "ico") + esc(title) +
      (sub ? '<span class="sub">' + esc(sub) + "</span>" : "") + '</div><div class="bd">' + body + "</div></section>";
  }
  function caseRow(c, showCat) {
    var meta = [showCat ? catName(c.cat) : "", showCat ? c.group : ""].filter(Boolean).join(" · ");
    return '<a class="case" style="' + catStyle(c.cat) + '" href="#/k/' + encodeURIComponent(c.id) + '"><span class="tx"><b>' + esc(c.title) + "</b>" +
      (meta ? "<small>" + esc(meta) + "</small>" : "") + "</span>" + badge(c.verdict) + "</a>";
  }

  // ---- 홈 ----
  function viewHome() {
    bar("개 신고 현장 가이드", false, '<span class="d">' + esc(D.updated) + "</span>", true);
    tabs("home");
    var h = '<label class="search">' + svg("search") +
      '<input id="q" type="search" enterkeyhint="search" placeholder="예: 엘리베이터 소변, 줄 놓침, 입마개" autocomplete="off" value="' + esc(query) + '" aria-label="사례 검색">' +
      (query ? '<button class="clear" data-act="clear" aria-label="검색어 지우기">×</button>' : "") + "</label>";
    h += '<div id="results" style="display:flex;flex-direction:column;gap:14px">' + (query ? results() : homeBody()) + "</div>";
    $view.innerHTML = h;
    var q = document.getElementById("q");
    q.addEventListener("input", function () {
      query = q.value;
      document.getElementById("results").innerHTML = query.trim() ? results() : homeBody();
      try { history.replaceState(null, "", query.trim() ? "#/s/" + encodeURIComponent(query) : "#/"); } catch (e) { /* 무시 */ }
    });
  }
  function homeBody() {
    var h = '<div class="sect">상황별로 찾기</div><div class="cats">' + D.categories.map(function (c) {
      return '<a class="cat" style="' + catStyle(c.id) + '" href="#/c/' + encodeURIComponent(c.id) + '"><span class="top"><span class="badge">' +
        svg(catIcon(c.name), "ico") + '</span><span class="cnt">' + c.cases.length + "건</span></span><b>" + esc(c.name) +
        "</b><span>" + esc(c.summary) + "</span></a>";
    }).join("") + "</div>";
    if (D.home) h += card("k-key", "bolt", "현장 핵심", '<div class="prose">' + D.home + "</div>");
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
      var all = title + norm(catName(c.cat) + strip(c.action) + strip(c.note) + strip(c.checks.join(" ")) +
        c.laws.map(function (l) { return l.text; }).join(" "));
      var score = 0, ok = words.every(function (w) {
        if (title.indexOf(w) >= 0) { score += 3; return true; }
        if (all.indexOf(w) >= 0) { score += 1; return true; }
        return false;
      });
      if (ok) scored.push([score, c]);
    });
    scored.sort(function (a, b) { return b[0] - a[0]; });
    if (!scored.length) return '<p class="empty">찾는 사례가 없습니다. 다른 낱말로 검색하거나 홈에서 상황을 고르세요.</p>';
    return '<div class="sect">검색 결과 <span class="n">' + scored.length + '건</span></div><div class="list">' +
      scored.map(function (s) { return caseRow(s[1], true); }).join("") + "</div>";
  }

  // ---- 상황 ----
  function viewCat(id) {
    var c = catOf(id);
    if (!c) return notFound();
    bar(c.name, true, '<span class="d">' + c.cases.length + "건</span>");
    tabs("home");
    var st = catStyle(c.id);
    var h = '<div class="cathead" style="' + st + '"><div class="band"><span class="badge">' + svg(catIcon(c.name), "ico") +
      "</span><div><h1>" + esc(c.name) + "</h1><small>" + esc(c.summary) + " · 사례 " + c.cases.length + "건</small></div></div>" +
      (c.intro ? '<div class="prose">' + c.intro + "</div>" : "") + "</div>";
    var groups = [];
    c.cases.forEach(function (cid) { var g = D.cases[cid].group || ""; if (groups.indexOf(g) < 0) groups.push(g); });
    groups.forEach(function (g) {
      var ids = c.cases.filter(function (cid) { return (D.cases[cid].group || "") === g; });
      h += '<div class="sect" style="' + st + '">' + esc(g || "사례 목록") + ' <span class="n">' + ids.length + "건</span></div>";
      h += '<div class="list">' + ids.map(function (cid) { return caseRow(D.cases[cid], false); }).join("") + "</div>";
    });
    $view.innerHTML = h;
  }

  // ---- 사례 ----
  function viewCase(id) {
    var c = D.cases[id];
    if (!c) return notFound();
    var fav = favs().indexOf(id) >= 0;
    bar(catName(c.cat), true, '<button class="iconbtn' + (fav ? " on" : "") + '" data-act="fav" data-id="' + esc(id) + '" aria-label="즐겨찾기" aria-pressed="' + fav + '">' + svg("star") + "</button>");
    tabs("home");
    var st = catStyle(c.cat);
    var h = '<div class="casehead" style="' + st + '"><div class="row"><a class="chip" href="#/c/' + encodeURIComponent(c.cat) + '">' +
      svg(catIcon(catName(c.cat)), "ico") + esc(catName(c.cat)) + (c.group ? " · " + esc(c.group) : "") + "</a>" + badge(c.verdict) +
      "</div><h1>" + esc(c.title) + "</h1></div>";
    if (c.laws.length) h += card("k-law", "scale", "적용법조 · 처벌", c.laws.map(function (l) {
      var sv = sevOf(l.penalty);
      return '<div class="law"><span class="n">' + l.law + '</span><span class="p ' + sv[0] + '">' +
        (sv[1] ? '<span class="sev">' + sv[1] + "</span>" : "") + l.penalty + "</span>" + (l.note ? '<span class="h">' + l.note + "</span>" : "") + "</div>";
    }).join(""));
    if (c.checks.length) h += card("k-chk", "check", "현장 확인사항", '<ul class="chk">' + c.checks.map(function (x, i) {
      return '<li><label><input type="checkbox" id="ck-' + i + '"><span>' + x + "</span></label></li>";
    }).join("") + "</ul>", c.checks.length + "개");
    if (c.action) h += '<div style="' + st + '">' + card("k-act", "arrow", "처리방향", '<div class="prose">' + c.action + "</div>") + "</div>";
    if (c.note) h += card("k-note", "info", "참고", '<div class="prose">' + c.note + "</div>");
    if (c.photos.length) h += card("k-pic", "image", "참고 그림", '<div class="photos">' + c.photos.map(function (p) {
      return '<figure class="photo"><a href="' + esc(p.src) + '" target="_blank" rel="noopener"><img src="' + esc(p.src) + '" alt="' + esc(p.caption) + '" loading="lazy"></a>' +
        (p.caption ? "<figcaption>" + esc(p.caption) + "</figcaption>" : "") + "</figure>";
    }).join("") + "</div>");
    h += '<div class="status' + (c.verified ? " done" : "") + '">' + (c.verified ? svg("check", "ico") + "법령 원문 대조 완료" : svg("info", "ico") + "일부 해석 확인 중 · 관서 방침을 함께 확인하세요") + "</div>";
    h += '<p class="editlink"><a href="https://github.com/' + D.repo + "/edit/main/" + encodeURI(c.path) + '" target="_blank" rel="noopener">GitHub에서 이 사례 수정</a></p>';
    $view.innerHTML = h;
  }

  // ---- 법령 ----
  function lawType(name) { return /시행규칙/.test(name) ? "시행규칙" : /시행령/.test(name) ? "시행령" : "법률"; }
  function viewLaws() {
    bar("법령", false);
    tabs("law");
    $view.innerHTML = '<p class="note-muted">개 관련 조문을 모았습니다. 본문의 조문 번호를 누르면 그 조문이 바로 뜹니다.</p><div class="list lawlist">' +
      D.laws.map(function (l) {
        var n = l.articles.filter(function (a) { return a.key; }).length;
        return '<a class="case" href="#/law/' + encodeURIComponent(l.id) + '"><span class="tx"><b>' + esc(l.name) + "</b><small>시행 " + esc(l.effective) +
          " · 조문 " + n + '개</small></span><span class="lawtype">' + lawType(l.name) + "</span>" + svg("chev", "go") + "</a>";
      }).join("") + "</div>";
  }
  function viewLaw(id, art) {
    var l = D.laws.filter(function (x) { return x.id === id; })[0];
    if (!l) return notFound();
    bar(l.name, true);
    tabs("law");
    var h = l.intro ? '<div class="lawintro">' + esc(strip(l.intro).trim()) + "</div>" : "";
    h += l.articles.map(function (a) {
      return '<section class="art"' + (a.key ? ' id="a-' + esc(a.key) + '"' : "") + '><div class="ah"><h2>' + esc(a.title) + "</h2>" +
        (a.url ? '<a class="src" href="' + a.url + '" target="_blank" rel="noopener">원문</a>' : "") + '</div><div class="prose">' + a.html + "</div></section>";
    }).join("");
    h += '<p class="note-muted">시행일 ' + esc(l.effective) + ' 기준 · <a href="https://github.com/' + D.repo + "/edit/main/" + encodeURI(l.path) + '" target="_blank" rel="noopener">GitHub에서 수정</a></p>';
    $view.innerHTML = h;
    var t = art && document.getElementById("a-" + art);
    if (t) {
      setTimeout(function () {
        window.scrollTo(0, t.getBoundingClientRect().top + window.scrollY - $bar.offsetHeight - 8);
        t.classList.add("flash");
      }, 0);
    }
  }
  function viewFav() {
    bar("즐겨찾기", false);
    tabs("star");
    var a = favs().filter(function (id) { return D.cases[id]; });
    $view.innerHTML = a.length ? '<div class="list">' + a.map(function (id) { return caseRow(D.cases[id], true); }).join("") + "</div>" :
      '<p class="empty">사례 화면 오른쪽 위의 ☆를 누르면 여기에 모입니다.<br>즐겨찾기는 이 휴대폰에만 저장됩니다.</p>';
  }
  function notFound() {
    bar("찾을 수 없음", true);
    tabs("home");
    $view.innerHTML = '<p class="empty">이 사례는 이름이 바뀌었거나 삭제되었습니다. 홈에서 다시 찾아 주세요.</p>';
  }

  // ---- 조문 참조 팝업 ----
  // 본문의 "제10조제2항" 같은 링크를 누르면 아래에서 그 조문이 올라오고, 가리킨 항·호를 노랗게 표시한다.
  var sheetStack = [];
  function findArticle(lid, key) {
    var l = D.laws.filter(function (x) { return x.id === lid; })[0];
    if (!l) return null;
    return { law: l, art: l.articles.filter(function (a) { return a.key === key; })[0] };
  }
  function refLabel(r) {
    var n = r.art.split("-"), s = "제" + n[0] + "조" + (n[1] ? "의" + n[1] : "");
    if (r.p) s += " 제" + r.p + "항";
    if (r.i) { var m = r.i.split("-"); s += " 제" + m[0] + "호" + (m[1] ? "의" + m[1] : ""); }
    return s;
  }
  function openRef(r, push) {
    if (!push) sheetStack = [];
    sheetStack.push(r);
    renderSheet();
  }
  function closeSheet() {
    sheetStack = [];
    var el = document.getElementById("sheet");
    if (el) el.parentNode.removeChild(el);
    document.body.classList.remove("noscroll");
  }
  function renderSheet() {
    var r = sheetStack[sheetStack.length - 1];
    var f = findArticle(r.law, r.art);
    var el = document.getElementById("sheet");
    if (!el) {
      el = document.createElement("div");
      el.id = "sheet";
      el.className = "sheet";
      el.setAttribute("role", "dialog");
      el.setAttribute("aria-modal", "true");
      document.body.appendChild(el);
      document.body.classList.add("noscroll");
    }
    var head = '<div class="sheet-head">' +
      (sheetStack.length > 1 ? '<button class="iconbtn" data-act="sheet-back" aria-label="이전 조문">' + svg("back") + "</button>" : "") +
      '<div class="t"><small>' + esc(f ? f.law.name : "") + "</small><b>" + esc(f && f.art ? f.art.title : refLabel(r)) + "</b></div>" +
      '<button class="iconbtn" data-act="sheet-close" aria-label="닫기">' + svg("close") + "</button></div>";
    var body, foot;
    if (f && f.art) {
      body = (r.p || r.i ? '<p class="sheet-ref">' + esc(refLabel(r)) + " 부분</p>" : "") + '<div class="prose">' + f.art.html + "</div>";
      foot = '<a href="#/law/' + encodeURIComponent(r.law) + "/" + encodeURIComponent(r.art) + '">법령 탭에서 보기</a>' +
        '<a href="' + f.art.url + '" target="_blank" rel="noopener">국가법령정보센터 원문</a>';
    } else {
      var name = f ? f.law.name : "";
      var url = "https://www.law.go.kr/법령/" + encodeURIComponent(name) + "/" + encodeURIComponent(refLabel({ art: r.art }));
      body = '<p class="empty">이 앱에 넣지 않은 조문입니다.<br>국가법령정보센터에서 원문을 확인하세요.</p>';
      foot = '<a href="' + url + '" target="_blank" rel="noopener">국가법령정보센터에서 ' + esc(refLabel(r)) + " 보기</a>";
    }
    el.innerHTML = '<div class="sheet-bg" data-act="sheet-close"></div><div class="sheet-panel">' + head +
      '<div class="sheet-body" id="sheet-body">' + body + '</div><div class="sheet-foot">' + foot + "</div></div>";
    var sel = r.p && r.i ? '[data-p="' + r.p + '"][data-i="' + r.i + '"]' : r.p ? '[data-p="' + r.p + '"]' : r.i ? '[data-i="' + r.i + '"]' : "";
    if (sel) {
      var hits = el.querySelectorAll(".ln" + sel);
      for (var k = 0; k < hits.length; k++) hits[k].classList.add("hit");
      if (hits[0]) {
        var sb = document.getElementById("sheet-body");
        sb.scrollTop = Math.max(0, hits[0].offsetTop - 48);
      }
    }
  }

  // ---- 이동 ----
  function route() {
    closeSheet();
    var h = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
    var p = h.split("/");
    if (p[0] === "c") viewCat(p.slice(1).join("/"));
    else if (p[0] === "k") viewCase(p.slice(1).join("/"));
    else if (p[0] === "law" && p[1]) viewLaw(p[1], p[2]);
    else if (p[0] === "law") viewLaws();
    else if (p[0] === "fav") viewFav();
    else { if (p[0] === "s") query = p.slice(1).join("/"); viewHome(); }
    if (p[0] !== "s" && !(p[0] === "law" && p[2])) window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var ref = e.target.closest("a.ref:not(.ext)");
    if (ref && D) {
      e.preventDefault();
      openRef({ law: ref.dataset.law, art: ref.dataset.art, p: ref.dataset.p || "", i: ref.dataset.i || "" }, !!e.target.closest("#sheet"));
      return;
    }
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
    else if (act === "sheet-close") closeSheet();
    else if (act === "sheet-back") { sheetStack.pop(); renderSheet(); }
  });
  window.addEventListener("hashchange", route);
  document.addEventListener("keydown", function (e) { if (e.key === "Escape") closeSheet(); });

  fetch("data.json", { cache: "no-cache" }).then(function (r) { return r.json(); }).then(function (d) { D = d; route(); })
    .catch(function () { $view.innerHTML = '<p class="empty">자료를 불러오지 못했습니다. 인터넷 연결을 확인한 뒤 다시 열어 주세요.</p>'; });

  if ("serviceWorker" in navigator && location.protocol === "https:" && /github\.io$/.test(location.hostname)) {
    navigator.serviceWorker.register("sw.js").catch(function () { /* 오프라인 기능 없이 동작 */ });
  }
})();
