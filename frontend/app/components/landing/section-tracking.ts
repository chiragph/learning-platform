export type SectionPosition = { href: string; top: number };

// Keep the last section active through the intervening, unlinked sections.
// An eight-pixel buffer prevents tiny scroll reversals from flickering the link.
export function getActiveSection(sections: SectionPosition[], current: string, activationLine: number) {
  if (!sections.length) return current;
  let next = 0;
  for (let index = 0; index < sections.length; index++) {
    if (sections[index].top <= activationLine) next = index;
  }
  const previous = sections.findIndex((section) => section.href === current);
  if (previous < 0) return sections[next].href;
  if (next > previous && sections[next].top > activationLine - 8) return current;
  if (next < previous && sections[previous].top <= activationLine + 8) return current;
  return sections[next].href;
}
