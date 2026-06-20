/**
 * Critical Lens — per-philosopher lens descriptions.
 *
 * The full display name and a short, plain-language explanation of what that
 * philosopher's reasoning pipeline does, shown above the flow chart. Add an
 * entry here when a new philosopher lens ships.
 */

export interface LensInfo {
  fullName: string;
  blurb: string;
}

export const LENS_INFO: Record<string, LensInfo> = {
  nietzsche: {
    fullName: 'Friedrich Nietzsche',
    blurb:
      'Nietzsche never tried to pin an idea down in a single definition. His line “God is dead” was not a statement of fact but a warning: a morality that first arose to meet a real human need had, over time, hardened into something treated as more important than the need it was born to serve. This lens reads a text the same way — it isolates the abstract concept doing the heavy lifting, traces how that concept has been used and re-purposed across history, and asks whether it still holds honest meaning in its present context or has quietly drifted from its origin. It draws on Nietzsche’s On the Genealogy of Morality and Matthieu Queloz’s The Practical Origins of Ideas.',
  },
};

export function getLensInfo(philosopherId: string): LensInfo {
  return (
    LENS_INFO[philosopherId] ?? {
      fullName: philosopherId,
      blurb: 'This philosopher lens is not yet available.',
    }
  );
}
