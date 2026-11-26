import { useMemo, useState, type KeyboardEvent } from 'react';
import { AppIcon } from '../Icons/AppIcon.tsx';
import { knowledgeIndexService } from '../../services/knowledgeIndex.ts';
import { useKnowledgeStore } from '../../stores/knowledgeStore.ts';
import { downloadKnowledgeJson, useKnowledgeDocumentOpener, type KnowledgeViewProps } from './knowledgeModel.ts';
import { KnowledgeEmpty, KnowledgeError } from './KnowledgeStates.tsx';

const WIDTH = 360;
const HEIGHT = 280;

export function GraphView({ onOpenDocument }: KnowledgeViewProps) {
  const revision = useKnowledgeStore(state => state.revision);
  const activeRoot = useKnowledgeStore(state => state.activeRoot);
  const [focused, setFocused] = useState<string | null>(null);
  const { openDocument, error } = useKnowledgeDocumentOpener(onOpenDocument);
  const graph = useMemo(() => {
    void revision; void activeRoot;
    return knowledgeIndexService.graph();
  }, [revision, activeRoot]);
  const positions = useMemo(() => new Map(graph.nodes.map((node, index) => {
    const angle = graph.nodes.length === 1 ? 0 : index / graph.nodes.length * Math.PI * 2 - Math.PI / 2;
    const radius = Math.min(WIDTH, HEIGHT) * 0.34;
    return [node.id, { x: WIDTH / 2 + Math.cos(angle) * radius, y: HEIGHT / 2 + Math.sin(angle) * radius }];
  })), [graph]);
  const activate = (id: string) => { setFocused(id); void openDocument(id); };
  const keyActivate = (event: KeyboardEvent<SVGGElement>, id: string) => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); activate(id); }
  };

  return (
    <div className="knowledge-graph">
      <div className="knowledge-toolbar">
        <span className="knowledge-hint">{graph.nodes.length} 个节点 · {graph.edges.length} 条关系</span>
        <button type="button" onClick={() => downloadKnowledgeJson('knowledge-graph.json', graph)}><AppIcon name="download" size={14} />JSON</button>
      </div>
      {error && <KnowledgeError message={error} />}
      {!graph.nodes.length ? <KnowledgeEmpty title="还没有可绘制的关系" icon="workflow">扫描包含 Wiki 链接的 Markdown 后生成关系图。</KnowledgeEmpty> : (
        <svg className="knowledge-graph-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label="文档关系图">
          <g className="knowledge-graph-edges" stroke="currentColor">
            {graph.edges.map(edge => {
              const from = positions.get(edge.source);
              const to = positions.get(edge.target);
              return from && to ? <line key={`${edge.source}:${edge.target}`} x1={from.x} y1={from.y} x2={to.x} y2={to.y} /> : null;
            })}
          </g>
          {graph.nodes.map(node => {
            const point = positions.get(node.id)!;
            return (
              <g
                className={`knowledge-graph-node${focused === node.id ? ' is-focused' : ''}`}
                role="button"
                tabIndex={0}
                aria-label={`打开文档：${node.title}`}
                key={node.id}
                transform={`translate(${point.x} ${point.y})`}
                onFocus={() => setFocused(node.id)}
                onClick={() => activate(node.id)}
                onKeyDown={event => keyActivate(event, node.id)}
              >
                <title>{node.title}</title>
                <circle r={focused === node.id ? 11 : 8} stroke="currentColor" fill="var(--bg-panel)" />
                <circle className="knowledge-graph-dot" r="2.5" fill="currentColor" />
                <text textAnchor="middle" y="24">{node.title.length > 16 ? `${node.title.slice(0, 15)}…` : node.title}</text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
