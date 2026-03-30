# Demo Shared Components

Reusable components for building consistent integration demos across the GuardianClaw platform.

## Quick Start

```tsx
import {
  DemoHeader,
  DemoScenarioSelector,
  DemoChat,
  DemoControls,
  DemoProgress,
  TypewriterText,
} from '@/components/demos/shared'
```

## Components

### Layout

| Component     | Description                            |
| ------------- | -------------------------------------- |
| `DemoHeader`  | Header with badge, title, and subtitle |
| `DemoSection` | Section wrapper with title and icon    |

### Controls

| Component              | Description                          |
| ---------------------- | ------------------------------------ |
| `DemoScenarioSelector` | Safe/Blocked scenario toggle buttons |
| `DemoControls`         | Play and Reset buttons               |
| `DemoProgress`         | Animated progress indicator          |

### Pipeline

| Component            | Description                     |
| -------------------- | ------------------------------- |
| `DemoNode`           | Start/end node in pipeline      |
| `DemoStepCard`       | Step card with status indicator |
| `DemoValidationStep` | Compact validation step         |
| `DemoAgentCard`      | Agent-specific step card        |

### Chat

| Component         | Description           |
| ----------------- | --------------------- |
| `DemoChat`        | Full chat interface   |
| `DemoChatHeader`  | Chat header component |
| `DemoChatMessage` | Individual message    |
| `DemoChatCompact` | Compact chat view     |

### Animation

| Component        | Description                   |
| ---------------- | ----------------------------- |
| `TypewriterText` | Character-by-character typing |
| `FlowParticle`   | Animated flow particle        |
| `FlowLine`       | Connection line with particle |
| `FlowConnector`  | Simple connector line         |

## Themes

Available themes: `purple`, `violet`, `amber`, `teal`, `orange`, `blue`, `green`, `red`, `claw`

```tsx
<DemoHeader theme="amber" ... />
<DemoControls theme="purple" ... />
```

## Example Usage

```tsx
export function MyIntegrationDemo() {
  const [scenario, setScenario] = useState<'safe' | 'blocked'>('safe')
  const [isPlaying, setIsPlaying] = useState(false)
  const [phase, setPhase] = useState('idle')
  const [messages, setMessages] = useState<DemoMessage[]>([])

  return (
    <div className="mx-auto w-full max-w-4xl">
      <DemoHeader
        icon={MyIcon}
        badge="MyIntegration + GuardianClaw"
        title="Protected Operations"
        subtitle="Watch how GuardianClaw validates each step"
        theme="teal"
      />

      <DemoScenarioSelector
        scenario={scenario}
        onScenarioChange={setScenario}
        disabled={isPlaying}
      />

      <div className="grid grid-cols-2 gap-6">
        <DemoChat
          header={{
            icon: MyIcon,
            title: 'My Agent',
            subtitle: 'Protected by GuardianClaw',
            theme: 'teal',
          }}
          messages={messages}
          isIdle={phase === 'idle'}
        />

        <DemoSection title="Validation Pipeline" icon={Shield}>
          {/* Pipeline steps */}
        </DemoSection>
      </div>

      <DemoControls onPlay={startDemo} onReset={resetDemo} isPlaying={isPlaying} theme="teal" />

      <DemoProgress
        phases={['input', 'validate', 'execute', 'complete']}
        currentPhase={phase}
        theme="teal"
      />
    </div>
  )
}
```

## Types

All types are exported from `./types.ts`:

- `DemoTheme` - Theme color options
- `DemoScenario` - 'safe' | 'blocked'
- `StepStatus` - Step status options
- `DemoMessage` - Chat message interface
- `DemoStep` - Generic step interface

## Utilities

- `getStatusColors(status)` - Get color classes for a status
- `themeColors` - Theme color mappings
