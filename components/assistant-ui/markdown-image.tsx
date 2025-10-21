"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { Download, X, ZoomIn } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface MarkdownImageProps {
  src?: string;
  alt?: string;
  className?: string;
}

export function MarkdownImage({ src, alt, className }: MarkdownImageProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  if (!src) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      // 尝试通过 fetch 下载（可能因 CORS 失败）
      try {
        const response = await fetch(src);
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = alt || 'generated-image.png';
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
      } catch (fetchError) {
        // 如果 fetch 失败（CORS），直接在新标签页打开图像
        console.warn('Direct download failed, opening in new tab:', fetchError);
        const a = document.createElement('a');
        a.href = src;
        a.target = '_blank';
        a.download = alt || 'generated-image.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      console.error('Download failed:', error);
    }
  };

  return (
    <>
      {/* 缩略图 - 使用 span 而不是 div 以避免 p > div 的 hydration 错误 */}
      <span className="relative group my-4 inline-block max-w-md">
        <img
          src={src}
          alt={alt}
          className={cn(
            "rounded-lg shadow-md cursor-pointer transition-all hover:shadow-xl block",
            isLoading && "animate-pulse bg-muted",
            className
          )}
          loading="lazy"
          onLoad={() => setIsLoading(false)}
          onClick={() => setIsOpen(true)}
        />
        
        {/* 悬停时显示的操作按钮 */}
        <span className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
          <span className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              onClick={() => setIsOpen(true)}
            >
              <ZoomIn className="w-4 h-4 mr-1" />
              放大
            </Button>
            <Button
              size="sm"
              variant="secondary"
              className="shadow-lg"
              onClick={handleDownload}
            >
              <Download className="w-4 h-4 mr-1" />
              下载
            </Button>
          </span>
        </span>
      </span>

      {/* 全屏预览模态框 - 使用 Portal 渲染到 body 外，避免 HTML 结构问题 */}
      {isOpen && typeof document !== 'undefined' && createPortal(
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsOpen(false)}
        >
          <Button
            size="icon"
            variant="ghost"
            className="absolute top-4 right-4 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
          >
            <X className="w-6 h-6" />
          </Button>

          <Button
            size="sm"
            variant="secondary"
            className="absolute top-4 left-4"
            onClick={handleDownload}
          >
            <Download className="w-4 h-4 mr-2" />
            下载图像
          </Button>

          <img
            src={src}
            alt={alt}
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>,
        document.body
      )}
    </>
  );
}
