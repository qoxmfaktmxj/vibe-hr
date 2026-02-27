export type TraRowStatus = "clean" | "added" | "updated" | "deleted";

export type TraResourceRow = {
  id: number;
  _status: TraRowStatus;
  _original?: Record<string, unknown>;
  _prevStatus?: TraRowStatus;
  [key: string]: unknown;
};

export type TraResourceListResponse = {
  items: Record<string, unknown>[];
  total_count: number;
};

export type TraResourceBatchPayload = {
  items: Record<string, unknown>[];
};

export type TraResourceBatchResponse = {
  created: number;
  updated: number;
  deleted: number;
};

export type TraGenerationResponse = {
  processed: number;
  message: string;
};

export type TraColumnType = "text" | "number" | "boolean" | "date";

export type TraColumnConfig = {
  field: string;
  headerName: string;
  type?: TraColumnType;
  minWidth?: number;
  width?: number;
  flex?: number;
  editable?: boolean;
  required?: boolean;
};

export type TraSearchFieldConfig = {
  key: string;
  placeholder: string;
};

export type TraScreenConfig = {
  title: string;
  resource: string;
  searchFields: TraSearchFieldConfig[];
  columns: TraColumnConfig[];
  defaultRow: Record<string, unknown>;
};
