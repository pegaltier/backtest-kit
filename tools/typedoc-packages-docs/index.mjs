/**
 * Standalone script that copies packages/*.md files with added frontmatter
 * to ./docs/packages directory.
 */

import { glob } from "glob";
import { mkdir, readFile, writeFile, rm } from "fs/promises";
import { existsSync } from "fs";
import { str } from "functools-kit";
import { join } from "path";

const OUTPUT_DIR = "./docs/packages";

const files = await glob("./packages/**/readme.md", { nodir: true, ignore: "**/node_modules/**" });

if (existsSync(OUTPUT_DIR)) {
    await rm(OUTPUT_DIR, { recursive: true });
}
await mkdir(OUTPUT_DIR, { recursive: true });

await Promise.all(files.map(async (filePath) => {
    const content = await readFile(filePath, "utf-8");

    // Extract package name from path
    const parts = filePath.replace(/\\/g, "/").split("/");
    const packagesIdx = parts.indexOf("packages");
    const packageName = parts[packagesIdx + 1] || "unknown";

    // Create output filename
    const outputName = filePath
        .replace(/\\/g, "/")
        .replace("./packages/", "")
        .replace(/\//g, "_")
        .replace(/readme\.md$/i, `${packageName}.md`);

    const outputPath = join(OUTPUT_DIR, outputName);

    // Add frontmatter if not present
    const hasFrontmatter = content.trimStart().startsWith("---");
    const newContent = hasFrontmatter
        ? content
        : str.newline(
            `---`,
            `title: packages/${packageName}/readme`,
            `group: packages/${packageName}`,
            `---`,
            ``,
            content
        );

    await writeFile(outputPath, newContent, "utf-8");
}));

console.log(`[typedoc-packages-docs] Prepared ${files.length} package docs in ${OUTPUT_DIR}`);
