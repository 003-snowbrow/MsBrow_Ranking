import json, glob, re, os, sys, datetime
SRC = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), '..', 'source', 'months')
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), '..', 'source', 'months.json')

ROW_LABELS = {
    "clients": "當月客數", "newClients": "當月新客數", "members": "當月入會客數",
    "walkIn": "現場預約客數", "ig": "IG分享數", "google": "Google好評", "photoRate": "微信照片上傳率",
    "score": "達標率",
}
PART_LABELS = {"ig": "IG分享", "google": "新客google好評率", "member": "新客入會率", "walkIn": "現場預約率", "volume": "客量", "photo": "紀錄照上傳率"}

def num(v):
    if isinstance(v, bool): return None
    if isinstance(v, (int, float)): return v
    if isinstance(v, str):
        s = v.strip().replace('%', '')
        try: return float(s)
        except ValueError: return None
    return None

def clean_int(v):
    n = num(v)
    return None if n is None else (int(round(n)) if abs(n - round(n)) < 1e-9 else round(n, 2))

docs = []
for f in sorted(glob.glob(os.path.join(SRC, '*.json'))):
    if os.path.basename(f).startswith('_'): continue
    d = json.load(open(f))
    rows = d['rows']
    m = re.search(r'(\d{4})-(\d{2})-\d{2}', d['date_range'] or '')
    month = f'{m.group(1)}-{m.group(2)}'
    def rowidx(label):
        for i, r in enumerate(rows):
            if r and isinstance(r[0], str) and r[0].strip() == label: return i
        raise SystemExit(f'{f}: label {label} missing')
    idx = {k: rowidx(v) for k, v in ROW_LABELS.items()}
    pidx = {k: rowidx(v) for k, v in PART_LABELS.items()}
    names, levels = rows[2], rows[1]
    staff = []
    for c in range(3, 19):  # D..S
        name = names[c]
        if name is None or str(name).strip() == '': continue
        s = {"name": str(name).strip(), "level": clean_int(levels[c])}
        for k in ("clients", "newClients", "members", "walkIn", "ig", "google"):
            s[k] = clean_int(rows[idx[k]][c])
        pr = num(rows[idx["photoRate"]][c]); s["photoRate"] = None if pr is None else (round(pr/100, 4) if pr > 1.5 else round(pr, 4))
        sc = num(rows[idx["score"]][c]); s["score"] = None if sc is None else round(sc, 4)
        parts = {}
        for k, i in pidx.items():
            pv = num(rows[i][c]); parts[k] = None if pv is None else round(pv, 4)
        s["parts"] = parts
        staff.append(s)
    base = os.path.basename(f).split('_')[0]  # 26-01
    docs.append({
        "month": month,
        "label": f'{int(month[:4])}年{int(month[5:])}月',
        "source": '薪資單_2.2_' + base.replace('-', '/'),
        "range": (d['date_range'] or '').replace('日期范围：', '').strip(),
        "importedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds'),
        "importedBy": "Google 雲端硬碟薪資單",
        "staff": staff,
    })

docs.sort(key=lambda d: d['month'])
json.dump(docs, open(OUT, 'w'), ensure_ascii=False, indent=1)
for doc in docs:
    ranked = sorted([s for s in doc['staff'] if s['score'] is not None], key=lambda s: -s['score'])
    print(doc['month'], len(doc['staff']), 'staff; top3:', [(s['name'], s['score']) for s in ranked[:3]], '| null-score:', [s['name'] for s in doc['staff'] if s['score'] is None])
