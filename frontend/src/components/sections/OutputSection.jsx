import { FaRegCopy } from "react-icons/fa";

export default function OutputSection({
  title = "Output",
  value,
  onCopy,
  placeholder = "Output will be displayed here...",
}) {
  return (
    <div className="flex flex-col h-full p-2 gap-2 w-full">
      <h2 className="text-md font-semibold text-center">{title}</h2>

      <div className="relative h-full w-full">
        <textarea
          className="textarea w-full h-full p-3 border border-primary/30 rounded bg-base-100 resize-none font-mono"
          placeholder={placeholder}
          value={value || ""}
          readOnly
        />

        <button
          type="button"
          className="absolute bottom-2 right-2 p-3 bg-transparent hover:bg-neutral/90 hover:text-white rounded-full disabled:opacity-60 disabled:hover:bg-transparent disabled:hover:text-inherit"
          onClick={onCopy}
          disabled={!value}
          aria-label="Copy output"
        >
          <FaRegCopy className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}
