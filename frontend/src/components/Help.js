import { createContext, Fragment, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  ArrowRight,
  BookOpen,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleHelp,
  Mic,
  Minus,
  Send,
  Square,
  Volume2,
  X,
} from "lucide-react";
import api from "../api.js";
import { errorMessage } from "../lib/errors.js";
import { inputClass } from "../ui/index.js";

/*
 * The Help assistant (plan §15, design "Help side panel"). It sits above the pages, so the conversation and
 * the steps being followed stay put while you move around the app:
 *   - wide screens: a panel docked on the right; the page moves over to make room;
 *   - phones: a half-height sheet, which drops to a one-line step bar while you follow the steps.
 */

// Screens the handbook names in bold, and where they are: a step naming one gets an "Open …" button,
// and the steps follow you when you get there.
export const SCREENS = {
  home: "/dashboard",
  "new bill": "/billing",
  more: "/more",
  "old bills": "/bills",
  "kept for later": "/bills?status=held",
  estimates: "/bills?status=quotation",
  "return goods": "/bills?help=return",
  "cancel a bill": "/bills?help=cancel",
  customers: "/customers",
  khata: "/customers",
  "take payment": "/customers?owing=1",
  "all items": "/items",
  "running low": "/items?status=low",
  "add new item": "/items/new",
  "check stock": "/counts",
  "fix stock": "/adjustments",
  "goods arrived": "/purchases/new",
  "purchase bills": "/purchases",
  distributors: "/suppliers",
  "upload from excel": "/import",
  "update prices": "/import?kind=prices",
  "staff & access": "/staff",
};

const norm = (text) => (text || "").replace(/\s+/g, " ").trim().toLowerCase();

/** The **bold** names in a step: buttons and screens, as the app labels them. */
export function boldNames(step) {
  return [...step.matchAll(/\*\*([^*]+?)\*\*/g)].map((match) => match[1].replace(/[.:,]$/, "").trim());
}

/** The screen a step names, if any: { name, to }. */
export function screenOf(step) {
  const name = boldNames(step).find((bold) => SCREENS[norm(bold)]);
  return name ? { name, to: SCREENS[norm(name)] } : null;
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

/** An answer split into the text before its numbered steps, the steps, and the text after. */
export function splitSteps(text) {
  const intro = [];
  const steps = [];
  const outro = [];
  for (const line of text.split("\n")) {
    const step = line.match(/^\s*(\d+)[.)]\s+(.*)$/);
    if (step && !outro.length) steps.push(step[2]);
    else if (steps.length && !outro.length && /^\s{2,}\S/.test(line)) steps[steps.length - 1] += ` ${line.trim()}`;
    else if (steps.length) outro.push(line);
    else intro.push(line);
  }
  return { intro: intro.join("\n").trim(), steps, outro: outro.join("\n").trim() };
}

/** The text an answer shows: the assistant's, or else the closest handbook topic. */
function answerText(reply) {
  return reply.answer || (reply.topics[0] ? unwrap(reply.topics[0].text) : "");
}

/** The button or link on the page that a step names, so "Show me" can point at it. */
export function findOnScreen(names) {
  const wanted = names.map(norm).filter(Boolean);
  const candidates = [
    ...document.querySelectorAll("main button, main a, main summary, main [role=radio], header a, header button"),
  ].filter((element) => !element.closest("[data-help-panel]") && element.getClientRects().length > 0);
  for (const exact of [true, false]) {
    for (const name of wanted) {
      const found = candidates.find((element) => {
        const text = norm(element.textContent);
        return exact ? text === name : text.startsWith(`${name} `) || text.startsWith(`${name}(`);
      });
      if (found) return found;
    }
  }
  return null;
}

function spotlight(element, label) {
  document.querySelectorAll("[data-help-spot]").forEach((spot) => spot.removeAttribute("data-help-spot"));
  element.setAttribute("data-help-spot", label);
  element.scrollIntoView?.({ block: "center", behavior: "smooth" });
  setTimeout(() => element.getAttribute("data-help-spot") === label && element.removeAttribute("data-help-spot"), 8000);
}

/**
 * "**New Bill**" shows in bold; table rows read as "a — b"; headings lose their #. The handbook's
 * "Words people use" lines are search keywords, not for people.
 */
