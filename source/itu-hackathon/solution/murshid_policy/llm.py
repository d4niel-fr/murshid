"""Low-cost LLM access through OpenRouter, with a hard call budget and an offline mode.

Defaults are free OpenRouter models (no cost). The key's free tier is shared with the
Murshid live demo (50 free requests/day), so a run never spends more than MAX_CALLS calls;
when the budget is spent, or a call fails, the caller falls back to the deterministic
rules+retrieval engine and the audit log records why.
"""
from __future__ import annotations

import json
import os
import threading
import re
import time

import httpx

DEFAULT_MODELS = [m.strip() for m in os.environ.get(
    "MURSHID_POLICY_MODELS",
    "nvidia/nemotron-3.5-lightning:free,google/gemma-4-31b-it:free",
).split(",") if m.strip()]
# Paid but cheap, used only if MURSHID_POLICY_ALLOW_PAID=1 (and the key has credit)
PAID_MODEL = os.environ.get("MURSHID_POLICY_PAID_MODEL", "google/gemini-2.5-flash-lite")
PRICES = {"google/gemini-2.5-flash-lite": (0.10, 0.40), "openai/gpt-5-nano": (0.05, 0.40)}  # USD per 1M tokens


class Budget:
    def __init__(self, max_calls: int):
        self.max_calls = max_calls
        self.calls = 0
        self.cost = 0.0
        self.tokens_in = 0
        self.tokens_out = 0
        self.lock = threading.Lock()

    def take(self, reserve: int = 0) -> bool:
        with self.lock:
            if self.calls >= self.max_calls - reserve:
                return False
            self.calls += 1
            return True


class LLM:
    def __init__(self, mode: str = "offline", max_calls: int = 12, wall_s: float = float(os.environ.get("MURSHID_POLICY_WALL_S", "70"))):
        self.mode = mode  # "offline" | "openrouter"
        self.deadline = time.time() + wall_s   # stop using the model after this (keeps runs short)
        self.key = os.environ.get("OPENROUTER_API_KEY", "")
        self.budget = Budget(max_calls)
        if mode == "openrouter" and not self.key:
            self.mode = "offline"

    @property
    def available(self) -> bool:
        return self.mode == "openrouter" and self.budget.calls < self.budget.max_calls and time.time() < self.deadline

    def chat_json(self, system: str, user: str, max_tokens: int = 900, reserve: int = 0) -> tuple[dict | None, dict]:
        """Return (parsed_json_or_None, call_info)."""
        info = {"mode": self.mode, "model": None, "ok": False, "error": None, "errors": [], "usage": None, "cost_usd": 0.0, "latency_ms": None}
        if not self.available:
            info["error"] = "offline mode" if self.mode != "openrouter" else "call budget spent"
            return None, info
        models = list(DEFAULT_MODELS)
        if os.environ.get("MURSHID_POLICY_ALLOW_PAID") == "1":
            models.append(PAID_MODEL)
        for model in models:
            if not self.budget.take(reserve):
                info["errors"].append("call budget spent")
                break
            t = time.perf_counter()
            try:
                r = httpx.post(
                    "https://openrouter.ai/api/v1/chat/completions",
                    headers={"Authorization": f"Bearer {self.key}", "HTTP-Referer": "https://murshid-web.vercel.app",
                             "X-Title": "Murshid ITU policy simulation"},
                    json={"model": model, "max_tokens": max_tokens, "temperature": 0.2,
                          **({"reasoning": {"enabled": False}} if "nemotron" in model else {}), "response_format": {"type": "json_object"},
                          "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]},
                    timeout=35,
                )
                info["latency_ms"] = round((time.perf_counter() - t) * 1000)
                data = r.json()
                if r.status_code == 429 and not info.get("retried_" + model):
                    info["retried_" + model] = True
                    time.sleep(4)
                    r = httpx.post(r.request.url, headers=r.request.headers, content=r.request.content, timeout=35)
                    data = r.json()
                if r.status_code != 200 or "choices" not in data:
                    info["error"] = f"{model}: HTTP {r.status_code} {str(data.get('error', data))[:160]}"
                    info["errors"].append(info["error"])
                    continue
                text = data["choices"][0]["message"].get("content") or ""
                usage = data.get("usage") or {}
                info.update(model=model, usage=usage)
                self.budget.tokens_in += usage.get("prompt_tokens", 0)
                self.budget.tokens_out += usage.get("completion_tokens", 0)
                if model in PRICES:
                    pi, po = PRICES[model]
                    info["cost_usd"] = round((usage.get("prompt_tokens", 0) * pi + usage.get("completion_tokens", 0) * po) / 1e6, 6)
                    self.budget.cost += info["cost_usd"]
                parsed = extract_json(text)
                if parsed is None:
                    info["error"] = f"{model}: reply was not valid JSON"
                    info["raw"] = text[:400]
                    info["errors"].append(info["error"])
                    continue
                info["ok"] = True
                info["error"] = None
                return parsed, info
            except Exception as e:  # network / timeout
                info["error"] = f"{model}: {type(e).__name__} {str(e)[:120]}"
                info["errors"].append(info["error"])
        return None, info


def extract_json(text: str) -> dict | None:
    text = re.sub(r"(?s)<think>.*?</think>", "", text).strip()
    m = re.search(r"```(?:json)?\s*(\{.*\})\s*```", text, re.S)
    cand = m.group(1) if m else text[text.find("{"): text.rfind("}") + 1]
    try:
        return json.loads(cand)
    except Exception:
        return None
