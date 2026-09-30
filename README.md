# MerkPDF — Modern Markdown Editor & PDF Exporter

A fast, elegant, and distraction-free Markdown editor built with Next.js, React 19, and Tailwind CSS v4. Write in Markdown with live preview and instantly export publication-quality, pixel-accurate PDFs with support for tables, comprehensive code syntax highlighting (including JSX/TSX), KaTeX math formulas, ASCII architecture diagrams, and vector Mermaid charts.

![MerkPDF Preview](public/preview.png)

## Features

- **Live Split-Pane Preview**: Write Markdown on the left and see clean, beautifully formatted output on the right in real time. Switch between Split, Edit-only, and Preview-only views anytime.
- **Rich Formatting Toolbar**: Quick-insertion toolbar for Bold, Italic, Strikethrough, Code, Headings, Quotes, Lists (bullet, numbered, checklist), Links, Images, Tables, Math, and Diagrams.
- **Editor Ergonomics**:
  - Tab indentation & Shift+Tab unindentation (2 spaces)
  - Auto-closing pairs for parentheses, brackets, braces, backticks, and quotes
  - Global shortcuts:
    - `Cmd/Ctrl + P` or `Cmd/Ctrl + E`: Instant PDF Export
    - `Cmd/Ctrl + B`: Bold
    - `Cmd/Ctrl + I`: Italic
    - `Cmd/Ctrl + K`: Link
    - `Cmd/Ctrl + S`: Quick save to browser localStorage
  - Live document stats (Lines, Words, Characters, Estimated Reading Time) and persistent auto-save.
- **Comprehensive Syntax Highlighting**:
  - Powered by `rehype-highlight`, `lowlight`, and `highlight.js` with support for 38+ languages and aliases.
  - **Full JSX & TSX support**: Components (`<Button>`), props, hooks, expressions, and TypeScript types.
  - **Systems & Web**: Python, Go, Rust, Java, Kotlin, Swift, C, C++, C#, PHP, Ruby, SQL, GraphQL, HTML/XML, CSS, SCSS.
  - **DevOps & Cloud**: Bash/Zsh, Dockerfile, Nginx configs, YAML, TOML/INI, Makefiles, Diff.
  - One-click copy buttons and uppercase language badge headers.
  - Official GitHub Light Editorial theme for print/PDF and sleek dark palette for dark mode.
- **Intelligent ASCII / Unicode Architecture Diagrams**:
  - Automatically detects Unicode box-drawing characters (`┌─│┼└┘`), ASCII border grids (`+---+`, `|   |`), and architecture mockups.
  - Displays a dedicated `DIAGRAM` badge.
  - Applies tight line-height to guarantee continuous vertical lines without dashed gaps.
  - Enforces `white-space: pre` so diagram columns never wrap and break geometry.
- **Publication-Grade PDF Engine**:
  - **Smart Height Budgeting**: Measures element heights before rendering and pushes headings to the next page to eliminate orphaned headings.
  - **Table Splitting**: Long tables are cleanly chunked across page boundaries with repeated `<thead>` headers.
  - **Code Block Continuation**: Extended code blocks split cleanly with `(CONT.)` indicator headers.
  - **Page Numbering**: Optional clean, centered `Page X of Y` footers at an exact millimeter offset.
  - **Diagram Protection**: Keeps diagrams and vector charts atomic to prevent mid-diagram slicing.
- **Math & Diagramming**:
  - **KaTeX**: Fast, crisp LaTeX math rendering for inline (`$...$`) and display (`$$...$$`) equations.
  - **Mermaid**: Flowcharts, sequence diagrams, state diagrams, class diagrams, and ERDs rendered as vector graphics.
- **Theme Support**: Seamless light and dark modes with high-contrast, publication-safe color normalization.
- **Privacy First**: Everything runs 100% client-side in your browser. No documents, files, or telemetry are ever uploaded or transmitted to external servers.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org/) (App Router, Turbopack)
- **UI Library**: [React 19](https://react.dev/)
- **Styling**: [Tailwind CSS v4](https://tailwindcss.com/)
- **Markdown & Math**: `react-markdown`, `remark-gfm`, `remark-math`, `rehype-katex`, `rehype-highlight`, `lowlight`
- **Diagrams**: [Mermaid](https://mermaid.js.org/)
- **Syntax Highlighting**: [highlight.js](https://highlightjs.org/) (38+ grammars registered)
- **PDF Engine**: Client-side rendering pipeline (`jspdf` + `html2canvas-pro` with dynamic DOM budgeting)
- **Icons**: [Lucide React](https://lucide.dev/)

## Getting Started

### Prerequisites

- Node.js 18.x or later
- npm, yarn, pnpm, or bun

### Installation

```bash
git clone https://github.com/tanyas27/merk-pdf.git
cd merk-pdf
npm install
```

### Running Locally

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) (or the port specified in terminal) in your browser.

### Building for Production

```bash
npm run build
npm run start
```

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Cmd/Ctrl + P` or `Cmd/Ctrl + E` | Export document as PDF |
| `Cmd/Ctrl + B` | Bold text |
| `Cmd/Ctrl + I` | Italic text |
| `Cmd/Ctrl + K` | Insert Markdown link |
| `Cmd/Ctrl + S` | Force save to localStorage |
| `Tab` / `Shift + Tab` | Indent / Unindent 2 spaces |
| `Esc` | Exit fullscreen mode |

## License

MIT
