// Eleventy config for the Q1 prototype site.
// Global data `q1` is built once from ../../answers/*.json (resolved from
// this file's location), including the graph layout. Templates are
// Nunjucks with autoescape on.

import path from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import { buildModel } from "./lib/model.js";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ANSWERS = path.resolve(HERE, "../../answers");
const readJSON = (name) => JSON.parse(readFileSync(path.join(ANSWERS, name), "utf8"));

const escapeHtml = (s) =>
  String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
// Titles and quotes carry a few inline tags from the papers (<i>, <sub>,
// <sup>, <br>). Escape everything, then let only those tags through, so
// the text stays verbatim and nothing else becomes markup.
const RICH = /&lt;(\/?)(i|b|em|strong|sub|sup)&gt;|&lt;br\s*\/?&gt;/g;
const rich = (s) => escapeHtml(s).replace(RICH, (m, slash, tag) => (tag ? `<${slash}${tag}>` : "<br>"));

export default function (eleventyConfig) {
  eleventyConfig.addGlobalData("q1", () =>
    buildModel(readJSON("q1_tree_planting.json"), readJSON("q1_tree_planting_graph.json")),
  );
  eleventyConfig.setNunjucksEnvironmentOptions({ autoescape: true, trimBlocks: true, lstripBlocks: true });
  eleventyConfig.addFilter("rich", rich);
  eleventyConfig.addFilter("doiUrl", (doi) => `https://doi.org/${doi}`);
  eleventyConfig.addPassthroughCopy({ "src/assets": "assets" });
  // Drop the indentation and newlines between tags. Templates keep inline
  // runs on one line, so no visible space is lost.
  eleventyConfig.addTransform("compact", function (content) {
    if (!(this.page.outputPath || "").endsWith(".html")) return content;
    return content.replace(/\n[ \t]*/g, "\n").replace(/>\n+</g, "><").replace(/\n{2,}/g, "\n");
  });
  return {
    dir: { input: "src", includes: "_includes", output: "site" },
    templateFormats: ["njk"],
    htmlTemplateEngine: "njk",
  };
}
