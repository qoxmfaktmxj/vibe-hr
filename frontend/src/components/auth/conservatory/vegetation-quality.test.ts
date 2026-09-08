import { describe, expect, it } from "vitest";
import { selectVegetationCount } from "./vegetation-quality";

describe("식생 품질 선택", () => {
  it.each([
    ["여유 있는 RTX PC", false, "ANGLE (NVIDIA, NVIDIA GeForce RTX 4060 Laptop GPU)", 12, 8, 48000],
    ["여유 있는 Radeon PC", false, "AMD Radeon RX 7800 XT", 12, 16, 48000],
    ["Intel 기본 GPU", false, "ANGLE (Intel, Intel UHD Graphics 630)", 12, 16, 30000],
    ["Intel Iris 내장 GPU", false, "Intel Iris Xe Graphics", 12, 16, 30000],
    ["GPU 정보 비공개", false, "", 12, 16, 30000],
    ["실제 모바일 또는 좁은 화면", true, "NVIDIA GeForce RTX 4060", 12, 8, 30000],
    ["CPU 여유가 적은 PC", false, "NVIDIA GeForce RTX 4060", 4, 8, 30000],
    ["메모리가 적은 PC", false, "NVIDIA GeForce RTX 4060", 12, 4, 30000],
    ["메모리 정보를 제공하지 않는 PC", false, "NVIDIA GeForce RTX 4060", 12, undefined, 48000],
  ] as const)("%s", (_name, mobile, renderer, logicalCores, memoryGb, expected) => {
    expect(selectVegetationCount({ mobile, renderer, logicalCores, memoryGb })).toBe(expected);
  });
});
