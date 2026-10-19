import {
  leer_buzon,
  extraer,
  validar,
  registrar,
  alertas
} from "../tools/contratos.js";

export type ToolContext = {
  directory: string;
  sessionId: string;
};

export type AgentToolEvent = {
  type:
    | "tool_call"
    | "tool_result"
    | "confirmation_required";

  tool: string;

  arguments?: unknown;

  result?: unknown;

  fields?: string[];
};

export const openAITools = [
  {
    type: "function" as const,

    name:
      "leer_buzon",

    description:
      "List pending inbox messages that have not yet been processed.",

    parameters: {
      type: "object",

      properties: {},

      additionalProperties:
        false
    }
  },

  {
    type: "function" as const,

    name:
      "extraer",

    description:
      "Extract structured contract data with confidence scores from one inbox message.",

    parameters: {
      type: "object",

      properties: {
        mensaje_id: {
          type: "string",

          description:
            "Inbox message identifier such as msg-001."
        }
      },

      required: [
        "mensaje_id"
      ],

      additionalProperties:
        false
    }
  },

  {
    type: "function" as const,

    name:
      "validar",

    description:
      "Validate extracted contract data against the contract master.",

    parameters: {
      type: "object",

      properties: {
        mensaje_id: {
          type: "string"
        },

        contrato: {
          type: "object",

          description:
            "The complete contract object returned by extraer.",

          additionalProperties:
            true
        }
      },

      required: [
        "mensaje_id",
        "contrato"
      ],

      additionalProperties:
        false
    }
  },

  {
    type: "function" as const,

    name:
      "registrar",

    description:
      "Register or update a validated contract. Human confirmation is required whenever validation indicates review fields.",

    parameters: {
      type: "object",

      properties: {
        mensaje_id: {
          type: "string"
        },

        contrato: {
          type: "object",

          additionalProperties:
            true
        },

        validacion: {
          type: "object",

          additionalProperties:
            true
        },

        confirmado: {
          type: "boolean",

          description:
            "True only after explicit human confirmation."
        },

        campos_confirmados: {
          type: "object",

          properties: {
            valor: {
              type: "number"
            },

            fecha_fin: {
              type: "string"
            }
          },

          additionalProperties:
            false
        }
      },

      required: [
        "mensaje_id",
        "contrato",
        "validacion",
        "confirmado"
      ],

      additionalProperties:
        false
    }
  },

  {
    type: "function" as const,

    name:
      "alertas",

    description:
      "Generate deterministic expiration and policy alerts from the contract master.",

    parameters: {
      type: "object",

      properties: {
        fecha_referencia: {
          type: "string",

          description:
            "Reference date in YYYY-MM-DD format."
        }
      },

      required: [
        "fecha_referencia"
      ],

      additionalProperties:
        false
    }
  }
];

function safeParseArguments(
  value: string
): Record<
  string,
  unknown
> {
  try {
    const parsed =
      JSON.parse(
        value
      );

    if (
      parsed &&
      typeof parsed ===
        "object" &&
      !Array.isArray(
        parsed
      )
    ) {
      return parsed as
        Record<
          string,
          unknown
        >;
    }

    return {};
  } catch {
    return {};
  }
}

export async function executeAgentTool(
  toolName: string,
  rawArguments: string,
  ctx: ToolContext
): Promise<{
  output: string;
  event:
    AgentToolEvent;
}> {
  const args =
    safeParseArguments(
      rawArguments
    );

  let output:
    string;

  switch (
    toolName
  ) {
    case "leer_buzon": {
      output =
        await leer_buzon.execute(
          {},
          ctx
        );

      break;
    }

    case "extraer": {
      output =
        await extraer.execute(
          {
            mensaje_id:
              String(
                args.mensaje_id ??
                ""
              )
          },
          ctx
        );

      break;
    }

    case "validar": {
      output =
        await validar.execute(
          {
            mensaje_id:
              String(
                args.mensaje_id ??
                ""
              ),

            contrato:
              args.contrato as
                Parameters<
                  typeof validar.execute
                >[0]["contrato"]
          },
          ctx
        );

      break;
    }

    case "registrar": {
      output =
        await registrar.execute(
          {
            mensaje_id:
              String(
                args.mensaje_id ??
                ""
              ),

            contrato:
              args.contrato as
                Parameters<
                  typeof registrar.execute
                >[0]["contrato"],

            validacion:
              args.validacion as
                Parameters<
                  typeof registrar.execute
                >[0]["validacion"],

            confirmado:
              args.confirmado ===
              true,

            campos_confirmados:
              args.campos_confirmados as
                Parameters<
                  typeof registrar.execute
                >[0]["campos_confirmados"]
          },
          ctx
        );

      break;
    }

    case "alertas": {
      output =
        await alertas.execute(
          {
            fecha_referencia:
              String(
                args.fecha_referencia ??
                "2026-05-30"
              )
          },
          ctx
        );

      break;
    }

    default: {
      output =
        JSON.stringify({
          ok: false,

          error:
            `Unknown tool: ${toolName}`
        });
    }
  }

  let parsedResult:
    unknown = output;

  try {
    parsedResult =
      JSON.parse(
        output
      );
  } catch {
    // Keep raw string.
  }

  const resultObject =
    parsedResult &&
    typeof parsedResult ===
      "object"
      ? parsedResult as
          Record<
            string,
            unknown
          >
      : null;

  if (
    toolName ===
      "registrar" &&
    resultObject
      ?.requires_confirmation ===
      true
  ) {
    const fields =
      Array.isArray(
        resultObject.fields
      )
        ? resultObject.fields.filter(
            (
              field
            ): field is string =>
              typeof field ===
              "string"
          )
        : [];

    return {
      output,

      event: {
        type:
          "confirmation_required",

        tool:
          toolName,

        arguments:
          args,

        result:
          parsedResult,

        fields
      }
    };
  }

  return {
    output,

    event: {
      type:
        "tool_result",

      tool:
        toolName,

      arguments:
        args,

      result:
        parsedResult
    }
  };
}