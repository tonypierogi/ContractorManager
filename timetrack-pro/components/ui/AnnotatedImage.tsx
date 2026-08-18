import React, { useEffect, useState } from 'react';
import { View, Image, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import AnnotationOverlay from '@/components/ui/AnnotationOverlay';
import type { ImageAnnotation } from '@/lib/annotations';

export interface ContainedRect {
  /** Size of the letterboxed image inside its container, in points. */
  width: number;
  height: number;
  /** Offset of that image from the container's top-left. */
  left: number;
  top: number;
}

/**
 * Where a `resizeMode="contain"` image actually lands inside its container.
 * Annotations are anchored to the photo, so they have to follow the letterbox
 * rather than the box around it.
 */
export function containRect(
  containerWidth: number,
  containerHeight: number,
  aspectRatio: number | null,
): ContainedRect {
  if (!aspectRatio || containerWidth <= 0 || containerHeight <= 0) {
    return { width: containerWidth, height: containerHeight, left: 0, top: 0 };
  }
  const scale = Math.min(containerWidth / aspectRatio, containerHeight);
  const height = scale;
  const width = scale * aspectRatio;
  return {
    width,
    height,
    left: (containerWidth - width) / 2,
    top: (containerHeight - height) / 2,
  };
}

/**
 * The photo's width/height ratio, or null until it's known. Remote images
 * don't report their size synchronously, so this asks for it once per uri.
 */
export function useImageAspectRatio(uri: string | null | undefined): number | null {
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    if (!uri) {
      setRatio(null);
      return;
    }
    let active = true;
    setRatio(null);
    Image.getSize(
      uri,
      (width, height) => {
        if (active && height > 0) setRatio(width / height);
      },
      // A failed lookup isn't worth an error: the marks simply stretch to the
      // container, which is right for anything that isn't letterboxed anyway.
      () => {},
    );
    return () => {
      active = false;
    };
  }, [uri]);

  return ratio;
}

interface Props {
  uri: string;
  annotations: ImageAnnotation[];
  /** Sized by its parent; the image is contained within whatever it gets. */
  style?: StyleProp<ViewStyle>;
}

/** An image with its saved marks drawn on top, at whatever size it's given. */
export default function AnnotatedImage({ uri, annotations, style }: Props) {
  const aspectRatio = useImageAspectRatio(uri);
  const [box, setBox] = useState({ width: 0, height: 0 });
  const rect = containRect(box.width, box.height, aspectRatio);

  return (
    <View
      style={style}
      onLayout={(e) =>
        setBox({
          width: e.nativeEvent.layout.width,
          height: e.nativeEvent.layout.height,
        })
      }
    >
      <Image source={{ uri }} style={StyleSheet.absoluteFill} resizeMode="contain" />
      <View style={{ position: 'absolute', left: rect.left, top: rect.top }}>
        <AnnotationOverlay
          annotations={annotations}
          width={rect.width}
          height={rect.height}
        />
      </View>
    </View>
  );
}
