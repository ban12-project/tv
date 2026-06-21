import {
  convertToModelMessages,
  stepCountIs,
  streamText,
  tool,
  type UIMessage,
} from "ai";
import * as z from "zod";
import { createResource } from "@/lib/actions/resources";
import { findRelevantContent } from "@/lib/ai/embedding";
import { openai } from "@/lib/ai/providers";
import { requireRegisteredUser } from "@/lib/auth-utils";
import { hasChatbot } from "@/lib/features";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  if (!hasChatbot()) {
    return new Response("Not Found", { status: 404 });
  }

  try {
    await requireRegisteredUser();
  } catch {
    return new Response("Unauthorized", { status: 401 });
  }

  const { messages }: { messages: UIMessage[] } = await req.json();

  const result = streamText({
    model: openai("gpt-5.4-mini"),
    providerOptions: {
      openai: {
        stream: true,
      },
    },
    system: `You are a helpful assistant. Check your knowledge base before answering any questions.
Only respond to questions using information from tool calls.
if no relevant information is found in the tool calls, respond, "Sorry, I don't know."
When you mention a specific movie or TV show title, you MUST wrap it in a Markdown link like this: [Movie Name](/?q=Movie+Name) (use plus '+' or '%20' for spaces).`,
    messages: await convertToModelMessages(messages),
    stopWhen: stepCountIs(5),
    prepareStep: ({ stepNumber }) => {
      if (stepNumber >= 5) {
        return { toolChoice: "none" };
      }
      return {};
    },
    tools: {
      addResource: tool({
        description: `add a resource to your knowledge base.
          If the user provides a random piece of knowledge unprompted, use this tool without asking for confirmation.`,
        inputSchema: z.object({
          content: z
            .string()
            .describe("the content or resource to add to the knowledge base"),
        }),
        execute: async ({ content }) => createResource({ content }),
      }),
      getInformation: tool({
        description: `get information from your knowledge base to answer questions.
          Rephrase the user's question into a concise search query optimized for semantic search.
          Focus on key entities and concepts rather than full sentences.`,
        inputSchema: z.object({
          question: z.string().describe("the users question"),
        }),
        execute: async ({ question }) => findRelevantContent(question),
      }),
    },
  });

  return result.toUIMessageStreamResponse({
    sendSources: true,
    sendReasoning: true,
  });
}
