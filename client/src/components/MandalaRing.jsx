import { useId } from "react";

/**
 * The mandala corona drawn in the collar just outside the scale dial and its
 * two stepper buttons.
 *
 * Four layers, from the inside out. Two hairline rules at r=82 and r=86
 * straddle the dial's own border, which lands at r=84.7 once the SVG is scaled
 * to 118% - so the dial's edge becomes the middle line of a set of three rather
 * than a lone circle. Then the outlined lotus petals standing free of the band,
 * and a smaller filled one in each gap between them.
 *
 * The petals are the lotus from the app mark, not thin slivers: same
 * pointed-both-ends shape, so the corona and the maker's mark read as one hand.
 * Outlined rather than solid, because at this scale a filled petal is a blob
 * and an outlined one is a drawing; the little ones are filled precisely so
 * they still register when they are two pixels long.
 *
 * `petals` is 24 on the dial and 12 on the two buttons: a button is roughly
 * half the dial's diameter, so halving the count keeps the spacing between
 * petals the same in pixels and the three circles read as one family rather
 * than as a fine ring beside two coarse ones.
 *
 * non-scaling-stroke keeps every line a true 1px however the dial is sized, so
 * the whole thing stays a hairline rather than thickening with the clamp.
 */
export function MandalaRing({ petals = 24 }) {
  // Each circle is a self-contained drawing, so the two <path> templates need
  // ids that cannot collide with the other instances on the same screen.
  const uid = useId().replace(/:/g, "");
  const fullId = `mp-${uid}`;
  const halfId = `mr-${uid}`;

  const stepDeg = 360 / petals;
  const fullAngles = Array.from({ length: petals }, (_, i) => i * stepDeg);
  const halfAngles = fullAngles.map((a) => a + stepDeg / 2);

  return (
    <svg className="mandala-ring" viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <defs>
        {/* Full petal: r=87 at the base out to r=99. 99 and not more, because
            the viewBox stops at r=100 and anything past it is clipped flat at
            the four compass points. */}
        <path id={fullId} d="M100 1C103.6 5 103.6 9 100 13 96.4 9 96.4 5 100 1Z" />
        {/* Half petal for the gaps: same curve, shorter and narrower. */}
        <path id={halfId} d="M100 6.5C101.5 8.7 101.5 10.8 100 13 98.5 10.8 98.5 8.7 100 6.5Z" />
      </defs>

      <g stroke="currentColor" strokeWidth="1" vectorEffect="non-scaling-stroke">
        <circle cx="100" cy="100" r="82" />
        <circle cx="100" cy="100" r="86" />
        {fullAngles.map((angle) => (
          <use key={angle} href={`#${fullId}`} transform={`rotate(${angle} 100 100)`} />
        ))}
      </g>

      <g fill="currentColor">
        {halfAngles.map((angle) => (
          <use key={angle} href={`#${halfId}`} transform={`rotate(${angle} 100 100)`} />
        ))}
      </g>
    </svg>
  );
}
