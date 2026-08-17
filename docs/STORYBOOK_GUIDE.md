# Storybook Guide: Component Development & Testing

## What is Storybook?

Storybook is a tool for building UI components in isolation—a **workshop** where you develop, document, and test components independently from your app.

## Why Use Storybook?

### 1. **Develop Components Standalone—No Running the Full App** 🎯

Build and iterate on components without running your entire application. Get instant preview with hot reload instead of navigating through pages and setting up context.

**Without Storybook:** Run app → Navigate → Set state → See component → Repeat  
**With Storybook:** Open Storybook → See component → Toggle all states instantly

### 2. **Test with Different Values Easily** ⚡

Interactive controls let you test any prop combination on the fly. Toggle variants, sizes, states, and error messages without code changes. See all edge cases (empty, loading, error, success) in one view.

### 3. **Visual Testing + Figma Integration** 🎨

- **Figma Plugin:** Compare coded components against Figma designs side-by-side
- **Designer Collaboration:** Designers interact with real components in the browser without running code
- **Living Component Library:** Once complete, serves as documentation for the whole team

## Quick Start

### 1. Install Storybook
```bash
npx storybook@latest init
```

### 2. Write Your First Story

```typescript
// Button.stories.tsx
import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: { children: 'Click me', variant: 'primary' },
};

export const Disabled: Story = {
  args: { children: 'Disabled', disabled: true },
};
```

### 3. Run Storybook
```bash
pnpm storybook
```

### ENS Example: Name Input States

```typescript
// ENSNameInput.stories.tsx
export const Available: Story = {
  args: { value: 'mynewname', status: 'available' },
};

export const Taken: Story = {
  args: { value: 'vitalik', status: 'taken' },
};

export const Loading: Story = {
  args: { value: 'checking', status: 'loading' },
};
```

## Development Workflow

1. **Create component** → Write code
2. **Create story file** → Document states
3. **Run Storybook** → `pnpm storybook`
4. **Develop with instant feedback** → See changes live
5. **Add edge cases** → Loading, error, empty states
6. **Share with team** → Get feedback on all variations

## Common ENS Patterns

```typescript
// Different states
export const Loading: Story = { args: { isLoading: true } };
export const Error: Story = { args: { error: 'Failed to load' } };
export const Empty: Story = { args: { results: [] } };

// Wallet states
export const Connected: Story = { args: { walletConnected: true } };
export const Disconnected: Story = { args: { walletConnected: false } };
```

## Key Benefits

✅ Instant component preview (no full app needed)  
✅ All states visible at once  
✅ Designers test in browser without dev setup  
✅ Self-documenting components  
✅ Catch visual bugs early  
✅ Perfect for evolving design systems

## Getting Started

1. Pick one component (Button, Input)
2. Write 3-5 stories (default, disabled, error, loading)
3. Share Storybook URL with team
4. Make it part of your workflow

## Figma Integration

Install the Figma plugin to:
- Compare designs vs. coded components side-by-side
- Let designers interact with real components
- Get pixel-perfect feedback without screenshots

## Resources

- [Storybook Docs](https://storybook.js.org/docs)
- [Figma Plugin](https://storybook.js.org/addons/@storybook/addon-designs)

---

*Questions? Reach out in #frontend-dev*
