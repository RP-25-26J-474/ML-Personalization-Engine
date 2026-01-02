import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import ProfileDiffHistory from "../components/sections/ProfileDiffHistory";
import { getJson, postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

import {
  UserEngineDefaultPayload,
  UserEngineBatchDefaultPayload,
} from "../constants";

export default function UserEngine() {
  const [mode, setMode] = useState("single");
  const [inputText, setInputText] = useState(
    formatJson(UserEngineDefaultPayload)
  );
  const [outputText, setOutputText] = useState("");
  const [consoleText, setConsoleText] = useState("Ready.");
  const [isLoading, setIsLoading] = useState(false);
  const [diffHistory, setDiffHistory] = useState([]);
  const [historyUserId, setHistoryUserId] = useState("");
  const [isHistoryLoading, setIsHistoryLoading] = useState(false);

  const extractUserId = (payload) => {
    if (!payload) return "";
    if (payload.user_id) return payload.user_id;
    if (Array.isArray(payload.batches) && payload.batches.length > 0) {
      return payload.batches[0]?.user_id || "";
    }
    return "";
  };

  const fetchHistory = async (userId) => {
    if (!userId) return;
    setIsHistoryLoading(true);
    try {
      const response = await getJson(`/data/profile-diffs?user_id=${userId}`);
      setDiffHistory(Array.isArray(response) ? response : []);
      setHistoryUserId(userId);
    } catch (error) {
      setDiffHistory([]);
      setConsoleText(
        `History load failed: ${error.message}${
          error.data ? ` | ${formatJson(error.data)}` : ""
        }`
      );
    } finally {
      setIsHistoryLoading(false);
    }
  };

  const handleSubmit = async () => {
    const parsed = tryParseJson(inputText);
    if (!parsed.ok) {
      setConsoleText(`Invalid JSON: ${parsed.error.message}`);
      return;
    }

    setIsLoading(true);
    const endpoint =
      mode === "batch" ? "/user/update-profile-batch" : "/user/update-profile";
    setConsoleText(`Updating user profile via ${endpoint}...`);

    try {
      const response = await postJson(endpoint, parsed.value);
      setOutputText(formatJson(response));
      setConsoleText(
        `Update complete. Quarantined: ${
          response?.quarantined ? "yes" : "no"
        }.`
      );
      const userId = extractUserId(parsed.value);
      if (userId) {
        await fetchHistory(userId);
      }
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
            <div className="col-span-12 xl:col-span-8 max-h-[calc(100vh-12rem)] flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <div className="flex items-center justify-between px-4 pt-4">
                    <div className="text-sm font-semibold">Mode</div>
                    <div className="join">
                      <button
                        className={`btn btn-xs join-item ${
                          mode === "single" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => {
                          setMode("single");
                          setInputText(formatJson(UserEngineDefaultPayload));
                        }}
                        type="button"
                      >
                        Single
                      </button>
                      <button
                        className={`btn btn-xs join-item ${
                          mode === "batch" ? "btn-primary" : "btn-ghost"
                        }`}
                        onClick={() => {
                          setMode("batch");
                          setInputText(
                            formatJson(UserEngineBatchDefaultPayload)
                          );
                        }}
                        type="button"
                      >
                        Batch
                      </button>
                    </div>
                  </div>
                  <InputSection
                    title={
                      mode === "batch" ? "Interaction Batches" : "Interaction Batch"
                    }
                    value={inputText}
                    onChange={setInputText}
                    onSubmit={handleSubmit}
                    isLoading={isLoading}
                  />
                </div>

                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <OutputSection value={outputText} onCopy={handleCopy} />
                </div>
              </div>

              <div className="bg-base-200 rounded-lg shadow border-2 border-primary/70 min-h-40 flex flex-col">
                <ConsoleSection value={consoleText} />
              </div>
            </div>

            <div className="col-span-12 xl:col-span-4 max-h-[calc(100vh-12rem)] bg-base-200 p-4 rounded-lg shadow border-2 border-primary/70 flex flex-col">
              <ChartSection
                title="Profile Diff History"
                subtitle={
                  isHistoryLoading
                    ? "Loading changes..."
                    : "Version-by-version knob changes"
                }
              >
                <ProfileDiffHistory
                  items={diffHistory}
                  userId={historyUserId}
                />
              </ChartSection>
              <div className="mt-3">
                <button
                  className="btn btn-xs btn-outline"
                  disabled={isHistoryLoading || !historyUserId}
                  onClick={() => fetchHistory(historyUserId)}
                  type="button"
                >
                  Refresh history
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
