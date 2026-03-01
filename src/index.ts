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
  .option("--verbose", "Show debug info about the data fetched")
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

      const result = await fetchContributions(username, token);

      if (opts.verbose) {
        const d = result.debug;
        console.error(`[debug] Date range:                ${d.firstDate} → ${d.lastDate}`);
        console.error(`[debug] Weeks: ${d.weeksCount}, Days: ${d.daysCount}`);
        console.error(`[debug]`);
        console.error(`[debug] API totalContributions:    ${d.apiTotal}`);
        console.error(`[debug] Summed from calendar days: ${d.summedTotal}`);
        console.error(`[debug] Restricted (private):      ${d.restrictedCount}`);
        console.error(`[debug]`);
        console.error(`[debug] Breakdown by type:`);
        console.error(`[debug]   Commits:      ${d.commits}`);
        console.error(`[debug]   Issues:       ${d.issues}`);
        console.error(`[debug]   PRs:          ${d.prs}`);
        console.error(`[debug]   Reviews:      ${d.reviews}`);
        console.error(`[debug]   Repos:        ${d.repos}`);
        const typeSum = d.commits + d.issues + d.prs + d.reviews + d.repos;
        console.error(`[debug]   Type total:   ${typeSum}`);
        console.error(`[debug]`);

        const gap = d.apiTotal - d.summedTotal;
        if (gap === 0) {
          console.error(`[debug] ✓ Calendar days match API total exactly`);
        } else if (gap === d.restrictedCount) {
          console.error(`[debug] ✓ Gap (${gap}) fully explained by private contributions`);
        } else {
          console.error(`[debug] ⚠ Gap: API total - calendar sum = ${gap}`);
          console.error(`[debug]   Restricted accounts for ${d.restrictedCount} of that`);
          console.error(`[debug]   Remaining ${gap - d.restrictedCount} may be private commits not in per-day data`);
        }
      }

      const svg = generateSvg(result.data, {
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
