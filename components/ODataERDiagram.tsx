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
import { Tooltip, Button, Spinner } from "@nextui-org/react";
import { Key } from 'lucide-react';

const elk = new ELK();

// 实体节点组件
const EntityNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={`border-2 rounded-lg min-w-[200px] bg-content1 transition-all ${selected ? 'border-primary shadow-xl ring-2 ring-primary/20' : 'border-divider shadow-sm'}`}>
      {/* 定义连接点 Handles - 增加 id 以便更精确控制连接（如果需要），目前主要提供多方位接入 */}
      <Handle type="target" position={Position.Top} className="!bg-primary w-2 h-2 !-top-1" />
      <Handle type="source" position={Position.Top} className="!bg-primary w-2 h-2 !-top-1" />
      <Handle type="target" position={Position.Right} className="!bg-primary w-2 h-2 !-right-1" />
      <Handle type="source" position={Position.Right} className="!bg-primary w-2 h-2 !-right-1" />
      <Handle type="target" position={Position.Bottom} className="!bg-primary w-2 h-2 !-bottom-1" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary w-2 h-2 !-bottom-1" />
      <Handle type="target" position={Position.Left} className="!bg-primary w-2 h-2 !-left-1" />
      <Handle type="source" position={Position.Left} className="!bg-primary w-2 h-2 !-left-1" />

      {/* 标题栏 */}
      <div className="bg-primary/10 p-2 font-bold text-center border-b border-divider text-sm text-primary rounded-t-md">
         {data.label}
      </div>

      {/* 属性列表 */}
      <div className="p-2 flex flex-col gap-0.5 bg-content1 rounded-b-md">
        {data.properties.slice(0, 12).map((prop: any) => (
          <div key={prop.name} className={`text-[10px] flex items-center justify-between p-1 rounded-sm ${data.keys.includes(prop.name) ? 'bg-warning/10 text-warning-700 font-semibold' : 'text-default-600'}`}>
               <span className="flex items-center gap-1 truncate max-w-[130px]" title={prop.name}>
                 {data.keys.includes(prop.name) && <Key size={8} />}
                 {prop.name}
               </span>
               <span className="text-[9px] text-default-400 ml-1 opacity-70">{prop.type.split('.').pop()}</span>
          </div>
        ))}
        {data.properties.length > 12 && (
            <div className="text-[9px] text-default-300 text-center pt-1 italic">
                + {data.properties.length - 12} properties
            </div>
        )}
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
  const [hasData, setHasData] = useState(false);

  useEffect(() => {
    if (!url) return;
    setLoading(true);

    const loadData = async () => {
      try {
        const metadataUrl = url.endsWith('$metadata') ? url : `${url.replace(/\/$/, '')}/$metadata`;
        const res = await fetch(metadataUrl);
        if (!res.ok) throw new Error("Fetch failed");
        
        const xml = await res.text();
        const { entities } = parseMetadataToSchema(xml);

        if (entities.length === 0) {
            setHasData(false);
            setLoading(false);
            return;
        }

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
            if (nav.targetType) {
                let targetName = nav.targetType;
                if (targetName.startsWith('Collection(')) {
                    targetName = targetName.slice(11, -1);
                }
                targetName = targetName.split('.').pop();
                
                if (targetName && initialNodes.find(n => n.id === targetName)) {
                    initialEdges.push({
                        id: `${entity.name}-${targetName}-${nav.name}`,
                        source: entity.name,
                        target: targetName,
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
                        type: 'smoothstep', // 使用 smoothstep 以获得直角折线
                        animated: false,
                        style: { stroke: '#999', strokeWidth: 1.5, opacity: 1 },
                        data: { label: nav.name }
                    });
                }
            }
          });
        });

        // 计算每个节点的估算高度，以便 ELK 知道其实际大小，避免连线穿过
        // Header ~40px, Item ~24px, Padding ~16px. Max 12 items + footer (~20px)
        const getNodeHeight = (propCount: number) => {
            const visibleProps = Math.min(propCount, 12);
            const baseHeight = 45; // Title
            const propsHeight = visibleProps * 24; 
            const footerHeight = propCount > 12 ? 25 : 10;
            return baseHeight + propsHeight + footerHeight; 
        };

        // 使用 ELK 进行自动布局
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            // 节点垂直间距：设大一点防止垂直方向挤压
            'elk.spacing.nodeNode': '100', 
            // 层间距（水平）：设大一点给垂直穿梭的线留空间
            'elk.layered.spacing.nodeNodeBetweenLayers': '350', 
            // 路由策略
            'elk.edgeRouting': 'ORTHOGONAL',
            // 节点放置策略：NETWORK_SIMPLEX 通常比 BRANDES_KOEPF 产生更少的回环和交叉
            'elk.layered.nodePlacement.strategy': 'NETWORK_SIMPLEX',
            // 独立组件间距
            'elk.spacing.componentComponent': '200', 
            // 关键：增加连线和节点之间的间距（防止线穿过节点）
            'elk.layered.spacing.edgeNodeBetweenLayers': '100', 
            // 尝试交互式减少交叉
            'elk.layered.crossingMinimization.strategy': 'INTERACTIVE',
            // 允许合并同向边，视觉更整洁
            'elk.layered.mergeEdges': 'true'
          },
          children: initialNodes.map(n => ({ 
              id: n.id, 
              width: 220, // 略微增加预留宽度
              height: getNodeHeight(n.data.properties.length) // 动态高度
          })), 
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
        setHasData(true);
      } catch (err) {
        console.error("ER Diagram generation failed", err);
        setHasData(false);
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [url]);

  const onNodeClick = useCallback((event: any, node: any) => {
    const connectedEdgeIds = edges.filter(e => e.source === node.id || e.target === node.id);
    const connectedNodeIds = new Set(connectedEdgeIds.flatMap(e => [e.source, e.target]));
    
    setNodes((nds) => nds.map((n) => {
      const isRelated = connectedNodeIds.has(n.id) || n.id === node.id;
      return {
        ...n,
        style: { 
          opacity: isRelated ? 1 : 0.1, 
          filter: isRelated ? 'none' : 'grayscale(100%)',
          transition: 'all 0.3s ease'
        }
      };
    }));

    setEdges((eds) => eds.map(e => {
        const isDirectlyConnected = e.source === node.id || e.target === node.id;
        return {
            ...e,
            animated: isDirectlyConnected,
            style: { 
                ...e.style, 
                stroke: isDirectlyConnected ? '#0070f3' : '#999',
                strokeWidth: isDirectlyConnected ? 2 : 1,
                opacity: isDirectlyConnected ? 1 : 0.05, 
                zIndex: isDirectlyConnected ? 10 : 0
            },
            label: isDirectlyConnected ? e.data.label : '',
            labelStyle: {
                fill: isDirectlyConnected ? '#0070f3' : 'transparent', 
                fontWeight: 700
            },
            labelBgStyle: { fill: isDirectlyConnected ? 'rgba(255, 255, 255, 0.8)' : 'transparent' }
        };
    }));
  }, [edges, setNodes, setEdges]);

  const resetView = () => {
     setNodes((nds) => nds.map(n => ({...n, style: { opacity: 1, filter: 'none' }})));
     setEdges((eds) => eds.map(e => ({
         ...e, 
         animated: false, 
         style: { stroke: '#999', strokeWidth: 1.5, opacity: 1 }, 
         label: '',
         labelStyle: { fill: 'transparent' },
         labelBgStyle: { fill: 'transparent' }
     })));
  };

  return (
    <div className="w-full h-full relative bg-content2/30">
      {loading && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80 backdrop-blur-sm gap-4">
          <Spinner size="lg" color="primary" />
          <p className="text-default-500 font-medium">Analyzing OData Metadata...</p>
        </div>
      )}
      
      {!loading && !hasData && (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-default-400">
           <p>No Entities found or Metadata parse error.</p>
           <Button size="sm" variant="light" color="primary" onPress={() => window.location.reload()}>Retry</Button>
        </div>
      )}

      <div className="absolute top-4 right-4 z-10">
        <Button size="sm" color="primary" variant="flat" onPress={resetView}>Reset View</Button>
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
        minZoom={0.1}
        maxZoom={1.5}
      >
        <Controls className="bg-content1 border border-divider shadow-sm" />
        <Background color="#888" gap={24} size={1} />
      </ReactFlow>
    </div>
  );
};

export default ODataERDiagram;