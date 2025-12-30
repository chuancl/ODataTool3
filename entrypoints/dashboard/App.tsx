import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { HeroUIProvider, Tabs, Tab, Card, CardBody, Input, Button, Chip } from "@heroui/react";
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
    if (!targetUrl) return;
    setIsValidating(true);
    const ver = await detectODataVersion(targetUrl);
    setOdataVersion(ver);
    setIsValidating(false);
  };

  const handleUrlChange = (val: string) => setUrl(val);

  return (
    <HeroUIProvider>
      {/* 
         外层容器：负责控制暗黑模式类名 (dark) 和全屏布局 
         overflow-hidden 防止页面出现双重滚动条
      */}
      <div className={`${isDark ? 'dark' : ''} text-foreground bg-background h-screen w-screen flex flex-col overflow-hidden`}>
        
        {/* 顶部导航栏 */}
        <nav className="h-16 border-b border-divider px-6 flex items-center justify-between bg-content1 shrink-0 z-50">
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
                <Button 
                  size="sm" 
                  color="primary" 
                  isLoading={isValidating} 
                  onPress={() => validateAndLoad(url)}
                >
                  Parse
                </Button>
              }
            />
          </div>

          <Button isIconOnly variant="light" onPress={() => setIsDark(!isDark)}>
            {isDark ? <Sun /> : <Moon />}
          </Button>
        </nav>

        {/* 主内容区域 */}
        <main className="flex-1 w-full h-full relative overflow-hidden bg-content2/50 p-4">
          {odataVersion === 'Unknown' && !isValidating ? (
            <div className="flex flex-col items-center justify-center h-full text-default-400">
              <p>Please enter a valid OData URL and click Parse.</p>
            </div>
          ) : (
            <Tabs 
              aria-label="Features" 
              color="primary" 
              variant="underlined" 
              classNames={{
                base: "h-full w-full flex flex-col",
                tabList: "flex-none p-0", 
                panel: "flex-1 w-full h-full p-0 pt-2 overflow-hidden" // 确保 Tab 面板占满剩余高度
              }}
            >
              <Tab key="er" title="ER Diagram" className="h-full w-full">
                <Card className="h-full w-full shadow-sm" radius="sm">
                  <CardBody className="p-0 overflow-hidden h-full w-full relative">
                     <ODataERDiagram url={url} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="query" title="Query Builder" className="h-full w-full">
                <Card className="h-full w-full shadow-sm" radius="sm">
                  <CardBody className="h-full overflow-y-auto p-4">
                    <QueryBuilder url={url} version={odataVersion} />
                  </CardBody>
                </Card>
              </Tab>
              <Tab key="mock" title="Mock Data" className="h-full w-full">
                <Card className="h-full w-full shadow-sm" radius="sm">
                  <CardBody className="h-full overflow-y-auto p-4">
                    <MockDataGenerator url={url} version={odataVersion} />
                  </CardBody>
                </Card>
              </Tab>
            </Tabs>
          )}
        </main>
      </div>
    </HeroUIProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);