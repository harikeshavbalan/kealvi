"use client";

import { useState, useEffect } from "react";
import { getVoterId } from "@/lib/voter";

type Question = {
  id: string | number;
  title: string;
  content: string;
  votes: number;
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

    const res = await fetch("/api/questions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: draft,
        content: draft,
      }),
    });

    const created = await res.json();

    setQuestions((qs) => [
      {
        ...created,
        votes: 0,
      },
      ...qs,
    ]);

    setDraft("");
  }

  async function upvote(id: string | number) {
    setQuestions((qs) =>
      qs.map((q) =>
        String(q.id) === String(id)
          ? { ...q, votes: q.votes + 1 }
          : q
      )
    );

    const res = await fetch(`/api/questions/${id}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voterId: getVoterId(),
      }),
    });

    console.log("Vote status:", res.status);

    const body = await res.json();
    console.log("Vote response:", body);

    if (!res.ok) {
      setQuestions((qs) =>
        qs.map((q) =>
          String(q.id) === String(id)
            ? { ...q, votes: q.votes - 1 }
            : q
        )
      );
    }
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
            className="flex items-center gap-3 rounded-lg border p-3"
          >
            <button
              onClick={() => upvote(q.id)}
              className="rounded-md border px-3 py-1 font-mono"
            >
              ▲ {q.votes}
            </button>

            <div>
              <h3 className="font-semibold">{q.title}</h3>
              <p>{q.content}</p>
            </div>
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