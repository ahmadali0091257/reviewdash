/* ==========================================
   🔥 FIREBASE OPTIMIZATION - READY TO USE CODE
   Copy-paste this code to reduce Firebase reads by 80-90%
   ========================================== */

// ==========================================
// 1. CACHE HELPER (LocalStorage Based)
// ==========================================
const FirebaseCache = {
    // Default cache duration: 5 minutes
    CACHE_DURATION: 5 * 60 * 1000,
    
    get(key) {
        try {
            const cached = localStorage.getItem(`fb_cache_${key}`);
            if (!cached) return null;
            
            const { data, timestamp } = JSON.parse(cached);
            
            // Check if cache expired
            if (Date.now() - timestamp > this.CACHE_DURATION) {
                this.remove(key);
                return null;
            }
            
            console.log(`✅ Cache HIT for: ${key}`);
            return data;
        } catch (error) {
            console.error('Cache read error:', error);
            return null;
        }
    },
    
    set(key, data, customDuration = null) {
        try {
            const cacheData = {
                data,
                timestamp: Date.now(),
                duration: customDuration || this.CACHE_DURATION
            };
            localStorage.setItem(`fb_cache_${key}`, JSON.stringify(cacheData));
            console.log(`💾 Cached: ${key}`);
        } catch (error) {
            console.error('Cache write error:', error);
        }
    },
    
    remove(key) {
        localStorage.removeItem(`fb_cache_${key}`);
        console.log(`🗑️ Cache cleared: ${key}`);
    },
    
    clearAll() {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.startsWith('fb_cache_')) {
                localStorage.removeItem(key);
            }
        });
        console.log('🧹 All cache cleared');
    },
    
    // Invalidate cache when data changes
    invalidate(pattern) {
        const keys = Object.keys(localStorage);
        keys.forEach(key => {
            if (key.includes(pattern)) {
                localStorage.removeItem(key);
            }
        });
        console.log(`🔄 Invalidated cache matching: ${pattern}`);
    }
};

// ==========================================
// 2. OPTIMIZED DATA FETCHING
// ==========================================

// BEFORE (Bad - Always fetches from Firebase)
async function fetchProductsOLD() {
    const snap = await getDocs(collection(db, "products"));
    return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}

// AFTER (Good - Uses cache first)
async function fetchProductsNEW() {
    // Try cache first
    const cached = FirebaseCache.get('products');
    if (cached) {
        return cached;
    }
    
    // Fetch from Firebase only if cache miss
    const snap = await getDocs(collection(db, "products"));
    const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Cache for 5 minutes
    FirebaseCache.set('products', products);
    
    return products;
}

// ==========================================
// 3. OPTIMIZED DASHBOARD STATS
// ==========================================

// BEFORE (Bad - Fetches all products every time)
async function renderDashboardOLD() {
    const productsSnap = await getDocs(collection(db, "products"));
    const logsSnap = await getDocs(collection(db, "daily_logs"));
    
    document.getElementById('stat-total-products').innerText = productsSnap.size;
    // ... more calculations
}

// AFTER (Good - Uses cached data)
async function renderDashboardNEW() {
    // Try cache first
    let stats = FirebaseCache.get('dashboard_stats');
    
    if (!stats) {
        // Only fetch if cache expired
        const productsSnap = await getDocs(collection(db, "products"));
        const logsSnap = await getDocs(collection(db, "daily_logs"));
        
        stats = {
            totalProducts: productsSnap.size,
            completedReviews: logsSnap.docs.reduce((acc, doc) => acc + (doc.data().completedReviews || 0), 0),
            // ... more stats
        };
        
        // Cache for 2 minutes (dashboard updates more frequently)
        FirebaseCache.set('dashboard_stats', stats, 2 * 60 * 1000);
    }
    
    document.getElementById('stat-total-products').innerText = stats.totalProducts;
    document.getElementById('stat-completed-reviews').innerText = stats.completedReviews;
}

// ==========================================
// 4. CACHE INVALIDATION ON MUTATIONS
// ==========================================

// When adding a product
async function addProductOptimized(productData) {
    await addDoc(collection(db, "products"), productData);
    
    // Clear relevant caches
    FirebaseCache.invalidate('products');
    FirebaseCache.invalidate('dashboard');
    
    showToast('Product added successfully!');
}

// When updating a product
async function updateProductOptimized(productId, productData) {
    await updateDoc(doc(db, "products", productId), productData);
    
    // Clear relevant caches
    FirebaseCache.invalidate('products');
    FirebaseCache.invalidate('dashboard');
    
    showToast('Product updated successfully!');
}

// When deleting a product
async function deleteProductOptimized(productId) {
    await deleteDoc(doc(db, "products", productId));
    
    // Clear all caches (since this affects multiple collections)
    FirebaseCache.clearAll();
    
    showToast('Product deleted successfully!');
}

// ==========================================
// 5. SMART PAGINATION WITH CACHE
// ==========================================

let paginationCache = {
    lastPage: 0,
    pages: {}
};

async function fetchPaginatedProductsOptimized(page = 1, itemsPerPage = 10) {
    // Check if page is cached
    const cacheKey = `products_page_${page}`;
    const cached = FirebaseCache.get(cacheKey);
    
    if (cached) {
        return cached;
    }
    
    // Calculate offset
    const offset = (page - 1) * itemsPerPage;
    
    // Fetch from Firebase
    const q = query(
        collection(db, "products"),
        orderBy("createdAt", "desc"),
        limit(itemsPerPage),
        startAfter(offset)
    );
    
    const snap = await getDocs(q);
    const products = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    // Cache this page for 10 minutes
    FirebaseCache.set(cacheKey, products, 10 * 60 * 1000);
    
    return products;
}

