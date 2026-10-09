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


# ---------- 아주 작은 마크다운 변환기 ----------
def inline(s):
    s = html.escape(s, quote=False)
    s = re.sub(r"!\[([^\]]*)\]\(([^)\s]+)\)", lambda m: f'<img src="{m.group(2)}" alt="{m.group(1)}" loading="lazy">', s)
    s = re.sub(r"\[([^\]]+)\]\((https?://[^)\s]+)\)", r'<a href="\2" target="_blank" rel="noopener">\1</a>', s)
    s = re.sub(r"\*\*(.+?)\*\*", r"<strong>\1</strong>", s)
    return s


def md(text):
    out, para, lst, tbl = [], [], None, []

    def flush():
        nonlocal para, lst, tbl
        if para:
            out.append("<p>" + inline(" ".join(para)) + "</p>")
            para = []
        if lst:
            tag, items = lst[0], lst[1]
            start = f' start="{lst[2]}"' if len(lst) > 2 and lst[2] != 1 else ""
            out.append(f"<{tag}{start}>" + "".join(f"<li>{inline(i)}</li>" for i in items) + f"</{tag}>")
            lst = None
        if tbl:
            rows = [[c.strip() for c in r.strip().strip("|").split("|")] for r in tbl]
            rows = [r for r in rows if not all(re.fullmatch(r":?-{3,}:?", c) for c in r)]
            if rows:
                head, body = rows[0], rows[1:]
                h = "" if all(not c for c in head) else "<thead><tr>" + "".join(f"<th>{inline(c)}</th>" for c in head) + "</tr></thead>"
                b = "".join("<tr>" + "".join(f"<td>{inline(c)}</td>" for c in r) + "</tr>" for r in body)
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
            out.append(f"<h{lv}>{inline(m.group(2))}</h{lv}>")
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
            "intro": md(intro),
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
                laws.append({"law": p[0], "penalty": p[1] if len(p) > 1 else "", "note": p[2] if len(p) > 2 else ""})
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
                "checks": bullets(sec.get("현장 확인", "")),
                "action": md(sec.get("처리방향", "")),
                "note": md(sec.get("참고", "")),
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
            no = re.match(r"(제\d+조(?:의\d+)?)", a["title"])
            url = law_url(name, no.group(1)) if no else f"https://www.law.go.kr/법령/{name}"
            out.append({"title": a["title"], "html": md("\n".join(a["lines"])), "url": url if no else ""})
        laws.append({"id": os.path.splitext(fn)[0], "name": name, "effective": meta.get("시행일", ""),
                     "intro": md("\n".join(intro)), "articles": out, "path": f"laws/{fn}"})
    return laws


def main():
    cats, cases = load_cases()
    laws = load_laws()
    home = md(front_matter(read(os.path.join(ROOT, "home.md")), "home.md")[1]) if os.path.exists(os.path.join(ROOT, "home.md")) else ""
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
