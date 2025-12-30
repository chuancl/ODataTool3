import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider, Tabs, Tab, Card, CardBody, Input, Button, Chip } from "@nextui-org/react";
import { detectODataVersion, ODataVersion } from '@/utils/odata-helper';
import ODataERDiagram from '@/components/ODataERDiagram';
import QueryBuilder from '@/components/QueryBuilder';
import MockDataGenerator from '@/components/MockDataGenerator';
import { Moon, Sun } from 'lucide-react';
// 使用相对路径引入样式
import '../../assets/main.css';

const App: React.FC = () => {
  // 默认开启暗黑模式，看起来更极客
  const [isDark, setIsDark] = useState(true);
  const [url, setUrl] = useState('');
  const [odataVersion, setOdataVersion] = useState<ODataVersion>('Unknown');
  const [isValidating, setIsValidating] = useState(false);

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.includes('url=')) {
      const targetUrl = decodeURIComponent(hash.split('url=')[1]);
      setUrl(targetUrl);
      validateAndLoad(targetUrl);
    }
  }, []);

  const validateAndLoad = async (targetUrl: string) => {
    if (!targetUrl) return;
    setIsValidating(true);
    const ver = await detectODataVersion(targetUrl);
    setOdataVersion(ver);
    setIsValidating(false);
  };

  const handleUrlChange = (val: string) => setUrl(val);

  return (
    <NextUIProvider>
      <div className={`${isDark ? 'dark' : ''} text-foreground bg-background h-screen w-screen flex flex-col overflow-hidden font-sans antialiased`}>
        
        {/* 顶部导航栏 */}
        <nav className="h-16 border-b border-divider px-6 flex items-center justify-between bg-content1 shrink-0 z-50 shadow-sm">
          <div className="flex items-center gap-4">
            <span className="text-2xl font-bold bg-gradient-to-r from-blue-500 to-purple-600 bg-clip-text text-transparent">
              OData Master
            </span>
            <Chip color={odataVersion === 'Unknown' ? 'default' : 'success'} variant="flat" size="sm">
              {odataVersion}
            </Chip>
          </div>
          
          <div className="flex items-center gap-4 flex-1 max-w-3xl mx-8">
            <Input 
              placeholder="Enter OData Service URL (e.g. https://services.odata.org/Northwind/Northwind.svc/)" 
              value={url}
              onValueChange={handleUrlChange}
              size="sm"
              variant="bordered"
              isClearable
              onClear={() => setUrl('')}
              endContent={
                <Button 
                  size="sm" 
                  color="primary" 
                  isLoading={isValidating} 
                  onPress={() => validateAndLoad(url)}
                  className="font-medium"
                >
                  Parse Metadata
                </Button>
              }
            />
          </div>

          <Button isIconOnly variant="light" onPress={() => setIsDark(!isDark)} className="text-default-500">
            {isDark ? <Sun size={20} /> : <Moon size={20} />}
          </Button>
        </nav>

        {/* 主内容区域 */}
        <main className="flex-1 w-full h-full relative overflow-hidden bg-content2/50 p-4">
          {odataVersion === 'Unknown' && !isValidating ? (
            <div className="flex flex-col items-center justify-center h-full text-default-400 gap-4">
              <div className="w-16 h-16 bg-content3 rounded-full flex items-center justify-center mb-4">
                <span className="text-4xl">🔍</span>
              </div>
              <p className="text-lg">Please enter a valid OData URL and click Parse to begin.</p>
              <div className="text-sm opacity-50">Supported Versions: V2, V3, V4</div>
            </div>
          ) : (
            <Tabs 
              aria-label="Features" 
              color="primary" 
              variant="underlined" 
              classNames={{
                base: "h-full w-full flex flex-col",
                tabList: "flex-none p-0 mb-4", 
                cursor: "w-full bg-primary",
                tab: "max-w-fit px-4 h-10",
                tabContent: "group-data-[selected=true]:text-primary font-medium",
                panel: "flex-1 w-full h-full p-0 overflow-hidden rounded-lg shadow-sm border border-divider bg-content1" 
              }}
            >
              <Tab key="er" title="ER Diagram" className="h-full w-full">
                <div className="h-full w-full relative">
                   <ODataERDiagram url={url} />
                </div>
              </Tab>
              <Tab key="query" title="Query Builder" className="h-full w-full">
                <div className="h-full w-full overflow-hidden">
                  <QueryBuilder url={url} version={odataVersion} />
                </div>
              </Tab>
              <Tab key="mock" title="Mock Data Generator" className="h-full w-full">
                <div className="h-full w-full overflow-hidden p-6 overflow-y-auto">
                  <MockDataGenerator url={url} version={odataVersion} />
                </div>
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