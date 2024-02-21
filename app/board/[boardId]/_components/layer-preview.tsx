"use client";

import { memo } from "react";

import { useStorage } from "@/liveblocks.config";
import { colorToCss } from "@/lib/utils";
import { Rectangle } from "./rectangle";
import { Ellipse } from "./ellipse";
import { Text } from "./text";
import { Note } from "./note";
import { Path } from "./path";

import { LayerType } from "@/types/canvas";

interface LayerPreviewProps {
  id: string;
  onLayerPointerDown: (e: React.PointerEvent, layerId: string) => void;
  selectionColor?: string;
}

export const LayerPreview = memo(({
  id,
  onLayerPointerDown,
  selectionColor,
}: LayerPreviewProps) => {

  const layer = useStorage((root) => root.layers.get(id));

  if (!layer) {
    return null;
  }

  switch (layer.type) {
    case LayerType.Rectangle:
      return (
        <Rectangle
          id={id}
          layer={layer}
          onPointerDown={onLayerPointerDown}
          selectionColor={selectionColor}
        />
      );
    case LayerType.Ellipse:
      return (
        <Ellipse
          id={id}
          layer={layer}
          onPointerDown={onLayerPointerDown}
          selectionColor={selectionColor}
        />
      );
    case LayerType.Text:
      return (
        <Text
          id={id}
          layer={layer}
          onPointerDown={onLayerPointerDown}
          selectionColor={selectionColor}
        />
      );
    case LayerType.Note:
      return (
        <Note
          id={id}
          layer={layer}
          onPointerDown={onLayerPointerDown}
          selectionColor={selectionColor}
        />
      );
    case LayerType.Path:
      return (
        <Path
          x={layer.x}
          y={layer.y}
          fill={layer.fill ? colorToCss(layer.fill) : '#000'}
          points={layer.points}
          onPointerDown={(e) => onLayerPointerDown(e, id)}
          stroke={selectionColor}
        />
      );
    default:
      console.warn('Unknown layer type');
      return null;
  }

});

LayerPreview.displayName = 'LayerPreview';
