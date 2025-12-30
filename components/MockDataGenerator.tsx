import React, { useState } from 'react';
import { Button, Input, Select, SelectItem, Card, CardBody, Modal, ModalContent, ModalHeader, ModalBody, ModalFooter, useDisclosure, Code } from "@nextui-org/react";
import { faker } from '@faker-js/faker';
import { ODataVersion, generateSAPUI5Code } from '@/utils/odata-helper';
import { useReactTable, getCoreRowModel, flexRender, createColumnHelper } from '@tanstack/react-table';

interface Props {
  url: string;
  version: ODataVersion;
}

const MockDataGenerator: React.FC<Props> = ({ url, version }) => {
  const [count, setCount] = useState('5');
  const [mockData, setMockData] = useState<any[]>([]);
  const { isOpen, onOpen, onOpenChange } = useDisclosure();
  const [generatedCode, setGeneratedCode] = useState('');

  const generateData = () => {
    const num = parseInt(count) || 5;
    const newData = Array.from({ length: num }).map((_, i) => ({
      ID: i + 1,
      Name: faker.commerce.productName(),
      Price: faker.commerce.price(),
      Description: faker.commerce.productDescription(),
      CreatedDate: faker.date.recent().toISOString()
    }));
    setMockData(newData);
  };

  const handleGenerateCode = () => {
    if (mockData.length === 0) return;
    const code = generateSAPUI5Code('create', 'Products', { data: mockData[0] }, version);
    setGeneratedCode(code);
    onOpen();
  };

  const columnHelper = createColumnHelper<any>();
  const columns = mockData.length > 0 ? Object.keys(mockData[0]).map(key => 
    columnHelper.accessor(key, { header: key })
  ) : [];

  const table = useReactTable({
    data: mockData,
    columns,
    getCoreRowModel: getCoreRowModel(),
  });

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardBody className="flex flex-row gap-4 items-end">
          <Input label="Quantity" type="number" value={count} onValueChange={setCount} className="max-w-[150px]" />
          <Button color="primary" onPress={generateData}>Generate Mock Data</Button>
          <Button color="secondary" isDisabled={mockData.length === 0} onPress={handleGenerateCode}>
            Generate SAPUI5 Create Code
          </Button>
        </CardBody>
      </Card>

      <div className="border rounded-lg p-4 bg-content1 min-h-[300px]">
        {mockData.length > 0 ? (
          <table className="w-full text-left border-collapse">
            <thead>
              {table.getHeaderGroups().map(hg => (
                <tr key={hg.id}>
                  {hg.headers.map(h => <th key={h.id} className="border-b p-2 bg-default-100">{flexRender(h.column.columnDef.header, h.getContext())}</th>)}
                </tr>
              ))}
            </thead>
            <tbody>
              {table.getRowModel().rows.map(row => (
                <tr key={row.id}>
                  {row.getVisibleCells().map(cell => <td key={cell.id} className="border-b p-2">{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center text-default-400 mt-10">Click Generate to preview data</div>
        )}
      </div>

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="2xl">
        <ModalContent>
          {(onClose) => (
            <>
              <ModalHeader>SAPUI5 Create Code</ModalHeader>
              <ModalBody>
                <Code className="whitespace-pre-wrap">{generatedCode}</Code>
              </ModalBody>
              <ModalFooter>
                <Button color="primary" onPress={onClose}>Close</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
};

export default MockDataGenerator;