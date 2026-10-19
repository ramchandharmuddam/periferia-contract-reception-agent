let sessionId =
  null;

let pendingFields =
  [];

let latestConfirmationEvent =
  null;


const messagesElement =
  document.getElementById(
    "messages"
  );

const eventsElement =
  document.getElementById(
    "events"
  );

const form =
  document.getElementById(
    "chat-form"
  );

const input =
  document.getElementById(
    "message-input"
  );

const sendButton =
  document.getElementById(
    "send-button"
  );

const statusElement =
  document.getElementById(
    "status"
  );

const confirmationPanel =
  document.getElementById(
    "confirmation-panel"
  );

const confirmationFields =
  document.getElementById(
    "confirmation-fields"
  );

const confirmButton =
  document.getElementById(
    "confirm-button"
  );

const rejectButton =
  document.getElementById(
    "reject-button"
  );


// =====================================================
// HEALTH
// =====================================================

async function checkHealth() {
  try {
    const response =
      await fetch(
        "/api/health"
      );

    const result =
      await response.json();

    if (
      result.ok
    ) {
      statusElement.textContent =
        "API Online";

      return;
    }
  } catch {
    // handled below
  }

  statusElement.textContent =
    "API Offline";
}


// =====================================================
// SAFE MARKDOWN
// =====================================================

function renderMarkdown(
  text
) {
  if (
    typeof marked ===
    "undefined"
  ) {
    return text;
  }

  return marked.parse(
    text
  );
}


// =====================================================
// MESSAGE UI
// =====================================================

function addMessage(
  role,
  text
) {
  const wrapper =
    document.createElement(
      "div"
    );

  wrapper.className =
    `message ${role}`;

  const label =
    document.createElement(
      "div"
    );

  label.className =
    "message-label";

  label.textContent =
    role ===
    "user"
      ? "YOU"
      : role ===
        "error"
        ? "ERROR"
        : "AGENT";

  const body =
    document.createElement(
      "div"
    );

  body.className =
    "message-body";

  if (
    role ===
    "assistant"
  ) {
    body.innerHTML =
      renderMarkdown(
        text
      );
  } else {
    body.textContent =
      text;
  }

  wrapper.appendChild(
    label
  );

  wrapper.appendChild(
    body
  );

  messagesElement.appendChild(
    wrapper
  );

  messagesElement.scrollTop =
    messagesElement.scrollHeight;
}


// =====================================================
// TOOL EVENT SUMMARIES
// =====================================================

function summarizeEvent(
  event
) {
  if (
    event.type ===
    "tool_call"
  ) {
    if (
      event.tool ===
      "leer_buzon"
    ) {
      return "Reading pending inbox messages.";
    }

    if (
      event.tool ===
      "extraer"
    ) {
      return `Extracting contract data from ${event.arguments?.mensaje_id ?? "message"}.`;
    }

    if (
      event.tool ===
      "validar"
    ) {
      return "Validating extracted contract data against the master.";
    }

    if (
      event.tool ===
      "registrar"
    ) {
      return "Attempting controlled contract registration.";
    }

    if (
      event.tool ===
      "alertas"
    ) {
      return "Generating deterministic contract alerts.";
    }

    return "Tool requested by agent.";
  }

  if (
    event.type ===
    "confirmation_required"
  ) {
    const fields =
      event.fields?.join(
        ", "
      ) ??
      "review fields";

    return `Human approval required for: ${fields}.`;
  }

  if (
    event.type ===
    "tool_result"
  ) {
    const result =
      event.result;

    if (
      event.tool ===
      "leer_buzon"
    ) {
      const count =
        result
          ?.data
          ?.mensajes
          ?.length;

      if (
        typeof count ===
        "number"
      ) {
        return `${count} pending message(s) found.`;
      }
    }

    if (
      event.tool ===
      "extraer"
    ) {
      const contractId =
        result
          ?.data
          ?.id_contrato
          ?.valor;

      return contractId
        ? `Contract ${contractId} extracted.`
        : "Extraction completed.";
    }

    if (
      event.tool ===
      "validar"
    ) {
      const classification =
        result
          ?.data
          ?.clasificacion;

      const review =
        result
          ?.data
          ?.requiere_revision;

      if (
        classification
      ) {
        if (
          Array.isArray(
            review
          ) &&
          review.length >
            0
        ) {
          return `${classification}; review required for ${review.join(", ")}.`;
        }

        return `Validation result: ${classification}.`;
      }
    }

    if (
      event.tool ===
      "registrar"
    ) {
      const action =
        result
          ?.data
          ?.accion;

      if (
        action
      ) {
        return `Registration result: ${action}.`;
      }
    }

    if (
      event.tool ===
      "alertas"
    ) {
      const total =
        result
          ?.data
          ?.total_alertas;

      if (
        typeof total ===
        "number"
      ) {
        return `${total} contract alert(s) generated.`;
      }
    }

    return result?.ok ===
      false
      ? "Tool returned an error."
      : "Tool completed successfully.";
  }

  return "Agent activity.";
}


