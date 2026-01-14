import { test, expect, vi } from "vitest";
import {
  transformJSX,
  createBlobURL,
  createImportMap,
  createPreviewHTML,
} from "../jsx-transformer";
import * as Babel from "@babel/standalone";

// Mock @babel/standalone
vi.mock("@babel/standalone", () => ({
  transform: vi.fn((code, options) => {
    // Simple mock that returns the code with some transformations
    if (options.filename?.endsWith(".tsx") || options.filename?.endsWith(".ts")) {
      return { code: code.replace(/const/g, "var") };
    }
    return { code };
  }),
}));

// Mock URL.createObjectURL
global.URL.createObjectURL = vi.fn((blob) => {
  return `blob:mock-url-${Math.random()}`;
});

test("transformJSX transforms TypeScript files with correct presets", () => {
  const code = `const Component = () => <div>Hello</div>;`;
  const result = transformJSX(code, "test.tsx", new Set());

  expect(result.error).toBeUndefined();
  expect(result.code).toBe("var Component = () => <div>Hello</div>;");
  expect(result.missingImports).toBeDefined();
});

test("transformJSX handles JavaScript files without TypeScript preset", () => {
  const code = `const Component = () => <div>Hello</div>;`;
  const result = transformJSX(code, "test.jsx", new Set());

  expect(result.error).toBeUndefined();
  expect(result.code).toBe(code);
  expect(result.missingImports).toBeDefined();
});

test("transformJSX collects imports from code", () => {
  const code = `
    import React from 'react';
    import { useState } from 'react';
    import Component from './Component';
    import { utils } from '../utils';
  `;
  const result = transformJSX(code, "test.jsx", new Set());

  expect(result.missingImports).toContain("react");
  expect(result.missingImports).toContain("./Component");
  expect(result.missingImports).toContain("../utils");
  expect(result.missingImports?.size).toBe(3);
});

test("transformJSX handles transform errors gracefully", () => {
  // Mock Babel to throw an error
  vi.mocked(Babel.transform).mockImplementationOnce(() => {
    throw new Error("Transform failed");
  });

  const result = transformJSX("invalid code", "test.jsx", new Set());

  expect(result.code).toBe("");
  expect(result.error).toBe("Transform failed");
  
  // Reset the mock
  vi.mocked(Babel.transform).mockReset();
});

test("createBlobURL creates blob with correct mime type", () => {
  const code = "console.log('test');";
  const url = createBlobURL(code);

  expect(URL.createObjectURL).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "application/javascript",
    })
  );
  expect(url).toMatch(/^blob:mock-url-/);
});

test("createBlobURL accepts custom mime type", () => {
  const code = "body { color: red; }";
  createBlobURL(code, "text/css");

  expect(URL.createObjectURL).toHaveBeenCalledWith(
    expect.objectContaining({
      type: "text/css",
    })
  );
});

test("createImportMap includes React CDN imports", () => {
  const files = new Map();
  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  expect(parsed.imports).toHaveProperty("react", "https://esm.sh/react@19");
  expect(parsed.imports).toHaveProperty("react-dom", "https://esm.sh/react-dom@19");
  expect(parsed.imports).toHaveProperty("react-dom/client", "https://esm.sh/react-dom@19/client");
  expect(parsed.imports).toHaveProperty("react/jsx-runtime", "https://esm.sh/react@19/jsx-runtime");
});

