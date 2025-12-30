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
  Edge,
  SmoothStepEdge
} from 'reactflow';
import 'reactflow/dist/style.css';
import ELK from 'elkjs/lib/elk.bundled.js';
import { parseMetadataToSchema } from '@/utils/odata-helper';
import { Tooltip, Button, Spinner } from "@nextui-org/react";
import { Key, Link2 } from 'lucide-react';

const elk = new ELK();

// 生成字符串 Hash
const generateHashCode = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return hash;
};

// 预定义一组好看的颜色作为 fallback
const PALETTE = [
  '#F5A524', '#F31260', '#9353D3', '#006FEE', '#17C964', 
  '#06B6D4', '#F97316', '#EC4899', '#8B5CF6', '#10B981'
];

const getColor = (index: number) => PALETTE[index % PALETTE.length];

// 实体节点组件
const EntityNode = ({ data, selected }: NodeProps) => {
  return (
    <div className={`border-2 rounded-lg min-w-[200px] bg-content1 transition-all relative ${selected ? 'border-primary shadow-xl ring-2 ring-primary/20' : 'border-divider shadow-sm'}`}>
      
      {/* 动态渲染 Ports (Handles) */}
      {/* 
          关键点：Handle 的位置 (Position) 是由后续计算出来的 
          我们通过 absolute 定位将 handle 放到边框的具体坐标上
      */}
      {data.ports && data.ports.map((port: any) => (
        <Handle
          key={port.id}
          id={port.id}
          type={port.type} // 'source' or 'target'
          position={port.position} // Top, Right, Bottom, Left
          style={{
            // ELK 返回的坐标是相对于节点的左上角的
            // 我们需要微调，让连接点正好压在边框线上
            left: port.x,
            top: port.y,
            transform: 'translate(-50%, -50%)', 
            width: '8px', // 稍微调大一点，方便查看调试，实际可以改小
            height: '8px',
            background: data.fieldColors?.[port.fieldName] || '#0070f3',
            border: '2px solid white',
            borderRadius: '50%',
            opacity: selected ? 1 : 0, // 只有选中节点时才显示连接点，保持界面整洁
            transition: 'opacity 0.2s',
            zIndex: 50
          }}
          className="!absolute"
        />
      ))}

      {/* 标题栏 */}
      <div className="bg-primary/10 p-2 font-bold text-center border-b border-divider text-sm text-primary rounded-t-md">
         {data.label}
      </div>

      {/* 内容区域 */}
      <div className="p-2 flex flex-col gap-0.5 bg-content1 rounded-b-md">
        
        {/* 普通属性 */}
        {data.properties.slice(0, 12).map((prop: any) => {
          // 检查该字段是否有特殊的关联颜色
          const fieldColor = data.fieldColors?.[prop.name];
          
          return (
            <div 
              key={prop.name} 
              className={`text-[10px] flex items-center justify-between p-1 rounded-sm border-l-2 transition-colors
                ${data.keys.includes(prop.name) ? 'bg-warning/10 text-warning-700 font-semibold' : 'text-default-600'}
                ${fieldColor ? '' : 'border-transparent'}
              `}
              style={fieldColor ? { borderColor: fieldColor, backgroundColor: `${fieldColor}15` } : {}}
            >
               <span className="flex items-center gap-1 truncate max-w-[130px]" title={prop.name}>
                 {data.keys.includes(prop.name) && <Key size={8} className="shrink-0" />}
                 <span style={fieldColor ? { color: fieldColor, fontWeight: 700 } : {}}>{prop.name}</span>
               </span>
               <span className="text-[9px] text-default-400 ml-1 opacity-70">{prop.type.split('.').pop()}</span>
            </div>
          );
        })}
        {data.properties.length > 12 && (
            <div className="text-[9px] text-default-300 text-center pt-1 italic">
                + {data.properties.length - 12} properties
            </div>
        )}

        {/* 导航属性 */}
        {data.navigationProperties && data.navigationProperties.length > 0 && (
            <>
                <div className="h-px bg-divider my-1 mx-1 opacity-50" />
                {data.navigationProperties.slice(0, 8).map((nav: any) => {
                    const cleanType = nav.targetType?.replace('Collection(', '').replace(')', '').split('.').pop();
                    return (
                        <div key={nav.name} className="text-[10px] flex items-center justify-between p-1 rounded-sm text-default-500 hover:text-primary transition-colors">
                            <span className="flex items-center gap-1 truncate max-w-[130px]" title={`Navigation: ${nav.name}`}>
                                <Link2 size={8} className="shrink-0 opacity-70" />
                                <span className="italic font-medium">{nav.name}</span>
                            </span>
                            <span className="text-[9px] opacity-50 truncate max-w-[60px]">{cleanType}</span>
                        </div>
                    );
                })}
                 {data.navigationProperties.length > 8 && (
                    <div className="text-[9px] text-default-300 text-center pt-1 italic">
                        + {data.navigationProperties.length - 8} nav props
                    </div>
                )}
            </>
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

        // 1. 数据准备
        const fieldColorMap: Record<string, Record<string, string>> = {}; 
        const rawEdges: any[] = [];
        const processedPairs = new Set<string>(); 
        const portsMap: Record<string, any[]> = {}; 

        const setFieldColor = (entityName: string, fieldName: string, color: string) => {
            if (!fieldColorMap[entityName]) fieldColorMap[entityName] = {};
            fieldColorMap[entityName][fieldName] = color;
        };
        
        // 修改：addPort 不再接收 side 参数，因为我们要让 ELK 自由决定
        const addPort = (entityName: string, portId: string, type: 'source' | 'target', fieldName?: string) => {
            if (!portsMap[entityName]) portsMap[entityName] = [];
            portsMap[entityName].push({
                id: portId,
                // side: ... 我们不设置 side，让布局引擎决定
                type: type, 
                fieldName: fieldName
            });
        };

        entities.forEach(entity => {
          entity.navigationProperties.forEach((nav: any) => {
            if (nav.targetType) {
                let targetName = nav.targetType;
                if (targetName.startsWith('Collection(')) targetName = targetName.slice(11, -1);
                targetName = targetName.split('.').pop();
                
                if (entity.name === targetName) return;

                if (targetName && entities.find(n => n.name === targetName)) {
                    const pairKey = [entity.name, targetName].sort().join('::');
                    const colorIndex = Math.abs(generateHashCode(pairKey));
                    const edgeColor = getColor(colorIndex);
                    
                    let sourceFieldName = '';
                    let targetFieldName = '';

                    if (nav.constraints && nav.constraints.length > 0) {
                        nav.constraints.forEach((c: any) => {
                            setFieldColor(entity.name, c.sourceProperty, edgeColor);
                            setFieldColor(targetName, c.targetProperty, edgeColor);
                            sourceFieldName = c.sourceProperty;
                            targetFieldName = c.targetProperty;
                        });
                    }

                    if (processedPairs.has(pairKey)) return;
                    processedPairs.add(pairKey);

                    const sMult = nav.sourceMultiplicity || '?';
                    const tMult = nav.targetMultiplicity || '?';
                    const label = `${entity.name} (${sMult} - ${tMult}) ${targetName}`;

                    const edgeId = `${entity.name}-${targetName}-${nav.name}`;
                    const sourcePortId = `port-source-${edgeId}`;
                    const targetPortId = `port-target-${edgeId}`;

                    // 修改：不再指定方向，只创建端口
                    addPort(entity.name, sourcePortId, 'source', sourceFieldName);
                    addPort(targetName, targetPortId, 'target', targetFieldName);

                    rawEdges.push({
                        id: edgeId,
                        source: entity.name,
                        target: targetName,
                        sourcePort: sourcePortId,
                        targetPort: targetPortId,
                        label: label,
                        color: edgeColor
                    });
                }
            }
          });
        });

        // 2. 节点尺寸计算
        const getNodeDimensions = (propCount: number, navCount: number) => {
            const visibleProps = Math.min(propCount, 12);
            const visibleNavs = Math.min(navCount, 8);
            const extraHeight = (navCount > 0 ? 10 : 0) + (propCount > 12 ? 20 : 0) + (navCount > 8 ? 20 : 0);
            const height = 45 + (visibleProps * 24) + (visibleNavs * 24) + extraHeight + 50; 
            return { width: 350, height: height };
        };

        const elkNodes = entities.map((e) => {
            const dims = getNodeDimensions(e.properties.length, e.navigationProperties?.length || 0);
            const entityPorts = portsMap[e.name] || [];
            
            return {
                id: e.name,
                width: dims.width,
                height: dims.height,
                ports: entityPorts.map(p => ({
                    id: p.id,
                    width: 0, // 端口视为点
                    height: 0,
                    layoutOptions: {
                         // 关键修改：不强制指定 side，让端口可以在边框上自由移动
                         'org.eclipse.elk.port.borderOffset': '0' 
                    },
                    properties: { ...p }
                }))
            };
        });

        // 3. ELK 布局配置
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '150', 
            'elk.layered.spacing.nodeNodeBetweenLayers': '350', 
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.spacing.edgeNodeBetweenLayers': '100',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.spacing.componentComponent': '200',
            // 关键修改：允许端口分布在任何一边 (FREE)
            'org.eclipse.elk.portConstraints': 'FREE',
            // 优化：允许端口在边上按需排序
            'org.eclipse.elk.layered.allowNonFlowPortsToSwitchSides': 'true'
          },
          children: elkNodes, 
          edges: rawEdges.map(e => ({ 
              id: e.id, 
              sources: [e.source], 
              targets: [e.target],
              sourcePort: e.sourcePort,
              targetPort: e.targetPort
          }))
        };

        const layoutedGraph = await elk.layout(elkGraph);

        // 4. 处理布局结果
        const finalNodes = entities.map(entity => {
          const elkNode = layoutedGraph.children?.find(n => n.id === entity.name);
          if (!elkNode) return null;

          const width = elkNode.width || 0;
          const height = elkNode.height || 0;

          // 计算端口的真实位置和方向
          const processedPorts = elkNode.ports?.map((p: any) => {
              const { x, y } = p;
              let position = Position.Right;

              // 简单的边界检测算法，判断端口落在哪个边上
              // 容差值，比如 2px
              const tolerance = 2;
              
              if (Math.abs(x) < tolerance) {
                  position = Position.Left;
              } else if (Math.abs(x - width) < tolerance) {
                  position = Position.Right;
              } else if (Math.abs(y) < tolerance) {
                  position = Position.Top;
              } else {
                  position = Position.Bottom;
              }
              
              return {
                  id: p.id,
                  type: p.properties.type, 
                  fieldName: p.properties.fieldName,
                  x: x,
                  y: y,
                  position: position
              };
          });

          const visibleProps = Math.min(entity.properties.length, 12);
          const visibleNavs = Math.min(entity.navigationProperties?.length || 0, 8);
          const extraHeight = ((entity.navigationProperties?.length || 0) > 0 ? 10 : 0);
          
          return {
            id: entity.name,
            type: 'entity',
            data: { 
                label: entity.name, 
                properties: entity.properties, 
                keys: entity.keys,
                navigationProperties: entity.navigationProperties,
                fieldColors: fieldColorMap[entity.name] || {},
                ports: processedPorts 
            },
            position: { x: elkNode.x || 0, y: elkNode.y || 0 },
            width: 220, // 渲染宽度
            height: (visibleProps * 24) + (visibleNavs * 24) + extraHeight + 80
          };
        }).filter(Boolean);

        // 5. 生成 Edges
        const finalEdges = rawEdges.map(e => {
            return {
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: e.sourcePort,
                targetHandle: e.targetPort,
                type: 'smoothstep',
                pathOptions: { borderRadius: 30, offset: 20 },
                markerStart: { type: MarkerType.ArrowClosed, color: e.color }, 
                markerEnd: { type: MarkerType.ArrowClosed, color: e.color }, 
                animated: false,
                style: { stroke: e.color, strokeWidth: 1.5, opacity: 0.8 },
                label: e.label,
                labelStyle: { fill: e.color, fontWeight: 700, fontSize: 10 },
                labelBgStyle: { fill: '#ffffff', fillOpacity: 0.7, rx: 4, ry: 4 },
                data: { label: e.label, originalColor: e.color } 
            };
        });

        setNodes(finalNodes as any);
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
        const color = isDirectlyConnected ? (e.data?.originalColor || '#0070f3') : '#999';
        
        return {
            ...e,
            animated: isDirectlyConnected,
            style: { 
                ...e.style, 
                stroke: color,
                strokeWidth: isDirectlyConnected ? 2.5 : 1,
                opacity: isDirectlyConnected ? 1 : 0.1, 
                zIndex: isDirectlyConnected ? 10 : 0
            },
            markerStart: { type: MarkerType.ArrowClosed, color: color }, 
            markerEnd: { type: MarkerType.ArrowClosed, color: color },
            labelStyle: { ...e.labelStyle, fill: color, opacity: isDirectlyConnected ? 1 : 0 },
            labelBgStyle: { ...e.labelBgStyle, fillOpacity: isDirectlyConnected ? 0.9 : 0 }
        };
    }));
  }, [edges, setNodes, setEdges]);

  const resetView = () => {
     setNodes((nds) => nds.map(n => ({...n, style: { opacity: 1, filter: 'none' }})));
     setEdges((eds) => eds.map(e => ({
         ...e, 
         animated: false, 
         style: { stroke: e.data?.originalColor, strokeWidth: 1.5, opacity: 0.8 }, 
         markerStart: { type: MarkerType.ArrowClosed, color: e.data?.originalColor },
         markerEnd: { type: MarkerType.ArrowClosed, color: e.data?.originalColor },
         labelStyle: { ...e.labelStyle, fill: e.data?.originalColor, opacity: 1 },
         labelBgStyle: { ...e.labelBgStyle, fillOpacity: 0.7 }
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