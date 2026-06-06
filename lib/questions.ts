import { supabase } from "@/lib/supabase";

export async function getQuestionsPage(offset: number, limit: number) {
const { data, error } = await supabase
  .from("questions")
  .select("*");

console.log("DATA:", data);
console.log("ERROR:", error);

  if (error) throw new Error(error.message);

  const rows = (data ?? []).map((q) => ({
    id: q.id,
    title: q.title,
    content: q.content,
    votes: 0,
  }));

  const hasMore = rows.length > limit;
  return { questions: rows.slice(0, limit), hasMore };
}

export async function searchQuestions(q: string, limit: number) {
  const { data, error } = await supabase
    .from("questions")
    .select("id, title, content, created_at")
    .ilike("title", `%${q}%`)
    .limit(limit);

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    title: row.title,
    content: row.content,
    votes: 0,
  }));
}