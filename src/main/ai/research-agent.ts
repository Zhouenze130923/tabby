/**
 * Research Agent — 自主调研 Agent
 *
 * 接收自然语言调研任务，自动：
 * 1. 规划：拆解任务为搜索策略和步骤
 * 2. 执行：多步搜索、阅读、提取
 * 3. 综合：生成结构化报告
 */

import { tabManager } from "../browser/tab-manager";
import { getProvider, setProviderApi } from "./provider-bridge";
import { searchKnowledge, buildKnowledgeContext } from "../knowledge/bridge";

export interface ResearchPlan {
  title: string;
  steps: ResearchStep[];
}

export interface ResearchStep {
  type: "search" | "read" | "extract" | "analyze" | "synthesize";
  query?: string;
  url?: string;
  instruction: string;
  status: "pending" | "running" | "done" | "failed";
  result?: string;
}

export interface ResearchReport {
  title: string;
  summary: string;
  sections: Array<{ heading: string; content: string; sources: string[] }>;
  conclusion: string;
  sources: string[];
}

/**
 * The Research Agent — orchestrates autonomous research.
 */
export class ResearchAgent {
  private plan: ResearchPlan | null = null;
  private report: ResearchReport | null = null;
  private logs: string[] = [];

  log(msg: string): void {
    this.logs.push(`[${new Date().toLocaleTimeString()}] ${msg}`);
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  /**
   * Start research from a user query.
   * 1. Generate a research plan using AI
   * 2. Execute each step
   * 3. Synthesize findings into a report
   */
  async research(query: string): Promise<ResearchReport> {
    this.log(`开始调研: "${query}"`);
    this.log("Step 1: 生成调研计划...");

    // Step 1: Generate plan
    const planPrompt = `你是一个研究规划专家。用户想调研: "${query}"

请输出一个研究计划，格式如下：
标题: <研究标题>
步骤:
1. <步骤描述> | search | <搜索关键词>
2. <步骤描述> | read | <目标URL>
...

只输出研究计划，不要其他内容。
每个步骤的格式: <描述> | <类型: search/read/extract/analyze/synthesize> | <搜索词或URL>`;

    const planResponse = await this.callAI([
      { role: "system", content: "你是一个研究规划专家。输出简洁的研究计划。" },
      { role: "user", content: planPrompt },
    ]);

    this.plan = this.parsePlan(planResponse, query);
    this.log(`计划生成: ${this.plan.steps.length} 个步骤`);

    // Step 2: Execute each step
    const findings: string[] = [];
    for (let i = 0; i < this.plan.steps.length; i++) {
      const step = this.plan.steps[i];
      step.status = "running";
      this.log(`Step ${i + 1}: ${step.instruction} (${step.type})`);

      try {
        const result = await this.executeStep(step);
        step.result = result;
        step.status = "done";
        findings.push(`## Step ${i + 1}: ${step.instruction}\n\n${result}`);
        this.log(`Step ${i + 1}: 完成 (${result.length} 字符)`);
      } catch (err: any) {
        step.status = "failed";
        step.result = `错误: ${err.message}`;
        this.log(`Step ${i + 1}: 失败 - ${err.message}`);
      }
    }

    // Step 3: Synthesize report
    this.log("Step 3: 综合生成报告...");
    const synthesisPrompt = `请基于以下研究发现，生成一份结构化的研究报告。

研究问题: "${query}"

研究发现:
${findings.join("\n\n")}

请输出:
## 摘要
简要总结核心发现

## 详细分析
分为多个小节，每节一个主题

## 结论
整体结论和建议

报告语言：中文`;

    const synthesis = await this.callAI([
      { role: "system", content: "你是一个专业的研究分析师。生成结构化、客观的研究报告。" },
      { role: "user", content: synthesisPrompt },
    ]);

    this.report = this.parseReport(synthesis, query);
    this.log("调研完成!");
    return this.report;
  }

  private async callAI(messages: Array<{ role: string; content: string }>): Promise<string> {
    const provider = getProvider();
    const result = await provider.chat(messages);
    return result.choices?.[0]?.message?.content || JSON.stringify(result);
  }

  private parsePlan(response: string, originalQuery: string): ResearchPlan {
    const lines = response.split("\n").filter((l) => l.trim());
    const titleLine = lines.find((l) => l.startsWith("标题:"));
    const title = titleLine ? titleLine.replace("标题:", "").trim() : originalQuery;

    const steps: ResearchStep[] = [];
    let stepNum = 0;
    for (const line of lines) {
      const stepMatch = line.match(/^\d+\.\s*(.+?)\s*\|\s*(search|read|extract|analyze|synthesize)\s*\|\s*(.+)$/);
      if (stepMatch) {
        steps.push({
          type: stepMatch[2] as ResearchStep["type"],
          instruction: stepMatch[1].trim(),
          query: stepMatch[3].trim(),
          status: "pending",
        });
        stepNum++;
      }
    }

    // If no steps parsed, create a default plan
    if (steps.length === 0) {
      steps.push({
        type: "search",
        instruction: `搜索关于"${originalQuery}"的信息`,
        query: originalQuery,
        status: "pending",
      });
    }

    return { title, steps };
  }

  private async executeStep(step: ResearchStep): Promise<string> {
    switch (step.type) {
      case "search": {
        // Use web search via the search engine
        const { getSearchProvider } = await import("../search/engine");
        const { settings } = await import("../storage/db");
        const searchRaw = settings.get("searchProvider");
        if (!searchRaw) return "搜索后端未配置";
        const searchConfig = JSON.parse(searchRaw);
        const provider = getSearchProvider(searchConfig);
        const results = await provider.search(step.query || step.instruction, 5);

        if (!results.results || results.results.length === 0) {
          return `未找到关于"${step.query || step.instruction}"的搜索结果。`;
        }

        // Also check knowledge base
        const kbResults = await searchKnowledge(step.query || step.instruction);
        let kbSection = "";
        if (kbResults.length > 0) {
          kbSection = "\n\n### 知识库关联:\n" + kbResults.map((r) => `- ${r.title}: ${r.content.slice(0, 150)}`).join("\n");
        }

        return `### 搜索结果: ${step.query || step.instruction}\n\n` +
          results.results.map((r: any, i: number) =>
            `**[${i + 1}] ${r.title}**\n来源: ${r.url}\n摘要: ${(r.content || "").slice(0, 300)}`
          ).join("\n\n") + kbSection;
      }

      case "read":
      case "extract": {
        // Read a specific URL — open in a tab and extract content
        const url = step.url || step.query || "";
        if (!url.startsWith("http")) return "未提供有效的URL";

        const tab = tabManager.create(url);
        await new Promise((r) => setTimeout(r, 3000)); // Wait for load

        // Try to get content via the IPC handler route
        try {
          const { webContents } = require("electron");
          // We can't easily get webContents here without the IPC registry
          return `已打开页面: ${url}\n请查阅标签页获取详细内容。`;
        } catch {
          return `已打开: ${url}`;
        }
      }

      case "analyze": {
        // Use AI to analyze gathered information
        return await this.callAI([
          { role: "system", content: "分析以下信息并提供见解。" },
          { role: "user", content: `分析: ${step.instruction}\n上下文: ${step.query || ""}` },
        ]);
      }

      case "synthesize": {
        // This is handled at the end
        return "";
      }

      default:
        return `未知步骤类型: ${step.type}`;
    }
  }

  private parseReport(synthesis: string, query: string): ResearchReport {
    const sections: Array<{ heading: string; content: string; sources: string[] }> = [];
    let summary = "";
    let conclusion = "";
    let currentSection: { heading: string; content: string; sources: string[] } | null = null;

    const lines = synthesis.split("\n");
    for (const line of lines) {
      const headingMatch = line.match(/^##\s+(.+)$/);
      if (headingMatch) {
        if (currentSection) sections.push(currentSection);

        const heading = headingMatch[1].trim();
        if (heading === "摘要") {
          currentSection = { heading, content: "", sources: [] };
        } else if (heading === "结论") {
          currentSection = { heading, content: "", sources: [] };
        } else {
          currentSection = { heading, content: "", sources: [] };
        }
        continue;
      }

      if (currentSection) {
        const sourceMatch = line.match(/\[(\d+)\]\s*(.+)/);
        if (sourceMatch) {
          currentSection.sources.push(sourceMatch[2].trim());
        } else {
          currentSection.content += line + "\n";
        }
      }
    }
    if (currentSection) sections.push(currentSection);

    const summarySection = sections.find((s) => s.heading === "摘要");
    const conclusionSection = sections.find((s) => s.heading === "结论");

    // Collect all sources
    const allSources = [...new Set(sections.flatMap((s) => s.sources))];

    return {
      title: query,
      summary: summarySection?.content.trim() || synthesis.slice(0, 300),
      sections: sections.filter((s) => s.heading !== "摘要" && s.heading !== "结论"),
      conclusion: conclusionSection?.content.trim() || "",
      sources: allSources,
    };
  }

  getReport(): ResearchReport | null {
    return this.report;
  }
}
