"use client";

import { useEffect, useMemo, useState } from "react";

type PollOption = {
  id: string;
  text: string;
  votes: number;
};

type User = {
  id: string;
  userid: string;
};

type Question = {
  id: string | number;
  title: string;
  content: string;
  author?: string | null;
  votes: number;
  createdAt?: string;
  options?: PollOption[];
};

const CHARACTER_LIMIT = 250;
const EXPAND_THRESHOLD = 280;

function formatTimeAgo(createdAt?: string) {
  if (!createdAt) return "just now";
  const then = new Date(createdAt).getTime();
  const diffSeconds = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);

  if (diffMinutes < 1) {
    return diffSeconds <= 5 ? "just now" : `${diffSeconds} sec ago`;
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} min ago`;
  }

  if (diffHours < 24) {
    return `${diffHours} hour${diffHours === 1 ? "" : "s"} ago`;
  }

  if (diffDays < 7) {
    return `${diffDays} day${diffDays === 1 ? "" : "s"} ago`;
  }

  return `${diffWeeks} week${diffWeeks === 1 ? "" : "s"} ago`;
}

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
  const [user, setUser] = useState<User | null>(null);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(
    new Set()
  );

  const [authMode, setAuthMode] = useState<"login" | "signup">("login");
  const [authUserId, setAuthUserId] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState<string | null>(null);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const canSubmit = useMemo(() => {
    return !!user && draft.trim().length > 0;
  }, [user, draft]);

  const hydrated = true;

  useEffect(() => {
    const timeoutId = setTimeout(async () => {
      const url = query
        ? `/api/questions?q=${encodeURIComponent(query)}`
        : `/api/questions`;

      const res = await fetch(url);
      const data = await res.json();

      setQuestions(data.questions ?? []);
      setHasMore(data.hasMore ?? false);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    async function loadCounts() {
      const res = await fetch("/api/questions/count");
      const data = await res.json();
      setTotalCount(data.total ?? 0);
    }

    loadCounts();
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem("currentUser");
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored);
      queueMicrotask(() => {
        setUser(parsed);
      });
    } catch {
      localStorage.removeItem("currentUser");
    }
  }, []);


  useEffect(() => {
    if (!user) {
      queueMicrotask(() => {
        setBookmarkedIds(new Set());
      });
      return;
    }

    async function loadBookmarks(u: User) {
      const bmRes = await fetch(
        `/api/questions/bookmarks?userId=${encodeURIComponent(u.id)}`
      );
      const bmData = await bmRes.json();
      setBookmarkedIds(
        new Set((bmData.bookmarkedQuestionIds ?? []).map(String))
      );
    }

    void loadBookmarks(user);
  }, [user]);

  async function handleAuthSubmit() {
    if (!authUserId.trim() || !authPassword) {
      setAuthError("Please enter both userid and password.");
      return;
    }

    setAuthError(null);
    const url =
      authMode === "signup" ? "/api/auth/signup" : "/api/auth/login";

    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        userid: authUserId.trim(),
        password: authPassword,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      setAuthError(body.error || "Authentication failed.");
      return;
    }

    const userPayload = {
      id: body.id,
      userid: body.userid,
    };

    localStorage.setItem("currentUser", JSON.stringify(userPayload));
    setUser(userPayload);
    setAuthPassword("");
  }

  function logout() {
    localStorage.removeItem("currentUser");
    setUser(null);
  }

  async function submit() {
    if (!canSubmit) return;

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
        author: user!.userid,
      }),
    });

    const created = await res.json();

    if (!res.ok) {
      setAuthError(created?.error ?? "Failed to create question.");
      return;
    }

    setQuestions((qs) =>
      [
        {
          ...created,
          votes: 0,
          createdAt: created.created_at ?? created.createdAt,
          options:
            created.options?.map((option: { id: string; text: string }) => ({

              ...option,
              votes: 0,
            })) ?? [],
        },
        ...qs,
      ].sort((a, b) => b.votes - a.votes)
    );

    setTotalCount((c) => c + 1);
    setDraft("");
    setOptionInputs(["", ""]);
  }

  function updateOptionInput(index: number, value: string) {
    setOptionInputs((inputs) =>
      inputs.map((item, idx) => (idx === index ? value : item))
    );
  }

  function addOptionInput() {
    setOptionInputs((inputs) => [...inputs, ""]);
  }

  async function vote(id: string | number, direction: 1 | -1 | 0) {
    if (!user) {
      setAuthError("Please login before voting.");
      return;
    }

    const res = await fetch(`/api/questions/${id}/vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voterId: user.id,
        vote: direction,
      }),
    });

    const body = await res.json();

    if (res.ok) {
      setQuestions((qs) =>
        qs
          .map((q) =>
            String(q.id) === String(id)
              ? { ...q, votes: body.votes ?? q.votes }
              : q
          )
          .sort((a, b) => b.votes - a.votes)
      );
      return;
    }

    console.error("Vote failed", body);
  }

  async function voteOption(
    questionId: string | number,
    optionId?: string
  ) {
    if (!user) {
      setAuthError("Please login before voting.");
      return;
    }

    const res = await fetch(`/api/questions/${questionId}/option-vote`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        voterId: user.id,
        optionId: optionId ?? null,
      }),
    });

    const body = await res.json();

    if (!res.ok) {
      console.error("Option vote failed", body);
      return;
    }

    setQuestions((qs) =>
      qs
        .map((q) =>
          String(q.id) === String(questionId)
            ? {
                ...q,
                options: q.options?.map((option) => ({
                  ...option,
                  votes: body.optionCounts?.[option.id] ?? option.votes,
                })),
                votes:
                  q.options?.reduce(
                    (total, opt) =>
                      total + (body.optionCounts?.[opt.id] ?? opt.votes),
                    0
                  ) ?? q.votes,
              }
            : q
        )
        .sort((a, b) => b.votes - a.votes)
    );
  }

  async function loadMore() {
    setLoading(true);

    const res = await fetch(`/api/questions?offset=${questions.length}`);
    const data = await res.json();

    setQuestions((qs) => [...qs, ...(data.questions ?? [])]);
    setHasMore(data.hasMore ?? false);

    setLoading(false);
  }

  async function copyQuestion(q: Question) {
    const text = q.content ?? "";
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(String(q.id));
      setTimeout(() => setCopiedId((id) => (id === String(q.id) ? null : id)), 800);
    } catch {
      // ignore
    }
  }

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState<string>("");
  const [editContent, setEditContent] = useState<string>("");

  function beginEdit(q: Question) {
    if (!user) return;
    setEditingId(String(q.id));
    setEditTitle(q.title ?? "");
    setEditContent(q.content ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
    setEditTitle("");
    setEditContent("");
  }

  async function saveEdit(q: Question) {
    if (!user) return;
    const res = await fetch(`/api/questions/${q.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: editTitle,
        content: editContent,
        requesterUserid: user.userid,
      }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAuthError(body?.error ?? "Failed to edit question.");
      return;
    }

    const updated = await res.json();
    setQuestions((prev) =>
      prev
        .map((item) =>
          String(item.id) === String(q.id)
            ? { ...item, title: updated.title ?? editTitle, content: updated.content ?? editContent }
            : item
        )
        .sort((a, b) => b.votes - a.votes)
    );

    cancelEdit();
  }

  async function deleteQuestion(q: Question) {
    if (!user) return;
    const ok = window.confirm("Delete this question? This cannot be undone.");
    if (!ok) return;

    const res = await fetch(`/api/questions/${q.id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ requesterUserid: user.userid }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setAuthError(body?.error ?? "Failed to delete question.");
      return;
    }

    setQuestions((prev) => prev.filter((item) => String(item.id) !== String(q.id)));
    cancelEdit();
    setTotalCount((c) => Math.max(0, c - 1));
  }

  async function toggleBookmark(q: Question) {

    if (!user) {
      setAuthError("Please login to bookmark.");
      return;
    }

    const res = await fetch(`/api/questions/${q.id}/bookmark`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ userId: user.id }),
    });

    const body = await res.json();
    if (!res.ok) {
      console.error("Bookmark toggle failed", body);
      return;
    }

    setBookmarkedIds((prev) => {
      const next = new Set(prev);
      const key = String(q.id);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-sm text-gray-500">
          {hydrated ? "Interactive ✓" : "Loading interactivity..."}
        </p>
        <p className="text-sm text-gray-600">
          Total questions: <span className="font-semibold">{totalCount}</span>
        </p>
      </div>

      {!user ? (
        <div className="space-y-4 rounded-lg border p-4">
          <h2 className="text-lg font-semibold">
            {authMode === "signup" ? "Sign up" : "Log in"}
          </h2>
          {authError && (
            <p className="text-sm text-red-600">{authError}</p>
          )}
          <div className="space-y-2">
            <input
              value={authUserId}
              onChange={(e) => setAuthUserId(e.target.value)}
              placeholder="User ID"
              className="w-full rounded-md border px-3 py-2"
            />
            <input
              type="password"
              value={authPassword}
              onChange={(e) => setAuthPassword(e.target.value)}
              placeholder="Password"
              className="w-full rounded-md border px-3 py-2"
            />
            <div className="flex gap-2">
              <button
                onClick={handleAuthSubmit}
                className="rounded-md border px-4 py-2"
              >
                {authMode === "signup" ? "Sign up" : "Log in"}
              </button>
              <button
                onClick={() => {
                  setAuthMode(authMode === "signup" ? "login" : "signup");
                  setAuthError(null);
                }}
                className="rounded-md border px-4 py-2"
              >
                Switch to {authMode === "signup" ? "login" : "signup"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-lg border p-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-gray-700">
            Signed in as <strong>{user.userid}</strong>
          </p>
          <button
            onClick={logout}
            className="rounded-md border px-4 py-2"
          >
            Logout
          </button>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Ask a question..."
            maxLength={CHARACTER_LIMIT}
            className="flex-1 rounded-md border px-3 py-2"
            disabled={!user}
          />

          <button
            onClick={submit}
            className="rounded-md border px-4 py-2 disabled:opacity-50"
            disabled={!canSubmit}
          >
            Ask
          </button>
        </div>
        <p
          id="question-char-count"
          className={`text-sm ${
            draft.length >= CHARACTER_LIMIT
              ? "text-red-600"
              : "text-gray-500"
          }`}
        >
          {draft.length}/{CHARACTER_LIMIT} letters
        </p>
      </div>

      <div className="space-y-2">
        <p className="text-sm text-gray-500">
          Add answer options to create a poll question.
        </p>
        {optionInputs.map((option, index) => (
          <input
            key={index}
            value={option}
            onChange={(e) => updateOptionInput(index, e.target.value)}
            placeholder={`Option ${index + 1}`}
            className="w-full rounded-md border px-3 py-2"
            disabled={!user}
          />
        ))}
        <button
          onClick={addOptionInput}
          className="rounded-md border px-4 py-2"
          disabled={!user}
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
        {questions.map((q) => {
          const qid = String(q.id);
          const isExpanded = expanded.has(qid);
          const shouldTruncate = (q.content?.length ?? 0) > EXPAND_THRESHOLD;
          const isBookmarked = bookmarkedIds.has(qid);
          const displayContent = shouldTruncate && !isExpanded
            ? q.content.slice(0, EXPAND_THRESHOLD) + "…"
            : q.content;

          return (
            <li key={q.id} className="rounded-lg border p-3">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="font-semibold break-words">{q.title}</h3>
                      <p className="text-xs text-gray-500">
                        Posted by <span className="font-medium">{q.author ?? "Unknown"}</span>
                      </p>
                    </div>
                    <span className="text-sm text-gray-500 whitespace-nowrap">
                      {formatTimeAgo(q.createdAt)}
                    </span>
                  </div>

                  <p className="whitespace-pre-wrap">{displayContent}</p>

                  {shouldTruncate && (
                    <button
                      onClick={() => {
                        setExpanded((prev) => {
                          const next = new Set(prev);
                          if (next.has(qid)) next.delete(qid);
                          else next.add(qid);
                          return next;
                        });
                      }}
                      className="mt-1 text-sm text-blue-700"
                    >
                      {isExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>

                <div className="text-right text-sm text-gray-500">
                  <div>Total votes: {q.votes}</div>
                  <div className="mt-2 flex flex-col gap-2 items-end">
                    <button
                      onClick={() => copyQuestion(q)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      {copiedId === qid ? "Copied" : "Copy"}
                    </button>
                    <button
                      onClick={() => toggleBookmark(q)}
                      className="rounded-md border px-2 py-1 text-xs"
                    >
                      {isBookmarked ? "Bookmarked" : "Bookmark"}
                    </button>
                  </div>
                </div>
              </div>

              {q.options && q.options.length > 0 ? (
                <div className="mt-4 space-y-3">
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
                  <div className="flex items-center justify-between text-sm text-gray-500">
                    <button
                      onClick={() => voteOption(q.id)}
                      className="rounded-md border px-3 py-1"
                    >
                      Unvote
                    </button>
                    <span>
                      {
                        (() => {
                          const optionCounts = q.options ?? [];
                          const totalVotes = optionCounts.reduce((sum, o) => sum + (o.votes ?? 0), 0);
                          if (totalVotes === 0) return "not yet decided";

                          const sorted = optionCounts
                            .slice()
                            .sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));
                          const topVotes = sorted[0]?.votes ?? 0;
                          const topOptions = sorted.filter((o) => (o.votes ?? 0) === topVotes);

                          if (topOptions.length > 1) {
                            return `tie (${topOptions.map((o) => o.text).join(", ")})`;
                          }

                          return `Top answer: ${topOptions[0]?.text ?? "—"}`;
                        })()
                      }
                    </span>
                  </div>
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
                  <button
                    onClick={() => vote(q.id, 0)}
                    className="rounded-md border px-3 py-1 font-mono"
                  >
                    Unvote
                  </button>
                </div>
              )}
            </li>
          );
        })}
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

