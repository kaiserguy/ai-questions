/**
 * IndexedDB Manager
 * Generic wrapper for IndexedDB operations
 */
class IndexedDBManager {
    constructor(dbName, version = 1) {
        this.dbName = dbName;
        this.version = version;
        this.db = null;
    }

    /**
     * Open database connection
     * @param {Object} schema - Database schema definition
     * @returns {Promise<IDBDatabase>}
     */
    async open(schema) {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onerror = () => {
                reject(new Error(`Failed to open database: ${request.error}`));
            };

            request.onsuccess = () => {
                this.db = request.result;
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                this.createStores(db, schema);
            };
        });
    }

    /**
     * Create object stores based on schema
     * @param {IDBDatabase} db
     * @param {Object} schema
     */
    createStores(db, schema) {
        for (const [storeName, storeConfig] of Object.entries(schema)) {
            if (!db.objectStoreNames.contains(storeName)) {
                const objectStore = db.createObjectStore(storeName, {
                    keyPath: storeConfig.keyPath,
                    autoIncrement: storeConfig.autoIncrement || false
                });

                // Create indexes
                if (storeConfig.indexes) {
                    for (const [indexName, indexConfig] of Object.entries(storeConfig.indexes)) {
                        objectStore.createIndex(indexName, indexConfig.keyPath || indexName, {
                            unique: indexConfig.unique || false,
                            multiEntry: indexConfig.multiEntry || false
                        });
                    }
                }
            }
        }
    }

    /**
     * Add or update a record
     * @param {string} storeName
     * @param {*} data
     * @returns {Promise<*>}
     */
    async put(storeName, data) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.put(data);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to put data: ${request.error}`));
        });
    }

    /**
     * Get a record by key
     * @param {string} storeName
     * @param {*} key
     * @returns {Promise<*>}
     */
    async get(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.get(key);

            request.onsuccess = () => resolve(request.result || null);
            request.onerror = () => reject(new Error(`Failed to get data: ${request.error}`));
        });
    }

    /**
     * Get all records from a store
     * @param {string} storeName
     * @returns {Promise<Array>}
     */
    async getAll(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.getAll();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to get all data: ${request.error}`));
        });
    }

    /**
     * Delete a record by key
     * @param {string} storeName
     * @param {*} key
     * @returns {Promise<void>}
     */
    async delete(storeName, key) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete data: ${request.error}`));
        });
    }

    /**
     * Clear all records from a store
     * @param {string} storeName
     * @returns {Promise<void>}
     */
    async clear(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to clear store: ${request.error}`));
        });
    }

    /**
     * Count records in a store
     * @param {string} storeName
     * @returns {Promise<number>}
     */
    async count(storeName) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const request = store.count();

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to count records: ${request.error}`));
        });
    }

    /**
     * Query records using an index
     * @param {string} storeName
     * @param {string} indexName
     * @param {*} query
     * @returns {Promise<Array>}
     */
    async queryByIndex(storeName, indexName, query) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readonly');
            const store = transaction.objectStore(storeName);
            const index = store.index(indexName);
            const request = index.getAll(query);

            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(new Error(`Failed to query by index: ${request.error}`));
        });
    }

    /**
     * Batch insert records
     * @param {string} storeName
     * @param {Array} records
     * @returns {Promise<void>}
     */
    async batchPut(storeName, records) {
        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);

            let completed = 0;
            let hasFailed = false;
            const total = records.length;

            records.forEach(record => {
                const request = store.put(record);
                request.onsuccess = () => {
                    if (hasFailed) {
                        return;
                    }
                    completed++;
                    if (completed === total) {
                        resolve();
                    }
                };
                request.onerror = () => {
                    if (hasFailed) {
                        return;
                    }
                    hasFailed = true;
                    try {
                        transaction.abort();
                    } catch (e) {
                        // Ignore abort errors; primary failure is reported via reject below.
                    }
                    reject(new Error(`Failed to batch put: ${request.error}`));
                };
            });

            if (total === 0) {
                resolve();
            }
        });
    }

    /**
     * Get storage estimate
     * @returns {Promise<Object>}
     */
    async getStorageEstimate() {
        if (navigator.storage && navigator.storage.estimate) {
            return await navigator.storage.estimate();
        }
        throw new Error('Storage estimation not supported');
    }

    /**
     * Close database connection
     */
    close() {
        if (this.db) {
            this.db.close();
            this.db = null;
        }
    }

    /**
     * Delete the entire database
     * @returns {Promise<void>}
     */
    async deleteDatabase() {
        this.close();
        return new Promise((resolve, reject) => {
            const request = indexedDB.deleteDatabase(this.dbName);
            request.onsuccess = () => resolve();
            request.onerror = () => reject(new Error(`Failed to delete database: ${request.error}`));
        });
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = IndexedDBManager;
}
if (typeof window !== 'undefined') {
    window.IndexedDBManager = IndexedDBManager;
}
