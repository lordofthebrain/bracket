import re

# Matches exactly one placeholder token: {d} for no padding, or {0Nd} for
# zero-padded to N digits (e.g. {02d}, {03d}). No other braces are allowed
# anywhere else in the pattern, since this is substituted manually rather
# than via str.format() to avoid exposing Python's format-spec mini-language
# (e.g. attribute access like {0.__class__}) to user-supplied input.
ROUND_NAME_PLACEHOLDER_RE = re.compile(r"\{d\}|\{0(\d{1,2})d\}")
ROUND_NAME_PATTERN_RE = re.compile(r"^[^{}]*(?:\{d\}|\{0\d{1,2}d\})[^{}]*$")

DEFAULT_ROUND_NAME_PATTERN = "Round {02d}"


def is_valid_round_name_pattern(pattern: str) -> bool:
    return bool(ROUND_NAME_PATTERN_RE.match(pattern))


def format_round_name(pattern: str, round_number: int) -> str:
    def _replace(match: re.Match[str]) -> str:
        width = match.group(1)
        return str(round_number) if width is None else str(round_number).zfill(int(width))

    return ROUND_NAME_PLACEHOLDER_RE.sub(_replace, pattern, count=1)
