import { useState, useEffect, useCallback } from "react";
import type { Group, CreateGroup, UpdateGroup } from "../types";
import * as api from "../lib/invoke";
import { notify } from "../lib/toast";

export function useGroups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.listGroups();
      setGroups(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  const create = async (input: CreateGroup) => {
    try {
      await api.createGroup(input);
      await refresh();
      notify.success("分组已创建");
    } catch (e) { notify.error("创建分组失败"); throw e; }
  };

  const update = async (input: UpdateGroup) => {
    try {
      await api.updateGroup(input);
      await refresh();
      notify.success("分组已更新");
    } catch (e) { notify.error("更新分组失败"); throw e; }
  };

  const remove = async (id: number) => {
    try {
      await api.deleteGroup(id);
      await refresh();
      notify.success("分组已删除");
    } catch (e) { notify.error("删除分组失败"); throw e; }
  };

  return { groups, loading, create, update, remove, refresh };
}
