import "dotenv/config";

import {
  randomUUID
} from "node:crypto";

import path from "node:path";

import express from "express";

import cors from "cors";

import {
  z
} from "zod";

import {
  runAgent
} from "./agent/agent.js";

import {
  registrar
} from "./tools/contratos.js";

import type {
  AgentToolEvent
} from "./agent/tools.js";

const app =
  express();

const PORT =
  Number(
    process.env.PORT ??
    3000
  );

app.use(
  cors()
);

app.use(
  express.json({
    limit:
      "1mb"
  })
);

// =====================================================
// FRONTEND
// =====================================================

app.use(
  express.static(
    path.join(
      process.cwd(),
      "web"
    )
  )
);

// =====================================================
// REQUEST SCHEMAS
// =====================================================

const chatRequestSchema =
  z.object({
    message:
      z
        .string()
        .trim()
        .min(
          1,
          "Message is required."
        ),

    sessionId:
      z
        .string()
        .trim()
        .min(1)
        .optional()
  });

const confirmationRequestSchema =
  z.object({
    sessionId:
      z
        .string()
        .trim()
        .min(
          1,
          "sessionId is required."
        ),

    confirmed:
      z.boolean(),

    fields:
      z
        .object({
          valor:
            z
              .number()
              .optional(),

          fecha_fin:
            z
              .string()
              .regex(
                /^\d{4}-\d{2}-\d{2}$/,
                "fecha_fin must use YYYY-MM-DD format."
              )
              .optional()
        })
        .default({})
  });

// =====================================================
// HUMAN CONFIRMATION STATE
// =====================================================

type PendingRegistration = {
  sessionId: string;

  createdAt: string;

  registrationArguments:
    Record<
      string,
      unknown
    >;

  fields:
    string[];
};

const pendingConfirmations =
  new Map<
    string,
    PendingRegistration
  >();

// =====================================================
// HELPERS
// =====================================================

function findConfirmationEvent(
  events:
    AgentToolEvent[]
):
  AgentToolEvent | undefined {
  return events.find(
    (event) =>
      event.type ===
      "confirmation_required"
  );
}

function safeObject(
  value: unknown
): Record<
  string,
  unknown
> | null {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value
    )
  ) {
    return null;
  }

  return value as
    Record<
      string,
      unknown
    >;
}

// =====================================================
// HEALTH
// =====================================================

app.get(
  "/api/health",
  (
    _request,
    response
  ) => {
    response.json({
      ok: true,

      service:
        "periferia-contract-agent",

      status:
        "healthy"
    });
  }
);

// =====================================================
// CHAT
// =====================================================

app.post(
  "/api/chat",
  async (
    request,
    response
  ) => {
    try {
      const parsed =
        chatRequestSchema
          .safeParse(
            request.body
          );

      if (
        !parsed.success
      ) {
        response
          .status(400)
          .json({
            ok: false,

            error:
              "Invalid request.",

            details:
              parsed.error
                .flatten()
          });

        return;
      }

      const sessionId =
        parsed
          .data
          .sessionId ??
        randomUUID();

      const existingPending =
        pendingConfirmations.get(
          sessionId
        );

      if (
        existingPending
      ) {
        response
          .status(409)
          .json({
            ok: false,

            sessionId,

            requiresConfirmation:
              true,

            confirmationFields:
              existingPending
                .fields,

            message:
              "This session already has a registration waiting for human confirmation. Confirm or reject it before continuing."
          });

        return;
      }

      const result =
        await runAgent(
          parsed
            .data
            .message,
          {
            directory:
              process.cwd(),

            sessionId
          }
        );

      if (
        result
          .requiresConfirmation
      ) {
        const confirmationEvent =
          findConfirmationEvent(
            result.events
          );

        const argumentsObject =
          safeObject(
            confirmationEvent
              ?.arguments
          );

        if (
          argumentsObject
        ) {
          pendingConfirmations.set(
            sessionId,
            {
              sessionId,

              createdAt:
                new Date()
                  .toISOString(),

              registrationArguments:
                argumentsObject,

              fields:
                result
                  .confirmationFields
            }
          );
        }
      }

      response.json({
        ok: true,

        sessionId,

        message:
          result.message,

        events:
          result.events,

        requiresConfirmation:
          result
            .requiresConfirmation,

        confirmationFields:
          result
            .confirmationFields
      });
    } catch (
      error
    ) {
      console.error(
        "Chat API error:",
        error
      );

      response
        .status(500)
        .json({
          ok: false,

          error:
            error instanceof
            Error
              ? error.message
              : "Unknown chat error"
        });
    }
  }
);

