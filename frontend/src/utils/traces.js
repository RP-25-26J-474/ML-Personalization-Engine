import { appendConsole } from "./demo";

function formatStateMessage(trace) {
  const action = Array.isArray(trace?.actions) ? trace.actions[0] : null;
  const details = action?.details || {};

  if (typeof details.message === "string" && details.message.trim()) {
    return details.message;
  }

  const machine = details.machine || trace?.inputs_summary?.machine || "unknown";
  const entityId =
    details.entity_id || trace?.inputs_summary?.entity_id || "unknown";
  const fromState =
    details.from_state ?? trace?.inputs_summary?.from_state ?? null;
  const toState = details.to_state ?? trace?.inputs_summary?.to_state ?? "unknown";
  const reason = details.reason || "n/a";

  if (fromState == null) {
    return `[SM:${machine}] ${entityId}: initialized to '${toState}' (reason: ${reason})`;
  }
  if (fromState === toState) {
    return `[SM:${machine}] ${entityId}: stayed at '${toState}' (reason: ${reason})`;
  }
  return `[SM:${machine}] ${entityId}: '${fromState}' -> '${toState}' (reason: ${reason})`;
}

export function appendStateMachineTraces(setConsoleText, traces) {
  if (!Array.isArray(traces) || traces.length === 0) return;
  const stateTraces = traces.filter((trace) => trace?.stage === "state_machine");
  if (stateTraces.length === 0) return;

  appendConsole(
    setConsoleText,
    `State-machine transitions (${stateTraces.length})`
  );
  stateTraces.forEach((trace) => {
    appendConsole(setConsoleText, formatStateMessage(trace));
  });
}

