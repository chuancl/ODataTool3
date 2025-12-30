import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider, Tabs, Tab, Card, CardBody, Input, Button, Chip } from "@nextui-org/react";
import { detectODataVersion, ODataVersion } from '@/utils/odata-helper';
import ODataERDiagram from '@/components/ODataERDiagram';
import QueryBuilder from '@/components/QueryBuilder';
import MockDataGenerator from '@/components/MockDataGenerator';
import { Moon, Sun } from 'lucide-react';

const App: React.FC = () => {
  const [isDark, setIsDark] = useState(false);
  const [url, setUrl] = useState('');
  const [odataVersion, setOdataVersion] = useState<ODataVersion>('Unknown');
  const [isValidating, setIsValidating] = useState(false);

  // 初始化从 Hash 读取 URL
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('url=')) {
      const targetUrl = decodeURIComponent(hash.split('url=')[1]);
      setUrl(targetUrl);
      validateAndLoad(targetUrl);
    }
  }, []);

  const validateAndLoad = async (targetUrl: string) => {
    setIsValidating(true);
    const ver = await detectODataVersion(targetUrl);
    setOdataVersion(ver);
    setIsValidating(false);
  };

  const handleUrlChange = (val: string) => setUrl(val);

  return (
    <NextUIProvider className={`${isDark ? 'dark' : ''} h-full`}>
      <div className="min-h-screen bg-background text-foreground flex flex-col">
        {/* Top Navigation Bar */}
        <nav className="h-16 border-b border-divider px-6 flex items-center justify-between bg-content1">
          <div className="flex items-center gap-4">
            <span className="text-xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              OData Master
            </span>
            <Chip color={odataVersion === 'Unknown' ? 'default' : 'success'} variant="flat">
              {odataVersion}
            </Chip>
          </div>
          
          <div className="flex items-center gap-4 flex-1 max-w-2xl mx-8">
            <Input 
              placeholder="https://services.odata.org/Northwind/Northwind.svc/" 
              value={url}
              onValueChange={handleUrlChange}
              size="sm"
              variant="bordered"
              endContent={
                <Button size="sm" color="primary" isLoading={isValidating} onClick={() => validateAndLoad(url)}>
                  Parse
                </Button>
              }
            />
          </div>

          <Button isIconOnly variant="light" onClick={() => setIsDark(!isDark)}>
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 p-4 overflow-hidden">
          {odataVersion === 'Unknown' && !isValidating ? (
            <div className="flex flex-col items-center justify-center h-full text-default-400">
              <p>Please enter a valid OData URL and click Parse.</p>
            </div>
          ) : (
            <Tabs aria-label="Features" color="primary" variant="underlined" className="h-full">
              <Tab key="er" title="ER Diagram">
                <Card className="h-[calc(100vh-140px)] shadow-sm">
                  <CardBody className="p-0 overflow-hidden">
                     {/* ER图组件，传入URL以便内部获取Metadata解析 */}
                     <ODataERDiagram url={url} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="query" title="Query Builder">
                <Card className="h-[calc(100vh-140px)] overflow-y-auto shadow-sm">
                  <CardBody>
                    <QueryBuilder url={url} version={odataVersion} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="mock" title="Mock Data">
                <Card className="h-[calc(100vh-140px)] overflow-y-auto shadow-sm">
                  <CardBody>
                    <MockDataGenerator url={url} version={odataVersion} />
                  </CardBody>
                </Card>
              </Tab>
            </Tabs>
          )}
        </main>
      </div>
    </NextUIProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);