"use client";

import { ClientSideSuspense } from "@liveblocks/react";
import { Children, ReactNode } from "react";

import { RoomProvider } from "@/liveblocks.config";

import React from 'react'

interface RoomProps {
  children: ReactNode;
  roomId: string;
  fallback: NonNullable<ReactNode> | null;
}

const Room = ({
  children,
  roomId,
  fallback,
}: RoomProps) => {
  return (
    <RoomProvider
      id={roomId}
      initialPresence={{}}
    >
      <ClientSideSuspense fallback={fallback}>
        {() => children}
      </ClientSideSuspense>
    </RoomProvider>
  )
}

export default Room