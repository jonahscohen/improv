---
source: https://github.com/giuseppe-trisciuoglio/developer-kit
source_files: [SKILL.md, references/customization.md, references/setup-and-configuration.md, references/forms-and-validation.md, references/ui-components.md, references/charts-components.md, references/nextjs-integration.md, references/chart.md]
captured: 2026-05-28
license: MIT
attribution: Giuseppe Trisciuoglio, 2025 (MIT License)
type: external-cookbook (shadcn/ui - OPT-IN reference, applies only to shadcn projects)
applies_when: project ships components.json, or Tailwind CSS + Radix UI + class-variance-authority are detected
---

# shadcn/ui Cookbook (OPT-IN)

## Opt-in scope - read this first

Sidecoach is library-agnostic by default. It does not assume any component
library, design system, or styling approach. This reference applies ONLY when
the project actually uses shadcn/ui. Confirm at least one of these before
applying anything below:

- A `components.json` file exists at the project root.
- The dependency set includes Tailwind CSS plus `@radix-ui/*` primitives plus
  `class-variance-authority`, `clsx`, and `tailwind-merge`.
- The codebase has a `components/ui/` directory of copied component source.

If none of those hold, ignore this file. Do not introduce shadcn into a project
that has not opted in. shadcn/ui is not an npm package you depend on - it is a
set of components copied into the project, owned and edited in-tree. That
ownership model is the source of every pattern below.

This cookbook is a concise, accurate distillation of the genuinely transferable
patterns. It deliberately omits the per-component install-command catalog and
the full token tables - run `npx shadcn@latest add <component>` and read the
copied source for those.

## 1. The `cn()` helper - clsx + tailwind-merge

Every shadcn component composes class names through one helper. `clsx` resolves
conditional and array class inputs; `tailwind-merge` then de-duplicates
conflicting Tailwind utilities so the last-wins, letting callers override base
styles via a `className` prop without specificity fights.

```tsx
// lib/utils.ts
import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

```tsx
cn("px-4 py-2", isActive && "bg-primary text-white")
cn("text-sm", size === "lg" && "text-lg", className) // className wins on conflicts
```

## 2. Variant systems with `cva`

Component variants are declared once with `class-variance-authority` (`cva`),
then validated at the type level via `VariantProps`. The base string holds
shared classes; `variants` maps prop values to class strings; `defaultVariants`
fills in unspecified props.

```tsx
// components/ui/button.tsx
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}
```

To extend variants, edit this file directly - you own it. Add a new key under
`variant` or `size` and it becomes available and type-checked everywhere.

## 3. Radix composition - `asChild` and `Slot`

Radix-based components accept an `asChild` prop. When `asChild` is true the
component renders `@radix-ui/react-slot`'s `Slot` instead of its own element,
merging its props and behavior onto the single child you pass. This lets a
trigger be any element (a `Link`, a custom button) while keeping the trigger
semantics, without nesting a `<button>` inside a `<button>`.

```tsx
import { Slot } from "@radix-ui/react-slot"

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    )
  }
)
```

```tsx
// Trigger renders as the child Button rather than wrapping it
<DialogTrigger asChild>
  <Button variant="outline">Open</Button>
</DialogTrigger>
```

## 4. React Hook Form + Zod resolver wiring

shadcn's `Form` is a thin set of wrappers (`Form`, `FormField`, `FormItem`,
`FormLabel`, `FormControl`, `FormMessage`, `FormDescription`) over React Hook
Form's context. Validation is a Zod schema fed through `@hookform/resolvers/zod`.
Infer the form's value type from the schema with `z.infer` so the schema is the
single source of truth.

```tsx
"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { Button } from "@/components/ui/button"
import {
  Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

const formSchema = z.object({
  username: z.string().min(2, { message: "Username must be at least 2 characters." }),
  email: z.string().email({ message: "Please enter a valid email address." }),
})

export function ProfileForm() {
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: { username: "", email: "" },
  })

  function onSubmit(values: z.infer<typeof formSchema>) {
    console.log(values)
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="username"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Username</FormLabel>
              <FormControl>
                <Input placeholder="shadcn" {...field} />
              </FormControl>
              <FormDescription>This is your public display name.</FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit">Submit</Button>
      </form>
    </Form>
  )
}
```

Wiring rules that hold across every field type:

- Spread `{...field}` onto plain inputs (`Input`, `Textarea`).
- For controlled widgets, wire the two halves explicitly: `Select` takes
  `onValueChange={field.onChange}` + `defaultValue={field.value}`; `Checkbox`
  takes `checked={field.value}` + `onCheckedChange={field.onChange}`.
- `FormMessage` renders the resolver's error for that field automatically - do
  not hand-render error strings.
- Always use `Form`, `FormField`, `FormItem`, `FormLabel`, `FormControl`, and
  `FormMessage` together; they share the field context that wires labels and
  `aria-*` attributes.

The same Zod schema can validate on the server in a route handler, keeping
client and server validation identical:

```ts
// app/api/contact/route.ts
import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"

const contactSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  message: z.string().min(10),
})

