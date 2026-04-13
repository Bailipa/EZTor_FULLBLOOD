"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckIcon, XIcon, Loader2, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ValidationResult {
  valid: boolean;
  error?: string;
  message?: string;
  data?: {
    code: string;
    name: string;
    description: string | null;
    wordCount: number;
    shareType: string;
    expiresAt: string | null;
    maxUses: number | null;
    usedCount: number;
    creator: string;
  };
}

interface ShareCodeInputProps {
  value: string;
  onChange: (value: string) => void;
  onValidate: (code: string) => Promise<ValidationResult>;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  showLabel?: boolean;
  label?: string;
}

interface ValidationState {
  isValidating: boolean;
  isValid: boolean | null;
  error: string | null;
  message: string | null;
  data: ValidationResult["data"] | null;
}

const SHARE_CODE_REGEX = /^[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}-[A-HJ-NP-Z2-9]{3}$/;

/**
 * 自定义 Hook：分享密钥验证
 * 实现防抖验证，避免频繁请求 API
 * 参考 AI_DEVELOPMENT_SPEC.md Section 9.3
 */
export function useShareCodeValidation(
  onValidate: (code: string) => Promise<ValidationResult>,
  debounceMs: number = 500
) {
  const [validationState, setValidationState] = useState<ValidationState>({
    isValidating: false,
    isValid: null,
    error: null,
    message: null,
    data: null,
  });

  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  const cleanup = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  const validate = useCallback(
    async (code: string) => {
      cleanup();

      // 如果密钥为空或格式不正确，立即重置状态
      if (!code || code.length < 11 || !SHARE_CODE_REGEX.test(code)) {
        setValidationState({
          isValidating: false,
          isValid: null,
          error: null,
          message: null,
          data: null,
        });
        return;
      }

      // 设置验证中状态
      setValidationState((prev) => ({
        ...prev,
        isValidating: true,
        error: null,
      }));

      // 防抖：延迟验证
      timeoutRef.current = setTimeout(async () => {
        try {
          const result = await onValidate(code);

          setValidationState({
            isValidating: false,
            isValid: result.valid,
            error: result.error || null,
            message: result.message || null,
            data: result.data || null,
          });
        } catch (error) {
          setValidationState({
            isValidating: false,
            isValid: false,
            error: "验证失败，请稍后重试",
            message: null,
            data: null,
          });
        }
      }, debounceMs);
    },
    [onValidate, debounceMs, cleanup]
  );

  const resetValidation = useCallback(() => {
    cleanup();
    setValidationState({
      isValidating: false,
      isValid: null,
      error: null,
      message: null,
      data: null,
    });
  }, [cleanup]);

  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    validationState,
    validate,
    resetValidation,
  };
}

/**
 * 格式化分享密钥
 * 自动添加连字符，限制长度
 */
export function formatShareCode(value: string): string {
  const cleaned = value.replace(/[^a-zA-Z0-9-]/g, "").toUpperCase();
  const parts = cleaned.split("-");
  const formattedParts = parts.map((part) => part.slice(0, 3));
  return formattedParts.join("-").slice(0, 11);
}

/**
 * 验证分享密钥格式
 */
export function isValidShareCodeFormat(code: string): boolean {
  return SHARE_CODE_REGEX.test(code);
}

/**
 * ShareCodeInput 组件
 * 带实时验证的分享密钥输入框
 * 
 * 功能特性：
 * - 自动格式化：ABC-123-XYZ 格式
 * - 实时验证：500ms 防抖
 * - 状态显示：验证中/有效/无效
 * - 错误提示：清晰的错误信息
 */
export function ShareCodeInput({
  value,
  onChange,
  onValidate,
  placeholder = "ABC-123-XYZ",
  disabled = false,
  className,
  showLabel = true,
  label = "分享密钥",
}: ShareCodeInputProps) {
  const { validationState, validate } = useShareCodeValidation(onValidate);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const formatted = formatShareCode(e.target.value);
      onChange(formatted);
      validate(formatted);
    },
    [onChange, validate]
  );

  const getStatusColor = () => {
    if (validationState.isValidating) return "text-blue-500";
    if (validationState.isValid === true) return "text-green-600";
    if (validationState.isValid === false) return "text-destructive";
    return "text-muted-foreground";
  };

  const getStatusIcon = () => {
    if (validationState.isValidating) {
      return <Loader2 className={cn("size-4 animate-spin", getStatusColor())} />;
    }
    if (validationState.isValid === true) {
      return <CheckIcon className={cn("size-4", getStatusColor())} />;
    }
    if (validationState.isValid === false) {
      return <XIcon className={cn("size-4", getStatusColor())} />;
    }
    return null;
  };

  const getValidationMessage = () => {
    if (validationState.isValidating) {
      return "验证中...";
    }
    if (validationState.isValid === true) {
      return `密钥有效：${validationState.data?.wordCount} 个单词`;
    }
    if (validationState.isValid === false) {
      return validationState.message || validationState.error || "密钥无效";
    }
    return null;
  };

  return (
    <div className={cn("space-y-2", className)}>
      {showLabel && <Label htmlFor="share-code-input">{label}</Label>}
      
      <div className="relative">
        <Input
          id="share-code-input"
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          maxLength={11}
          disabled={disabled}
          className={cn(
            "font-mono uppercase tracking-wider pr-10",
            validationState.isValid === true && "border-green-600 focus-visible:border-green-600",
            validationState.isValid === false && "border-destructive focus-visible:border-destructive"
          )}
        />
        
        <div className="absolute right-3 top-1/2 -translate-y-1/2">
          {getStatusIcon()}
        </div>
      </div>

      {getValidationMessage() && (
        <div
          className={cn(
            "flex items-center gap-2 text-xs",
            getStatusColor()
          )}
        >
          {validationState.isValid === false && (
            <AlertCircle className="size-3" />
          )}
          <span>{getValidationMessage()}</span>
        </div>
      )}
    </div>
  );
}

/**
 * 简化的验证 Hook（不使用 API）
 * 仅验证格式，不调用后端
 */
export function useShareCodeFormatValidation() {
  const [isValidFormat, setIsValidFormat] = useState(false);

  const validateFormat = useCallback((code: string) => {
    const valid = isValidShareCodeFormat(code);
    setIsValidFormat(valid);
    return valid;
  }, []);

  return {
    isValidFormat,
    validateFormat,
  };
}
