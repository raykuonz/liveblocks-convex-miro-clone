"use client"

import {
  useCallback,
  useEffect,
  useMemo,
  useState
} from "react";
import { nanoid } from "nanoid";
import { LiveObject } from "@liveblocks/client";

import {
  useCanRedo,
  useCanUndo,
  useHistory,
  useMutation,
  useOthersMapped,
  useSelf,
  useStorage,
} from "@/liveblocks.config";
import {
  colorToCss,
  connectionIdToColor,
  findIntersectingLayersWithRectangle,
  penPointsToPathLayer,
  pointerEventToCanvasPoint,
  resizeBounds,
} from "@/lib/utils";

import { useDisableScrollBounce } from "@/hooks/use-disable-scroll-bounce";
import { useDeleteLayers } from "@/hooks/use-delete-layers";

import { Info } from "./info"
import { Participants } from "./participants"
import { Toolbar } from "./toolbar"
import { CursorsPresence } from "./cursors-presence";
import { LayerPreview } from "./layer-preview";
import { SelectionBox } from "./selection-box";
import { SelectionTools } from "./selection-tools";
import { Path } from "./path";

import {
  Camera,
  CanvasMode,
  CanvasState,
  Color,
  LayerType,
  Point,
  Side,
  XYWH
} from "@/types/canvas";

const MAX_LAYERS = 100;

interface CanvasProps {
  boardId: string;
}

