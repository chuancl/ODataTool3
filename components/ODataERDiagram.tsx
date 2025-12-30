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
    <div className={`border-2 rounded-lg min-w-[200px] bg-content1 transition-all ${selected ? 'border-primary shadow-xl ring-2 ring-primary/20' : 'border-divider shadow-sm'}`}>
      <Handle type="target" position={Position.Top} id="target-top" className="!bg-primary w-2 h-2 !-top-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Top} id="source-top" className="!bg-primary w-2 h-2 !-top-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Right} id="target-right" className="!bg-primary w-2 h-2 !-right-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Right} id="source-right" className="!bg-primary w-2 h-2 !-right-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Bottom} id="target-bottom" className="!bg-primary w-2 h-2 !-bottom-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Bottom} id="source-bottom" className="!bg-primary w-2 h-2 !-bottom-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="target" position={Position.Left} id="target-left" className="!bg-primary w-2 h-2 !-left-1 opacity-0 hover:opacity-100 transition-opacity" />
      <Handle type="source" position={Position.Left} id="source-left" className="!bg-primary w-2 h-2 !-left-1 opacity-0 hover:opacity-100 transition-opacity" />

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

        // 1. 预计算 & 关系去重
        const fieldColorMap: Record<string, Record<string, string>> = {}; // Entity -> Field -> Color
        const rawEdges: any[] = [];
        const processedPairs = new Set<string>(); // 用于防止双向关系导致的重影

        // 辅助：获取或初始化实体的颜色Map
        const setFieldColor = (entityName: string, fieldName: string, color: string) => {
            if (!fieldColorMap[entityName]) fieldColorMap[entityName] = {};
            fieldColorMap[entityName][fieldName] = color;
        };

        entities.forEach(entity => {
          entity.navigationProperties.forEach((nav: any) => {
            if (nav.targetType) {
                let targetName = nav.targetType;
                if (targetName.startsWith('Collection(')) targetName = targetName.slice(11, -1);
                targetName = targetName.split('.').pop();
                
                // 忽略自关联
                if (entity.name === targetName) return;

                if (targetName && entities.find(n => n.name === targetName)) {
                    // 生成唯一的关系键 (A-B 和 B-A 视为同一个)
                    const pairKey = [entity.name, targetName].sort().join('::');
                    
                    // 基于关系键生成稳定颜色
                    const colorIndex = Math.abs(generateHashCode(pairKey));
                    const edgeColor = getColor(colorIndex);
                    
                    // 处理字段染色 (始终执行，保证双向字段都高亮)
                    if (nav.constraints && nav.constraints.length > 0) {
                        nav.constraints.forEach((c: any) => {
                            setFieldColor(entity.name, c.sourceProperty, edgeColor);
                            setFieldColor(targetName, c.targetProperty, edgeColor);
                        });
                    }

                    // 检查是否已添加过该关系（解决重影问题）
                    if (processedPairs.has(pairKey)) {
                        return;
                    }
                    processedPairs.add(pairKey);

                    // 构建 Label 显示基数: "NavName (1 : n)"
                    const sMult = nav.sourceMultiplicity || '?';
                    const tMult = nav.targetMultiplicity || '?';
                    const label = `${nav.name} (${sMult} : ${tMult})`;

                    rawEdges.push({
                        id: `${entity.name}-${targetName}-${nav.name}`,
                        source: entity.name,
                        target: targetName,
                        label: label,
                        color: edgeColor // 暂存颜色
                    });
                }
            }
          });
        });

        // 2. 初始化节点
        const initialNodes = entities.map((e) => ({
          id: e.name,
          type: 'entity',
          data: { 
            label: e.name, 
            properties: e.properties, 
            keys: e.keys,
            navigationProperties: e.navigationProperties, // 传递导航属性
            fieldColors: fieldColorMap[e.name] || {} 
          },
          position: { x: 0, y: 0 }
        }));

        // 3. 计算尺寸 (虚拟尺寸比实际渲染大，增加间距)
        const getNodeDimensions = (propCount: number, navCount: number) => {
            const visibleProps = Math.min(propCount, 12);
            const visibleNavs = Math.min(navCount, 8);
            const extraHeight = (navCount > 0 ? 10 : 0) + (propCount > 12 ? 20 : 0) + (navCount > 8 ? 20 : 0);
            
            // 基础高度 + 属性列表高度 + 导航列表高度 + 额外空间
            const height = 45 + (visibleProps * 24) + (visibleNavs * 24) + extraHeight + 50; 
            
            // 宽度设大一些，防止连线贴边
            return { width: 350, height: height };
        };

        // 4. ELK 布局配置
        const elkGraph = {
          id: 'root',
          layoutOptions: {
            'elk.algorithm': 'layered',
            'elk.direction': 'RIGHT',
            'elk.spacing.nodeNode': '150', // 增加节点垂直间距
            'elk.layered.spacing.nodeNodeBetweenLayers': '300', // 增加层间距
            'elk.edgeRouting': 'ORTHOGONAL',
            'elk.layered.spacing.edgeNodeBetweenLayers': '100',
            'elk.layered.nodePlacement.strategy': 'BRANDES_KOEPF',
            'elk.layered.nodePlacement.favorStraightEdges': 'true',
            'elk.spacing.componentComponent': '200',
          },
          children: initialNodes.map(n => ({ 
              id: n.id, 
              ...getNodeDimensions(n.data.properties.length, n.data.navigationProperties?.length || 0) 
          })), 
          edges: rawEdges.map(e => ({ id: e.id, sources: [e.source], targets: [e.target] }))
        };

        const layoutedGraph = await elk.layout(elkGraph);

        // 5. 应用坐标
        const layoutedNodes = initialNodes.map(node => {
          const elkNode = layoutedGraph.children?.find(n => n.id === node.id);
          const visibleProps = Math.min(node.data.properties.length, 12);
          const visibleNavs = Math.min(node.data.navigationProperties?.length || 0, 8);
          const extraHeight = ((node.data.navigationProperties?.length || 0) > 0 ? 10 : 0);
          
          return {
            ...node,
            position: { x: elkNode?.x || 0, y: elkNode?.y || 0 },
            width: 220, // 实际渲染宽度
            height: (visibleProps * 24) + (visibleNavs * 24) + extraHeight + 80 // 估算实际渲染高度
          };
        });

        // 6. 生成最终 Edge 对象 (优化路径逻辑)
        const finalEdges = rawEdges.map(e => {
            const sourceNode = layoutedNodes.find(n => n.id === e.source);
            const targetNode = layoutedNodes.find(n => n.id === e.target);
            if (!sourceNode || !targetNode) return null;

            const sx = sourceNode.position.x + sourceNode.width / 2;
            const tx = targetNode.position.x + targetNode.width / 2;
            const dx = tx - sx;
            
            let sourceHandle = 'source-right';
            let targetHandle = 'target-left';

            // 优化：垂直对齐或水平距离较近时，强制使用右侧绕行策略，避免穿过节点
            // 增加距离判定阈值
            if (Math.abs(dx) < 250) { 
                sourceHandle = 'source-right';
                targetHandle = 'target-right';
            } else if (dx > 0) {
                sourceHandle = 'source-right';
                targetHandle = 'target-left';
            } else {
                sourceHandle = 'source-left';
                targetHandle = 'target-right';
            }

            return {
                id: e.id,
                source: e.source,
                target: e.target,
                sourceHandle: sourceHandle,
                targetHandle: targetHandle,
                type: 'smoothstep',
                // 增加 pathOptions.offset 使得绕行半径更大，避免压线
                pathOptions: { borderRadius: 30, offset: 40 },
                markerEnd: { type: MarkerType.ArrowClosed, color: e.color }, 
                animated: false,
                style: { stroke: e.color, strokeWidth: 1.5, opacity: 0.8 },
                label: e.label,
                labelStyle: { fill: e.color, fontWeight: 700, fontSize: 10 },
                labelBgStyle: { fill: '#ffffff', fillOpacity: 0.7, rx: 4, ry: 4 },
                data: { label: e.label, originalColor: e.color } 
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