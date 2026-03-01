import { Resvg } from "@resvg/resvg-js";
import { execFileSync } from "node:child_process";
import { writeFileSync, unlinkSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface RenderOptions {
  /** Save PNG to this path instead of displaying */
  output?: string;
  /** Terminal width hint for chafa */
  width?: number;
}

function svgToPng(svg: string): Buffer {
  const resvg = new Resvg(svg, {
    fitTo: { mode: "width", value: 1200 },
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

function hasChafa(): boolean {
  try {
    execFileSync("chafa", ["--version"], { stdio: "pipe" });
    return true;
  } catch {
    return false;
  }
}

function displayWithChafa(pngBuffer: Buffer, width?: number): void {
  const tmpPath = join(tmpdir(), `gh-heatmap-${Date.now()}.png`);
  try {
    writeFileSync(tmpPath, pngBuffer);
    const args = [tmpPath, "--animate=off"];
    if (width) {
      args.push(`--size=${width}x`);
    }
    const output = execFileSync("chafa", args, {
      encoding: "utf-8",
      maxBuffer: 10 * 1024 * 1024,
    });
    process.stdout.write(output);
  } finally {
    if (existsSync(tmpPath)) unlinkSync(tmpPath);
  }
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function saveFallbackPng(pngBuffer: Buffer, reason: "missing" | "failed", err?: unknown): void {
  const fallbackPath = join(process.cwd(), "gh-heatmap.png");
  writeFileSync(fallbackPath, pngBuffer);

  const reasonLine =
    reason === "missing"
      ? "chafa not found"
      : `chafa failed at runtime (${errorMessage(err)})`;

  console.error(
    `${reasonLine} — saved image to gh-heatmap.png\n` +
      "Install chafa for terminal display:\n" +
      "  brew install chafa        # macOS\n" +
      "  apt install chafa         # Debian/Ubuntu\n" +
      "  pacman -S chafa           # Arch\n"
  );
}

export function render(svg: string, options: RenderOptions = {}): void {
  const png = svgToPng(svg);

  if (options.output) {
    if (options.output.endsWith(".svg")) {
      writeFileSync(options.output, svg);
      console.error(`Saved SVG to ${options.output}`);
    } else {
      writeFileSync(options.output, png);
      console.error(`Saved PNG to ${options.output}`);
    }
    return;
  }

  // Try chafa for terminal display
  if (hasChafa()) {
    try {
      displayWithChafa(png, options.width);
    } catch (err) {
      saveFallbackPng(png, "failed", err);
    }
    return;
  }

  // Fallback: save to file and tell user
  saveFallbackPng(png, "missing");
}
