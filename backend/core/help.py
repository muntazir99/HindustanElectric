"""
"Ask for help": answers how-to questions from docs/HANDBOOK.md (plan §15).

With a free AI model set up (HELP_LLM_BASE_URL, HELP_LLM_MODEL, HELP_LLM_KEY; any OpenAI-compatible endpoint,
e.g. Gemini or OpenRouter), the whole handbook and the question go to the model, which answers step by step in
the asker's language. Without one, or when it fails, the closest handbook topics are shown as they are.
Only the handbook, the asker's switch names and the question are sent: never shop data.
"""

import difflib
import functools
import json
import logging
import os
import re
import urllib.request
from dataclasses import dataclass

from django.conf import settings
from django.utils import timezone
from rest_framework.response import Response
from rest_framework.views import APIView

from accounts import access
from accounts.permissions import OPEN

log = logging.getLogger(__name__)

HANDBOOK = settings.BASE_DIR.parent / "docs" / "HANDBOOK.md"
MAX_QUESTION = 500
MODEL_TIMEOUT = 20  # seconds; slower than this and the handbook topics are shown instead

# Words that say nothing about the job ("how do I…"), in English, Hinglish and Hindi.
STOPWORDS = set(
    """a an the to do i is it in on of for my me and or how what where when why can with from this that
    kaise kaisa kya hai hain ka ki ke ko me mein se par pe kare karen karein karna karte karta kar ho hota
    hoga ye yeh wo woh kahan kab kyu kyon aur ek toh to bhi apna mera mujhe hum ham koi kuch nahi
    कैसे क्या है हैं का की के को में से पर करें करना करते कर हो ये वो कहाँ कब क्यों और एक भी""".split()
)

# Devanagari to rough Roman letters, so a spoken or typed "एस्टीमेट" still finds "estimate".
_VOWELS = {"अ": "a", "आ": "a", "इ": "i", "ई": "i", "उ": "u", "ऊ": "u", "ए": "e", "ऐ": "ai", "ओ": "o", "औ": "au", "ऋ": "ri"}
_SIGNS = {"ा": "a", "ि": "i", "ी": "i", "ु": "u", "ू": "u", "े": "e", "ै": "ai", "ो": "o", "ौ": "au", "ृ": "ri", "ॉ": "o"}
_CONSONANTS = dict(
    zip(
        "क ख ग घ ङ च छ ज झ ञ ट ठ ड ढ ण त थ द ध न प फ ब भ म य र ल व श ष स ह".split(),
        "k kh g gh n ch chh j jh n t th d dh n t th d dh n p ph b bh m y r l v sh sh s h".split(),
    )
)


def roman(word):
    """Rough Roman spelling of a Devanagari word (consonants carry an 'a' unless a sign or ् replaces it)."""
    out, bare = "", False  # bare: the last consonant still has its built-in 'a'
    for ch in word:
        if ch in _CONSONANTS:
            out += _CONSONANTS[ch] + "a"
            bare = True
        elif ch in _SIGNS or ch == "्":
            if bare:
                out = out[:-1]
            out += _SIGNS.get(ch, "")
            bare = False
        elif ch in _VOWELS:
            out += _VOWELS[ch]
            bare = False
        elif ch in "ंँ":
            out += "n"
            bare = False
        else:
            bare = False
    return out[:-1] if bare and len(out) > 2 else out  # "kaam", not "kaama"


def words(text):
    """Search words: lower case, Roman and Devanagari, without filler words; Devanagari also in Roman."""
    found = []
    for word in re.findall(r"[a-z0-9]+|[ऀ-ॿ]+", text.lower()):
        if word in STOPWORDS:
            continue
        found.append(word)
        if re.match(r"[ऀ-ॿ]", word):
            spelled = roman(word)
            if len(spelled) > 1 and spelled not in STOPWORDS:
                found.append(spelled)
    return found


@dataclass
class Topic:
    id: str
    title: str
    text: str


def _split(markdown):
    """One topic per "###" heading, plus each "##" section's own text (tables, rules). Section 0 is for the model."""
    topics = []
    for chunk in re.split(r"(?m)^(?=#{2,3} )", markdown):
        heading = re.match(r"#{2,3} (.+)", chunk)
        body = chunk.split("\n", 1)[1].strip() if heading else ""
        if not heading or not body or heading.group(1).startswith("0."):
            continue
        title = heading.group(1).strip()
        code = re.match(r"([A-Z]+\d+|\d+)\.", title)
        topics.append(Topic(code.group(1) if code else title, title, chunk.strip()))
    return topics