test("createImportMap transforms JavaScript and TypeScript files", () => {
  const files = new Map([
    ["/App.jsx", "export default function App() { return <div>App</div>; }"],
    ["/utils.ts", "export const helper = () => {};"],
    ["/styles.css", "body { margin: 0; }"],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Should have blob URLs for JS/TS files
  expect(parsed.imports["/App.jsx"]).toMatch(/^blob:mock-url-/);
  expect(parsed.imports["/utils.ts"]).toMatch(/^blob:mock-url-/);
  
  // Should not have CSS files
  expect(parsed.imports["/styles.css"]).toBeUndefined();
});

test("createImportMap creates multiple path variations for files", () => {
  const files = new Map([
    ["/components/Button.jsx", "export default function Button() {}"],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // All these variations should point to the same blob URL
  const blobUrl = parsed.imports["/components/Button.jsx"];
  expect(parsed.imports["components/Button.jsx"]).toBe(blobUrl);
  expect(parsed.imports["@/components/Button.jsx"]).toBe(blobUrl);
  expect(parsed.imports["@/components/Button.jsx"]).toBe(blobUrl);
  expect(parsed.imports["/components/Button"]).toBe(blobUrl);
  expect(parsed.imports["components/Button"]).toBe(blobUrl);
  expect(parsed.imports["@/components/Button"]).toBe(blobUrl);
});

test("createImportMap creates placeholder modules for missing imports", () => {
  const files = new Map([
    ["/App.jsx", "import Button from './components/Button'; export default function App() {}"],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Should create placeholder for missing Button component
  expect(parsed.imports["./components/Button"]).toBeDefined();
  expect(parsed.imports["./components/Button"]).toMatch(/^blob:mock-url-/);
});

test("createImportMap handles @/ alias imports", () => {
  const files = new Map([
    ["/App.jsx", "import { utils } from '@/lib/utils'; export default function App() {}"],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Should create placeholder with proper variations
  expect(parsed.imports["@/lib/utils"]).toBeDefined();
  expect(parsed.imports["/lib/utils"]).toBeDefined();
  expect(parsed.imports["lib/utils"]).toBeDefined();
});

test("createPreviewHTML generates valid HTML with import map", () => {
  const importMap = JSON.stringify({
    imports: {
      "/App.jsx": "blob:mock-url-123",
      "react": "https://esm.sh/react@19",
    },
  });

  const html = createPreviewHTML("/App.jsx", importMap);

  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain('<div id="root"></div>');
  expect(html).toContain('type="importmap"');
  expect(html).toContain(importMap);
  expect(html).toContain("blob:mock-url-123");
  expect(html).toContain("import('blob:mock-url-123')");
});

test("createPreviewHTML includes Tailwind CSS", () => {
  const html = createPreviewHTML("/App.jsx", "{}");
  expect(html).toContain("https://cdn.tailwindcss.com");
});

test("createPreviewHTML includes error boundary", () => {
  const html = createPreviewHTML("/App.jsx", "{}");
  expect(html).toContain("class ErrorBoundary");
  expect(html).toContain("componentDidCatch");
  expect(html).toContain("error-boundary");
});

test("createPreviewHTML handles invalid import map gracefully", () => {
  // Mock console.error to prevent noise in test output
  const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  
  const invalidImportMap = "{ invalid json";
  const html = createPreviewHTML("/App.jsx", invalidImportMap);

  // Should still generate HTML with the entry point
  expect(html).toContain("/App.jsx");
  // The error is logged to console, not included in HTML
  expect(html).toContain("console.error('Failed to load app:', error)");
  
  // Restore console.error
  consoleErrorSpy.mockRestore();
});

test("integration: full transformation pipeline works", () => {
  const files = new Map([
    ["/App.jsx", `
      import React from 'react';
      import Button from './Button';
      
      export default function App() {
        return <div><Button /></div>;
      }
    `],
    ["/Button.jsx", `
      export default function Button() {
        return <button>Click me</button>;
      }
    `],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Both components should be transformed
  expect(parsed.imports["/App.jsx"]).toMatch(/^blob:mock-url-/);
  expect(parsed.imports["/Button.jsx"]).toMatch(/^blob:mock-url-/);

  // Import variations should exist
  expect(parsed.imports["./Button"]).toBeDefined();
  expect(parsed.imports["/Button"]).toBeDefined();

  // Create preview HTML
  const html = createPreviewHTML("/App.jsx", result.importMap);
  expect(html).toContain(parsed.imports["/App.jsx"]);
});

// CSS Support Tests
test("transformJSX detects CSS imports", () => {
  const code = `
    import React from 'react';
    import './styles.css';
    import '@/styles/globals.css';
    import "../components/Button.css";
    
    export default function App() { return <div>App</div>; }
  `;
  const result = transformJSX(code, "App.jsx", new Set());
  
  expect(result.cssImports).toBeDefined();
  expect(result.cssImports).toContain("./styles.css");
  expect(result.cssImports).toContain("@/styles/globals.css");
  expect(result.cssImports).toContain("../components/Button.css");
});

test("transformJSX removes CSS imports from transformed code", () => {
  const code = `
    import React from 'react';
    import './styles.css';
    
    export default function App() { return <div>App</div>; }
  `;
  const result = transformJSX(code, "App.jsx", new Set());
  
  expect(result.code).not.toContain("import './styles.css'");
  expect(result.code).toContain("React");
});

test("transformJSX handles CSS imports with different quotes", () => {
  const code = `
    import './single.css';
    import "./double.css";
    import '@/styles/globals.css';
  `;
  const result = transformJSX(code, "App.jsx", new Set());
  
  expect(result.cssImports).toContain("./single.css");
  expect(result.cssImports).toContain("./double.css");
  expect(result.cssImports).toContain("@/styles/globals.css");
});

test("createImportMap collects CSS files and returns styles", () => {
  const files = new Map([
    ["/App.jsx", `import './styles.css'; export default function App() {}`],
    ["/styles.css", `body { margin: 0; } .container { padding: 20px; }`],
    ["/globals.css", `* { box-sizing: border-box; }`],
  ]);
  
  const result = createImportMap(files);
  
  // Should return an object with imports and styles
  expect(result).toHaveProperty("importMap");
  expect(result).toHaveProperty("styles");
  
  // Should collect CSS content
  expect(result.styles).toContain("body { margin: 0; }");
  expect(result.styles).toContain("* { box-sizing: border-box; }");
});

test("createImportMap handles missing CSS files gracefully", () => {
  const files = new Map([
    ["/App.jsx", `import './missing.css'; export default function App() {}`],
  ]);
  
  const result = createImportMap(files);
  
  // Should not throw error
  expect(result.styles).toBeDefined();
  // Could include comment about missing file
  expect(result.styles).toContain("/* ./missing.css not found */");
});

test("createImportMap resolves CSS import paths correctly", () => {
  const files = new Map([
    ["/src/App.jsx", `import '@/styles/globals.css'; export default function App() {}`],
    ["/styles/globals.css", `body { background: white; }`],
  ]);
  
  const result = createImportMap(files);
  expect(result.styles).toContain("body { background: white; }");
});

test("createPreviewHTML injects CSS styles into head", () => {
  const styles = `
    body { margin: 0; }
    .container { padding: 20px; }
  `;
  
  const html = createPreviewHTML("/App.jsx", "{}", styles);
  
  expect(html).toContain("<style>");
  expect(html).toContain("body { margin: 0; }");
  expect(html).toContain(".container { padding: 20px; }");
});

test("createPreviewHTML handles empty CSS gracefully", () => {
  const html = createPreviewHTML("/App.jsx", "{}", "");
  
  // Should not break without styles
  expect(html).toContain("<!DOCTYPE html>");
  expect(html).toContain('<div id="root"></div>');
});

test("createPreviewHTML preserves existing styles with CSS injection", () => {
  const customStyles = "h1 { color: blue; }";
  const html = createPreviewHTML("/App.jsx", "{}", customStyles);
  
  // Should have both Tailwind and custom styles
  expect(html).toContain("https://cdn.tailwindcss.com");
  expect(html).toContain("h1 { color: blue; }");
  // Existing styles should remain
  expect(html).toContain("body {");
  expect(html).toContain(".error-boundary {");
});

test("integration: full pipeline handles components with CSS imports", () => {
  const files = new Map([
    ["/App.jsx", `
      import React from 'react';
      import './App.css';
      import '@/styles/globals.css';
      
      export default function App() {
        return <div className="container">Hello</div>;
      }
    `],
    ["/App.css", `.container { max-width: 1200px; margin: 0 auto; }`],
    ["/styles/globals.css", `body { font-family: sans-serif; }`],
  ]);
  
  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);
  
  // JS files should be in import map
  expect(parsed.imports["/App.jsx"]).toMatch(/^blob:mock-url-/);
  
  // CSS should be collected
  expect(result.styles).toContain(".container { max-width: 1200px;");
  expect(result.styles).toContain("body { font-family: sans-serif;");
  
  // HTML should include CSS
  const html = createPreviewHTML("/App.jsx", result.importMap, result.styles);
  expect(html).toContain(".container { max-width: 1200px;");
});

// Error handling tests
test("createImportMap handles syntax errors gracefully", () => {
  // Mock Babel to throw error for BadComponent
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/BadComponent.jsx") {
      throw new Error("Unexpected token: Missing closing tag");
    }
    // Return transformed code for other files
    if (options.filename?.endsWith(".tsx") || options.filename?.endsWith(".ts")) {
      return { code: code.replace(/const/g, "var") };
    }
    return { code };
  });
  
  const files = new Map([
    ["/App.jsx", `export default function App() { return <div>Hello</div>; }`],
    ["/BadComponent.jsx", `
      export default function BadComponent() {
        return <div>Missing closing tag
      }
    `],
  ]);
  
  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);
  
  // Good file should be in import map
  expect(parsed.imports["/App.jsx"]).toMatch(/^blob:mock-url-/);
  // Bad file should NOT be in import map anymore
  expect(parsed.imports["/BadComponent.jsx"]).toBeUndefined();
  
  // Should have error for BadComponent
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].path).toBe("/BadComponent.jsx");
  expect(result.errors[0].error).toBe("Unexpected token: Missing closing tag");
  
  // Restore mock
  vi.mocked(Babel.transform).mockReset();
});

test("createPreviewHTML displays syntax errors", () => {
  const errors = [
    { path: "/Component.jsx", error: "Unexpected token" },
    { path: "/Another.jsx", error: "Missing semicolon" }
  ];
  
  const html = createPreviewHTML("/App.jsx", "{}", "", errors);
  
  // Should show error section
  expect(html).toContain("Syntax Errors (2)");
  expect(html).toContain("/Component.jsx");
  expect(html).toContain("Unexpected token");
  expect(html).toContain("/Another.jsx");
  expect(html).toContain("Missing semicolon");
  
  // Should NOT include the app script when there are errors
  expect(html).not.toContain("loadApp()");
});

test("files with syntax errors are not included in import map", () => {
  // Mock Babel to throw error for BadComponent
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/BadComponent.jsx") {
      throw new Error("Syntax error in BadComponent");
    }
    // Return default mock behavior for other files
    return { code };
  });
  
  const files = new Map([
    ["/App.jsx", `
      import BadComponent from './BadComponent';
      export default function App() { 
        return <div><BadComponent /></div>; 
      }
    `],
    ["/BadComponent.jsx", `
      export default function BadComponent() {
        return <div>Missing closing tag
      }
    `],
  ]);
  
  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);
  
  // BadComponent should NOT be in import map anymore
  expect(parsed.imports["/BadComponent.jsx"]).toBeUndefined();
  expect(parsed.imports["/BadComponent"]).toBeUndefined();
  
  // But a placeholder should be created for the import
  expect(parsed.imports["./BadComponent"]).toBeDefined();
  
  // Should have error tracked
  expect(result.errors.some(e => e.path === "/BadComponent.jsx")).toBe(true);

  // Restore mock
  vi.mocked(Babel.transform).mockReset();
});

