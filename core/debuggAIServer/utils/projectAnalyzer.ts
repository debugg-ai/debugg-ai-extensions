import path from "path";
import { IDE } from "../../index.js";

export interface ProjectAnalysis {
  primaryLanguage: string | undefined;
  testingLanguage: string | undefined;
  testingFramework: string | undefined;
  repoName: string | undefined;
  repoPath: string | undefined;
  branchName: string | undefined;
  framework: string | undefined;
}

export interface LanguageDetectionResult {
  language: string;
  confidence: number;
  evidence: string[];
}

export interface TestingFrameworkResult {
  framework: string;
  confidence: number;
  evidence: string[];
}

/**
 * Utility class for analyzing project structure to determine languages and testing frameworks
 * Uses IDE methods similar to the approach in DebuggTransport.addProjectToCall()
 */
export class ProjectAnalyzer {
  constructor(private ide: IDE) {}

  /**
   * Analyze the project to determine primary language, testing language, and testing framework
   */
  async analyzeProject(filePath?: string): Promise<ProjectAnalysis> {
    const curdirs = await this.ide.getWorkspaceDirs();
    const curdir = curdirs?.[0];
    const gitRootPath = (await this.ide.getGitRootPath(curdir))?.replace('file://', "");
    
    if (!gitRootPath) {
      return {
        primaryLanguage: undefined,
        testingLanguage: undefined,
        testingFramework: undefined,
        repoName: undefined,
        repoPath: undefined,
        branchName: undefined,
        framework: undefined,
      };
    }

    const repoName = await this.ide.getRepoName(gitRootPath);
    const branchName = await this.ide.getBranch(gitRootPath);

    const primaryLanguage = await this.detectPrimaryLanguage(gitRootPath);
    const testingFramework = await this.detectTestingFramework(gitRootPath);
    const testingLanguage = await this.detectTestingLanguage(gitRootPath, primaryLanguage.language);
    const framework = await this.detectFramework(gitRootPath);

    return {
      primaryLanguage: primaryLanguage.language,
      testingLanguage: testingLanguage.language,
      testingFramework: testingFramework.framework,
      repoName,
      repoPath: gitRootPath,
      branchName,
      framework: framework,
    };
  }

  /**
   * Detect the primary programming language of the project
   */
  async detectPrimaryLanguage(projectPath: string): Promise<LanguageDetectionResult> {
    const evidence: string[] = [];
    let confidence = 0;
    let detectedLanguage = "unknown";

    try {
      // Check for package.json (JavaScript/TypeScript)
      if (await this.ide.fileExists(path.join(projectPath, "package.json"))) {
        const packageJson = await this.readPackageJson(projectPath);
        if (packageJson) {
          evidence.push("package.json found");
          confidence += 30;

          // Check for TypeScript indicators
          if (packageJson.dependencies?.typescript || 
              packageJson.devDependencies?.typescript ||
              packageJson.dependencies?.["@types/node"] ||
              packageJson.devDependencies?.["@types/node"]) {
            detectedLanguage = "typescript";
            evidence.push("TypeScript dependencies in package.json");
            confidence += 25;
          } else {
            detectedLanguage = "javascript";
            evidence.push("JavaScript project (no TypeScript deps)");
            confidence += 20;
          }

          // Additional JS/TS framework indicators
          if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
            evidence.push("React framework detected");
            confidence += 10;
          }
          if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
            evidence.push("Vue framework detected");
            confidence += 10;
          }
          if (packageJson.dependencies?.angular || packageJson.devDependencies?.angular) {
            evidence.push("Angular framework detected");
            confidence += 10;
          }
        }
      }

