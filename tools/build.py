"""cases/, laws/, home.md 를 읽어 _site/ 에 앱을 만든다.

사용법: python tools/build.py [출력폴더]   (기본: _site)
외부 패키지 없이 파이썬 표준 라이브러리만 쓴다.
"""
import html
import json
import os
import re
import shutil
import sys
from datetime import datetime, timedelta, timezone

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.abspath(sys.argv[1]) if len(sys.argv) > 1 else os.path.join(ROOT, "_site")
REPO = "bandit1397/Handling-Dog-Related-Reports"
VERDICTS = ["형사", "위반", "검토", "적용곤란", "적법", "참고"]

errors = []
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read().replace("\r\n", "\n")


def front_matter(text, where):
    m = re.match(r"---\n(.*?)\n---\n?(.*)", text, re.S)
    if not m:
        errors.append(f"{where}: 맨 위에 --- 로 둘러싼 머리말이 없습니다.")
        return {}, text
    meta = {}
    for line in m.group(1).split("\n"):
        if ":" in line:
            k, v = line.split(":", 1)
            meta[k.strip()] = v.strip()
    return meta, m.group(2)


# ---------- 조문 참조 링크 ----------
# 본문의 "제10조제2항", "같은 조 제3항제1호", "시행규칙 제11조" 같은 표현을 눌러서 볼 수 있는 링크로 바꾼다.
LAW_IDS = {}  # 법령 이름 → laws/ 파일 id
CIRCLED = "①②③④⑤⑥⑦⑧⑨⑩⑪⑫⑬⑭⑮⑯⑰⑱⑲⑳"
NAMES = ["동물보호법 시행규칙", "동물보호법 시행령", "경범죄 처벌법 시행령", "경범죄 처벌법", "경찰관 직무집행법",
         "동물보호법", "형법", "민법", "시행규칙", "시행령"]
SHORT = {"시행규칙": "동물보호법 시행규칙", "시행령": "동물보호법 시행령"}
REF = re.compile(
    r"(?:「(?P<ext>[^」]{1,30})」\s*|(?P<name>" + "|".join(map(re.escape, NAMES)) + r")\s*|(?<![가-힣])(?P<short>법|영)\s+)?"
    r"(?P<art>같은\s*조|제(?P<an>\d+)조(?:의(?P<ab>\d+))?)"
    r"(?:\s*제(?P<p>\d+)항)?(?:\s*제(?P<i>\d+)호(?:의(?P<ib>\d+))?)?(?:\s*(?P<m>[가-하])목)?"
    r"|(?P<bp>제(?P<p2>\d+)항)(?:\s*제(?P<i2>\d+)호(?:의(?P<ib2>\d+))?)?"
    r"|(?:같은\s*항\s*)?제(?P<i3>\d+)호(?:의(?P<ib3>\d+))?")
CONNECT = ("ㆍ", "·", ",", "또는", "및", "부터", "이나", "나", "와", "과")


def scan_law_names():
    base = os.path.join(ROOT, "laws")
    for fn in sorted(os.listdir(base)):
        if fn.endswith(".md"):
            meta, _ = front_matter(read(os.path.join(base, fn)), f"laws/{fn}")
            LAW_IDS[meta.get("법령", fn)] = os.path.splitext(fn)[0]


def art_label(key):
    n, _, b = key.partition("-")
    return f"제{n}조" + (f"의{b}" if b else "")


def resolve_short(short, self_name):
    if short == "영":
        return "동물보호법 시행령"
    if self_name and self_name.startswith("경범죄"):
        return "경범죄 처벌법"
    return "동물보호법"


