#!/usr/bin/env python3
"""
test_design_tokens_contrast.py - Automated WCAG 2.2 AA Contrast Checker for FAFLOW Design Tokens.

Evaluates all semantic text/background and UI component/background token pairs
against WCAG 2.2 AA thresholds:
- Normal text: >= 4.5:1
- Large text / graphical components / input borders: >= 3.0:1

Usage:
  python scripts/test_design_tokens_contrast.py [--markdown]
"""
import os
import sys
import json
import math

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
TOKEN_JSON_PATH = os.path.join(REPO_ROOT, "design", "tokens", "faflow_design_tokens.json")


def hex_to_rgb(hex_code: str):
    hex_code = hex_code.lstrip("#")
    if len(hex_code) == 3:
        hex_code = "".join([c * 2 for c in hex_code])
    if len(hex_code) == 8: # Handle ARGB or RGBA if any
        hex_code = hex_code[:6]
    r = int(hex_code[0:2], 16)
    g = int(hex_code[2:4], 16)
    b = int(hex_code[4:6], 16)
    return r, g, b


def srgb_channel_to_linear(c_srgb_255: int) -> float:
    c = c_srgb_255 / 255.0
    if c <= 0.04045:
        return c / 12.92
    else:
        return math.pow((c + 0.055) / 1.055, 2.4)


def relative_luminance(hex_code: str) -> float:
    r, g, b = hex_to_rgb(hex_code)
    r_lin = srgb_channel_to_linear(r)
    g_lin = srgb_channel_to_linear(g)
    b_lin = srgb_channel_to_linear(b)
    return 0.2126 * r_lin + 0.7152 * g_lin + 0.0722 * b_lin


def contrast_ratio(hex1: str, hex2: str) -> float:
    l1 = relative_luminance(hex1)
    l2 = relative_luminance(hex2)
    lighter = max(l1, l2)
    darker = min(l1, l2)
    return (lighter + 0.05) / (darker + 0.05)


def resolve_ref(ref_str: str, data: dict):
    if not isinstance(ref_str, str) or not ref_str.startswith("{") or not ref_str.endswith("}"):
        return ref_str
    path = ref_str[1:-1].split(".")
    curr = data
    for part in path:
        if isinstance(curr, dict) and part in curr:
            curr = curr[part]
        else:
            return ref_str
    if isinstance(curr, str) and curr.startswith("{") and curr.endswith("}"):
        return resolve_ref(curr, data)
    return curr