function Rich({ text }) {
  const lines = text
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

function useWide() {
  const query = "(min-width: 1024px)";
  const [wide, setWide] = useState(() => window.matchMedia?.(query).matches ?? false);
  useEffect(() => {
    const media = window.matchMedia?.(query);
    if (!media) return undefined;
    const change = () => setWide(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);
  return wide;
}

const HelpContext = createContext({ docked: false });

/** `docked`: the panel takes the right side of a wide screen, so pages lay out narrower. */
export function useHelp() {
  return useContext(HelpContext);
}

export function HelpProvider({ children }) {
  const wide = useWide();
  const { pathname } = useLocation();
  const [mode, setMode] = useState("closed"); // closed | open | steps (the phone's step bar)
  const [messages, setMessages] = useState([]);
  const [guide, setGuide] = useState(null); // { title, steps, current }
  const [busy, setBusy] = useState(false);

  // Arriving on a screen a later step names moves the steps along to it.
  useEffect(() => {
    setGuide((current) => {
      if (!current) return current;
      const index = current.steps.findIndex((step, i) => i >= current.current && screenOf(step)?.to.split("?")[0] === pathname);
      return index > current.current ? { ...current, current: index } : current;
    });
  }, [pathname]);

  const ask = useCallback(async (question) => {
    setBusy(true);
    try {
      const { data } = await api.post("/help/ask", { question });
      setMessages((list) => [...list, { id: Date.now(), question, reply: data }]);
      const { steps } = splitSteps(answerText(data));
      if (steps.length) {
        const start = steps.findIndex((step) => screenOf(step)?.to.split("?")[0] === window.location.pathname);
        setGuide({ title: question, steps, current: Math.max(start, 0) });
      }
    } catch (err) {
      setMessages((list) => [...list, { id: Date.now(), question, error: errorMessage(err) }]);
    } finally {
      setBusy(false);
    }
  }, []);

  const value = { wide, mode, setMode, messages, ask, busy, guide, setGuide, docked: wide && mode === "open" };
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

const Recognition = typeof window !== "undefined" ? window.SpeechRecognition || window.webkitSpeechRecognition : null;

function speakable(text) {
  return text.replace(/\*\*|#|\|/g, " ").replace(/<[^>]+>/g, "");
}

function ReadAloud({ text }) {
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => () => window.speechSynthesis?.cancel(), []);
  if (!("speechSynthesis" in window)) return null;
  function toggle() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    const utterance = new SpeechSynthesisUtterance(speakable(text));
    utterance.lang = /[ऀ-ॿ]/.test(text) ? "hi-IN" : "en-IN";
    utterance.onend = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }
  return (
    <button type="button" onClick={toggle} className="inline-flex items-center gap-1.5 h-10 px-3 rounded-lg border border-gray-300 bg-white text-sm font-semibold">
      {speaking ? <Square size={16} /> : <Volume2 size={18} />} {speaking ? "Stop" : "Read aloud"}
    </button>
  );
}

/** The steps of the answer being followed: done, the one you're on, the ones to come. */
function Steps({ guide, setGuide, onFollow }) {
  const { pathname } = useLocation();
  const [notHere, setNotHere] = useState("");
  const { steps, current } = guide;

  function showMe(step, index) {
    const names = boldNames(step);
    const found = findOnScreen(names);
    if (found) {
      setNotHere("");
      spotlight(found, `Step ${index + 1}`);
    } else {
      setNotHere(names.length ? `Can't see “${names[0]}” on this screen.` : "Nothing on this screen to point at.");
    }
  }

  return (
    <ol className="space-y-1.5">
      {steps.map((step, index) => {
        const screen = screenOf(step);
        const here = screen && screen.to.split("?")[0] === pathname;
        const state = index < current ? "done" : index === current ? "now" : "later";
        return (
          <li key={index} className={`flex gap-2.5 p-2 rounded-lg ${state === "now" ? "bg-steel-50 border border-steel-200" : ""}`}>
            <span
              className={`shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold ${
                state === "done" ? "bg-green-700 text-white" : state === "now" ? "bg-steel-800 text-white" : "border-2 border-steel-200 text-steel-700"
              }`}
            >
              {state === "done" ? <Check size={15} strokeWidth={3} aria-label="Done" /> : index + 1}
            </span>
            <div className={`min-w-0 flex-1 ${state === "done" ? "text-gray-600" : ""}`}>
              <Rich text={step} />
              {here && <p className="text-sm font-semibold text-green-800 mt-0.5">You're here</p>}
              {state === "now" && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {screen && !here && (
                    <Link to={screen.to} onClick={onFollow} className="inline-flex items-center gap-1 h-9 px-3 rounded-lg border border-steel-800 bg-white text-steel-900 text-sm font-bold">
                      Open {screen.name} <ArrowRight size={16} />
                    </Link>
                  )}
                  <button type="button" onClick={() => showMe(step, index)} className="h-9 px-3 rounded-lg border border-steel-800 bg-white text-steel-900 text-sm font-bold">
                    Show me
                  </button>
                  <button type="button" onClick={() => setGuide({ ...guide, current: index + 1 })} className="h-9 px-3 rounded-lg text-steel-900 text-sm font-semibold hover:bg-white">
                    {index + 1 < steps.length ? "Done, next step" : "Done"}
                  </button>
                </div>
              )}
              {state === "now" && notHere && <p className="text-sm text-amber-800 mt-1">{notHere}</p>}
            </div>
          </li>
        );
      })}
      {current >= steps.length && (
        <li className="flex items-center gap-2 p-2 rounded-lg bg-green-50 text-green-900 font-semibold">
          <Check size={18} /> All steps done
        </li>
      )}
    </ol>
  );
}

function Answer({ message, guide, setGuide, isGuide, onFollow, wide }) {
  if (message.error) return <p className="text-red-700">{message.error}</p>;
  const { reply } = message;
  const text = answerText(reply);
  if (!text) return <p>Nothing in the handbook matches that. Try other words, or ask the owner.</p>;
  const { intro, outro } = splitSteps(text);
  return (
    <div className="space-y-2.5">
      {!reply.answer && <p className="text-sm text-gray-600">From the handbook:</p>}
      {isGuide ? (
        <>
          {intro && <Rich text={intro} />}
          <Steps guide={guide} setGuide={setGuide} onFollow={onFollow} />
          {outro && <Rich text={outro} />}
        </>
      ) : (
        <Rich text={text} />
      )}
      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {isGuide && !wide && (
          <button type="button" onClick={onFollow} className="h-10 px-3 rounded-lg bg-steel-800 text-white text-sm font-bold">
            Follow these steps
          </button>
        )}
        <ReadAloud text={text} />
      </div>
      {reply.topics.slice(reply.answer ? 0 : 1).map((topic) => (
        <details key={topic.id} className="text-sm">
          <summary className="cursor-pointer text-blue-800 inline-flex items-center gap-1.5">
            <BookOpen size={15} /> Handbook: {topic.title.replace(/^[A-Z]*\d+\.\s*/, "")}
          </summary>
          <div className="mt-2 p-3 bg-gray-50 rounded-lg">
            <Rich text={unwrap(topic.text)} />
          </div>
        </details>
      ))}
    </div>
  );
}

function AskForm({ ask, busy }) {
  const [question, setQuestion] = useState("");
  const [listening, setListening] = useState(false);
  const [voiceLang, setVoiceLang] = useState("hi-IN");
  const [problem, setProblem] = useState("");
  const recognition = useRef(null);
  useEffect(() => () => recognition.current?.abort(), []);

  function send(text = question) {
    const asked = text.trim();
    if (!asked || busy) return;
    setQuestion("");
    setProblem("");
    ask(asked);
  }

  function listen() {
    if (listening) {
      recognition.current?.stop();
      return;
    }
    const heard = new Recognition();
    heard.lang = voiceLang;
    heard.interimResults = false;
    heard.onresult = (event) => send(event.results[0][0].transcript);
    heard.onerror = (event) => event.error !== "aborted" && setProblem("Couldn't hear that. Try again, or type the question.");
    heard.onend = () => setListening(false);
    recognition.current = heard;
    setListening(true);
    heard.start();
  }

  return (
    <form
      className="p-3 border-t border-line bg-white space-y-2"
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div className="flex gap-2">
        <input
          className={`${inputClass} flex-1 min-w-0`}
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Type your question"
          aria-label="Your question"
          maxLength={500}
        />
        {Recognition && (
          <button
            type="button"
            onClick={listen}
            aria-pressed={listening}
            aria-label={listening ? "Stop listening" : "Speak your question"}
            className={`shrink-0 w-11 h-11 rounded-lg border flex items-center justify-center ${
              listening ? "bg-red-600 border-red-600 text-white" : "border-gray-300 bg-white text-steel-800 hover:bg-steel-50"
            }`}
          >
            {listening ? <Square size={18} /> : <Mic size={20} />}
          </button>
        )}
        <button type="submit" aria-label="Ask" disabled={busy || !question.trim()} className="shrink-0 w-11 h-11 rounded-lg bg-steel-800 text-white flex items-center justify-center disabled:opacity-40">
          <Send size={18} />
        </button>
      </div>
      {Recognition && (
        <div className="flex items-center gap-1.5 text-sm text-gray-600" role="radiogroup" aria-label="Speaking in">
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
              className={`px-2.5 py-0.5 rounded-full border ${voiceLang === lang ? "bg-steel-800 text-white border-steel-800" : "border-gray-300 bg-white"}`}
            >
              {label}
            </button>
          ))}
          {listening && <span className="text-red-700 font-semibold">Listening…</span>}
        </div>
      )}
      {problem && <p className="text-sm text-red-700">{problem}</p>}
    </form>
  );
}

