# Shared core

Private utilities bundled into the public worklets. This workspace is not published and has no standalone build output.

| Module           | Responsibility                                                |
| ---------------- | ------------------------------------------------------------- |
| `index.ts`       | CSS input parsing, colors and deterministic numeric utilities |
| `types.ts`       | The supported paint context and painter interfaces            |
| `noise.ts`       | Seeded continuous noise                                       |
| `surface.ts`     | Shared surface and lighting operations                        |
| `register.ts`    | Deduplicated, retryable loading with an SSR-safe fallback     |
| `interaction.ts` | Pointer lighting, parallax, reduced motion and cleanup        |

Keep effect-specific geometry in its worklet package. Core code must not depend on the playground or a public worklet. Changes here can affect several effects, so run the full checks and package validation.