// Additional comprehensive error handling tests
test("transformJSX handles non-Error exceptions", () => {
  vi.mocked(Babel.transform).mockImplementationOnce(() => {
    throw "String error";
  });

  const result = transformJSX("code", "test.jsx", new Set());

  expect(result.code).toBe("");
  expect(result.error).toBe("Unknown transform error");

  vi.mocked(Babel.transform).mockReset();
});

test("transformJSX handles null return from Babel", () => {
  vi.mocked(Babel.transform).mockImplementationOnce(() => {
    return { code: null };
  });

  const result = transformJSX("code", "test.jsx", new Set());

  expect(result.code).toBe("");
  expect(result.error).toBeUndefined();

  vi.mocked(Babel.transform).mockReset();
});

test("createImportMap handles multiple files with syntax errors", () => {
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/Error1.jsx") {
      throw new Error("Unexpected token (10:15)");
    }
    if (options.filename === "/Error2.tsx") {
      throw new Error("Missing closing bracket (25:3)");
    }
    if (options.filename === "/Error3.js") {
      throw new Error("Invalid JSX syntax");
    }
    return { code };
  });

  const files = new Map([
    ["/App.jsx", `export default function App() {}`],
    ["/Error1.jsx", `invalid code`],
    ["/Error2.tsx", `more invalid code`],
    ["/Error3.js", `yet more invalid`],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Good file should be in import map
  expect(parsed.imports["/App.jsx"]).toBeDefined();

  // Error files should NOT be in import map
  expect(parsed.imports["/Error1.jsx"]).toBeUndefined();
  expect(parsed.imports["/Error2.tsx"]).toBeUndefined();
  expect(parsed.imports["/Error3.js"]).toBeUndefined();

  // Should have 3 errors
  expect(result.errors).toHaveLength(3);
  expect(result.errors[0]).toEqual({ path: "/Error1.jsx", error: "Unexpected token (10:15)" });
  expect(result.errors[1]).toEqual({ path: "/Error2.tsx", error: "Missing closing bracket (25:3)" });
  expect(result.errors[2]).toEqual({ path: "/Error3.js", error: "Invalid JSX syntax" });

  vi.mocked(Babel.transform).mockReset();
});

