/**
 * Test utilities for IndexedDB and Blob support in Node.js
 */

const { Blob } = require('node:buffer');
const fakeIndexedDB = require('fake-indexeddb');

/**
 * Initialize IndexedDB and Blob for Node.js test environment
 */
function setupIndexedDBEnvironment() {
    // Setup fake-indexeddb
    global.indexedDB = fakeIndexedDB.default || fakeIndexedDB;
    global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange');

    // Make Blob globally available
    if (typeof global.Blob === 'undefined') {
        global.Blob = Blob;
    }

    // Polyfill structuredClone for Node.js < 17
    if (typeof global.structuredClone === 'undefined') {
        global.structuredClone = (obj) => {
            // Handle null and undefined
            if (obj === null || obj === undefined) {
                return obj;
            }
            
            // Handle primitives
            if (typeof obj !== 'object') {
                return obj;
            }
            
            // Handle Blob
            if (obj instanceof Blob) {
                return new Blob([obj], { type: obj.type });
            }
            
            // Handle Array
            if (Array.isArray(obj)) {
                return obj.map(item => global.structuredClone(item));
            }
            
            // Handle Date
            if (obj instanceof Date) {
                return new Date(obj.getTime());
            }
            
            // Handle plain objects
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = global.structuredClone(obj[key]);
                }
            }
            return cloned;
        };
    }
}

module.exports = {
    setupIndexedDBEnvironment
};
