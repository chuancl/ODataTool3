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
      {/* 定义连接点 Handles */}
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
                
                // 清理 Type 字符串
                // 1. 移除 Collection(...) 包装
                if (targetName.startsWith('Collection(')) {
                    targetName = targetName.slice(11, -1);
                }
                
                // 2. 移除命名空间 (例如 NorthwindModel.Order -> Order)
                // 因为我们的 Node ID 只是简单的实体名
                targetName = targetName.split('.').pop();
                
                if (targetName && initialNodes.find(n => n.id === targetName)) {
                    // 生成唯一颜色 (基于 source id)
                    const stringHash = (str: string) => {
                        let hash = 0;
                        for (let i = 0; i < str.length; i++) {
                            hash = str.charCodeAt(i) + ((hash << 5) - hash);
                        }
                        return hash;
                    }
                    const c = (stringHash(entity.name) & 0x00FFFFFF).toString(16).toUpperCase();
                    const color = "#" + "00000".substring(0, 6 - c.length) + c;

                    initialEdges.push({
                        id: `${entity.name}-${targetName}-${nav.name}`,
                        source: entity.name,
                        target: targetName,
                        markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
                        type: 'smoothstep', 
                        animated: false,
                        style: { stroke: '#999', strokeWidth: 1.5 },
                        // label: nav.name, // 标签太多可能会比较乱，暂时注释掉，鼠标悬停可以显示
                        data: { label: nav.name }
                    });
                }
            }
          });
        });

        // 使用 ELK 进行自动布局
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '100',
            'elk.layered.spacing.nodeNodeBetweenLayers': '150',
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF'
          },
          children: initialNodes.map(n => ({ id: n.id, width: 220, height: 200 })), 
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
          opacity: isRelated ? 1 : 0.15,
          filter: isRelated ? 'none' : 'grayscale(100%)',
          transition: 'all 0.3s ease'
        }
      };
    }));

    setEdges((eds) => eds.map(e => ({
      ...e,
      animated: (e.source === node.id || e.target === node.id),
      style: { 
        ...e.style, 
        stroke: (e.source === node.id || e.target === node.id) ? '#0070f3' : '#e5e5e5',
        strokeWidth: (e.source === node.id || e.target === node.id) ? 2 : 1,
        zIndex: (e.source === node.id || e.target === node.id) ? 10 : 0
      },
      label: (e.source === node.id || e.target === node.id) ? e.data.label : '',
      labelStyle: {
        fill: '#0070f3',
        fontWeight: 700
      },
      labelBgStyle: { fill: 'rgba(255, 255, 255, 0.8)' }
    })));
  }, [edges, setNodes, setEdges]);

  const resetView = () => {
     setNodes((nds) => nds.map(n => ({...n, style: { opacity: 1, filter: 'none' }})));
     setEdges((eds) => eds.map(e => ({
         ...e, 
         animated: false, 
         style: { stroke: '#999', strokeWidth: 1.5 }, 
         label: '' 
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