def linkify(s, ctx):
    """s 는 이미 html 이스케이프된 한 문단. ctx: default(기본 법령), art/p(법령 본문에서 지금 조·항)."""
    out, last, prev, sticky = [], 0, None, None
    for m in REF.finditer(s):
        g = m.groupdict()
        if g["art"]:
            if g["ext"]:
                law = g["ext"].strip()
            elif g["name"]:
                law = SHORT.get(g["name"], g["name"])
            elif g["short"]:
                law = resolve_short(g["short"], ctx.get("self"))
            elif g["art"].startswith("같은") and prev:
                law = prev["law"]
            else:
                gap = s[prev["end"]:m.start()].rstrip() if prev else ""
                near = sticky and prev and len(gap) < 20 and gap.endswith(CONNECT)  # "형법 제266조 과실치상, 제267조"
                law = sticky if near else (ctx.get("default") or "동물보호법")
            if g["ext"] or g["name"]:
                sticky = law  # 같은 문단 안에서 뒤에 나오는 "제267조"처럼 법령 이름이 빠진 참조에도 적용
            if g["an"]:
                art = g["an"] + ("-" + g["ab"] if g["ab"] else "")
            else:  # 같은 조
                art = prev["art"] if prev else ctx.get("art")
                if g["name"] is None and g["ext"] is None and not prev:
                    law = ctx.get("self") or law
            if not art:
                continue
            ref = {"law": law, "art": art, "p": g["p"] or "", "i": (g["i"] or "") + ("-" + g["ib"] if g["ib"] else ""), "m": g["m"] or ""}
        else:
            # 조 없이 항·호만 쓴 경우: 바로 앞 참조를 잇거나(ㆍ, 또는 …), 법령 본문이면 지금 조문을 가리킨다
            before = s[:m.start()].rstrip()
            chained = prev is not None and before.endswith(CONNECT) and m.start() - prev["end"] < 12
            if chained:
                base = prev
            elif ctx.get("art"):
                base = {"law": ctx.get("self"), "art": ctx["art"], "p": ctx.get("p") or ""}
            else:
                continue
            if g["bp"]:
                p, i, ib = g["p2"], g["i2"], g["ib2"]
            else:
                p, i, ib = base.get("p", ""), g["i3"], g["ib3"]
            ref = {"law": base["law"], "art": base["art"], "p": p or "", "i": (i or "") + ("-" + ib if ib else ""), "m": ""}
        ref["end"] = m.end()
        prev = ref
        text = m.group(0)
        lid = LAW_IDS.get(ref["law"])
        if lid:
            a = (f'<a class="ref" href="#/law/{lid}/{ref["art"]}" data-law="{lid}" data-art="{ref["art"]}"'
                 f' data-p="{ref["p"]}" data-i="{ref["i"]}">{text}</a>')
        else:
            a = f'<a class="ref ext" href="{law_url(ref["law"], art_label(ref["art"]))}" target="_blank" rel="noopener">{text}</a>'
        out.append(s[last:m.start()] + a)
        last = m.end()
    out.append(s[last:])
    return "".join(out)


# ---------- 아주 작은 마크다운 변환기 ----------
def inline(s, ctx=None):
    s = html.escape(s, quote=False)
    if ctx is not None:
        s = linkify(s, ctx)
    s = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", lambda m: f'<img src="{m.group(2)}" alt="{m.group(1)}" loading="lazy">', s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return s


def md(text, ctx=None):
    out, para, lst, tbl = [], [], None, []

    def flush():
        nonlocal para, lst, tbl
        if para:
            out.append("<p>" + inline(" ".join(para), ctx) + "</p>")
            para = []
        if lst:
            tag, items = lst[0], lst[1]
            start = f' start="{lst[2]}"' if len(lst) > 2 and lst[2] != 1 else ""
            n0 = lst[2] if len(lst) > 2 else None  # 번호 목록은 번호를 data-n 으로 넘겨 동그라미 번호로 그린다
            out.append(f"<{tag}{start}>" + "".join(
                f'<li{f" data-n=\"{n0 + k}\"" if n0 else ""}>{inline(i, ctx)}</li>' for k, i in enumerate(items)) + f"</{tag}>")
            lst = None
        if tbl:
            rows = [[c.strip() for c in r.strip().strip("|").split("|")] for r in tbl]
            rows = [r for r in rows if not all(re.fullmatch(r":?-{3,}:?", c) for c in r)]
            if rows:
                head, body = rows[0], rows[1:]
                h = "" if all(not c for c in head) else "<thead><tr>" + "".join(f"<th>{inline(c, ctx)}</th>" for c in head) + "</tr></thead>"
                b = "".join("<tr>" + "".join(f"<td>{inline(c, ctx)}</td>" for c in r) + "</tr>" for r in body)
                out.append(f'<div class="tbl"><table>{h}<tbody>{b}</tbody></table></div>')
            tbl = []

    for line in text.split("\n"):
        s = line.strip()
        if not s:
            flush()
            continue
        if s.startswith("|"):
            if para or lst:
                flush()
            tbl.append(s)
            continue
        if tbl:
            flush()
        m = re.match(r"(#{2,4})\s+(.*)", s)
        if m:
            flush()
            lv = min(len(m.group(1)) + 1, 5)
            out.append(f"<h{lv}>{inline(m.group(2), ctx)}</h{lv}>")
            continue
        m = re.match(r"[-*]\s+(.*)", s)
        if m:
            if para:
                flush()
            if not lst or lst[0] != "ul":
                flush()
                lst = ("ul", [])
            lst[1].append(m.group(1))
            continue
        m = re.match(r"(\d+)\.\s+(.*)", s)
        if m:
            if para:
                flush()
            if not lst or lst[0] != "ol":
                flush()
                lst = ("ol", [], int(m.group(1)))
            lst[1].append(m.group(2))
            continue
        if lst:
            flush()
        para.append(s)
    flush()
    return "\n".join(out)


