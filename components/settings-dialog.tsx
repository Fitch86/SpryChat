"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Settings as SettingsIcon, RotateCcw } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useSettings, type Settings } from "@/hooks/use-settings.tsx";
import { useI18n } from "@/hooks/use-i18n";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface SettingsDialogProps {
  children?: React.ReactNode;
}

export function SettingsDialog({ children }: SettingsDialogProps) {
  const { settings, updateSettings, resetSettings } = useSettings();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [tempSettings, setTempSettings] = useState<Settings>(settings);

  const handleOpen = (isOpen: boolean) => {
    setOpen(isOpen);
    if (isOpen) {
      setTempSettings(settings);
    }
  };

  const handleSave = () => {
    console.log('[SettingsDialog] Saving settings - apiKey:', tempSettings.apiKey?.substring(0, 8) + '...', 'baseURL:', tempSettings.baseURL);
    updateSettings(tempSettings);
    
    // Small delay to ensure settings are updated before notifying
    setTimeout(() => {
      // Notify listeners (e.g., ModelSelector) to refresh derived data once
      try {
        if (typeof window !== 'undefined') {
          console.log('[SettingsDialog] Dispatching settings-saved event');
          window.dispatchEvent(new Event('sprychat:settings-saved'));
        }
      } catch {}
    }, 100);
    
    setOpen(false);
  };

  const handleReset = () => {
    resetSettings();
    setTempSettings({
      apiKey: "",
      baseURL: "https://openrouter.ai/api/v1",
      model: "gpt-4o",
      language: "zh",
      theme: "light",
      showAllModels: false,
    });
  };

  const updateTempSettings = (key: keyof Settings, value: string | boolean) => {
    setTempSettings(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button variant="ghost" size="icon">
            <SettingsIcon className="h-4 w-4" />
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{t('settingsTitle')}</DialogTitle>
          <DialogDescription>
            {t('settingsDescription')}
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="api" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="api">{t('apiConfig')}</TabsTrigger>
            <TabsTrigger value="appearance">{t('appearance')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('advanced')}</TabsTrigger>
          </TabsList>

          <TabsContent value="api" className="space-y-4 min-h-[300px]">
            <div className="space-y-2">
              <Label htmlFor="apiKey">{t('apiKey')}</Label>
              <Input
                id="apiKey"
                type="password"
                placeholder={t('apiKeyPlaceholder')}
                value={tempSettings.apiKey}
                onChange={(e) => updateTempSettings("apiKey", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="baseURL">{t('baseURL')}</Label>
              <Input
                id="baseURL"
                placeholder="https://openrouter.ai/api/v1"
                value={tempSettings.baseURL}
                onChange={(e) => updateTempSettings("baseURL", e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">{t('defaultModel')}</Label>
              <Input
                id="model"
                placeholder="gpt-4o"
                value={tempSettings.model}
                onChange={(e) => updateTempSettings("model", e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                {t('modelListNote')}
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="showAllModels"
                  checked={tempSettings.showAllModels}
                  onCheckedChange={(checked) => updateTempSettings("showAllModels", checked as boolean)}
                />
                <Label htmlFor="showAllModels" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                  显示所有模型
                </Label>
              </div>
              <p className="text-xs text-muted-foreground">
                默认只显示免费模型，开启后显示所有可用模型（包括收费模型）
              </p>
            </div>
          </TabsContent>

          <TabsContent value="appearance" className="space-y-4 min-h-[300px]">
            <div className="space-y-2">
              <Label htmlFor="language">{t('language')}</Label>
              <Select
                value={tempSettings.language}
                onValueChange={(value: "zh" | "en") => updateTempSettings("language", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="zh">中文</SelectItem>
                  <SelectItem value="en">English</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="theme">{t('theme')}</Label>
              <Select
                value={tempSettings.theme}
                onValueChange={(value: "light" | "dark") => updateTempSettings("theme", value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="light">{t('lightTheme')}</SelectItem>
                  <SelectItem value="dark">{t('darkTheme')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </TabsContent>

          <TabsContent value="advanced" className="space-y-4 min-h-[300px]">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium">{t('version')}</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  SpryChat v1.0.2
                </div>
              </div>
              
              <div>
                <Label className="text-sm font-medium">{t('about')}</Label>
                <div className="text-sm text-muted-foreground mt-1">
                  {t('language') === 'zh' 
                    ? '基于 Next.js 和 Assistant UI 构建的轻量级 AI 聊天工具'
                    : 'A lightweight AI chat tool built with Next.js and Assistant UI'
                  }
                </div>
              </div>

              <div className="space-y-2 pt-4 border-t">
                <Label>{t('resetSettings')}</Label>
                <p className="text-sm text-muted-foreground">
                  {t('resetDescription')}
                </p>
                <Button
                  variant="outline"
                  onClick={handleReset}
                  className="w-full"
                >
                  {t('reset')}
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            {t('cancel')}
          </Button>
          <Button onClick={handleSave}>{t('save')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
