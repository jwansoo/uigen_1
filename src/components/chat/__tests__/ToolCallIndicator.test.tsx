import { describe, test, expect, afterEach } from "vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { ToolCallIndicator } from "../ToolCallIndicator";

afterEach(() => {
  cleanup();
});

describe("ToolCallIndicator", () => {
  describe("str_replace_editor tool", () => {
    test("displays 'Creating' for create command", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Creating /App.jsx");
      expect(element).toBeDefined();
    });

    test("displays 'Editing' for str_replace command", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "str_replace", path: "/components/Button.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Editing /components/Button.jsx");
      expect(element).toBeDefined();
    });

    test("displays 'Editing' for insert command", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "insert", path: "/utils/helpers.js" }}
          state="call"
        />
      );

      const element = screen.getByText("Editing /utils/helpers.js");
      expect(element).toBeDefined();
    });

    test("displays 'Viewing' for view command", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "view", path: "/README.md" }}
          state="call"
        />
      );

      const element = screen.getByText("Viewing /README.md");
      expect(element).toBeDefined();
    });

    test("displays 'Using editor' when path is missing", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create" }}
          state="call"
        />
      );

      const element = screen.getByText("Using editor");
      expect(element).toBeDefined();
    });

    test("displays 'Editing' for unknown command with path", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "unknown", path: "/test.js" }}
          state="call"
        />
      );

      const element = screen.getByText("Editing /test.js");
      expect(element).toBeDefined();
    });
  });

  describe("file_manager tool", () => {
    test("displays 'Renaming' for rename command with new_path", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ command: "rename", path: "/old.jsx", new_path: "/new.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Renaming /old.jsx to /new.jsx");
      expect(element).toBeDefined();
    });

    test("displays 'Renaming' for rename command without new_path", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ command: "rename", path: "/old.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Renaming /old.jsx");
      expect(element).toBeDefined();
    });

    test("displays 'Deleting' for delete command", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ command: "delete", path: "/temp.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Deleting /temp.jsx");
      expect(element).toBeDefined();
    });

    test("displays 'Managing files' when path is missing", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ command: "delete" }}
          state="call"
        />
      );

      const element = screen.getByText("Managing files");
      expect(element).toBeDefined();
    });

    test("displays 'Managing' for unknown command with path", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ command: "unknown", path: "/test.js" }}
          state="call"
        />
      );

      const element = screen.getByText("Managing /test.js");
      expect(element).toBeDefined();
    });
  });

  describe("unknown tools", () => {
    test("displays formatted tool name for unknown tool", () => {
      render(
        <ToolCallIndicator
          toolName="some_custom_tool"
          args={{}}
          state="call"
        />
      );

      const element = screen.getByText("some custom tool");
      expect(element).toBeDefined();
    });

    test("handles tool with no args", () => {
      render(
        <ToolCallIndicator
          toolName="test_tool"
          args={null}
          state="call"
        />
      );

      const element = screen.getByText("test tool");
      expect(element).toBeDefined();
    });
  });

  describe("visual states", () => {
    test("shows spinner when state is not 'result'", () => {
      const { container } = render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="call"
        />
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeDefined();
    });

    test("shows green dot when state is 'result'", () => {
      const { container } = render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="result"
        />
      );

      const greenDot = container.querySelector(".bg-emerald-500");
      expect(greenDot).toBeDefined();

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeNull();
    });

    test("shows spinner for 'partial-call' state", () => {
      const { container } = render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="partial-call"
        />
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeDefined();
    });

    test("shows spinner for 'error' state", () => {
      const { container } = render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="error"
        />
      );

      const spinner = container.querySelector(".animate-spin");
      expect(spinner).toBeDefined();
    });
  });

  describe("styling", () => {
    test("applies correct CSS classes", () => {
      const { container } = render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/App.jsx" }}
          state="call"
        />
      );

      const indicator = container.firstChild as HTMLElement;
      expect(indicator.className).toContain("inline-flex");
      expect(indicator.className).toContain("items-center");
      expect(indicator.className).toContain("gap-2");
      expect(indicator.className).toContain("bg-neutral-50");
      expect(indicator.className).toContain("rounded-lg");
      expect(indicator.className).toContain("text-xs");
    });
  });

  describe("edge cases", () => {
    test("handles empty args object", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{}}
          state="call"
        />
      );

      const element = screen.getByText("Using editor");
      expect(element).toBeDefined();
    });

    test("handles null command in str_replace_editor", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ path: "/test.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Editing /test.jsx");
      expect(element).toBeDefined();
    });

    test("handles null command in file_manager", () => {
      render(
        <ToolCallIndicator
          toolName="file_manager"
          args={{ path: "/test.jsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Managing /test.jsx");
      expect(element).toBeDefined();
    });

    test("handles special characters in file paths", () => {
      render(
        <ToolCallIndicator
          toolName="str_replace_editor"
          args={{ command: "create", path: "/components/Button-v2.test.tsx" }}
          state="call"
        />
      );

      const element = screen.getByText("Creating /components/Button-v2.test.tsx");
      expect(element).toBeDefined();
    });
  });
});
