export type ODataVersion = 'V2' | 'V3' | 'V4' | 'Unknown';

interface EntityType {
  name: string;
  keys: string[];
  properties: { name: string; type: string }[];
  // targetType is the resolved full type name (e.g. NorthwindModel.Order)
  navigationProperties: { name: string; targetType: string | null; relationship?: string }[];
}

interface Association {
  name: string;
  ends: { role: string; type: string; multiplicity: string }[];
}

// 1. OData 检测与版本识别
export const detectODataVersion = async (url: string): Promise<ODataVersion> => {
  try {
    // 简单清理 URL
    let metadataUrl = url;
    if (!url.endsWith('$metadata')) {
        metadataUrl = url.endsWith('/') ? `${url}$metadata` : `${url}/$metadata`;
    }

    const response = await fetch(metadataUrl);
    const text = await response.text();
    
    if (text.includes('Version="4.0"')) return 'V4';
    if (text.includes('Version="2.0"')) return 'V2';
    if (text.includes('Version="3.0"')) return 'V3';
    
    // 某些 V2 服务可能在 Header 里的 DataServiceVersion
    const versionHeader = response.headers.get('DataServiceVersion');
    if (versionHeader?.startsWith('2.0')) return 'V2';
    
    return 'Unknown';
  } catch (e) {
    console.error("Failed to detect OData version", e);
    return 'Unknown';
  }
};

// 2. 解析 Metadata (使用 DOMParser 替代 xml-js)
export const parseMetadataToSchema = (xmlText: string) => {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "application/xml");
  
  // 查找 Schema 节点 (处理命名空间)
  const schemas = doc.getElementsByTagName("Schema"); 
  
  if (!schemas || schemas.length === 0) return { entities: [], associations: [] };

  // 通常取第一个主要的 Schema
  const schema = schemas[0];
  const namespace = schema.getAttribute("Namespace") || "";

  const entities: EntityType[] = [];
  
  // --- Step 1: 预先解析 Associations (针对 V2/V3) ---
  // Map: FullAssociationName -> { RoleName: FullEntityType }
  const associationMap: Record<string, Record<string, string>> = {};
  
  const assocTypes = schema.getElementsByTagName("Association");
  for (let i = 0; i < assocTypes.length; i++) {
    const at = assocTypes[i];
    const name = at.getAttribute("Name");
    if (!name) continue;

    const fullName = namespace ? `${namespace}.${name}` : name;
    const roles: Record<string, string> = {};
    
    const ends = at.getElementsByTagName("End");
    for (let j = 0; j < ends.length; j++) {
        const role = ends[j].getAttribute("Role");
        const type = ends[j].getAttribute("Type");
        if (role && type) {
            roles[role] = type;
        }
    }
    associationMap[fullName] = roles;
    // 有些 metadata 使用不带命名空间的引用，做一个备用映射
    associationMap[name] = roles; 
  }

  // --- Step 2: 解析实体 ---
  const entityTypes = schema.getElementsByTagName("EntityType");

  for (let i = 0; i < entityTypes.length; i++) {
    const et = entityTypes[i];
    const name = et.getAttribute("Name") || "Unknown";
    
    // 解析 Keys
    const keys: string[] = [];
    const keyNode = et.getElementsByTagName("Key")[0];
    if (keyNode) {
        const propRefs = keyNode.getElementsByTagName("PropertyRef");
        for (let k = 0; k < propRefs.length; k++) {
            keys.push(propRefs[k].getAttribute("Name") || "");
        }
    }

    // 解析 Properties
    const properties: { name: string; type: string }[] = [];
    const props = et.getElementsByTagName("Property");
    for (let p = 0; p < props.length; p++) {
        properties.push({
            name: props[p].getAttribute("Name") || "",
            type: props[p].getAttribute("Type") || ""
        });
    }

    // 解析 NavigationProperties
    const navProps: { name: string; targetType: string | null; relationship?: string }[] = [];
    const navs = et.getElementsByTagName("NavigationProperty");
    
    for (let n = 0; n < navs.length; n++) {
        const navName = navs[n].getAttribute("Name") || "Unknown";
        const v4Type = navs[n].getAttribute("Type"); // V4 直接有 Type
        const relationship = navs[n].getAttribute("Relationship"); // V2/V3
        const toRole = navs[n].getAttribute("ToRole"); // V2/V3

        let targetType: string | null = null;

        if (v4Type) {
            // OData V4
            targetType = v4Type;
        } else if (relationship && toRole) {
            // OData V2/V3: 需要通过 Association 查找 Type
            // Relationship 通常是 "Namespace.AssociationName"
            const assocRoles = associationMap[relationship];
            if (assocRoles && assocRoles[toRole]) {
                targetType = assocRoles[toRole];
            } else {
                 // 尝试处理没有命名空间前缀的情况
                 const simpleRelName = relationship.split('.').pop();
                 if (simpleRelName && associationMap[simpleRelName] && associationMap[simpleRelName][toRole]) {
                     targetType = associationMap[simpleRelName][toRole];
                 }
            }
        }

        navProps.push({
            name: navName,
            targetType: targetType, 
            relationship: relationship || undefined
        });
    }

    entities.push({ name, keys, properties, navigationProperties: navProps });
  }

  return { entities, namespace };
};

