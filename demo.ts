import {
  rm
} from "node:fs/promises";

import path from "node:path";

import {
  leer_buzon,
  extraer,
  validar,
  registrar,
  alertas
} from "./src/tools/contratos.js";

const context = {
  directory:
    process.cwd(),

  sessionId:
    "deterministic-demo"
};

/*
 * Frozen date supplied by the challenge.
 * Using an explicit reference date keeps
 * this demonstration reproducible.
 */
const ALERT_REFERENCE_DATE =
  "2026-05-30";

// =====================================================
// CLEAN GENERATED OUTPUT
// =====================================================

await rm(
  path.join(
    process.cwd(),
    "out"
  ),
  {
    recursive: true,
    force: true
  }
);

console.log(
  "\n========================================"
);

console.log(
  "PERIFERIA IT GROUP - CHALLENGE 02"
);

console.log(
  "DETERMINISTIC END-TO-END TOOL DEMO"
);

console.log(
  "========================================"
);

// =====================================================
// READ INBOX
// =====================================================

const inboxText =
  await leer_buzon.execute(
    {},
    context
  );

const inbox =
  JSON.parse(
    inboxText
  );

if (
  !inbox.ok
) {
  console.error(
    inbox.error
  );

  process.exit(
    1
  );
}

const messages =
  inbox
    .data
    .mensajes;

console.log(
  `\nPending messages: ${messages.length}`
);

// =====================================================
// PROCESS ALL MESSAGES
// =====================================================

for (
  const message
  of messages
) {
  console.log(
    "\n========================================"
  );

  console.log(
    `Message: ${message.id}`
  );

  console.log(
    `Subject: ${message.asunto}`
  );

  // -------------------------------------
  // EXTRACTION
  // -------------------------------------

  const extractionText =
    await extraer.execute(
      {
        mensaje_id:
          message.id
      },
      context
    );

  const extraction =
    JSON.parse(
      extractionText
    );

  if (
    !extraction.ok
  ) {
    console.log(
      `Extraction error: ${extraction.error}`
    );

    continue;
  }

  const contract =
    extraction.data;

  console.log(
    `Document type: ${contract.tipo_documento}`
  );

  console.log(
    `Contract ID: ${contract.id_contrato.valor}`
  );

  console.log(
    `Client: ${contract.cliente.valor}`
  );

  // -------------------------------------
  // VALIDATION
  // -------------------------------------

  const validationText =
    await validar.execute(
      {
        mensaje_id:
          message.id,

        contrato:
          contract
      },
      context
    );

  const validation =
    JSON.parse(
      validationText
    );

  if (
    !validation.ok
  ) {
    console.log(
      `Validation error: ${validation.error}`
    );

    continue;
  }

  console.log(
    `Classification: ${validation.data.clasificacion}`
  );

  console.log(
    `Human review: ${
      validation
        .data
        .requiere_revision
        .length
        ? validation
            .data
            .requiere_revision
            .join(
              ", "
            )
        : "none"
    }`
  );

  if (
    validation
      .data
      .diferencias
  ) {
    const keys =
      Object.keys(
        validation
          .data
          .diferencias
      );

    if (
      keys.length >
      0
    ) {
      console.log(
        "Changes:"
      );

      console.log(
        JSON.stringify(
          validation
            .data
            .diferencias,
          null,
          2
        )
      );
    }
  }

  // -------------------------------------
  // FIRST REGISTRATION ATTEMPT
  // -------------------------------------

  const registrationText =
    await registrar.execute(
      {
        mensaje_id:
          message.id,

        contrato:
          contract,

        validacion:
          validation.data,

        confirmado:
          false
      },
      context
    );

  const registration =
    JSON.parse(
      registrationText
    );

  /*
   * Low-confidence contracts must stop here
   * until the human explicitly confirms them.
   */
  if (
    registration
      .requires_confirmation
  ) {
    console.log(
      "Registration blocked: human confirmation required."
    );

    console.log(
      `Fields: ${registration.fields.join(", ")}`
    );

    /*
     * Simulated human-in-the-loop response
     * for the expected msg-006 case.
     */
    if (
      message.id ===
      "msg-006"
    ) {
      console.log(
        "Simulating human confirmation:"
      );

      console.log(
        "value = 0"
      );

      console.log(
        "end date = 2027-08-31"
      );

      const confirmedText =
        await registrar.execute(
          {
            mensaje_id:
              message.id,

            contrato:
              contract,

            validacion:
              validation.data,

            confirmado:
              true,

            campos_confirmados: {
              valor:
                0,

              fecha_fin:
                "2027-08-31"
            }
          },
          context
        );

      const confirmed =
        JSON.parse(
          confirmedText
        );

      if (
        confirmed.ok
      ) {
        console.log(
          `Registration result: ${confirmed.data.accion}`
        );
      } else {
        console.log(
          `Registration error: ${confirmed.error}`
        );
      }
    }

    continue;
  }

  if (
    registration.ok
  ) {
    console.log(
      `Registration result: ${registration.data.accion}`
    );
  } else {
    console.log(
      `Registration error: ${registration.error}`
    );
  }
}

