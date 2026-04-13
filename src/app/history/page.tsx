"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Volume2, ArrowLeft, Download, Trash2, Loader2, PenTool, FolderPlus, FolderOpen, Share2 } from "lucide-react";
import { ModeToggle } from "@/components/mode-toggle";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { MoreVertical, Edit2 } from "lucide-react";
import { SharePoster } from "@/components/share/SharePoster";
import { ShareImportModal } from "@/components/vocabulary/ShareImportModal";
import { speakText } from "@/lib/ttsBrowser";

export default function HistoryPage() {
  const [words, setWords] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  // Group Management State
  const [groups, setGroups] = useState<any[]>([]);
  const [currentViewGroupId, setCurrentViewGroupId] = useState<string>("all");
  const [selectedWords, setSelectedWords] = useState<string[]>([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [initialSelectedWords, setInitialSelectedWords] = useState<string[]>([]);
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);
  
  // Rename Group State
  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState("");
  const [renameValue, setRenameValue] = useState("");
  
  // Share Poster State
  const [isShareOpen, setIsShareOpen] = useState(false);
  
  // Share Import State
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const fetchWords = async (groupId: string = "all") => {
    setIsLoading(true);
    try {
      const url = groupId === "all" 
        ? `/api/history?limit=10000&t=${Date.now()}`
        : `/api/review-groups/${groupId}/words?t=${Date.now()}`;
      
      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        setWords(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch words", error);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchGroups = async () => {
    try {
      const res = await fetch(`/api/review-groups`);
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
        if (data.data.length > 0) setTargetGroupId(data.data[0].id);
      }
    } catch (error) {
      console.error("Failed to fetch groups", error);
    }
  };

  useEffect(() => {
    fetchWords(currentViewGroupId);
    fetchGroups();
  }, [currentViewGroupId]);

  const handleImportSuccess = () => {
    // Refresh words and groups after successful import
    fetchWords(currentViewGroupId);
    fetchGroups();
  };

  useEffect(() => {
    const handleMouseUp = () => setIsDraggingSelection(false);
    window.addEventListener('mouseup', handleMouseUp);
    return () => window.removeEventListener('mouseup', handleMouseUp);
  }, []);

  useEffect(() => {
    if (isDraggingSelection) {
      document.body.style.userSelect = 'none';
    } else {
      document.body.style.userSelect = '';
    }
  }, [isDraggingSelection]);

  const handleAddToGroup = async () => {
    if (selectedWords.length === 0) return;
    setIsSavingGroup(true);
    
    try {
      let groupIdToUse = targetGroupId;
      
      // If creating a new group
      if (targetGroupId === 'new') {
        if (!newGroupName.trim()) {
          alert("请输入生词本名称");
          setIsSavingGroup(false);
          return;
        }
        
        const createRes = await fetch('/api/review-groups', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: newGroupName })
        });
        const createData = await createRes.json();
        
        if (!createData.success) {
          alert(createData.error);
          setIsSavingGroup(false);
          return;
        }
        groupIdToUse = createData.data.id;
        await fetchGroups(); // Refresh groups list
      }

      // Add words to the group
      const addRes = await fetch(`/api/review-groups/${groupIdToUse}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds: selectedWords })
      });
      
      const addData = await addRes.json();
      if (addData.success) {
        alert(`成功添加 ${addData.addedCount} 个单词到复习分组！`);
        setIsGroupModalOpen(false);
        setIsSelectionMode(false);
        setSelectedWords([]);
        fetchGroups(); // Update counts
      } else {
        alert(addData.error);
      }
    } catch (error) {
      console.error("Failed to add to group", error);
      alert("添加失败，请重试");
    } finally {
      setIsSavingGroup(false);
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedWords(prev => 
      prev.includes(id) ? prev.filter(w => w !== id) : [...prev, id]
    );
  };

  const toggleSpecificSelection = (id: string, select: boolean) => {
    setSelectedWords(prev => {
      if (select && !prev.includes(id)) return [...prev, id];
      if (!select && prev.includes(id)) return prev.filter(w => w !== id);
      return prev;
    });
  };

  const handleDragStart = (index: number, id: string) => {
    if (!isSelectionMode) return;
    setIsDraggingSelection(true);
    setDragStartIndex(index);
    
    // Use functional state update to capture the exact state right before drag
    setSelectedWords(prev => {
      setInitialSelectedWords([...prev]);
      
      const newAction = !prev.includes(id);
      
      if (newAction && !prev.includes(id)) return [...prev, id];
      if (!newAction && prev.includes(id)) return prev.filter(w => w !== id);
      return prev;
    });
  };

  const handleDragEnter = (currentIndex: number) => {
    if (!isSelectionMode || !isDraggingSelection || dragStartIndex === null) return;
    
    const start = Math.min(dragStartIndex, currentIndex);
    const end = Math.max(dragStartIndex, currentIndex);
    
    const newSelection = [...initialSelectedWords];
    
    for (let i = start; i <= end; i++) {
      const id = words[i].id;
      // Invert the initial selection status of the card
      const wasSelected = initialSelectedWords.includes(id);
      
      if (wasSelected) {
        // If it was selected initially, deselect it
        const idx = newSelection.indexOf(id);
        if (idx !== -1) newSelection.splice(idx, 1);
      } else {
        // If it was not selected initially, select it
        if (!newSelection.includes(id)) newSelection.push(id);
      }
    }
    
    setSelectedWords(newSelection);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isSelectionMode || !isDraggingSelection || dragStartIndex === null) return;
    const touch = e.touches[0];
    const element = document.elementFromPoint(touch.clientX, touch.clientY);
    const card = element?.closest('[data-word-index]');
    if (card) {
      const indexStr = card.getAttribute('data-word-index');
      if (indexStr !== null) {
        handleDragEnter(parseInt(indexStr, 10));
      }
    }
  };

  const playAudio = (text: string) => {
    speakText(text);
  };

  const handleDelete = async (id: string) => {
    try {
      if (currentViewGroupId !== "all") {
        // Remove from specific group
        const res = await fetch(`/api/review-groups/${currentViewGroupId}/words?wordId=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setWords(prev => prev.filter(w => w.id !== id));
          fetchGroups(); // update counts
        }
      } else {
        // Remove from global history
        const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
        if (res.ok) {
          setWords(prev => prev.filter(w => w.id !== id));
        }
      }
    } catch (error) {
      console.error("Delete failed", error);
    } finally {
      setDeletingId(null);
    }
  };

  const handleClearAll = async () => {
    try {
      if (currentViewGroupId !== "all") {
        // Clear specific group
        const res = await fetch(`/api/review-groups/${currentViewGroupId}/words?action=clear_all`, { method: 'DELETE' });
        if (res.ok) {
          setWords([]);
          fetchGroups(); // update counts
        }
      } else {
        // Clear global history
        const res = await fetch(`/api/history?action=clear_all`, { method: 'DELETE' });
        if (res.ok) {
          setWords([]);
        }
      }
    } catch (error) {
      console.error("Clear all failed", error);
    } finally {
      setIsClearing(false);
    }
  };

  const handleBatchDelete = async () => {
    if (selectedWords.length === 0) return;
    const confirmMsg = currentViewGroupId === "all" 
      ? `确定要永久删除这 ${selectedWords.length} 个单词吗？`
      : `确定要从该分组中移除这 ${selectedWords.length} 个单词吗？`;
    
    if (!confirm(confirmMsg)) return;

    try {
      if (currentViewGroupId !== "all") {
        const res = await fetch(`/api/review-groups/${currentViewGroupId}/words?action=batch`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordIds: selectedWords })
        });
        if (res.ok) {
          setWords(prev => prev.filter(w => !selectedWords.includes(w.id)));
          setSelectedWords([]);
          setIsSelectionMode(false);
          fetchGroups();
        }
      } else {
        const res = await fetch(`/api/history?action=batch`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordIds: selectedWords })
        });
        if (res.ok) {
          setWords(prev => prev.filter(w => !selectedWords.includes(w.id)));
          setSelectedWords([]);
          setIsSelectionMode(false);
        }
      }
    } catch (error) {
      console.error("Batch delete failed", error);
    }
  };

  const handleRenameGroup = async () => {
    if (!renameValue.trim()) return;
    try {
      const res = await fetch(`/api/review-groups/${renamingGroupId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: renameValue })
      });
      const data = await res.json();
      if (data.success) {
        setIsRenameModalOpen(false);
        fetchGroups();
      } else {
        alert(data.error);
      }
    } catch (error) {
      console.error("Rename failed", error);
    }
  };

  const handleDeleteGroup = async (groupId: string) => {
    if (!confirm("确定要删除整个分组吗？分组内的单词仍会保留在您的总生词本中。")) return;
    try {
      const res = await fetch(`/api/review-groups/${groupId}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentViewGroupId === groupId) {
          setCurrentViewGroupId("all");
        }
        fetchGroups();
      }
    } catch (error) {
      console.error("Delete group failed", error);
    }
  };

  const exportToCSV = () => {
    if (words.length === 0) return;
    
    // Anki 导入常用的 CSV 格式，包含制表符或逗号分隔
    // 这里使用逗号分隔，字段如果有逗号会用双引号包裹
    const headers = ['单词', '音标', '词性', '中文释义', '英文例句', '例句翻译', '添加时间'];
    
    const escapeCSV = (str: string | null) => {
      if (!str) return '""';
      let cleanStr = str.replace(/"/g, '""').replace(/\n/g, ' ');
      if (/^[=+\-@]/.test(cleanStr)) {
        cleanStr = "'" + cleanStr;
      }
      return `"${cleanStr}"`;
    };

    const rows = words.map(w => [
      escapeCSV(w.word),
      escapeCSV(w.phonetic),
      escapeCSV(w.pos),
      escapeCSV(w.translation),
      escapeCSV(w.example),
      escapeCSV(w.exampleTranslation),
      escapeCSV(new Date(w.updatedAt).toLocaleDateString())
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\n');

    // 添加 BOM 头解决 Excel 中文乱码问题
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `我的生词本_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <main className="min-h-screen bg-gray-50/50 dark:bg-background p-6 md:p-12 transition-colors duration-300">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white dark:bg-card p-6 rounded-xl shadow-sm border border-gray-100 dark:border-border transition-colors duration-300">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="outline" size="icon" className="rounded-full">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="flex items-center gap-3">
              <div>
                <h1 className="text-2xl font-bold text-gray-900 dark:text-foreground">
                  {currentViewGroupId === "all" ? "我的生词本" : groups.find(g => g.id === currentViewGroupId)?.name || "分组"}
                </h1>
                <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">共收录 {words.length} 个词条</p>
              </div>
              
              <Select value={currentViewGroupId} onValueChange={setCurrentViewGroupId}>
                <SelectTrigger className="w-[180px] h-8 ml-4">
                  <SelectValue placeholder="切换视图" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部生词</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>
                      <div className="flex items-center justify-between w-full pr-2">
                        <span>{g.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {currentViewGroupId !== "all" && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 ml-1">
                      <MoreVertical className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setRenamingGroupId(currentViewGroupId);
                      setRenameValue(groups.find(g => g.id === currentViewGroupId)?.name || "");
                      setIsRenameModalOpen(true);
                    }}>
                      <Edit2 className="w-4 h-4 mr-2" />
                      重命名
                    </DropdownMenuItem>
                    <DropdownMenuItem 
                      className="text-red-600 focus:bg-red-50 focus:text-red-700"
                      onClick={() => handleDeleteGroup(currentViewGroupId)}
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      删除分组
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full sm:w-auto sm:justify-end mt-4 sm:mt-0">
            <ModeToggle />
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsImportModalOpen(true)}
              className="gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              密钥导入
            </Button>
            
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsShareOpen(true)}
              className="gap-1.5"
            >
              <Share2 className="w-3.5 h-3.5" />
              分享
            </Button>
            
            {isSelectionMode ? (
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in zoom-in duration-200">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (selectedWords.length === words.length) {
                      setSelectedWords([]);
                    } else {
                      setSelectedWords(words.map(w => w.id));
                    }
                  }}
                  className="px-2 sm:px-4"
                >
                  {selectedWords.length === words.length && words.length > 0 ? "取消全选" : "全选"}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsSelectionMode(false);
                    setSelectedWords([]);
                  }}
                  className="px-2 sm:px-4"
                >
                  取消
                </Button>
                <Button 
                  onClick={() => setIsGroupModalOpen(true)}
                  disabled={selectedWords.length === 0}
                  className="gap-1 sm:gap-2 bg-primary px-2 sm:px-4"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">加入分组</span> ({selectedWords.length})
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleBatchDelete}
                  disabled={selectedWords.length === 0}
                  className="gap-1 sm:gap-2 px-2 sm:px-4"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">删除</span> ({selectedWords.length})
                </Button>
              </div>
            ) : (
              <Button 
                variant="outline" 
                onClick={() => setIsSelectionMode(true)} 
                disabled={words.length === 0} 
                className="gap-1 sm:gap-2 px-2 sm:px-4"
              >
                <FolderOpen className="w-4 h-4" />
                管理分组
              </Button>
            )}

            <Link href="/dictation">
              <Button variant="outline" className="gap-1 sm:gap-2 border-primary/20 text-primary hover:bg-primary/5 px-2 sm:px-4">
                <PenTool className="w-4 h-4" />
                去默写
              </Button>
            </Link>
            <Button variant="outline" onClick={exportToCSV} disabled={words.length === 0} className="gap-1 sm:gap-2 px-2 sm:px-4">
              <Download className="w-4 h-4" />
              导出
            </Button>
            
            <AlertDialog open={isClearing} onOpenChange={setIsClearing}>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" disabled={words.length === 0} className="gap-1 sm:gap-2 px-2 sm:px-4">
                  <Trash2 className="w-4 h-4" />
                  {currentViewGroupId === "all" ? "清空" : "清空本组"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {currentViewGroupId === "all" ? "确定要清空生词本吗？" : "确定要清空该分组吗？"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {currentViewGroupId === "all" 
                      ? `此操作将永久删除您保存的所有 ${words.length} 个单词，该操作不可撤销。`
                      : `此操作将把 ${words.length} 个单词移出该分组，但单词仍会保留在您的总生词本中。`}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>取消</AlertDialogCancel>
                  <AlertDialogAction onClick={handleClearAll} className="bg-red-600 hover:bg-red-700">确定清空</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : words.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-card rounded-xl border border-gray-100 dark:border-border shadow-sm">
            <p className="text-gray-500 dark:text-muted-foreground text-lg">生词本空空如也，快去查几个单词吧！</p>
            <Link href="/">
              <Button className="mt-4">返回首页查词</Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {words.map((item, index) => (
              <Card 
                key={item.id} 
                data-word-id={item.id}
                data-word-index={index}
                className={`hover:shadow-md transition-all ${isSelectionMode ? 'cursor-pointer select-none' : ''} ${isSelectionMode && selectedWords.includes(item.id) ? 'ring-2 ring-primary border-primary bg-primary/5' : ''}`}
                onMouseDown={() => handleDragStart(index, item.id)}
                onMouseEnter={() => handleDragEnter(index)}
                onTouchStart={() => handleDragStart(index, item.id)}
                onTouchMove={handleTouchMove}
                onTouchEnd={() => setIsDraggingSelection(false)}
                onDragStart={(e) => e.preventDefault()}
              >
                <CardContent className="p-5 space-y-3 relative">
                  {isSelectionMode && (
                    <div className="absolute top-5 right-5 z-10">
                      <Checkbox 
                        checked={selectedWords.includes(item.id)}
                        onCheckedChange={() => toggleSelection(item.id)}
                        className="w-5 h-5 data-[state=checked]:bg-primary data-[state=checked]:border-primary pointer-events-none"
                      />
                    </div>
                  )}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-wrap pr-8">
                      <span className="text-lg font-bold text-primary">{item.word}</span>
                      {item.phonetic && (
                        <span className="text-xs text-gray-500 font-mono">[{item.phonetic}]</span>
                      )}
                      <button 
                        onClick={() => playAudio(item.word)}
                        onMouseDown={(e) => e.stopPropagation()}
                        className="p-1 text-gray-400 hover:text-primary hover:bg-primary/10 rounded-full transition-colors relative z-20"
                      >
                        <Volume2 size={16} />
                      </button>
                    </div>
                    {!isSelectionMode && (
                      <AlertDialog open={deletingId === item.id} onOpenChange={(open) => !open && setDeletingId(null)}>
                        <AlertDialogTrigger asChild>
                          <button 
                            onClick={() => setDeletingId(item.id)}
                            className="text-gray-300 hover:text-red-500 transition-colors"
                            title={currentViewGroupId === "all" ? "删除此单词" : "从分组中移除"}
                          >
                            <Trash2 size={16} />
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{currentViewGroupId === "all" ? "删除单词" : "从分组中移除"}</AlertDialogTitle>
                            <AlertDialogDescription>
                              确定要{currentViewGroupId === "all" ? "从生词本中永久删除" : "从当前分组中移除"} <span className="font-bold text-gray-900">"{item.word}"</span> 吗？
                              {currentViewGroupId !== "all" && " (该单词仍会保留在您的总生词本中)"}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>取消</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(item.id)} className="bg-red-600 hover:bg-red-700">确定移除</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {item.pos && <Badge variant="secondary" className="text-xs px-1.5 py-0">{item.pos}</Badge>}
                    <span className="text-sm text-gray-700 dark:text-gray-300 font-medium">{item.translation}</span>
                  </div>

                  {/* 默写统计数据 */}
                  {(item.correctCount > 0 || item.incorrectCount > 0) && (
                    <div className="flex gap-3 text-xs mt-2 p-2 bg-muted/50 rounded-md border border-border/50">
                      <span className="text-green-600 dark:text-green-500 font-medium">答对: {item.correctCount}</span>
                      <span className="text-red-600 dark:text-red-500 font-medium">答错: {item.incorrectCount}</span>
                      <span className="text-muted-foreground ml-auto">
                        正确率: {Math.round((item.correctCount / (item.correctCount + item.incorrectCount)) * 100)}%
                      </span>
                    </div>
                  )}

                  {item.example && (
                    <div className="pt-3 mt-3 border-t border-gray-100 dark:border-border space-y-2">
                      {item.example.split('\n').map((ex: string, i: number) => {
                        // Add safety check: only render if there's actual text
                        if (!ex.trim()) return null;
                        
                        const translations = item.exampleTranslation ? item.exampleTranslation.split('\n') : [];
                        const trans = translations[i] || '';
                        
                        return (
                          <div key={`ex-${i}-${item.id}`} className="space-y-1">
                            <div className="flex items-start gap-1.5">
                              <p className="text-xs text-gray-600 dark:text-gray-400 italic flex-1">"{ex}"</p>
                              <button 
                                onClick={() => playAudio(ex)}
                                className="p-0.5 text-gray-400 hover:text-primary rounded shrink-0"
                              >
                                <Volume2 size={12} />
                              </button>
                            </div>
                            {trans && (
                              <p className="text-xs text-gray-400 dark:text-gray-500">{trans}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Group Management Modal */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加到复习分组</DialogTitle>
            <DialogDescription>
              将选中的 {selectedWords.length} 个单词添加到您的复习分组中，以便针对性复习。
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {groups.length < 3 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">创建新分组</label>
                <div className="flex gap-2">
                  <Input 
                    placeholder="例如: 四级高频词汇" 
                    value={newGroupName}
                    onChange={(e) => setNewGroupName(e.target.value)}
                    onFocus={() => setTargetGroupId('new')}
                  />
                </div>
              </div>
            )}
            
            {groups.length > 0 && (
              <div className="space-y-2">
                <label className="text-sm font-medium">或选择已有分组</label>
                <Select value={targetGroupId} onValueChange={setTargetGroupId}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择分组" />
                  </SelectTrigger>
                  <SelectContent>
                    {groups.length < 3 && <SelectItem value="new">-- 创建新分组 --</SelectItem>}
                    {groups.map(g => (
                      <SelectItem key={g.id} value={g.id}>
                        {g.name} (已包含 {g._count?.words || 0} 词)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsGroupModalOpen(false)}>取消</Button>
            <Button onClick={handleAddToGroup} disabled={isSavingGroup}>
              {isSavingGroup ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
              确定添加
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Rename Group Modal */}
      <Dialog open={isRenameModalOpen} onOpenChange={setIsRenameModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>重命名分组</DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <Input 
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              placeholder="请输入新的分组名称"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRenameModalOpen(false)}>取消</Button>
            <Button onClick={handleRenameGroup}>保存</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <SharePoster open={isShareOpen} onOpenChange={setIsShareOpen} />
      
      {/* Share Import Modal */}
      <ShareImportModal 
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />
    </main>
  );
}
