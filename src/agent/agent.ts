import {
  readFile
} from "node:fs/promises";

import path from "node:path";

import OpenAI from "openai";

import {
  executeAgentTool,
  openAITools,
  type AgentToolEvent
} from "./tools.js";

type AgentOptions = {
  directory?: string;
  sessionId?: string;
};

export type AgentResponse = {
  message: string;

  events:
    AgentToolEvent[];

  requiresConfirmation:
    boolean;

  confirmationFields:
    string[];
};

const MAX_TOOL_ROUNDS =
  12;

async function loadSystemPrompt(
  directory: string
): Promise<string> {
  return readFile(
    path.join(
      directory,
      "agent",
      "prompt.md"
    ),
    "utf-8"
  );
}

function getModel():
  string {
  return (
    process.env
      .OPENROUTER_MODEL ??
    "xingchen-agi/xing4.0-29b-a4b:free"
  );
}

export async function runAgent(
  userMessage: string,
  options:
    AgentOptions = {}
): Promise<AgentResponse> {
  const directory =
    options.directory ??
    process.cwd();

  const sessionId =
    options.sessionId ??
    "default-session";

  if (
    !process.env
      .OPENROUTER_API_KEY
  ) {
    throw new Error(
      "OPENROUTER_API_KEY is not configured."
    );
  }

  const client =
    new OpenAI({
      apiKey:
        process.env
          .OPENROUTER_API_KEY,

      baseURL:
        "https://openrouter.ai/api/v1"
    });

  const systemPrompt =
    await loadSystemPrompt(
      directory
    );

  const events:
    AgentToolEvent[] = [];

  const messages:
    OpenAI.Chat.ChatCompletionMessageParam[] =
    [
      {
        role:
          "system",

        content:
          systemPrompt
      },

      {
        role:
          "user",

        content:
          userMessage
      }
    ];

  for (
    let round = 0;
    round <
      MAX_TOOL_ROUNDS;
    round++
  ) {
    const response =
      await client
        .chat
        .completions
        .create({
          model:
            getModel(),

          messages,

          tools:
            openAITools.map(
              (
                tool
              ) => ({
                type:
                  "function" as const,

                function: {
                  name:
                    tool.name,

                  description:
                    tool.description,

                  parameters:
                    tool.parameters
                }
              })
            ),

          tool_choice:
            "auto"
        });

    const assistantMessage =
      response
        .choices[0]
        ?.message;

    if (
      !assistantMessage
    ) {
      throw new Error(
        "OpenRouter returned no assistant message."
      );
    }

    messages.push(
      assistantMessage
    );

    const toolCalls =
      assistantMessage
        .tool_calls ??
      [];

    if (
      toolCalls.length ===
      0
    ) {
      return {
        message:
          assistantMessage
            .content ??
          "The agent completed the request.",

        events,

        requiresConfirmation:
          false,

        confirmationFields:
          []
      };
    }

    for (
      const call
      of toolCalls
    ) {
      if (
        call.type !==
        "function"
      ) {
        continue;
      }

      let parsedArguments:
        unknown = {};

      try {
        parsedArguments =
          JSON.parse(
            call
              .function
              .arguments
          );
      } catch {
        parsedArguments =
          {};
      }

      events.push({
        type:
          "tool_call",

        tool:
          call
            .function
            .name,

        arguments:
          parsedArguments
      });

      const execution =
        await executeAgentTool(
          call
            .function
            .name,

          call
            .function
            .arguments,

          {
            directory,
            sessionId
          }
        );

      events.push(
        execution.event
      );

      /*
       * Important:
       * stop immediately if a human confirmation
       * boundary is reached.
       */
      if (
        execution
          .event
          .type ===
        "confirmation_required"
      ) {
        return {
          message:
            `Human confirmation is required before registration. Please confirm or correct: ${
              execution
                .event
                .fields
                ?.join(
                  ", "
                ) ??
              "the flagged fields"
            }.`,

          events,

          requiresConfirmation:
            true,

          confirmationFields:
            execution
              .event
              .fields ??
            []
        };
      }

      messages.push({
        role:
          "tool",

        tool_call_id:
          call.id,

        content:
          execution.output
      });
    }
  }

  throw new Error(
    `Agent exceeded ${MAX_TOOL_ROUNDS} tool rounds.`
  );
}