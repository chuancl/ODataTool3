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
      {/* 
        定义连接点 Handles 
        为了实现智能连线，我们在上下左右都定义了 source 和 target 两种类型的 handle，并赋予 ID
      */}
      
      {/* Top */}
      <Handle type="target" position={Position.Top} id="target-top" className="!bg-primary w-2 h-2 !-top-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Top} id="source-top" className="!bg-primary w-2 h-2 !-top-1 opacity-0 hover:opacity-100 transition-opacity" />
      
      {/* Right */}
      <Handle type="target" position={Position.Right} id="target-right" className="!bg-primary w-2 h-2 !-right-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} id="source-right" className="!bg-primary w-2 h-2 !-right-1 opacity-0 hover:opacity-100 transition-opacity" />
      
      {/* Bottom */}
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!bg-primary w-2 h-2 !-bottom-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!bg-primary w-2 h-2 !-bottom-1 opacity-0 hover:opacity-100 transition-opacity" />
      
      {/* Left */}
      <Handle type="target" position={Position.Left} id="target-left" className="!bg-primary w-2 h-2 !-left-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Left} id="source-left" className="!bg-primary w-2 h-2 !-left-1 opacity-0 hover:opacity-100 transition-opacity" />

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

        // 1. 初始化节点 (不带坐标)
        const initialNodes = entities.map((e) => ({
          id: e.name,
          type: 'entity',
          data: { label: e.name, properties: e.properties, keys: e.keys },
          position: { x: 0, y: 0 }
        }));

        // 2. 预备连线数据 (暂不设置 handle，布局后再设置)
        const rawEdges: any[] = [];
        entities.forEach(entity => {
          entity.navigationProperties.forEach((nav: any) => {
            if (nav.targetType) {
                let targetName = nav.targetType;
                if (targetName.startsWith('Collection(')) {
                    targetName = targetName.slice(11, -1);
                }
                targetName = targetName.split('.').pop();
                
                if (targetName && initialNodes.find(n => n.id === targetName)) {
                    // --- 核心修改：忽略自关联连线 ---
                    // 如果源实体和目标实体相同（自关联），则直接跳过，不添加连线
                    if (entity.name === targetName) {
                        return; 
                    }

                    rawEdges.push({
                        id: `${entity.name}-${targetName}-${nav.name}`,
                        source: entity.name,
                        target: targetName,
                        label: nav.name // 暂存 label
                    });
                }
            }
          });
        });

        // 3. 计算节点尺寸供 ELK 使用 (增加 Padding 防止连线穿过)
        const getNodeDimensions = (propCount: number) => {
            const visibleProps = Math.min(propCount, 12);
            const baseHeight = 45; 
            const propsHeight = visibleProps * 24; 
            const footerHeight = propCount > 12 ? 25 : 10;
            // 宽度设为 300 (实际约 200)，高度也增加 buffer
            // 增加尺寸是为了让 ELK 认为节点很大，从而在布局时留出更多空白，防止连线拥挤
            return { width: 300, height: baseHeight + propsHeight + footerHeight + 50 };
        };

        // 4. ELK 布局配置
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            // 节点垂直间距：大幅增加
            'elk.spacing.nodeNode': '100', 
            // 层间距（水平）：大幅增加，给连线留足空间
            'elk.layered.spacing.nodeNodeBetweenLayers': '250', 
            // 路由策略
            'elk.edgeRouting': 'ORTHOGONAL',
            // 连线与节点之间的最小间距 (防止穿过)
            'elk.layered.spacing.edgeNodeBetweenLayers': '80',
            // 节点放置策略 - BALANCED 试图让节点对齐更整齐
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            // 鼓励直线
            'elk.layered.nodePlacement.favorStraightEdges': 'true',
            // 组件间距
            'elk.spacing.componentComponent': '150',
          },
          children: initialNodes.map(n => {
              const dims = getNodeDimensions(n.data.properties.length);
              return { id: n.id, ...dims };
          }), 
          edges: rawEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
        };

        const layoutedGraph = await elk.layout(elkGraph);

        // 5. 应用布局坐标
        const layoutedNodes = initialNodes.map(node => {
          const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
          // 使用实际 CSS 渲染的宽度估值，用于后续计算连线端点
          const renderWidth = 220; 
          const renderHeight = node.data.properties.length * 24 + 60; // 粗略估算

          return {
            ...node,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
            width: renderWidth,
            height: renderHeight
          };
        });

        // 6. 智能连线逻辑 (根据坐标决定 SourceHandle 和 TargetHandle)
        const finalEdges = rawEdges.map(e => {
            const sourceNode = layoutedNodes.find(n => n.id === e.source);
            const targetNode = layoutedNodes.find(n => n.id === e.target);

            if (!sourceNode || !targetNode) return null;

            // 计算中心点
            const sx = sourceNode.position.x + sourceNode.width / 2;
            const tx = targetNode.position.x + targetNode.width / 2;
            
            const dx = tx - sx;
            
            // 节点实际宽度阈值 (用于判断是否在同一列)
            const columnThreshold = 200; 

            let sourceHandle = 'source-right';
            let targetHandle = 'target-left';

            // --- 优化后的连线策略 ---

            if (Math.abs(dx) < columnThreshold) {
                // 情况 A: 垂直对齐 (在同一列，或者水平距离很近)
                // 策略: 强制使用 Right -> Right。
                // 这样连线会从源节点右边出来，绕一个大弯，进入目标节点右边。
                // 避免了直接从 Bottom -> Top 穿过中间可能存在的其他节点。
                sourceHandle = 'source-right';
                targetHandle = 'target-right';
            } else if (dx > 0) {
                // 情况 B: 目标在右侧 (标准层级流向)
                // 策略: Right -> Left
                sourceHandle = 'source-right';
                targetHandle = 'target-left';
            } else {
                // 情况 C: 目标在左侧 (反向/回环)
                // 策略: Left -> Right
                sourceHandle = 'source-left';
                targetHandle = 'target-right';
            }

            return {
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: sourceHandle,
                targetHandle: targetHandle,
                type: 'smoothstep', // 直角连线
                markerEnd: { type: MarkerType.ArrowClosed, color: '#999' },
                animated: false,
                style: { stroke: '#999', strokeWidth: 1.5, opacity: 1 },
                data: { label: e.label }
            };
        }).filter(Boolean) as Edge[];

        setNodes(layoutedNodes);
        setEdges(finalEdges);
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