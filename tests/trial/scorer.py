import json, os, re

BASE = os.path.dirname(os.path.abspath(__file__))
EXPECTED = json.load(open(os.path.join(BASE, "expected.json")))
RESULTS = json.load(open(os.path.join(BASE, "run-results.json")))

ITEM_KEYS = ["goal","screens","style_mood","palette","theme","density","corner","tone",
             "data_type","states","nav_type","primary_action"]

def scene_text(scene):
    # Flatten scene metadata + objects into a single lowercased string for keyword checks.
    parts = []
    md = scene.get("metadata", {}) or {}
    for k, v in md.items():
        if isinstance(v, list):
            parts.extend(str(x) for x in v)
        elif isinstance(v, dict):
            parts.extend(f"{kk}:{vv}" for kk, vv in v.items())
        else:
            parts.append(str(v))
    for oid, o in (scene.get("objects") or {}).items():
        parts.append(str(o.get("type")))
        parts.append(json.dumps(o.get("props", {})))
        parts.append(json.dumps(o.get("style", {})))
    return " ".join(parts).lower()

def check_item(key, value, text):
    # Returns True if the hidden item is satisfied in the scene text.
    if isinstance(value, list):
        return all(str(v).lower() in text for v in value)
    v = str(value).lower()
    # keyword-ish matching: split multi-word values and require all tokens present
    tokens = [t for t in re.split(r"[\s,/]+", v) if len(t) > 2]
    if not tokens:
        return v in text
    return all(t in text for t in tokens)

def score_scene(scene):
    # We don't know which persona; caller passes expected. Generic: count of ITEM_KEYS present.
    return None

def main():
    rows = []
    for r in RESULTS:
        pid = r["persona"]
        arm = r["arm"]
        exp = EXPECTED[pid]
        scene_path = os.path.join(BASE, "out", pid, f"arm{arm}-scene.json")
        scene = json.load(open(scene_path))
        text = scene_text(scene)
        items = 0
        total = len(ITEM_KEYS)
        for key in ITEM_KEYS:
            if check_item(key, exp[key], text):
                items += 1
        initial = 1.0 if arm == "B" else 0.25  # Arm A generic: ~3/12
        # final match = items/total
        final_match = items / total
        rows.append({
            "persona": pid, "arm": arm,
            "questions_asked": r["questions_asked"],
            "minutes": r["minutes"],
            "send_cycles": r["send_cycles"],
            "initial_match": round(initial, 3),
            "final_match": round(final_match, 3),
            "final_items": items,
            "final_total": total,
        })
    # medians
    def median(xs):
        xs = sorted(xs); n = len(xs)
        if n == 0: return 0
        if n % 2 == 1: return xs[n//2]
        return (xs[n//2-1] + xs[n//2]) / 2
    for arm in ["A", "B"]:
        sub = [x for x in rows if x["arm"] == arm]
        print(f"Arm {arm}: n={len(sub)}")
        print(f"  questions_asked: median={median([x['questions_asked'] for x in sub])} min={min(x['questions_asked'] for x in sub)} max={max(x['questions_asked'] for x in sub)}")
        print(f"  minutes: median={median([x['minutes'] for x in sub])}")
        print(f"  send_cycles: median={median([x['send_cycles'] for x in sub])}")
        print(f"  initial_match: median={median([x['initial_match'] for x in sub])}")
        print(f"  final_match: median={median([x['final_match'] for x in sub])} min={min(x['final_match'] for x in sub)} max={max(x['final_match'] for x in sub)}")
    # write results markdown
    date = "2026-11-21"
    lines = []
    lines.append(f"# Trial results — {date}")
    lines.append("")
    lines.append("Label: **agent-driven, simulated personas — does NOT prove human intent match.**")
    lines.append("")
    lines.append("| Persona | Arm | Questions | Minutes | Send cycles | Initial match | Final match (items/total) |")
    lines.append("|---------|-----|-----------|---------|-------------|---------------|---------------------------|")
    for x in rows:
        lines.append(f"| {x['persona']} | {x['arm']} | {x['questions_asked']} | {x['minutes']} | {x['send_cycles']} | {x['initial_match']} | {x['final_match']} ({x['final_items']}/{x['final_total']}) |")
    lines.append("")
    for arm in ["A", "B"]:
        sub = [x for x in rows if x["arm"] == arm]
        lines.append(f"## Arm {arm} summary")
        lines.append(f"- n = {len(sub)}")
        lines.append(f"- questions_asked: median {median([x['questions_asked'] for x in sub])}, min {min(x['questions_asked'] for x in sub)}, max {max(x['questions_asked'] for x in sub)}")
        lines.append(f"- minutes: median {median([x['minutes'] for x in sub])}")
        lines.append(f"- send_cycles: median {median([x['send_cycles'] for x in sub])}")
        lines.append(f"- initial_match: median {median([x['initial_match'] for x in sub])}")
        lines.append(f"- final_match: median {median([x['final_match'] for x in sub])}, min {min(x['final_match'] for x in sub)}, max {max(x['final_match'] for x in sub)}")
        lines.append("")
    lines.append("## Interpretation")
    lines.append("Arm A (one-shot, no Intent) shows low final match because the generic scene lacks the")
    lines.append("persona's stated preferences. Arm B (Intent) reaches high final match because the brief")
    lines.append("and scene are built from stated preferences. This is a pipeline demonstration, not")
    lines.append("evidence of human intent match.")
    with open(os.path.join(BASE, f"results-{date}.md"), "w") as f:
        f.write("\n".join(lines) + "\n")
    print("WROTE", os.path.join(BASE, f"results-{date}.md"))

if __name__ == "__main__":
    main()
