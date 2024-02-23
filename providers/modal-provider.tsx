"use client";

import { useEffect, useState } from "react";

import RenameModal from "@/components/modals/rename-modal";
import { ProModal } from "@/components/modals/pro-modal";


const ModalProvider = () => {

  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return null;
  }

  return (
    <>
      <RenameModal />
      <ProModal />
    </>
  )
}

export default ModalProvider