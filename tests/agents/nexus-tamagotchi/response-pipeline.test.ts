import { describe, expect, it } from "vitest";

import {
  ResponseFormat,
  ResponseFormatter,
  ResponsePipeline,
  ResponseTemplateEngine,
  ResponseTone,
} from "../../../src/agents/nexus-tamagotchi/response-pipeline.js";

describe("response-pipeline", () => {
  it("formats responses with configurable output modes", () => {
    const formatter = new ResponseFormatter({
      includeGreeting: false,
      includeSignature: true,
      format: ResponseFormat.MARKDOWN,
      tone: ResponseTone.FRIENDLY,
      maxLength: 300,
    });
    const response = formatter.format("## Heading\n**Bold** content with [link](https://example.com)");
    expect(response.signature).toBeDefined();
    expect(response.toString()).toContain("Bold");

    const plainText = formatter.applyFormat(
      "## Heading\n**Bold** content",
      ResponseFormat.PLAIN_TEXT,
    );
    expect(plainText).toContain("Heading");
    expect(plainText).not.toContain("**");
  });

  it("supports pipeline pre/post-processing and validation", () => {
    const pipeline = new ResponsePipeline(
      new ResponseFormatter({ includeGreeting: false, includeSignature: false }),
    );
    pipeline.addPreprocessor((content) => content.replace("foo", "bar"));
    pipeline.addPostprocessor((content) => `${content}\npostprocessed`);
    pipeline.addValidator((content) => ({
      isValid: !content.includes("forbidden"),
      message: "Contains forbidden term",
    }));

    const valid = pipeline.process("foo");
    expect(valid.mainContent).toContain("bar");
    expect(valid.mainContent).toContain("postprocessed");
    expect(valid.metadata.validationWarning).toBeUndefined();

    const invalid = pipeline.process("forbidden");
    expect(invalid.metadata.validationWarning).toBe("Contains forbidden term");
  });

  it("renders templates and helper formatting utilities", () => {
    const templates = new ResponseTemplateEngine();
    templates.registerTemplate("custom", "Hello {name}, score {score}");
    const rendered = templates.render("custom", { name: "Nexus", score: 42 });
    expect(rendered).toBe("Hello Nexus, score 42");
    expect(templates.listTemplates().length).toBeGreaterThan(0);

    const formatter = new ResponseFormatter();
    expect(formatter.formatList(["a", "b"]).split("\n").length).toBe(2);
    expect(formatter.formatTable(["h1", "h2"], [["v1", "v2"]])).toContain("| h1 | h2 |");
    expect(formatter.formatCodeBlock("const x = 1;", "ts")).toContain("```ts");
  });
});