// =====================================================
// HUMAN CONFIRMATION
// =====================================================

app.post(
  "/api/confirm",
  async (
    request,
    response
  ) => {
    try {
      const parsed =
        confirmationRequestSchema
          .safeParse(
            request.body
          );

      if (
        !parsed.success
      ) {
        response
          .status(400)
          .json({
            ok: false,

            error:
              "Invalid confirmation request.",

            details:
              parsed.error
                .flatten()
          });

        return;
      }

      const {
        sessionId,
        confirmed,
        fields
      } =
        parsed.data;

      const pending =
        pendingConfirmations.get(
          sessionId
        );

      if (
        !pending
      ) {
        response
          .status(404)
          .json({
            ok: false,

            error:
              "No pending human confirmation exists for this session."
          });

        return;
      }

      if (
        confirmed ===
        false
      ) {
        pendingConfirmations.delete(
          sessionId
        );

        response.json({
          ok: true,

          sessionId,

          registered:
            false,

          message:
            "Registration was cancelled by the human reviewer."
        });

        return;
      }

      const original =
        pending
          .registrationArguments;

      const mensajeId =
        typeof original
          .mensaje_id ===
        "string"
          ? original
              .mensaje_id
          : "";

      const contrato =
        original
          .contrato;

      const validacion =
        original
          .validacion;

      if (
        !mensajeId ||
        !contrato ||
        !validacion
      ) {
        pendingConfirmations.delete(
          sessionId
        );

        response
          .status(500)
          .json({
            ok: false,

            error:
              "Stored confirmation state is incomplete."
          });

        return;
      }

      const registrationText =
        await registrar.execute(
          {
            mensaje_id:
              mensajeId,

            contrato:
              contrato as
                Parameters<
                  typeof registrar.execute
                >[0]["contrato"],

            validacion:
              validacion as
                Parameters<
                  typeof registrar.execute
                >[0]["validacion"],

            confirmado:
              true,

            campos_confirmados:
              fields
          },
          {
            directory:
              process.cwd(),

            sessionId
          }
        );

      const registration =
        JSON.parse(
          registrationText
        );

      if (
        registration
          .requires_confirmation
      ) {
        response
          .status(400)
          .json({
            ok: false,

            sessionId,

            requiresConfirmation:
              true,

            fields:
              registration
                .fields,

            error:
              registration
                .error
          });

        return;
      }

      if (
        !registration.ok
      ) {
        response
          .status(400)
          .json({
            ok: false,

            sessionId,

            error:
              registration
                .error ??
              "Registration failed."
          });

        return;
      }

      pendingConfirmations.delete(
        sessionId
      );

      response.json({
        ok: true,

        sessionId,

        registered:
          registration
            .data
            .registrado,

        action:
          registration
            .data
            .accion,

        data:
          registration
            .data,

        message:
          registration
            .data
            .registrado
            ? "Human confirmation accepted and the contract was registered successfully."
            : `Operation completed: ${registration.data.accion}.`
      });
    } catch (
      error
    ) {
      console.error(
        "Confirmation API error:",
        error
      );

      response
        .status(500)
        .json({
          ok: false,

          error:
            error instanceof
            Error
              ? error.message
              : "Unknown confirmation error"
        });
    }
  }
);

// =====================================================
// FRONTEND FALLBACK
// Express 5 compatible
// =====================================================

app.use(
  (
    request,
    response,
    next
  ) => {
    if (
      request.path
        .startsWith(
          "/api/"
        )
    ) {
      next();
      return;
    }

    response.sendFile(
      path.join(
        process.cwd(),
        "web",
        "index.html"
      )
    );
  }
);

// =====================================================
// API 404
// =====================================================

app.use(
  (
    _request,
    response
  ) => {
    response
      .status(404)
      .json({
        ok: false,

        error:
          "Route not found."
      });
  }
);

// =====================================================
// START SERVER
// =====================================================

app.listen(
  PORT,
  () => {
    console.log(
      ""
    );

    console.log(
      "========================================"
    );

    console.log(
      "PERIFERIA CONTRACT AGENT"
    );

    console.log(
      "========================================"
    );

    console.log(
      `Application: http://localhost:${PORT}`
    );

    console.log(
      `API health: http://localhost:${PORT}/api/health`
    );

    console.log(
      ""
    );
  }
);