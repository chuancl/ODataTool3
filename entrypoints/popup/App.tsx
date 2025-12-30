import React, { useEffect, useState } from 'react';
import ReactDOM from 'react-dom/client';
import { NextUIProvider, Button, Input, Switch, Card, CardBody, Divider } from "@nextui-org/react";
import { getSettings, saveSettings, AppSettings } from '@/utils/storage';
import { Settings, ExternalLink, Plus, Trash2 } from 'lucide-react';
import { browser } from 'wxt/browser';

const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings | null>(null);
  const [newUrl, setNewUrl] = useState('');
  const [manualInput, setManualInput] = useState('');

  useEffect(() => {
    getSettings().then(setSettings);
  }, []);

  const toggleAutoDetect = (val: boolean) => {
    if (!settings) return;
    const newSettings = { ...settings, autoDetect: val };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const addToWhitelist = () => {
    if (!settings || !newUrl) return;
    const newSettings = { ...settings, whitelist: [...settings.whitelist, newUrl] };
    setSettings(newSettings);
    saveSettings(newSettings);
    setNewUrl('');
  };

  const removeFromWhitelist = (url: string) => {
    if (!settings) return;
    const newSettings = { ...settings, whitelist: settings.whitelist.filter(u => u !== url) };
    setSettings(newSettings);
    saveSettings(newSettings);
  };

  const openDashboard = (url?: string) => {
    const targetUrl = url || manualInput;
    if (targetUrl) {
      // 通过 Query Param 传递 URL 给 Dashboard
      const dashboardUrl = browser.runtime.getURL(`entrypoints/dashboard/index.html#url=${encodeURIComponent(targetUrl)}`);
      browser.tabs.create({ url: dashboardUrl });
    } else {
      const dashboardUrl = browser.runtime.getURL(`entrypoints/dashboard/index.html`);
      browser.tabs.create({ url: dashboardUrl });
    }
  };

  if (!settings) return <div className="p-4">Loading...</div>;

  return (
    <NextUIProvider>
      <div className="w-[350px] p-4 bg-background text-foreground min-h-[400px]">
        <header className="flex items-center gap-2 mb-4">
          <Settings className="w-6 h-6 text-primary" />
          <h1 className="text-xl font-bold">OData Master</h1>
        </header>

        <section className="mb-4">
          <Input 
            label="Input OData URL or $metadata" 
            size="sm" 
            value={manualInput} 
            onValueChange={setManualInput}
            className="mb-2"
          />
          <Button color="primary" fullWidth endContent={<ExternalLink size={16}/>} onClick={() => openDashboard()}>
            Parse & Visualization
          </Button>
        </section>

        <Divider className="my-4" />

        <section className="mb-4 flex justify-between items-center">
          <span className="text-sm font-medium">Auto-Detect OData</span>
          <Switch size="sm" isSelected={settings.autoDetect} onValueChange={toggleAutoDetect} />
        </section>

        <section>
          <h3 className="text-sm font-bold mb-2">Whitelist (Always Check)</h3>
          <div className="flex gap-1 mb-2">
            <Input size="sm" placeholder="Domain or URL" value={newUrl} onValueChange={setNewUrl} />
            <Button isIconOnly size="sm" color="success" onClick={addToWhitelist}><Plus size={16} /></Button>
          </div>
          <div className="flex flex-col gap-1 max-h-[150px] overflow-y-auto">
            {settings.whitelist.map((url, idx) => (
              <Card key={idx} className="w-full" shadow="sm">
                <CardBody className="p-2 flex flex-row justify-between items-center">
                  <span className="text-xs truncate max-w-[220px]">{url}</span>
                  <Button isIconOnly size="sm" variant="light" color="danger" onClick={() => removeFromWhitelist(url)}>
                    <Trash2 size={14} />
                  </Button>
                </CardBody>
              </Card>
            ))}
          </div>
        </section>
      </div>
    </NextUIProvider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<React.StrictMode><App /></React.StrictMode>);