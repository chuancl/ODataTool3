import React, { useCallback, useEffect, useState } from 'react';
import ReactFlow, { 
  Controls, 
  Background, 
  useNodesState, 
  useEdgesState, 
  MarkerType,
  Handle,
  Position,
  NodeProps,
  Edge
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { parseMetadataToSchema } from '@/utils/odata-helper';
import { Tooltip, Button } from "@heroui/react";
import { Key } from 'lucide-react';

const elk = new ELK();

// 实体节点组件
const EntityNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={`border-2 rounded-md min-w-[150px] bg-content1 transition-all ${selected ? 'border-primary shadow-lg' : 'border-default-300'}`}>
      {/* 定义连接点 Handles */}
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <Handle type="source" position={Position.Top} className="!bg-primary" />
      <Handle type="target" position={Position.Right} className="!bg-primary" />
      <Handle type="source" position={Position.Right} className="!bg-primary" />
      <Handle type="target" position={Position.Bottom} className="!bg-primary" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      <Handle type="target" position={Position.Left} className="!bg-primary" />
      <Handle type="source" position={Position.Left} className="!bg-primary" />

      {/* 标题栏 */}
      <Tooltip content={<div className="p-2"><p className="font-bold">{data.label}</p><p className="text-xs text-default-500">Click to focus related</p></div>}>
        <div className="bg-default-100 p-2 font-bold text-center border-b border-default-300 text-sm">
          {data.label}
        </div>
      </Tooltip>

      {/* 属性列表 */}
      <div className="p-2 flex flex-col gap-1">
        {data.properties.slice(0, 8).map((prop: any) => (
          <Tooltip key={prop.name} content={`Type: ${prop.type}`}>
            <div className={`text-xs flex items-center gap-1 p-1 rounded ${data.keys.includes(prop.name) ? 'bg-yellow-100 dark:bg-yellow-900 text-yellow-700 dark:text-yellow-300' : ''}`}>
               {data.keys.includes(prop.name) && <Key size={10} />}
               <span className="truncate">{prop.name}</span>
            </div>
          </Tooltip>
        ))}
        {data.properties.length > 8 && <div className="text-xs text-default-400 text-center">...more</div>}
      </div>
    </div>
  );
};

const nodeTypes = { entity: EntityNode };

interface Props {
  url: string;
}

const ODataERDiagram: React.FC<Props> = ({ url }) => {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const metadataUrl = url.endsWith('$metadata') ? url : `${url.replace(/\/$/, '')}/$metadata`;
        const res = await fetch(metadataUrl);
        const xml = await res.text();
        const { entities, associations } = parseMetadataToSchema(xml);

        // 初始化节点
        const initialNodes = entities.map((e) => ({
          id: e.name,
          type: 'entity',
          data: { label: e.name, properties: e.properties, keys: e.keys },
          position: { x: 0, y: 0 }
        }));

        // 初始化连线
        const initialEdges: Edge[] = [];
        entities.forEach(entity => {
          entity.navigationProperties.forEach((nav: any) => {
            const targetName = nav.type ? nav.type.split('.').pop() : null; 
            if (targetName) {
              initialEdges.push({
                id: `${entity.name}-${targetName}`,
                source: entity.name,
                target: targetName,
                markerEnd: { type: MarkerType.ArrowClosed },
                type: 'smoothstep', 
                animated: false,
                style: { stroke: '#b1b1b7' }
              });
            }
          });
        });

        // 使用 ELK 进行自动布局
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '80',
            'elk.layered.spacing.nodeNodeBetweenLayers': '100',
            'elk.edgeRouting': 'ORTHOGONAL'
          },
          children: initialNodes.map(n => ({ id: n.id, width: 180, height: 200 })),
          edges: initialEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
        };

        const layoutedGraph = await elk.layout(elkGraph);

        // 应用布局坐标
        const layoutedNodes = initialNodes.map(node => {
          const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
          return {
            ...node,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 }
          };
        });

        setNodes(layoutedNodes);
        setEdges(initialEdges);
      } catch (err) {
        console.error("ER Diagram generation failed", err);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [url]);

  // 点击节点高亮关联逻辑
  const onNodeClick = useCallback((event: any, node: any) => {
    const connectedEdgeIds = edges.filter(e => e.source === node.id || e.target === node.id);
    const connectedNodeIds = new Set(connectedEdgeIds.flatMap(e => [e.source, e.target]));
    
    setNodes((nds) => nds.map((n) => {
      const isRelated = connectedNodeIds.has(n.id) || n.id === node.id;
      return {
        ...n,
        style: { 
          opacity: isRelated ? 1 : 0.2,
          transition: 'opacity 0.3s'
        }
      };
    }));

    setEdges((eds) => eds.map(e => ({
      ...e,
      style: { 
        ...e.style, 
        stroke: (e.source === node.id || e.target === node.id) ? '#0070f3' : '#e5e5e5',
        strokeWidth: (e.source === node.id || e.target === node.id) ? 2 : 1
      }
    })));
  }, [edges, setNodes, setEdges]);

  // 重置高亮
  const resetView = () => {
     setNodes((nds) => nds.map(n => ({...n, style: { opacity: 1 }})));
     setEdges((eds) => eds.map(e => ({...e, style: { stroke: '#b1b1b7', strokeWidth: 1 }})));
  };

  return (
    <div className="w-full h-full relative" style={{ height: '100%', minHeight: '600px' }}>
      {loading && <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80">Loading Layout...</div>}
      <div className="absolute top-4 right-4 z-10">
        <Button size="sm" onPress={resetView}>Reset Highlight</Button>
      </div>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onNodeClick={onNodeClick}
        fitView
        attributionPosition="bottom-right"
      >
        <Controls />
        <Background color="#aaa" gap={16} />
      </ReactFlow>
    </div>
  );
};

export default ODataERDiagram;