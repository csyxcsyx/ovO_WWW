import { useCallback, useEffect, useRef, useState } from 'react';
import { addResult, loadLocalData, mergeSavedData, parseSavedData, persistLocalData, type SavedData } from '../platform/records';
import { readHostStorage, writeHostStorage } from '../platform/heybox';
import type { GameResult, Mode } from '../game/types';

export function useRecords(ready: boolean) {
  const [data, setData] = useState(loadLocalData);
  const [storageError, setStorageError] = useState('');
  const current = useRef(data);
  const dirty = useRef(false);
  const localSaved = useRef(true);
  const sequence = useRef(Promise.resolve());
  const [hostLoaded, setHostLoaded] = useState(false);
  const update = useCallback((next: SavedData) => { current.current = next; dirty.current = true; setData(next); }, []);
  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    void readHostStorage().then(value => {
      if (cancelled) return;
      const host = parseSavedData(value);
      const merged = mergeSavedData(current.current, host);
      if (!dirty.current && value) merged.mode = host.mode;
      current.current = merged; setData(merged); setHostLoaded(true);
    }).catch(() => { if (!cancelled) setStorageError('平台纪录暂未读取，本机纪录仍可使用。'); });
    return () => { cancelled = true; };
  }, [ready]);
  useEffect(() => {
    try { persistLocalData(data); localSaved.current = true; } catch { localSaved.current = false; setStorageError('本地保存失败，本局成绩仍可查看。'); }
    if (ready && hostLoaded) {
      // 串行整值写入，防止较旧的异步请求覆盖较新的成绩。
      sequence.current = sequence.current.catch(() => {}).then(() => writeHostStorage(data)).catch(() => { setStorageError(localSaved.current ? '平台保存失败，本机纪录仍已保留。' : '保存失败，本局成绩仍可查看。'); });
    }
  }, [data, ready, hostLoaded]);
  return { data, storageError, setMode: (mode: Mode) => update({ ...current.current, mode }),
    save: useCallback((result: GameResult) => update(addResult(current.current, result)), [update]) };
}
