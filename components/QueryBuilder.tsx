import React, { useState, useEffect } from 'react';
import { 
  Input, Button, Select, SelectItem, Checkbox, 
  Textarea, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure,
  Code, ScrollShadow
} from "@nextui-org/react";
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';
import { generateSAPUI5Code, ODataVersion } from '@/utils/odata-helper';
import { Copy, Play, Trash, Save } from 'lucide-react';

interface Props {
  url: string;
  version: ODataVersion;
}

const QueryBuilder: React.FC<Props> = ({ url, version }) => {
  const [entitySets, setEntitySets] = useState<string[]>([]);
  const [selectedEntity, setSelectedEntity] = useState('');
  
  // Params State
  const [filter, setFilter] = useState('');
  const [select, setSelect] = useState('');
  const [expand, setExpand] = useState('');
  const [top, setTop] = useState('20');
  const [skip, setSkip] = useState('0');
  const [count, setCount] = useState(false);
  
  // Results
  const [loading, setLoading] = useState(false);
  const [queryResult, setQueryResult] = useState<any[]>([]);
  const [rawResult, setRawResult] = useState(''); // JSON string
  const [generatedUrl, setGeneratedUrl] = useState('');

  // Modals
  const { isOpen, onOpen, onOpenChange } = useDisclosure(); // Code Gen Modal
  const [codePreview, setCodePreview] = useState('');
  const [modalAction, setModalAction] = useState<'delete'|'update'>('delete');

  // Fetch Entity Sets on load (Simplified: assume we can regex them from metadata or service doc)
  useEffect(() => {
    if(!url) return;
    fetch(url) // calling base service url often returns entity sets in V2/V4
      .then(r => r.json().catch(() => r.text())) // V2 might return XML
      .then(data => {
        // Mocking extraction for demo. In prod, parse XML/JSON properly
        // 这里为了演示，假设我们手动解析或从 metadata 解析到了 'Products', 'Orders' 等
        setEntitySets(['Products', 'Orders', 'Customers', 'Employees']); 
        setSelectedEntity('Products');
      });
  }, [url]);

  // Update Generated URL
  useEffect(() => {
    if (!selectedEntity) return;
    const baseUrl = url.endsWith('/') ? url : `${url}/`;
    const params = new URLSearchParams();
    if (filter) params.append('$filter', filter);
    if (select) params.append('$select', select);
    if (expand) params.append('$expand', expand);
    if (top) params.append('$top', top);
    if (skip) params.append('$skip', skip);
    if (count) {
      if (version === 'V4') params.append('$count', 'true');
      else params.append('$inlinecount', 'allpages');
    }
    
    setGeneratedUrl(`${baseUrl}${selectedEntity}?${params.toString()}`);
  }, [url, selectedEntity, filter, select, expand, top, skip, count, version]);

  // Execute Query
  const executeQuery = async () => {
    setLoading(true);
    try {
      const res = await fetch(generatedUrl, { headers: { 'Accept': 'application/json' }});
      const data = await res.json();
      const results = data.d?.results || data.value || (Array.isArray(data) ? data : []);
      setQueryResult(results);
      setRawResult(JSON.stringify(data, null, 2));
    } catch (e) {
      console.error(e);
      setRawResult(`Error: ${e}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate SAPUI5 Read Code
  const copyReadCode = () => {
    const code = generateSAPUI5Code('read', selectedEntity, {
      filters: filter ? [{field: 'Manual', operator: 'EQ', value: filter}] : [], // Simplified for demo
      expand, select, top, skip, inlinecount: count
    }, version);
    navigator.clipboard.writeText(code);
    alert("SAPUI5 Read Code Copied!");
  };

  // Handle Delete Button in Table
  const handleDelete = () => {
    // Generate delete code for selected rows (Mock: pick first selected)
    const code = generateSAPUI5Code('delete', selectedEntity, { key: "(ID=1)" }, version);
    setCodePreview(code);
    setModalAction('delete');
    onOpen();
  };

  // Setup TanStack Table
  const columnHelper = createColumnHelper<any>();
  const columns = queryResult.length > 0 ? Object.keys(queryResult[0]).map(key => 
    columnHelper.accessor(key, { header: key, cell: info => String(info.getValue()) })
  ) : [];

  const table = useReactTable({
    data: queryResult,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      {/* 1. Configuration Area */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border rounded-lg bg-content2">
        <Select label="Entity Set" selectedKeys={[selectedEntity]} onChange={(e) => setSelectedEntity(e.target.value)}>
          {entitySets.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
        </Select>
        <Input label="$filter" placeholder="Price gt 20" value={filter} onValueChange={setFilter} />
        <Input label="$select" placeholder="Name,Price" value={select} onValueChange={setSelect} />
        <Input label="$expand" placeholder="Category" value={expand} onValueChange={setExpand} />
        <div className="flex gap-2">
          <Input label="$top" value={top} onValueChange={setTop} />
          <Input label="$skip" value={skip} onValueChange={setSkip} />
        </div>
        <div className="flex items-center">
           <Checkbox isSelected={count} onValueChange={setCount}>Include Count</Checkbox>
        </div>
      </div>

      {/* 2. URL Bar */}
      <div className="flex gap-2">
        <Input value={generatedUrl} readOnly className="flex-1" />
        <Button isIconOnly onClick={copyReadCode} title="Copy SAPUI5 Code"><Copy size={16} /></Button>
        <Button color="primary" onClick={executeQuery} isLoading={loading} startContent={<Play size={16} />}>Run</Button>
      </div>

      {/* 3. Results Area */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 h-[500px]">
        {/* Table View */}
        <div className="border rounded-lg p-2 overflow-auto bg-content1 relative">
           <div className="sticky top-0 z-10 bg-content1 p-2 flex gap-2 border-b">
             <Button size="sm" color="danger" variant="flat" onClick={handleDelete} startContent={<Trash size={14}/>}>Delete Selected</Button>
             <Button size="sm" color="primary" variant="flat" startContent={<Save size={14}/>}>Export CSV</Button>
           </div>
           <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th key={header.id} className="border-b p-2 text-sm font-bold bg-default-100">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id} className="hover:bg-default-50">
                  {row.getVisibleCells().map(cell => (
                    <td key={cell.id} className="border-b p-2 text-sm">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
           </table>
           {queryResult.length === 0 && <div className="p-4 text-center text-default-400">No data loaded</div>}
        </div>

        {/* JSON View */}
        <div className="border rounded-lg p-0 bg-[#1e1e1e] text-white overflow-hidden flex flex-col">
          <div className="p-2 border-b border-gray-700 flex justify-between">
            <span className="text-xs font-bold">JSON Response</span>
            <Copy size={14} className="cursor-pointer" onClick={() => navigator.clipboard.writeText(rawResult)} />
          </div>
          <ScrollShadow className="flex-1 p-2">
            <pre className="text-xs font-mono whitespace-pre">{rawResult}</pre>
          </ScrollShadow>
        </div>
      </div>

      {/* Code Generation Modal */}
      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>SAPUI5 {modalAction === 'delete' ? 'Delete' : 'Update'} Code</ModalHeader>
              <ModalBody>
                <Code className="whitespace-pre-wrap">
                  {codePreview}
                </Code>
              </ModalBody>
              <ModalFooter>
                <Button color="default" variant="light" onPress={onClose}>Close</Button>
                <Button color="primary" onPress={() => { navigator.clipboard.writeText(codePreview); onClose(); }}>
                  Copy & Close
                </Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default QueryBuilder;