import { useEffect, useRef, useCallback } from 'react';

export function useWebSocket(onMessage) {
  const ws = useRef(null);
  const onMessageRef = useRef(onMessage);
  onMessageRef.current = onMessage;

  const connect = useCallback(() => {
    const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = location.hostname;
    const port = import.meta.env.DEV ? '3001' : location.port;
    const url = `${protocol}//${host}:${port}`;

    const socket = new WebSocket(url);

    socket.onmessage = e => {
      try {
        const msg = JSON.parse(e.data);
        onMessageRef.current?.(msg);
      } catch {}
    };

    socket.onclose = () => {
      setTimeout(connect, 3000);
    };

    socket.onerror = () => socket.close();

    ws.current = socket;
  }, []);

  useEffect(() => {
    connect();
    return () => ws.current?.close();
  }, [connect]);
}
