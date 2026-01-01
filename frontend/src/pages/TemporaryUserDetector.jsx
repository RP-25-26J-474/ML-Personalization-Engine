import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import { postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

const defaultPayload = {
  batches: [
    {
      user_id: "u_001",
      batch_id: "b_keep",
      captured_at: "2025-10-06T11:25:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 24,
        misclick_rate: 0.08,
        avg_click_interval_ms: 430,
        avg_dwell_ms: 2100,
        rage_clicks: 0,
        zoom_events: 1,
        scroll_speed_px_s: 260,
      },
      raw_samples_optional: [
        { t: 120, type: "click", x: 120, y: 440, target_w: 42, target_h: 18 },
      ],
      _profiler: {
        sampling_hz: 30,
        input_lag_ms_est: 34,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_quarantine",
      captured_at: "2025-10-06T11:27:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 10,
        misclick_rate: 0.45,
        avg_click_interval_ms: 120,
        avg_dwell_ms: 400,
        rage_clicks: 4,
        zoom_events: 0,
        scroll_speed_px_s: 640,
      },
      raw_samples_optional: [],
      _profiler: {
        sampling_hz: 30,
        input_lag_ms_est: 51,
      },
    },
    {
      user_id: "u_001",
      batch_id: "b_reject",
      captured_at: "2025-10-06T11:29:00Z",
      page_context: {
        domain: "example.com",
        route: "/checkout",
        app_type: "web",
      },
      events_agg: {
        click_count: 5,
        misclick_rate: 0.6,
        avg_click_interval_ms: 80,
        avg_dwell_ms: 180,
        rage_clicks: 8,
        zoom_events: 0,
        scroll_speed_px_s: 880,
      },
      raw_samples_optional: [],
      _profiler: {
        sampling_hz: 30,
        input_lag_ms_est: 69,
      },
    },
  ],
};

function TemporaryUserDetector() {
  const [inputText, setInputText] = useState(formatJson(defaultPayload));
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

  const handleCopy = async (text) => {
    if (!text) return;
    try {
      await navigator.clipboard.writeText(text);
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
                <div className="grid min-h-70 grid-cols-12 gap-3">
                  <div className="col-span-12 xl:col-span-4 bg-base-100/60 rounded-lg border border-primary/20 flex min-h-0">
                    <OutputSection
                      title="Legit Batches"
                      value={keptText}
                      onCopy={() => handleCopy(keptText)}
                      placeholder="Kept batches will be listed here..."
                    />
                  </div>
                  <div className="col-span-12 xl:col-span-4 bg-base-100/60 rounded-lg border border-primary/20 flex min-h-0">
                    <OutputSection
                      title="Quarantined Batches"
                      value={quarantinedText}
                      onCopy={() => handleCopy(quarantinedText)}
                      placeholder="Quarantined batches will be listed here..."
                    />
                  </div>
                  <div className="col-span-12 xl:col-span-4 bg-base-100/60 rounded-lg border border-primary/20 flex min-h-0">
                    <OutputSection
                      title="Rejected Batches"
                      value={rejectedText}
                      onCopy={() => handleCopy(rejectedText)}
                      placeholder="Rejected batches will be listed here..."
                    />
                  </div>
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
