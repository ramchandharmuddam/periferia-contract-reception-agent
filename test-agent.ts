import "dotenv/config";

import {
  runAgent
} from "./src/agent/agent.js";

const result =
  await runAgent(
    "Show me the pending contract inbox messages.",
    {
      directory:
        process.cwd(),

      sessionId:
        "manual-test"
    }
  );

console.log(
  "\nAGENT MESSAGE:"
);

console.log(
  result.message
);

console.log(
  "\nTOOL EVENTS:"
);

console.log(
  JSON.stringify(
    result.events,
    null,
    2
  )
);