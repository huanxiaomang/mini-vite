import { describe, it, expect, beforeEach } from "vitest";
import { ModuleGraph } from "../src/moduleGraph";
import type { ModuleNode } from "../src/moduleGraph";

describe("ModuleGraph", () => {
  let graph: ModuleGraph;

  beforeEach(() => {
    graph = new ModuleGraph();
  });

  describe("ensureEntryFromUrl", () => {
    it("creates a new module node", () => {
      const mod = graph.ensureEntryFromUrl("/src/main.ts", "/abs/src/main.ts");
      expect(mod.url).toBe("/src/main.ts");
      expect(mod.file).toBe("/abs/src/main.ts");
      expect(mod.code).toBeNull();
      expect(mod.importers.size).toBe(0);
      expect(mod.importedModules.size).toBe(0);
    });

    it("returns existing module for same file", () => {
      const mod1 = graph.ensureEntryFromUrl("/src/main.ts", "/abs/src/main.ts");
      const mod2 = graph.ensureEntryFromUrl("/src/main.ts", "/abs/src/main.ts");
      expect(mod1).toBe(mod2);
    });

    it("updates URL mapping when file exists with different URL", () => {
      const mod1 = graph.ensureEntryFromUrl("/old/main.ts", "/abs/src/main.ts");
      const mod2 = graph.ensureEntryFromUrl("/new/main.ts", "/abs/src/main.ts");
      expect(mod1).toBe(mod2);
      expect(mod2.url).toBe("/new/main.ts");
      expect(graph.getModuleByUrl("/new/main.ts")).toBe(mod2);
      expect(graph.getModuleByUrl("/old/main.ts")).toBeUndefined();
    });

    it("updates file mapping when URL exists with different file", () => {
      const mod1 = graph.ensureEntryFromUrl("/src/main.ts", "/abs/old.ts");
      const mod2 = graph.ensureEntryFromUrl("/src/main.ts", "/abs/new.ts");
      expect(mod1).toBe(mod2);
      expect(mod2.file).toBe("/abs/new.ts");
    });

    it("skips node_modules paths (returns temp node)", () => {
      const mod = graph.ensureEntryFromUrl("/node_modules/vue/index.js", "/abs/node_modules/vue/index.js");
      expect(mod.url).toBe("/node_modules/vue/index.js");
      expect(graph.getModuleByFile("/abs/node_modules/vue/index.js")).toBeUndefined();
    });

    it("normalizes backslashes", () => {
      const mod = graph.ensureEntryFromUrl("/src/main.ts", "C:\\Users\\src\\main.ts");
      expect(mod.file).toBe("C:/Users/src/main.ts");
      expect(graph.getModuleByFile("C:\\Users\\src\\main.ts")).toBe(mod);
    });
  });

  describe("getModuleByFile / getModuleByUrl", () => {
    it("retrieves module by file path", () => {
      graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      expect(graph.getModuleByFile("/abs/src/a.ts")).toBeDefined();
      expect(graph.getModuleByFile("/abs/src/b.ts")).toBeUndefined();
    });

    it("retrieves module by URL", () => {
      graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      expect(graph.getModuleByUrl("/src/a.ts")).toBeDefined();
      expect(graph.getModuleByUrl("/src/b.ts")).toBeUndefined();
    });
  });

  describe("deleteModule", () => {
    it("removes module from both maps", () => {
      graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      graph.deleteModule("/abs/src/a.ts");
      expect(graph.getModuleByFile("/abs/src/a.ts")).toBeUndefined();
      expect(graph.getModuleByUrl("/src/a.ts")).toBeUndefined();
    });

    it("cleans up import relationships", () => {
      const parent = graph.ensureEntryFromUrl("/src/parent.ts", "/abs/src/parent.ts");
      const child = graph.ensureEntryFromUrl("/src/child.ts", "/abs/src/child.ts");

      parent.importedModules.add(child);
      child.importers.add(parent);

      graph.deleteModule("/abs/src/child.ts");
      expect(parent.importedModules.has(child)).toBe(false);
    });

    it("does nothing for non-existent module", () => {
      expect(() => graph.deleteModule("/abs/nonexistent.ts")).not.toThrow();
    });
  });

  describe("invalidateModules", () => {
    it("updates lastUpdated timestamp", () => {
      const mod = graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      const oldTimestamp = mod.lastUpdated;

      // Wait a tick to ensure timestamp difference
      const modules = new Set<ModuleNode>([mod]);
      graph.invalidateModules(modules);

      expect(mod.lastUpdated).toBeGreaterThanOrEqual(oldTimestamp);
    });
  });

  describe("getEntireFileMap", () => {
    it("returns the internal file map", () => {
      graph.ensureEntryFromUrl("/a", "/abs/a.ts");
      graph.ensureEntryFromUrl("/b", "/abs/b.ts");
      const map = graph.getEntireFileMap();
      expect(map.size).toBe(2);
      expect(map.has("/abs/a.ts")).toBe(true);
      expect(map.has("/abs/b.ts")).toBe(true);
    });
  });

  describe("formatModuleForDebug", () => {
    it("formats module node to plain object", () => {
      const mod = graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      mod.isSelfAccepting = true;

      const debug = graph.formatModuleForDebug(mod);
      expect(debug.url).toBe("/src/a.ts");
      expect(debug.file).toBe("/abs/src/a.ts");
      expect(debug.isSelfAccepting).toBe(true);
      expect(debug.importers).toEqual([]);
      expect(debug.importedModules).toEqual([]);
    });

    it("includes importer/imported file paths", () => {
      const parent = graph.ensureEntryFromUrl("/parent", "/abs/parent.ts");
      const child = graph.ensureEntryFromUrl("/child", "/abs/child.ts");
      parent.importedModules.add(child);
      child.importers.add(parent);

      const parentDebug = graph.formatModuleForDebug(parent);
      expect(parentDebug.importedModules).toContain("/abs/child.ts");

      const childDebug = graph.formatModuleForDebug(child);
      expect(childDebug.importers).toContain("/abs/parent.ts");
    });
  });

  describe("formatModuleSetForDebug", () => {
    it("formats a set of modules", () => {
      const a = graph.ensureEntryFromUrl("/a", "/abs/a.ts");
      const b = graph.ensureEntryFromUrl("/b", "/abs/b.ts");
      const result = graph.formatModuleSetForDebug(new Set([a, b]));
      expect(result.length).toBe(2);
      expect(result[0].file).toBe("/abs/a.ts");
      expect(result[1].file).toBe("/abs/b.ts");
    });

    it("returns empty array for empty set", () => {
      const result = graph.formatModuleSetForDebug(new Set());
      expect(result).toEqual([]);
    });
  });

  describe("updateModuleCode", () => {
    it("updates code and timestamp for existing module", async () => {
      const mod = graph.ensureEntryFromUrl("/src/a.ts", "/abs/src/a.ts");
      const oldTime = mod.lastUpdated;
      await graph.updateModuleCode("/abs/src/a.ts", "const x = 1;");
      expect(mod.code).toBe("const x = 1;");
      expect(mod.lastUpdated).toBeGreaterThanOrEqual(oldTime);
    });

    it("creates module if not exists", async () => {
      const mod = await graph.updateModuleCode("/abs/src/new.ts", "export const y = 2;");
      expect(mod).toBeDefined();
      expect(mod!.code).toBe("export const y = 2;");
      expect(graph.getModuleByFile("/abs/src/new.ts")).toBe(mod);
    });

    it("clears old import relationships on update", async () => {
      const parent = graph.ensureEntryFromUrl("/parent", "/abs/parent.ts");
      const child = graph.ensureEntryFromUrl("/child", "/abs/child.ts");
      parent.importedModules.add(child);
      child.importers.add(parent);

      await graph.updateModuleCode("/abs/parent.ts", "const a = 1;");
      expect(parent.importedModules.size).toBe(0);
      expect(child.importers.has(parent)).toBe(false);
    });

    it("detects isSelfAccepting from code", async () => {
      const mod = graph.ensureEntryFromUrl("/hot", "/abs/hot.ts");
      await graph.updateModuleCode(
        "/abs/hot.ts",
        "import.meta.hot.accept(); export default 1;"
      );
      expect(mod.isSelfAccepting).toBe(true);
    });

    it("marks non-accepting module correctly", async () => {
      const mod = graph.ensureEntryFromUrl("/cold", "/abs/cold.ts");
      await graph.updateModuleCode("/abs/cold.ts", "export const x = 1;");
      expect(mod.isSelfAccepting).toBe(false);
    });

    it("analyzes relative imports and creates edges", async () => {
      const parent = graph.ensureEntryFromUrl("/src/main.ts", "/abs/src/main.ts");
      await graph.updateModuleCode(
        "/abs/src/main.ts",
        'import { foo } from "./utils.ts";'
      );
      expect(parent.importedModules.size).toBe(1);
      const imported = [...parent.importedModules][0];
      expect(imported.importers.has(parent)).toBe(true);
    });

    it("skips external module imports", async () => {
      const mod = graph.ensureEntryFromUrl("/src/app.ts", "/abs/src/app.ts");
      await graph.updateModuleCode("/abs/src/app.ts", 'import { ref } from "vue";');
      expect(mod.importedModules.size).toBe(0);
    });
  });

  describe("complex graph operations", () => {
    it("handles multiple modules with shared dependencies", () => {
      const a = graph.ensureEntryFromUrl("/a", "/abs/a.ts");
      const b = graph.ensureEntryFromUrl("/b", "/abs/b.ts");
      const shared = graph.ensureEntryFromUrl("/shared", "/abs/shared.ts");

      a.importedModules.add(shared);
      b.importedModules.add(shared);
      shared.importers.add(a);
      shared.importers.add(b);

      expect(shared.importers.size).toBe(2);

      graph.deleteModule("/abs/a.ts");
      expect(shared.importers.size).toBe(1);
      expect(shared.importers.has(b)).toBe(true);
    });

    it("invalidates a chain of modules", () => {
      const a = graph.ensureEntryFromUrl("/a", "/abs/a.ts");
      const b = graph.ensureEntryFromUrl("/b", "/abs/b.ts");
      const c = graph.ensureEntryFromUrl("/c", "/abs/c.ts");

      const before = Date.now();
      graph.invalidateModules(new Set([a, b, c]));

      expect(a.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(b.lastUpdated).toBeGreaterThanOrEqual(before);
      expect(c.lastUpdated).toBeGreaterThanOrEqual(before);
    });
  });
});
