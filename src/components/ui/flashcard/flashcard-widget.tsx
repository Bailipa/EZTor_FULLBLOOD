"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Check, X, Loader2, Volume2, Layers, BookmarkPlus, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogTrigger, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useSession } from "next-auth/react";
import { speakText } from "@/lib/ttsBrowser";
import { IgnoredWords } from "./ignored-words";

export function FlashcardWidget() {
  const { data: session, status } = useSession();
  const [words, setWords] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [groups, setGroups] = useState<any[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string>("public");
  const [isUpdating, setIsUpdating] = useState(false);
  const [isInVocabularyBook, setIsInVocabularyBook] = useState(false);
  const [isIgnoredWordsOpen, setIsIgnoredWordsOpen] = useState(false);

  const fetchGroups = async () => {
    try {
      const res = await fetch('/api/review-groups');
      const data = await res.json();
      if (data.success && data.data) {
        setGroups(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch groups", error);
    }
  };

  const fetchWords = async (groupId: string = selectedGroupId) => {
    setIsLoading(true);
    try {
      const url = groupId === "public" 
        ? `/api/flashcard/public?limit=20&t=${Date.now()}`
        : `/api/flashcard/public?limit=20&groupId=${groupId}&t=${Date.now()}`;
        
      const res = await fetch(url);
      const data = await res.json();
      if (data.success && data.data) {
        setWords(data.data);
        setCurrentIndex(0);
        setShowAnswer(false);
      }
    } catch (error) {
      console.error("Failed to fetch words", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Only fetch words when the dialog is opened
  useEffect(() => {
    if (isOpen) {
      fetchGroups();
      fetchWords(selectedGroupId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  const handleGroupChange = (value: string) => {
    setSelectedGroupId(value);
    fetchWords(value);
  };

  const handleSaveToPrivate = async () => {
    if (!currentWord) return;
    
    // 🔧 BUG FIX: 检查登录状态
    if (status !== 'authenticated' || !session?.user) {
      // 可以使用更友好的提示方式，比如 toast
      return;
    }
    
    setIsSaving(true);
    try {
      const res = await fetch('/api/dictation/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentWord.word, isCorrect: false })
      });
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          // 可以使用更友好的提示方式，比如 toast
        } else {
          throw new Error(data.error || '添加失败');
        }
        return;
      }
      
      if (data.success) {
        setIsInVocabularyBook(true);
        // 可以使用更友好的提示方式，比如 toast
      } else {
        throw new Error(data.error || '添加失败');
      }
    } catch (e: any) {
      console.error("Failed to save word:", e);
      // 可以使用更友好的提示方式，比如 toast
    } finally {
      setIsSaving(false);
    }
  };

  const currentWord = words[currentIndex];

  useEffect(() => {
    const checkIfInVocabularyBook = async () => {
      if (!currentWord || !session?.user) {
        setIsInVocabularyBook(false);
        return;
      }
      
      try {
        // We'll need to create this API endpoint later
        const res = await fetch(`/api/flashcard/check?word=${encodeURIComponent(currentWord.word)}`);
        const data = await res.json();
        if (data.success) {
          setIsInVocabularyBook(data.isInVocabularyBook);
        }
      } catch (error) {
        console.error("Failed to check vocabulary book status:", error);
        setIsInVocabularyBook(false);
      }
    };
    
    checkIfInVocabularyBook();
  }, [currentWord, session]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setShowAnswer(false);
    }
  };

  const handleNext = async (isCorrect?: boolean) => {
    if (!currentWord) return;
    
    // If isCorrect is provided, it's from the quiz mode
    if (isCorrect !== undefined) {
      // 🔧 BUG FIX: 检查登录状态并显示错误
      if (status !== 'authenticated' || !session?.user) {
        // 未登录用户也可以继续浏览，但不记录统计
        if (currentIndex < words.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setShowAnswer(false);
        } else {
          fetchWords();
        }
        return;
      }

      setIsUpdating(true);
      try {
        const res = await fetch('/api/dictation/update', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ word: currentWord.word, isCorrect })
        });
        
        const data = await res.json();
        
        if (!res.ok) {
          if (res.status === 401) {
            console.warn("Session expired, continuing without saving stats");
          } else {
            throw new Error(data.error || '更新失败');
          }
        }
      } catch (e: any) {
        console.error("Failed to update stats:", e);
        // 不阻止用户继续，只记录错误
      } finally {
        setIsUpdating(false);
      }
    }

    // 继续下一个单词
    if (currentIndex < words.length - 1) {
      setCurrentIndex(prev => prev + 1);
      setShowAnswer(false);
    } else {
      fetchWords();
    }
  };

  const handleIgnoreWord = async () => {
    if (!currentWord) return;
    
    if (status !== 'authenticated' || !session?.user) {
      // 可以使用更友好的提示方式，比如 toast
      return;
    }
    
    try {
      const res = await fetch('/api/flashcard/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word: currentWord.word })
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        if (res.status === 401) {
          // 可以使用更友好的提示方式，比如 toast
        } else {
          throw new Error(data.error || '标记失败');
        }
        return;
      }
      
      if (data.success) {
        // 标记成功，切换到下一个单词
        if (currentIndex < words.length - 1) {
          setCurrentIndex(prev => prev + 1);
          setShowAnswer(false);
        } else {
          fetchWords();
        }
      } else {
        throw new Error(data.error || '标记失败');
      }
    } catch (e: any) {
      console.error("Failed to ignore word:", e);
      // 可以使用更友好的提示方式，比如 toast
    }
  };

  const playAudio = (text: string) => {
    speakText(text);
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogTrigger asChild>
          <Button variant="outline" className="gap-1.5 sm:gap-2 shadow-sm border-primary/20 text-primary hover:bg-primary/5 h-8 px-2.5 text-xs sm:h-9 sm:px-4 sm:text-sm">
            <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span>当然</span>
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md p-0 overflow-hidden bg-transparent border-none shadow-none">
          <DialogTitle className="sr-only">Flashcard Review</DialogTitle>
          <Card className="border-2 shadow-xl flex flex-col h-[450px] w-full relative bg-card">
            
            <div className="absolute top-2 left-2 z-20">
              <Select value={selectedGroupId} onValueChange={handleGroupChange}>
                <SelectTrigger className="h-8 w-[140px] text-xs bg-white/80 dark:bg-black/80 backdrop-blur-sm border-primary/20">
                  <SelectValue placeholder="选择复习来源" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">公共词库</SelectItem>
                  {groups.map(g => (
                    <SelectItem key={g.id} value={g.id}>{g.name} ({g._count?.ReviewGroupWord || 0})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="absolute top-2 right-10 flex gap-2 z-10">
              <Button 
                variant="outline" 
                size="icon"
                onClick={handlePrevious} 
                disabled={currentIndex === 0}
                className="h-8 w-8 bg-white/80 dark:bg-black/80 backdrop-blur-sm"
                title="上一个单词"
              >
                ←
              </Button>
              <Button 
                variant="outline" 
                size="icon"
                onClick={() => handleNext()}
                disabled={isUpdating}
                className="h-8 w-8 bg-white/80 dark:bg-black/80 backdrop-blur-sm"
                title="下一个单词"
              >
                →
              </Button>
              {currentWord && session?.user && (
                <Button 
                  variant={isInVocabularyBook ? "default" : "outline"} 
                  size="sm"
                  onClick={handleSaveToPrivate} 
                  disabled={isSaving || isInVocabularyBook}
                  className={`h-8 text-xs ${isInVocabularyBook ? 'bg-primary text-white' : 'bg-white/80 dark:bg-black/80 backdrop-blur-sm'}`}
                  title={isInVocabularyBook ? "已在生词本中" : "添加到我的生词本"}
                >
                  {isSaving ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : isInVocabularyBook ? "已添加" : <BookmarkPlus className="w-3 h-3 mr-1" />}
                  {isInVocabularyBook ? "" : "加入生词本"}
                </Button>
              )}
            </div>

            {isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : words.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
                <p className="text-sm text-muted-foreground mb-4">公共词库中暂时没有单词</p>
              </div>
            ) : (
              <>
                <div className="text-xs text-muted-foreground absolute top-3 left-3 z-10 bg-white/80 dark:bg-black/80 px-2 py-0.5 rounded-full">
                  {currentIndex + 1} / {words.length}
                </div>
                
                <CardContent className="flex-1 flex flex-col items-center justify-center p-6 relative mt-6">
                  <div className="flex items-center justify-center gap-3 w-full">
                    <h2 className="text-4xl font-bold text-gray-900 dark:text-gray-100 tracking-wide text-center break-words">
                      {currentWord.word}
                    </h2>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full h-10 w-10 hover:bg-primary/10 flex-shrink-0"
                      onClick={() => playAudio(currentWord.word)}
                    >
                      <Volume2 className="w-5 h-5 text-primary" />
                    </Button>
                  </div>

                  {currentWord.phonetic && (
                    <p className="text-sm text-muted-foreground font-mono mt-2 mb-4">[{currentWord.phonetic}]</p>
                  )}

                  <div className={`transition-all duration-300 w-full flex-1 flex flex-col justify-center items-center overflow-y-auto ${showAnswer ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'}`}>
                    {showAnswer && (
                      <div className="w-full text-center px-4 space-y-4">
                        <p className="text-lg font-medium text-gray-800 dark:text-gray-200">
                          {currentWord.translation}
                        </p>
                        
                        {currentWord.example && (
                          <div className="pt-4 border-t border-border/50 text-sm space-y-2">
                            <p className="text-gray-600 dark:text-gray-400 italic">
                              "{currentWord.example}"
                            </p>
                            {currentWord.exampleTranslation && (
                              <p className="text-gray-500 text-xs">
                                {currentWord.exampleTranslation}
                              </p>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>

                <div className="p-4 bg-gray-50/50 dark:bg-muted/10 border-t flex justify-center shrink-0">
                  {!showAnswer ? (
                    <div className="flex w-full gap-3">
                      <Button 
                        className="flex-1 h-12 text-lg" 
                        onClick={() => setShowAnswer(true)}
                      >
                        显示答案
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 text-lg border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50"
                        onClick={() => setIsIgnoredWordsOpen(true)}
                      >
                        <RefreshCw className="w-5 h-5 mr-2" />
                        再出现
                      </Button>
                    </div>
                  ) : (
                    <div className="flex w-full gap-3">
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 text-base border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/20"
                        onClick={() => handleNext(false)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <X className="w-5 h-5 mr-2" />}
                        不认识
                      </Button>
                      <Button 
                        className="flex-1 h-12 text-base bg-green-600 hover:bg-green-700 text-white"
                        onClick={() => handleNext(true)}
                        disabled={isUpdating}
                      >
                        {isUpdating ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : <Check className="w-5 h-5 mr-2" />}
                        认识
                      </Button>
                      <Button 
                        variant="outline" 
                        className="flex-1 h-12 text-base border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-700 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-800/50"
                        onClick={handleIgnoreWord}
                        disabled={isUpdating}
                      >
                        不再出现
                      </Button>
                    </div>
                  )}
                </div>
              </>
            )}
          </Card>
        </DialogContent>
      </Dialog>
      <IgnoredWords open={isIgnoredWordsOpen} onOpenChange={setIsIgnoredWordsOpen} />
    </>
  );
}
