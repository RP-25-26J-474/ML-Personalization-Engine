import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import { postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

const defaultPayload = {
  user_id: "u_001",
  batch_id: "b_001",
  captured_at: "2025-10-06T11:25:00Z",
  page_context: {
    domain: "example.com",
    route: "/checkout",
    app_type: "web",
  },
  events_agg: {
    click_count: 24,
    misclick_rate: 0.12,
    avg_click_interval_ms: 430,
    avg_dwell_ms: 2100,
    rage_clicks: 1,
    zoom_events: 2,
    scroll_speed_px_s: 260,
  },
  raw_samples_optional: [
    { t: 120, type: "click", x: 120, y: 440, target_w: 42, target_h: 18 },
  ],
  _profiler: {
    sampling_hz: 30,
    input_lag_ms_est: 34,
  },
};

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(formatJson(defaultPayload));
  const [outputText, setOutputText] = useState("");
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    setConsoleText("Scoring batch via /temp-detector/score-batch...");

    try {
      const response = await postJson("/temp-detector/score-batch", parsed.value);
      setOutputText(formatJson(response));
      setConsoleText(
        `Batch scored. Quarantined: ${response?.quarantined ? "yes" : "no"}.`
      );
    } catch (error) {
      setOutputText("");
      setConsoleText(
        `Request failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = async () => {
    if (!outputText) return;
    try {
      await navigator.clipboard.writeText(outputText);
      setConsoleText("Output copied to clipboard.");
    } catch (error) {
      setConsoleText(`Copy failed: ${error.message}`);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-4 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <InputSection
                    title="Interaction Batch"
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
                <OutputSection value={outputText} onCopy={handleCopy} />
                <div className="flex-1 min-h-0">
                  <ChartSection />
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
