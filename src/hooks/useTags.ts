import { useState, useEffect, useCallback } from "react";
import type { Tag, CreateTag, UpdateTag } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";

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
    try {
      await api.createTag(input);
      await refresh();
      notify.success("标签已创建");
    } catch (e) { notify.error("创建标签失败"); throw e; }
  };

  const update = async (input: UpdateTag) => {
    try {
      await api.updateTag(input);
      await refresh();
      notify.success("标签已更新");
    } catch (e) { notify.error("更新标签失败"); throw e; }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteTag(id);
      await refresh();
      notify.success("标签已删除");
    } catch (e) { notify.error("删除标签失败"); throw e; }
  };

  return { tags, loading, create, update, remove, refresh };
}