      // Check for tsconfig.json
      if (await this.ide.fileExists(path.join(projectPath, "tsconfig.json"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "typescript";
          confidence += 35;
        }
        evidence.push("tsconfig.json found");
        confidence += 15;
      }

      // Check for Python indicators
      if (await this.ide.fileExists(path.join(projectPath, "requirements.txt")) ||
          await this.ide.fileExists(path.join(projectPath, "pyproject.toml")) ||
          await this.ide.fileExists(path.join(projectPath, "setup.py"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "python";
          confidence += 40;
        }
        evidence.push("Python project files found");
      }

      // Check for Java indicators
      if (await this.ide.fileExists(path.join(projectPath, "pom.xml")) ||
          await this.ide.fileExists(path.join(projectPath, "build.gradle"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "java";
          confidence += 40;
        }
        evidence.push("Java build files found");
      }

      // Check for C# indicators
      if (await this.ide.fileExists(path.join(projectPath, ".csproj")) ||
          await this.ide.fileExists(path.join(projectPath, ".sln"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "csharp";
          confidence += 40;
        }
        evidence.push("C# project files found");
      }

      // Check for Go indicators
      if (await this.ide.fileExists(path.join(projectPath, "go.mod"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "go";
          confidence += 40;
        }
        evidence.push("Go module file found");
      }

      // Check for Rust indicators
      if (await this.ide.fileExists(path.join(projectPath, "Cargo.toml"))) {
        if (detectedLanguage === "unknown") {
          detectedLanguage = "rust";
          confidence += 40;
        }
        evidence.push("Cargo.toml found");
      }

      // Fallback to file extension analysis
      if (confidence < 30) {
        const fileExtensionResult = await this.analyzeFileExtensions(projectPath);
        if (fileExtensionResult.confidence > confidence) {
          detectedLanguage = fileExtensionResult.language;
          confidence = fileExtensionResult.confidence;
          evidence.push(...fileExtensionResult.evidence);
        }
      }

    } catch (error) {
      console.warn("Error detecting primary language:", error);
      evidence.push("Error during detection");
    }

    return {
      language: detectedLanguage,
      confidence: Math.min(confidence, 100),
      evidence,
    };
  }

  /**
   * Detect the testing framework used in the project
   */
  async detectTestingFramework(projectPath: string): Promise<TestingFrameworkResult> {
    const evidence: string[] = [];
    let confidence = 0;
    let framework = "unknown";

    try {
      // Check package.json for testing frameworks
      if (await this.ide.fileExists(path.join(projectPath, "package.json"))) {
        const packageJson = await this.readPackageJson(projectPath);
        if (packageJson) {
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          // Playwright
          if (allDeps.playwright || allDeps["@playwright/test"]) {
            framework = "playwright";
            evidence.push("Playwright dependencies found");
            confidence += 40;
          }

          // Selenium
          if (allDeps["selenium-webdriver"] || allDeps.webdriver || allDeps.webdriverio) {
            if (framework === "unknown") {
              framework = "selenium";
              confidence += 35;
            }
            evidence.push("Selenium/WebDriver dependencies found");
          }

          // Cypress
          if (allDeps.cypress) {
            if (framework === "unknown") {
              framework = "cypress";
              confidence += 35;
            }
            evidence.push("Cypress dependencies found");
          }

          // Puppeteer
          if (allDeps.puppeteer) {
            if (framework === "unknown") {
              framework = "puppeteer";
              confidence += 30;
            }
            evidence.push("Puppeteer dependencies found");
          }

          // Jest
          if (allDeps.jest || allDeps["@jest/core"]) {
            if (framework === "unknown") {
              framework = "jest";
              confidence += 30;
            }
            evidence.push("Jest testing framework found");
          }

          // Vitest
          if (allDeps.vitest) {
            if (framework === "unknown") {
              framework = "vitest";
              confidence += 30;
            }
            evidence.push("Vitest testing framework found");
          }

          // Mocha
          if (allDeps.mocha) {
            if (framework === "unknown") {
              framework = "mocha";
              confidence += 25;
            }
            evidence.push("Mocha testing framework found");
          }

          // Jasmine
          if (allDeps.jasmine) {
            if (framework === "unknown") {
              framework = "jasmine";
              confidence += 25;
            }
            evidence.push("Jasmine testing framework found");
          }
        }
      }

      // Check for config files
      const configFiles = [
        { file: "playwright.config.js", framework: "playwright", weight: 35 },
        { file: "playwright.config.ts", framework: "playwright", weight: 35 },
        { file: "cypress.config.js", framework: "cypress", weight: 30 },
        { file: "cypress.config.ts", framework: "cypress", weight: 30 },
        { file: "jest.config.js", framework: "jest", weight: 25 },
        { file: "jest.config.ts", framework: "jest", weight: 25 },
        { file: "vitest.config.js", framework: "vitest", weight: 25 },
        { file: "vitest.config.ts", framework: "vitest", weight: 25 },
      ];

      for (const config of configFiles) {
        if (await this.ide.fileExists(path.join(projectPath, config.file))) {
          if (framework === "unknown" || config.weight > confidence) {
            framework = config.framework;
            confidence = Math.max(confidence, config.weight);
          }
          evidence.push(`${config.file} found`);
        }
      }

      // Check for Python testing frameworks
      if (await this.ide.fileExists(path.join(projectPath, "pytest.ini")) ||
          await this.ide.fileExists(path.join(projectPath, "pyproject.toml"))) {
        if (framework === "unknown") {
          framework = "pytest";
          confidence += 30;
        }
        evidence.push("Python testing configuration found");
      }

      // Check for Java testing frameworks via directory structure
      const testDirs = await this.checkTestDirectories(projectPath);
      if (testDirs.length > 0) {
        evidence.push(`Test directories found: ${testDirs.join(", ")}`);
        confidence += 10;
      }

    } catch (error) {
      console.warn("Error detecting testing framework:", error);
      evidence.push("Error during detection");
    }

    return {
      framework,
      confidence: Math.min(confidence, 100),
      evidence,
    };
  }

  /**
   * Detect the testing language (which might differ from primary language)
   */
  async detectTestingLanguage(projectPath: string, primaryLanguage: string): Promise<LanguageDetectionResult> {
    const evidence: string[] = [];
    let confidence = 0;
    let testingLanguage = primaryLanguage; // Default to primary language

    try {
      // Look for test files and analyze their extensions
      const testPatterns = [
        "**/*.test.js",
        "**/*.test.ts",
        "**/*.spec.js", 
        "**/*.spec.ts",
        "**/*.test.py",
        "**/*.spec.py",
        "**/test*.py",
        "**/*Test.java",
        "**/*Tests.java",
      ];

      const testFileExtensions = new Map<string, number>();
      
      // Check common test directories
      const testDirs = ["test", "tests", "__tests__", "spec", "e2e", "integration"];
      
      for (const dir of testDirs) {
        const testDirPath = path.join(projectPath, dir);
        if (await this.ide.fileExists(testDirPath)) {
          evidence.push(`${dir} directory found`);
          confidence += 5;
          
          // Analyze file extensions in test directory
          try {
            const files = await this.ide.listDir(testDirPath);
            for (const [fileName] of files) {
              const ext = path.extname(fileName).toLowerCase();
              if (ext) {
                testFileExtensions.set(ext, (testFileExtensions.get(ext) || 0) + 1);
              }
            }
          } catch (error) {
            // Directory might not be accessible, continue
          }
        }
      }

      // Determine language based on test file extensions
      if (testFileExtensions.size > 0) {
        const sortedExtensions = Array.from(testFileExtensions.entries())
          .sort(([,a], [,b]) => b - a);
        
        const topExtension = sortedExtensions[0][0];
        const topCount = sortedExtensions[0][1];
        
        switch (topExtension) {
          case ".ts":
            testingLanguage = "typescript";
            confidence += 30;
            evidence.push(`TypeScript test files found (${topCount})`);
            break;
          case ".js":
            testingLanguage = "javascript";
            confidence += 25;
            evidence.push(`JavaScript test files found (${topCount})`);
            break;
          case ".py":
            testingLanguage = "python";
            confidence += 30;
            evidence.push(`Python test files found (${topCount})`);
            break;
          case ".java":
            testingLanguage = "java";
            confidence += 30;
            evidence.push(`Java test files found (${topCount})`);
            break;
          case ".cs":
            testingLanguage = "csharp";
            confidence += 30;
            evidence.push(`C# test files found (${topCount})`);
            break;
          case ".go":
            testingLanguage = "go";
            confidence += 30;
            evidence.push(`Go test files found (${topCount})`);
            break;
          case ".rs":
            testingLanguage = "rust";
            confidence += 30;
            evidence.push(`Rust test files found (${topCount})`);
            break;
        }
      }

      // If no test files found, assume same as primary language
      if (confidence < 20 && primaryLanguage !== "unknown") {
        testingLanguage = primaryLanguage;
        confidence = 50;
        evidence.push(`Assumed same as primary language: ${primaryLanguage}`);
      }

    } catch (error) {
      console.warn("Error detecting testing language:", error);
      evidence.push("Error during detection");
    }

    return {
      language: testingLanguage,
      confidence: Math.min(confidence, 100),
      evidence,
    };
  }

  /**
   * Analyze file extensions in the project to determine primary language
   */
  private async analyzeFileExtensions(projectPath: string): Promise<LanguageDetectionResult> {
    const extensionCounts = new Map<string, number>();
    const evidence: string[] = [];

    try {
      const files = await this.ide.listDir(projectPath);
      for (const [fileName] of files) {
        const ext = path.extname(fileName).toLowerCase();
        if (ext) {
          extensionCounts.set(ext, (extensionCounts.get(ext) || 0) + 1);
        }
      }

      const sortedExtensions = Array.from(extensionCounts.entries())
        .sort(([,a], [,b]) => b - a);

      if (sortedExtensions.length > 0) {
        const topExtension = sortedExtensions[0][0];
        const count = sortedExtensions[0][1];
        
        const languageMap: Record<string, string> = {
          ".js": "javascript",
          ".ts": "typescript", 
          ".py": "python",
          ".java": "java",
          ".cs": "csharp",
          ".go": "go",
          ".rs": "rust",
          ".cpp": "cpp",
          ".c": "c",
          ".rb": "ruby",
          ".php": "php",
        };

        const language = languageMap[topExtension] || "unknown";
        evidence.push(`File extension analysis: ${count} ${topExtension} files`);
        
        return {
          language,
          confidence: Math.min(count * 5, 50), // Max 50% confidence from file extensions
          evidence,
        };
      }
    } catch (error) {
      console.warn("Error analyzing file extensions:", error);
    }

    return {
      language: "unknown",
      confidence: 0,
      evidence: ["No files analyzed"],
    };
  }

  /**
   * Read and parse package.json if it exists
   */
  private async readPackageJson(projectPath: string): Promise<any | null> {
    try {
      const packageJsonPath = path.join(projectPath, "package.json");
      if (await this.ide.fileExists(packageJsonPath)) {
        const content = await this.ide.readFile(packageJsonPath);
        return JSON.parse(content);
      }
    } catch (error) {
      console.warn("Error reading package.json:", error);
    }
    return null;
  }

  /**
   * Detect the overall application framework (NextJS, Flask, Django, etc.)
   */
  async detectFramework(projectPath: string): Promise<string> {
    const evidence: string[] = [];
    let detectedFramework = "unknown";

    try {
      // Check for Node.js/JavaScript frameworks
      if (await this.ide.fileExists(path.join(projectPath, "package.json"))) {
        const packageJson = await this.readPackageJson(projectPath);
        if (packageJson) {
          const allDeps = {
            ...packageJson.dependencies,
            ...packageJson.devDependencies,
          };

          // NextJS - highest priority for React-based frameworks
          if (allDeps.next || 
              await this.ide.fileExists(path.join(projectPath, "next.config.js")) ||
              await this.ide.fileExists(path.join(projectPath, "next.config.ts"))) {
            detectedFramework = "nextjs";
            evidence.push("Next.js framework detected");
          }
          // Create React App
          else if (allDeps["react-scripts"] || 
                   (allDeps.react && await this.ide.fileExists(path.join(projectPath, "public/index.html")))) {
            detectedFramework = "create-react-app";
            evidence.push("Create React App detected");
          }
          // Vite
          else if (allDeps.vite || 
                   await this.ide.fileExists(path.join(projectPath, "vite.config.js")) ||
                   await this.ide.fileExists(path.join(projectPath, "vite.config.ts"))) {
            detectedFramework = "vite";
            evidence.push("Vite framework detected");
          }
          // Nuxt (Vue.js)
          else if (allDeps.nuxt || allDeps["@nuxt/core"]) {
            detectedFramework = "nuxt";
            evidence.push("Nuxt.js framework detected");
          }
          // Angular CLI
          else if (allDeps["@angular/core"] || allDeps["@angular/cli"]) {
            detectedFramework = "angular";
            evidence.push("Angular framework detected");
          }
          // Svelte/SvelteKit
          else if (allDeps.svelte || allDeps["@sveltejs/kit"]) {
            detectedFramework = "svelte";
            evidence.push("Svelte framework detected");
          }
          // Express.js
          else if (allDeps.express) {
            detectedFramework = "express";
            evidence.push("Express.js framework detected");
          }
          // Fastify
          else if (allDeps.fastify) {
            detectedFramework = "fastify";
            evidence.push("Fastify framework detected");
          }
          // NestJS
          else if (allDeps["@nestjs/core"] || allDeps["@nestjs/common"]) {
            detectedFramework = "nestjs";
            evidence.push("NestJS framework detected");
          }
          // React (generic)
          else if (allDeps.react) {
            detectedFramework = "react";
            evidence.push("React library detected");
          }
          // Vue (generic)
          else if (allDeps.vue) {
            detectedFramework = "vue";
            evidence.push("Vue.js library detected");
          }
          // Node.js (generic)
          else if (packageJson.engines?.node || packageJson.main || packageJson.type === "module") {
            detectedFramework = "node";
            evidence.push("Node.js project detected");
          }
        }
      }

      // Check for Python frameworks
      if (detectedFramework === "unknown") {
        // Django
        if (await this.ide.fileExists(path.join(projectPath, "manage.py")) ||
            await this.ide.fileExists(path.join(projectPath, "django")) ||
            await this.checkPythonDependency(projectPath, "django")) {
          detectedFramework = "django";
          evidence.push("Django framework detected");
        }
        // Flask
        else if (await this.checkPythonDependency(projectPath, "flask")) {
          detectedFramework = "flask";
          evidence.push("Flask framework detected");
        }
        // FastAPI
        else if (await this.checkPythonDependency(projectPath, "fastapi")) {
          detectedFramework = "fastapi";
          evidence.push("FastAPI framework detected");
        }
        // Streamlit
        else if (await this.checkPythonDependency(projectPath, "streamlit")) {
          detectedFramework = "streamlit";
          evidence.push("Streamlit framework detected");
        }
        // Gradio
        else if (await this.checkPythonDependency(projectPath, "gradio")) {
          detectedFramework = "gradio";
          evidence.push("Gradio framework detected");
        }
        // Jupyter
        else if (await this.checkPythonDependency(projectPath, "jupyter")) {
          detectedFramework = "jupyter";
          evidence.push("Jupyter framework detected");
        }
      }

      // Check for Java frameworks
      if (detectedFramework === "unknown") {
        // Spring Boot
        if (await this.ide.fileExists(path.join(projectPath, "pom.xml"))) {
          try {
            const pomContent = await this.ide.readFile(path.join(projectPath, "pom.xml"));
            if (pomContent.includes("spring-boot") || pomContent.includes("org.springframework.boot")) {
              detectedFramework = "spring-boot";
              evidence.push("Spring Boot framework detected");
            } else if (pomContent.includes("springframework")) {
              detectedFramework = "spring";
              evidence.push("Spring framework detected");
            }
          } catch (error) {
            // Could not read pom.xml
          }
        }
      }

      // Check for .NET frameworks
      if (detectedFramework === "unknown") {
        // ASP.NET Core
        try {
          const files = await this.ide.listDir(projectPath);
          for (const [fileName] of files) {
            if (fileName.endsWith(".csproj")) {
              const csprojContent = await this.ide.readFile(path.join(projectPath, fileName));
              if (csprojContent.includes("Microsoft.AspNetCore") || csprojContent.includes("AspNetCore")) {
                detectedFramework = "aspnet-core";
                evidence.push("ASP.NET Core framework detected");
                break;
              }
            }
          }
        } catch (error) {
          // Could not read project files
        }
      }

      // Check for Go frameworks
      if (detectedFramework === "unknown") {
        if (await this.ide.fileExists(path.join(projectPath, "go.mod"))) {
          try {
            const goModContent = await this.ide.readFile(path.join(projectPath, "go.mod"));
            
            // Gin
            if (goModContent.includes("github.com/gin-gonic/gin")) {
              detectedFramework = "gin";
              evidence.push("Gin framework detected");
            }
            // Echo
            else if (goModContent.includes("github.com/labstack/echo")) {
              detectedFramework = "echo";
              evidence.push("Echo framework detected");
            }
            // Fiber
            else if (goModContent.includes("github.com/gofiber/fiber")) {
              detectedFramework = "fiber";
              evidence.push("Fiber framework detected");
            }
            // Generic Go
            else {
              detectedFramework = "go";
              evidence.push("Go application detected");
            }
          } catch (error) {
            detectedFramework = "go";
            evidence.push("Go application detected");
          }
        }
      }

      // Check for Rust frameworks
      if (detectedFramework === "unknown") {
        if (await this.ide.fileExists(path.join(projectPath, "Cargo.toml"))) {
          try {
            const cargoContent = await this.ide.readFile(path.join(projectPath, "Cargo.toml"));
            
            // Axum
            if (cargoContent.includes("axum")) {
              detectedFramework = "axum";
              evidence.push("Axum framework detected");
            }
            // Actix
            else if (cargoContent.includes("actix-web")) {
              detectedFramework = "actix-web";
              evidence.push("Actix Web framework detected");
            }
            // Rocket
            else if (cargoContent.includes("rocket")) {
              detectedFramework = "rocket";
              evidence.push("Rocket framework detected");
            }
            // Generic Rust
            else {
              detectedFramework = "rust";
              evidence.push("Rust application detected");
            }
          } catch (error) {
            detectedFramework = "rust";
            evidence.push("Rust application detected");
          }
        }
      }

      // Check for Ruby frameworks
      if (detectedFramework === "unknown") {
        // Rails
        if (await this.ide.fileExists(path.join(projectPath, "Gemfile"))) {
          try {
            const gemfileContent = await this.ide.readFile(path.join(projectPath, "Gemfile"));
            if (gemfileContent.includes("rails")) {
              detectedFramework = "rails";
              evidence.push("Ruby on Rails framework detected");
            } else {
              detectedFramework = "ruby";
              evidence.push("Ruby application detected");
            }
          } catch (error) {
            detectedFramework = "ruby";
            evidence.push("Ruby application detected");
          }
        }
      }

      // Check for PHP frameworks
      if (detectedFramework === "unknown") {
        if (await this.ide.fileExists(path.join(projectPath, "composer.json"))) {
          try {
            const composerContent = await this.ide.readFile(path.join(projectPath, "composer.json"));
            const composerJson = JSON.parse(composerContent);
            
            // Laravel
            if (composerJson.require?.["laravel/framework"] || 
                await this.ide.fileExists(path.join(projectPath, "artisan"))) {
              detectedFramework = "laravel";
              evidence.push("Laravel framework detected");
            }
            // Symfony
            else if (composerJson.require?.["symfony/framework-bundle"]) {
              detectedFramework = "symfony";
              evidence.push("Symfony framework detected");
            }
            // Generic PHP
            else {
              detectedFramework = "php";
              evidence.push("PHP application detected");
            }
          } catch (error) {
            detectedFramework = "php";
            evidence.push("PHP application detected");
          }
        }
      }

      console.log("Framework detection:", { framework: detectedFramework, evidence });

    } catch (error) {
      console.warn("Error detecting framework:", error);
      evidence.push("Error during detection");
    }

    return detectedFramework;
  }

  /**
   * Check for Python dependency in requirements.txt, pyproject.toml, or setup.py
   */
  private async checkPythonDependency(projectPath: string, dependency: string): Promise<boolean> {
    try {
      // Check requirements.txt
      if (await this.ide.fileExists(path.join(projectPath, "requirements.txt"))) {
        const requirementsContent = await this.ide.readFile(path.join(projectPath, "requirements.txt"));
        if (requirementsContent.toLowerCase().includes(dependency.toLowerCase())) {
          return true;
        }
      }

      // Check pyproject.toml
      if (await this.ide.fileExists(path.join(projectPath, "pyproject.toml"))) {
        const pyprojectContent = await this.ide.readFile(path.join(projectPath, "pyproject.toml"));
        if (pyprojectContent.toLowerCase().includes(dependency.toLowerCase())) {
          return true;
        }
      }

      // Check setup.py
      if (await this.ide.fileExists(path.join(projectPath, "setup.py"))) {
        const setupContent = await this.ide.readFile(path.join(projectPath, "setup.py"));
        if (setupContent.toLowerCase().includes(dependency.toLowerCase())) {
          return true;
        }
      }
    } catch (error) {
      console.warn(`Error checking Python dependency ${dependency}:`, error);
    }

    return false;
  }

  /**
   * Check for common test directories
   */
  private async checkTestDirectories(projectPath: string): Promise<string[]> {
    const testDirs = ["test", "tests", "__tests__", "spec", "e2e", "integration", "src/test"];
    const foundDirs: string[] = [];

    for (const dir of testDirs) {
      try {
        const testDirPath = path.join(projectPath, dir);
        if (await this.ide.fileExists(testDirPath)) {
          foundDirs.push(dir);
        }
      } catch (error) {
        // Directory doesn't exist, continue
      }
    }

    return foundDirs;
  }
}

/**
 * Factory function to create a ProjectAnalyzer instance
 */
export function createProjectAnalyzer(ide: IDE): ProjectAnalyzer {
  return new ProjectAnalyzer(ide);
}