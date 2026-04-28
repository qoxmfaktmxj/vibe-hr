"use client";

import { FileDown, Plus, Save, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";

type Handler = () => void;

export type GridStandardToolbarProps = {
  onQuery: Handler;
  onCreate: Handler;
  onCopy: Handler;
  onTemplateDownload: Handler;
  onUpload: Handler;
  onSave: Handler;
  onDownload: Handler;
  disabled?: Partial<Record<"query" | "create" | "copy" | "template" | "upload" | "save" | "download", boolean>>;
};

export function GridStandardToolbar(props: GridStandardToolbarProps) {
  const { onQuery, onCreate, onCopy, onTemplateDownload, onUpload, onSave, onDownload, disabled } = props;
  return (
    <div className="flex items-center justify-between border-b border-border px-3 py-2 md:px-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="query" type="button" onClick={onQuery} disabled={disabled?.query}>
          <Search size={14} />
          조회
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onCreate} disabled={disabled?.create}>
          <Plus size={14} />
          입력
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onCopy} disabled={disabled?.copy}>복사</Button>
        <Button size="sm" variant="outline" type="button" onClick={onTemplateDownload} disabled={disabled?.template}>
          <FileDown size={14} />
          양식다운로드
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onUpload} disabled={disabled?.upload}>
          <Upload size={14} />
          업로드
        </Button>
        <Button size="sm" variant="outline" type="button" onClick={onDownload} disabled={disabled?.download}>
          <FileDown size={14} />
          다운로드
        </Button>
      </div>
      <div className="flex items-center">
        <Button size="sm" variant="save" type="button" onClick={onSave} disabled={disabled?.save}>
          <Save size={14} />
          저장
        </Button>
      </div>
    </div>
  );
}
