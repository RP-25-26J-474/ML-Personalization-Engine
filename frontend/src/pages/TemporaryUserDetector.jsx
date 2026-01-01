import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import Tabs from "../components/Tabs/Tabs";
import { postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

import { TemporaryUserDetectorDefaultPayload } from "../constants";

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(formatJson(TemporaryUserDetectorDefaultPayload));
  const [keptText, setKeptText] = useState("");
  const [quarantinedText, setQuarantinedText] = useState("");
  const [rejectedText, setRejectedText] = useState("");
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    setConsoleText("Scoring batches via /temp-detector/score-batches...");

    try {
      let payload = parsed.value;
      if (Array.isArray(payload)) {
        payload = { batches: payload };
      } else if (payload && payload.user_id && payload.batch_id) {
        payload = { batches: [payload] };
      }

      const response = await postJson("/temp-detector/score-batches", payload);
      setKeptText(formatJson(response?.kept || []));
      setQuarantinedText(formatJson(response?.quarantined || []));
      setRejectedText(formatJson(response?.rejected || []));
      const summary = response?.summary;
      setConsoleText(
        summary
          ? `Batches scored. Kept ${summary.kept}, Quarantined ${summary.quarantined}, Rejected ${summary.rejected}.`
          : "Batches scored."
      );
    } catch (error) {
      setKeptText("");
      setQuarantinedText("");
      setRejectedText("");
      setConsoleText(
        `Request failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const tabs = [
    {
      key: "legit",
      label: "Legit Batches",
      content: (
        <textarea
          className="textarea w-full min-h-64 p-3 border border-primary/30 rounded bg-base-100 resize-none text-sm font-mono text-primary"
          placeholder="Kept batches will be listed here..."
          value={keptText || ""}
          readOnly
        />
      ),
    },
    {
      key: "quarantined",
      label: "Quarantined Batches",
      content: (
        <textarea
          className="textarea w-full min-h-64 p-3 border border-primary/30 rounded bg-base-100 resize-none text-sm font-mono text-primary"
          placeholder="Quarantined batches will be listed here..."
          value={quarantinedText || ""}
          readOnly
        />
      ),
    },
    {
      key: "rejected",
      label: "Rejected Batches",
      content: (
        <textarea
          className="textarea w-full min-h-64 p-3 border border-primary/30 rounded bg-base-100 resize-none text-sm font-mono text-primary"
          placeholder="Rejected batches will be listed here..."
          value={rejectedText || ""}
          readOnly
        />
      ),
    },
  ];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-4 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <InputSection
                    title="Interaction Batches"
                    value={inputText}
                    onChange={setInputText}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                  />
                </div>
                <div className="col-span-12 bg-base-200 rounded-lg shadow border-2 border-primary/70 min-h-40 flex flex-col">
                  <ConsoleSection value={consoleText} />
                </div>
              </div>
            </div>

            <div className="col-span-12 xl:col-span-8 bg-base-200 p-4 rounded-lg shadow border-2 border-primary/70 flex flex-col">
              <div className="flex-1 min-h-0 flex flex-col gap-3">
                <div className="min-h-70">
                  <Tabs tabs={tabs} />
                </div>
                <div className="flex-1 min-h-0">
                  <ChartSection emptyLabel="Anomaly charts coming soon." />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default TemporaryUserDetector;
