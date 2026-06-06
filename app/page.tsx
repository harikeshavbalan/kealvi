import QuestionsList from "./questions-list";
import { getPoll } from "@/lib/polls";
import { getQuestionsPage } from "@/lib/questions";

// Render on every request (don't cache/prerender) so new questions show up.
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

// Server component — runs only on the server, awaits the data, renders to HTML.
export default async function Page() {
  console.log("Calling getPoll...");
  const pollData = await getPoll(1);
  console.log("Poll Data:", pollData);

  console.log(pollData);
  const { questions, hasMore } = await getQuestionsPage(0, PAGE_SIZE);

  return (
    <main className="mx-auto max-w-2xl p-6">
      <h1 className="mb-4 text-2xl font-medium">Live Q&amp;A</h1>
      <QuestionsList initialQuestions={questions} initialHasMore={hasMore} />
    </main>
  );
}
