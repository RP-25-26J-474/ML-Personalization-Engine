import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import Tabs from "../components/Tabs/Tabs";
import Accordian from "../components/Accordian/Accordian";
import { postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

import { TemporaryUserDetectorDefaultPayload } from "../constants";

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(formatJson(TemporaryUserDetectorDefaultPayload));
  const [keptItems, setKeptItems] = useState([]);
  const [quarantinedItems, setQuarantinedItems] = useState([]);
  const [rejectedItems, setRejectedItems] = useState([]);
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
      setKeptItems(response?.kept || []);
      setQuarantinedItems(response?.quarantined || []);
      setRejectedItems(response?.rejected || []);
      const summary = response?.summary;
      setConsoleText(
        summary
          ? `Batches scored. Kept ${summary.kept}, Quarantined ${summary.quarantined}, Rejected ${summary.rejected}.`
          : "Batches scored."
      );
    } catch (error) {
      setKeptItems([]);
      setQuarantinedItems([]);
      setRejectedItems([]);
      setConsoleText(
        `Request failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const formatScore = (value) =>
    typeof value === "number" ? value.toFixed(3) : "n/a";

  const toAccordianItems = (items) =>
    items.map((item) => ({
      key: item.batch_id,
      title: `${item.user_id} | ${item.batch_id}`,
      subtitle: `Anomaly Score: ${item.anomaly_score} • Similarity: ${item.decision}`,
      content: (
        <pre className="whitespace-pre-wrap text-xs font-mono">
          {formatJson(item.batch || {})}
        </pre>
      ),
    }));

  const tabs = [
    {
      key: "legit",
      label: "Legit Batches",
      content: (
        <Accordian name="legit-batches" items={toAccordianItems(keptItems)} />
      ),
    },
    {
      key: "quarantined",
      label: "Quarantined Batches",
      content: (
        <Accordian
          name="quarantined-batches"
          items={toAccordianItems(quarantinedItems)}
        />
      ),
    },
    {
      key: "rejected",
      label: "Rejected Batches",
      content: (
        <Accordian
          name="rejected-batches"
          items={toAccordianItems(rejectedItems)}
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
