import { useCallback, useEffect, useRef, useState } from 'react';

import type {
  ConsoleDataSource,
  ConsoleQueryState,
  ConsoleResumeList,
  ConsoleResumeStats,
} from '../model/console.types';

const EMPTY_LIST: ConsoleResumeList = { items: [], page: 1, pageSize: 6, total: 0 };
const EMPTY_STATS: ConsoleResumeStats = { completed: 0, draft: 0, exported: 0, total: 0 };

export function useConsoleData(
  query: ConsoleQueryState,
  dataSource: ConsoleDataSource,
  errorMessage: (error: unknown) => string,
) {
  const [listState, setListState] = useState<{
    data: ConsoleResumeList;
    error: string | null;
    key: string | null;
  }>({ data: EMPTY_LIST, error: null, key: null });
  const [statsState, setStatsState] = useState<{
    data: ConsoleResumeStats;
    error: string | null;
    key: number | null;
  }>({ data: EMPTY_STATS, error: null, key: null });
  const [reloadVersion, setReloadVersion] = useState(0);
  const listRequestId = useRef(0);
  const listQueryKey = `${query.page}:${query.pageSize}:${query.query}:${query.sort}:${query.status}:${reloadVersion}`;

  const reload = useCallback(() => {
    setReloadVersion((version) => version + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const requestId = ++listRequestId.current;

    const fetchList = async () => {
      try {
        const nextList = await dataSource.list(
          {
            page: query.page,
            pageSize: query.pageSize,
            query: query.query,
            sort: query.sort,
            status: query.status === 'all' ? undefined : query.status,
          },
          controller.signal,
        );
        if (requestId === listRequestId.current) {
          setListState({ data: nextList, error: null, key: listQueryKey });
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted && requestId === listRequestId.current) {
          setListState((current) => ({
            ...current,
            error: errorMessage(error),
            key: listQueryKey,
          }));
        }
      }
    };

    void fetchList();
    return () => controller.abort();
  }, [
    dataSource,
    errorMessage,
    listQueryKey,
    query.page,
    query.pageSize,
    query.query,
    query.sort,
    query.status,
  ]);

  useEffect(() => {
    const controller = new AbortController();

    const fetchStats = async () => {
      try {
        const stats = await dataSource.stats(controller.signal);
        setStatsState({ data: stats, error: null, key: reloadVersion });
      } catch (error: unknown) {
        if (!controller.signal.aborted) {
          setStatsState((current) => ({
            ...current,
            error: errorMessage(error),
            key: reloadVersion,
          }));
        }
      }
    };

    void fetchStats();
    return () => controller.abort();
  }, [dataSource, errorMessage, reloadVersion]);

  return {
    isListLoading: listState.key === null,
    isListRefreshing: listState.key !== null && listState.key !== listQueryKey,
    isStatsLoading: statsState.key === null || statsState.key !== reloadVersion,
    list: listState.data,
    listError: listState.key === listQueryKey ? listState.error : null,
    reload,
    stats: statsState.data,
    statsError: statsState.key === reloadVersion ? statsState.error : null,
  };
}
