import { describe, expect, it } from "vitest";
import { cleanMarkdownLine, reportSentences, sentenceTone } from "../src/renderer/common/report-lines.js";

describe("cleanMarkdownLine", () => {
  it.each([
    ["## Verdict: **PASS**", "Verdict: PASS"],
    ["- [x] Test `npm run lint` lulus", "Test npm run lint lulus"],
    ["3. Lihat [docs](https://example.com) dulu", "Lihat docs dulu"],
    ["| file | status |", "file, status"],
    ["|---|---|", ""],
    ["Pakai *mode* aman, snake_case_name tetap", "Pakai mode aman, snake_case_name tetap"],
  ])("cleans %j", (input, expected) => {
    // Arrange, Act
    const cleaned = cleanMarkdownLine(input);

    // Assert
    expect(cleaned).toBe(expected);
  });
});

describe("reportSentences", () => {
  it("splits bullets and sentences and skips code blocks", () => {
    // Arrange
    const report =
      "Review selesai. Dua catatan:\n\n```ts\nconst a = 1;\n```\n- Nama variabel kurang jelas.\n- Test sudah lulus!";

    // Act
    const result = reportSentences(report);

    // Assert
    expect(result).toEqual({
      sentences: ["Review selesai.", "Dua catatan:", "Nama variabel kurang jelas.", "Test sudah lulus!"],
      truncated: false,
    });
  });

  it("splits a long sentence at a comma without cutting words", () => {
    // Arrange
    const long = `${"kata ".repeat(25).trim()}, ${"lanjut ".repeat(15).trim()}.`;

    // Act
    const { sentences } = reportSentences(long);

    // Assert
    expect(sentences.length).toBeGreaterThan(1);
    expect(sentences.every((sentence) => sentence.length <= 150)).toBe(true);
    expect(sentences.join(" ").replace(/\s+/g, " ")).toBe(long);
  });

  it("marks a report the hook already cut as truncated", () => {
    // Arrange, Act
    const result = reportSentences("Semua aman. Lalu…");

    // Assert
    expect(result.truncated).toBe(true);
  });

  it("returns nothing for a report that is only code", () => {
    // Arrange, Act
    const result = reportSentences("```\nls\n```");

    // Assert
    expect(result.sentences).toEqual([]);
  });
});

describe("sentenceTone", () => {
  it.each([
    ["Semua test lulus.", "positive"],
    ["Tidak ada error di build.", "positive"],
    ["No regressions found.", "positive"],
    ["Test login gagal di CI.", "concern"],
    ["Migrasinya belum aman.", "concern"],
    ["Test tidak lulus di Windows.", "concern"],
    ["Sebaiknya tambahkan index di kolom email.", "suggestion"],
    ["Mau aku lanjut ke bagian deploy?", "question"],
    ["File yang diubah ada tiga.", "neutral"],
  ] as const)("reads %j as %s", (sentence, tone) => {
    // Arrange, Act
    const result = sentenceTone(sentence);

    // Assert
    expect(result).toBe(tone);
  });
});
