import { useState, useEffect, useCallback } from "react";
import type { Group, CreateGroup, UpdateGroup } from "../types";
import * as api from "../lib/invoke";

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
    await api.createGroup(input);
    await refresh();
  };

  const update = async (input: UpdateGroup) => {
    await api.updateGroup(input);
    await refresh();
  };

  const remove = async (id: number) => {
    await api.deleteGroup(id);
    await refresh();
  };

  return { groups, loading, create, update, remove, refresh };
}
