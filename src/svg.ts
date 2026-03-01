import type { ContributionData } from "./github.js";

export interface SvgOptions {
  cellSize?: number;
  cellGap?: number;
  darkMode?: boolean;
  showLabels?: boolean;
  username?: string;
}

const MONTH_LABELS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_LABELS = ["Mon", "Wed", "Fri"];

// GitHub's color schemes
const THEMES = {
  dark: {
    bg: "#0d1117",
    text: "#8b949e",
    textBright: "#e6edf3",
    empty: "#161b22",
    border: "#30363d",
    levels: ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"],
  },
  light: {
    bg: "#ffffff",
    text: "#656d76",
    textBright: "#1f2328",
    empty: "#ebedf0",
    border: "#d0d7de",
    levels: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
  },
};

/**
 * Compute contribution level (0-4) using proportional thresholds based
 * on the max contribution count. This distributes color levels evenly
 * across the full range, giving visual variety in both sparse and
 * active periods.
 */
function computeContributionLevels(data: ContributionData): Map<string, number> {
  let max = 0;
  for (const week of data.weeks) {
    for (const day of week.contributionDays) {
      if (day.contributionCount > max) {
        max = day.contributionCount;
      }
    }
  }

  if (max === 0) max = 1;

  // Thresholds at 25%, 50%, 75% of max
  const t1 = Math.ceil(max * 0.25);
  const t2 = Math.ceil(max * 0.50);
  const t3 = Math.ceil(max * 0.75);

  const levelMap = new Map<string, number>();
  for (const week of data.weeks) {
    for (const day of week.contributionDays) {
      let level: number;
      const c = day.contributionCount;
      if (c === 0) {
        level = 0;
      } else if (c <= t1) {
        level = 1;
      } else if (c <= t2) {
        level = 2;
      } else if (c <= t3) {
        level = 3;
      } else {
        level = 4;
      }
      levelMap.set(day.date, level);
    }
  }

  return levelMap;
}

function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateSvg(data: ContributionData, options: SvgOptions = {}): string {
  const {
    cellSize = 12,
    cellGap = 3,
    darkMode = true,
    showLabels = true,
    username,
  } = options;

  const theme = darkMode ? THEMES.dark : THEMES.light;
  const step = cellSize + cellGap;

  // Layout measurements
  const labelOffsetX = showLabels ? 36 : 0;
  const headerHeight = username ? 40 : 0;
  const monthLabelHeight = showLabels ? 20 : 0;
  const footerHeight = 36;

  const weeksCount = data.weeks.length;
  const gridWidth = weeksCount * step - cellGap;
  const gridHeight = 7 * step - cellGap;

  const padding = 20;
  const totalWidth = gridWidth + labelOffsetX + padding * 2;
  const totalHeight = gridHeight + headerHeight + monthLabelHeight + footerHeight + padding * 2;

  const gridX = padding + labelOffsetX;
  const gridY = padding + headerHeight + monthLabelHeight;

  // Build SVG parts
  const parts: string[] = [];

  // Header
  parts.push(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}">`,
    `<rect width="${totalWidth}" height="${totalHeight}" rx="8" fill="${theme.bg}"/>`,
  );

  // Username + total contributions
  if (username) {
    parts.push(
      `<text x="${padding}" y="${padding + 20}" ` +
        `font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="600" ` +
        `fill="${theme.textBright}">${escapeXml(username)}</text>`,
      `<text x="${padding}" y="${padding + 36}" ` +
        `font-family="system-ui, -apple-system, sans-serif" font-size="11" ` +
        `fill="${theme.text}">${data.totalContributions.toLocaleString()} contributions in the last year</text>`,
    );
  }

  // Month labels
  if (showLabels) {
    const monthPositions = new Map<number, number>(); // month -> first week x
    for (let w = 0; w < data.weeks.length; w++) {
      const firstDay = data.weeks[w].contributionDays[0];
      if (firstDay) {
        const month = new Date(firstDay.date).getMonth();
        if (!monthPositions.has(month)) {
          monthPositions.set(month, w);
        }
      }
    }

    for (const [month, weekIdx] of monthPositions) {
      const x = gridX + weekIdx * step;
      parts.push(
        `<text x="${x}" y="${gridY - 6}" ` +
          `font-family="system-ui, -apple-system, sans-serif" font-size="10" ` +
          `fill="${theme.text}">${MONTH_LABELS[month]}</text>`,
      );
    }

    // Day labels (Mon, Wed, Fri)
    for (const [i, label] of DAY_LABELS.entries()) {
      const dayIndex = i * 2 + 1; // 1, 3, 5
      const y = gridY + dayIndex * step + cellSize * 0.8;
      parts.push(
        `<text x="${padding}" y="${y}" ` +
          `font-family="system-ui, -apple-system, sans-serif" font-size="10" ` +
          `fill="${theme.text}">${label}</text>`,
      );
    }
  }

  // Compute contribution levels from actual data distribution
  const levelMap = computeContributionLevels(data);

  // Contribution cells
  for (let w = 0; w < data.weeks.length; w++) {
    const week = data.weeks[w];
    for (let d = 0; d < week.contributionDays.length; d++) {
      const day = week.contributionDays[d];
      const x = gridX + w * step;
      const y = gridY + d * step;
      const level = levelMap.get(day.date) ?? 0;
      const color = theme.levels[level];

      parts.push(
        `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" fill="${color}"/>`,
      );
    }
  }

  // Footer: legend
  const legendY = gridY + gridHeight + 16;
  const legendX = gridX + gridWidth - 120;
  parts.push(
    `<text x="${legendX - 30}" y="${legendY + 9}" ` +
      `font-family="system-ui, -apple-system, sans-serif" font-size="10" ` +
      `fill="${theme.text}">Less</text>`,
  );

  const legendColors = theme.levels;

  for (let i = 0; i < legendColors.length; i++) {
    parts.push(
      `<rect x="${legendX + i * (cellSize + 2)}" y="${legendY}" ` +
        `width="${cellSize}" height="${cellSize}" rx="2" fill="${legendColors[i]}"/>`,
    );
  }

  parts.push(
    `<text x="${legendX + legendColors.length * (cellSize + 2) + 4}" y="${legendY + 9}" ` +
      `font-family="system-ui, -apple-system, sans-serif" font-size="10" ` +
      `fill="${theme.text}">More</text>`,
  );

  parts.push("</svg>");

  return parts.join("\n");
}
