import { supabase } from "@/lib/supabase";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: questionId } = await params;
    const { voterId } = await req.json();

    console.log("questionId:", questionId);
    console.log("voterId:", voterId);

    const { error } = await supabase
      .from("votes")
      .insert({
        question_id: questionId,
        voter_id: voterId,
      });

    console.log("Supabase error:", error);

    if (error) {
      return Response.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return Response.json({ ok: true });
  } catch (err) {
    console.error(err);

    return Response.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}