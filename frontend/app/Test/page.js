"use client";

import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Loader2,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Trophy,
  Flame,
  BookOpen,
} from "lucide-react";
import { apiUrl } from "@/lib/api";

const API = apiUrl("");

const TYPES = [
  ["MCQ", "Multiple choice"],
  ["Short Answer", "Non-MCQ / Short Answer"],
  ["Mixed", "MCQ + Short Answer"],
];

const DIFFICULTIES = [
  "Easy",
  "Medium",
  "Hard",
  "Adaptive",
];

const TEST_MODES = [
  ["Practice", "Practice Test"],
  ["Revision Test", "Revision Test"],
  ["Challenge Me", "Challenge Me"],
];

const EXAM_PATTERNS = [
  "Custom",
  "Interview",
  "Competitive Exam",
  "University",
];

export default function TestPage() {
  const [topic, setTopic] = useState("");
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState("Medium");
  const [questionType, setQuestionType] = useState("MCQ");
  const [testMode, setTestMode] = useState("Practice");
  const [examPattern, setExamPattern] = useState("Custom");

  const [questions, setQuestions] = useState(null);
  const [answers, setAnswers] = useState({});
  const [index, setIndex] = useState(0);
  const [started, setStarted] = useState(0);

  const [result, setResult] = useState(null);

  const [xpEarned, setXpEarned] = useState(0);
  const [testStreak, setTestStreak] = useState(0);
  const [badges, setBadges] = useState([]);
  const [bestScore, setBestScore] = useState(0);

  const [revisionTopics, setRevisionTopics] = useState([]);

  // IMPORTANT:
  // Backend can change the topic for Revision Test and
  // difficulty for Adaptive / Challenge Me.
  const [actualTopic, setActualTopic] = useState("");
  const [actualDifficulty, setActualDifficulty] =
    useState("Medium");

  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const current = questions?.[index];

  function selectTestMode(value) {
    setTestMode(value);
    if (value === "Revision Test") {
      setTopic("");
    }
  }

  // --------------------------------------------------
  // GENERATE TEST
  // --------------------------------------------------

  async function generate(e) {
    e?.preventDefault();

    const email = localStorage.getItem("email");

    if (!email) {
      setError("Please log in first.");
      return;
    }

    if (
      testMode !== "Revision Test" &&
      !topic.trim()
    ) {
      setError("Please enter a topic.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const r = await fetch(`${API}/generateTest`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          topic: topic.trim(),
          numQuestions: count,
          difficulty,
          questionType,
          testMode,
          examPattern,

          personalization: {},
          coverage: [],
          advancedOptions: {},
        }),
      });

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.detail ||
            d.error ||
            "Could not generate the test."
        );
      }

      if (
        !d.success ||
        !Array.isArray(d.questions) ||
        d.questions.length === 0
      ) {
        throw new Error(
          d.error || "No questions generated."
        );
      }

      setQuestions(d.questions);
      setAnswers({});
      setIndex(0);
      setStarted(Date.now());

      // Backend-generated revision topics
      setRevisionTopics(
        Array.isArray(d.revisionTopics)
          ? d.revisionTopics
          : []
      );

      // IMPORTANT:
      // Store values actually used by backend.
      setActualTopic(d.topic || topic);

      setActualDifficulty(
        d.difficulty || difficulty
      );

      // If backend changed difficulty because of
      // Adaptive / Challenge Me, reflect it in UI.
      if (d.difficulty) {
        setDifficulty(d.difficulty);
      }

      setResult(null);
      setXpEarned(0);
      setTestStreak(0);
      setBadges([]);
      setBestScore(0);
    } catch (err) {
      setError(
        err?.message ||
          "Something went wrong."
      );
    } finally {
      setLoading(false);
    }
  }

  // --------------------------------------------------
  // SUBMIT TEST
  // --------------------------------------------------

  async function submit() {
    const email = localStorage.getItem("email");

    if (!email) {
      setError("Please log in first.");
      return;
    }

    if (!questions?.length) {
      setError("No test available.");
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const r = await fetch(
        `${API}/api/tests/submit`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email,

            // IMPORTANT:
            // Use the topic returned by backend.
            // For Revision Test backend may have replaced
            // the original topic with revision topics.
            topic: actualTopic || topic,

            questions,
            answers,

            // Use backend-resolved difficulty.
            difficulty:
              actualDifficulty || difficulty,

            questionType,
            testMode,
            examPattern,

            timeTaken: started
              ? Math.floor(
                  (Date.now() - started) / 1000
                )
              : 0,

            advancedOptions: {},
          }),
        }
      );

      const d = await r.json();

      if (!r.ok) {
        throw new Error(
          d.detail ||
            d.error ||
            "Could not save result."
        );
      }

      if (!d.success || !d.result) {
        throw new Error(
          d.error ||
            "Could not calculate result."
        );
      }

      setResult(d.result);

      setXpEarned(
        d.xpEarned ?? 0
      );

      setTestStreak(
        d.testStreak ?? 0
      );

      setBadges(
        Array.isArray(d.badges)
          ? d.badges
          : []
      );

      setBestScore(
        d.bestScore ?? 0
      );
    } catch (err) {
      setError(
        err?.message ||
          "Could not submit the test."
      );
    } finally {
      setSubmitting(false);
    }
  }

  // --------------------------------------------------
  // RESET TEST
  // --------------------------------------------------

  function resetTest() {
    setQuestions(null);
    setAnswers({});
    setIndex(0);
    setResult(null);

    setXpEarned(0);
    setTestStreak(0);
    setBadges([]);
    setBestScore(0);

    setRevisionTopics([]);

    setActualTopic("");
    setActualDifficulty("Medium");

    setStarted(0);
    setError("");
  }

  // --------------------------------------------------
  // SET ANSWER
  // --------------------------------------------------

  function setAnswer(value) {
    setAnswers((old) => ({
      ...old,
      [index]: value,
    }));
  }

  // --------------------------------------------------
  // DETERMINE QUESTION TYPE
  // --------------------------------------------------

  function isShortAnswerQuestion(question) {
    if (!question) return false;

    return (
      question.questionType ===
        "Short Answer" ||
      !Array.isArray(question.options) ||
      question.options.length === 0
    );
  }

  // --------------------------------------------------
  // DISPLAY TOPIC
  // --------------------------------------------------

  function getDisplayTopic() {
    if (actualTopic) {
      return actualTopic;
    }

    if (testMode === "Revision Test") {
      return revisionTopics.length
        ? revisionTopics.join(", ")
        : "Revision Test";
    }

    return topic;
  }

  // ==================================================
  // RESULT SCREEN
  // ==================================================

  if (result) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-50 p-6">
        <section className="mx-auto mt-10 max-w-2xl rounded-3xl border border-pink-100 bg-white p-8 shadow-xl shadow-pink-200">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-pink-400 text-white">
              <Trophy size={30} />
            </div>

            <p className="mt-4 text-xs font-bold uppercase tracking-wider text-pink-400">
              Test complete
            </p>

            <h1 className="mt-2 text-3xl font-bold text-gray-800">
              Your Result
            </h1>

            <p className="mt-2 text-sm text-gray-500">
              {getDisplayTopic()}
            </p>

            <p className="mt-6 text-6xl font-bold text-pink-400">
              {result.score}/{questions?.length || 0}
            </p>

            <p className="mt-2 text-lg font-semibold text-pink-500">
              {result.accuracy}%
            </p>
          </div>

          {/* Statistics */}

          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-green-50 p-4 text-center">
              <CheckCircle2
                className="mx-auto text-green-500"
                size={22}
              />

              <p className="mt-2 text-xl font-bold text-green-600">
                {result.correct ?? 0}
              </p>

              <p className="text-xs text-green-600">
                Correct
              </p>
            </div>

            <div className="rounded-2xl bg-red-50 p-4 text-center">
              <XCircle
                className="mx-auto text-red-500"
                size={22}
              />

              <p className="mt-2 text-xl font-bold text-red-600">
                {result.wrong ?? 0}
              </p>

              <p className="text-xs text-red-600">
                Wrong
              </p>
            </div>

            <div className="rounded-2xl bg-gray-50 p-4 text-center">
              <BookOpen
                className="mx-auto text-gray-500"
                size={22}
              />

              <p className="mt-2 text-xl font-bold text-gray-700">
                {result.skipped ?? 0}
              </p>

              <p className="text-xs text-gray-500">
                Skipped
              </p>
            </div>
          </div>

          {/* XP + Streak */}

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl bg-pink-50 p-4">
              <p className="text-xs text-pink-500">
                XP Earned
              </p>

              <p className="mt-1 text-xl font-bold text-pink-600">
                +{xpEarned} XP
              </p>
            </div>

            <div className="rounded-2xl bg-orange-50 p-4">
              <div className="flex items-center gap-2">
                <Flame
                  size={18}
                  className="text-orange-500"
                />

                <p className="text-xs text-orange-500">
                  Test Streak
                </p>
              </div>

              <p className="mt-1 text-xl font-bold text-orange-600">
                {testStreak} day
                {testStreak === 1
                  ? ""
                  : "s"}
              </p>
            </div>
          </div>

          {/* Best Score */}

          <div className="mt-4 rounded-2xl border border-pink-100 bg-white p-4">
            <p className="text-xs text-gray-500">
              Best Score
            </p>

            <p className="mt-1 text-xl font-bold text-pink-500">
              {bestScore}%
            </p>
          </div>

          {/* Badges */}

          {badges.length > 0 && (
            <div className="mt-5">
              <p className="text-sm font-bold text-gray-700">
                Badges Earned
              </p>

              <div className="mt-2 flex flex-wrap gap-2">
                {badges.map(
                  (badge, badgeIndex) => (
                    <span
                      key={`${badge}-${badgeIndex}`}
                      className="rounded-full bg-pink-100 px-3 py-2 text-xs font-semibold text-pink-600"
                    >
                      🏆 {badge}
                    </span>
                  )
                )}
              </div>
            </div>
          )}

          {/* Weak Topics */}

          {Array.isArray(
            result.weakTopics
          ) &&
            result.weakTopics.length > 0 && (
              <div className="mt-5 rounded-2xl bg-red-50 p-4">
                <p className="text-sm font-bold text-red-700">
                  Topics to Review
                </p>

                <div className="mt-2 flex flex-wrap gap-2">
                  {result.weakTopics.map(
                    (item, itemIndex) => (
                      <span
                        key={`${item}-${itemIndex}`}
                        className="rounded-full bg-white px-3 py-1 text-xs text-red-600"
                      >
                        {item}
                      </span>
                    )
                  )}
                </div>
              </div>
            )}

          <button
            onClick={resetTest}
            className="mt-8 w-full rounded-2xl bg-pink-400 px-6 py-3 font-semibold text-white transition hover:bg-pink-500"
          >
            <RotateCcw
              size={16}
              className="mr-1 inline"
            />
            New Test
          </button>
        </section>
      </main>
    );
  }

  // ==================================================
  // CREATE TEST SCREEN
  // ==================================================

  if (!questions) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-50 p-4">
        <form
          onSubmit={generate}
          className="mx-auto mt-8 w-full max-w-lg rounded-3xl border border-pink-100 bg-white p-8 shadow-xl shadow-pink-200"
        >
          <div className="text-center">
            <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-pink-400 text-white">
              <ClipboardList />
            </span>

            <h1 className="mt-3 text-2xl font-bold">
              Create a Test
            </h1>

            <p className="text-sm text-pink-400">
              Choose how you want to demonstrate understanding.
            </p>
          </div>

          {/* TEST MODE */}

          <p className="mt-6 text-sm font-semibold text-pink-700">
            Test Mode
          </p>

          <div className="mt-2 grid grid-cols-3 gap-2">
            {TEST_MODES.map(
              ([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() => selectTestMode(value)}
                  className={`rounded-xl border p-3 text-xs font-semibold ${
                    testMode === value
                      ? "border-transparent bg-pink-400 text-white"
                      : "border-pink-200 bg-pink-50 text-pink-600"
                  }`}
                >
                  {label}
                </button>
              )
            )}
          </div>

          {/* TOPIC */}

          {testMode !== "Revision Test" && (
            <label className="mt-6 block text-sm font-semibold text-pink-700">
              Topic

              <input
                value={topic}
                onChange={(e) =>
                  setTopic(e.target.value)
                }
                className="mt-1 w-full rounded-2xl border border-pink-200 bg-pink-50 p-4 outline-none"
                placeholder="Dynamic Programming..."
              />
            </label>
          )}

          {testMode === "Revision Test" && (
            <div className="mt-5 rounded-2xl bg-pink-50 p-4">
              <p className="text-sm font-semibold text-pink-700">
                Revision Test
              </p>

              <p className="mt-1 text-xs text-pink-500">
                The backend will automatically use
                tasks marked for revision in your
                study planner.
              </p>
            </div>
          )}

          {/* QUESTION TYPE */}

          <p className="mt-5 text-sm font-semibold text-pink-700">
            Question Type
          </p>

          <div className="mt-2 grid gap-2">
            {TYPES.map(
              ([value, label]) => (
                <button
                  type="button"
                  key={value}
                  onClick={() =>
                    setQuestionType(value)
                  }
                  className={`rounded-xl border p-3 text-left text-sm ${
                    questionType === value
                      ? "border-transparent bg-pink-400 text-white"
                      : "border-pink-200 bg-pink-50 text-pink-600"
                  }`}
                >
                  <b>{value}</b>

                  <span className="ml-2 text-xs opacity-80">
                    {label}
                  </span>
                </button>
              )
            )}
          </div>

          {/* QUESTIONS + DIFFICULTY */}

          <div className="mt-5 grid grid-cols-2 gap-4">
            <label className="text-sm font-semibold text-pink-700">
              Questions

              <input
                type="number"
                min="1"
                max="20"
                value={count}
                onChange={(e) =>
                  setCount(
                    Math.min(
                      20,
                      Math.max(
                        1,
                        Number(
                          e.target.value
                        ) || 1
                      )
                    )
                  )
                }
                className="mt-1 w-full rounded-2xl border border-pink-200 bg-pink-50 p-4"
              />
            </label>

            <div>
              <p className="text-sm font-semibold text-pink-700">
                Difficulty
              </p>

              <div className="mt-1 flex flex-wrap rounded-2xl border border-pink-200 bg-pink-50 p-1">
                {DIFFICULTIES.map(
                  (x) => (
                    <button
                      type="button"
                      key={x}
                      onClick={() =>
                        setDifficulty(x)
                      }
                      className={`flex-1 rounded-xl px-2 py-2 text-xs font-bold ${
                        difficulty === x
                          ? "bg-pink-400 text-white"
                          : "text-pink-500"
                      }`}
                    >
                      {x}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>

          {/* EXAM PATTERN */}

          <label className="mt-5 block text-sm font-semibold text-pink-700">
            Exam Pattern

            <select
              value={examPattern}
              onChange={(e) =>
                setExamPattern(
                  e.target.value
                )
              }
              className="mt-1 w-full rounded-2xl border border-pink-200 bg-pink-50 p-4 outline-none"
            >
              {EXAM_PATTERNS.map(
                (pattern) => (
                  <option
                    key={pattern}
                    value={pattern}
                  >
                    {pattern}
                  </option>
                )
              )}
            </select>
          </label>

          {/* ERROR */}

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* GENERATE */}

          <button
            type="submit"
            disabled={loading}
            className="mt-6 w-full rounded-2xl bg-pink-400 p-4 font-semibold text-white disabled:opacity-60"
          >
            {loading ? (
              <>
                <Loader2
                  className="mr-2 inline animate-spin"
                  size={16}
                />
                Generating...
              </>
            ) : (
              "Generate Test"
            )}
          </button>
        </form>
      </main>
    );
  }

  // ==================================================
  // QUESTION SCREEN
  // ==================================================

  const answerIsText =
    isShortAnswerQuestion(current);

  const selectedAnswer =
    answers[index];

  return (
    <main className="min-h-screen bg-gradient-to-b from-pink-50 to-pink-50 p-6">
      <div className="mx-auto max-w-2xl">
        {/* HEADER */}

        <div className="flex justify-between gap-4 text-sm font-semibold text-pink-500">
          <span>
            Question {index + 1} of{" "}
            {questions.length}
          </span>

          <span className="max-w-[50%] truncate">
            {getDisplayTopic()}
          </span>
        </div>

        {/* PROGRESS */}

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-pink-100">
          <div
            className="h-full bg-pink-400 transition-all"
            style={{
              width: `${
                ((index + 1) /
                  questions.length) *
                100
              }%`,
            }}
          />
        </div>

        {/* QUESTION */}

        <section className="mt-5 rounded-3xl border border-pink-100 bg-white p-7 shadow-xl shadow-pink-200">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-pink-50 px-3 py-1 text-xs font-semibold text-pink-600">
              {current.questionType ||
                questionType}
            </span>

            {current.difficulty && (
              <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
                {current.difficulty}
              </span>
            )}
          </div>

          <h1 className="mt-5 text-lg font-bold leading-relaxed text-gray-800">
            {current.question}
          </h1>

          {/* SHORT ANSWER */}

          {answerIsText ? (
            <textarea
              value={
                typeof selectedAnswer ===
                "string"
                  ? selectedAnswer
                  : ""
              }
              onChange={(e) =>
                setAnswer(
                  e.target.value
                )
              }
              rows={6}
              placeholder="Write your answer..."
              className="mt-5 w-full rounded-2xl border border-pink-200 bg-pink-50 p-4 outline-none focus:border-pink-400"
            />
          ) : (
            /* MCQ */

            <div className="mt-5 space-y-3">
              {(current.options || []).map(
                (option, optionIndex) => (
                  <button
                    type="button"
                    key={optionIndex}
                    onClick={() =>
                      setAnswer(
                        optionIndex
                      )
                    }
                    className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                      selectedAnswer ===
                      optionIndex
                        ? "border-transparent bg-pink-400 text-white"
                        : "border-pink-200 bg-pink-50 text-gray-700 hover:border-pink-300"
                    }`}
                  >
                    <span className="mr-3 font-bold">
                      {String.fromCharCode(
                        65 +
                          optionIndex
                      )}
                      .
                    </span>

                    {option}
                  </button>
                )
              )}
            </div>
          )}

          {/* HINT */}

          {current.hint && (
            <details className="mt-5 rounded-2xl bg-yellow-50 p-4">
              <summary className="cursor-pointer text-sm font-semibold text-yellow-700">
                Show Hint
              </summary>

              <p className="mt-2 text-sm text-yellow-700">
                {current.hint}
              </p>
            </details>
          )}
        </section>

        {/* ERROR */}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* NAVIGATION */}

        <div className="mt-5 flex justify-between gap-3">
          <button
            type="button"
            disabled={
              !index || submitting
            }
            onClick={() =>
              setIndex(
                (x) => x - 1
              )
            }
            className="rounded-2xl bg-white px-4 py-2 text-pink-600 shadow-sm disabled:opacity-40"
          >
            <ChevronLeft
              className="mr-1 inline"
              size={16}
            />
            Previous
          </button>

          {index ===
          questions.length - 1 ? (
            <button
              type="button"
              disabled={submitting}
              onClick={submit}
              className="rounded-2xl bg-pink-400 px-5 py-2 font-semibold text-white disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2
                    className="mr-2 inline animate-spin"
                    size={16}
                  />
                  Checking...
                </>
              ) : (
                "Submit Test"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() =>
                setIndex(
                  (x) => x + 1
                )
              }
              className="rounded-2xl bg-white px-4 py-2 text-pink-600 shadow-sm"
            >
              Next
              <ChevronRight
                className="ml-1 inline"
                size={16}
              />
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
