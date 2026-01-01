import { useMemo } from "react";
import { FaExpand } from "react-icons/fa6";
import Modal from "../../modals/Modal";

function Node({ node, maxDepth = 6 }) {
  const isLeaf = !node.left && !node.right;
  const label = isLeaf
    ? `Leaf (samples: ${node.samples})`
    : `${node.feature} <= ${node.threshold?.toFixed(2)} (samples: ${node.samples})`;

  const depthLimited = node.depth >= maxDepth;

  return (
    <details className="ml-3" open={node.depth === 0}>
      <summary className="cursor-pointer text-xs text-base-content/80">
        <span className="font-mono">{label}</span>
      </summary>
      {depthLimited && !isLeaf ? (
        <div className="ml-4 text-xs text-base-content/50">Depth limit reached.</div>
      ) : (
        <div className="mt-1">
          {node.left ? <Node node={node.left} maxDepth={maxDepth} /> : null}
          {node.right ? <Node node={node.right} maxDepth={maxDepth} /> : null}
        </div>
      )}
    </details>
  );
}

function buildLayout(root, maxDepth) {
  const nodes = [];
  const links = [];
  let xCounter = 0;

  const walk = (node, depth) => {
    if (!node || depth > maxDepth) return null;
    const left = walk(node.left, depth + 1);
    const right = walk(node.right, depth + 1);

    const x =
      left && right
        ? (left.x + right.x) / 2
        : left
        ? left.x
        : right
        ? right.x
        : xCounter++;
    const y = depth;

    const current = { ...node, x, y };
    nodes.push(current);

    if (left) links.push({ from: current, to: left });
    if (right) links.push({ from: current, to: right });

    return current;
  };

  walk(root, 0);
  return { nodes, links };
}

function TreeDiagram({ tree, maxDepth }) {
  const layout = useMemo(
    () => buildLayout(tree.root, maxDepth),
    [tree.root, maxDepth]
  );

  const nodeSize = 22;
  const xGap = 20;
  const yGap = 90;

  const maxX = Math.max(1, ...layout.nodes.map((n) => n.x));
  const maxY = Math.max(1, ...layout.nodes.map((n) => n.y));
  const width = (maxX + 1) * xGap + nodeSize * 2;
  const height = (maxY + 1) * yGap + nodeSize * 2;

  return (
    <svg className="w-full h-full bg-slate-950/50 rounded-xl px-4 pt-16" viewBox={`0 0 ${width} ${height}`}>
      {layout.links.map((link, index) => {
        const x1 = link.from.x * xGap + nodeSize;
        const y1 = link.from.y * yGap + nodeSize;
        const x2 = link.to.x * xGap + nodeSize;
        const y2 = link.to.y * yGap + nodeSize;
        return (
          <line
            key={`link-${index}`}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="rgba(148, 163, 184, 0.4)"
          />
        );
      })}
      {layout.nodes.map((node) => {
        const isLeaf = !node.left && !node.right;
        const x = node.x * xGap + nodeSize;
        const y = node.y * yGap + nodeSize;
        const label = isLeaf
          ? "Leaf"
          : `${node.feature} <= ${node.threshold?.toFixed(1)}`;
        return (
          <g key={`node-${node.id}`} transform={`translate(${x} ${y})`}>
            <circle
              r={nodeSize / 2}
              fill={isLeaf ? "#0ea5e9" : "#f97316"}
              stroke="rgba(15, 23, 42, 0.8)"
              strokeWidth="2"
            />
            <text
              x={0}
              y={-16}
              textAnchor="middle"
              fill="rgba(226, 232, 240, 0.8)"
              fontSize="10"
            >
              {label}
            </text>
            <text
              x={0}
              y={14}
              textAnchor="middle"
              fill="rgba(226, 232, 240, 0.6)"
              fontSize="9"
            >
              n={node.samples}
            </text>
          </g>
        );
      })}
    </svg>
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
              Tree #{tree.index} (nodes {tree.tree.node_count}, depth {tree.tree.max_depth})
            </div>
            <Modal
              id={`iforest_tree_${tree.index}`}
              title={`Tree #${tree.index} (nodes ${tree.tree.node_count}, depth ${tree.tree.max_depth})`}
              triggerLabel={<FaExpand />}
              triggerClassName="btn btn-primary btn-outline btn-xs"
              boxClassName="modal-box max-w-3xl"
            >
              <div className="h-[36rem]">
                <TreeDiagram tree={tree.tree} maxDepth={maxDepth} />
              </div>
            </Modal>
          </div>
          <div className="px-2 py-2">
            <Node node={tree.tree.root} maxDepth={maxDepth} />
          </div>
        </div>
      ))}
    </div>
  );
}
