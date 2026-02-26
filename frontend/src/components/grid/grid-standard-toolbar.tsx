"use client";

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
    <div className="flex flex-wrap gap-2">
      <Button variant="query" type="button" onClick={onQuery} disabled={disabled?.query}>조회</Button>
      <Button variant="outline" type="button" onClick={onCreate} disabled={disabled?.create}>입력</Button>
      <Button variant="outline" type="button" onClick={onCopy} disabled={disabled?.copy}>복사</Button>
      <Button variant="outline" type="button" onClick={onTemplateDownload} disabled={disabled?.template}>양식다운로드</Button>
      <Button variant="outline" type="button" onClick={onUpload} disabled={disabled?.upload}>업로드</Button>
      <Button variant="save" type="button" onClick={onSave} disabled={disabled?.save}>저장</Button>
      <Button variant="outline" type="button" onClick={onDownload} disabled={disabled?.download}>다운로드</Button>
    </div>
  );
}
