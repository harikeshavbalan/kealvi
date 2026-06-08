import { supabase } from "@/lib/supabase";

type DashboardStats = {
  questions: number;
  votes: number;
  polls: number;
};

type Question = {
  id: string | number;
  title: string;
  content: string;
  author?: string | null;
  votes: number;
  createdAt?: string;
  options?: { id: string; text: string; votes: number }[];
};

type SortOrder = "latest" | "earliest" | "popular";

function sortQuestionsList(questions: Question[], sortOrder: SortOrder = "popular") {
  return [...questions].sort((a, b) => {
    if (sortOrder === "latest") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return bTime - aTime || b.votes - a.votes;
    }

    if (sortOrder === "earliest") {
      const aTime = a.createdAt ? new Date(a.createdAt).getTime() : 0;
      const bTime = b.createdAt ? new Date(b.createdAt).getTime() : 0;
      return aTime - bTime || b.votes - a.votes;
    }

    return b.votes - a.votes || (b.createdAt ? new Date(b.createdAt).getTime() : 0) - (a.createdAt ? new Date(a.createdAt).getTime() : 0);
  });
}

async function getVoteTotal(questionId: string | number) {
  const { data, error } = await supabase
    .from("votes")
    .select("value")
    .eq("question_id", questionId);

  if (error) throw new Error(error.message);

  return (data ?? []).reduce(
    (sum, voteRow) => sum + (voteRow.value ?? 0),
    0
  );
}

async function getPollOptions(questionId: string | number) {
  const { data: options, error: optionsError } = await supabase
    .from("poll_options")
    .select("id, text")
    .eq("question_id", questionId)
    .order("id", { ascending: true });

  if (optionsError) throw new Error(optionsError.message);

  const { data: votes, error: votesError } = await supabase
    .from("poll_votes")
    .select("option_id")
    .eq("question_id", questionId);

  if (votesError) throw new Error(votesError.message);

  const voteCounts = (votes ?? []).reduce(
    (acc, row) => {
      if (!row.option_id) return acc;
      acc[row.option_id] = (acc[row.option_id] ?? 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (options ?? []).map((option) => ({
    id: option.id,
    text: option.text,
    votes: voteCounts[option.id] ?? 0,
  }));
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const [
    { data: questionRows, error: questionsError },
    { data: voteRows, error: voteError },
    { data: pollVoteRows, error: pollVoteError },
    { data: pollOptionRows, error: pollOptionsError },
  ] = await Promise.all([
    supabase.from("questions").select("id"),
    supabase.from("votes").select("value"),
    supabase.from("poll_votes").select("id"),
    supabase.from("poll_options").select("question_id"),
  ]);

  if (questionsError) throw new Error(questionsError.message);
  if (voteError) throw new Error(voteError.message);
  if (pollVoteError) throw new Error(pollVoteError.message);
  if (pollOptionsError) throw new Error(pollOptionsError.message);

  const totalVotes = (voteRows ?? []).reduce(
    (sum, row) => sum + (row.value ?? 0),
    0
  ) + (pollVoteRows ?? []).length;

  const pollQuestionCount = new Set(
    (pollOptionRows ?? []).map((row) => row.question_id)
  ).size;

  return {
    questions: (questionRows ?? []).length,
    votes: totalVotes,
    polls: pollQuestionCount,
  };
}

export async function getQuestionsPage(
  offset: number,
  limit: number,
  sortOrder: SortOrder = "popular"
) {
  const { data, error } = await supabase
    .from("questions")
    .select("*");

  if (error) throw new Error(error.message);

  const questions = await Promise.all(
    (data ?? []).map(async (q) => {
      const options = await getPollOptions(q.id);
      const votes = options.length
        ? options.reduce((total, option) => total + option.votes, 0)
        : await getVoteTotal(q.id);

      return {
        id: q.id,
        title: q.title,
        content: q.content,
        author: q.author,
        votes,
        createdAt: q.created_at,
        options,
      };
    })
  );

  const sorted = sortQuestionsList(questions, sortOrder);

  return {
    questions: sorted.slice(offset, offset + limit),
    hasMore: sorted.length > offset + limit,
  };
}

export async function searchQuestions(
  q: string,
  offset: number,
  limit: number,
  sortOrder: SortOrder = "popular"
) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .ilike("title", `%${q}%`);

  if (error) throw new Error(error.message);

  const questions = await Promise.all(
    (data ?? []).map(async (row) => {
      const options = await getPollOptions(row.id);
      const votes = options.length
        ? options.reduce((total, option) => total + option.votes, 0)
        : await getVoteTotal(row.id);

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        author: row.author,
        votes,
        createdAt: row.created_at,
        options,
      };
    })
  );

  const sorted = sortQuestionsList(questions, sortOrder);

  return {
    questions: sorted.slice(offset, offset + limit),
    hasMore: sorted.length > offset + limit,
  };
}

