import { Fragment, useEffect, useRef, useState } from "react";
import { CircleHelp, Mic, Send, Square, Volume2 } from "lucide-react";
import api from "../api.js";
import { errorMessage } from "../lib/errors.js";
import { Alert, Button, Modal, inputClass } from "../ui/index.js";

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

/**
 * "**New Bill**" in answers and handbook text shows in bold; table rows read as "a — b"; headings lose their #.
 * The handbook's "Words people use" lines are search keywords, not for people. `wrapped`: handbook text, whose
 * long lines are wrapped in the file (see unwrap).
 */
function Rich({ text, wrapped = false }) {
  const source = wrapped ? unwrap(text) : text;
  const lines = source
    .split("\n")
    .filter((line) => !/^\|[\s|:-]+\|$/.test(line.trim()) && !line.startsWith("**Words people use:**"))
    .map((line) =>
      line.trim().startsWith("|")
        ? line.trim().replace(/^\||\|$/g, "").split("|").map((cell) => cell.trim()).join(" — ")
        : line.replace(/^#{1,4} /, "")
    );
  return (
    <div className="whitespace-pre-wrap leading-relaxed">
      {lines.join("\n").split(/(\*\*[^*]+\*\*)/).map((part, index) =>
        part.startsWith("**") ? <b key={index}>{part.slice(2, -2)}</b> : <Fragment key={index}>{part}</Fragment>
      )}
    </div>
  );
}

/** Joins the handbook's wrapped lines: an indented line continues the one above (unless it starts a step or
 * point); so does an unindented one, unless it starts a step, point, table row, heading or **label**. */
export function unwrap(text) {
  return text
    .split("\n")
    .reduce((out, line) => {
      const indented = /^ {2,}\S/.test(line) && !/^\s*(\d+\.|[-*]\s)/.test(line);
      const plain = /^\S/.test(line) && !/^(\d+\.|[-*]\s|\||#|\*\*)/.test(line);
      if (out.length && out[out.length - 1].trim() && (indented || plain)) out[out.length - 1] += ` ${line.trim()}`;
      else out.push(line);
      return out;
    }, [])
    .join("\n");
}

function speakable(text) {
  return text.replace(/\*\*|#|\|/g, " ").replace(/<[^>]+>/g, "");
}

/**
 * The round ? button on every screen, and the Help panel it opens: ask by typing or speaking (Hindi or
 * English); the answer comes from the handbook (plan §15).
 */
export default function HelpButton() {
  const [open, setOpen] = useState(false);
  const [question, setQuestion] = useState("");
  const [reply, setReply] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceLang, setVoiceLang] = useState("hi-IN");
  const recognition = useRef(null);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  async function ask(text = question) {
    const asked = text.trim();
    if (!asked || busy) return;
    setBusy(true);
    setError("");
    setReply(null);
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    try {
      const response = await api.post("/help/ask", { question: asked });
      setReply(response.data);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  function listen() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const heard = new Recognition();
    heard.lang = voiceLang;
    heard.interimResults = false;
    heard.onresult = (event) => {
      const text = event.results[0][0].transcript;
      setQuestion(text);
      ask(text);
    };
    heard.onerror = (event) => event.error !== "aborted" && setError("Couldn't hear that. Try again, or type the question.");
    heard.onend = () => setListening(false);
    recognition.current = heard;
    setListening(true);
    heard.start();
  }

  function speak() {
    const synth = window.speechSynthesis;
    if (speaking) {
      synth.cancel();
      setSpeaking(false);
      return;
    }
    const text = reply.answer || reply.topics.map((topic) => topic.text).join("\n");
    const utterance = new SpeechSynthesisUtterance(speakable(text));
    utterance.lang = /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN";
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    synth.speak(utterance);
  }

  function close() {
    recognition.current?.abort();
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setOpen(false);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Help — ask how to do something"
        title="Help"
        className="print:hidden fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-steel-800 hover:bg-steel-900 text-white shadow-lg flex items-center justify-center"
      >
        <CircleHelp size={30} />
      </button>

      {open && (
        <Modal title="Help" onClose={close}>
          <p className="text-gray-600 mb-3">Ask how to do something, in Hindi, Hinglish or English. E.g. "estimate kaise banate hai".</p>
          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              ask();
            }}
          >
            <input
              className={`${inputClass} flex-1 min-w-0`}
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Type your question"
              aria-label="Your question"
              maxLength={500}
              autoFocus
            />
            {Recognition && (
              <button
                type="button"
                onClick={listen}
                aria-pressed={listening}
                aria-label={listening ? "Stop listening" : "Speak your question"}
                className={`shrink-0 w-12 h-12 rounded-lg border flex items-center justify-center ${
                  listening ? "bg-red-600 border-red-600 text-white" : "border-gray-300 text-steel-800 hover:bg-steel-50"
                }`}
              >
                {listening ? <Square size={20} /> : <Mic size={22} />}
              </button>
            )}
            <Button variant="primary" type="submit" disabled={busy || !question.trim()} aria-label="Ask">
              <Send size={18} />
            </Button>
          </form>
          {Recognition && (
            <div className="flex items-center gap-2 mt-2 text-sm text-gray-600" role="radiogroup" aria-label="Speaking in">
              Speaking in:
              {[
                ["hi-IN", "हिंदी"],
                ["en-IN", "English"],
              ].map(([lang, label]) => (
                <button
                  key={lang}
                  type="button"
                  role="radio"
                  aria-checked={voiceLang === lang}
                  onClick={() => setVoiceLang(lang)}
                  className={`px-3 py-1 rounded-full border ${voiceLang === lang ? "bg-steel-800 text-white border-steel-800" : "border-gray-300"}`}
                >
                  {label}
                </button>
              ))}
              {listening && <span className="text-red-700 font-semibold">Listening…</span>}
            </div>
          )}

          <div className="mt-4" aria-live="polite">
            <Alert onClose={() => setError("")}>{error}</Alert>
            {busy && <p className="text-gray-600">Looking in the handbook…</p>}
            {reply && (
              <div className="space-y-3">
                {reply.answer ? (
                  <Rich text={reply.answer} />
                ) : reply.topics.length ? (
                  <>
                    <p className="text-gray-600">These parts of the handbook match your question:</p>
                    <Rich text={reply.topics[0].text} wrapped />
                  </>
                ) : (
                  <p>Nothing in the handbook matches that. Try other words, or ask the owner.</p>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-gray-100">
                  {(reply.answer || reply.topics.length > 0) && "speechSynthesis" in window && (
                    <button type="button" onClick={speak} className="inline-flex items-center gap-1.5 min-h-[40px] px-3 rounded-lg border border-gray-300 font-semibold">
                      {speaking ? <Square size={16} /> : <Volume2 size={18} />} {speaking ? "Stop" : "Read aloud"}
                    </button>
                  )}
                  {reply.topics.slice(reply.answer ? 0 : 1).map((topic) => (
                    <details key={topic.id} className="w-full text-sm">
                      <summary className="cursor-pointer text-blue-800">From the handbook: {topic.title}</summary>
                      <div className="mt-2 p-3 bg-gray-50 rounded-lg">
                        <Rich text={topic.text} wrapped />
                      </div>
                    </details>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
