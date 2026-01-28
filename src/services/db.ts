import { openDB } from 'idb';
import type { DBSchema, IDBPDatabase } from 'idb';
import type { Player, LeagueRanking } from '../types/types';

/**
 * IndexedDB Database Schema
 * 
 * Best Practice: Define a typed schema to ensure type safety
 * and make migrations easier to manage.
 */
interface FmStatsDB extends DBSchema {
  players: {
    key: number; // Player UID
    value: Player;
    indexes: {
      'by-name': string; // Index for searching by name
      'by-club': string; // Index for filtering by club
      'by-position': string; // Index for filtering by position
    };
  };
  leagueRankings: {
    key: number; // rank (1-6)
    value: LeagueRanking;
  };
  compareList: {
    key: string;
    value: { id: string; uids: number[] };
  };
}

/**
 * Database Configuration
 * 
 * Best Practice: Centralize database configuration
 * - DB_NAME: Single source of truth for database name
 * - DB_VERSION: Increment this when you need to change the schema
 */
const DB_NAME = 'fm-stats-db';
const DB_VERSION = 3;

/**
 * IndexedDB Service
 * 
 * Best Practices implemented:
 * 1. Singleton pattern - single database connection instance
 * 2. Lazy initialization - database opens only when needed
 * 3. Proper error handling with meaningful messages
 * 4. Type-safe operations using idb package
 * 5. Indexes for efficient queries
 * 6. Version management for schema migrations
 */
class DatabaseService {
  private dbPromise: Promise<IDBPDatabase<FmStatsDB>> | null = null;

  /**
   * Get or create database connection
   * 
   * Best Practice: Use a promise-based singleton pattern
   * to ensure only one database connection exists at a time.
   */
  private getDB(): Promise<IDBPDatabase<FmStatsDB>> {
    if (!this.dbPromise) {
      this.dbPromise = openDB<FmStatsDB>(DB_NAME, DB_VERSION, {
        /**
         * Upgrade callback - runs when database version changes
         * 
         * Best Practice: Always handle upgrades explicitly.
         * This is where you create/delete object stores and indexes.
         */
        upgrade(db, oldVersion) {
          // Create 'players' object store if it doesn't exist
          if (!db.objectStoreNames.contains('players')) {
            const playerStore = db.createObjectStore('players', {
              keyPath: 'UID', // Use UID as the primary key
            });

            // Create indexes for efficient queries
            // Best Practice: Create indexes for fields you'll query frequently
            playerStore.createIndex('by-name', 'Name', { unique: false });
            playerStore.createIndex('by-club', 'Club', { unique: false });
            playerStore.createIndex('by-position', 'Position', { unique: false });
          }

          if (oldVersion < 2) {
            db.createObjectStore('leagueRankings', {
              keyPath: 'rank',
            });
          }

          if (oldVersion < 3) {
            db.createObjectStore('compareList', {
              keyPath: 'id',
            });
          }
        },
      });
    }
    return this.dbPromise;
  }

  /**
   * Save a single player to the database
   * 
   * Best Practice: Use transactions for write operations.
   * Transactions ensure data consistency and atomicity.
   */
  async savePlayer(player: Player): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('players', 'readwrite');
      await tx.store.put(player);
      await tx.done; // Wait for transaction to complete
    } catch (error) {
      throw new Error(`Failed to save player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save multiple players in a single transaction
   * 
   * Best Practice: Batch operations in a single transaction
   * for better performance and atomicity (all or nothing).
   */
  async savePlayers(players: Player[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('players', 'readwrite');
      
      // Use Promise.all for parallel writes within the transaction
      await Promise.all(players.map(player => tx.store.put(player)));
      await tx.done;
    } catch (error) {
      throw new Error(`Failed to save players: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get a player by UID
   */
  async getPlayer(uid: number): Promise<Player | undefined> {
    try {
      const db = await this.getDB();
      return await db.get('players', uid);
    } catch (error) {
      throw new Error(`Failed to get player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all players
   * 
   * Best Practice: Use getAll() for fetching all records
   * instead of cursors when you need everything.
   */
  async getAllPlayers(): Promise<Player[]> {
    try {
      const db = await this.getDB();
      return await db.getAll('players');
    } catch (error) {
      throw new Error(`Failed to get players: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get players by club
   * 
   * Best Practice: Use indexes for efficient queries.
   * This is much faster than filtering in memory.
   */
  async getPlayersByClub(club: string): Promise<Player[]> {
    try {
      const db = await this.getDB();
      return await db.getAllFromIndex('players', 'by-club', club);
    } catch (error) {
      throw new Error(`Failed to get players by club: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get players by position
   */
  async getPlayersByPosition(position: string): Promise<Player[]> {
    try {
      const db = await this.getDB();
      return await db.getAllFromIndex('players', 'by-position', position);
    } catch (error) {
      throw new Error(`Failed to get players by position: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Search players by name (case-insensitive)
   * 
   * Best Practice: For text search, you may need to filter in memory
   * since IndexedDB doesn't support case-insensitive queries natively.
   * For large datasets, consider using a full-text search library.
   */
  async searchPlayersByName(searchTerm: string): Promise<Player[]> {
    try {
      const db = await this.getDB();
      const allPlayers = await db.getAll('players');
      const lowerSearch = searchTerm.toLowerCase();
      
      return allPlayers.filter(player => 
        player.Name.toLowerCase().includes(lowerSearch)
      );
    } catch (error) {
      throw new Error(`Failed to search players: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a player by UID
   */
  async deletePlayer(uid: number): Promise<void> {
    try {
      const db = await this.getDB();
      await db.delete('players', uid);
    } catch (error) {
      throw new Error(`Failed to delete player: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all players
   * 
   * Best Practice: Use clear() for removing all records
   * instead of deleting one by one.
   */
  async clearAllPlayers(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('players', 'readwrite');
      await tx.store.clear();
      await tx.done;
    } catch (error) {
      throw new Error(`Failed to clear players: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the count of players
   */
  async getPlayerCount(): Promise<number> {
    try {
      const db = await this.getDB();
      return await db.count('players');
    } catch (error) {
      throw new Error(`Failed to get player count: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Save league rankings
   *
   * Clears existing rankings and saves new ones in a single transaction.
   */
  async saveLeagueRankings(rankings: LeagueRanking[]): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('leagueRankings', 'readwrite');
      await tx.store.clear();
      await Promise.all(rankings.map(ranking => tx.store.put(ranking)));
      await tx.done;
    } catch (error) {
      throw new Error(`Failed to save league rankings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get all league rankings sorted by rank
   */
  async getLeagueRankings(): Promise<LeagueRanking[]> {
    try {
      const db = await this.getDB();
      const rankings = await db.getAll('leagueRankings');
      return rankings.sort((a, b) => a.rank - b.rank);
    } catch (error) {
      throw new Error(`Failed to get league rankings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Clear all league rankings
   */
  async clearLeagueRankings(): Promise<void> {
    try {
      const db = await this.getDB();
      const tx = db.transaction('leagueRankings', 'readwrite');
      await tx.store.clear();
      await tx.done;
    } catch (error) {
      throw new Error(`Failed to clear league rankings: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  async getCompareList(): Promise<number[]> {
    try {
      const db = await this.getDB();
      const entry = await db.get('compareList', 'default');
      return entry?.uids ?? [];
    } catch {
      return [];
    }
  }

  async saveCompareList(uids: number[]): Promise<void> {
    try {
      const db = await this.getDB();
      await db.put('compareList', { id: 'default', uids });
    } catch (error) {
      throw new Error(`Failed to save compare list: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export const db = new DatabaseService();