def sections(body):
    """## 제목 단위로 나눈다."""
    parts, cur = {}, None
    for line in body.split("\n"):
        m = re.match(r"##\s+(.*)", line)
        if m:
            cur = m.group(1).strip()
            parts[cur] = []
        elif cur:
            parts[cur].append(line)
    return {k: "\n".join(v).strip() for k, v in parts.items()}


def bullets(text):
    return [re.sub(r"^[-*]\s+", "", l.strip()) for l in text.split("\n") if re.match(r"\s*[-*]\s+", l)]


def check_image(path, where):
    if not os.path.exists(os.path.join(ROOT, path)):
        errors.append(f"{where}: 사진 파일 '{path}' 이(가) 없습니다. images 폴더에 올렸는지 확인하세요.")


# ---------- 사례 ----------
def load_cases():
    cats, cases = [], {}
    base = os.path.join(ROOT, "cases")
    for folder in sorted(os.listdir(base)):
        d = os.path.join(base, folder)
        if not os.path.isdir(d):
            continue
        about = os.path.join(d, "_상황.md")
        meta, intro = front_matter(read(about), f"cases/{folder}/_상황.md") if os.path.exists(about) else ({}, "")
        for m in re.finditer(r"!\[[^\]]*\]\(([^)\s]+)\)", intro):
            check_image(m.group(1), f"cases/{folder}/_상황.md")
        cat = {
            "id": folder,
            "name": meta.get("이름") or re.sub(r"^\d+-", "", folder).replace("-", " "),
            "summary": meta.get("요약", ""),
            "intro": md(intro, {"default": "동물보호법"}),
            "cases": [],
        }
        for fn in sorted(os.listdir(d)):
            if not fn.endswith(".md") or fn.startswith("_"):
                continue
            rel = f"cases/{folder}/{fn}"
            meta, body = front_matter(read(os.path.join(d, fn)), rel)
            sec = sections(body)
            verdict = meta.get("판정", "검토")
            if verdict not in VERDICTS:
                errors.append(f"{rel}: 판정 '{verdict}' 은(는) 쓸 수 없습니다. {', '.join(VERDICTS)} 중 하나로 쓰세요.")
            laws = []
            for l in bullets(sec.get("적용법조", "")):
                p = [x.strip() for x in l.split("|")]
                p += ["", ""]
                laws.append({"law": inline(p[0], {"default": "동물보호법"}), "penalty": inline(p[1], {"default": "동물보호법"}), "note": inline(p[2], {"default": "동물보호법"}),
                             "text": " ".join(p[:3])})
            photos = []
            for l in bullets(sec.get("사진", "")):
                p = [x.strip() for x in l.split("|")]
                check_image(p[0], rel)
                photos.append({"src": p[0], "caption": p[1] if len(p) > 1 else ""})
            cid = folder.split("-")[0] + "-" + os.path.splitext(fn)[0]
            if not meta.get("제목"):
                errors.append(f"{rel}: 제목이 없습니다.")
            c = {
                "id": cid,
                "cat": folder,
                "path": rel,
                "title": meta.get("제목", fn),
                "verdict": verdict,
                "group": meta.get("구분", ""),
                "verified": meta.get("원문대조", "") == "완료",
                "keywords": meta.get("검색어", ""),
                "laws": laws,
                "checks": [inline(x, {"default": "동물보호법"}) for x in bullets(sec.get("현장 확인", ""))],
                "action": md(sec.get("처리방향", ""), {"default": "동물보호법"}),
                "note": md(sec.get("참고", ""), {"default": "동물보호법"}),
                "photos": photos,
            }
            cases[cid] = c
            cat["cases"].append(cid)
        cats.append(cat)
    return cats, cases


# ---------- 법령 ----------
def law_url(name, art):
    from urllib.parse import quote
    return f"https://www.law.go.kr/법령/{quote(name)}/{quote(art)}"