// 3. SAPUI5 代码生成器 (保持不变)
export const generateSAPUI5Code = (
  operation: 'read' | 'create' | 'update' | 'delete',
  entitySet: string,
  params: any,
  version: ODataVersion
) => {
  const isV4 = version === 'V4';

  if (operation === 'read') {
    const { filters, sorters, expand, select, top, skip, inlinecount } = params;
    
    // 构建 Filters 代码字符串
    const filterCode = filters && filters.length > 0 
      ? `[\n    ${filters.map((f: any) => `new sap.ui.model.Filter("${f.field}", sap.ui.model.FilterOperator.${f.operator}, "${f.value}")`).join(',\n    ')}\n  ]` 
      : '[]';

    // 构建 Sorters 代码字符串
    const sorterCode = sorters && sorters.length > 0
      ? `[\n    ${sorters.map((s: any) => `new sap.ui.model.Sorter("${s.field}", ${s.descending})`).join(',\n    ')}\n  ]`
      : '[]';

    // URL 参数
    const urlParamsObj: string[] = [];
    if (expand) urlParamsObj.push(`"$expand": "${expand}"`);
    if (select) urlParamsObj.push(`"$select": "${select}"`);
    if (top) urlParamsObj.push(`"$top": ${top}`);
    if (skip) urlParamsObj.push(`"$skip": ${skip}`);
    if (inlinecount) urlParamsObj.push(isV4 ? `"$count": true` : `"$inlinecount": "allpages"`);

    return `// 带查询选项的读取 - Generated by OData Master
oModel.read("/${entitySet}", {
  filters: ${filterCode},
  sorters: ${sorterCode},
  urlParameters: {
    ${urlParamsObj.join(',\n    ')}
  },
  success: function(oData) {
    console.log("Success:", oData);
  },
  error: function(oError) {
    console.error("Error:", oError);
  }
});`;
  }

  if (operation === 'delete') {
    const key = params.key; // 假设传入的是组装好的 key 字符串 e.g. (ID=1)
    return `// 删除操作 - Generated by OData Master
oModel.remove("/${entitySet}${key}", {
  success: function() {
    console.log("Deleted successfully");
  },
  error: function(oError) {
    console.error("Delete failed:", oError);
  }
});`;
  }

  if (operation === 'update') {
    const { key, data } = params;
    return `// 更新操作 - Generated by OData Master
var oData = ${JSON.stringify(data, null, 2)};
oModel.update("/${entitySet}${key}", oData, {
  success: function() {
    console.log("Updated successfully");
  },
  error: function(oError) {
    console.error("Update failed:", oError);
  }
});`;
  }

  if (operation === 'create') {
    const { data } = params;
    return `// 新增操作 - Generated by OData Master
var oData = ${JSON.stringify(data, null, 2)};
oModel.create("/${entitySet}", oData, {
  success: function(oCreatedEntry) {
    console.log("Created successfully:", oCreatedEntry);
  },
  error: function(oError) {
    console.error("Create failed:", oError);
  }
});`;
  }

  return '// Unknown operation';
};