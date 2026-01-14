# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

UIGen is an AI-powered React component generator with live preview. It uses Claude AI to generate React components based on user descriptions, displays them in real-time with hot reload, and maintains all files in a virtual file system (no disk writes).

## Common Commands

### Setup
```bash
npm run setup
```
Installs dependencies, generates Prisma client, and runs database migrations.

### Development
```bash
npm run dev
```
Starts the Next.js development server with Turbopack on http://localhost:3000.

```bash
npm run dev:daemon
```
Starts the server in daemon mode, writing logs to logs.txt.

### Testing
```bash
npm test
```
Runs all tests with Vitest in watch mode.

To run tests for a specific file:
```bash
npm test -- path/to/test-file.test.tsx
```

### Build & Production
```bash
npm run build
npm start
```

### Database
```bash
npm run db:reset
```
Resets the database (destructive operation).

```bash
npx prisma generate
```
Regenerates Prisma client after schema changes.

```bash
npx prisma migrate dev
```
Creates and applies new database migrations.

## Architecture

### Core Systems

**Virtual File System (`src/lib/file-system.ts`)**
- All component files exist only in memory via `VirtualFileSystem` class
- Provides CRUD operations: `createFile`, `updateFile`, `deleteFile`, `rename`
- Supports hierarchical directory structure with automatic parent creation
- Serializes to/from JSON for database persistence
- Never writes to actual disk during component generation

**AI Tool Integration (`src/lib/tools/`)**
- `str-replace.ts`: Text editor tool for creating/editing files with line-based operations
- `file-manager.ts`: Handles file/folder rename and delete operations
- Both tools operate on the VirtualFileSystem instance
- Tools are provided to Claude via Vercel AI SDK's `streamText` function

**JSX Transformation Pipeline (`src/lib/transform/jsx-transformer.ts`)**
- Uses Babel standalone to transform JSX/TSX to executable JavaScript
- Creates blob URLs for transformed modules
- Generates ES Module import maps for browser consumption
- Handles `@/` path alias (maps to root `/`)
- Supports third-party packages via esm.sh CDN
- Collects CSS imports and inline styles
- Creates placeholder modules for missing imports
- Returns syntax errors for invalid code to display in preview

**Live Preview (`src/components/preview/PreviewFrame.tsx`)**
- Renders sandboxed iframe with transformed code
- Entry point: `/App.jsx` (or `/App.tsx`, `/index.jsx`, etc.)
- Includes Tailwind CSS via CDN
- Uses ES Module import maps for module resolution
- Auto-reloads on file system changes via `refreshTrigger`
- Displays syntax errors with formatted error messages

### Data Flow

1. **User Message** → Chat API (`src/app/api/chat/route.ts`)
2. **Claude Response** → Uses tools (`str_replace_editor`, `file_manager`) to manipulate VirtualFileSystem
3. **Tool Calls** → Intercepted by `ChatContext` (`src/lib/contexts/chat-context.tsx`)
4. **File Updates** → Trigger `FileSystemContext` refresh
5. **Preview Update** → JSX transformer processes files → Preview iframe reloads

### Context Providers

**FileSystemProvider** (`src/lib/contexts/file-system-context.tsx`)
- Manages VirtualFileSystem instance
- Tracks selected file in editor
- Handles tool calls from AI (creates/updates files based on AI actions)
- Triggers UI refresh via `refreshTrigger` counter
- Deserializes initial project data from database

**ChatProvider** (`src/lib/contexts/chat-context.tsx`)
- Wraps Vercel AI SDK's `useChat` hook
- Sends VirtualFileSystem state with each message
- Forwards tool calls to FileSystemContext
- Tracks anonymous user work for persistence prompts

### Authentication & Persistence

**Auth System** (`src/lib/auth.ts`)
- JWT-based authentication using `jose` library
- Sessions stored in HTTP-only cookies
- Supports anonymous users (no userId in Project table)

**Database Schema** (`prisma/schema.prisma`)
- SQLite database with Prisma ORM
- `User`: email, password (bcrypt hashed)
- `Project`: stores `messages` (JSON) and `data` (serialized VirtualFileSystem)
- Prisma client generated to `src/generated/prisma`
- **Reference `prisma/schema.prisma` whenever you need to understand the database structure**

**Project Persistence**
- Projects auto-save after each AI response completion
- Anonymous work tracked in localStorage via `anon-work-tracker.ts`
- Prompts user to sign up if they have unsaved work

### UI Components

**Chat Interface** (`src/components/chat/`)
- `ChatInterface.tsx`: Main container with message list and input
- `MessageList.tsx`: Displays conversation history with tool call indicators
- `MessageInput.tsx`: Textarea with submit handling
- `MarkdownRenderer.tsx`: Renders assistant messages with syntax highlighting

**Editor** (`src/components/editor/`)
- `CodeEditor.tsx`: Monaco editor for viewing/editing files
- `FileTree.tsx`: Hierarchical file browser with expand/collapse

**Layout** (`src/app/page.tsx`, `src/app/[projectId]/page.tsx`)
- Resizable panels (chat, editor, preview) via `react-resizable-panels`
- Tabs to switch between editor and preview views

## Tech Stack

- **Framework**: Next.js 15 (App Router) with React 19
- **Styling**: Tailwind CSS v4
- **Database**: Prisma with SQLite
- **AI**: Anthropic Claude via Vercel AI SDK
- **Editor**: Monaco Editor
- **UI Components**: Radix UI primitives
- **Testing**: Vitest + React Testing Library

## Development Notes

### AI Prompts

The system prompt (`src/lib/prompts/generation.tsx`) instructs Claude to:
- Create React components with `/App.jsx` as entry point
- Style with Tailwind CSS (not inline styles)
- Use `@/` import alias for local files
- Never create HTML files
- Operate on virtual file system at root `/`

### Path Alias Resolution

The `@/` alias maps to the root `/` directory:
- Import: `import Foo from '@/components/Foo'`
- Resolves to: `/components/Foo.jsx`
- Transformer creates import map entries for all path variations

### Testing Strategy

Tests located in `__tests__` directories alongside source files:
- Component tests use React Testing Library
- Context tests mock dependencies
- File system tests verify CRUD operations

### Mock Provider

When `ANTHROPIC_API_KEY` is not set, the app uses a mock provider that returns static code instead of calling Claude API. The mock provider uses fewer steps (4 vs 40) to prevent repetitive responses.

### Streaming Response

The chat API uses `streamText` which:
- Streams responses token-by-token to client
- Executes tool calls during generation
- Saves final messages to database in `onFinish` callback
- Has 120-second timeout (`maxDuration`)

### Code Style

Use comments sparingly. Only comment complex code.
