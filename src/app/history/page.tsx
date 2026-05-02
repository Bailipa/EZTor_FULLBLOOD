"use client";

import React, { useState, useEffect, useCallback, useRef, forwardRef } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ArrowLeft, Download, Trash2, Loader2, PenTool, FolderPlus, FolderOpen, Share2, MoreVertical, Edit2 } from "lucide-react";
import { ShareImportModal } from "@/components/vocabulary/ShareImportModal";
import { GroupShareModal } from "@/components/review-group/GroupShareModal";
import WordCard, { WordData } from "@/components/vocabulary/WordCard";
import { useCrudTable } from "@/hooks/useCrudTable";

const PAGE_SIZE = 20;
const MAX_VISIBLE_WORDS = 500;

const GridList = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { 'data-testid'?: string }>(
  ({ style, children, ...props }, ref) => (
    <div
      ref={ref}
      style={{
        ...style,
        contain: 'layout style',
      }}
      {...props}
      className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 virtuoso-grid-list"
    >
      {children}
    </div>
  )
);
GridList.displayName = 'GridList';

const GridItem = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement> & { 'data-index'?: number }>(
  ({ children, style, ...props }, ref) => (
    <div
      ref={ref}
      {...props}
      style={{
        contain: 'layout style paint',
        backfaceVisibility: 'hidden',
        WebkitBackfaceVisibility: 'hidden',
        ...style,
      }}
    >
      {children}
    </div>
  )
);
GridItem.displayName = 'GridItem';