test("createPreviewHTML formats error messages with line numbers", () => {
  const errors = [
    { path: "/Component.jsx", error: "Unexpected token: } (15:10)" },
    { path: "/Utils.ts", error: "Cannot read property 'map' of undefined (42:25)" },
  ];

  const html = createPreviewHTML("/App.jsx", "{}", "", errors);

  // Should extract and display line:column separately
  expect(html).toContain("15:10");
  expect(html).toContain("42:25");
  expect(html).toContain("error-location");
});

test("createPreviewHTML escapes HTML in error messages", () => {
  const errors = [
    { path: "/Component.jsx", error: "Expected <div> but found <span>" },
  ];

  const html = createPreviewHTML("/App.jsx", "{}", "", errors);

  // Should escape < and > to prevent XSS
  expect(html).toContain("&lt;div&gt;");
  expect(html).toContain("&lt;span&gt;");
  expect(html).not.toContain("Expected <div>");
});

test("createPreviewHTML shows single vs plural error count", () => {
  const singleError = [{ path: "/Test.jsx", error: "Error" }];
  const multipleErrors = [
    { path: "/Test1.jsx", error: "Error 1" },
    { path: "/Test2.jsx", error: "Error 2" },
  ];

  const htmlSingle = createPreviewHTML("/App.jsx", "{}", "", singleError);
  const htmlMultiple = createPreviewHTML("/App.jsx", "{}", "", multipleErrors);

  // Should use singular form for one error
  expect(htmlSingle).toContain("Syntax Error (1)");
  expect(htmlSingle).not.toContain("Syntax Errors");

  // Should use plural form for multiple errors
  expect(htmlMultiple).toContain("Syntax Errors (2)");
});