// =====================================================
// FINAL INBOX CHECK
// =====================================================

console.log(
  "\n========================================"
);

console.log(
  "FINAL INBOX CHECK"
);

console.log(
  "========================================"
);

const finalInboxText =
  await leer_buzon.execute(
    {},
    context
  );

const finalInbox =
  JSON.parse(
    finalInboxText
  );

if (
  !finalInbox.ok
) {
  console.log(
    `Final inbox error: ${finalInbox.error}`
  );
} else {
  console.log(
    `Remaining pending messages: ${finalInbox.data.mensajes.length}`
  );
}

// =====================================================
// CONTRACT ALERT REPORT
// =====================================================

console.log(
  "\n========================================"
);

console.log(
  "CONTRACT ALERT REPORT"
);

console.log(
  "========================================"
);

const alertsText =
  await alertas.execute(
    {
      fecha_referencia:
        ALERT_REFERENCE_DATE
    },
    context
  );

const alertsResult =
  JSON.parse(
    alertsText
  );

if (
  !alertsResult.ok
) {
  console.log(
    `Alert error: ${alertsResult.error}`
  );
} else {
  const report =
    alertsResult.data;

  console.log(
    `Reference date: ${report.fecha_referencia}`
  );

  console.log(
    `Expiration window: ${report.ventana_vencimiento_dias} days`
  );

  console.log(
    `Contracts requiring attention: ${report.total_alertas}`
  );

  for (
    const alert
    of report.alertas
  ) {
    console.log(
      "\n----------------------------------------"
    );

    console.log(
      `Contract: ${alert.id_contrato}`
    );

    console.log(
      `Client: ${alert.cliente}`
    );

    console.log(
      `End date: ${alert.fecha_fin || "not available"}`
    );

    if (
      alert
        .dias_para_vencimiento !==
      null
    ) {
      console.log(
        `Days to expiration: ${alert.dias_para_vencimiento}`
      );
    }

    console.log(
      `Policy status: ${alert.estado_poliza || "not available"}`
    );

    console.log(
      "Alert reasons:"
    );

    for (
      const reason
      of alert.razones
    ) {
      console.log(
        `- ${reason}`
      );
    }
  }
}

// =====================================================
// GENERATED FILES
// =====================================================

console.log(
  "\n========================================"
);

console.log(
  "GENERATED OUTPUT"
);

console.log(
  "========================================"
);

console.log(
  "out/sharepoint/maestro-contratos.csv"
);

console.log(
  "out/sharepoint/documentos/"
);

console.log(
  "out/sharepoint/historial.json"
);

console.log(
  "out/sharepoint/alertas.json"
);

console.log(
  "out/procesados.json"
);