// =====================================================
// TOOL ACTIVITY
// =====================================================

function renderEvents(
  events
) {
  if (
    !events ||
    events.length ===
      0
  ) {
    return;
  }

  const empty =
    eventsElement.querySelector(
      ".empty-state"
    );

  if (
    empty
  ) {
    empty.remove();
  }

  for (
    const event
    of events
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    if (
      event.type ===
      "tool_call"
    ) {
      wrapper.className =
        "event tool-call";
    } else if (
      event.type ===
      "confirmation_required"
    ) {
      wrapper.className =
        "event confirmation";
    } else {
      wrapper.className =
        "event tool-result";
    }

    const row =
      document.createElement(
        "div"
      );

    row.className =
      "event-row";

    const left =
      document.createElement(
        "div"
      );

    const title =
      document.createElement(
        "div"
      );

    title.className =
      "event-title";

    title.textContent =
      event.tool;

    const summary =
      document.createElement(
        "div"
      );

    summary.className =
      "event-summary";

    summary.textContent =
      summarizeEvent(
        event
      );

    left.appendChild(
      title
    );

    left.appendChild(
      summary
    );

    const type =
      document.createElement(
        "div"
      );

    type.className =
      "event-type";

    type.textContent =
      event.type;

    row.appendChild(
      left
    );

    row.appendChild(
      type
    );

    wrapper.appendChild(
      row
    );

    const payload =
      event.result ??
      event.arguments;

    if (
      payload !==
      undefined
    ) {
      const details =
        document.createElement(
          "details"
        );

      const detailsSummary =
        document.createElement(
          "summary"
        );

      detailsSummary.textContent =
        "View details";

      const pre =
        document.createElement(
          "pre"
        );

      pre.textContent =
        JSON.stringify(
          payload,
          null,
          2
        );

      details.appendChild(
        detailsSummary
      );

      details.appendChild(
        pre
      );

      wrapper.appendChild(
        details
      );
    }

    eventsElement.appendChild(
      wrapper
    );
  }
}


// =====================================================
// CONFIRMATION
// =====================================================

function findConfirmationEvent(
  events
) {
  return events.find(
    event =>
      event.type ===
      "confirmation_required"
  );
}


function proposedValue(
  field
) {
  const args =
    latestConfirmationEvent
      ?.arguments;

  const contract =
    args
      ?.contrato;

  if (
    !contract
  ) {
    return "";
  }

  if (
    field ===
    "valor"
  ) {
    if (
      contract
        .valor_indeterminado
        ?.valor ===
      true
    ) {
      return "0";
    }

    return (
      contract
        .valor
        ?.valor ??
      ""
    );
  }

  if (
    field ===
    "fecha_fin"
  ) {
    return (
      contract
        .fecha_fin
        ?.valor ??
      ""
    );
  }

  return "";
}


function showConfirmation(
  fields,
  event
) {
  pendingFields =
    fields;

  latestConfirmationEvent =
    event;

  confirmationFields.innerHTML =
    "";

  for (
    const field
    of fields
  ) {
    const wrapper =
      document.createElement(
        "div"
      );

    wrapper.className =
      "field";

    const label =
      document.createElement(
        "label"
      );

    label.textContent =
      field;

    const inputField =
      document.createElement(
        "input"
      );

    inputField.id =
      `confirm-${field}`;

    inputField.value =
      proposedValue(
        field
      );

    if (
      field ===
      "valor"
    ) {
      inputField.type =
        "number";
    } else if (
      field ===
      "fecha_fin"
    ) {
      inputField.type =
        "date";
    } else {
      inputField.type =
        "text";
    }

    wrapper.appendChild(
      label
    );

    wrapper.appendChild(
      inputField
    );

    confirmationFields.appendChild(
      wrapper
    );
  }

  confirmationPanel.classList.remove(
    "hidden"
  );

  confirmationPanel.scrollIntoView({
    behavior:
      "smooth"
  });
}