test("createPreviewHTML handles errors without line numbers", () => {
  const errors = [
    { path: "/Component.jsx", error: "Generic syntax error without line info" },
  ];

  const html = createPreviewHTML("/App.jsx", "{}", "", errors);

  expect(html).toContain("Generic syntax error without line info");
  expect(html).toContain("/Component.jsx");
  // Should not have error-location span if no line number
  const errorItemMatch = html.match(/<div class="error-item">[\s\S]*?<\/div>/);
  expect(errorItemMatch).toBeTruthy();
});

test("createImportMap continues processing valid files after encountering errors", () => {
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/Error.jsx") {
      throw new Error("Syntax error");
    }
    return { code };
  });

  const files = new Map([
    ["/App.jsx", `export default function App() { return <div>Valid</div>; }`],
    ["/Error.jsx", `invalid syntax`],
    ["/Component.jsx", `export default function Component() { return <span>Also valid</span>; }`],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  // Valid files should be processed
  expect(parsed.imports["/App.jsx"]).toBeDefined();
  expect(parsed.imports["/Component.jsx"]).toBeDefined();

  // Error file should not be included
  expect(parsed.imports["/Error.jsx"]).toBeUndefined();

  // Should have exactly 1 error
  expect(result.errors).toHaveLength(1);

  vi.mocked(Babel.transform).mockReset();
});

