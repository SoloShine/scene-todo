import { useState, useEffect, useCallback } from "react";
import type { Tag, CreateTag, UpdateTag } from "../types";
import * as api from "../lib/invoke";

export function useTags() {
  const [tags, setTags] = useState<Tag[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listTags();
      setTags(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateTag) => {
    await api.createTag(input);
    await refresh();
  };

  const update = async (input: UpdateTag) => {
    await api.updateTag(input);
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteTag(id);
    await refresh();
  };

  return { tags, loading, create, update, remove, refresh };
}
