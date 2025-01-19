// import React, { useState, useCallback } from 'react';
// import { Card } from './components/ui/card';
// import { Button } from './components/ui/button';
// import { Switch } from './components/ui/switch';
// import { Settings, FileDown, FileUp, AlertCircle, Copy, Check } from 'lucide-react';
// import { Alert, AlertDescription } from './components/ui/alert';
import { toast } from './hooks/use-toast';
import React, { useState, useCallback, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Settings, FileDown, FileUp, AlertCircle, Copy, Check } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
// import { toast } from '@/components/ui/use-toast';

const TranslationEditor = () => {
  const [format, setFormat] = useState('yaml');
  const [mode, setMode] = useState('single');
  const [data, setData] = useState({});
  const [duplicates, setDuplicates] = useState([]);
  const [draggedItem, setDraggedItem] = useState(null);
  const [copiedPaths, setCopiedPaths] = useState(new Set());
  const fileInputRef = useRef(null);

  const getValueByPath = (obj, path) => {
    return path.reduce((acc, key) => acc?.[key], obj);
  };

  const setValueByPath = (obj, path, value) => {
    const newObj = JSON.parse(JSON.stringify(obj));
    let current = newObj;
    for (let i = 0; i < path.length - 1; i++) {
      if (!(path[i] in current)) {
        current[path[i]] = {};
      }
      current = current[path[i]];
    }
    current[path[path.length - 1]] = value;
    return newObj;
  };

  const deleteByPath = (obj, path) => {
    const newObj = JSON.parse(JSON.stringify(obj));
    let current = newObj;
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]];
    }
    delete current[path[path.length - 1]];
    return newObj;
  };

  const handleDragStart = (e, path, value) => {
    setDraggedItem({ path, value });
    e.dataTransfer.setData('text/plain', path.join('.'));
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e, path) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDrop = (e, targetPath) => {
    e.preventDefault();
    if (!draggedItem) return;

    const { path: sourcePath, value } = draggedItem;
    const sourcePathStr = sourcePath.join('.');
    const targetPathStr = targetPath.join('.');

    if (sourcePathStr === targetPathStr) return;
    if (targetPathStr.startsWith(sourcePathStr + '.')) return;

    setData(prevData => {
      let newData = setValueByPath(prevData, [...targetPath, sourcePath[sourcePath.length - 1]], value);
      newData = deleteByPath(newData, sourcePath);
      return newData;
    });

    setDraggedItem(null);
    toast({
      title: "Item moved",
      description: `Moved from ${sourcePathStr} to ${targetPathStr}`,
    });
  };

  const copyScope = (path) => {
    const scopeData = getValueByPath(data, path);
    const pathStr = path.join('.');
    
    navigator.clipboard.writeText(
      format === 'yaml' 
        ? JSON.stringify(scopeData, null, 2)
        : JSON.stringify(scopeData, null, 2)
    );
    
    setCopiedPaths(prev => new Set([...prev, pathStr]));
    setTimeout(() => {
      setCopiedPaths(prev => {
        const newSet = new Set(prev);
        newSet.delete(pathStr);
        return newSet;
      });
    }, 2000);

    toast({
      title: "Scope copied",
      description: `Copied ${pathStr} to clipboard`,
    });
  };

  const renderTree = (obj, path = [], level = 0) => {
    return Object.entries(obj).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => {
      const currentPath = [...path, key];
      const pathString = currentPath.join('.');
      const isScope = typeof value === 'object' && value !== null;
      
      return (
        <div
          key={pathString}
          className="pl-4 border-l border-gray-200 dark:border-gray-700"
          style={{ marginLeft: `${level * 16}px` }}
          draggable={!isScope}
          onDragStart={(e) => handleDragStart(e, currentPath, value)}
          onDragOver={(e) => handleDragOver(e, currentPath)}
          onDrop={(e) => handleDrop(e, currentPath)}
        >
          <div className={`flex items-center gap-2 p-2 ${isScope ? 'bg-gray-50 dark:bg-gray-900' : 'hover:bg-gray-100 dark:hover:bg-gray-800'} rounded group`}>
            <span className="font-medium">{key}:</span>
            {typeof value === 'string' ? (
              <input
                type="text"
                value={value}
                onChange={(e) => {
                  setData(prevData => setValueByPath(prevData, currentPath, e.target.value));
                }}
                className="flex-1 px-2 py-1 rounded border border-gray-300 dark:border-gray-600"
              />
            ) : (
              <>
                <div className="flex-1" />
                <Button
                  variant="ghost"
                  size="sm"
                  className="opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={() => copyScope(currentPath)}
                >
                  {copiedPaths.has(pathString) ? (
                    <Check className="w-4 h-4 text-green-500" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </>
            )}
          </div>
          {isScope && renderTree(value, currentPath, level + 1)}
        </div>
      );
    });
  };

  const handleFileImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      let parsed;

      if (file.name.endsWith('.json')) {
        parsed = JSON.parse(text);
        setFormat('json');
      } else if (file.name.endsWith('.yml') || file.name.endsWith('.yaml')) {
        const yamlToJson = (yaml) => {
          const lines = yaml.split('\n');
          const result = {};
          let currentObj = result;
          let stack = [{ obj: result, indent: -2 }];
          
          for (let line of lines) {
            if (!line.trim() || line.trim().startsWith('#')) continue;
            
            const indent = line.search(/\S/);
            const [key, ...valueParts] = line.trim().split(':');
            let value = valueParts.join(':').trim();
            
            while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
              stack.pop();
            }
            
            currentObj = stack[stack.length - 1].obj;
            
            if (!value) {
              currentObj[key] = {};
              stack.push({ obj: currentObj[key], indent });
            } else {
              if (value.startsWith('"') && value.endsWith('"')) {
                value = value.slice(1, -1);
              }
              currentObj[key] = value;
            }
          }
          return result;
        };
        
        parsed = yamlToJson(text);
        setFormat('yaml');
      } else {
        throw new Error('Unsupported file format');
      }

      setData(parsed);
      toast({
        title: "File imported successfully",
        description: `Imported ${file.name}`,
      });
    } catch (error) {
      toast({
        title: "Error importing file",
        description: error.message,
        variant: "destructive",
      });
    }
    
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExport = () => {
    let content;
    let filename;
    let type;

    if (format === 'json') {
      content = JSON.stringify(data, null, 2);
      filename = 'translations.json';
      type = 'application/json';
    } else {
      const jsonToYaml = (obj, indent = 0) => {
        let yaml = '';
        const spaces = ' '.repeat(indent);
        
        for (const [key, value] of Object.entries(obj)) {
          if (typeof value === 'object' && value !== null) {
            yaml += `${spaces}${key}:\n${jsonToYaml(value, indent + 2)}`;
          } else {
            yaml += `${spaces}${key}: "${String(value)}"\n`;
          }
        }
        return yaml;
      };
      
      content = jsonToYaml(data);
      filename = 'translations.yml';
      type = 'text/yaml';
    }

    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "File exported successfully",
      description: `Saved as ${filename}`,
    });
  };

  return (
    <div className="w-full max-w-6xl mx-auto p-4 space-y-4">
      <Card className="p-4">
        <div className="flex justify-between items-center mb-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Settings className="w-4 h-4" />
              <span>Format:</span>
              <Switch
                checked={format === 'json'}
                onCheckedChange={() => setFormat(prev => prev === 'yaml' ? 'json' : 'yaml')}
              />
              <span>{format.toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-2">
              <span>Mode:</span>
              <Switch
                checked={mode === 'multi'}
                onCheckedChange={() => setMode(prev => prev === 'single' ? 'multi' : 'single')}
              />
              <span>{mode === 'single' ? 'Single File' : 'Multi File'}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <input
              type="file"
              ref={fileInputRef}
              accept=".json,.yml,.yaml"
              onChange={handleFileImport}
              className="hidden"
            />
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="w-4 h-4 mr-2" />
              Import
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={handleExport}
              disabled={Object.keys(data).length === 0}
            >
              <FileDown className="w-4 h-4 mr-2" />
              Export
            </Button>
          </div>
        </div>
        
        {duplicates.length > 0 && (
          <Alert variant="warning" className="mb-4">
            <AlertCircle className="w-4 h-4" />
            <AlertDescription>
              Found {duplicates.length} duplicate translations
            </AlertDescription>
          </Alert>
        )}
        
        <div className="border rounded-lg">
          {Object.keys(data).length > 0 ? (
            renderTree(data)
          ) : (
            <div className="p-8 text-center text-gray-500">
              Import a translation file or start adding translations
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default TranslationEditor;
