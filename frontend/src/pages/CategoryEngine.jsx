import InputSection from "../components/sections/InputSection";
import OutputSection from "../components/sections/OutputSection";
import ConsoleSection from "../components/sections/ConsoleSection";
import ChartSection from "../components/sections/ChartSection";

export default function CategoryEngine() {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full max-w-8xl mx-auto">
          <div className="grid h-full min-h-0 grid-cols-12 gap-3">
            <div className="col-span-12 xl:col-span-8 flex min-h-0 flex-col gap-3">
              <div className="grid min-h-0 flex-1 grid-cols-12 gap-3">
                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-0 flex-col">
                  <InputSection />
                </div>

                <div className="col-span-12 xl:col-span-6 bg-base-200 rounded-lg shadow border-2 border-primary/70 flex min-h-0 flex-col">
                  <OutputSection />
                </div>
              </div>

              <div className="bg-base-200 rounded-lg shadow border-2 border-primary/70 min-h-60 flex flex-col">
                <ConsoleSection />
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