function Progress({ guide }) {
  const { steps, current } = guide;
  return (
    <div className="px-4 py-2.5 border-b border-gray-100">
      <div className="flex justify-between gap-3 text-sm">
        <b className="text-steel-900 truncate">{guide.title}</b>
        <span className="shrink-0 text-gray-600">{current < steps.length ? `Step ${current + 1} of ${steps.length}` : "Done"}</span>
      </div>
      <div className="flex gap-1 mt-1.5" aria-hidden="true">
        {steps.map((_, index) => (
          <span key={index} className={`h-1.5 flex-1 rounded-full ${index <= current ? "bg-steel-800" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

/** The phone's one-line step bar: the step you're on, back and next, and a way back to the full chat. */
function StepBar({ guide, setGuide, setMode }) {
  const { steps, current } = guide;
  const done = current >= steps.length;
  const step = steps[Math.min(current, steps.length - 1)];
  return (
    <div
      role="region"
      aria-label="Help steps"
      data-help-panel
      className="print:hidden fixed inset-x-0 bottom-0 z-40 bg-white border-t border-line shadow-[0_-6px_18px_rgba(30,61,88,0.12)] px-3 py-2.5 flex items-center gap-2"
    >
      <span className="shrink-0 w-9 h-9 rounded-full bg-steel-800 text-white flex items-center justify-center">
        <CircleHelp size={20} />
      </span>
      <div className="flex-1 min-w-0 leading-tight">
        <p className="text-xs font-bold uppercase tracking-wide text-steel-700">{done ? "All steps done" : `Step ${current + 1} of ${steps.length}`}</p>
        {!done && (
          <div className="line-clamp-2 text-[15px]">
            <Rich text={step} />
          </div>
        )}
      </div>
      <button type="button" aria-label="Previous step" disabled={current === 0} onClick={() => setGuide({ ...guide, current: current - 1 })} className="shrink-0 w-11 h-11 rounded-lg border border-gray-300 bg-white text-steel-900 flex items-center justify-center disabled:opacity-40">
        <ChevronLeft size={20} />
      </button>
      {done ? (
        <button type="button" aria-label="Close Help" onClick={() => { setGuide(null); setMode("closed"); }} className="shrink-0 w-11 h-11 rounded-lg bg-steel-800 text-white flex items-center justify-center">
          <X size={20} />
        </button>
      ) : (
        <button type="button" aria-label="Next step" onClick={() => setGuide({ ...guide, current: current + 1 })} className="shrink-0 w-11 h-11 rounded-lg bg-steel-800 text-white flex items-center justify-center">
          <ChevronRight size={20} />
        </button>
      )}
      <button type="button" aria-label="Open Help" onClick={() => setMode("open")} className="shrink-0 w-11 h-11 rounded-lg text-steel-900 flex items-center justify-center">
        <ChevronUp size={22} />
      </button>
    </div>
  );
}

/** The ? button, the panel (wide screens) or sheet (phones), and the phone's step bar. */
export default function Help() {
  const { wide, mode, setMode, messages, ask, busy, guide, setGuide } = useHelp();
  const end = useRef(null);
  // Braces matter: Chrome's scrollIntoView returns a promise, and an effect may only return a clean-up function.
  useEffect(() => {
    end.current?.scrollIntoView?.({ block: "end" });
  }, [messages.length, busy]);

  const lastGuided = [...messages].reverse().find((message) => message.reply && splitSteps(answerText(message.reply)).steps.length);
  const following = guide && guide.current < guide.steps.length;

  if (mode === "steps" && guide && !wide) return <StepBar guide={guide} setGuide={setGuide} setMode={setMode} />;

  if (mode !== "open") {
    return (
      <button
        type="button"
        onClick={() => setMode("open")}
        aria-label="Help — ask how to do something"
        title="Help"
        className="print:hidden fixed bottom-4 right-4 z-40 w-14 h-14 rounded-full bg-steel-800 hover:bg-steel-900 text-white shadow-lg flex items-center justify-center"
      >
        <CircleHelp size={30} />
        {following && (
          <span className="absolute -top-1 -right-1 min-w-[26px] h-[26px] px-1 rounded-full bg-white text-steel-900 border-2 border-steel-800 text-xs font-bold flex items-center justify-center">
            {guide.current + 1}/{guide.steps.length}
          </span>
        )}
      </button>
    );
  }

  const smaller = () => setMode(!wide && guide ? "steps" : "closed");
  return (
    <section
      aria-label="Help"
      data-help-panel
      onKeyDown={(event) => event.key === "Escape" && smaller()}
      className="print:hidden fixed z-40 bg-white flex flex-col inset-x-0 bottom-0 h-[72vh] rounded-t-2xl shadow-[0_-8px_28px_rgba(30,61,88,0.22)] lg:inset-x-auto lg:right-0 lg:top-[var(--top-bar-h,72px)] lg:h-auto lg:w-[400px] lg:rounded-none lg:shadow-none lg:border-l lg:border-line"
    >
      <div className="lg:hidden flex justify-center pt-2" aria-hidden="true">
        <span className="w-11 h-1.5 rounded-full bg-steel-200" />
      </div>
      <div className="flex items-center gap-2.5 pl-4 pr-2 py-2 bg-steel-50 border-b border-line max-lg:bg-white">
        <span className="max-lg:hidden w-9 h-9 rounded-full bg-steel-800 text-white flex items-center justify-center">
          <CircleHelp size={20} />
        </span>
        <div className="flex-1 min-w-0 leading-tight">
          <h2 className="text-lg font-bold text-steel-900">Help</h2>
          <p className="text-sm text-steel-700">Answers from the shop handbook</p>
        </div>
        <button type="button" onClick={smaller} aria-label="Make Help smaller" title="Smaller" className="w-11 h-11 rounded-lg text-steel-900 hover:bg-white flex items-center justify-center">
          {wide ? <Minus size={20} /> : <ChevronDown size={22} />}
        </button>
        <button
          type="button"
          onClick={() => {
            setGuide(null);
            setMode("closed");
          }}
          aria-label="Close Help"
          title="Close"
          className="w-11 h-11 rounded-lg text-steel-900 hover:bg-white flex items-center justify-center"
        >
          <X size={20} />
        </button>
      </div>
      {guide && <Progress guide={guide} />}

      <div className="flex-1 overflow-y-auto p-4 space-y-4" aria-live="polite">
        {messages.length === 0 && !busy && (
          <p className="text-gray-600">Ask how to do something, in Hindi, Hinglish or English. E.g. "estimate kaise banate hai".</p>
        )}
        {messages.map((message) => (
          <div key={message.id} className="space-y-2.5">
            <p className="ml-auto w-fit max-w-[85%] px-3.5 py-2 rounded-xl rounded-br-sm bg-steel-100">{message.question}</p>
            <Answer
              message={message}
              guide={guide}
              setGuide={setGuide}
              isGuide={Boolean(guide) && message === lastGuided}
              onFollow={() => !wide && setMode("steps")}
              wide={wide}
            />
          </div>
        ))}
        {busy && <p className="text-gray-600">Looking in the handbook…</p>}
        <div ref={end} />
      </div>
      <AskForm ask={ask} busy={busy} />
    </section>
  );
}
