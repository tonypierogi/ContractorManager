import React from 'react';
import { View, StyleSheet } from 'react-native';
import {
  strokePx,
  type AnnotationPoint,
  type ImageAnnotation,
} from '@/lib/annotations';

interface Props {
  annotations: ImageAnnotation[];
  /** Size of the box the *image itself* occupies, in points. */
  width: number;
  height: number;
  /** Dims finished marks while a new one is being drawn over them. */
  opacity?: number;
}

/**
 * Draws annotations over an image using plain Views — a line is a thin
 * rotated rectangle, a circle is a rounded border. That keeps the app free of
 * a native drawing dependency (react-native-svg would mean a new build for
 * everyone) at the cost of a handful of extra views per stroke, which is
 * nothing next to the photo they sit on.
 */
export default function AnnotationOverlay({
  annotations,
  width,
  height,
  opacity = 1,
}: Props) {
  if (!annotations.length || width <= 0 || height <= 0) return null;

  return (
    <View
      pointerEvents="none"
      style={[styles.layer, { width, height, opacity }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      {annotations.map((annotation) => (
        <Annotation
          key={annotation.id}
          annotation={annotation}
          width={width}
          height={height}
        />
      ))}
    </View>
  );
}

function Annotation({
  annotation,
  width,
  height,
}: {
  annotation: ImageAnnotation;
  width: number;
  height: number;
}) {
  const thickness = strokePx(annotation, width);
  const toPx = (p: AnnotationPoint) => ({ x: p.x * width, y: p.y * height });

  if (annotation.kind === 'ellipse') {
    const a = toPx(annotation.points[0]);
    const b = toPx(annotation.points[annotation.points.length - 1]);
    const left = Math.min(a.x, b.x);
    const top = Math.min(a.y, b.y);
    const boxWidth = Math.abs(b.x - a.x);
    const boxHeight = Math.abs(b.y - a.y);
    return (
      <View
        style={{
          position: 'absolute',
          left,
          top,
          width: boxWidth,
          height: boxHeight,
          borderWidth: thickness,
          borderColor: annotation.color,
          // Half the shorter side is as round as a rectangle gets — an oval.
          borderRadius: Math.min(boxWidth, boxHeight) / 2 || thickness,
        }}
      />
    );
  }

  if (annotation.kind === 'arrow') {
    const tail = toPx(annotation.points[0]);
    const head = toPx(annotation.points[annotation.points.length - 1]);
    const angle = Math.atan2(head.y - tail.y, head.x - tail.x);
    // Head barbs scale with the arrow so a short flick doesn't get a huge tip.
    const barb = Math.min(
      Math.hypot(head.x - tail.x, head.y - tail.y) * 0.3,
      thickness * 6,
    );
    const spread = Math.PI * 0.8;
    return (
      <>
        <Segment from={tail} to={head} color={annotation.color} thickness={thickness} />
        <Segment
          from={head}
          to={{
            x: head.x + barb * Math.cos(angle - spread),
            y: head.y + barb * Math.sin(angle - spread),
          }}
          color={annotation.color}
          thickness={thickness}
        />
        <Segment
          from={head}
          to={{
            x: head.x + barb * Math.cos(angle + spread),
            y: head.y + barb * Math.sin(angle + spread),
          }}
          color={annotation.color}
          thickness={thickness}
        />
      </>
    );
  }

  return (
    <>
      {annotation.points.slice(1).map((point, i) => (
        <Segment
          key={i}
          from={toPx(annotation.points[i])}
          to={toPx(point)}
          color={annotation.color}
          thickness={thickness}
        />
      ))}
    </>
  );
}

/** One straight run of ink: a rectangle as long as the gap, rotated onto it. */
function Segment({
  from,
  to,
  color,
  thickness,
}: {
  from: { x: number; y: number };
  to: { x: number; y: number };
  color: string;
  thickness: number;
}) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy);
  if (length < 0.5) return null;
  return (
    <View
      style={{
        position: 'absolute',
        // Rotation happens about the view's centre, so lay it out centred on
        // the midpoint of the run and turn it to match.
        left: (from.x + to.x) / 2 - length / 2,
        top: (from.y + to.y) / 2 - thickness / 2,
        width: length,
        height: thickness,
        backgroundColor: color,
        // Rounded ends double as the joint between consecutive segments.
        borderRadius: thickness / 2,
        transform: [{ rotate: `${Math.atan2(dy, dx)}rad` }],
      }}
    />
  );
}

const styles = StyleSheet.create({
  layer: {
    position: 'absolute',
    overflow: 'hidden',
  },
});
