"use client";

import EmptyBoards from "./empty-boards";
import EmptyFavorites from "./empty-favorites";
import EmptySearch from "./empty-search";

interface BoardListProps {
  orgId: string;
  query: {
    searh?: string;
    favorites?: string;
  };
}

const BoardList = ({
  orgId,
  query,
}: BoardListProps) => {

  const data = []; // TODO: Change to API call

  if (!data?.length && query.searh) {
    return (
      <EmptySearch />
    )
  }

  if (!data?.length && query.favorites) {
    return (
      <EmptyFavorites />
    )
  }

  if (!data?.length) {
    return (
      <EmptyBoards />
    );
  }

  return (
    <div>
      Board list
    </div>
  )
}

export default BoardList;