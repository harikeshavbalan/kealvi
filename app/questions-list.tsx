"use client";

import { useState, useEffect } from "react";
import { getVoterId } from "@/lib/voter";

type PollOption = {
  id: string;
  text: string;
  votes: number;
};

type Question = {
  id: string | number;
  title: string;
  content: string;
  votes: number;
  options?: PollOption[];
};

export default function QuestionsList({
  initialQuestions,
  initialHasMore,
}: {
  initialQuestions: Question[];
  initialHasMore: boolean;
}) {
  const [questions, setQuestions] = useState(initialQuestions);
  const [draft, setDraft] = useState("");
  const [optionInputs, setOptionInputs] = useState(["", ""]);
  const [query, setQuery] = useState("");
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);

  const hydrated = true;

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const url = query
        ? `/api/questions?q=${encodeURIComponent(query)}`
        : `/api/questions`;

      const res = await fetch(url);
      const data = await res.json();

      console.log("Fetched questions:", data.questions);

      setQuestions(data.questions ?? []);
      setHasMore(data.hasMore ?? false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  async function submit() {
    if (!draft.trim()) return;

    const options = optionInputs
      .map((opt) => opt.trim())
      .filter(Boolean);

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: draft,
        content: draft,
        options,
      }),
    });

    const created = await res.json();

    setQuestions((qs) => [
      {
        ...created,
        votes: 0,
        options:
          created.options?.map((option: any) => ({
            ...option,
            votes: 0,
          })) ?? [],
      },
      ...qs,
    ]);

    setDraft("");
    setOptionInputs(["", ""]);
  }

  function updateOptionInput(index: number, value: string) {
    setOptionInputs((inputs) =>
      inputs.map((item, idx) =>
        idx === index ? value : item
      )
    );
  }

  function addOptionInput() {
    setOptionInputs((inputs) => [...inputs, ""]);
  }

  async function vote(id: string | number, direction: 1 | -1) {
    const res = await fetch(`/api/questions/${id}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voterId: getVoterId(),
        vote: direction,
      }),
    });

    console.log("Vote status:", res.status);

    const body = await res.json();
    console.log("Vote response:", body);

    if (res.ok) {
      setQuestions((qs) =>
        qs.map((q) =>
          String(q.id) === String(id)
            ? { ...q, votes: body.votes ?? q.votes }
            : q
        )
      );
      return;
    }

    console.error("Vote failed", body);
  }

  async function voteOption(
    questionId: string | number,
    optionId: string
  ) {
    const res = await fetch(
      `/api/questions/${questionId}/option-vote`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          voterId: getVoterId(),
          optionId,
        }),
      }
    );

    const body = await res.json();

    if (!res.ok) {
      console.error("Option vote failed", body);
      return;
    }

    setQuestions((qs) =>
      qs.map((q) =>
        String(q.id) === String(questionId)
          ? {
              ...q,
              options: q.options?.map((option) => ({
                ...option,
                votes:
                  body.optionCounts?.[option.id] ?? option.votes,
              })),
              votes:
                q.options?.reduce(
                  (total, opt) =>
                    total +
                    (body.optionCounts?.[opt.id] ?? opt.votes),
                  0
                ) ?? q.votes,
            }
          : q
      )
    );
  }

  async function loadMore() {
    setLoading(true);

    const res = await fetch(
      `/api/questions?offset=${questions.length}`
    );

    const data = await res.json();

    setQuestions((qs) => [...qs, ...(data.questions ?? [])]);
    setHasMore(data.hasMore ?? false);

    setLoading(false);
  }

  console.log("QUESTIONS:", questions);

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-500">
        {hydrated ? "Interactive ✓" : "Loading interactivity..."}
      </p>

      <div className="flex gap-2">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question..."
          className="flex-1 rounded-md border px-3 py-2"
        />

        <button
          onClick={submit}
          className="rounded-md border px-4 py-2"
        >
          Ask
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">
          Add answer options to create a poll question.
        </p>
        {optionInputs.map((option, index) => (
          <input
            key={index}
            value={option}
            onChange={(e) =>
              updateOptionInput(index, e.target.value)
            }
            placeholder={`Option ${index + 1}`}
            className="w-full rounded-md border px-3 py-2"
          />
        ))}
        <button
          onClick={addOptionInput}
          className="rounded-md border px-4 py-2"
        >
          Add option
        </button>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search questions..."
        className="w-full rounded-md border px-3 py-2"
      />

      <ul className="space-y-3">
        {questions.map((q) => (
          <li
            key={q.id}
            className="rounded-lg border p-3"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1">
                <h3 className="font-semibold">{q.title}</h3>
                <p>{q.content}</p>
              </div>
              <div className="text-right text-sm text-gray-500">
                Total votes: {q.votes}
              </div>
            </div>

            {q.options && q.options.length > 0 ? (
              <div className="mt-4 space-y-2">
                {q.options.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => voteOption(q.id, option.id)}
                    className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left"
                  >
                    <span>{option.text}</span>
                    <span className="font-mono">{option.votes}</span>
                  </button>
                ))}
              </div>
            ) : (
              <div className="mt-4 flex items-center gap-3">
                <button
                  onClick={() => vote(q.id, 1)}
                  className="rounded-md border px-3 py-1 font-mono"
                >
                  ▲
                </button>
                <button
                  onClick={() => vote(q.id, -1)}
                  className="rounded-md border px-3 py-1 font-mono"
                >
                  ▼
                </button>
              </div>
            )}
          </li>
        ))}
      </ul>

      {hasMore && (
        <button
          onClick={loadMore}
          disabled={loading}
          className="rounded-md border px-4 py-2 disabled:opacity-50"
        >
          {loading ? "Loading..." : "Load more"}
        </button>
      )}
    </div>
  );
}