@functools.lru_cache(maxsize=2)
def _load(mtime):
    text = HANDBOOK.read_text(encoding="utf-8")
    topics = _split(text)
    index = {}  # word -> {topic number: weight}
    for number, topic in enumerate(topics):
        heading, _, body = topic.text.partition("\n")
        said = re.search(r"\*\*Words people use:\*\*(.*)", body)
        for field, weight in ((heading, 3), (said.group(1) if said else "", 3), (body, 1)):
            for word in set(words(field)):
                index.setdefault(word, {})
                index[word][number] = max(index[word].get(number, 0), weight)
    return text, topics, index


def handbook():
    """(full text, topics, word index), re-read when the file changes."""
    return _load(HANDBOOK.stat().st_mtime)


def search(question, limit=3):
    """The handbook topics closest to the question. Spelling-tolerant: "bnate" finds "banate"."""
    _, topics, index = handbook()
    vocabulary = list(index)
    scores = {}
    for word in set(words(question)):
        matches = [word] if word in index else difflib.get_close_matches(word, vocabulary, n=3, cutoff=0.8)
        for match in matches:
            closeness = 1 if match == word else difflib.SequenceMatcher(None, word, match).ratio()
            for number, weight in index[match].items():
                scores[number] = scores.get(number, 0) + weight * closeness
    best = sorted(scores, key=lambda number: -scores[number])[:limit]
    return [topics[number] for number in best if scores[number] >= 2]


def clean(question):
    """Phone numbers, amounts and other long numbers never leave the server."""
    return re.sub(r"\d[\d ,.-]{3,}\d", "[number]", question.strip())[:MAX_QUESTION]


def _who(user):
    if user.is_owner:
        return "the owner (can do everything)"
    labels = {code: label for code, _, label, _ in access.SWITCHES}
    allowed = [labels[code] for code in user.switches() if code in labels]
    return "a staff member with these switches: " + (", ".join(allowed) if allowed else "none")


def ask_model(question, user):
    """The model's answer, or None when no model is set up. Raises on network or API errors."""
    base, model, key = (os.environ.get(f"HELP_LLM_{name}", "").strip() for name in ("BASE_URL", "MODEL", "KEY"))
    if not (base and model and key) or key.lower() == "off":
        return None
    text, _, _ = handbook()
    system = (
        "You are the help assistant inside the Hindustan Electric shop app. Answer using ONLY the handbook "
        "below, following its section 0 rules exactly.\n"
        f"The person asking is {_who(user)}. Today is {timezone.localdate():%d %B %Y}.\n\n"
        f"HANDBOOK:\n{text}"
    )
    body = {
        "model": model,
        "messages": [{"role": "system", "content": system}, {"role": "user", "content": clean(question)}],
        "temperature": 0.2,
        "max_tokens": 1500,
    }
    if "nvidia.com" in base:
        # Nemotron thinks at length by default; a how-to answer from the handbook needs no thinking, and is faster.
        body["chat_template_kwargs"] = {"enable_thinking": False}
    request = urllib.request.Request(
        base.rstrip("/") + "/chat/completions",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(request, timeout=MODEL_TIMEOUT) as response:
        reply = json.load(response)
    answer = reply["choices"][0]["message"]["content"] or ""
    # Reasoning models may include their thinking; the shop only needs the answer.
    return re.sub(r"(?s)<think>.*?</think>", "", answer).strip() or None


class HelpView(APIView):
    """POST {question} -> {answer, source: "ai" | "handbook", topics: [{id, title, text}]}."""

    access = {"post": OPEN}
    throttle_scope = "help"

    def post(self, request):
        question = str(request.data.get("question") or "").strip()
        if not question:
            return Response({"detail": "Type or say a question."}, status=400)
        if len(question) > MAX_QUESTION:
            return Response({"detail": f"Keep the question under {MAX_QUESTION} letters."}, status=400)
        topics = search(question)
        try:
            answer = ask_model(question, request.user)
        except Exception as error:  # the handbook topics still answer; never fail the person asking
            log.warning("Help model failed: %s", error)
            answer = None
        return Response(
            {
                "answer": answer,
                "source": "ai" if answer else "handbook",
                "topics": [{"id": topic.id, "title": topic.title, "text": topic.text} for topic in topics],
            }
        )