def article_html(lines, name, key):
    """조문 한 줄(항·호·목)마다 번호를 달아 두어, 참조한 항·호를 찾아 강조할 수 있게 한다."""
    out, p, i = [], "", ""
    for raw in lines:
        t = raw.strip()
        if not t:
            continue
        attrs, cls = "", "l0"
        if t[0] in CIRCLED:
            p, i, cls = str(CIRCLED.index(t[0]) + 1), "", "lp"
            attrs = f' data-p="{p}"'
        else:
            m = re.match(r"(\d+)(?:의(\d+))?\.\s", t)
            if m:
                i, cls = m.group(1) + ("-" + m.group(2) if m.group(2) else ""), "li"
                attrs = f' data-p="{p}" data-i="{i}"'
            elif re.match(r"[가-하]\.\s", t):
                cls = "lm"
                attrs = f' data-p="{p}" data-i="{i}"'
        ctx = {"default": name, "self": name, "art": key, "p": p}
        out.append(f'<p class="ln {cls}"{attrs}>{inline(t, ctx)}</p>')
    return "\n".join(out)


def load_laws():
    laws = []
    base = os.path.join(ROOT, "laws")
    for fn in sorted(os.listdir(base)):
        if not fn.endswith(".md"):
            continue
        meta, body = front_matter(read(os.path.join(base, fn)), f"laws/{fn}")
        name = meta.get("법령", fn)
        intro, arts, cur = [], [], None
        for line in body.split("\n"):
            m = re.match(r"###\s+(.*)", line)
            if m:
                cur = {"title": m.group(1).strip(), "lines": []}
                arts.append(cur)
            elif cur:
                cur["lines"].append(line)
            else:
                intro.append(line)
        out = []
        for a in arts:
            no = re.match(r"제(\d+)조(?:의(\d+))?", a["title"])
            if not no:  # 금액표처럼 조문이 아닌 부분
                out.append({"key": "", "title": a["title"], "html": md("\n".join(a["lines"]), {"default": name, "self": name}), "url": ""})
                continue
            key = no.group(1) + ("-" + no.group(2) if no.group(2) else "")
            out.append({"key": key, "title": a["title"], "html": article_html(a["lines"], name, key),
                        "url": law_url(name, art_label(key))})
        laws.append({"id": os.path.splitext(fn)[0], "name": name, "effective": meta.get("시행일", ""),
                     "intro": md("\n".join(intro), {"default": name, "self": name}), "articles": out, "path": f"laws/{fn}"})
    return laws


def main():
    scan_law_names()
    cats, cases = load_cases()
    laws = load_laws()
    home = md(front_matter(read(os.path.join(ROOT, "home.md")), "home.md")[1], {"default": "동물보호법"}) if os.path.exists(os.path.join(ROOT, "home.md")) else ""
    if errors:
        print("빌드 실패. 아래 내용을 고친 뒤 다시 저장하세요.\n")
        for e in errors:
            print(" - " + e)
        sys.exit(1)

    kst = datetime.now(timezone(timedelta(hours=9)))
    data = {"updated": kst.strftime("%Y.%m.%d %H:%M"), "repo": REPO, "home": home,
            "categories": cats, "cases": cases, "laws": laws}

    # 폴더 자체는 두고 안쪽만 비운다 (미리보기 서버가 폴더를 쓰고 있어도 동작)
    os.makedirs(OUT, exist_ok=True)
    for x in os.listdir(OUT):
        p = os.path.join(OUT, x)
        shutil.rmtree(p) if os.path.isdir(p) else os.remove(p)
    shutil.copytree(os.path.join(ROOT, "site"), OUT, dirs_exist_ok=True)
    shutil.copytree(os.path.join(ROOT, "images"), os.path.join(OUT, "images"))
    with open(os.path.join(OUT, "data.json"), "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, separators=(",", ":"))
    # 서비스워커 캐시 이름에 빌드 시각을 넣어 새 내용이 바로 반영되게 한다
    sw = os.path.join(OUT, "sw.js")
    with open(sw, encoding="utf-8") as f:
        s = f.read().replace("__BUILD__", kst.strftime("%Y%m%d%H%M%S"))
    imgs = []
    for dp, _, fs in os.walk(os.path.join(OUT, "images")):
        for x in fs:
            imgs.append(os.path.relpath(os.path.join(dp, x), OUT).replace(os.sep, "/"))
    s = s.replace("__IMAGES__", json.dumps(sorted(imgs), ensure_ascii=False))
    with open(sw, "w", encoding="utf-8") as f:
        f.write(s)
    print(f"완료: 상황 {len(cats)}개, 사례 {len(cases)}개, 법령 {len(laws)}개 → {OUT}")


if __name__ == "__main__":
    main()
