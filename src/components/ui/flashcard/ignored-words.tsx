"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, RefreshCw } from "lucide-react";

interface IgnoredWordsProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Word {
  word: string;
  phonetic?: string;
  translation?: string;
  example?: string;
  exampleTranslation?: string;
}

export function IgnoredWords({ open, onOpenChange }: IgnoredWordsProps) {
  const [ignoredWords, setIgnoredWords] = useState<Word[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState<string | null>(null);

  const fetchIgnoredWords = async () => {
    if (!open) return;
    
    setIsLoading(true);
    try {
      const res = await fetch('/api/flashcard/ignored');
      const data = await res.json();
      if (data.success && data.data) {
        setIgnoredWords(data.data);
      }
    } catch (error) {
      console.error("Failed to fetch ignored words:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRestoreWord = async (word: string) => {
    setIsRestoring(word);
    try {
      const res = await fetch('/api/flashcard/restore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ word })
      });
      const data = await res.json();
      if (data.success) {
        setIgnoredWords(prev => prev.filter(w => w.word !== word));
      }
    } catch (error) {
      console.error("Failed to restore word:", error);
    } finally {
      setIsRestoring(null);
    }
  };

  useEffect(() => {
    fetchIgnoredWords();
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogTitle>已忽略的单词</DialogTitle>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : ignoredWords.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-muted-foreground">暂无忽略的单词</p>
          </div>
        ) : (
          <div className="space-y-4">
            {ignoredWords.map((word) => (
              <Card key={word.word}>
                <CardContent className="p-4">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-lg">{word.word}</h3>
                      {word.phonetic && (
                        <p className="text-sm text-muted-foreground font-mono">[{word.phonetic}]</p>
                      )}
                      {word.translation && (
                        <p className="text-sm mt-1">{word.translation}</p>
                      )}
                      {word.example && (
                        <div className="mt-2 text-xs text-muted-foreground">
                          <p className="italic">"{word.example}"</p>
                          {word.exampleTranslation && (
                            <p>{word.exampleTranslation}</p>
                          )}
                        </div>
                      )}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleRestoreWord(word.word)}
                      disabled={isRestoring === word.word}
                      className="h-8"
                    >
                      {isRestoring === word.word ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <RefreshCw className="w-3 h-3 mr-1" />
                      )}
                      恢复
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}