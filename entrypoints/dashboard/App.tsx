import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider, Tabs, Tab, Card, CardBody, Input, Button, Chip } from "@nextui-org/react";
import { detectODataVersion, ODataVersion } from '@/utils/odata-helper';
import ODataERDiagram from '@/components/ODataERDiagram';
import QueryBuilder from '@/components/QueryBuilder';
import MockDataGenerator from '@/components/MockDataGenerator';
import { Moon, Sun } from 'lucide-react';
import '@/assets/main.css';

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
      <div className="h-screen bg-background text-foreground flex flex-col">
        {/* Top Navigation Bar */}
        <nav className="h-16 border-b border-divider px-6 flex items-center justify-between bg-content1 shrink-0">
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
                <Button size="sm" color="primary" isLoading={isValidating} onPress={() => validateAndLoad(url)}>
                  Parse
                </Button>
              }
            />
          </div>

          <Button isIconOnly variant="light" onPress={() => setIsDark(!isDark)}>
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </nav>

        {/* Main Content Area */}
        <main className="flex-1 overflow-hidden relative p-4">
          {odataVersion === 'Unknown' && !isValidating ? (
            <div className="flex flex-col items-center justify-center h-full text-default-400">
              <p>Please enter a valid OData URL and click Parse.</p>
            </div>
          ) : (
            /* 
               关键修改：使用 Flex 布局确保 Tabs 撑满高度
               base: 设为 flex flex-col h-full
               panel: 设为 flex-1 h-full overflow-hidden，强制内容区域占据剩余空间
            */
            <Tabs 
              aria-label="Features" 
              color="primary" 
              variant="underlined" 
              classNames={{
                base: "h-full flex flex-col",
                tabList: "flex-none", 
                panel: "flex-1 h-full overflow-hidden p-0 pt-2"
              }}
            >
              <Tab key="er" title="ER Diagram">
                <Card className="h-full shadow-sm">
                  <CardBody className="p-0 overflow-hidden h-full">
                     {/* ER图组件，传入URL以便内部获取Metadata解析 */}
                     <ODataERDiagram url={url} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="query" title="Query Builder">
                <Card className="h-full overflow-y-auto shadow-sm">
                  <CardBody>
                    <QueryBuilder url={url} version={odataVersion} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="mock" title="Mock Data">
                <Card className="h-full overflow-y-auto shadow-sm">
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