/* Persistence layer: the "database layer" from the report's architecture (Figure 3.2).
   This frontend-only version keeps data in the browser's localStorage.
   To connect MySQL later, replace load/save/clear with calls to an API; nothing else changes. */
const Repository = {
  key: "banking-system-v2",
  load() { try { const s = localStorage.getItem(this.key); return s ? JSON.parse(s) : null; } catch (e) { return null; } },
  save(data) { try { localStorage.setItem(this.key, JSON.stringify(data)); } catch (e) {} },
  clear() { try { localStorage.removeItem(this.key); } catch (e) {} }
};
