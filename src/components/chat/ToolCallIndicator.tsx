import { Loader2 } from "lucide-react";

interface ToolCallIndicatorProps {
  toolName: string;
  args: any;
  state: "partial-call" | "call" | "result" | "error";
}

function getToolCallMessage(toolName: string, args: any): string {
  if (toolName === "str_replace_editor" && args) {
    const command = args.command;
    const path = args.path;

    if (!path) {
      return "Using editor";
    }

    switch (command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
        return `Editing ${path}`;
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Viewing ${path}`;
      default:
        return `Editing ${path}`;
    }
  }

  if (toolName === "file_manager" && args) {
    const command = args.command;
    const path = args.path;
    const newPath = args.new_path;

    if (!path) {
      return "Managing files";
    }

    switch (command) {
      case "rename":
        return newPath ? `Renaming ${path} to ${newPath}` : `Renaming ${path}`;
      case "delete":
        return `Deleting ${path}`;
      default:
        return `Managing ${path}`;
    }
  }

  return toolName.replace(/_/g, " ");
}

export function ToolCallIndicator({ toolName, args, state }: ToolCallIndicatorProps) {
  const message = getToolCallMessage(toolName, args);
  const isComplete = state === "result";

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs border border-neutral-200">
      {isComplete ? (
        <>
          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
          <span className="text-neutral-700">{message}</span>
        </>
      ) : (
        <>
          <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
          <span className="text-neutral-700">{message}</span>
        </>
      )}
    </div>
  );
}
