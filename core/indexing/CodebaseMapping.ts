// src/RepoAnalyzer.ts
import * as fs from "node:fs";
import * as path from "node:path";
import { Project } from "ts-morph";

export interface ClassInfo {
  name: string;
  file: string;
  extends?: string;
  methods: string[];
}

export interface FunctionInfo {
  name: string;
  file: string;
  parameters: string[];
}

export interface RepoMap {
  classes: Record<string, ClassInfo>;
  functions: Record<string, FunctionInfo>;
}

export class RepoAnalyzer {
  private project: Project;
  private map: RepoMap = { classes: {}, functions: {} };

  constructor(private repoRoot = process.cwd()) {
    // If there’s a tsconfig, use it so path aliases & JSX settings are correct.
    const tsconfig = path.join(repoRoot, "tsconfig.json");
    this.project = new Project(
      fs.existsSync(tsconfig)
        ? { tsConfigFilePath: tsconfig }
        : { compilerOptions: { allowJs: true } }
    );

    // Pull in every source file except node_modules / build artefacts.
    this.project.addSourceFilesAtPaths([
      `${repoRoot}/**/*.{ts,tsx,js,jsx}`,
      `!${repoRoot}/**/{node_modules,dist,build,out}/**/*`,
    ]);
  }

  analyze() {
    for (const sourceFile of this.project.getSourceFiles()) {
      // ---- classes --------------------------------------------------------
      sourceFile.getClasses().forEach((cls: any) => {
        const name = cls.getName() ?? "<anonymous>";
        this.map.classes[name] = {
          name,
          file: path.relative(this.repoRoot, sourceFile.getFilePath()),
          extends: cls.getExtends()?.getExpression().getText(),
          methods: cls.getMethods().map((m: any) => m.getName()),
        };
      });

      // ---- top-level functions -------------------------------------------
      sourceFile.getFunctions().forEach((fn: any) => {
        const name = fn.getName() ?? "<anonymous>";
        this.map.functions[name] = {
          name,
          file: path.relative(this.repoRoot, sourceFile.getFilePath()),
          parameters: fn.getParameters().map((p: any) => p.getName()),
        };
      });
    }
  }

  write(outFile = "repo-map.json") {
    fs.writeFileSync(outFile, JSON.stringify(this.map, null, 2), "utf-8");
    console.log(`✅  Repo map written to ${outFile}`);
  }
}
