"""Help assistant (plan §15): handbook search, the AI call, and the fallback when there's no AI."""

import io
import json
from unittest import mock

import pytest

from core import help

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "question, topic",
    [
        ("estimate kaise bnate hai", "B10"),  # Hinglish, misspelt
        ("एस्टीमेट कैसे बनाते हैं", "B10"),  # Hindi, as the phone's speech input writes it
        ("udhaar ka paisa kaise le", "K3"),
        ("customer saman wapas laya", "B13"),
        ("maal aaya entry kaise kare", "P1"),
        ("toota hua saman stock se hatana", "S3"),
        ("How do I add a new staff member?", "O1"),
    ],
)
def test_search_finds_the_right_handbook_topic(question, topic):
    assert help.search(question)[0].id == topic


def test_devanagari_is_also_matched_in_roman_letters():
    assert help.roman("एस्टीमेट") == "estimet"
    assert help.roman("बनाते") == "banate"


def test_numbers_never_leave_the_server():
    cleaned = help.clean("Ramesh 9876500011 ka ₹2,757 udhaar kaise le")
    assert "9876500011" not in cleaned and "2,757" not in cleaned
    assert "udhaar" in cleaned


def test_without_ai_the_handbook_topics_answer(staff_api, monkeypatch):
    monkeypatch.delenv("HELP_LLM_KEY", raising=False)
    response = staff_api.post("/api/help/ask", {"question": "estimate kaise banate hai"}, format="json")
    assert response.status_code == 200
    body = response.json()
    assert body["source"] == "handbook" and body["answer"] is None
    assert body["topics"][0]["id"] == "B10"
    assert "Make estimate" in body["topics"][0]["text"]


def test_key_off_turns_the_ai_off(staff_api, monkeypatch):
    ai_settings(monkeypatch)
    monkeypatch.setenv("HELP_LLM_KEY", "off")
    with mock.patch("core.help.urllib.request.urlopen") as urlopen:
        body = staff_api.post("/api/help/ask", {"question": "khata print"}, format="json").json()
    urlopen.assert_not_called()
    assert body["source"] == "handbook" and body["topics"][0]["id"] == "K7"


def test_an_empty_question_is_refused(staff_api):
    assert staff_api.post("/api/help/ask", {"question": "  "}, format="json").status_code == 400


def ai_settings(monkeypatch):
    monkeypatch.setenv("HELP_LLM_BASE_URL", "https://example.test/v1")
    monkeypatch.setenv("HELP_LLM_MODEL", "some-free-model")
    monkeypatch.setenv("HELP_LLM_KEY", "test-key")


def test_ai_gets_the_whole_handbook_and_the_switches_but_no_numbers(staff_api, monkeypatch):
    ai_settings(monkeypatch)
    sent = {}

    def fake_urlopen(request, timeout):
        sent["url"] = request.full_url
        sent["key"] = request.headers["Authorization"]
        sent["body"] = json.loads(request.data)
        reply = {"choices": [{"message": {"content": "<think>hmm</think>1. **New Bill** kholo…"}}]}
        return io.BytesIO(json.dumps(reply).encode())

    with mock.patch("core.help.urllib.request.urlopen", fake_urlopen):
        response = staff_api.post("/api/help/ask", {"question": "9876500011 ka estimate kaise banaye"}, format="json")

    body = response.json()
    assert body["source"] == "ai"
    assert body["answer"] == "1. **New Bill** kholo…"  # the model's thinking is dropped
    assert sent["url"] == "https://example.test/v1/chat/completions"
    assert sent["key"] == "Bearer test-key"
    system, question = (message["content"] for message in sent["body"]["messages"])
    assert "## 0. For the help assistant" in system and "### B10. Make an estimate" in system  # the whole handbook
    assert "Make bills" in system  # the asker's switches, so it can say "ask the owner"
    assert "9876500011" not in question


def test_when_the_ai_fails_the_handbook_still_answers(staff_api, monkeypatch):
    ai_settings(monkeypatch)
    with mock.patch("core.help.urllib.request.urlopen", side_effect=TimeoutError("too slow")):
        response = staff_api.post("/api/help/ask", {"question": "bill cancel karna hai"}, format="json")
    body = response.json()
    assert response.status_code == 200
    assert body["source"] == "handbook"
    assert body["topics"][0]["id"] == "B14"


def test_nvidia_nemotron_answers_without_long_thinking(staff_api, monkeypatch):
    monkeypatch.setenv("HELP_LLM_BASE_URL", "https://integrate.api.nvidia.com/v1")
    monkeypatch.setenv("HELP_LLM_MODEL", "nvidia/nemotron-3-ultra-550b-a55b")
    monkeypatch.setenv("HELP_LLM_KEY", "test-key")
    sent = {}

    def fake_urlopen(request, timeout):
        sent["body"] = json.loads(request.data)
        return io.BytesIO(json.dumps({"choices": [{"message": {"content": "1. **New Bill**"}}]}).encode())

    with mock.patch("core.help.urllib.request.urlopen", fake_urlopen):
        staff_api.post("/api/help/ask", {"question": "estimate kaise banaye"}, format="json")
    assert sent["body"]["chat_template_kwargs"] == {"enable_thinking": False}
    assert sent["body"]["model"] == "nvidia/nemotron-3-ultra-550b-a55b"
