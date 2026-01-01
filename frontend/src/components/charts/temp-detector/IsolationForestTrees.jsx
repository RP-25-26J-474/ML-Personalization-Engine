import { useMemo } from "react";
import { FaExpand } from "react-icons/fa6";

function Node({ node, maxDepth = 6 }) {
  const isLeaf = !node.left && !node.right;
  const label = isLeaf
    ? `Leaf (samples: ${node.samples})`
    : `${node.feature} <= ${node.threshold?.toFixed(2)} (samples: ${
        node.samples
      })`;

  const depthLimited = node.depth >= maxDepth;

  return (
    <details className="ml-3" open={node.depth === 0}>
      <summary className="cursor-pointer text-xs text-base-content/80">
        <span className="font-mono">{label}</span>
      </summary>
      {depthLimited && !isLeaf ? (
        <div className="ml-4 text-xs text-base-content/50">
          Depth limit reached.
        </div>
      ) : (
        <div className="mt-1">
          {node.left ? <Node node={node.left} maxDepth={maxDepth} /> : null}
          {node.right ? <Node node={node.right} maxDepth={maxDepth} /> : null}
        </div>
      )}
    </details>
  );
}

export default function IsolationForestTrees({ trees = [], maxDepth = 6 }) {
  const treeList = useMemo(() => trees || [], [trees]);

  if (!treeList.length) {
    return (
      <div className="flex h-full items-center justify-center text-sm opacity-70">
        No tree data available.
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-2 text-xs">
      {treeList.map((tree) => (
        <div
          key={tree.index}
          className="mb-3 rounded border border-primary/20 bg-base-100/70"
        >
          <div className="flex flex-row justify-between items-center px-3 py-2 border-b border-primary/10">
            <div className="text-xs font-semibold">
              Tree #{tree.index} · nodes {tree.tree.node_count} · depth{" "}
              {tree.tree.max_depth}
            </div>
            <button className="btn btn-primary btn-outline btn-xs"><FaExpand /></button>
          </div>
          <div className="px-2 py-2">
            <Node node={tree.tree.root} maxDepth={maxDepth} />
          </div>
        </div>
      ))}
    </div>
  );
}