test("createImportMap handles errors in files with CSS imports", () => {
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/BadWithCSS.jsx") {
      throw new Error("Syntax error in component with CSS");
    }
    return { code };
  });

  const files = new Map([
    ["/BadWithCSS.jsx", `
      import './styles.css';
      export default function BadComponent() {
        return <div>Missing closing tag
      }
    `],
    ["/styles.css", `body { margin: 0; }`],
  ]);

  const result = createImportMap(files);

  // Should still collect CSS even if JS has error
  expect(result.styles).toContain("body { margin: 0; }");

  // Should have error for the bad component
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].path).toBe("/BadWithCSS.jsx");

  vi.mocked(Babel.transform).mockReset();
});

test("createImportMap returns empty errors array when all files are valid", () => {
  const files = new Map([
    ["/App.jsx", `export default function App() {}`],
    ["/Component.jsx", `export default function Component() {}`],
  ]);

  const result = createImportMap(files);

  expect(result.errors).toHaveLength(0);
  expect(Array.isArray(result.errors)).toBe(true);
});

test("transformJSX handles errors with complex error objects", () => {
  vi.mocked(Babel.transform).mockImplementationOnce(() => {
    const error = new Error("Syntax error");
    (error as any).loc = { line: 10, column: 5 };
    (error as any).code = "BABEL_PARSE_ERROR";
    throw error;
  });

  const result = transformJSX("code", "test.jsx", new Set());

  expect(result.code).toBe("");
  expect(result.error).toContain("Syntax error");

  vi.mocked(Babel.transform).mockReset();
});

test("createPreviewHTML with errors does not render app script", () => {
  const errors = [{ path: "/Test.jsx", error: "Error" }];
  const html = createPreviewHTML("/App.jsx", "{}", "", errors);

  // Should not have script that loads the app
  expect(html).not.toContain("async function loadApp()");
  expect(html).not.toContain("loadApp()");
  expect(html).not.toContain("import(");
});

test("createPreviewHTML without errors renders app script", () => {
  const html = createPreviewHTML("/App.jsx", "{}", "", []);

  // Should have script that loads the app
  expect(html).toContain("async function loadApp()");
  expect(html).toContain("loadApp()");
});

test("createImportMap handles TypeScript transformation errors", () => {
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename?.endsWith(".tsx") && code.includes("invalid")) {
      throw new Error("TypeScript syntax error");
    }
    if (options.filename?.endsWith(".tsx") || options.filename?.endsWith(".ts")) {
      return { code: code.replace(/const/g, "var") };
    }
    return { code };
  });

  const files = new Map([
    ["/Valid.tsx", `const x = 1;`],
    ["/Invalid.tsx", `invalid TypeScript syntax`],
  ]);

  const result = createImportMap(files);
  const parsed = JSON.parse(result.importMap);

  expect(parsed.imports["/Valid.tsx"]).toBeDefined();
  expect(parsed.imports["/Invalid.tsx"]).toBeUndefined();
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0].error).toBe("TypeScript syntax error");

  vi.mocked(Babel.transform).mockReset();
});

test("integration: error handling doesn't break entire preview", () => {
  vi.mocked(Babel.transform).mockImplementation((code, options) => {
    if (options.filename === "/ErrorComponent.jsx") {
      throw new Error("Component has syntax error (20:5)");
    }
    return { code };
  });

  const files = new Map([
    ["/App.jsx", `
      import React from 'react';
      import './App.css';
      export default function App() { return <div>Working App</div>; }
    `],
    ["/ErrorComponent.jsx", `invalid code`],
    ["/App.css", `body { margin: 0; }`],
  ]);

  const result = createImportMap(files);
  const html = createPreviewHTML("/App.jsx", result.importMap, result.styles, result.errors);

  // Should show error for ErrorComponent
  expect(result.errors).toHaveLength(1);
  expect(html).toContain("Syntax Error (1)");
  expect(html).toContain("/ErrorComponent.jsx");
  expect(html).toContain("20:5");

  // CSS should still be included
  expect(result.styles).toContain("body { margin: 0; }");

  vi.mocked(Babel.transform).mockReset();
});