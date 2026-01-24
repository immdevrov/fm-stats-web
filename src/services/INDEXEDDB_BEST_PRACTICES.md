# IndexedDB Best Practices

This document explains the best practices implemented in our IndexedDB service (`db.ts`).

## 1. Use a Wrapper Library (idb)

**Why:** The native IndexedDB API is callback-based and verbose. The `idb` package by Jake Archibald provides:
- Promise-based API (much cleaner than callbacks)
- TypeScript support
- Better error handling
- Simplified transaction management

**Implementation:** We use `idb`'s `openDB` function which returns a promise-based database connection.

## 2. Singleton Pattern for Database Connection

**Why:** Opening multiple database connections can cause issues and waste resources.

**Implementation:**
```typescript
class DatabaseService {
  private dbPromise: Promise<IDBPDatabase<FmStatsDB>> | null = null;

  private getDB(): Promise<IDBPDatabase<FmStatsDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FmStatsDB>(DB_NAME, DB_VERSION, { ... });
    }
    return this.dbPromise;
  }
}
```

**Benefit:** Ensures only one connection exists, and it's reused across all operations.

## 3. Type-Safe Schema Definition

**Why:** TypeScript types catch errors at compile time and provide better IDE support.

**Implementation:**
```typescript
interface FmStatsDB extends DBSchema {
  players: {
    key: number;        // Primary key type
    value: Player;      // Value type
    indexes: {          // Index definitions
      'by-name': string;
      'by-club': string;
      'by-position': string;
    };
  };
}
```

**Benefit:** Type safety ensures you can't accidentally store wrong data types or access non-existent indexes.

## 4. Version Management for Schema Migrations

**Why:** When you need to change the database structure (add stores, indexes, etc.), you need version upgrades.

**Implementation:**
```typescript
const DB_VERSION = 1;

openDB(DB_NAME, DB_VERSION, {
  upgrade(db, oldVersion, newVersion, transaction) {
    // Create stores and indexes here
    if (!db.objectStoreNames.contains('players')) {
      // Create store
    }
  }
});
```

**Best Practice:**
- Always increment `DB_VERSION` when changing schema
- Check `oldVersion` to handle migrations from any previous version
- Use transactions in upgrade callbacks for atomicity

## 5. Use Indexes for Efficient Queries

**Why:** Indexes make queries much faster. Without indexes, IndexedDB must scan all records.

**Implementation:**
```typescript
playerStore.createIndex('by-club', 'Club', { unique: false });
// Later, query using the index:
db.getAllFromIndex('players', 'by-club', 'Manchester United');
```

**Best Practice:**
- Create indexes for fields you'll query frequently
- Don't over-index (each index uses storage space)
- Use `getAllFromIndex()` instead of filtering in memory

## 6. Batch Operations in Single Transactions

**Why:** Transactions ensure atomicity (all-or-nothing) and better performance.

**Implementation:**
```typescript
async savePlayers(players: Player[]): Promise<void> {
  const db = await this.getDB();
  const tx = db.transaction('players', 'readwrite');
  
  // All operations in one transaction
  await Promise.all(players.map(player => tx.store.put(player)));
  await tx.done; // Wait for transaction to complete
}
```

**Benefits:**
- **Atomicity:** If one operation fails, all are rolled back
- **Performance:** Single transaction is faster than multiple
- **Consistency:** Database stays in valid state

## 7. Always Wait for Transactions to Complete

**Why:** IndexedDB operations are asynchronous. You must wait for `tx.done` to ensure all operations completed.

**Implementation:**
```typescript
const tx = db.transaction('players', 'readwrite');
await tx.store.put(player);
await tx.done; // ⚠️ Don't forget this!
```

**Why it matters:** Without `tx.done`, the transaction might not complete before your code continues.

## 8. Proper Error Handling

**Why:** IndexedDB can fail for various reasons (quota exceeded, database blocked, etc.).

**Implementation:**
```typescript
try {
  await db.savePlayer(player);
} catch (error) {
  throw new Error(`Failed to save player: ${error.message}`);
}
```

**Best Practice:**
- Always wrap IndexedDB operations in try-catch
- Provide meaningful error messages
- Handle specific error types (QuotaExceededError, etc.) when needed

## 9. Use Appropriate Transaction Modes

**Transaction Modes:**
- `'readonly'`: For read operations (faster, allows parallel reads)
- `'readwrite'`: For write operations (exclusive, slower)

**Best Practice:**
```typescript
// For reads
const tx = db.transaction('players', 'readonly');

// For writes
const tx = db.transaction('players', 'readwrite');
```

**Why:** Read-only transactions can run in parallel, improving performance.

## 10. Use `getAll()` Instead of Cursors When Possible

**Why:** `getAll()` is simpler and often faster for fetching all records.

**When to use cursors:**
- Processing large datasets in chunks
- Need to filter/transform during iteration
- Memory constraints (process one at a time)

**When to use `getAll()`:**
- Need all records at once
- Small to medium datasets
- Simpler code

## 11. Handle Date Objects Properly

**Important:** IndexedDB stores dates as strings, not Date objects!

**Best Practice:** Convert dates when saving/loading:
```typescript
// When saving: Date → string (or timestamp)
// When loading: string (or timestamp) → Date
```

**Note:** Our current implementation stores Date objects directly, which works but may cause issues. Consider storing as ISO strings or timestamps for better compatibility.

## 12. Database Lifecycle Management

**Best Practices:**
- Don't close the database manually (let idb handle it)
- Handle database blocking (when another tab has it open)
- Consider cleanup for old/unused data

## Common Pitfalls to Avoid

1. **Forgetting `tx.done`:** Always await transaction completion
2. **Not handling errors:** IndexedDB can fail silently if not caught
3. **Opening multiple connections:** Use singleton pattern
4. **Not using indexes:** Queries will be slow on large datasets
5. **Storing non-serializable data:** Functions, symbols, etc. won't work
6. **Not versioning:** Schema changes require version increments

## Performance Tips

1. **Batch writes:** Save multiple records in one transaction
2. **Use indexes:** Create indexes for frequently queried fields
3. **Read-only transactions:** Use when possible for parallel reads
4. **Limit data size:** IndexedDB has quotas (usually 50% of disk space)
5. **Clean up old data:** Periodically remove unused records

## Testing IndexedDB

**In Browser DevTools:**
1. Open DevTools → Application tab
2. Click "IndexedDB" in left sidebar
3. View your database, stores, and data
4. You can manually inspect, edit, or delete data

**Useful for:**
- Debugging data issues
- Verifying data is saved correctly
- Testing migrations
- Clearing data during development