def resolve_all(obj, root_data):
    if isinstance(obj, dict):
        return {k: resolve_all(v, root_data) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [resolve_all(item, root_data) for item in obj]
    elif isinstance(obj, str):
        return resolve_ref(obj, root_data)
    return obj


def evaluate_tokens():
    with open(TOKEN_JSON_PATH, "r", encoding="utf-8") as f:
        raw_data = json.load(f)
    resolved = resolve_all(raw_data, raw_data)

    sem = resolved["semantic"]["color"]
    prim = resolved["primitive"]["color"]

    # Define pairs: (Pair Name, Foreground Hex, Background Hex, Target Min Ratio, Element Type)
    pairs = [
        # Primary Typography
        ("Primary Text on Card Surface", sem["text"]["primary"], sem["surface"]["card"], 4.5, "Text"),
        ("Primary Text on Page Background", sem["text"]["primary"], sem["surface"]["background"], 4.5, "Text"),
        ("Secondary Text on Card Surface", sem["text"]["secondary"], sem["surface"]["card"], 4.5, "Text"),
        ("Secondary Text on Page Background", sem["text"]["secondary"], sem["surface"]["background"], 4.5, "Text"),
        ("Muted Text on Card Surface", sem["text"]["muted"], sem["surface"]["card"], 4.5, "Text"),
        ("Muted Text on Page Background", sem["text"]["muted"], sem["surface"]["background"], 4.5, "Text"),
        ("Inverse Text on Primary Navy", sem["text"]["inverse"], sem["brand"]["primary"], 4.5, "Text"),
        ("Brand Text on Card Surface", sem["text"]["brand"], sem["surface"]["card"], 4.5, "Text"),

        # Navigation & Sidebar
        ("Sidebar Active Text on Active BG", sem["surface"]["sidebarActiveText"], sem["surface"]["sidebarActive"], 4.5, "Text"),
        ("Sidebar Text on Sidebar Surface", sem["text"]["primary"], sem["surface"]["sidebar"], 4.5, "Text"),
        ("Sidebar Muted on Sidebar Surface", sem["text"]["muted"], sem["surface"]["sidebar"], 4.5, "Text"),

        # UI Components & Control Borders (3:1 minimum for non-text / inputs)
        ("Control Border on Card Surface", sem["border"]["control"], sem["surface"]["card"], 3.0, "UI Component"),
        ("Control Border on Page Background", sem["border"]["control"], sem["surface"]["background"], 3.0, "UI Component"),
        ("Focus Ring on Card Surface", sem["border"]["focus"], sem["surface"]["card"], 3.0, "UI Component"),
        ("Divider on Card Surface", sem["border"]["divider"], sem["surface"]["card"], 1.1, "Decorative Divider"), # Informational

        # Status Badges (Text on Tinted BG)
        ("Status Success Text on Success BG", sem["status"]["success"]["text"], sem["status"]["success"]["bg"], 4.5, "Text"),
        ("Status Warning Text on Warning BG", sem["status"]["warning"]["text"], sem["status"]["warning"]["bg"], 4.5, "Text"),
        ("Status Error Text on Error BG", sem["status"]["error"]["text"], sem["status"]["error"]["bg"], 4.5, "Text"),
        ("Status Info Text on Info BG", sem["status"]["info"]["text"], sem["status"]["info"]["bg"], 4.5, "Text"),
        ("Status Neutral Text on Neutral BG", sem["status"]["neutral"]["text"], sem["status"]["neutral"]["bg"], 4.5, "Text"),

        # Status Text on White Card
        ("Status Success Text on Card Surface", sem["status"]["success"]["text"], sem["surface"]["card"], 4.5, "Text"),
        ("Status Warning Text on Card Surface", sem["status"]["warning"]["text"], sem["surface"]["card"], 4.5, "Text"),
        ("Status Error Text on Card Surface", sem["status"]["error"]["text"], sem["surface"]["card"], 4.5, "Text"),
        ("Status Info Text on Card Surface", sem["status"]["info"]["text"], sem["surface"]["card"], 4.5, "Text"),

        # Role Badges & Accents
        ("Role Teacher Primary on Role BG", sem["roles"]["teacher"]["primary"], sem["roles"]["teacher"]["bg"], 4.5, "Text"),
        ("Role HOD Primary on Role BG", sem["roles"]["hod"]["primary"], sem["roles"]["hod"]["bg"], 4.5, "Text"),
        ("Role Principal Primary on Role BG", sem["roles"]["principal"]["primary"], sem["roles"]["principal"]["bg"], 4.5, "Text"),
        ("Role Governance Primary on Role BG", sem["roles"]["governance"]["primary"], sem["roles"]["governance"]["bg"], 4.5, "Text"),
        ("Role Manager Primary on Role BG", sem["roles"]["manager"]["primary"], sem["roles"]["manager"]["bg"], 4.5, "Text"),
        ("Role Staff Primary on Role BG", sem["roles"]["staff"]["primary"], sem["roles"]["staff"]["bg"], 4.5, "Text"),

        # Buttons & Solid Fills
        ("White Text on Primary Navy Button", "#FFFFFF", prim["navy"]["600"], 4.5, "Text"),
        ("White Text on Gold-700 Fill", "#FFFFFF", prim["gold"]["700"], 4.5, "Text"),
        ("White Text on Teal-700 Fill", "#FFFFFF", prim["teal"]["700"], 4.5, "Text"),
        ("White Text on Destructive Red", "#FFFFFF", sem["status"]["error"]["text"], 4.5, "Text"),
    ]

    results = []
    failures = []

    for name, fg, bg, target, elem_type in pairs:
        ratio = contrast_ratio(fg, bg)
        passes = ratio >= target
        results.append({
            "name": name,
            "fg": fg,
            "bg": bg,
            "ratio": ratio,
            "target": target,
            "type": elem_type,
            "passes": passes
        })
        if not passes:
            failures.append((name, fg, bg, ratio, target))

    return results, failures


def generate_markdown_table(results):
    lines = [
        "| Element / Token Pair | Foreground | Background | Type | Min Required | Actual Ratio | WCAG 2.2 AA Result |",
        "| :--- | :---: | :---: | :---: | :---: | :---: | :---: |",
    ]
    for r in results:
        status_icon = "PASS (AA)" if r["passes"] else "FAIL"
        lines.append(
            f"| **{r['name']}** | `{r['fg']}` | `{r['bg']}` | {r['type']} | {r['target']}:1 | **{r['ratio']:.2f}:1** | {status_icon} |"
        )
    return "\n".join(lines)


def main():
    results, failures = evaluate_tokens()
    if "--markdown" in sys.argv:
        print(generate_markdown_table(results))
        return

    print("=" * 80)
    print("FAFLOW Automated WCAG 2.2 AA Contrast Gate")
    print("=" * 80)
    for r in results:
        status = "[PASS]" if r["passes"] else "[FAIL]"
        print(f"{status} {r['name']:<42} {r['fg']} on {r['bg']} -> {r['ratio']:.2f}:1 (min {r['target']}:1)")

    if failures:
        print("\n" + "=" * 80)
        print(f"[FAIL] {len(failures)} contrast pairs failed WCAG 2.2 AA standards:")
        for name, fg, bg, ratio, target in failures:
            print(f"  - {name}: got {ratio:.2f}:1, required >= {target}:1 ({fg} on {bg})")
        sys.exit(1)

    print("\n" + "=" * 80)
    print(f"[SUCCESS] All {len(results)} evaluated token pairs PASS WCAG 2.2 AA standards!")
    print("=" * 80)


if __name__ == "__main__":
    main()