function hideConfirmation() {
  pendingFields =
    [];

  latestConfirmationEvent =
    null;

  confirmationFields.innerHTML =
    "";

  confirmationPanel.classList.add(
    "hidden"
  );
}


// =====================================================
// CHAT REQUEST
// =====================================================

async function sendMessage(
  message
) {
  addMessage(
    "user",
    message
  );

  sendButton.disabled =
    true;

  sendButton.textContent =
    "Working...";

  try {
    const requestBody = {
      message
    };

    if (
      sessionId
    ) {
      requestBody.sessionId =
        sessionId;
    }

    const response =
      await fetch(
        "/api/chat",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json"
          },

          body:
            JSON.stringify(
              requestBody
            )
        }
      );

    const result =
      await response.json();

    if (
      result.sessionId
    ) {
      sessionId =
        result.sessionId;
    }

    if (
      !result.ok
    ) {
      addMessage(
        "error",
        result.message ??
        result.error ??
        "Request failed."
      );

      return;
    }

    addMessage(
      "assistant",
      result.message
    );

    renderEvents(
      result.events
    );

    if (
      result
        .requiresConfirmation
    ) {
      const confirmationEvent =
        findConfirmationEvent(
          result.events
        );

      showConfirmation(
        result
          .confirmationFields,
        confirmationEvent
      );
    }
  } catch (
    error
  ) {
    addMessage(
      "error",
      error instanceof
      Error
        ? error.message
        : "Unable to contact the server."
    );
  } finally {
    sendButton.disabled =
      false;

    sendButton.textContent =
      "Send";
  }
}


// =====================================================
// FORM
// =====================================================

form.addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    const message =
      input.value.trim();

    if (
      !message
    ) {
      return;
    }

    input.value =
      "";

    await sendMessage(
      message
    );
  }
);


// =====================================================
// QUICK ACTIONS
// =====================================================

document
  .querySelectorAll(
    ".quick-button"
  )
  .forEach(
    button => {
      button.addEventListener(
        "click",
        async () => {
          const prompt =
            button.dataset
              .prompt;

          if (
            prompt
          ) {
            await sendMessage(
              prompt
            );
          }
        }
      );
    }
  );


// =====================================================
// CONFIRM
// =====================================================

confirmButton.addEventListener(
  "click",
  async () => {
    if (
      !sessionId
    ) {
      return;
    }

    const fields =
      {};

    for (
      const field
      of pendingFields
    ) {
      const element =
        document.getElementById(
          `confirm-${field}`
        );

      if (
        !element
      ) {
        continue;
      }

      if (
        field ===
        "valor"
      ) {
        fields.valor =
          Number(
            element.value
          );
      } else if (
        field ===
        "fecha_fin"
      ) {
        fields.fecha_fin =
          element.value;
      }
    }

    confirmButton.disabled =
      true;

    try {
      const response =
        await fetch(
          "/api/confirm",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                sessionId,
                confirmed:
                  true,
                fields
              })
          }
        );

      const result =
        await response.json();

      if (
        result.ok
      ) {
        addMessage(
          "assistant",
          result.message
        );

        hideConfirmation();
      } else {
        addMessage(
          "error",
          result.error ??
          "Confirmation failed."
        );
      }
    } catch (
      error
    ) {
      addMessage(
        "error",
        error instanceof
        Error
          ? error.message
          : "Confirmation request failed."
      );
    } finally {
      confirmButton.disabled =
        false;
    }
  }
);


// =====================================================
// CANCEL
// =====================================================

rejectButton.addEventListener(
  "click",
  async () => {
    if (
      !sessionId
    ) {
      return;
    }

    try {
      const response =
        await fetch(
          "/api/confirm",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json"
            },

            body:
              JSON.stringify({
                sessionId,
                confirmed:
                  false,
                fields:
                  {}
              })
          }
        );

      const result =
        await response.json();

      if (
        result.ok
      ) {
        addMessage(
          "assistant",
          result.message
        );

        hideConfirmation();
      } else {
        addMessage(
          "error",
          result.error ??
          "Cancellation failed."
        );
      }
    } catch (
      error
    ) {
      addMessage(
        "error",
        error instanceof
        Error
          ? error.message
          : "Cancellation request failed."
      );
    }
  }
);


// =====================================================
// CLEAR TOOL ACTIVITY
// =====================================================

document
  .getElementById(
    "clear-events"
  )
  .addEventListener(
    "click",
    () => {
      eventsElement.innerHTML =
        `<div class="empty-state">
          Tool activity will appear here.
        </div>`;
    }
  );


checkHealth();