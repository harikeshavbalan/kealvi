import { supabase } from "@/lib/supabase";
import { getQuestionsPage, searchQuestions } from "@/lib/questions";

const PAGE_SIZE = 10;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const q = searchParams.get("q")?.trim();

  if (q) {
    const questions = await searchQuestions(q, PAGE_SIZE);
    return Response.json({
      questions,
      hasMore: false,
    });
  }

  const offset = Number(searchParams.get("offset") ?? 0);

  const { questions, hasMore } =
    await getQuestionsPage(offset, PAGE_SIZE);

  return Response.json({
    questions,
    hasMore,
  });
}

export async function POST(req: Request) {
  const { title, content, options } = await req.json();

  const { data, error } = await supabase
    .from("questions")
    .insert({
      title,
      content,
    })
    .select()
    .single();

  if (error) {
    return Response.json(
      { error: error.message },
      { status: 500 }
    );
  }

  if (Array.isArray(options) && options.length > 0) {
    const formattedOptions = options
      .filter((text: string) => typeof text === "string" && text.trim())
      .map((text: string) => ({
        question_id: data.id,
        text: text.trim(),
      }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(formattedOptions);

    if (optionsError) {
      return Response.json(
        { error: optionsError.message },
        { status: 500 }
      );
    }

    const { data: insertedOptions, error: fetchError } = await supabase
      .from("poll_options")
      .select("id, text")
      .eq("question_id", data.id);

    if (fetchError) {
      return Response.json(
        { error: fetchError.message },
        { status: 500 }
      );
    }

    return Response.json({
      ...data,
      options: insertedOptions,
    });
  }

  return Response.json(data);
}