export default function HistoryPage() {
  const [words, setWords] = useState<WordData[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isClearing, setIsClearing] = useState(false);

  const [groups, setGroups] = useState<{ id: string; name: string; _count?: { ReviewGroupWord: number }; [key: string]: unknown }[]>([]);
  const [currentViewGroupId, setCurrentViewGroupId] = useState<string>("all");

  const {
    selectedIds,
    setSelectedIds,
    toggleSelection,
    clearSelection,
    isSelectionMode,
    setIsSelectionMode,
    selectedCount,
  } = useCrudTable<WordData>({
    requireAdmin: false,
    skipFetch: true,
  });

  const [isDraggingSelection, setIsDraggingSelection] = useState(false);
  const [dragStartIndex, setDragStartIndex] = useState<number | null>(null);
  const [initialSelectedSet, setInitialSelectedSet] = useState<Set<string>>(new Set());
  const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  const [targetGroupId, setTargetGroupId] = useState("");
  const [isSavingGroup, setIsSavingGroup] = useState(false);

  const [isRenameModalOpen, setIsRenameModalOpen] = useState(false);
  const [renamingGroupId, setRenamingGroupId] = useState("");
  const [renameValue, setRenameValue] = useState("");

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  const [isGroupShareModalOpen, setIsGroupShareModalOpen] = useState(false);
  const [sharingGroupId, setSharingGroupId] = useState<string>("");

  const [isDeleteGroupModalOpen, setIsDeleteGroupModalOpen] = useState(false);
  const [groupToDelete, setGroupToDelete] = useState<string>("");

  const groupIdRef = useRef(currentViewGroupId);
  groupIdRef.current = currentViewGroupId;

  const fetchWords = useCallback(async (groupId: string = "all", cursor?: string | null) => {
    const isFirstPage = !cursor;
    if (isFirstPage) {
      setIsLoading(true);
    } else {
      setIsLoadingMore(true);
    }

    try {
      let url: string;
      if (groupId === "all") {
        url = `/api/history?limit=${PAGE_SIZE}`;
        if (cursor) url += `&cursor=${cursor}`;
      } else {
        url = `/api/review-groups/${groupId}/words?limit=${PAGE_SIZE}`;
        if (cursor) url += `&cursor=${cursor}`;
      }

      const res = await fetch(url);
      const data = await res.json();
      if (data.success) {
        const newWords = data.data;
        const pagination = data.pagination;

        if (isFirstPage) {
          setWords(newWords);
        } else {
          setWords(prev => {
            const combined = [...prev, ...newWords];
            if (combined.length > MAX_VISIBLE_WORDS) {
              return combined.slice(combined.length - MAX_VISIBLE_WORDS);
            }
            return combined;
          });
        }
        setTotalCount(pagination.total);
        setHasMore(pagination.hasMore);
        setNextCursor(pagination.nextCursor);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Failed to fetch words", error);
    } finally {
      if (isFirstPage) {
        setIsLoading(false);
      } else {
        setIsLoadingMore(false);
      }
    }
  }, []);

  const fetchGroups = useCallback(async () => {
    try {
      const res = await fetch(`/api/review-groups`);
      const data = await res.json();
      if (data.success) {
        setGroups(data.data);
        if (data.data.length > 0) setTargetGroupId(data.data[0].id);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Failed to fetch groups", error);
    }
  }, []);

  useEffect(() => {
    fetchWords(currentViewGroupId);
    fetchGroups();
  }, [currentViewGroupId, fetchWords, fetchGroups]);

  const handleImportSuccess = useCallback((data?: {
    groupId: string;
    groupName: string;
    newWords: WordData[];
  }) => {
    if (data) {
      setCurrentViewGroupId(data.groupId);
      if (data.newWords.length > 0) {
        setWords(prevWords => [...data.newWords, ...prevWords]);
        setTotalCount(prev => prev + data.newWords.length);
      }
    }
    fetchGroups();
  }, [fetchGroups]);

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

  const handleDragStart = useCallback((index: number, id: string) => {
    if (!isSelectionMode) return;
    setIsDraggingSelection(true);
    setDragStartIndex(index);

    setSelectedIds(prev => {
      setInitialSelectedSet(new Set(prev));

      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, [isSelectionMode, setSelectedIds]);

  const handleDragEnter = useCallback((currentIndex: number) => {
    if (!isSelectionMode || !isDraggingSelection || dragStartIndex === null) return;

    const start = Math.min(dragStartIndex, currentIndex);
    const end = Math.max(dragStartIndex, currentIndex);

    const newSelection = new Set(initialSelectedSet);

    for (let i = start; i <= end; i++) {
      if (i >= words.length) break;
      const id = words[i].id;
      if (initialSelectedSet.has(id)) {
        newSelection.delete(id);
      } else {
        newSelection.add(id);
      }
    }

    setSelectedIds(newSelection);
  }, [isSelectionMode, isDraggingSelection, dragStartIndex, initialSelectedSet, words, setSelectedIds]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
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
  }, [isSelectionMode, isDraggingSelection, dragStartIndex, handleDragEnter]);

  const handleDelete = useCallback(async (id: string) => {
    const isGroupView = groupIdRef.current !== "all";

    setWords(prev => prev.filter(w => w.id !== id));
    setTotalCount(prev => prev - 1);
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.delete(id);
      return next;
    });

    try {
      if (isGroupView) {
        const res = await fetch(`/api/review-groups/${groupIdRef.current}/words?wordId=${id}`, { method: 'DELETE' });
        if (!res.ok) {
          fetchWords(groupIdRef.current);
        } else {
          fetchGroups();
        }
      } else {
        const res = await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
        if (!res.ok) {
          fetchWords(groupIdRef.current);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Delete failed", error);
      fetchWords(groupIdRef.current);
    } finally {
      setDeletingId(null);
    }
  }, [fetchWords, fetchGroups, setSelectedIds]);

  const handleClearAll = useCallback(async () => {
    const isGroupView = currentViewGroupId !== "all";

    setWords([]);
    setTotalCount(0);
    setSelectedIds(new Set());

    try {
      if (isGroupView) {
        const res = await fetch(`/api/review-groups/${currentViewGroupId}/words?action=clear_all`, { method: 'DELETE' });
        if (!res.ok) {
          fetchWords(currentViewGroupId);
        } else {
          fetchGroups();
        }
      } else {
        const res = await fetch(`/api/history?action=clear_all`, { method: 'DELETE' });
        if (!res.ok) {
          fetchWords(currentViewGroupId);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Clear all failed", error);
      fetchWords(currentViewGroupId);
    } finally {
      setIsClearing(false);
    }
  }, [currentViewGroupId, fetchWords, fetchGroups, setSelectedIds]);

  const handleBatchDelete = useCallback(async () => {
    if (selectedCount === 0) return;
    const isGroupView = currentViewGroupId !== "all";
    const idsToDelete = Array.from(selectedIds);

    const confirmMsg = isGroupView
      ? `确定要从该分组中移除这 ${idsToDelete.length} 个单词吗？`
      : `确定要永久删除这 ${idsToDelete.length} 个单词吗？`;

    if (!confirm(confirmMsg)) return;

    setWords(prev => prev.filter(w => !selectedIds.has(w.id)));
    setTotalCount(prev => prev - idsToDelete.length);
    setSelectedIds(new Set());
    setIsSelectionMode(false);

    try {
      if (isGroupView) {
        const res = await fetch(`/api/review-groups/${currentViewGroupId}/words?action=batch`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordIds: idsToDelete })
        });
        if (!res.ok) {
          fetchWords(currentViewGroupId);
        } else {
          fetchGroups();
        }
      } else {
        const res = await fetch(`/api/history?action=batch`, {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wordIds: idsToDelete })
        });
        if (!res.ok) {
          fetchWords(currentViewGroupId);
        }
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Batch delete failed", error);
      fetchWords(currentViewGroupId);
    }
  }, [selectedIds, selectedCount, currentViewGroupId, fetchWords, fetchGroups, setSelectedIds, setIsSelectionMode]);

  const handleAddToGroup = useCallback(async () => {
    if (selectedCount === 0) return;
    setIsSavingGroup(true);
    const selectedWords = Array.from(selectedIds);

    try {
      let groupIdToUse = targetGroupId;

      if (targetGroupId === 'new') {
        if (!newGroupName.trim()) {
          toast.error("请输入生词本名称");
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
          toast.error(createData.error);
          setIsSavingGroup(false);
          return;
        }
        groupIdToUse = createData.data.id;
        await fetchGroups();
      }

      const addRes = await fetch(`/api/review-groups/${groupIdToUse}/words`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wordIds: selectedWords })
      });

      const addData = await addRes.json();
      if (addData.success) {
        toast.success(`成功添加 ${addData.addedCount} 个单词到复习分组！`);
        setIsGroupModalOpen(false);
        setIsSelectionMode(false);
        setSelectedIds(new Set());
        fetchGroups();
      } else {
        toast.error(addData.error);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Failed to add to group", error);
      toast.error("添加失败，请重试");
    } finally {
      setIsSavingGroup(false);
    }
  }, [selectedIds, selectedCount, targetGroupId, newGroupName, fetchGroups, setSelectedIds, setIsSelectionMode]);

  const handleRenameGroup = useCallback(async () => {
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
        toast.error(data.error);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Rename failed", error);
    }
  }, [renameValue, renamingGroupId, fetchGroups]);

  const handleDeleteGroup = useCallback((groupId: string) => {
    setGroupToDelete(groupId);
    setIsDeleteGroupModalOpen(true);
  }, []);

  const confirmDeleteGroup = useCallback(async () => {
    if (!groupToDelete) return;
    try {
      const res = await fetch(`/api/review-groups/${groupToDelete}`, { method: 'DELETE' });
      if (res.ok) {
        if (currentViewGroupId === groupToDelete) {
          setCurrentViewGroupId("all");
        }
        fetchGroups();
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') console.error("Delete group failed", error);
    } finally {
      setIsDeleteGroupModalOpen(false);
      setGroupToDelete("");
    }
  }, [groupToDelete, currentViewGroupId, fetchGroups]);

  const exportToCSV = useCallback(() => {
    if (words.length === 0) return;

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

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `我的生词本_${new Date().toLocaleDateString()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [words]);

  const loadMore = useCallback(() => {
    if (hasMore && !isLoadingMore && nextCursor && words.length < MAX_VISIBLE_WORDS) {
      fetchWords(currentViewGroupId, nextCursor);
    }
  }, [hasMore, isLoadingMore, nextCursor, currentViewGroupId, fetchWords, words.length]);

  const isGroupView = currentViewGroupId !== "all";

  const renderItemContent = useCallback((index: number, item: WordData) => (
    <WordCard
      key={item.id}
      item={item}
      index={index}
      isSelectionMode={isSelectionMode}
      isSelected={selectedIds.has(item.id)}
      isDeleting={deletingId === item.id}
      isGroupView={isGroupView}
      onToggleSelection={toggleSelection}
      onDragStart={handleDragStart}
      onDragEnter={handleDragEnter}
      onTouchStart={handleDragStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={() => setIsDraggingSelection(false)}
      onSetDeletingId={setDeletingId}
      onDelete={handleDelete}
    />
  ), [isSelectionMode, selectedIds, deletingId, isGroupView, toggleSelection, handleDragStart, handleDragEnter, handleTouchMove, setDeletingId, handleDelete]);

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
                    {isGroupView ? groups.find(g => g.id === currentViewGroupId)?.name || "分组" : "我的生词本"}
                  </h1>
                  <p className="text-sm text-gray-500 dark:text-muted-foreground mt-1">共收录 {totalCount} 个词条</p>
                </div>

                <div className="flex items-center gap-2">
                  <Select value={currentViewGroupId} onValueChange={setCurrentViewGroupId}>
                    <SelectTrigger className="w-[180px] h-8">
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

                  {isGroupView && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5 h-8"
                      onClick={() => {
                        setSharingGroupId(currentViewGroupId);
                        setIsGroupShareModalOpen(true);
                      }}
                    >
                      <Share2 className="w-3.5 h-3.5" />
                      分享
                    </Button>
                  )}

                  {isGroupView && (
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

            {isSelectionMode ? (
              <div className="flex flex-wrap items-center gap-2 animate-in fade-in zoom-in duration-200">
                <Button
                  variant="outline"
                  onClick={() => {
                    if (selectedCount === words.length) {
                      setSelectedIds(new Set());
                    } else {
                      setSelectedIds(new Set(words.map(w => w.id)));
                    }
                  }}
                  className="px-2 sm:px-4"
                >
                  {selectedCount === words.length && words.length > 0 ? "取消全选" : "全选"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => clearSelection()}
                  className="px-2 sm:px-4"
                >
                  取消
                </Button>
                <Button
                  onClick={() => setIsGroupModalOpen(true)}
                  disabled={selectedCount === 0}
                  className="gap-1 sm:gap-2 bg-primary px-2 sm:px-4"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span className="hidden sm:inline">加入分组</span> ({selectedCount})
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleBatchDelete}
                  disabled={selectedCount === 0}
                  className="gap-1 sm:gap-2 px-2 sm:px-4"
                >
                  <Trash2 className="w-4 h-4" />
                  <span className="hidden sm:inline">删除</span> ({selectedCount})
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
                  {isGroupView ? "清空本组" : "清空"}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {isGroupView ? "确定要清空该分组吗？" : "确定要清空生词本吗？"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {isGroupView
                      ? `此操作将把 ${totalCount} 个单词移出该分组，但单词仍会保留在您的总生词本中。`
                      : `此操作将永久删除您保存的所有 ${totalCount} 个单词，该操作不可撤销。`}
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
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {words.map((item, index) => (
                <div key={item.id}>
                  {renderItemContent(index, item)}
                </div>
              ))}
            </div>

            {isLoadingMore && (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            )}

            {hasMore && words.length < MAX_VISIBLE_WORDS && (
              <div className="flex justify-center py-4">
                <Button variant="outline" onClick={loadMore} disabled={isLoadingMore}>
                  {isLoadingMore ? '加载中...' : '加载更多'}
                </Button>
              </div>
            )}

            {words.length >= MAX_VISIBLE_WORDS && hasMore && (
              <p className="text-center text-sm text-muted-foreground py-4">
                已显示最近 {MAX_VISIBLE_WORDS} 个单词，刷新可查看最新词条
              </p>
            )}
          </div>
        )}
      </div>

      {/* Group Management Modal */}
      <Dialog open={isGroupModalOpen} onOpenChange={setIsGroupModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加到复习分组</DialogTitle>
            <DialogDescription>
              将选中的 {selectedCount} 个单词添加到您的复习分组中，以便针对性复习。
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
                        {g.name} (已包含 {g._count?.ReviewGroupWord || 0} 词)
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

      {/* Share Import Modal */}
      <ShareImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Group Share Modal */}
      <GroupShareModal
        groupId={sharingGroupId}
        isOpen={isGroupShareModalOpen}
        onClose={() => {
          setIsGroupShareModalOpen(false);
          setSharingGroupId("");
        }}
      />

      {/* Delete Group Confirmation Modal */}
      <AlertDialog open={isDeleteGroupModalOpen} onOpenChange={setIsDeleteGroupModalOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>删除分组</AlertDialogTitle>
            <AlertDialogDescription>
              确定要删除整个分组吗？分组内的单词仍会保留在您的总生词本中。
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteGroup} className="bg-red-600 hover:bg-red-700">确定删除</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
