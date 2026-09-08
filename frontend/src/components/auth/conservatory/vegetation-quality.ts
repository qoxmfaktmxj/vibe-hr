export const LOW_VEGETATION_COUNT = 30_000;
export const HIGH_VEGETATION_COUNT = 48_000;

export function selectVegetationCount(device: {
  mobile: boolean;
  renderer: string;
  logicalCores: number;
  memoryGb?: number;
}): number {
  if (device.mobile || device.logicalCores < 8 || (device.memoryGb ?? 8) < 8) return LOW_VEGETATION_COUNT;
  // GPU 정보가 없거나 내장 GPU인 경우에는 보수적인 기본값을 사용한다.
  const discreteGpu = /NVIDIA.*(?:RTX|GTX)|(?:AMD|ATI|Radeon).*RX\s*\d/i.test(device.renderer);
  return discreteGpu ? HIGH_VEGETATION_COUNT : LOW_VEGETATION_COUNT;
}
