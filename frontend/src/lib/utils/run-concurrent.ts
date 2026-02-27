export type RunConcurrentResult = {
  ok: boolean;
  total: number;
  failed: number;
  errors: Error[];
};

export async function runConcurrent(
  tasks: Array<() => Promise<void>>,
  concurrency = 6,
): Promise<RunConcurrentResult> {
  if (tasks.length === 0) {
    return {
      ok: true,
      total: 0,
      failed: 0,
      errors: [],
    };
  }

  const errors: Error[] = [];
  let index = 0;

  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= tasks.length) return;

      try {
        await tasks[current]();
      } catch (error) {
        errors.push(error instanceof Error ? error : new Error(String(error)));
      }
    }
  }

  const workerCount = Math.min(concurrency, tasks.length);
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return {
    ok: errors.length === 0,
    total: tasks.length,
    failed: errors.length,
    errors,
  };
}

export async function runConcurrentOrThrow(
  label: string,
  tasks: Array<() => Promise<void>>,
  concurrency = 6,
) {
  if (tasks.length === 0) return;

  const result = await runConcurrent(tasks, concurrency);
  if (result.ok) return;

  const head = result.errors
    .slice(0, 3)
    .map((error) => error.message)
    .join(" / ");
  throw new Error(`[${label}] ${result.failed}/${result.total} 실패: ${head}`);
}