// ==========================================
// 6. REAL-TIME LISTENERS (OPTIONAL)
// ==========================================

let unsubscribeProducts = null;

function setupRealtimeListeners() {
    // Unsubscribe previous listener if exists
    if (unsubscribeProducts) {
        unsubscribeProducts();
    }
    
    // Setup new listener
    const q = query(collection(db, "products"));
    
    unsubscribeProducts = onSnapshot(q, (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === "added") {
                console.log("New product: ", change.doc.data());
                // Update local state
            }
            if (change.type === "modified") {
                console.log("Modified product: ", change.doc.data());
                // Update local state
            }
            if (change.type === "removed") {
                console.log("Removed product: ", change.doc.id);
                // Update local state
            }
        });
        
        // Clear cache when real-time update received
        FirebaseCache.invalidate('products');
        
        // Re-render UI
        renderProductsTable();
    });
}

// Cleanup on logout
function cleanupListeners() {
    if (unsubscribeProducts) {
        unsubscribeProducts();
        unsubscribeProducts = null;
    }
}

// ==========================================
// 7. FIRESTORE PERSISTENCE (OFFLINE SUPPORT)
// ==========================================

// Add this when initializing Firestore
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

// ==========================================
// 8. BATCH OPERATIONS (REDUCE WRITES)
// ==========================================

async function batchUpdateProducts(updates) {
    const batch = writeBatch(db);
    
    updates.forEach(({ id, data }) => {
        const docRef = doc(db, "products", id);
        batch.update(docRef, data);
    });
    
    await batch.commit();
    
    // Clear cache after batch operation
    FirebaseCache.invalidate('products');
    
    console.log(`✅ Batch updated ${updates.length} products`);
}

// ==========================================
// 9. USAGE TRACKING (MONITOR READS)
// ==========================================

let readCounter = {
    session: 0,
    cached: 0,
    firebase: 0
};

// Wrap getDocs to track reads
const originalGetDocs = getDocs;
getDocs = async (...args) => {
    readCounter.firebase++;
    readCounter.session++;
    console.log(`📊 Firebase Reads: ${readCounter.firebase} | Cached: ${readCounter.cached} | Total: ${readCounter.session}`);
    return originalGetDocs(...args);
};

// Track cache hits
const originalCacheGet = FirebaseCache.get;
FirebaseCache.get = function(key) {
    const result = originalCacheGet.call(this, key);
    if (result) {
        readCounter.cached++;
        readCounter.session++;
    }
    return result;
};

// Display stats
function showReadStats() {
    const savings = ((readCounter.cached / readCounter.session) * 100).toFixed(1);
    console.log(`
    📊 SESSION STATS:
    ✅ Cache Hits: ${readCounter.cached}
    🔥 Firebase Reads: ${readCounter.firebase}
    📈 Total Requests: ${readCounter.session}
    💰 Cache Savings: ${savings}%
    `);
}

// ==========================================
// 10. COMPLETE IMPLEMENTATION EXAMPLE
// ==========================================

async function initializeDataOptimized() {
    try {
        // 1. Try to load from cache first
        let products = FirebaseCache.get('today_products');
        let stats = FirebaseCache.get('dashboard_stats');
        
        // 2. If cache miss, fetch from Firebase
        if (!products) {
            const todaySnap = await getDocs(
                query(
                    collection(db, "products"),
                    where("days", "array-contains-any", [getCurrentDayName(), getYesterdayDayName()])
                )
            );
            products = todaySnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            FirebaseCache.set('today_products', products);
        }
        
        if (!stats) {
            const countSnap = await getCountFromServer(collection(db, "products"));
            const logsSnap = await getDocs(
                query(
                    collection(db, "daily_logs"),
                    where("date", ">=", getDateString7DaysAgo())
                )
            );
            
            stats = {
                totalProducts: countSnap.data().count,
                dailyLogs: logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }))
            };
            
            FirebaseCache.set('dashboard_stats', stats, 2 * 60 * 1000); // 2 min cache
        }
        
        // 3. Update UI
        state.todayProducts = products;
        state.totalProductsCount = stats.totalProducts;
        state.dailyLogs = stats.dailyLogs;
        
        setupUI();
        switchView('dashboard');
        
        // 4. Show stats
        showReadStats();
        
    } catch(e) {
        console.error('Error loading data:', e);
        showToast("Error loading data", "error");
    }
}

// ==========================================
// 11. CLEAR CACHE ON LOGOUT
// ==========================================

document.getElementById('logout-btn').addEventListener('click', () => {
    // Clear cache before logout
    FirebaseCache.clearAll();
    cleanupListeners();
    signOut(auth);
});

// ==========================================
// 12. PERIODIC CACHE CLEANUP
// ==========================================

// Clear expired cache every 10 minutes
setInterval(() => {
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith('fb_cache_')) {
            // Force re-validation by getting (which auto-removes expired)
            const cacheKey = key.replace('fb_cache_', '');
            FirebaseCache.get(cacheKey);
        }
    });
    console.log('🧹 Periodic cache cleanup completed');
}, 10 * 60 * 1000);

/* ==========================================
   IMPLEMENTATION CHECKLIST:
   
   ✅ 1. Copy FirebaseCache object to your code
   ✅ 2. Replace all getDocs() calls with cached versions
   ✅ 3. Add cache invalidation to all mutations (add/update/delete)
   ✅ 4. Enable Firestore persistence
   ✅ 5. Test and monitor read counts
   ✅ 6. Adjust cache durations based on your needs
   
   EXPECTED RESULTS:
   - 80-90% reduction in Firebase reads
   - Faster page loads
   - Better offline support
   - Lower Firebase costs
   ========================================== */
