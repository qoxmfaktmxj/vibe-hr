"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type UseGridPaginationOptions = {
  page: number;
  totalCount: number;
  pageSize: number;
  onPageChange: (page: number) => void;
};

export function useGridPagination({
  page,
  totalCount,
  pageSize,
  onPageChange,
}: UseGridPaginationOptions) {
  const [pageInput, setPageInput] = useState(String(page));

  const totalPages = useMemo(
    () => Math.max(1, Math.ceil(totalCount / pageSize)),
    [pageSize, totalCount],
  );

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  const goToPage = useCallback(
    (rawValue: string) => {
      const next = Number(rawValue || "1");
      if (!Number.isFinite(next)) return;
      onPageChange(Math.min(totalPages, Math.max(1, next)));
    },
    [onPageChange, totalPages],
  );

  const goPrev = useCallback(() => {
    onPageChange(Math.max(1, page - 1));
  }, [onPageChange, page]);

  const goNext = useCallback(() => {
    onPageChange(Math.min(totalPages, page + 1));
  }, [onPageChange, page, totalPages]);

  return {
    totalPages,
    pageInput,
    setPageInput,
    goToPage,
    goPrev,
    goNext,
  };
}