export async function POST(request: NextRequest) {
  try {
    const validated = contactSchema.parse(await request.json())
    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ errors: error.issues }, { status: 400 })
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}
```

## 5. CSS-variable theming - the HSL channel convention

shadcn stores theme colors as bare HSL channel triples (no `hsl()` wrapper) in
CSS variables, then wraps them with `hsl(var(--token))` inside the Tailwind
theme. Storing raw channels lets the same variable drive opacity modifiers like
`bg-primary/90`. The variable is defined as channels; Tailwind supplies the
`hsl()`.

```css
/* globals.css */
@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --primary: 222.2 47.4% 11.2%;
    --primary-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --ring: 222.2 84% 4.9%;
    --radius: 0.5rem;
  }
}
```

```js
// tailwind.config.js
module.exports = {
  darkMode: ["class"],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
```

To rebrand, change only the channel values in `:root` (and `.dark`). The Tailwind
theme references stay untouched. Note that newer shadcn chart tokens use `oklch()`
values stored whole (see section 8) rather than the HSL-channel convention - the
two coexist.

## 6. Dark mode with `next-themes`

Dark mode is a class toggle (`darkMode: ["class"]` in Tailwind, a `.dark` block
in CSS). `next-themes` manages the class on `<html>` and persists the choice.
`suppressHydrationWarning` on `<html>` avoids the server/client class mismatch
warning, since the theme class is applied client-side.

```tsx
// components/theme-provider.tsx
"use client"
import { ThemeProvider as NextThemesProvider } from "next-themes"

export function ThemeProvider({ children, ...props }) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
```

```tsx
// app/layout.tsx
import { ThemeProvider } from "@/components/theme-provider"

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
        </ThemeProvider>
      </body>
    </html>
  )
}
```

```tsx
// theme toggle - read and flip via useTheme()
"use client"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"
import { Moon, Sun } from "lucide-react"

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  return (
    <Button variant="ghost" size="icon"
      onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
      <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
    </Button>
  )
}
```

## 7. The registry - components.json and the add CLI

`components.json` drives the CLI: it records the style, whether the project uses
React Server Components and TSX, where the Tailwind config and CSS live, the base
color, and the import aliases the CLI writes into generated files.

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "default",
  "rsc": true,
  "tsx": true,
  "tailwind": {
    "config": "tailwind.config.js",
    "css": "app/globals.css",
    "baseColor": "slate",
    "cssVariables": true,
    "prefix": ""
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui"
  }
}
```

```bash
npx shadcn@latest init                # scaffold components.json + lib/utils
npx shadcn@latest add button          # add one component
npx shadcn@latest add button input form  # add several
```

Registry security note: `npx shadcn@latest add` fetches component source from a
remote registry and writes it into the project. Only point `components.json` at
registries you trust, and review the generated code before shipping it - it is
real source running in the app, not a vetted package version. Treat an untrusted
registry URL the same as running untrusted code.

## 8. Charts - ChartContainer + Recharts theming

The chart component wraps Recharts in a `ChartContainer` that takes a `config`
object. Each config entry maps a data key to a label and a color; the color
flows into Recharts as a `var(--color-<key>)` CSS variable that
`ChartContainer` generates from the config. `ChartContainer` needs an explicit
min-height (`min-h-[200px]`) to be responsive.

Chart palette tokens use `oklch()` values and live in `globals.css`:

```css
@layer base {
  :root {
    --chart-1: oklch(0.646 0.222 41.116);
    --chart-2: oklch(0.6 0.118 184.704);
  }
  .dark {
    --chart-1: oklch(0.488 0.243 264.376);
    --chart-2: oklch(0.696 0.17 162.48);
  }
}
```

```tsx
import { Bar, BarChart, CartesianGrid, XAxis } from "recharts"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"

const chartConfig = {
  desktop: { label: "Desktop", color: "var(--chart-1)" },
  mobile: { label: "Mobile", color: "var(--chart-2)" },
} satisfies import("@/components/ui/chart").ChartConfig

export function BarChartDemo() {
  return (
    <ChartContainer config={chartConfig} className="min-h-[200px] w-full">
      <BarChart accessibilityLayer data={chartData}>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} />
        <Bar dataKey="desktop" fill="var(--color-desktop)" radius={4} />
        <Bar dataKey="mobile" fill="var(--color-mobile)" radius={4} />
        <ChartTooltip content={<ChartTooltipContent />} />
      </BarChart>
    </ChartContainer>
  )
}
```

Config entries may carry per-mode colors with a `theme` block
(`{ light, dark }`), letting one chart series shift color in dark mode. Add the
`accessibilityLayer` prop to the chart for keyboard navigation, ARIA labels, and
screen reader announcements. Line, Area, and Pie charts follow the same
ChartContainer + config shape, swapping the Recharts primitives.

## License and attribution

The patterns and code snippets in this cookbook are distilled from the
shadcn-ui skill in giuseppe-trisciuoglio/developer-kit, licensed under the MIT
License, Copyright (c) 2025 Giuseppe Trisciuoglio. The two large machine-scraped
official-doc dumps from that skill (`official-ui-reference.md`,
`ui-reference.md`) were intentionally excluded as install-command bloat. shadcn/ui
itself is MIT-licensed and copied into consuming projects; review upstream
shadcn and Radix docs for authoritative, current APIs.
