import { FaRegCopy } from "react-icons/fa";

export default function OutputSection() {
  return (
    <div className="flex flex-col h-full p-2 gap-2">
      <h2 className="text-md font-semibold text-center">Output</h2>

      <div className="relative h-full">
        <textarea
          className="textarea w-full h-full p-3 border border-primary/30 rounded bg-base-100 text-slate-100 resize-none font-mono"
          placeholder="Output will be displayed here..."
          readOnly
        />

        <button
          type="button"
          className="absolute bottom-2 right-2 p-3 bg-transparent hover:bg-primary/90 text-white rounded-full"
        >
          <FaRegCopy className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
