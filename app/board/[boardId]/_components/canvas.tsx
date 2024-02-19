"use client"

import React, { useCallback, useState } from "react";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";

import {
  useCanRedo,
  useCanUndo,
  useHistory,
  useMutation,
  useStorage,
} from "@/liveblocks.config";
import { pointerEventToCanvasPoint } from "@/lib/utils";

import { Info } from "./info"
import { Participants } from "./participants"
import { Toolbar } from "./toolbar"
import { CursorsPresence } from "./cursors-presence";
import { LayerPreview } from "./layer-preview";

import {
  Camera,
  CanvasMode,
  CanvasState,
  Color,
  LayerType,
  Point
} from "@/types/canvas";

const MAX_LAYERS = 100;

interface CanvasProps {
  boardId: string;
}

const Canvas = ({
  boardId
}: CanvasProps) => {

  const layerIds = useStorage((root) => root.layerIds);

  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: CanvasMode.None,
  });

  const [ camera, setCamera ] = useState<Camera>({ x: 0, y: 0 });
  const [ lastUsedColor, setLastUsedColor ] = useState<Color>({
    r: 0,
    g: 0,
    b: 0,
  });

  const history = useHistory();
  const canUndo = useCanUndo();
  const canRedo = useCanRedo();

  const insertLayer = useMutation((
    { storage, setMyPresence },
    layerType: LayerType.Ellipse | LayerType.Rectangle | LayerType.Text | LayerType.Note,
    position: Point,
  ) => {
    const liveLayers = storage.get('layers');
    if (liveLayers.size >= MAX_LAYERS) {
      return;
    }

    const liveLayerIds = storage.get('layerIds');
    const layerId = nanoid();

    const layer = new LiveObject({
      type: layerType,
      x: position.x,
      y: position.y,
      width: 100,
      height: 100,
      fill: lastUsedColor,
    });

    liveLayerIds.push(layerId);
    liveLayers.set(layerId, layer);

    setMyPresence({ selection: [layerId] }, { addToHistory: true });
    setCanvasState({ mode: CanvasMode.None });

  }, [lastUsedColor]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setCamera((camera) => ({
      x: camera.x - e.deltaX,
      y: camera.y - e.deltaY,
    }))
  }, []);

  const handlePointerMove = useMutation(({ setMyPresence }, e: React.PointerEvent ) => {
    e.preventDefault();

    const current = pointerEventToCanvasPoint(e, camera);

    setMyPresence({ cursor: current });

  }, []);

  const handlePointerLeave = useMutation(({ setMyPresence }) => {
    setMyPresence({ cursor: null });
  }, []);

  const handlePointerUp = useMutation(({}, e) => {
    const point = pointerEventToCanvasPoint(e, camera);

    if (canvasState.mode === CanvasMode.Inserting) {
      insertLayer(canvasState.layerType, point);
    } else {
      setCanvasState({
        mode: CanvasMode.None,
      })
    }

    history.resume();
  }, [camera, canvasState, history, insertLayer]);

  return (
    <main
      className="h-full w-full relative bg-neutral-100 touch-none"
    >
      <Info
        boardId={boardId}
      />
      <Participants />
      <Toolbar
        canvasState={canvasState}
        setCanvasState={setCanvasState}
        canUndo={canUndo}
        canRedo={canRedo}
        undo={history.undo}
        redo={history.redo}
      />
      <svg
        className="h-[100vh] w-[100vw]"
        onWheel={handleWheel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
      >
        <g
          style={{
            transform: `translate(${camera.x}px ${camera.y}px)`
          }}
        >
          {layerIds.map((layerId) => (
            <LayerPreview
              key={layerId}
              id={layerId}
              onLayerPointerDown={() => {}}
              selectionColor={"#000"}
            />
          ))}
          <CursorsPresence />
        </g>
      </svg>
    </main>
  )
}

export default Canvas