const Canvas = ({
  boardId
}: CanvasProps) => {

  const layerIds = useStorage((root) => root.layerIds);

  const pencilDraft = useSelf((me) => me.presence.pencilDraft);

  const [canvasState, setCanvasState] = useState<CanvasState>({
    mode: CanvasMode.None,
  });

  const [ camera, setCamera ] = useState<Camera>({ x: 0, y: 0 });
  const [ lastUsedColor, setLastUsedColor ] = useState<Color>({
    r: 0,
    g: 0,
    b: 0,
  });

  useDisableScrollBounce();

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

  const unselectLayers = useMutation((
    { self, setMyPresence }
  ) => {
    if (self.presence.selection.length > 0 ) {
      setMyPresence({ selection: [] }, { addToHistory: true });
    }
  }, []);

  const translateSelectedLayers = useMutation((
    { storage, self },
    point: Point,
  ) => {
    if (canvasState.mode !== CanvasMode.Translating) {
      return;
    }

    const offset = {
      x: point.x - canvasState.current.x,
      y: point.y - canvasState.current.y,
    }

    const liveLayers = storage.get('layers');
    for (const id of self.presence.selection) {
      const layer = liveLayers.get(id);

      if (layer) {
        layer.update({
          x: layer.get('x') + offset.x,
          y: layer.get('y') + offset.y,
        });
      }
    }

    setCanvasState({ mode: CanvasMode.Translating, current: point });

  }, [canvasState]);

  const updateSelectionNet = useMutation((
    { storage, setMyPresence },
    current: Point,
    origin: Point,
  ) => {
    const layers = storage.get('layers').toImmutable();
    setCanvasState({
      mode: CanvasMode.SelectionNet,
      origin,
      current,
    });

    const ids = findIntersectingLayersWithRectangle(
      layerIds,
      layers,
      origin,
      current,
    );

    setMyPresence({ selection: ids });
  }, [layerIds]);

  const startMultiSelection = useCallback((
    current: Point,
    origin: Point,
  ) => {
    if (
      Math.abs(current.x - origin.x) + Math.abs(current.y - origin.y) > 5
    ) {
      setCanvasState({
        mode: CanvasMode.SelectionNet,
        origin,
        current,
      });
    }
  }, []);

  const resizeSelectedLayer = useMutation((
    { storage, self },
    point: Point,
  ) => {
    if (canvasState.mode !== CanvasMode.Resizing) {
      return;
    }

    const bounds = resizeBounds(
      canvasState.initialBounds,
      canvasState.corner,
      point,
    );

    const liveLayers = storage.get('layers');
    const layer = liveLayers.get(self.presence.selection[0]);

    if (layer) {
      layer.update(bounds);
    }
  }, [canvasState]);

  const startDrawing = useMutation((
    { setMyPresence },
    point: Point,
    pressure: number,
  ) => {
    setMyPresence({
      pencilDraft: [ [point.x, point.y, pressure] ],
      penColor: lastUsedColor,
    })
  }, [lastUsedColor]);

  const continueDrawing = useMutation((
    { self, setMyPresence },
    point: Point,
    e: React.PointerEvent,
  ) => {
    const { pencilDraft } = self.presence;

    if (
      canvasState.mode !== CanvasMode.Pencil
      || e.buttons !== 1
      || pencilDraft == null
    ) {
      return;
    }

    setMyPresence({
      cursor: point,
      pencilDraft: pencilDraft.length === 1
        && pencilDraft[0][0] === point.x
        && pencilDraft[0][1] === point.y
          ? pencilDraft
          :[...pencilDraft, [point.x, point.y, e.pressure]],
    })
  }, [canvasState.mode]);

  const insertPath = useMutation((
    { storage, self, setMyPresence }
  ) => {

    const liveLayers = storage.get('layers');
    const { pencilDraft } = self.presence;

    if (
      pencilDraft == null
      || pencilDraft.length < 2
      || liveLayers.size >= MAX_LAYERS
    ) {
      setMyPresence({ pencilDraft: null });
      return;
    }

    const id = nanoid();

    liveLayers.set(
      id,
      new LiveObject(penPointsToPathLayer(
        pencilDraft,
        lastUsedColor,
      )),
    )

    const liveLayerIds = storage.get('layerIds');
    liveLayerIds.push(id);

    setMyPresence({ pencilDraft: null });
    setCanvasState({ mode: CanvasMode.Pencil });
  }, [lastUsedColor]);

  const handleResizeHandlePointerDown = useCallback((
    corner: Side,
    initialBounds: XYWH,
  ) => {
    history.pause();
    setCanvasState({
      mode: CanvasMode.Resizing,
      initialBounds,
      corner,
    })
  }, [history])

  const handleWheel = useCallback((e: React.WheelEvent) => {
    setCamera((camera) => ({
      x: camera.x - e.deltaX,
      y: camera.y - e.deltaY,
    }))
  }, [setCamera]);

  const handlePointerMove = useMutation(({ setMyPresence }, e: React.PointerEvent ) => {
    e.preventDefault();

    const current = pointerEventToCanvasPoint(e, camera);

    setMyPresence({ cursor: current });

    if (canvasState.mode === CanvasMode.Pressing) {
      startMultiSelection(current, canvasState.origin);
    } else if (canvasState.mode === CanvasMode.SelectionNet) {
      updateSelectionNet(current, canvasState.origin);
    } else if (canvasState.mode === CanvasMode.Translating) {
      translateSelectedLayers(current);
    } else if (canvasState.mode === CanvasMode.Resizing) {
      resizeSelectedLayer(current);
    } else if (canvasState.mode === CanvasMode.Pencil) {
      continueDrawing(current, e);
    }

  }, [
    camera,
    canvasState,
    startMultiSelection,
    updateSelectionNet,
    translateSelectedLayers,
    resizeSelectedLayer,
    continueDrawing,
  ]);

  const handlePointerLeave = useMutation(({ setMyPresence }) => {
    setMyPresence({ cursor: null });
  }, []);

  const handlePointerDown = useCallback((
    e: React.PointerEvent,
  ) => {
    const point = pointerEventToCanvasPoint(e, camera);

    if (canvasState.mode === CanvasMode.Inserting) {
      return;
    }

    if (canvasState.mode === CanvasMode.Pencil) {
      startDrawing(point, e.pressure);
      return;
    }

    setCanvasState({ origin: point, mode: CanvasMode.Pressing });
  }, [camera, canvasState.mode, setCanvasState, startDrawing]);

  const handlePointerUp = useMutation(({}, e) => {
    const point = pointerEventToCanvasPoint(e, camera);

    if (
      canvasState.mode === CanvasMode.None
      || canvasState.mode === CanvasMode.Pressing
    ) {

      unselectLayers();

      setCanvasState({
        mode: CanvasMode.None,
      })
    } else if (canvasState.mode === CanvasMode.Pencil) {
      insertPath();
    } else if (canvasState.mode === CanvasMode.Inserting) {
      insertLayer(canvasState.layerType, point);
    } else {
      setCanvasState({
        mode: CanvasMode.None,
      })
    }

    history.resume();
  }, [
    camera,
    canvasState,
    history,
    unselectLayers,
    setCanvasState,
    insertPath,
    insertLayer,
  ]);

  const handleLayerPointerDown = useMutation((
    { self, setMyPresence },
    e: React.PointerEvent,
    layerId,
  ) => {

    if (
      canvasState.mode === CanvasMode.Pencil
      || canvasState.mode === CanvasMode.Inserting
    ) {
      return;
    }

    history.pause();
    e.stopPropagation();

    const point = pointerEventToCanvasPoint(e, camera);

    if (!self.presence.selection.includes(layerId)) {
      setMyPresence({ selection: [layerId] }, { addToHistory: true });
    }

    setCanvasState({ mode: CanvasMode.Translating, current: point });

  }, [setCanvasState, camera, history, canvasState.mode]);

  const selections = useOthersMapped((other) => other.presence.selection);
  const selfSelection = useSelf((me) => ({
    connectionId: me.connectionId,
    selection: me.presence.selection,
  }));

  const layerIdsToColorSelection = useMemo(() => {
    const layerIdsToColorSelection: Record<string, string> = {};

    for (const user of selections) {
      const [ connectionId, selection ] = user;

      for (const layerId of selection) {
        layerIdsToColorSelection[layerId] = connectionIdToColor(connectionId);
      }
    }

    for (const layerId of selfSelection.selection) {
      layerIdsToColorSelection[layerId] = connectionIdToColor(selfSelection.connectionId);
    }

    return layerIdsToColorSelection;
  }, [selections, selfSelection]);

  const deleteLayers = useDeleteLayers();

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case 'z':
          if (e.ctrlKey || e.metaKey) {
            history.undo();
          }
          break;

        case 'y':
          if (e.ctrlKey || e.metaKey) {
            history.redo();
          }
          break;

        // TODO: check if user is typing in sticky notes
        // case 'Backspace':
        //   deleteLayers();
        //   break;

        default:
          break;
      }
    }

    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
    }
  }, [deleteLayers, history]);

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
      <SelectionTools
        camera={camera}
        setLastUsedColor={setLastUsedColor}
      />
      <svg
        className="h-[100vh] w-[100vw]"
        onWheel={handleWheel}
        onPointerMove={handlePointerMove}
        onPointerLeave={handlePointerLeave}
        onPointerUp={handlePointerUp}
        onPointerDown={handlePointerDown}
      >
        <g
          style={{
            transform: `translate(${camera.x}px, ${camera.y}px)`
          }}
        >
          {layerIds.map((layerId) => (
            <LayerPreview
              key={layerId}
              id={layerId}
              onLayerPointerDown={handleLayerPointerDown}
              selectionColor={layerIdsToColorSelection[layerId]}
            />
          ))}
          <SelectionBox
            onResizeHandlePointerDown={handleResizeHandlePointerDown}
          />
          {canvasState.mode === CanvasMode.SelectionNet && canvasState.current != null && (
            <rect
              className="fill-blue-500/5 stroke-blue-500 stroke-1"
              x={Math.min(canvasState.origin.x, canvasState.current.x)}
              y={Math.min(canvasState.origin.y, canvasState.current.y)}
              width={Math.abs(canvasState.origin.x - canvasState.current.x)}
              height={Math.abs(canvasState.origin.y - canvasState.current.y)}
            />
          )}
          <CursorsPresence />
          {pencilDraft != null && pencilDraft.length > 0 && (
            <Path
              points={pencilDraft}
              fill={colorToCss(lastUsedColor)}
              x={0}
              y={0}
            />
          )}
        </g>
      </svg>
    </main>
  )
}

export default Canvas