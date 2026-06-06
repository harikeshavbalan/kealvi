import { supabase } from "@/lib/supabase";

type PollOption = {
  id: string;
  text: string;
  votes: number;
};

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

export async function getQuestionsPage(
  offset: number,
  limit: number
) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .order("created_at", { ascending: false })
    .range(offset, offset + limit);

  if (error) throw new Error(error.message);

  const questions = await Promise.all(
    (data ?? []).map(async (q) => {
      const options = await getPollOptions(q.id);
      const votes = options.length
        ? options.reduce((total, option) => total + option.votes, 0)
        : await getVoteTotal(q.id);

      console.log("Question:", q.id);
      console.log("Vote Count:", votes);

      return {
        id: q.id,
        title: q.title,
        content: q.content,
        votes,
        options,
      };
    })
  );

  return {
    questions: questions.slice(0, limit),
    hasMore: questions.length > limit,
  };
}

export async function searchQuestions(
  q: string,
  limit: number
) {
  const { data, error } = await supabase
    .from("questions")
    .select("*")
    .ilike("title", `%${q}%`)
    .limit(limit);

  if (error) throw new Error(error.message);

  const questions = await Promise.all(
    (data ?? []).map(async (row) => {
      const options = await getPollOptions(row.id);
      const votes = options.length
        ? options.reduce((total, option) => total + option.votes, 0)
        : await getVoteTotal(row.id);

      console.log("Search Question:", row.id);
      console.log("Vote Count:", votes);

      return {
        id: row.id,
        title: row.title,
        content: row.content,
        votes,
        options,
      };
    })
  );

  return questions;
}