import { useState } from "react";
import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";
import { postJson } from "../api/MLPEClient";
import { formatJson, tryParseJson } from "../utils/json";

import { UserEngineDefaultPayload } from "../constants";

export default function UserEngine() {
  const [inputText, setInputText] = useState(formatJson(UserEngineDefaultPayload));
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
    setConsoleText("Updating user profile via /user/update-profile...");

    try {
      const response = await postJson("/user/update-profile", parsed.value);
      setOutputText(formatJson(response));
      setConsoleText(
        `Update complete. Quarantined: ${
          response?.quarantined ? "yes" : "no"
        }.`
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
            <div className="col-span-12 xl:col-span-8 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-90 flex-col">
                  <InputSection
                    title="Interaction Batch"
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

            <div className="col-span-12 xl:col-span-4 bg-base-200 p-4 rounded-lg shadow border-2 border-primary/70 flex flex-col">
              <ChartSection />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
