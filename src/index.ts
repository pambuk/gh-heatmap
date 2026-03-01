#!/usr/bin/env node

import { Command } from "commander";
import { fetchContributions } from "./github.js";
import { generateSvg } from "./svg.js";
import { render } from "./render.js";

const program = new Command();

program
  .name("gh-heatmap")
  .description("Display GitHub contribution heatmap in your terminal")
  .version("0.1.0")
  .argument("<username>", "GitHub username")
  .option("-t, --token <token>", "GitHub token (or set GITHUB_TOKEN env var)")
  .option("-o, --output <path>", "Save to file instead of displaying (.png or .svg)")
  .option("-w, --width <cols>", "Terminal width for display", parseInt)
  .option("--light", "Use light theme (default: dark)")
  .option("--no-labels", "Hide month/day labels")
  .option("--cell-size <px>", "Cell size in pixels", parseInt)
  .action(async (username: string, opts) => {
    try {
      const token = opts.token || process.env.GITHUB_TOKEN;

      if (!token) {
        console.error(
          "Warning: No GitHub token provided. The GraphQL API requires authentication.\n" +
            "Set GITHUB_TOKEN env var or use --token.\n" +
            "Create a token at: https://github.com/settings/tokens (no scopes needed)\n"
        );
      }

      const data = await fetchContributions(username, token);

      const svg = generateSvg(data, {
        username,
        darkMode: !opts.light,
        showLabels: opts.labels !== false,
        cellSize: opts.cellSize,
      });

      render(svg, {
        output: opts.output,
        width: opts.width,
      });
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : err}`);
      process.exit(1);
    }
  });

program.parse();
