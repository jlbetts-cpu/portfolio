#!/usr/bin/env python3
"""Static contract for the two portfolio builder surfaces."""

from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]
PAGES = {
    "gradientlab.html": "gradientlab",
    "headmaker.html": "headmaker",
}


def compact(value):
    return re.sub(r"\s+", "", value)


def main():
    theme_path = ROOT / "builder-theme.css"
    assert theme_path.is_file(), "builder-theme.css is missing"
    theme = compact(theme_path.read_text(encoding="utf-8"))

    for filename, page_name in PAGES.items():
        source = (ROOT / filename).read_text(encoding="utf-8")
        assert re.search(
            rf'<body\b[^>]*\bdata-theme-page=["\']{page_name}["\']', source
        ), f"{filename}: missing data-theme-page={page_name}"
        links = re.findall(r'<link\b[^>]*href=["\']([^"\']+)["\']', source)
        assets = [link.split("?", 1)[0] for link in links]
        assert assets.count("builder-theme.css") == 1, f"{filename}: expected one builder-theme.css"
        assert assets.index("builder-theme.css") < assets.index("site-theme.css"), (
            f"{filename}: site-theme.css must remain the final stylesheet"
        )

    required = (
        ':root[data-theme="dark"]body[data-theme-page="gradientlab"]',
        ':root[data-theme="dark"]body[data-theme-page="headmaker"]',
        "--builder-page:var(--theme-page)",
        "--builder-surface:var(--theme-surface)",
        "--builder-elevated:var(--theme-elevated)",
        "--builder-ink:var(--theme-ink)",
        "--builder-muted:var(--theme-muted)",
        "background-color:var(--builder-page)",
        "outline-color:var(--theme-focus)",
        "@media(forced-colors:active)",
    )
    for declaration in required:
        assert declaration in theme, f"builder-theme.css: missing {declaration}"

    # Authored canvases and uploaded/generated face media must remain untouched.
    forbidden = re.compile(
        r'(?:canvas|\.hmStage\s+img|\.hmPitPick\s+img)[^{]*\{[^}]*'
        r'(?:filter|opacity|mix-blend-mode)\s*:', re.I
    )
    assert not forbidden.search(theme), "builder theme must not recolor authored media"
    print("builder theme contract: OK")


if __name__ == "__main__":
    main()
