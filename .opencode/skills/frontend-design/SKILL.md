---
name: frontend-design
description: Generate production-grade frontend UI with shadcn/ui and modern design systems. Use when user asks to design UI components, landing pages, dashboards, or any frontend interface. Integrates with shadcn/ui, Tailwind CSS, and modern React patterns. Avoids generic "AI aesthetic" — produces distinctive, brand-aligned interfaces.
allowed-tools: Bash(npx shadcn:*)
---

# Frontend Design Skill

Generate professional, production-quality UI with modern design systems. Avoid the generic "AI aesthetic" — produce distinctive, brand-aligned interfaces.

## Core Principles

- Use shadcn/ui as the component foundation (project already has it installed)
- Respect the active DESIGN.md color/typography/layout tokens
- Apply `framer-motion` for animations (project already installed)
- Use `lucide-react` for icons (project already installed)
- Tailwind CSS 4 for styling (project already installed)
- Dark-mode-first approach where appropriate

## Workflow

### 1. Read Context
- Read `DESIGN.md` if it exists in project root
- Identify color palette, typography tokens, layout principles
- Match existing project conventions (Next.js App Router, React 19, TypeScript)

### 2. Component Architecture
- Place components in `src/components/<feature>/`
- Use `"use client"` directive for interactive components
- Follow shadcn/ui component patterns (variants with `cva`, className forwarding)
- Use `cn()` from `@/lib/utils` for className merging

### 3. Design Quality Rules
- NEVER use lorem ipsum — generate contextually appropriate copy
- Use visual hierarchy: display → heading → body → label
- Accent colors sparingly (2-3 times per page max)
- Responsive: mobile-first with Tailwind breakpoints
- Respect white space — don't cram content

### 4. Self-Check
- [ ] All colors from DESIGN.md tokens or Tailwind theme
- [ ] No lorem ipsum placeholder text
- [ ] Responsive at 375w, 768w, 1440w
- [ ] Animations tasteful and purposeful (framer-motion)
- [ ] Interactive states (hover, focus, active) defined
