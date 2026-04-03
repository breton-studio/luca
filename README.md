# Luca

An Obsidian plugin that turns the canvas into an AI-powered ideation surface. When you write, move, or cluster nodes, Claude reads the spatial arrangement and auto-generates new content nearby — text, code, diagrams, or images — as a thinking partner that extends your ideas in real time.

## How it works

1. You work on the canvas — create nodes, write ideas, move things around
2. After a brief pause (~3s idle), Luca reads the spatial context: which nodes are near each other, where clusters exist, what you just edited
3. Claude generates new nodes placed logically near your work — extending, challenging, or connecting your ideas
4. Content streams progressively into the canvas so you see it appear in real time

## What it generates

- **Text** — ideas, analysis, connections, challenges in markdown
- **Code** — language-tagged code blocks with syntax highlighting
- **Diagrams** — Mermaid diagrams rendered by Obsidian's built-in renderer
- **Images** — generated via Runware/Riverflow 2.0 Pro, saved to your vault

Claude decides which medium fits the context. A technical discussion might produce code. A relationship-heavy canvas might get a diagram. You don't choose — the thinking partner reads the room.

## Spatial intelligence

Luca doesn't just read text — it reads space. Proximity between nodes signals conceptual relationship. Dense clusters signal focus areas. The direction you're building in shapes where new nodes appear. Generated nodes never overlap existing ones.

## Taste profile

A markdown file in your vault defines how Luca thinks and communicates — tone, depth, visual preference, thinking style. Generation reflects your sensibility, not generic AI output.

## Setup

```bash
npm install
npm run build
```

Copy `main.js`, `manifest.json`, and `styles.css` to your vault's `.obsidian/plugins/canvas-ai/` directory. Enable the plugin in Obsidian settings and add your Claude API key.

## Configuration

- **Claude API key** — required for text/code/diagram generation
- **Runware API key** — required for image generation
- **Debounce delay** — how long to wait after your last action (default 3s)
- **Token budget** — daily cap on API usage
- **AI node styling** — color and appearance of generated nodes

## Stack

TypeScript, Obsidian Plugin API, Anthropic SDK (Claude Opus), Runware SDK (Riverflow 2.0 Pro), esbuild.

## Status

Active development. Internal use — not published to the Obsidian plugin store.
