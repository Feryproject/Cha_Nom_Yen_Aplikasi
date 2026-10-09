const { useState, useEffect, useMemo, useRef } = React;

// Default Branch Locations
const DEFAULT_BRANCHES = [
    { id: 'b1', name: 'Teh Tarik di Bazar Ganet', location: 'Bazar Ganet', active: true, productIds: ['p1', 'p2', 'p3', 'p4'] },
    { id: 'b2', name: 'Teh Tarik di Swalayan Mahkota', location: 'Swalayan Mahkota', active: true, productIds: ['p1', 'p2', 'milo'] },
    { id: 'b3', name: 'Teh Tarik di Swalayan Indocemerlang', location: 'Swalayan Indocemerlang', active: true, productIds: ['p1', 'p2', 'milo'] },
    { id: 'b4', name: 'Teh Tarik di Lapangan Merdeka', location: 'Lapangan Merdeka', active: true, productIds: ['p1', 'p2', 'p3', 'p4'] },
    { id: 'b5', name: 'Teh Tarik di TCC', location: 'TCC Mall', active: true, productIds: ['p1', 'p2', 'p3', 'p4', 'p5'] },
];

// Products & Pricing
const PRODUCTS_LIST = [
    { id: 'p1', name: 'Gelas Besar', price: 15000, icon: 'fa-glass-water' },
    { id: 'p2', name: 'Gelas Kecil', price: 10000, icon: 'fa-wine-glass-empty' },
    { id: 'p3', name: 'Gelas Panas', price: 10000, icon: 'fa-mug-hot' },
    { id: 'p4', name: 'Sanford', price: 5000, icon: 'fa-bottle-water' },
    { id: 'p5', name: 'Pop Mie', price: 10000, icon: 'fa-bowl-food' },
];

const SALES_PRODUCT_OPTIONS = [
    { id: 'p1', label: 'Gelas Besar' },
    { id: 'p2', label: 'Gelas Kecil' },
    { id: 'p3', label: 'Gelas Panas' },
    { id: 'p4', label: 'Sanford' },
    { id: 'p5', label: 'Pop Mie' },
    { id: 'milo', label: 'Milo' },
];

const getLegacyDefaultBranchProductIds = (branch = {}) => {
    const branchId = branch.id || '';
    const branchName = (branch.name || '').toLowerCase();

    if (branchId === 'b2' || branchName.includes('mahkota')) return ['p1', 'p2', 'milo'];
    if (branchId === 'b3' || branchName.includes('indocemerlang')) return ['p1', 'p2', 'milo'];
    if (branchId === 'b5' || branchName.includes('tcc')) return ['p1', 'p2', 'p3', 'p4', 'p5'];
    return ['p1', 'p2', 'p3', 'p4'];
};

const getBranchProductIds = (branch = {}) => {
    if (Array.isArray(branch.productIds) && branch.productIds.length > 0) {
        return [...new Set(branch.productIds.filter(Boolean))];
    }
    return getLegacyDefaultBranchProductIds(branch);
};

const normalizeBranchRecord = (branch = {}) => ({
    ...branch,
    active: branch.active !== false,
    productIds: getBranchProductIds(branch)
});

const getProductPriceByBranch = (productId, branchId, branchName = '') => {
    const branchRef = `${branchId || ''} ${branchName || ''}`.toLowerCase();

    if (productId === 'p4') {
        if (branchRef.includes('tcc') || branchId === 'b5') return 6000;
        return 5000;
    }

    if (productId === 'p5') {
        if (branchRef.includes('tcc') || branchId === 'b5') return 10000;
        return 0;
    }

    const product = PRODUCTS_LIST.find(p => p.id === productId);
    return product ? product.price : 0;
};

const getVisibleProductsForBranch = (branchId = '', branchName = '') => {
    const branch = { id: branchId, name: branchName };
    const allowedProductIds = getBranchProductIds(branch);

    return PRODUCTS_LIST.filter((product) => {
        if (!allowedProductIds.includes(product.id)) return false;
        return getProductPriceByBranch(product.id, branchId, branchName) > 0;
    });
};

const isMiloEnabledForBranch = (branchId = '', branchName = '') => {
    const branch = { id: branchId, name: branchName };
    return getBranchProductIds(branch).includes('milo');
};

const getMiloChargeForBranch = (branchId = '', branchName = '') => {
    return isMiloEnabledForBranch(branchId, branchName) ? 2000 : 0;
};

// Stok gelas disimpan di collection branchMaterialStock yang sama dengan stok bahan,
// dengan materialId berawalan "cup_" (mis. cup_p1), jadi tidak butuh collection baru.
const CUP_STOCK_PREFIX = 'cup_';
const getCupStockKey = (productId) => `${CUP_STOCK_PREFIX}${productId}`;
const isCupStockKey = (key) => String(key || '').startsWith(CUP_STOCK_PREFIX);
// Satuan yang ditampilkan di menu Stok > Perlengkapan untuk produk yang dijual.
const PRODUCT_STOCK_UNITS = { p1: 'cup', p2: 'cup', p3: 'cup', p4: 'botol', p5: 'cup' };
const getSavedCupQty = (branchStock = {}, productId) => {
    const entry = branchStock[getCupStockKey(productId)];
    if (!entry) return null;
    const raw = String(entry.qty ?? '').trim();
    if (raw === '') return null;
    const num = parseInt(raw, 10);
    return Number.isFinite(num) ? Math.max(0, num) : null;
};

// Default Materials & Supplies
const DEFAULT_MATERIALS = [
    { id: 'm1', name: 'Sanford', defaultUnit: 'botol/dus', category: 'bahan' },
    { id: 'm2', name: 'Gelas Panas', defaultUnit: 'pcs', category: 'perlengkapan' },
];

const FIRESTORE_COLLECTIONS = {
    branches: 'branches',
    salesLogs: 'salesLogs',
    materials: 'materials',
    branchMaterialStock: 'branchMaterialStock'
};

const firestoreDb = window.db || null;
if (!firestoreDb) {
    console.warn('Firestore instance is not ready yet.');
}

const normalizeFirestoreDoc = (doc) => ({ id: doc.id, ...(doc.data ? doc.data() : {}) });

const normalizeBranchStockMap = (snapshot) => {
    const result = {};
    snapshot.forEach((doc) => {
        const data = doc.data ? doc.data() : doc;
        const branchId = data.branchId || data.branch_id || data.branch || null;
        const materialId = data.materialId || data.material_id || data.material || null;

        if (!branchId || !materialId) return;
        if (!result[branchId]) result[branchId] = {};

        result[branchId][materialId] = {
            qty: data.qty ?? data.value ?? '',
            status: data.status || 'Aman',
            notes: data.notes || '',
            updatedBy: data.updatedBy || '',
            updatedAt: data.updatedAt || ''
        };
    });
    return result;
};

const upsertArrayCollection = async (collectionName, records) => {
    if (!firestoreDb || !Array.isArray(records)) return;

    console.log('Firestore save started for collection:', collectionName, 'count:', records.length);

    try {
        const snapshot = await firestoreDb.collection(collectionName).get();
        const existingIds = new Set(snapshot.docs.map(doc => doc.id));
        const incomingIds = new Set(records.filter(record => record && record.id).map(record => record.id));

        await Promise.all([...existingIds].filter(id => !incomingIds.has(id)).map(id => firestoreDb.collection(collectionName).doc(id).delete()));
        await Promise.all(records.filter(record => record && record.id).map(record => {
            const { id, ...rest } = record;
            return firestoreDb.collection(collectionName).doc(id).set(rest, { merge: true });
        }));

        console.log('Firestore save success for collection:', collectionName);
    } catch (error) {
        console.error('Firestore save error for collection:', collectionName, error);
        throw error;
    }
};

// PENTING: fungsi ini HANYA melakukan upsert (create/update) pada dokumen yang
// benar-benar dikirim di stockMap. Fungsi ini TIDAK PERNAH menghapus dokumen lain
// yang tidak disebutkan di sini. Ini sengaja dibuat seperti ini agar data stok hari
// sebelumnya tidak pernah terhapus hanya karena state lokal (React) belum lengkap
// saat proses simpan terjadi (misalnya karena baru buka aplikasi dan data dari
// Firestore belum selesai termuat). Penghapusan dokumen stok HANYA boleh terjadi
// lewat deleteBranchMaterialStockDocs(), yang dipanggil secara eksplisit saat user
// benar-benar menekan tombol hapus item stok.
const upsertBranchMaterialStock = async (stockMap) => {
    if (!firestoreDb) return;

    const entries = [];
    Object.entries(stockMap || {}).forEach(([branchId, materialMap]) => {
        Object.entries(materialMap || {}).forEach(([materialId, details]) => {
            entries.push({ branchId, materialId, details });
        });
    });

    if (!entries.length) return;

    console.log('stock save started (targeted upsert)', entries.length);

    try {
        await Promise.all(entries.map(({ branchId, materialId, details }) => {
            const stockId = `${branchId}_${materialId}`;
            return firestoreDb.collection(FIRESTORE_COLLECTIONS.branchMaterialStock).doc(stockId).set({
                branchId,
                materialId,
                qty: details?.qty || '0',
                status: details?.status || 'Aman',
                notes: details?.notes || '',
                updatedBy: details?.updatedBy || 'system',
                updatedAt: details?.updatedAt || new Date().toISOString()
            }, { merge: true });
        }));
        console.log('stock save success (targeted upsert)');
    } catch (error) {
        console.error('stock save error', error);
        throw error;
    }
};

// Penghapusan stok sekarang eksplisit dan bertarget (bukan "hapus semua yang tidak
// ada di snapshot terbaru"). stockIds berupa array string berformat `${branchId}_${materialId}`.
const deleteBranchMaterialStockDocs = async (stockIds) => {
    if (!firestoreDb || !stockIds || !stockIds.length) return;

    console.log('stock delete started (targeted)', stockIds);

    try {
        await Promise.all(stockIds.map((id) =>
            firestoreDb.collection(FIRESTORE_COLLECTIONS.branchMaterialStock).doc(id).delete()
        ));
        console.log('stock delete success (targeted)');
    } catch (error) {
        console.error('stock delete error', error);
        throw error;
    }
};

// Format Currency Helper
const formatRp = (num) => {
    return new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(num || 0);
};

// Format ringkas untuk label di grafik (mis. Rp1,2jt / Rp850rb) agar tidak
// memakan banyak ruang horizontal di layar kecil, tanpa mengubah nilai aslinya.
const formatRpShort = (num) => {
    const value = Number(num) || 0;
    const abs = Math.abs(value);
    if (abs >= 1000000000) return `Rp${(value / 1000000000).toFixed(1).replace(/\.0$/, '')}M`;
    if (abs >= 1000000) return `Rp${(value / 1000000).toFixed(1).replace(/\.0$/, '')}jt`;
    if (abs >= 1000) return `Rp${Math.round(value / 1000)}rb`;
    return formatRp(value);
};

const formatCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\D/g, '');
    if (!digits) return '';
    const parsed = Number(digits);
    if (!parsed) return '';
    return parsed.toLocaleString('id-ID');
};

const parseCurrencyInput = (value) => {
    const digits = String(value ?? '').replace(/\./g, '').replace(/\D/g, '');
    return digits ? Number(digits) : 0;
};

const waitForRender = () => new Promise((resolve) => {
    requestAnimationFrame(() => {
        requestAnimationFrame(resolve);
    });
});

const captureElementToPng = async (element, fileName, options = {}) => {
    if (!element) {
        throw new Error('Target screenshot tidak ditemukan di DOM.');
    }

    if (typeof html2canvas !== 'function') {
        throw new Error('html2canvas tidak tersedia di halaman ini.');
    }

    const outputWidth = options.width || 1080;
    const outputHeight = options.height || 1920;
    const background = options.background || '#21120b';

    // Pastikan element terlihat
    element.scrollIntoView({
        behavior: 'instant',
        block: 'center',
        inline: 'center'
    });

    await new Promise(resolve => requestAnimationFrame(resolve));
    await new Promise(resolve => requestAnimationFrame(resolve));

    if (document.fonts?.ready) {
        await document.fonts.ready.catch(() => {});
    }

    await new Promise(resolve => setTimeout(resolve, 300));

    // Ambil ukuran ASLI seluruh konten, ditambah sedikit buffer (CAPTURE_SAFE_MARGIN)
    // supaya elemen dekoratif di tepi kartu (mis. letter-spacing pada teks brand,
    // atau border/shadow) tidak berisiko terpotong akibat pembulatan sub-piksel
    // saat html2canvas mengukur ulang layout secara internal.
    const CAPTURE_SAFE_MARGIN = 8;
    const rect = element.getBoundingClientRect();

    const contentWidth = Math.max(
        element.scrollWidth,
        Math.ceil(rect.width)
    ) + CAPTURE_SAFE_MARGIN;

    const contentHeight = Math.max(
        element.scrollHeight,
        Math.ceil(rect.height)
    ) + CAPTURE_SAFE_MARGIN;

    console.log('Full content size:', {
        width: contentWidth,
        height: contentHeight
    });

    if (!contentWidth || !contentHeight) {
        throw new Error('Ukuran konten tidak valid.');
    }

    // Capture seluruh isi
    const sourceCanvas = await html2canvas(element, {
        backgroundColor: background,
        scale: 2,
        useCORS: true,
        allowTaint: false,
        logging: true,
        foreignObjectRendering: false,
        width: contentWidth,
        height: contentHeight,
        windowWidth: Math.max(
            document.documentElement.clientWidth,
            contentWidth
        ),
        windowHeight: Math.max(
            document.documentElement.clientHeight,
            contentHeight
        ),
        scrollX: 0,
        scrollY: 0,
        imageTimeout: 30000
    });

    if (
        !sourceCanvas ||
        sourceCanvas.width === 0 ||
        sourceCanvas.height === 0
    ) {
        throw new Error('Canvas sumber kosong atau tidak valid.');
    }

    // ==========================================
    // BUAT CANVAS FINAL 1080 x 1920
    // ==========================================

    const finalCanvas = document.createElement('canvas');

    finalCanvas.width = outputWidth;
    finalCanvas.height = outputHeight;

    const ctx = finalCanvas.getContext('2d');

    if (!ctx) {
        throw new Error('Canvas context tidak tersedia.');
    }

    // Background
    ctx.fillStyle = background;
    ctx.fillRect(
        0,
        0,
        outputWidth,
        outputHeight
    );

    // ==========================================
    // HITUNG SCALE AGAR SELURUH ISI MUAT
    // ==========================================

    const scaleX = outputWidth / sourceCanvas.width;
    const scaleY = outputHeight / sourceCanvas.height;

    // Gunakan scale terkecil supaya TIDAK TERPOTONG
    const scale = Math.min(scaleX, scaleY);

    const drawWidth = sourceCanvas.width * scale;
    const drawHeight = sourceCanvas.height * scale;

    // Posisi tengah
    const offsetX = (outputWidth - drawWidth) / 2;
    const offsetY = (outputHeight - drawHeight) / 2;

    console.log('Final image:', {
        outputWidth,
        outputHeight,
        sourceWidth: sourceCanvas.width,
        sourceHeight: sourceCanvas.height,
        scale,
        drawWidth,
        drawHeight,
        offsetX,
        offsetY
    });

    // Gambar seluruh konten ke canvas 1080x1920
    ctx.drawImage(
        sourceCanvas,
        offsetX,
        offsetY,
        drawWidth,
        drawHeight
    );

    // ==========================================
    // CONVERT KE PNG
    // ==========================================

    const blob = await new Promise((resolve, reject) => {
        finalCanvas.toBlob(
            result => {
                if (result) {
                    resolve(result);
                } else {
                    reject(
                        new Error('Blob PNG gagal dibuat.')
                    );
                }
            },
            'image/png',
            1.0
        );
    });

    // ==========================================
    // DOWNLOAD
    // ==========================================

    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');

    link.href = url;
    link.download = fileName;

    document.body.appendChild(link);

    link.click();

    link.remove();

    setTimeout(() => {
        URL.revokeObjectURL(url);
    }, 1000);

    console.log('PNG berhasil didownload:', fileName);
};

const matchesPeriod = (dateString, period) => {
    if (!dateString) return false;
    const date = new Date(`${dateString}T00:00:00`);
    if (Number.isNaN(date.getTime())) return false;

    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    const startOfThisWeek = new Date(startOfToday);
    startOfThisWeek.setDate(startOfToday.getDate() - ((startOfToday.getDay() + 6) % 7));
    const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1);

    if (period === 'day') return date >= startOfToday;
    if (period === 'week') return date >= startOfThisWeek;
    if (period === 'month') return date >= startOfThisMonth;
    return true;
};

const emptyIfZero = (value) => {
    return (value === 0 || value === '0' || value === '0.0') ? '' : value;
};

const calculateLogGross = (log = {}) => {
    let gross = 0;
    Object.keys(log.items || {}).forEach((pId) => {
        const item = log.items[pId] || {};
        const sold = Math.max(0, (item.initial || 0) - (item.final || 0));
        gross += sold * (item.price || 0);
    });
    gross += (log.hotTehExtraCount || 0) * 5000;
    gross += (log.miloQty || 0) * getMiloChargeForBranch(log.branchId || '', '');
    return gross;
};

const getDefaultRoleByEmail = (email = '') => {
    const normalized = String(email).toLowerCase();
    if (normalized.includes('bos') || normalized.includes('admin')) return 'admin';
    return 'karyawan';
};

const createOrUpdateUserProfile = async (firebaseUser) => {
    if (!firebaseUser || !firestoreDb) return null;

    const userRef = firestoreDb.collection('users').doc(firebaseUser.uid);
    const snapshot = await userRef.get();
    const email = firebaseUser.email || '';
    const inferredRole = getDefaultRoleByEmail(email);

    const profile = {
        uid: firebaseUser.uid,
        email: email,
        displayName: firebaseUser.displayName || (inferredRole === 'admin' ? 'Admin/Bos' : 'Karyawan'),
        role: snapshot.exists ? (snapshot.data().role || inferredRole) : inferredRole,
        updatedAt: new Date().toISOString()
    };

    await userRef.set(profile, { merge: true });
    return profile;
};

function LoginScreen({ onSubmit, isSubmitting, authError }) {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleSubmit = (event) => {
        event.preventDefault();
        onSubmit({ email, password });
    };

    return (
        <div className="min-h-screen flex items-center justify-center px-4">
            <AppBackground />
            <div className="w-full max-w-md bg-white border border-brand-200/80 rounded-[28px] shadow-2xl overflow-hidden">
                <div className="bg-gradient-to-r from-brand-950 via-darkRoast to-brand-900 px-6 py-7 text-white">
                    <div className="flex items-center justify-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-amberGold p-2 flex items-center justify-center shadow-lg">
                            <img src={APP_LOGO_DATA_URI} alt="Logo Cha Nom Yen" className="w-full h-full object-cover rounded-lg" />
                        </div>
                        <div>
                            <div className="text-lg font-black tracking-tight">CHA NOM YEN</div>
                            <div className="text-[11px] font-bold text-brand-200">Teh Tarik Malaysia</div>
                            <div className="text-[10px] uppercase tracking-[0.2em] text-amberGold font-black">Kaw Kaw Punye Sedapp</div>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <p className="text-xs font-black uppercase tracking-[0.18em] text-brand-700">Login Akses</p>
                        <h2 className="mt-2 text-2xl font-black text-brand-950">Masuk ke sistem</h2>
                    </div>

                    {authError && (
                        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                            {authError}
                        </div>
                    )}

                    <div className="space-y-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                                placeholder="Masukkan email"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2.5 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                                placeholder="Masukkan password"
                                required
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="w-full bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black py-3 rounded-2xl shadow-lg disabled:opacity-70"
                    >
                        {isSubmitting ? 'Memproses login...' : 'Masuk ke Sistem'}
                    </button>
                </form>
            </div>
        </div>
    );
}

function SalesTrendChart({ data, title }) {
    const maxValue = Math.max(...data.map(item => item.value), 1);

    return (
        <div className="bg-white p-4 sm:p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-3 sm:space-y-4">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="font-extrabold text-base sm:text-lg text-brand-950">{title}</h3>
                    <p className="text-[10px] sm:text-[11px] text-gray-500">Perbandingan penjualan berdasarkan rentang waktu</p>
                </div>
            </div>

            {data.length === 0 ? (
                <div className="h-40 sm:h-56 flex items-center justify-center rounded-2xl bg-brand-50/60 border border-brand-100 text-xs font-bold text-gray-400 text-center px-4">
                    Belum ada data penjualan untuk ditampilkan
                </div>
            ) : (
                <div className="w-full overflow-x-auto overflow-y-hidden rounded-2xl bg-gradient-to-b from-amber-50/60 to-white border border-brand-100">
                    <div
                        className="h-52 sm:h-64 flex items-end gap-1.5 sm:gap-2.5 p-3 sm:p-4"
                        style={{ minWidth: `${Math.max(data.length * 52, 100)}px` }}
                    >
                        {data.map((item) => {
                            const heightPct = Math.max((item.value / maxValue) * 100, 2);
                            return (
                                <div
                                    key={item.label}
                                    className="flex-1 min-w-[42px] sm:min-w-[54px] flex flex-col items-center justify-end h-full gap-1"
                                >
                                    <span className="text-[8px] sm:text-[10px] font-black text-brand-800 whitespace-nowrap">
                                        {formatRpShort(item.value)}
                                    </span>
                                    <div className="w-full flex justify-center items-end flex-1">
                                        <div
                                            className="w-full max-w-9 sm:max-w-10 rounded-t-xl sm:rounded-t-2xl bg-gradient-to-t from-amber-600 via-amber-500 to-amberGold shadow-md transition-[height] duration-300"
                                            style={{ height: `${heightPct}%` }}
                                            title={`${item.label}: ${formatRp(item.value)}`}
                                        ></div>
                                    </div>
                                    <span className="text-[8px] sm:text-[10px] font-bold text-gray-600 text-center leading-tight whitespace-nowrap">
                                        {item.label}
                                    </span>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

// Logo aplikasi (gambar diupload user, disimpan sebagai base64 supaya tetap 1 file)
const APP_LOGO_DATA_URI = "data:image/jpeg;base64,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";

// Gambar latar belakang aplikasi (dibuat samar). Ubah angka opacity untuk mengatur seberapa jelas (0.05 - 0.25).
const APP_BG_DATA_URI = "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAA4KCw0LCQ4NDA0QDw4RFiQXFhQUFiwgIRokNC43NjMuMjI6QVNGOj1OPjIySGJJTlZYXV5dOEVmbWVabFNbXVn/2wBDAQ8QEBYTFioXFypZOzI7WVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVlZWVn/wAARCAOJAoADASIAAhEBAxEB/8QAGwABAAIDAQEAAAAAAAAAAAAAAAMEAQIFBgf/xABTEAABAwIEBAMFBQUCCQkIAwEBAAIDBBEFEiExBhNBUSJhcQcUMoGRI0JSobEVM2LB0XKSJENTVIKTorLhFiU0NkRjc4OUFzVVdLPC8PEmJ2TS/8QAGgEBAAMBAQEAAAAAAAAAAAAAAAECAwQFBv/EAC8RAAICAQQBBAICAgEEAwAAAAABAhEDBBIhMUETFCJRMmEzcSNCBRVDUoGRobH/2gAMAwEAAhEDEQA/AO0iIvDPYCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCLicRYzLhvIgpYxJUznw3FwNbbdSSqnK42dtQkf6DP6reGnnNbkYzzxi6Z6ZF5n3Tjh21Lb5Rj+ayMO45cf3NvnGr+0n9lPcwPSovG1OI8SYNWspK+Fss87QYmEBxNzYWy+fRW+bxk/4cKc3/wAm36lPaTJ9zA9JLNHCGmV4aHODW36k7Bbrx1Rg3F1dUwzy0UnMhN2C7Gtb8rq6MJ44k3AZ/pxhW9pKuyvuY/R6RF4miruJsTq30FIWuqIM3M0aDobG5Om6t1dJxhQUstXUStEUIzPs+N1h6BR7Sf2ifcxPVovFN4gxPGZ6Shw0NiqZBZxFhmdrsTsLBdL/AJP8a788f65qhaSb7Yepij0aLgcLYtUYjFPDV2dNAR4wLXB7/Rd5zg1pc7QAXJXPODhLazeMlJWjKLyUOLcQYzLM7BqMOgjdbRgJHa5PVT+78bu2o7f6MY/muhaWZi9TA9Mi817jxy7/ALPb/V/1WstDxtDC+aRmVkbS53ij2G6n2k/sj3MT06Lk8OYq/FcPMkrQJY3ZHkbHS91UxfHaqLEm4bhdMKiqO+hdra9gPRYrFJy2eTV5IqO5noUXmfdeN3N5opSG75bRg/S91pR8Whsb4sQppG1jHZMkbfiPoditJaaaV9lI6iDPUovO4lxJLSTx0sNEZatzQ50YJOQnW2m5soW1vFlWL0+EPjadiYD+riqx005ckyzwjweoReaFFxw7xe72Hb7P+qiZxBiWGVTKfHqJ0Id9/JlNu/Y/JWelmlZVaiDZ6pF4tuK4xjFZO3D6iGCCN1m5nNZe5OXV25NlYrKDi6goJK+apHIiGZxbK12l7bKy0k67Iepij1iLzEOH8bVELJ4wMkjQ5vijGh20UdLjldheJzUGP2a5jbl1gS02uNt7qstLNKyVqIN0erReQhqOIeIZKiowlr4qan2a0gX8r9XeS6PD2PDEB7rVWjrWaEEWz28u/cKs9POMdzLRzxk6R3lBU1kNLLTsmdlM78jD52up14zjSR1RiFFSU7i+Ufcb0cTYfNVxQ3yotknsjZ62CpjnknZGcxhdkefO17KZeEoIeIsNZIynjZZzs72l8b3E/W67WCcTMrpWUtVHyqpzrC3wn67HyWmTTSjyujOGeMuH2egDml2UOGa17X1t3WV4Gp96dxTUMwV7mvaSB4wGj8W+lrq7NivEOEhkmIQsfA52XOA1wv1F2m17d1PtZNWmPcRumexRR088dVTxzwuzRyDM0+S4GKY5WftT9m4RTCoqB8Whcb2uQB5LCGOU3tRrKcYq2ejReYNLxuGmb3U5RrltHf6XusUXFzHQ8urppPfA7II42/Efntr0WstNOKszjqIM9Qi8ka/HsZxeaiwlrYnQAlzQ4dDY3cfNb1lJxlhtLJV1JHJhGZ5zMdYKy0s2rIepinR6pFQwXEDieGRVLmhrzdrgNrhX1zSi4umbp2rQRVMUr48NoJKmQZsujW3tmJ2C8/T1PFmLxNmoKLJA/wCFwYACPVx1WuPDLIrRnPLGHDPVovJy4pj2BTxDHKUmCQ2Dso/IjS/kpp+MaVgLoqeWRmzXOs3MVMtPkTqiFng1dnpkXk2VfFOLRunoKJ0NO0F2YMAuB5u3+SvYJjwq8JnnqyBLSi8lhbMLaH+SS084q2I54ydI7yLx1LiHE2KNdVUETPdy/I1tmC53sMxuSpxjuL4dWQw43Q8mOU2DsmU+o1sVZ6WaVlVqIN0eqRebxLigR1XumGQe9z3y3AJF+wA1K0EPG0/jZRFjT90sY38ibqI6aclfRMs8Iuj06Lyb+IMWwmURY3h7mFwOVwblJ/kVWoqriLGftaaqgia5xa1hkYy9hrYHU2UrSzbIephR7VF5DE4+KMAgjrK6droS8Ny52uBO+oHovRvxGKPCf2hILR8oSZfUbfVUyYJQr9l4ZozsuIvJ09fxPjTObhlDlgJIDg0W/vOSoruJcCLJMXpM1O42JIb/ALzdj6q/tZ1ZT3MLPWIuVhuNxYpUuZRwyGJgu+V/hA7ADqV1Vzyi4umbxkpcoIiKCQiIgCIiAIiIAiIgCIiAIiIAiIgPJ8QePi3B2fxR/wD1F9V5pDnBzC0DZ3Q/0XzriDBJMRkhqaSYQ1UPwk3AOtxr0IK8zj8GL0zYXYliElQZiQG81zgLW76dV6eDJFwUb5PPzwlucq4PuA1F1Qq8ZwyimMVVXU0MgFyx8gBHyVunGWnjHZoH5L5VxPSxYj7R5aabNy3BgOU2OkYK6G6VswSt0dHGK6kxf2i4IaOeOojjDbujNwCHONv0X0ewOpXyXhughpfaPDTQZuXDmIzG5/dn+q+rVIcaaQM+MtIb62RO1aDVOjBIicXSSRhp2zaWHZV5sZwyAfa4hSMt3mb/AFXzcezjGpzeeupCfOR7j+i43EnCs/DscL554phIbWY1wt8ypIPS+zvJUcT41OLPY4OIPQgvv/Jeo43c2HhLEiGAExtbcDe7gF5f2TMvJiknlG3/AHl7TibCZMbwWahilbC6QtOZwuNDdAfKOAGZ+MaHyzu/2CvtUrskD3/haT+S8PwtwacFxtlXJXxzPYxwMTYyCLi1917LEnZMLq3/AIYXn/ZKA+WcCC4r5O7mj9SvUVpy0VQe0Tv0K83wG3/AKt3eUD8l6iRjZI3seLteC0jyK8rO/wDKz0sK/wAaOf7LMzMIr3tYXkztFh/ZXvmSBxsBY9joV8lj4exmidJBh+JmGlkOY5ZHMJ9QOq6XsuMjsUxQyyOkc1jGlziST4j3XpRnGf4s4JQlHtH0aeeKmhfNPI2OJgu57jYALh4txJg37LrGtxKlc90Lw1rZASTlNgtuNzbhDEj/AN2B/tBfPuHuHaCvwuOpqGyl7nOuGvsLApPIoK2IQc3SJeD5m0eA1tVLpGx+a562aup7NsPfV1ldjdSLue4xxk9zq4/oFy+K3x0WHU2FUcYYJXXyN7A6fU/ovo+A4azB8FpqQEDlR+M93HVx+t1nhV3k+y+V1UPo6D82RwYbEDQkaL5jx5TDC+K6HE4msDZwHOuNMzTYn6EL6HQYjFWVFTFG7MYC2+lrBzbgfReW9qNKZcBp6kaugmAJ8nC36gLdq+DJOmcbhv7X2mzu3yNfb+6Avp0j2RRl8jmta0XJcbAL5V7NnuquK6md2p93cT9Whey47ke7hCrbHG8vlLGBoFzq4dvRRFUkhJ27OnBjOHVFX7tTV9PPUG55bHgk+ircWYXFi/D1VE5gMkbDJE7qHAXFvXZeL4A4ZrYMUZiVdA6FsbTyo3iznEi17dAASvecRVbaDAa2pdb7OJ1vUiw/MhSQfOfZ1QQ1VQX1AJa2oY5rehc1jyL+l7r23HsnL4Pr7feDG/VwXnfZgwmie/Lce8O17WjA/mV3PaEb8NmP/KVETf8Aa/4ID0VEzl0UDPwxtH5BfNMR4fqOJePMQAJjpIXtbLNbYBo0HmvqIFmgdtFqyGOPNkY1uZxe6w3J3JQFejo4MMoo6WjibHDHZoA/XzK+YcZPpKvi+FmDM/wxrgJnx/C54P6gblel454pNC39l4a4ur5hZ7m7xg9B/EfyXL4dwRuGQc2YB1XIPEfwD8I/msc2VY4muLG5stYtHic8fLw+SGEEeKRxOb5aaLyWB0FRScaYbDWD7UzNefFmv1vf5L3y81D9p7TqFv4bfkwlc2lm72nRqYqtx9SyN/CPovkPtGoW0PEraljLR1MYf4dPEND/ACK+vryPtAwWTFqCi5DM07KhrAQNmv0PyvYrvOIo+zHCeThk2JzNvJVOysv+Abn5n9F3eMoYp+EsRBa0tbFnHkQbgrsUNJHQ0UFLC0COFgY0eQXM4uH/APFcT/8AAcgPEcP1jaPhI1Mhu2EvsO+ug+pV/wBmWGuk98xmoF5JnGNhPrdx+th8l401L5eH6HDKfxSzzuJaNzrZo+q+y4TRRYRhMFK2wZBEA49yNSfrdY44bXJ/bNck7SX0XJc2Q5DlcNiRcL5fxhTjCuOaSthawMqcshuNM18rv5FfRcPxGOtkqmRkk08gY64tu0OH5FeQ9qlNmwuhqwPFDMWXHZwv+oWrVqjNOnZS9nYzcVYzJ2a4fWT/AIL1vGrsnCWJH/urfUgLyHspJkrcVldqS1lz5kuK9P7QJMnB9drbNkb/ALYRKkHyzzfCDcvD0J/E95/NdtcnhZuXh6k8w4/7RXTmlZDC+WQ2Yxpc4+QXkZecj/s9THxBHluJnSYrjNFgtMbuc4F1uhPf0Gq+p0lPHR0kVPC20cTAxoHYL537O6N2J4zX41OD4SWMv+J2/wBBp8173EcRioeXzHgZnsba2+ZwaPzP5Ferjhsionm5JbpNlHinDhieAV1O6znBnNi01Dm6j9LL48yWRuH0dW0MPuc2W1u5zi/5hfe3AOBadQRYhfEo4Y6WqxrCZrhxcWxANJu9rjbbyUy45IirdH2bD6iGsoYauEDJOxrxbzC+N8U0E2E8RVtDTBwhqyHMYPvNcbgfXRe49mWJGpwSSikd9pSPsAfwO1H53XcxTBIK/G8Lr5LZqRztLfFpdv0OqsVJMEwaDDsDpaB8TJOW0F+ZoN3nUn6r5Tx1VwS4/LS0jGx09Kcga3bP94/y+S+sY/iLMHwWrrXGzmMOQE7uOgH1XxCalmbSQ189y2oldqTvbc/W6i6JSs+s8D8OxYRhMVRKwGtqGh73katB2aPluuzPjNFT4tT4ZJL/AIXUNLmMAvpruemxVymeySmifGQWOYC23ay8fxRg1dT8QU3EWHQ+9ugAEtPezjYEXHyKkg7nFOHw4jw9WxSsDiyJ0jDbVrgLgheW9m9DC+ngqpATMxkhjB2GZwBPr4bLn13tJmnpKimOGNjdIx0ZJlPhuLbWXpPZ7HlwGlcW/wCJNj6yPQFH2rPtg1HHf4qi/wBGn+q8fX4ocTwzDsLpI3iR2VrmkbnZtu4vqvT+1h/2GGM6F7z+QXL9n2HDEOI5Kw5nU9E20Zeb6nRv0FyquKbTfgspNJ15PpeE0EeFYVT0cQ8MLA3Tqep+Zuo8YoG4lhtXRygObNEcoI1Duh+tlvimIQ4ZSOmmdYMbmOl9AQD+qu3vaysVPlHA87vd6qlcGjlPDttddD+i9UvIsliwPjjE4ZSWQvc61mk7kOboPVetY4PaHAEAi+osV5epi1O/s9HTyuFGURFzm4REQBERAEREAREQBERAEREAREQBeM40qIpayip43h0kZOdo+7ciy9mvBcQU1XHxBTmqlErZHtETrC+XNsbDddOlSc7OfUN7D7SwWjaOwXybHJJ2+0qpdSRNmmDmgNcbD92ASfRfTsIcX4bE47nMd7/eK+VvnA9o1XJPMGATvbmcbA6WA/RehP8AFnFD8kdLhYOf7SKlz8pcxj722vYDRfQ8QmfBG2RrmtYw5pHOOgaBclfPeDHCX2hYi8Xtkk3/ALQC+jVtKyso56Z7nNE0boyW7gEWuFMPxRE/yZ56o4+4fgJDap8x/wC7id/Oy8VxtxXRcQUsEFHFOzlyZy6QAX0tpY+a9Oz2a4PfxVFcf9Nv/wDytK/2e4NT4bVTRvq+ZHE57SZBuASOisVIPZOzLh2Iyfila36NP9V7TEMVpMMojV1shhhFtXNNyTsLb3XlvZbHl4cnf1fUu/JrVJ7S3E8K3Iy3qGaH5oC/gfFOG49iUsFFFMHsjzukewNBAIFt79V08bLm4FXFtiORJv0GUr537KG3xeud2gA+rh/RfQcceTgeJDIQ0U0mt/4SgPn3Ao/5pnPeb/7QvTLynAsbPc6iS8hfntYk5QLDbpderXk5/wCRnp4fwRHUVEVLA+ad4ZGwXLiuT7KhmqsWkGxyfq4qzjlPV1OHSMo5QySxu02s9vUahc72YXFTPbZ0jevZj/6rq0iVNnPqnykeu49dbg/ENbXDR/tBeS4OfVOwpjXxMZTtLsjrnM831+S9F7SnuZwpIGmwfMxrvMXJ/kvNYBWx03CbpWyhz4GvLm31abmwV9SrhSM9PxKzTCYv257Qw5wzQUd3eXg2/wBor6XXMklgEMYuJSGPPZvU/S4+a8X7LaItw+txCQeOeTICezdT+Z/JexqMQgpIhVVVTDBSEAB0nhJOvf8ARbxjtSRjJ27ONw/g2JYfiOL1NXLCRWvD2CNxOWxNtx2I+ik4sp5Krg/EmyEPcGGRtgRo05hoetgpqXirBsQr20FLVc+aQG2Vhy6C51WRiDa7F8SwORhAbACHEWuHCx9dwrEHiPZQy+KV7+0Ab9Xf8F9SXzr2U05ikxfOLOY6OM+ozXXU9pVdVUOB07qSokgdJUBrjG6xIyk2ugPWvjzOY77zTvfp1Xy32kY5Vz4i7CTGYaaEh2/7020d6eS9jwNj37awVrZnXq6a0ctzq4dHfP8AULm+0rBRXYcK+EXqKNt3gDUxn+h1+qAj9l8ZGEPf93myfXwD+Su8cua+gpom/EcQhabi199PNaezJgHDBfbxGd+vloscWtzuwhpt/wC8Yrg6u1PfcenogPXvc8FuVma7rHW1h3SOVkseeNwe3UXB0uNCt7L5lwxxKcO4pr8Nqn/4JUVcgYSdI3lx/IoBxxg8mFYpHj+Hi7HPDpm75HnqfI/quth1dFiFFHUwnwuGrerT1BXsKmliq4ZYJ2NfDK3K9pHxBfLKaCbhji12FOfzKaoIyG+tj8J8j0K5tRi3xtdo3wZNrp9M9YvNYT4/ahmP+LDj9I16VeTwsyu4+rHQ/ECWn0Ja0/kSufSfkzo1P4o+tLWT4d+o62UdY/l0kzr2IY43+SoYBiTcT4fo6t5zGWMNfbXxDQ/mvROA6bCXNvcEHYjsuTxb/wBVsU/+Xd+irYdibaviytoqc/4PQwZXAG4MjnXP02+qs8V3PCuJ3Gvuz/0QHzP2dYca7iaOV4vHSNMp9dm/mb/JfWq6OWWNkMYGV7gJD2bufra3zXkPZfQe74LUVrh4qmSw/st0/W69ZVYjT0UfvFZVQwUzgMhkOUk/P9EBxuG8HxPDZcUmrpoXSVkwlHKcTlNzfcef5LXjWlkquC6zmuDpI7SgtbbQOvsfJXKTifB8UrRQUlTz5XNJ0YbWG+pWkte3FKrG8Fcw5oobNJFswc389UB5f2TgNhxSRxAAMYJP+ku17SXgcJyAHR8sY9db/wAlzPZTH/zdiWZt7ytaQfJv/FezxLD6LFKTkV8QlgaQ4tJIAI9EB83wbiHDKTCaWCWctkjZZw5bjY3UXEPEVFU4RLBRTF8kpDSMpFm7nf0XuWcGcOloIw2Ox/jd/VeR4l4boY+LsHoKCnbDHUayNaSQQHanXyBWHt4btxv68tu09lwbh37N4Zo4i20kjebJ/adr+lgufxJgeJ4wyI0r4YiKgSO5pI8LNGDS/dx+a9RI4tHKiLRIWktBBsLd7Lk1nFeCUDnR1GIwmRhs5sd3EHtotzA6Z53vLQHAM3cCCbi3Q+tl8zxeP3L2mPsS1tTYgjQ+Jlv1C9tiGPQ0/D37ZpWukidkcBkNy0m2o6dV5D2iWhxvBsUZ8L2DX+y4H9HKs1cWi0XUkyvgMg4e49EBcRTVYyAuP4tRf/S0X1NwF8xNrDvovknGwAqMOki0mJNnDtcW/Mr6rUX/AGfLmOvKNz8lXFLdBNlssds2kfPfaNXy1NTSYNA4Sve/nODfPRg+lypcSwqnlwBtG9zYGwsBY9x0Y4Dcn6rjYfafjiRz/Fy4hlv0sxoCl4nlmxLE6TBKTV8jwXjzO1/QarHLulkUV45NcdRxuTN+FeN34OBh2Jnn0kZysljOYsH82/mvptLWQYhStnop2SxP2ew3/wDz0XhMW9mkboWvwuqLZWtAcybVrj3BGy6PAXD2JYEaw17mMjly5Y2vzC4v4vJdRzFf2gcN09XQS4rSsayqgGaWwtzG9SfMd12OB4y3hujJ2MLbfmf5rfiSr904exWWpYGNdG6NniBzX0H63spOFWhnCOH2Gpp2k29EB4z2pSNecLDDp9ruLX1aLr03s9w0UHDEMhFpKomZ3odG/kPzXmuPqR9bjWD0rMuaYmMAakEuHXruvo8bGU0EVPFZuVmSMEaCw6oDzvFODYljdDNT0z4o88jWnmEgZG69L7u/QLuRMqY2UzDI27WtEmhINhrbsqdbxLhOGuMVbiEDZ2fGxl3EHtYXt81pJjtNNw9PjFCXSRsYS27Dd2U2tZAeM4vj9x9oVFUkWbO1hJ+rT/JehXB9o0javDsExeHQPBI8rgOH6FduGQTQxyjZ7Q76hcGsXKZ26V8NG6Ii4jrCIiAIiIAiIgCIiAIiIAiIgCIiALyXGV4q/DalzSYoz4iPJwNvovWrSaKOeMxzRtkYd2uFwVpinskpFMkN8aNIvaFgEETY4o6prG7NEQ0/NeSwcRYtxhWV8cbnU2d8o5jdiTpfzXpBguGD/sFP/cVuCCGnZkgiZGzsxoAXTPVJxaSOeGmakm2eVwnFYOHeM8RqMQbLkkD2jltudSCD6aL0Z9o2DscSI659ztkaNPqt6mhpasg1NPFKRsXtuQo24Vh7Phoacf8AlhTHVpJJoiWmbd2Rn2m4cwuLKKrdc38Tm/1VSv8AaRDVUc9PFhkgdLG6MOdKNLi2wC6jaKlb8NNAPSMf0UrY2N+FjG+jQFPvF9Ee1f2cDg7i/C8EwNtJVtqOcJHOJYwEWPzWnGfF+HY7g7KOiZUc3nNf42ACwB8/NdeTCcOlkMj6KBzzuSwaraHDKGCQPio4GPGzgwXCn3kfoe1f2eR4UxtvCtdV+/00+eVrQGgAEWN9br0WJ+0PDqvDaynjpKkPnidGC7KBcgjXXzXTmp4Z7c6GOS22doNlGKCjBBFJBcf92P6KFrF5Qelfhnn+CqaqgpHvlZKyGU5mXIynztuD+S9QiLjyT3y3HVCO2NGJATG4DcggLyPBePYfw8atmJRTc7mAsyMvl0IPVevVWow2iqZOZPSQyP8AxOZqtcGZY7tGebE8lUcfjLjDDMcwX3OkbUiXmteM7ABpfz81Vq6CWm4HbFHFlkOWSYAakXub/kvQxYXQQvD46OBrhsQwaK3utMmp3NUuikNPtu2cXhzjnCMJwOlopIKoSRNs8taCC4m5O653GHEtPxM2hosNjmFpC5wkaBcnQbH1XoHYXQOJLqKnJP8A3YW8FBSUz88FLDG/8TWAFXesVdFPav7PHwhnC3F9JUzRuFKzUZDmJGUtO/W+tl613HeAPqqepd73zYWuaCIQLg7g6+QPyU1RTQVUeSohZK3ezxdVP2Jhf+YU/wDdUR1ar5ImWmbfDOVw9xjhmD1mLPdBUOjq6gyx5Gi4brodfNQcZcV0nElFTUlFBUNkbNn8YGuhFhYnuvQtwyga0NFFT2G32YUkVFSQvD4qaFjxs5rACFL1i+iPav7PKYbUv4N4killa80k8QEgbvYjX1IcrOOcU4rxKyemwqnkioQ057fE8eZ6egXpKimgqo8lREyVl72e262hhip4xHDGyNg2a0WCqtX8euSz03PfBweDeMMMwTAxR1gqOaJHO8DARY/NbY7xhhNbPQyU7KomGsinkD2gDK297C+66cmE4fLIZJKKBzzqSWbrAwfDQCBQ0+v8AV/eR+intX9lo+0fAx92rP8A5Q/qvnseHSY5NitdTteLSOljB+9dxOX1svbDBcMH/YKf+4rkUUcEYjhjbGwbNaLBVlq1XxRaOm5+TPP0/tDqIeH46VsLpMUb9mJHC7bdHW6u8ljAsEn96/amKvdJWPOcNcbkE9T5+XRd0UVK2o54poRNvnDBf6qdZ5dS5Ko8F8enUXbC8ZSYhHgfGVfPWiRjXhwa5rM27mkG3awK9muXjGDRYrNSulNhC457bub2+qpp8ihLkvmxuceCev8AaHhEtLPFDHWOfJG5oJYAASLDqvIYDU8SQYbLHhL5G0zibgZdDbUtv/JetOC4YRb3Cn/uK8xrWMDGNDWtFgALABby1fHxRjHS/bPG8GY9T8N19ecUjqOZMGjRtyCCSb3PmvQ47x5hFfglbSQNqubPE5jc0YAuR1N1aqKCkqnZqimildtd7QSoRg2Gggihp7j+BWWsj5RD0r8Mr4Dx5g+GYLSUToKoOhjDXZWggnqd+65HFnEEPFVTh1Hh0cwja85g9tiSbDv0F16F2FYe7eipz/5YUlPQ0lM/NT00MTtrsYAVD1irhBaV3yzyNE+PhXjGKeojc2laHZcniJaQR13PderPHfD7q2KrIqxNHG6O4hAu02Njr3ClqaSnq2BtTDHK0bB7b2VX9iYX/mEH91I6tJcrkmWmd8M5nC/FmE4OzEmzMqMtRVOljDGA+E7A66Fdl/tKwcXy01Y++/haB+qjOD4abf4DT6fwBay4Jh0gYPdImFjg4FjANuh7hT7uP0V9rL7H/tNoGizKCqdb8TmhcxvHFBPxRDilTRzRxw0zomNaQ52Ym9+nS4XdbSUzfhpoR6Rj+ixLR0swAlpoXgbZmA2Ue8X0T7V/ZrJ7ScHMbiyGrz2OUFg36dV4GmwqatwesxEx55M+YEk3tu4gdf8A9r3X7Jw69/cab/VhXGMaxgYxoawCwaBYBRLV3+KJjpq7ZxeG+NMKoOHqagrmTufGxzHhsYc1wJJ3v2K5XFuO4ZiuD4fQ4cKl0lK7K0ysAOW1rb6nZeikwfDZHlz6GAuO5yLaDCqCnkEkNHAx42cGahW93H6K+1f2eX4nEkMuDTVLHcuNjRIR3BBI9V6+T2iYE9jmOZVua4EEcobfVbTQxVEZjmjbIw7tcLhUxguGD/sFP/cVMeqUY00XyadylaZ57h57K3iquraaNzKXK7Jm+6CQGj1sFbxfDMRp8YbjGEPvO0XLdLg2toDuCOi9DDBFTx8uCJkTN8rBYKRZS1D9TfE0WFbNrOVh/tIMFocZw+RkrdC+IW/2T/VXpfaTgzYzkhq5Cfu5AP5raemgqRaeGOUfxtBUDMJw9hu2hpwe/LC3WsVcoxelfhnk+JcexPiaEyMpXw4bTnNlbqL7XJ6n9F6bA+PMHoMEoqSZtVzIYmsdljBFx53XRyty5coy2tltpb0VI4NhhJPuFPc/wItYvKD0r8M5NbxZg8vEmG17Iqp8FLzXODgL5nbWF9gu7/7ScFI1hrL/ANgf1UTcKw9osKGnt/4YWDhOHE/9Bpv9WFPvI/RHtX9ni4KGbHBiuI8svkc4vZdxGpJJt3IHRd/g/jDDsGwQUdaJ+Y2RzvBHmFj816CONkLAyJjWMGzWiwCqTYTh88hfLRQOe7Uks3VY6vl2iz03CpnC4n4hwWv4cZh2HtqA6ObmRiRgAaLm4vfzXewdsjMIo2zAiQRNBB6LEWEYdC8PjooGubqCGbK6ss+dZEkkaYcLg22wiIuY6AiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCKRsEr/hie70aVM3D6p20JHqbKyhJ9Iq5xXbKqK+MJqTvkb81IMGm6ysHyKusGR+CjzQ+zmIut+xXf5cf3f+KfsU/wCX/wBn/ip9vk+iPXx/ZyUXW/Yv/f8A+z/xT9jO/wAuP7v/ABT2+T6Hr4/s5KLpnBphtIw/UKM4TUjbIfmoeDIvBKzQfkoIrTsPqm7wk+hBUL4ZWfFG9vq0qjhJdoupxfTI0RFUsEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBFkC5sNT2VuHDaiWxy5G93f0VowlLpFZSUe2U1kAk2AuewXbhwiFtjK4yHtsFfjhjiFo2Nb6BdMdJJ/lwc8tTFdHnosPqZdoy0d3aK5Hgx/xktvJoXYsi6I6WC75MJaib64KUeF0rN2F/9oqyynhj+CNjfQKRZWyhFdIyc5PtmLJZZRXKmLIsogMIsogMIsogMIsogMWSyyiAifTwyfHGx3qFWkwulfswsP8ACVeWFRwi+0WU5LpnHkwY/wCLmH+kFTlw+piveMuHduq9JZLLGWlg+uDWOomu+TyRBBsRY9isL1ckMcotIxrvUKhNhEL9YnGM9twueWkkvx5N46mL74OGiuTYbURC4aHt7t/oqhBBsRYrmlCUe0dEZKXTMIiKpYIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCLeOJ8rssbS53YLq02EDR1Qb/wt/qtIYpT6RnPJGHZyo4nyuyxsLj5BdKnwhzrGd+X+Fv9V1o4mRNyxtDR2AW67YaWK/Lk5J6iT/HghgpYYB9nGAe/VTWWUXUklwjnbvlmFlEUkBERAEREAREQBERAEREAREQBERAEREAREQBERAFhZRAYUM9LDOPtGAnv1U6KGk+GSm10cWowdwu6B+b+F2/1XNkifE7LIwtPmF6taSRMlblkaHDsQuXJpYvmPB0Q1Mlw+TyiLsVWEbup3W/hd/VcqSJ8T8sjS0+a4p4pQ7OuGSM+jRERZmgREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBEVilpJal1mCzerjsFKi5OkQ5KKtkABJAAJJ2AXSpMJfJZ0/gb+Ebn+i6NJRRUouBmf1cd1aXdi0qXMziyahviJHFDHCzLG0NHkpFlF2JV0cvYREUgIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAwVHLDHMzLIwOHmpUUNX2Ojh1eFPZd0F3t/CdwuaQQbEWI6FetVWroYqkXcMr+jhuuPLpU+YHVj1DXEjzaKxVUktK7xi7ejhsVXXC4uLpnampK0ERFBIREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBFtHG6R4Yxpc47ALu0OHMpwHyWdJ+QWuLFLI+DLJlUEU6LCzJaSou1vRvU+q7TGtY0NaAANgFlZXp48UcapHnzySm7YREWhQIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCLCjlnjhHjcB5ICVFzJcUtpEz5lVH1tS/79h5BKB3bovNuMjjcvd9Ua+Zpu2R4+amgelRcFtXVN/xhPqpm4jONw0pQOwi5jcUP34voVK3E4T8Qc35KKBeRV21lO7aQfNStkY7Z7T80BuiwsoAiIgNHsa9ha4AtO4K41bhbmXkpwXN3Leo9F20WeTFHIqZeGSUHaPIou/X4c2ou+OzJfyK4UjHRvLHtLXDcFeZlxSxvk9DHlU1waoiLI1CIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIApaeCSokDIxc9T0C2paV9VJlZoB8Tuy9DTU0dPGGRi3c9SujDgeTl9GGXMocLs0pKOOlZZou87uO5VlFlenGKiqR57bbthERSQEREAREQBERAEREAREQBERAEREAREQBERAEREAREQBaPkbG3M4gBR1FQ2Btzq7oFypZHzPzPPoOyUCapxB7jli8Le/VUzmecxJJ7lSBq2DVYEQYVsGKUNWcqkkjDEyKYNTLqhBFywnLBU1lnKgKxjWpiVvKtcqAqmPVYLXN2VotWCxAVhJM34ZXN+a3FfVR/fDvULZ0fktCzTVKJJo8YkB+0iaR5FX6evgqNGuyu7FcNzPJRlhBuNFFA9Usrg0mIyQ+GW72fmF2oZmTMDo3BwVSDdVqykjqmWcLPGzuoVpYUOKkqZKbTtHlqiCSnkLJBY9D0KiXqKmnjqI8kg9D1C89VUr6WTK/UHZ3deZmwPHyuj0MWZT4fZAiIuc3CIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCsUlK+qkyt0aPid2WtNTvqZQxnzPYL0dPAyniEbBoOvddGDDvdvo582XYqXYggZBGGRiwH5qVFlemklwjz275YREUgIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgChqJhEz+I7BbyPEbC49Fy5JHSPLjt0UpAjcS95LjclMq2AWQ1WJNQFsAtgFkBAYAWQFmyzZCDACzZZQIAAs2QIgFliy2RAakLUhSELUhAaEKNzVMsEICu5vkoXMVshaOahJTezTZZpppKaW7Dp1HQqd7FA5iA71NUMqI8zdD1HZTLz9NM6B4c0+o7ruQStmjDmlVaogkUU8DJ4yyQXB/JTLCq0n2E65R5mrpX0smV2rT8Lu6rr1NRAyoiMcg0PXsvOVNO+mlLH/I9wvMz4djtdHoYc29U+yFERc50BERAEREAREQBERAEREAREQBERAEREAREQBERAFvDE+aURsF3FagFxAAuToAvQ4fRimju7WV257eS2w4nkf6MsuVQX7JaSmZTQhjdT1PcqcIsr1UklSPNbbdsIiKSAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIijmfkjLkBSrZS6TINhuq+6yTmcdbrIGqsiQAtlkBZAUgwAs2WbJZALIsohAslkWyAwizZZAQGFhb2WLIDC1K3ssWQGhCwt7LBCA0stSFIsEICEhRParBao3NQkqObZWqCo5Utj8J3Ubwo8vVAeiBuLhZVPD5s8eQnVquKhBhQVdMyqhLHb7tPYqwsKGk1TJTp2jyk0T4ZXRyCzgtF6LEKMVUd26St2PfyXniC1xBFiNCF5WbF6cv0eliyb1+zCIixNQiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiuYdSe8zXcPs2au8/JWjFydIrKSirZcwmjsBUSDU/AP5rrBAAAAFlevjgoRpHmTm5u2ERFcoEREAREQBERAEWrnsZ8TgPUqu+vp2ffzH+EIC0i5r8UH3Iz6kqtJiFS/4S1g8gpoHaWpljG72/VeelfNJ8Urz81AYyp2g9SHNOzgfQrZeVAc3ZxHop46ypiOkhI7HVRRNHo0XKgxW9hKz5hdGKaOVt2OBUEEiIiAIiIAiIgCIiAKjXSWsz5q6uTVOL5HHzQETSpmqAvaB5rMb9VNlqLKXUXMPRA89QpFEyZtVDd3QFLn5qLFE4Kyq4c4LYOzbmyWKJrgICFoGjulgFNijfOFsHAqMALYDsUFE7GZghZlUedw20QynqhBsQtbLIcCFi6kgwtStjsoy5QTRlFoH6ra6AEKN40UhK1IUgrPC0U7wonBASU7+VK1w76rsg3F1w2rrUr80De40VWQToiKAFyMWo7g1EY1HxgdfNddakXFjss8kFONMvCbg7R5JFcxGk92nu0fZv1b5eSpryZRcXTPTjJSVoIiKpYIiIAiIgCIiAIiIAiIgCIiAIiIDeON0sjWMF3ONgvS0sDaaFsbem57lUcHpcrOe8au0b6LqL0dNi2rc+2cGoybntXSCyiLrOYIiIAiwqlXXNg8LRnk7dkBae9sbcz3Bo7lU5MUgYbNzPPkNFypZJKh15SfRZbF5KaBcfikjv3cYb66qF1TUSfFI4eQ0WGxqQMVqBWLC463PqtmxabKyGLOVAQCPRZ5SnDVmyAr8uy15YVqy1LUBWMa1MeitZVqWoSUyxZZI6M3aSD3VhzFG5iAv0mIB3hl0PddAEEXBuF53LqrtJVuiOV+rP0VWiDrItWuDmgg3BWygBERAERYQGk7skTneS40jui6WIOtCGj7xXMyXKFkRCIlxv1VlrLNWWtsNVm6gtZGdASVoZbLZ5uo8l91DLI257zsAFkSSdbLXLpobrZtyNAiDSMh7kzFMrlkNd5KSODLXkLbOVplf0AW1nqUQyRriei2uVGA8LIDlKKs3u7uhJ6rIY4i4Nlqcw6qQZDiCs8wqK5QGxUMkkJJWCsF99lpzLqLFGwWeZZR3utSpsmiXmhbZrhQLGo1BRMiiZ2qicLrdpJ+ILBViphvZXqB3xt+apDdW6L96fRH0QX0RFQBYWUQEFVTtqIHRu67HsV5qSN0UjmPFnNNivVrl4xS5m89g1bo70XJqcW5bl2jp0+Ta9r6ZxURF5x3hERAEREAREQBERAEREAREQBWKKnNTUNZ90auPkq69DhdNyKYOcPG/U+XYLbBj3y/Rjmnsj+y41oaABoAtkReseaEREARFUrqjkx5WHxu/JAR11by7xxnxdSOi5gaXOudVlrSTc6qZrVagaNYpWtWQFuApBgBbgIAtggMBq2ssBZQCyxZbIgNLLFlvZLICOyFq2IWUBEWrRzLKcrVwuhJUc1ApnNUZCAtUc/LOVx8B/JdJcVpXSo5czMrt2qrRBZREUA1e7K0u7Bcw10xcSLZe1leq3BtO+5tcWXLDQBa+qh2SjaSZ8rgXHbosZtFgW26ra2ix+RsqNgbgaoRYEkrW1lq4Aix1Cb2NqNBIxxW4y7DRR8lh2uPRZ5RAsH/VPUJ2mTbusAkHa4WBC7vdSNaWjZWUkxQzjtZZErR1Cr1BJs1gN+p7Ku6mdvd1+6hzonbZ0eahmCoRyuhkDZBdrtj2VuXI2K4FyrKVlXE353ojZbnsuaZjnt1urTMzrWN1NhxVHTDrQXVXOQSHG99lmRxELW6hVXzZDY2IKtZVIsFy1WmcEAjZY5gUWTRJstSbbLYEHUaqJzvF5JYokDrix3QLDWgi4Wrrg76JYokWAQVpmutSpsUWmkFuhWhJF7laxOFrdVsTfcqyZRo2YL9VYpTacBVGnxXCt0w+3Yp8FWdFERVICIiALVwDgQdQdFssIDzNbTmmqHM1y7tPkq69DilNz6fM0eNmo8+4Xnl5OfHsl+j0sM98QiIsTYIiIAiIgCIiAIiIAiIgLeHU/vFU0EXY3xOXo7KlhdPyKYFw8b/Ef5K8vU0+PZDnyebmnukERF0GIREQGkjxGwuOwC4sjzLK57tyr2ISGwjHqVTAClAw0KQBGhbgKxIAWwCALKEBZRZCALNkstrIDFlnKpGx3F1ghQDSywVsVqSAEBq7RaZgjjdR7JZaiS6wXDuonOWm6iyaJiQVoQo7DuVKB4dFNkNGmxU0L+XIHdFCb6d1u1wcLWUkHXBuAR1WVXpH5osp3borCoQUq55GVuUkDVVQQTmI3XWIBFiLqJ9Oxw2t6KSUzkkeIkbLIIy6O1C0q6htJUcqVpHUEDcKFlRTPFmvaL9Fm2jVJvkmbK8vt0Wxk8JJbsoc1h4XBRPe8gt6LKT+jRIsCZjuhHzW5cy1w63qqOYMGoWTM3l5Qs9zRfYXgSfhcCslzhu2/oqWcFrQw2tujXuAN3fQqjyIbC5nHay2u09VWZJIIg7NmvpqnvFviYEU0g4sklp4pBqPmCtjEDDk1t3UIma/QNI8wVs2VgHxn5q6kiKZB7jlNw4XurdOOWSH28isB19ntUjHkO8QzN8laMv2VkSSFrm2FlyqrwPsW3C6khjvdoKjLmO3F/VaObKpHMiksLF12rcyaaK6YoXfdb9Fo6kiO2noVRzZdIqc8g7FZE5Ph0KmNEDs8rDqOw8JBKb2TSAce63MeZt8yqPpqhpu0XPkVZgMoAa9hHmrKaZVobGyxmW0jCD5KE6FTuRFG+Yt1UhLtLC6g1O5stnHYqykirRYYbFXqQ3nb5Bc6I3XRodZj5BaWZSR0UREKhERAEREBgrzmI0/u9U4AeB3iC9GqWKU/OpSWjxs8Q/mufUY98P6NsM9kv7PPIiLyz0giIgCIiAIiIAiIgCsUUHvFUxlvDu70VddvBYMsTpju82HotcMN80jLLPbFs6Y0WUReueYEREAWFlRzOyxOPYIDmTvzzOPmsAXWoN1I1WBkLaywFspJCysaLNwoAW3qtC62g1KwB3Swbl+tggJWmYA6Jn7KCSYvcBYGyjc833WhudysXA6XKkG/MK1zFx3WhOuy1LrbKGyUiRxAURdfZYuStHeSrZJud1gFajMVq4lp1ISyaNnOsdEZJqblR5rrRxUWTRZc4bkrVrxmvsoA7Wx2RrrEC1lO4q0dWjktN5OFl0FxIn5S13Y3XW50dgS9oB81NlGiVYWGua4XaQR5LZCDzPEjXe+RODiPAuFmcDqAV6niGm5kbJr2DNCvNSxkHTULmyLk7ML+IbJbbM30KnZUydJbjs5RNbpss5B2XK20dCSZY57zuxrh/CbJzWndsjfzVfIOhIWQJG7FV3sttLAezpK30dopGh5OhBHkbqmXO6tBWWuaN47eYUbyNrL7HPaLEEBbcy4sVTbNb4Znt8rqRs0h/wAYx3qE3xI2su04BzX2IstzC0n4dFUbO9u8TD/ZdZSiuYPijkb+a1jKDRRpmZICHDKCQpOU/nWHhaOqR1tOTfmZT5hXoqmGQayRu+a0jCD6ZnJteCo9kjScr7gKPmyCLMbHW2oV92S9wLjy1VedrHgCxACmUGumE7IRMLfCFtzGnYOv5LYBobYLALBqdxsq/JE0jDZWHZxHqFuHDo4H5qoBdykDRf4tOqqpsOJYu71WA5w3CrPIEpy7LdkrgbW/NWUkRtJw4HulmHoFEZiHWOoW4lYd7K6plaZl0bCLWWhhYts8bnWFwslreh/NTRFmrWBmxU0U5hfmHVaBhIuFgxu7XU/JFW0zoQ17JHBrmlpOxVxcSGJzp2C1tV21rBtrkxkknwZREWhUIiIAsHZZWEB5mtg93qns+7e7fRV128agzRNmG7DY+i4i8jNDZNo9PFPfFMIiLI1CIiAIiIAiIgNmtL3Bo3cbBepgjEUTI27NFlw8Ih5lXmI0jF/mu+F6GkhUXI4dTK2omURF2HKEREAUNV+4cplBV6QFAc0bqRqgBsVK14urEkmyZlE5/QLW/wCIqLJSJC8FaEn5LR0wGjBcrUlzt1DZZIlz5et1jmEqMf8A5ZbBjj5KBSNr9SbLLXfhHzWWxNbublYdIG6BTYN2g9SppAGxXaFSMxJvcWUzZs9O4Dfom4baNHSX3FitCdVFLK5g01UfPDxbZyq2WSLOYd1pI4aahVnyEbKIucTbf0VHMuoFsSkXDTdZYA/4iVWbBNbQHVbx0kwdd0mUfVU3olxJHtynRRnMPNW2taG2Jv6rIyjYKHJvoFVsbzrbVbiFxN3EBWdTsLLSxOpITkGAMotdanVbAsF7kmy3DgW3YApUG/JVyotYYXAvadtwuiuXTSGOUOOx0K6YNwt0qVGDds5nEP8A7rcO7gvIkPb8LivVcSOtQsH4nheXusMr5OrAviGzyNHiaHKRtTGR4gWlaHQLYRZmjzXJKjpRI2WJ2zwpMoI8JBVZ1KCNQom0UjHXjkcB6qlJli2W2O6zZUao1dPGXscHAbgqSmqpZYmvMYPoocSSyWg9AsctvZa+8Mt4o3tWY54H/DJY+apRJtkI2cQop55IGZg64VkAEaOafmopYXOsCLhI/sWYhqJHxhzmg3WznNcbujt6LZjcjQLWW1wobp8CrNGyMY0lrpGH1K3hqZulQT66poeyxkb0AUqbI2r6LTaie28b/ULBnJHih/uuVUMHS4WHcxvwE2U+pIhwiWuczq17fzTmRn/GW/tAqkJKi1wAR5rd8kungBTexsLBcL+F7SfJyyHS72JHlqqD5mN1lYAtBWwOdlYJG+ivuZG06ec5tdPUKRr7+a5wluNJnD1WWzvOrZWn5LWMyjgdIuJ6IHAHUFUG1Ew6sKkFVJ95rT81vGaMZQZeEhJFr27Kzc6W0VbDWvrJdGZWD4nXXXFD/H+S6Y0c8uOCGl/6Q3sumqrKTI4EP28lZUmZlERAEREAREQEc8YlhfG7ZwsvLPaWPc127TYr1hXAxeLl1eYDR4v81x6uFxUjq00qltKCIi887giIgCIiAIiyASQBudEB3cGiyUpeRYvN/kugtIWCKJjBs0AKRezjjtikeTOW6TYREVyoREQBQVYvTuU6jnF4XjyQHFe7lglaxEvdcrMmp7qSNoDdAhp4BbY+ShfclWHbKPKSVVkojaw2W7dd1sQAL6LS4JsFF0W7JdG9lpJUsjFi6yOaA0qvHTF/ieNT3VZTolRJWzNlNg8eixUtyMFjclaPo8w8JDSOqsNjvFkkdm8yq7yaOdDJdx7LrU+Tl30sQoGxRR7NClY5odrGSEU2JIjniEgOQ2KrsoXbvk+iuSysHw2aoHTNte7neYVJT/ZMYsNpYWjXX1K3aI2/AwfRR80n4W6LEgeWFxcRboFnuRemTFx6kBRukaNC4m/ZQt1F3GyxJI0Rho6dVX1CdpNzIxpbVYdM4OtoqnNOzW3PkFq95Gr3BvqU3k7C4ZXO0J+ijv0Cqe8j7oLvlZROqZOrms/NaKaRDgzoXdbWwCuUERqGu5ZbYGxK846YF1jmcT1Oy9Tw+QcO0ABDjdb453wY5I0i5HSMZq7xFWBosotTnOHxP/0aHtn/AJLzrW6ar1ePhv7Lkc4XLSCPVeSbMwnXQ+a5c/Z2YOiR5Aid6LamfmhaStXNBboQbrLG5WaBckujpRPmFkDwdFXe49FiO+a6pRZFp4DhlIv6rSKNsQs3bsmbXZC8A7qtsklcAW7BRNgaQbtBv5La+i3abBRbBE6lZ0bb0KgfSPEgMcr2j1V0FCbIpAgy1LALSB3qFh80zB44mu9FvJUNiF3A2WXnmRZmkWKsl9kNkPvbD8cLh6LIqKc/eLfULlVNZJTThp1ap4a+KY5S0Zlq8XlFdx0g+I/DM0rcA20cCqrYo3j4ApBSMGozN9CspRosnZLc2tZYPndQuhcPhldZC2do0eCq7STYxMJuRc+ahqWObGXRNBI6d1l0s7N2tcgqnfei+hWiTIshgk5rfEwtOxBW7YQwEDbdSGqj+9E5PeYT9x4+SvTZFmnLC1ZGQ8m5spfeIL2OYX8l0MNpY62oytzBjBdxIW0IvoxnJJWdzBYOTh0dxYu8RV9Ya0NaGjYCy2XalSOBu3YREUkBERAEREAREQGFzsZiz0oeN4zf5LpKOaMSwvYfvAhUyR3RaLQltkmeURZIIJB3GhWF4x6wREQBERAFaw6Pm1sY6A5j8lVXVwRl5JZLbANWuGO6aRnlltg2dkLKwsr1zywiIgCIiALVwu0juFkmwJ7LmSVkryQLNaobolKyAM116Fbgi1lGAtsqyc34NdqN/CBqVVyyuJN7aqwW+i0c5rfidZVbkWika8okeJ30Wwaxi15sewF/mtOacxaGtGUKjaXNl0mTlw6NJWMx8h6lVTNI46mwWjHtyua7e+hWTycl1DgtulaN3/RRc0HxBpIvYXKgJbbZSU7gARvcopNsnYkbZ5jq1oasMbLK0jxF11MXMZq4gf2itG10MfwPLj/ALq1JPlkP9InFN4Rdhv1JWj6dgjc0G11DLizyMrIT6vcqU9dMWi8jGX/AElPGuhGM2dIANbYDQd1BLM0XaZGj0N1zxLm1eXyHzKzmcPhY1qwlm+ka+n9k5mb91r3fko3ylu4Yz8yq5E0jrFxaPJbCINbY+I9yst7L7UaSVDGgue97x0A0UDal7jflCNp2LtyrJiaXXNvILEsDJmZXiwPXZWTTJogeJJLWk26d1sGaoxtPTNsHk+QN0NTfSKMDzctFyQyRsJcb9O69RgcRjoASb5zmC8bnlfL4iS3svaYI8PwyK33bhdmJUcedui+soi6DlOVxE7LhbvNwC8eWA9F6vig2w5oHV4Xl26i65c/Z14Oiu9jh8BLVK2WoZEQLOUlrrIFlyuR1JFQVz2gc2Ij0VmCsp5ACHkO7EJLC2QWdZRMpWs2CjhoskXmva6+VwKhAc6ozE6AWAUJhA2BHojY3NN2Pc1Z8El662a5UjJUNb4XNcfMLZta4NAkh16kKtAvArSeYQx3sCToAVEyqjO4c1YqIxUsaYnAuadipiueQzLZGzkxvADrdFLAA0cs7DZc0R1UcjSIyCD6rr5DcOtrZa5FXRVFGto2TjazgqlNh2WoMlg3pYLtEdwsWVVlaVBxI42BgUua6jlORpKjp3mSIuItqqd8slG7nC62bYtuq8hOcWUzDlYLqX0SZIBWrmNI2W11i6IhkD4R0UTmZeiuXWhaD0WsSrKXJDn5r7L1fDkRFK+Q/eNh8l5rKWuK9phsXJoIWdctyu3EcmZ8UWVlEW5yhERAEREAREQBERAFhZWEB5vEY+VWyDoTmHzVVdXHGWkikA3BBXKXkZo7ZtHqYnugmERFkaBERAF38Hjy0WY7vcSuAvUUbOXSRN7NC69Irk2cupfxSJllEXonCEREAREQGFx5GBkjxqbOXZXOlhldM7KzwkoSiq7M0hM2mpVh8EgbmLXGy5ktdAxxNnFw0Oiq6RpHnolBOYkuuFFNJmAaAdFWkxG/wRW9SoHVkh6sb8rrmnOJ0Rgy257m2sAo3OedTp5k2VV07nbyPPk3RaX7Mv5uN1zyyLwbqBadI370rb+WqyHtsLNe710Va7+mVvoshpO7iVm5snaWDMR0jZ66lamouNZXu8m6BQ5B2+q2AFv6Krk2W2owX21Ed/NyhhqZZnubYMy+Ss5Sdgog1kchzSMafVF1ySb5CdXOJWQxo2AWObFsC55/hC0dUOBsyG3m4qqTYsm30AKzlcBrp6qpz5X3vM1nk0LAax58T3SHzKv6b8kbkWXTRjeQE9hqtOcSfBG53mdFNFE1o0aAjwAqUrJsgInd1DB5LT3Vzj43k+pVtpB9UVk6BWFMB2TkqclYKumVZWLHNcvTcOPvRvb+F64OXMLLvcPx5KeV175nLsw9nJn6OwiIuo5Dj8QtD6VrfUrycemi9JxJKWGFo6grzlsr9Nly5nbo7MH4kgQuDRdyBRVLS6PKFyVydXgkBDhdZGirwZmjKVYCpJUWRq94aLuOgRjg8AtNx5I9okYWuFwVHTRGBuQfCNlHFEk4KWWFm6qSbBo7LdoAN9loCsPdYKOwWC4u0uQowxwN2yOC5sNc59ZyQuk54Y0k7BWaaZCaM5pxtID6rPvEzAS5jXBUf2rCSWtBJCryVM05s24atI42+yrZ0jXMvZ8Zt5LZtdTAW1b8lzo2PykkKKRrmuBtor+muiu47bJKd2ub6rJMZ2eFRpJGSttoSFM+GMm6zaplrLIA6ELGVQGEdLhRuic377vqiSIZayrAGtlVax3+Uct8j+jytYxKNl2jo3VVS1o2Bu7yC9cBYADYLjcOQ5aeSU3LnOtc+S7K74KkcGSVsyiIrmYREQBERAEREAREQBYWVhAUMYjzUebqxwK4C9PWM5lJK3u0rzC87VqpJndpXcWgiIuQ6giIgNmNzSNb3IC9Y0WAHZeYom562EfxL04XfpFw2cWqfKRlERdpyBERAEREAREQGF5biCk5dYZgTllH5r1Kgq6WOrhMcg06HsqyjaLQltdnhC3KQDqpmsGlgtqkuimfGYxdjiFEJZbaBoXFJHoRd8k4aVuG23P1VUOmcCM9vQJ7s6QeIuPzWLX2aWWHujb8T2/VQe/U4kyB93dgFtDQxxm+p9VmWhie5rgMrgdCFWokmwlcT4IXH1WL1Jkt4GDyFyrDPCACsne6o3RJFyHOHjke78lgUUIkDw0X89VYul1G4GrnxxjMbABRyNbUR3abjyWs8kbHFrrnS5WYmtYA6E3aei0SaVlWcWooJ2SmznZHfkrmF00jGHmEnXS66haHa3RrANArPNaohRMOdkHktHnM24O63mjDmEOOW6iMtPBEGOkBt2WST7LGIL3KkFzutG1ILLRR38ytCZnHxODW+StX2CZ1m6uIHqonVLAbMBcfJamFu7iT6lauaG7K0UirNi6R/8I7Beh4cNqaWM7h1/qvPsfddrh5458zfxNBXZh4ZzZlcT0CwsrC6jjPMcSuvWxN7M/muKRoutxEb4nbswLlgLizP5HdiXxRhptottwoZHZXKRjwQsGvJujBbY6LIK2cNFqdtFndluhdV5sRpYTldKC78LdSpSVyK+COjmpqqFgaGvs+3mrRim6ZEm0uDqzVcEDGulkDA7a+6gOKU5p5poyXti3sq2JRyCsp6pkRnjaLFo1UMVHUSNrfsBGydt2tvsVMYRq2Vc5XSJ5cSZUYc+RpliDXAZmjUreatMdayJ0loRDmcXLE9DLJhMVO0NEjctxfTRQVuGTT1D5hY5WNyC+9uilbLD3nRw+OGQCpjuSdiRZbRVsFXNLTMvnZoT0KPnfHh5kMZbIGfAO64NK99BUNIYXTzRXt5k9VCjutiUttHoI6KEONvi6q02BrABYLzmFS+7uqq2qkLgDkFvvHyXao8Sp6oWaSx17ZX6FRPciYyTLnLBQxNItYIHtLi0EZhuL7La6z3MvREynbG67W29FrPHM5zcguB5qxdL6WTdfZFFcCfqpHNIZqdVJdau1CvFhkLXWdZTA6G6rct2e/RWoGGSdjB94gLqijCT4PVYZFyaCJp3Iufmri1aMrQOwstl2nnsIiIAiIgCIiAIiIAiIgCIiAwRcELyb25Xub2JC9avL1rclbMP4iVxaxcJnXpXy0QIiLgO0IiIC7hLc1ezyBK9CuDgovWOPZhXeXpaVfA8/Uv5mURF1HOEREAREQBERAFhZRAeV4hh5VdzANJRf5rlN1K9RxDTc2h5jR4ojf5dV5hmgC5MypnbhlcaMj7OQZtnKxcBVpW52DyKkbmyrlkdCNnzZTZb5wRdVnWvqQFtzGMAzPb30Kq0WRJLKI25itsyqzTRPaACXeQRtQ4gBsR9XFUa4JLYctxcqhzqm5tkaDtostEp+OQn0UUSb1VNK+UviIOYbX2WKWGSmeXyuBBHwBbsaGaj9UfURtPicArqbqkVaol57z8EVvMrVzpnbyZR5LXnNy3FyD2C502ISSSOhijItuSojBsNpG9RM0yZcxf3N1o+IvHhC3pqR/xPLdVeEVvv29AtnJR6KcvkpQe8RuDcnh6kq5LzHR+AEm/RbZLbvcfosh5Y4Ndax2KzlKyy4I2wyO1kd8gpXNGW3ZbXWp1UJkvortjcJL9F1sDfkxJjfxAhUNlNQP5eI07v4wPquvFK2jnyL4s9iiIu04Dx+OuzYrL5ABUArWLG+KVH9qyp3suDLzI9DHxFGXsDxbqo4oTG43NwtpZmQQukkNmt1JVKWqlqcLklgYWPcDlF9bd1ny0a2kMXkqI4Wz0r78o3cwHcKjHLVxRRVxmM0Tz42D7oUNEWe8QmAFz3+F7CSbDqSu5SUbKRj2McXMc7MAdgrSagqKK5uzdxzNDhsRdQuLJDy3gOB6FWiLiyqvfAycB8rGu7ErGLNXx2W27LK0L2NZmLmhg630WjZXyDNGwFh2JO6zpl7RMsEqD3kMNpWlrvLULMkgClRIcjYu6JymPOZzQXWtm6gKuKiIHxSsHq4K1C9r25mODh3BurNNEcMoVeFkUsLKUC8T84a4/Eqjnye+yV1ZCIhA3Kxo+87ovQXUNQyORoErA8A3AKmOR9MpKC8HKoqmGiJnrZD7zUeIgC+ULuxyNkja9hBa4XBC4NU2Sjqp6owNqI5RYd2lZpHPwumi5l3y1DwBHf4QrygpcorGTjwzv3WbrQG62WNGplYKLUu1srxRWRt0VzBYzJicfZgLiqRXZ4biu6eYjs0Lswq2c2Z1E76ysLK6ziCIiAIiwgMotcwBtcXPRUcVxelwmESVUjWl18oO5UOSStkpOTpHQRc3B8RdiVO6bI1rCfAWncefmuiojJSVomUXF0zKIisVCIiALzuLNy17/ADAK9EuBjItWA92Bc2qXwOjTfmc9EReYegEREB1MDH28p7NH6rtLjYH+8m9AuyF6mm/jR5uo/kZlERdBiEREAREQBERAEREBq5oc0tcAQdCCvFYtE+jr5I2ABl7t9F7Zee4ohsIZxt8Lv5LLLG4muGVSPOulnLfiA+S0jMzgQ6Q2KlC2AXC3R3pFR1ES0/aOcfVZgpOUNdSrh0G6xoNbqm5lzXIB2+SZ2jTc9gsW5mp+A9FFHDJFK4h+dh2HZVpE2T5nEaC3qlnHd9vQLD3tjGZ7g0dyVUditIHZRJc3toFCTl0iG0u2XcjTvd3qVTr4DJHlYLG/RR1VTK/lwxExueTd3WwU9HUZ6Bk05GguSVZJpWRabotQNcyBjXm5DbEqu+po6d5LpGAne2q58s1TiQfyCYaYderltg9LTyUYkfE1z8xBJVtlK2yu9t1E7MMzJog+MgsOxCkuoo2tjYGsaGtGwCxNLy4nPDS8gaNG5WFW+DXpclDFCZqpkLnOaxsTpNDbUbK5SvdNQwuf8TmC/quTjD3tmhdlLXSxllu1yr9LOXTcmMDkxNylx6nyXS4/BUYJ/Jl2Nxey532K2uo2G0jx6FSXWXk18GoN32WQ7K9rh0cCqkUrnVsjTsArT9jZdMFTMZ9HuGm7Qe4usqGjfnpIXd2BTONgV3nnHha05q2d3d5VSR3iAViY5ppHd3FVAc05HZcMuW2egukjNRSR1TWCW5a03y30PqudFTVNBXgQAyUzzbKT8K7TdlmwvdYqTXBpsT5NGxsjcXNY1pO5A3WxOizZYKybs0XBFUS8qnkkAuWtJXMpqZskQdKwSSv8Tr6O17dwuq62Q5vhtquTROlezM6zoXOORvVvoVeHTorLtWZdRRgnKMzW6ljja3y6rFMKmI+6te1rHAyNJ3Y2+ymknBlhblE4+IFtr6dCqrZHHFOdVRSRRG7Q47HtdXVtclHV8FoRtjJf7wZHg/DtdUa2WWprY6azoxu7zXdLWOF7D1XIFN7ziUwefG34RsQOllEJeWTNeESwUMLbXpGu8xr+qxOwUUjJqdr48zg10ZHhddSRSz09K58rwXi+Vjm2vZVKyqnqJqZro+XkOcjcXUq2yHSR37rVzcyhjqGuaC8hpIve+hU91z1Rv2YmJjgc5sZkIFw0dVwZoMQr6xkxb7u1os2+pC9A0rbdaQltM5R3HIhnhwuTlukmnc8Znv3DfNdprg4Ag3B1BXnZqT3SS9S9gphmFwfE6/RXaWWpq2RmBpp4YyLF4+Nq0lG+UZxbXDOo94jaXHpuq9HKZy59rC+iVN5Psx1OqmgiETA1uwUxVIlu2bE7r1GBw8rDY77vu4ry4aZHhg3cQF7aFgjiYwbNAC68K4OTM/BusrCytznCIiAwiFVa+cw05y/G7Qf1VZSUVbJSt0inUCjhxQVktS8SNbk5ebwf/tYdBhfEDQ+anZUclxaC8bencLhYjTjFGjDm5s73A3b9y3Ur0eC4U3CaTkNmfN/E5cuDJLI7rg6ckFBd8l2CCKnhbFBG2ONosGtFgFIiyuw5QiIgCIiALh42Pt4j3af1XcXFxz95D6Fc+p/jZtg/kRykRF5Z6QREQHWwP45vQfzXYC42B/vJvQLsheppv40ebn/kZlERdBiEREARFhAZRaNe1xIa4G29itksGUREBhU8UphVUEsZ3tceoV1YOoIOyMLg+fFropCx3RbhWMVjyVsjDoWnQ+XRVGm2hXn5FyelB8Wa1LXGPwaEFRhzuWQ9WQQVq+MOaQOqyTXk0f6M30sq9ZWMpYsx1cdGt7lTM1aCqGVxqc9Y2IC9oh1URirsiTdcFGtgqH03vNS83uLR9AF2YqeBrG5YmDQdFVxM56CUHtdDWujoKcxgOkkAAzbbK8t0oqiiUYydjEniGaGY6ABzfqFLS0zH4bFFK3M0tBIVHEKgT4XC+Swe9wNh+a3pKiWIMnneeRLcC/3OybXsQ3Lezo5WxxhjAA0CwA6LnYVUNgpqjmGwjeSpYqh80kj/APFE2Z5+aoujIqamBo1kAe0dyNVMY8NMSlVNHRGJPkjqcsRjMTMwzbqv79Wy0Dpo42AAfHfXTfRYihqZp5ZXRlrJmlhB3GmhV+hpzDQshkAJscwUPZEJSkc/FJQYaKQm7rZvyW1DVe7tYyZj2dScpN79VJLhEbmgNldcEWzdB2XVFg0AbAWUucdqRChLdYFjIHDYtUh2ULnWc31spemqyNSvBYSv/EVO/oqUbv8ADy0HcK67YLfyjN9HrMGfnw2Ly0VuY5YXns0rm8PPzULm/heVdr3ZaGc9mFdyfB57XyPDOdufO6gpvE5z+5UsukVhuVinjyRgBccuEd67JgtlqFkvaBqVzM3CwVjmM/Es3BVWhZVxCTlUMzuuUgKpQyxCjgjDvG03cOoVrEY3S02Rls5cC2/dUH1rTPlkY6lkaLOeW3CvFXEpJ0zUUUkxkeyO3iNi11itDJVULC2sYJIHm1iV1YJ2tiaA0uYNnM1BVGcitxEQyj7Jjb5eytGTb5KtKuCpUUs1MWVVEXOiGpZm2+Ss0bphI2sqHD7QaBuwb2Ucj56Cd7w0yQi2vksVE4EDvdnWa+zize3p2V2rVFV3ZflnjEjah7mFjAcpD97+XdKOF0jzUzjxOvlYfuhcRsjahrGxwSOkY7M8l1zpvYL0UVZDJEHtfoTa3UFZzi4qkXg1J2zaKnZHmA1a43sdbLaLwvdGb6atv2Uda6RlO50I1BuT2CCVsjIZWkG/81nTZpaRa0WC7XRa6nRbMYBr1RUGRVELJY8742vdGC5oPey4QnnZTNrX1tn57cnsL7WXpQuVUYfSRSyVD2Z3uN7O2C3xy8GWSP0TwTCona5hu0i66GzVQw2PR0hFr6ABXnbBWa5ojwXMHh5uIRX2BzL1y8/w5Fd8svYZQvQrtxqkcOR3IIiK5mFhZWEAJ0XNma+umLYiGsboX/0WcUrOTG5jDqG3cew7KzRR8qkib1ygn1O655NZJen4XZqk4R3GtHQw0bTym+I/E87lW0RbRioqkZttu2ERFYgIiIAiIgC4uOfHD6FdpcXHP3kPoVhqf42bYP5EcpEReUekEREB1MDP20o/hH6rtLhYKbVbh3YV3V6em/jPO1H5mURF0mAREQBYIuFlEB5nCuHKjDsVln9+dLATdjXXzN7g62XopJWRNzPNhst1XrKczsGU+Juw7rNx2JuKLuTm1uJIp45r8twNt/JSLhRukoqhpc0joQdLhdqKVkrA9jg5pWeHNv4lwycmPbyuiRYWVhdBmeZ4lgyVUc4GjxlPqFxbXXrsdg5+HPIHij8QXkgVx51Ts7cDuNEZfkdYrZkoedFs5rXDxBasibGbtXO6aOlEckoicG5SS53ToqeL0Zlj58ZdnjF7X6LpZfHc9lk7KqltdoOO5UzlQP8Af6Ii/jtld6qvBA+rw3ktOWaB9hc9F0KWgbT1MkrXEBx0aNlvHSiOtfO11mvbYtHfurvIldGag3VleHDjIw+9WHgyMa3Zo/qrjIWRwMisHNaLahSkgbpe4uFlKcpG0YRRQlieZ25bBgGyzNRPkfFKx2SVhvc9QrWduawIut3XLHZfitop3tEOKZG+a04bmAY1uZ5/RZfURsc1pdq7Yd1VbSynV2VlyCRe99LLeSFsZ5ziXObbf6fzU7YkKUqM+9+KTwgAAZT/AFURqpnNYI3CxPifbpeympIGsicS0XedQe3RWA0DoEuKfRFSfbFjyy477hSE3ZcItG/u3N6g2UJkvgp04Jr3OOw0XRd8KrQNtIT3U73Wbqt7tmbXB3uGpNJmHycuji7suGTn+Gy4vDj7VhH4mldbHXZcLk8yAuyP4nFJfM8bIdgtmfCFo4XepQLBcc2dsQQtcovst1rqsGao0c1oGgssRu1tdbuaTstGREPzE/JG+CTL9ZYh6lRTiN84a9lxpc30+ikmFpIXbWdYqGtDmguaR4hbXuNQqrsh9FOspfds01M4wkXJA+E/JRYcHvmkmd8bmgn5q5icgdRsj0zTkNHp1UVLPAKwRtNmvFhdbKT2mbS3E80HPhcw/eFlxBSvixFsMhIa/wAJ/kvUhoCo4pEzkc82a9hBzdfRVhk5otOHkquw6WCrZPEbtFrjqP6qtXOcakVUA5bM4aTsHd7rr4bUmqpGvf8AECQVSqYZn0tRDNbNfOwjqpUnfJVxVWi+RJPCSHBrXiwFuiimphHEzlgktcLeS3w6VstHHbQtGVw7EKy97WC7iGjzWdtOjSk1ZsFstL3WwUEm17BUZ2meQNGytvdZq0iZd11rDgo+SWFgjjDQNllx8QTNYLEYzvAHU2W0FfJlJ0erwOLl4e09Xm66Sip4xFTxsH3WgKCkqJ5pqhk9M6ERvyscTcSDuF2LikcD5tlxFHLI2KNz3mzWi5K5/vlQXCVoaYj9zrb1VZ5Yw4ZMYOXReqhM6mkFM5rZi05C8aA+ahgdLTYew1j2vna3xFuxPktffsw8LLH+IqhVvdMQ3mZnHqNgPJY5M0UrjyzSGNvhlKpkM1wTd0jwCfmvUNFgB2Xmo4b1kLAPC19yvSrHRJ/Jvs01NcJGyIi9A5QiIgCIiAIiIAuHjZ+3iH8J/VdxcHGjeraOzAufUv8Axm+nXzOciIvLPRCIiAu4S61e0dwQvQrzNC7JWwn+Ky9MF6Okfwo4NSvmZREXWcwREQBERAFhZRAaSRskaWvaHNPQrkVFPNh7+fTPPL+8DqPn/VdlYcAQQdllkxKf6f2XhNx/oqUmIMns145bz0Ox9Cri8/NAKavdA3908Z2D8OuoXRoql2f3eU3d913cLHDmd7J9mmTGq3RLsjBJG5h2cCCvCTRGGd8bt2uIXvV5PiGDlYjnAsJG3+a1zK42MEqlRy82oCPJDCRqbKKQ2cFM3Vq4pKjtTNIpDJGxxFipHGwWHtDY3EaW1UdQ/LC43As0m56aKlWy10jn1WLRxOcxgMjh20CqnG36Wh/2lQngdFIRq8bhwG91oyGV5s2N59AupYoUcjyTs7FHiPvMzYpG5HknK5v9F1IjcEeLt4hYrz0GHVVxKGhgb4ruK6LMUaGgyQSsad3WuFlkgn+Jrjm1+RvVSR4e9jjG5wkNi6+y2rcSbStZlaHl50F1pWltbRuDCHXGZpC5NJG+uqomOvaNuqQxpxuXgmWRp0vJ35q2OKl5x17AdSuXHjUvMBljbyyei2xCnyOpKUXyly6dVSxyUbosoAA8OmyqlCKVrss3OT4fRI+S9M6SMg+ElpUGGzyVNGJJDd9yLqvhDzJhz4z9y4WcD1o3Ds8qHFRTJUm2iTCZ5ZmTc1xcWvtqrp0cfMLm4ObTVbOz7roymzc3YpL8qEfxsRO8RW01uUbXzKGE3JKln1YVaK5IfRewOTJXQHubLucRuthwHd4XmaKTJJE7s4Lv8Tv/AMEhH4nX/JdkX8Wck180eZb8SlUbFuuOZ2QMrCyiyZoOqHdFhUZJHOM0TrbjUfJRSSNlpSehF/QqwQuTiIdCeTAfFOdW9vNWhzwVlxyQYe9tS4yTZs2rYr/C0K6KOKohZHJ4Jo9Lt0PqrNNSRw07YiARbVQVWWFwGV/LAuHWuB9NQrOVvgqo0uS7G0ta0F2YgWueqqSkVNSS6xp4N7/ed/wUPvUuQ8hwkNtBmBt/Nate9kLIiMtjckg+IqFFrklyT4Ks9QaWqjZDla4nM4H7vl9F1n5auizNsczdCOhXAnpnz+8O/eTiQXtvay6GFShmUNJETxs7oVrOKq0Zxk7pkNM7kV8DoTIWynLJmFgSr7wKqtDHsLomtvcqHFmcuB8gabCzwR0IW1PWsFnOBD3gW00soatbkSuHtOmsqOOQvtotnuytKySNbNJHC9gpI9GqvF4nXKtN0ataKEdQ4MaA25vuruFRh1XC11gMwuucfHLboF1cNo46ypjbK0ua14cLEixHXRbp7aMJc2ewUFTVR0zfGbuOzRuVDiFYadmWIB0rtr7DzK5LHEFz3uzyndxU59Tse2PZhjw7uX0S1MstS4OnOVgPhib/ADWWRlwBldYdgq7qljDcG7u5VaWrc/wtOpXn77e6Ts61B1SL008bTkibr3SM9eqqQsyi53KsNPRWjJydsOKSo2c4NzPvaw3XSwpkwhc+ZziHm7Q7cBcxsLp6mKDYF2Z3oNV6HYLp00G5Of0YZ5cKJh7xGwucbNG5XMqMbhZBK+njkqHxuALGNudevotcUmhrqd9ATKGz+Dms+6ehUXDuAvwVkjX1bqjMfDdtrLpcnN/B8GSjGMbn2dtji5jXEWJF7dlssBZW5iEREAREQGF57FnXrneQAXoV5mudnrZj/FZcmrfwSOnTL5ldERecd4REQG8bskrHdnAr1Y1C8ivU0j+ZSxO7tC7dG+0ceqXTJkRF3nGYWHODRdxAHmsqliuHMxOj93fI+MZ2vzM30N1DuuCVV8l26ytGtDGho2AsFtdCDKLCypBhRTVEUIHNkay/cqQm2+y8lUzuqqt8pOhNmjsFy6nUeilXbNsOL1GX5HGrrpKkAiJoyMJ6gdVGZi5+Zp8bDmCsZeXQjpcKixpa+64pW+X5OqKXR6WGVs0TZGm4cLrl8SQZ6JsoGsbvyKhpaw0UwY4F0EhuLbtK6D54K6KWnBOZzT4XCy7oZY5I7X2c0scoSvweHqdI7jcKWM3aCtahp5b2ndtwlOSYW33ssJLg64vkn3Gqq1gHhL/gvr9FYvZQygytIOjdrd1lHs0kuCu12WojlIPLkjDfIFW2Pa8vAv4DlKpU0kfKDA9pczQtvqFcjka4E3ASaZEKI4Ranka0eFpcB6KMMdJAwEeEs/ksT1tNSwloeHGx8LTcqWmkb7nE9zg1uQG5Ucrmhw+CjhDCafLb4XOCxhkYixOrYBtt9VJhBBjlynwmR1itqeGRmLVEhYRG4aO7q8pcyRSMeIkeNAxyU042Y7VdCSZgpnS5gWZbg3WKqBtTA6J+x69lxP2VWF3KLhygd82n0UQ2yirfRaW6LdLsuYI21JI4jRziosLqo6YTxSuDC15Oq6tPA2CBsTNmj6rm12D+8TmWN7WF3xAhWjOMm78lXCUUmjTB5OZVVT2atc64XXl1jPmFBQUbKOHI3Vx1c7urRFxZVnJOVotCLUeSClHh1U5GYWKji8IapCdVN8k1was+zFuy7GPy82kojf4mXXFv9pY7K3iMvMp6Nv4WEfmumL4ZzzXKKzNllYGyyuaT5OiPRlERZMuYRZWLKpIXBkcamolnadyIo/LzXSxSYw0paz95IcrVBSQNZLHENoW3PqVpBUrM58ujosbkY1t72FrrKAodlizYhfTwv+OJh87KjHTxPxCVmRvLDLD16rpriuZJ7rPVxzOjeHG1uoutcd8mc+CxhpMMctLymh8biHOJ0IPUrmVGWjqrRuc9u7wDcD0XbpqOJg5ri58jwC5zje61qmBs7Xhos5trW6jVXU1uZRxbiRe+RTUfJeSDI21ztdc/M+me0wZnRsFi1+t/6LswshIkAY34jbTuq1W9rKBgIAGU/opjKnSKyjfLOjE4SRMe0WDgCFpPcmyUvgpomncNAW7rKi7NH0YhZlClPw2Cw34UuLK6dsh9EUTTmcSLL0WAsyQSSk2N7ArhxML5A1ut13BK2kw9oO51t3USypT/AKM3G419isqGsvqfU7lcqaqLuth2VHEMQyuLiblc1uIPkdYC47rje7I93g6YY1FUdgzFxsFdpocozO1JVShjGQPeDc7AC5KvU9RFODynXLTlIIsQVEY2+RJ0ThXKeC5zFV47DUqV1QQLNW6lGPZzSt8IvMcyKQyABzsuWyhkmq61xZHFy4upJ1KrNL3vaxp+0ebDyXcijEUbWN2C68LeVUuEc86g77ZVpqBsZa+Q5nt1A6BXbIsrshBQVROeUnJ2zCyiK5AREQBEWEAJsLrycjs8j3dySvTVT+XSyv7NK8uuDVvpHZpV2wiIuI7AiIgC9BhEmehaOrCQvPrrYG/xSx+jl0aaVZDDUK4HZRYWV6h5wWFlEBFM174Xtjfke5pDXfhPdU8Hpq2mpclfUc+b8Q2V9zg1pJNgBcrnftUF2ZrLxd+qxyThBpyZpFSkmki7LOyIhricx2AW7JGvGn0K4EdXU1+JzcukewQnKHOdo9u4I9V0mPkje10zDGL2zE6LSMlJWisotcMmxCTl0M7+zCvMUkeeZrey6ONYnFLCaandnJPicNrDoocMYI7vduNV5OqksuZJPhHdhi4Y235L9Q3NkjHQXKw2nFlljt3ncrHOs7db8XbM+ekVZGDOY3fLyK0NaY6ynEjQHNeAXdwrOJMJjbMzcbqhVhtVS9iRv1C58jcHwbQqS5KWJ8l9VK6GRrmPJIsdlTi0uFVwXD6mkpqp9TECA8Ma8m5HmPVWmCx8l0bm02xtUXSJVo/4TZbrBbcrJmp5KsuKyW2njKhzO2zH6r0VdhrKh2cOLH7XAvf1XPjwh7xfmtAuRsV1xyRa5OOWOSZzeq6tNhzpadpfI8X1y9ApKPDIhJ9o/O9psW9Auw1obos8uauEaYsXlkdLAIYw0dFMiwuJtt2zrSpcAlZutVlCTKy4g7lYVZ73OmyDorRVkMnzdlq9zi0gaFZYwddOy2sFZcFeyFmYOA6BTpYBPVXuytUjB3SZ2Yxt/CP5qMX5x7WWx1kXRF8GMkbIiysJGqCyiwsy5lLrC1keI43PcbNaLlRVk9HIrZ/+dmB2rI2/IOPdWqZhbE525eSbrFLTCajkfKPFOcxPbsoYppKKPkzQvexvwvZrotlTVIx5TtnQhcSLHQqZcgYlTOJtIWHs4WViGugvlNQy/qs5Y2aKaLc7skEjuzSVzYW5sCdfXMwlT19ZAKKYc1hc5pAAO6lpIR+y2RHrHb8kS2xIbtktK4PpYnDq0Kli5dyPBfMw5tFPhTi6giHVoyn5Ky+JrwQRe4sUT2yLP5RKFFZwadSXNFvkohHzq2CKTURtc63z0U7cLaz91UTRgHQA7KxT0kdOS5t3Pdu5xuSr7o9oz2vpmxBC1GbOB0U9ksFVMu0OwWrrhq2KlpWCWoa3cA3Kly2psq+eC5SQe70+Z37x4+gVDFKzLcX2Fl0KmYNa4k/CF5GuqHVFRymXLiRfsAT1K5Yxc2aQ+2UKupMkh1VvCKH3uojJc7K05rA6KpJUywVVRFTQ8kEZXNf4iD6r03DhdLG21JyGRxhmY/eN911TuMeCXK+TqSU94XMY4tu0DRUcLpa6CYRy5fd2EuDuriV2CAwXeQ0eaw2eJ2jHhx8ly89FEzY7arUXc4NaCXHYDcrYRyyOFhlB6ldmhomUzcxF5HbuO6vh0rySMsmVQRigouQOZJYyu/LyV1FlezCChHbE8+UnJ2wiIrlQiIgCIiALCysICji78lC4fjIC8+utjj9Yox5uXJXl6mV5D0dPGoBERc5uEREAVvDJOXWx9neEqostcWODhuDdWhLbJMrJbotHrVlaRPD42vGzhdbr2lyeSFhZRARys5kT2XtmaQvKxF9NK6CZpa4HqvXKGeniqGZZWBw6XGy5NTp/Vpp8o2xZdlp9HHoK405fA5heweJljqB1Cq4tXzVjeUyJ0cQN3XOrv+CziFNNh+R7X5xfwnt5FT0dXT1cRzNDX21BXG3OvRk6OpKP8iVnKp6Z1w5w0XRa+9mhVHPcAAemyzHJY3KyjBQdI0k3LlnRz5iWjcKq+TK7VWqVwcHHqVz6vwyFXzOlaKY1bo6kD2z07ojva65cIyzPhd0Oimo6rlttffr2UFW7LUslb1OqrkkpQjMmCak4luKlElFWMb1aHN9QuJHYB1x0uu0yMSTBvMdGHjM1wPXqFyKtoikdGO6NueNY0iY8ScmRBZWBssrVo0TNXDMLFaxxtiYGtFgBYBSIGlzgALk7AKv6JryaBjQbga91spJYZIXZZWFjt7EKMmwVXfTJVVwYvZFDJmKwJgwWdqVLgFInsmq1ZJnF7KRVqiyZgaDVa8tuYu6lWKenlqpMsLcxGp6BazMfDM6OVmR7dwrKMkrKOSbo0WFpLURxFrXOGZxs0dyqL66e5jdG2J+ZozE3Db9/NTGLZDkkdK61XJlqZHRxymYsfnyZW7Gx1P0UlIKj3+SSRlo5Rvfa2y0UCu46Xda/eKyN1gdStIvgq+zZAg2QLNl0ZREJDRdzg0dS42AWTLoKjizstIGk2a94a49h1V4G+ywQHCzgCOxROnZDVqiGOenewCOaMgCwAcpGMF97+ihfTUb5RE6JhkLcwaG627rQ4ZADeN0kf9l5VuCKZFVxMkxKmY5jSLOcQRuo56OnixGncYmhkgLLW0v0VuCiEU4ldLJI4DKM52W1dAaiCzCBI0hzSe4U7+UrI2cXRkUVMDfksJHcXVyCCSa4ibcNGvQBc33isZ+8pA7zY5W6HiAUReJKWUB24c3Y/JTGNy+XREpUvj2UqFzqarqqSRpY5smYA9iuiuVWV7a3G454beKPKQAdLaroxuuNTqmVK7QxttckiwUWFkaMyFgrBNvRL6KyIBJANlawsZI5ZHbnQKodVMJeXTEba3VcvSRCXJTxasyRuF91wWsdK2RpDw99tWnW3UW8/wCSmrJDU1Qb90fmoaiUU9UKYMLahzgHOvsdgb+Svii0uOzR0lRdwSgNXNzXgiNp1J3JXt6eIMaAdAB9Fz6CkjoadrLnQ31NySdyV0LzPZ4YiB5mypdtsym74K8zo4Q6efK8jYOPhb2Hqt6PEYZqcTPY2AG9rkagdQtDSNlMglDXZxbINh5rgVVFX0vMhwyN1Vcbt3jHl5FTBPwVqL7Z7TCnR1Y95a9r2/csfzXTJAFybBeT4SosYgc12IRsgha0hrb+J1+4Xax+KumwqRuGloqbggO0uOoXpYlKMOuThyJb6T4OiyRkguxwcBpobrdee4Tpq+CmkOIxcqVx1u65ce69CtINuNyVFJxUZUnYREVygREQBERAFgrK0keI43POzRdOgeexOTmVr+zfCFUWXOL3Fx3JusLxZvdJs9aK2xSCIiqWC3jjfK7KxpcfJI43SvDGC7iuzBCyniDW6nqe62w4Xkf6McuVQX7OY6ima25APkCq+x1XdIvutORE83fG1x7kLonpF/qzGOpf+yJcIlMlGGndhy/JX1Vp3Br8gAAtpZWl2QTjFJnLJ220ERFYqFhZRAU8SpveqN7B8Y8TfULyDbxVFwLX/I9QvdLzWOUzG1DpYttM47HoV52twtr1I+Dr02SnsfkouffXyVaproqURmTNaR+QEC9isMcWyujdvuD3Cw8AixAcOxC4Y5OeTt2nUo6nKAS02I2O4VbEagalqzTPDhZVcRYcpKvke6JWCqRDS1Z51r7q9NJnavPROLZx6rsg3YCubJ8VRs4q7OjTP5tKCPijK51e4Grd5AH6qWinEU5YdniyjxKM+8tLdy2y2wzqUWZTj2RA6BZWjDdq2XXLsrF8Gy2jeY5Gvbu03VR1Q4l/LYC1hsXvdYXWvOqGSN5sf2TreMNIGvYndV2vtEuS6Z062sfWOYXtDcosLKqeyq1dXybtZcuYQX2GgBK9XTwUs1GGljbEbga+t1pHHLLy2ZyyRxqkjzbtDYoYw4g23W+IYbWukZHCJLAm7mDQi2huooMExATsmncGkEO1O/lbsojjkyXkijs0uCOkjDpJRH5AXVWoghjqDTw1sEk4FxG45SfnsusZ3uiyWtfcqr7rFmDuVHmAtfLrZdLwR8I5Vnl9lTCKmqpq0w1NK+IuFwbXFx5rbiumlrI6epp3EFhLZLG1x0v8106aEySBokLS0aFYdG+KqIeQ43s7TRwWmyo7UU9T5bmeOjpAZiZJcpzB4sNj81aZRwh73EF5f8WY3B+S7NXgTnvdkcALm1wdAue/CcXgDhEyGVvS79VyvFM6llx/Zq2NjGgMaABtYbLJClbSVbIm86FwfbxWFxdRkEHUEeqxcWnybKSa4NeqxlWSsZn8yzW5hZXTSXLKtc8GSjSpm00kmzHfRbGDlDxb9gsJZl/ryaKJEB3Ws7GTxGJ7bscLEd1KInu2aVI2jlPYfNZ27tluCuiuNoT95/0KmbhrCP3lvVN9+CG0vJzMrS8OIGYCwNtbLZX5MLeBeN4KquppIz9oLDuFLlXZKafRCi3LW66rRIyTJNmOyPa6wNiDY9VJVzionMgjDARawVeSQRRue69mi5sLrZpa9jXtJLXC4JFrhX3NKiu1XZ2aOlp5KAOaGlxHi01uvPzf4PUO/ACrlNzTM1sLi15PRd59LSudeWFr5Lam25XZBetFcVRxyfoyvuzzjLyWyAknsrkWHTyC7m5B5rtt5UQ8EbGD0UEtW7Zg+Z0R4cePmbHrTnxFFVmFxj47uK1rmwYfFE73V8ge8MOT7vmVLzXON3SSX/h0Vam4gpjVTUz5g/lm136G/XXsojnxu1FV+yPTndvk6Aw2KWJruXlLhex3CpVmD5o3NaXNB6hX6iaodhr5sOyulczNFn2uvO4Xj2LTTPpqqANlYNS+7bn0W2VwUbkrKY4zk24ujj4thFTTsBha+YNFt/g7m3qr+EYWw8qaohbLVOyyRgk3Zpu7/ivXupDUUzHyMDJS27gOhXLe2Ske8NADn6ZrKk8VxuBeOod1InzRUxu88yU7nt6I2WapdZvhaoKSldMeY83C6RLII9Oi4Yp+eEbNrxyVauVtJT5Wnxu6roYDSmKj5zx45vFr26LgsDsRxOOL7pOvoN17JjQ1oaBYAWAXRpY75ufhdGWoe2Kj5ZmyIsr0jiMLKIgCIiAIiIAiIgMKhi8vLpC0HWQ5fl1V9cLGZc9SIwdGD8ysM8tsGa4Y7po5yIi8o9MIiIDrUFPyYuY8eN35BWNzcrZ2qxZezCKgqR5UpOTtmN1kaLIFlhx0VipjPleLdCugDcAhcv7wV+nfmbl6tQEyIikgIiICFscgnc4yXYdh2WXwxvJLmNJIsSR0UqwgPLYrhJgOaK/Lvdh/Aex8lyzqNRY9R2Xu5GNkYWPALXCxBXksUpDTTuA2H5heNrNPs+Uej0tNm3fGXZTgOV4VmZnNjcOqqgaqWWoZSwOmmdaNo1K5sbb+LN5Lm0caWIsm+a6UWsQUVSWS2kj1adjbdSUwPLIsq5FwXsqPlLa2P1XZblkracOtbrf0K8/U/wDTIv7QXpsHaJMVhBFw1pOvotMa+cEVy8Rb/RQnpDTveGEyRNNs4Gl+yhXXxVoo8YDiDyn2fl6X9FpUmHEXt5JayQaajderkx312cUMtVfRx6JjHV3LksWslElj1BH9V6qqgZW0L4HWIcND2PQrzVZQhk2WZviGzmkjT1VmCungYGtfcDQZtVSGRQuMiZ4nOpRKUtIznOMrLyDwu81PA18nhhPh62Oi6cJir2ONVTtcfxDS6lDIYRkhY2NjejRoEWFfk3wRLM/xS5IqSGWn/wAadeisOc53xG60Lug+q1uei64xSVI5JNyds3KbbqMl3UpfzViCVjyxwc3cKV8zJSDI1wcOrSqucBM1+iA6YqYXDV7m+qilqoxpG3Oe7joq1PHzpA0nKFblpqWFpMkjgB1ulgjhkqZ3eEMLRvcWC2rXU8IDZLPedowMxKre/gtMNC0tB3kd/JQNfFDJlzZpnbkm5XBn1e34w5Z048DfMiN1IyR+d8bYm/hbv81Lmhgb4GNbby1Uc9THECXPBcuRPWh7/DmcSbaLzm5SfPLO6MbR0aisc4WaT6qo2Qj4jm9VyZcQA2KqPxInYosc2aqKR6P3g9wE94d+JeXNe4n4lbpq0k2JuksM1zZNI74qXjstxWSW3XMbKT1W7ZD1WXKI2o6Pvj+6GqcdyVRDytg4qb+yNqLrJI3Pu9ocopIgBmDhqbZey0Y1zhey2bnJy2urqVFa5MTQuitm6jspKamEgu8lrB0aLkq5GJXx5XkOHmL2Wrrx/FIbD5LVz28pGdt8WWIiIG/YQtj/AI3m5WjHyzvLYnF9vids0KKKOStfYEsi6u6ldNrGRsbHEA1rey6cMMmXmTpHNklGHC5ZE2kFrOe9zjub2WJKBhGUTSMJ+as5sosNSVs0fM912vBjapo5/VmndnJGCuLvFVSEdlHHwvTw4l71DJlLh4muF7nuu9cNCrmcuJAIDRu4qFp8cVwi3r5H5JIDy2ZXEWGg9FDS19LWvIgdZ7SQARbNbqFWGI01VFKykeZHN6gaHvZedoYJpMUiM7ZIY4LyEkEZj0F1XJm2tKK48lseLcnu4Z7hj8w8woaqnbPGQd1XiqDUQ8+IEOabOb381cikE0Yc1bxkpK0YNOLpnEie+kkcx18l9fLzUNZV8wG3w7BdOvhDhmA1G64k0RNw3fcBcmqwuUXKPZ0YMiTqR2OGKbSWqd18Df5r0Kr0FOKWiihH3W6+vVWF0YMfpwUTHLPfNyMoiLYzCIiAIiIAiIgCIsIDWR4jjc92zRcry0jzJI57t3G5XaxmfJTCIfFIfyXCXn6udyUTu00aW4IiLjOoIiID0NkWN0JsF7Z5BhxsFrZY6rIKAwG+JSxOyzjsdCsAWWP8YEBfWVHE/O3zGhUikgIiIAiIgMLlY3EHMY8ju0rrKriMBqKN7G/ENW+qyzQ3waL45bZJnkGsIcWncGyvshjfTnnAFhFiCL3UFwXh9rHZwVidzWxta031uV5MYqK3fR6Em26I5KaORpZG0DINAOyqNiMZcCunSH/Cnm2h0HyW+J0wbG6Vo0tdXlj3Q3kRnUtrPIVYyztd2cCvS4EbYszzY5cGsjzG/ddLC6jlVNNMToCA702K54yUZxf0zoyLdBpHfxmlbWvaxrg2SIXudjfovMRvMUmZp1aV6yqY2SolDSdWAOIPVcRmFZX3llZkB6blezki200ebimkmpE9bA+rpoZoxd4Go7qnBQyZw6Zhawb36rrhxc0NjBDGiwPdamNx+IqXijJ7mVWWUY7UaF7Q2wAa0LzWJUdacabVU5lfTSECVjDYjSy9OY2+qp0U1TLG/wB5pxA5pLbA3vqmRKXxfkY5OL3INjLGgXIAFgL3Wf8ASKkI7rW+tmi5WiVKjNu3Zhge9+UeL+S2ezIbHQd1boosgeX2ubfIKvWVMRJjiBkk2s1VnOMFcnRMYuTpFcyRsflHicVo+pt1aPIarg1TcUxLEmQ07JaSGIWke4WA7m/VdmWoocOhDAQ5zR1IuVxZNVJL4rs61pl5ZIyqla7MwH1K1lkfO680l/LoudNXOkc11QDDTHfxWO1x8lyzWyUome+lmfSy2Mbi6xb5i+tlh6mTJxI3WnUVaPRSVkMDbAjRcmtxlhlLwGh+17arkxzOkgZUEGazzeMuygtt+q1o6bnMkccrTE3M8vNwEcPs1iookkrppicocR3Vd7WvZHJVymOFzyPDcnQb29VK0xTNZy6gjUksa6wOnXystJLSmNsAbIXszODTctN9leKS6RLd8GJJIKFsZfGKoTw5vEbZCdrW2UAbSvoBIJXNqRvG7UO9PNXY8ImmcHcix7kWVijwuvw/EmzsgbKDodiB9dlb1I+HyRTTObHRySXAaQfMbLqUWHVTmXnay42LRYW8/wCq9DFTsZd78plccziO63eGubY7LmlmbTRNlKClaG2zNNuxVgUrFz5aypqqt9HDHGZhq15IbbzXSa5waM1sw0NtrrBwXbG5gUrAO6yIWDosteSbAKZoHqVaONMq50RM8AsBopmtBANrErBAB2UrB1K3jFLsxcr6N4xYKL3fnS+M6b5Vu6oYw5Wgvf2C1DphKx4YY++bspi1Oa4tES+MXzRd8MTAxoAWQVEy7jdSjw+ZXrpUecbDT+0fyUrTlCib3JWr3F7sjDYbk9lINpH3sxpu5y4/EdUKTD3xsPjfaNvmTurIxBjaoQ08eY3sXuK5XF1DLUGnnY4hodlc3sSNCufJNSTSfR0YobZpyIcLnNJLTRxRmQEgHzB3K9DUtgqrMi1PUjovN8NUUjIc8pc6UDIzMfh72Xq4IWwxho36lccG0nBdM6cqi5KXk2iDaYNAtbYqSIcmZ7fuHUKnVSdBqqEuJ1lLHDEImGSSQ5c+uVgtv5rTBm22n0jHJicqa7Z3aholiLmakLhTsIfcdF2IJQ+Js4Fg7Rw7FU8Qi5cudvwndd8ZJq0crVcM7OGT+8UMbybuHhPqFcXEwCUNM0BPXM1dpWKmVpJKyJt3mwWtRNyY81rkmwCxE4VELXvZa/QoCUEOAI1B1CysDQWCygCIiAIiIAsFFVxGo5FK4g+J3haqykoq2TFbnSOLiE/Pq3uB8LfC1VUReNKW5ts9WMdqoIiKCwREQHodgo3OSV2UKuX3XtnkEl7mwUzG9So4m9SptkBkrXd4S9yg+O6ARyiOoAJ8LtCry4da+wOq6OH1HvFMCT426OVd6UtpO11uLiIiuVCIiALBWUQHnsWpRTVAnaPspTZw7FVgxzW3aM7erTv8l6Ksp21VK+J1vENPIryzZpKWQxSg+E2uvN1OLY966/8Aw7cM9y2+S1CRG0E6NzXa716FYxPHYKKqgoZInvdOy4cBcb2spIZWPuDYtfuFrHSwTuEdREyV9O7NE524BWWLK3/jf/otKKT3NHNmp2va1zWlocM2U7tVVjTGSwjTouviTm0zXSSBxZ0ym3zXLp6iOsqTHGHPaW5g4jY9iVhmxO6OjHO1Z1qCqMzBTudZ/e+rwugIGA6NuuI6lcLFpII2IV2CuqIm5Zo+YPxN3XZp9S0tuRf+zlzYU3ugdA2aOyjNzrsFAK2I/dkv5tWhrGvPha53mdAut58cVbZzrFN+CwS0eaoskeXC7y4uBJHQdlI4SzgNYQ0HchTxwMhFvid1VG3lmnHhL/7LcQi0+2QiNz9zlb3WxeyJhLfC0bvKSzsDsoOd/wCBuv1UT2xxt59fIxjW6hl7AKM2oUOI8sY8Tly+jEYnqA4MLooXbnq5Ynnp8NhJsAf1XKrOJuc7kYZFzDtnOjQq8WGSVUnNxCozH8N9AvOnub3ZHyd0YUqrghqa2XEqqNsbXDN4S+5+z13HTZcjEY5m174rtq5Cb3LcxH0XpJKmkw4PZCWvc61m6Wb81znYizmHlfbTu3yC9lMJyT4XBuqRzf2RVWbKZXh7dmuPToPLspccr+fDHFlljdlAcHN3V4RV77PfTvaDsZDlC2khlljLJahjRtaPcK297k5+CK44PMUdLUVcoihZK/8As6D69F6Kn4bnAMc0kLRy9Xh2uY9ND081OyDIwNaXkDvotzG4DwlWnqb6K7KK+E8L8uV0ldJC+3wsa4kep/ou82ijpQXRsiYDuWiyrUUDXxPMjznvYDsrFLBUySFrSMgNiXbLOUpZOWV4ROXxRsDnSZr7BqqyVmtmRg+pVuanY1wbMzJfZw+E/wBFBJ7vDIYyWNFr5iqNq6CfkiZK6TcZVO2nLhfMqLi1sjYw9rgRdrm9VNHLJGbO1aeoXPwnyaO64NJMEa6qE7J3xu6gAa/NXRStAAubBYZUHo76qUTG1y0272SUmyHfkifeIWYy/mlNKTIGuAIPVSiRj1qSwfCrQnLcrM5JUbvsZtNgtmwulJLnFjBppuVCC1ut/qsmd9yW+JnUbL0YyhL8lwczjJfiWY444ml4aGtG3mtbl5zOWud09iGWaNhdJX8luaQAN2uDey6o58S4TMHjyN8llhAati4AXO687V486kxn3H3dzhYBpB1JK6ArY4+X7yTFJKXZGO3ICv60VLaw8MqT+zoXLzuABuStoZIZA9kcjXOI6FUa3XJA13xaut2VMFtPJzQcob1XNm1ix5NlWa49O5x3WVKuY4WyaV4PM1az59VpBiFfX0bGVhZlYBYhtiT5q5Li9BiQ5ElPI838Wgt9VedR0fujHRuFz0vqqSxp3sl2aqbjW+PJJg8QbT5ul9FzpOIuXjBo3xvZa7SHM3PSx/muxBFJAHhjW5AAd1zcVxCNjHSGwDRoeqymnCCbXZMGpzfkvCtoGx5JqiOOfXwuNifRUHvbNNzR8DRZt1wsPp31dU6rnGrvhB6BdaokyNDG77aLDNnbisSNoYFGW46WEVHMlmpjq0jMPVTvPMjdG43IUeHUz6OIOcz7SQjMeoHZXK2jLblmjxqD3C9XTQlDElI8/O4yyNxOI8uhmBuQulHXzWAE0hHyVGdrnA5m6hYp5BlFzay2Mjt0dTzZmiUufrYZuhXW2XmopWmRuVw10Nl2RLUTU4dGG6/eGp+isiGXUUEBlbATKC5wvbuQt4XmSPM5uU32UkEiIiAIiIDBXnsUqOdVFoPgj8I9eq6+I1Pu9MSD43aNXm1w6rJ/ojr00P8AZhERcJ2hERAEREB1Z362WIW5io3eN+iuRMytXtnkG4FgsFavqGM+IgLaN7JmZmEEDdRYMg9liR4jabnVU6itEZLWalUZJnynxO+SxyZ4w48m0MMpcm1RLzHabBS4dU+7VILjZjtHf1VRFwPLJz3nasSUdp64G6yubhNVzYeU8+Nn5hdFepCanG0ebKLi6ZlERXKhERAYXKxfDfeWmWIfaAaj8X/FdZYUNKSpkptO0eGDnwvseiuxz80tcx2WVuy7GJ4S2rBkisyb8neq8vNC+KUxvBjkbuP6LxM+B4ZXHo9PFkWWNPs6FeJaqlfG6MZiLXB0/wCC52GGspo2xSwhscZ0zPuT9FGaurgPwiVvbYrR2NRtac9PM11tBfQpKcsi4LxhtTVcHWNbJ+CL80FY4nxQtPo5ceLiCB7TenkYWi5zfy7qKTianb8MMhP9lKzX2Rsi/B3jJJOcoYI2dbblYfYCxc1gHReWn4kqpQW01OW+ZXP/AOdax/8AjdewsEeBz5myyVdHt2yxsBHObY9LqlWYjTQA5p3u/hzmy4kWF4k9oa4vt3Ois0+CRNkBqpRcna6mMdvFhxj2zWXiOYNLKGnDR+Ihcsx1+KS56iVz23+I/CPQL0dRh7KeTKYmlv3T92yzAxr5QJBmHbopU9rqKpkrbVo87R0tT7+10UWeNj7CMn4vMrutw6eVl55fdx1YDc79PJXamBtO5kkdmOPRqt00UFQzODdw+IHcKXJydNFXKlaOTFhWHxm72Ond3eb3+SvU720sQjpYMoHWw/kukKaMdFqWNjOyNT8sz3pnPmFRUts8aDWyriFrb3OUDU6LrVDRLCWtNr9lSkw2OrMfvTy7l/CMxBCwajfLLxlwVTC/NZrXEdDbRSCklJtl07rsgBrAG7DRI8okJJGW2t1aOODIeWXg50NA8u0JFvzVn3acMLWuLbjcdFdE0bBpb5KtUYi1mjDqtNkI+Sm6bDBLDThkoztGhzdVy66mEvNIa1rC3wgDW6lqK+ScBu3kOqnp8Mr6kAlhY09Xm35LO3KSUFZoqirm6OJhEYFI55pi+W5YJr7d7XV+leyYEgkgaad1wscwnF8FqHG8k1IXFzZGXI16Hsu3hThPQsdQxOA3kN9yd9StZ4WppslzTjuiTPisTZp/mtKNtTISNWkHcHSy2Am5mrX377WV185jjDd3W6LWOmxzfk5nnnFeCF/MEmQSB3clqZH/AIm/JqxHfVztypLlxs3UrpWkxfRh68/s0bGC4AXJ7lTzEtYGN26rDQI9Bq47lbXPZbxhGKpIzcnLsiDW2uDY+SOYX6Oc5wHQ7KUWHTVbAE+SPHBu2iVOSVWVn4dBUzsmnZmlj+F17EK6KaKUsLmNPLN2k/dWAMo/UqlVz57sDrMG/mss04Yo7mi+NTm1FMnFJzKpzmVEbr9BqVVxfAJaynyx1ToyOmXQrjYhiLqZzW09zUH920dPMr09FiZ9wY6uaGzW8WXYnyXJilhb35FTZ0zhlglsdo4lDhzKCG8tsw0t3XXwvK7mSvAFtiei5lTUGaVzyLNvoFTnxF0cfKjJ16DquWLW5vs6HFyVM62K4s1jTFE4DuV59jZMTnBIIgYdB3SChlq3h85sy/w912G8unjs0BUyZa65ZeMVFUh4aaKwtddfAsLL3CtqW+cbT+pWuE4O6d7amsbZm7Iz18yvSgALs0ek/wC5M49RqP8ASBEadrnhx1ANwFI5ocLOAI81XqJZWm0eX59SrI213XqnAQy0sT4y0NaPkuVDgrHSOe4jLe1iLrtnQHqq1I6QmUSC3iuCPNRQKc2FxMZdrG2G5boQpMPPu8hp82aN2rCeh6hXKhjpI8rTa++tlGKW1PGy/jZs7zQFlRRskbK4ufdh2B6KB1ZI0ECElw/i0SlrTNKYpI8jwLixuCpBdREQBYOgRc7Fqrkxcph8b9/IKk5qEdzLRi5Okc3Ean3mpJBuxujf6qoiLx5ScnbPUjFRVIIiKCwREQBERAdWBlzmKnldlasxtytCgrH5Yz6L2zyDmzSGSQm+g2VmlLo6SeQbaAKkunHH/wA12HW5XnYm55HI7siUIKJzERFynSEREBJBM6CZsjNx+a9NBM2eJsjDo4Lyq6GF1fIl5bz9m/8AIrp0+Xa9r6Zz6jHuW5dnfRYRemeeZREQBERAYVHEsNjro+jZW/C/+R8lfWLKsoqSpkxk4u0eHmhfTTGGpYQR9D6KWKjinHglA/hcLr1lXRw1kXLnYHDoeo9F5fEMKqcPcZIi6WEfeG7fULyc2mlj5StHoYs6nw3TMOoXQ7xRuHdqjMUZ3pfowFYhxORos+z2reSpik1ALSuVqD6N/kuzDYoh/iXD/wAtStBI8EMjh5NVCSryggOcEhxN0XwvNln6cb5bLcl6QTAa0z7Ku5jnHWld9FZixth0eFZbi1ORq6y3jjx/Zm3NeCsLygNkppHWGlxsqxoJ3Su5cZAvoCbWXSOLU46qMYg0vL2NIv1Ku1BctkJz8I4E1ZFDiElDUMm95Fg22oNxddmkpDEGTOmyOI+G2voVSxKKlrpo55rsmi+GRhsbdlDUY7SUzQ3mZi0WAbqVXdFv/GrL7ZNcnefKOihklAF3EALyc3ENRMSKePKO51KhaK6rdd5ebqXCb5m6JWNI9LLiMEezwT5Ku7FA/RjbqjT4W7Qyn5K+yCOEaADzWLlCP7LbUbsqalw3yt81sZi34nFxUD5egVyiwmeqIdIeTGertz6BTDfkdRRWW2CuRVfO+Q2F9dgFfpcGqJvFORAz+Lf/AILrx4fDRwn3Zv2v+UdqVXdDOTq0k+q9DFoV3kdnJPVeIFqCKhoABA0STbZjqb+qxVz1Mbh9qRfoFimpXtPMePh1De6rSGWWQlzXF3ay74xUVUUcbbbtmr5ZJPje53qVaw90YBicAL6hIKB79ZDlHbqrcVFFE8OFy4KaIPPVmIUTMTkpDO1kjLXB79lvAwVB+ys7Ui99NFWxbhR82NMxCBzTd13sd1XcpmQUMYDy3P1awbLJb/U56NpLHsVdnPkp3MdZ5t6LIFhZosrNTN7xJdrbALQRPOzHfRbGJCGWK2tdSuhe0Xc0haoDAaB6rYC+y10C1qTPBGHxtF/Poqzmoptlox3OiSopiWgvmEY6jutKSipqhjiyVk1jY5TsVyKhs9UftprNO4BspqIwYfrG51+oboD6915j1MJT3SidvoSjGk+Tc4XDSVkkkUWaV+tyb2WZYzG3M/U9z/JZlxdx0jaB5qaipPf6aWSVz+YDYCxCycY5cj2GlyxxW84k4fKbA5WrWGCKI3IzO7ldaHA6+Y6sETe7z/Jdak4bgjs6pe6Z3YaNVYabLPiqReWfHHycGmiqax+SmiLrbnoPUr0OG4FHTOEtSRNMNQPutXXjiZEwMjaGNGwAsFtZehh0cMfL5ZxZdTKfC4Qssoi7TlMZRe9hdatZle52Ym/Q9FuiALCyiAikaGu5tiXAWASCUTRh9rdCOxUhAIsdlhrQ0WaLBAaPhDjmBsStYqYMlMhN3WsPJTogCIsXQEc8rYYnSPNmtXmZ5nTzOkfufyVzFKvnzcth+zYfqVz15mpy7ntXSO/Bj2rc+wiIuY6QiIgCIiAIiID0OwXOr3eGy6DzZq49ZJmky9l6+WW2DZ5eNbpJFddqmGagZ6Lirt0Yy0bAey49J+TOrU/ijjzNySuHmtFZrm5Zr9wqywyx2zaNsct0EwiIszQIiIDuYVWc1nJkPjaND3C6QXk2PdG9r2Gzmm4K9HRVbaqHNs8aOHZejps25bX2cGfFte5dFpFhZXWcwREQBERAFgi6yiA4mJYBFUEyUxEMp3H3Xf0Xm6mnno5Mk8ZYeh6H0K98VHNDHOwslY17D0cLrizaOGTlcM6sWqlDh8o+fuyu3CgfRtf8LiCvWVnDUbyXUkhiP4Xahcaowqupj4oHOaPvR+ILzp6fLj8HdDPjn0ziuoqhvwvv6hQmGtafhB+a67Ziw2cLHsVM2Zh3ssfVku0bHEaa5vwxMB7rYtxKTd4b6Bd0Pj7BYMkQ6BR630gcIYTNN+/nkf5XsFagwOBtvAD6rpGoY3YBRurOyPNkfAo2ioYYho1oUpMbBpYKBjamoNoYZH+jSr0GAV05BkyQt/iNz9AkcOTJ0jOU4x/JlJ9QPurWCCetkDYml3cnQD5r0tLw5SxWMxdO4d9B9F1mwxtYGNY0MGwA0Xdi/wCPfczmnq4riCOLQYVDSWe60s34nDQegXSu0/E1TGBnS49CtDTuHwuHzXqQhGCqKOGU3N3JmmVp2dZMrhsQUMTx936LUtkH3XfRWKm7XOB1CkFj0UF5R9130TNL+B30QFi9ljNqoLzHaNx+SZKg7Mt6lSQbTTNiYXvNhsuRFG6eQ5Rpe5cdgut7tK743Nt2Oq3FISLOk07AWUUSVo2xxttGB5uKjqSJYjZxuzW3dWJ/d6ewe10jzs26jDxJKHMiMbbWIIQFWCtAYYntMmmlt1CyN87zkGVt9SRsurNRta37Mlo6gLFK6SKUQv8AE1w0NtkBFHRwtboTI/uRoFP7q2UgSNuwbg9VcWUogonCaE707PzWW4VQt2po/mLq6ir6cPotvl9kLKaGP4Io2+jQFLZZRWSS6K3ZiyLKKQEREAREQBERAEREAREQBEWEAXNxWs5TOTGftHDUjoFZraptLDmOrz8I7rzj3ukeXvN3ONyVyajNtW1dnTgxbnufRqivw0o5bXEXcRdaz0pOoFljHStxuzV6lJ1RSRZIsbHcLC5GqdHUnYREQBERAEREB1qucMaVyiSSSdypKiQySnsNAol1ajLue1dI58GPatz7JqaEzShvQaldm2VtlVwtreSXdSVZmeAunTwUYX9nNnm5Sr6OfXi4B7FUVaq5AfD1VVcuqredOn/AIiLmOgIiIApqad9NMJGfMdwoURNp2iGk1TPVU87J4hIw3B/JSLzVHVvpZbjVh+JvdeiikbLGHsN2nZerhyrIv2eblxOD/RIiLDnBrS5xsALkrcyMoqFHjOG18xho62CeQDNlY8E2V172xsc97g1jQSSdgEBsio0OL4fiEro6KsgqHtGYtjfcgd1eQBERAYRcrGeIsNwR8TMQmdGZQSyzC69t9lV4j4ppuH4aaSWGSc1NyxrNNBa519QgO1NTQzj7WJj/AO026pSYFh8mvu+U/wALiFcoqqOtooaqG/LmYHtvvYhTqkscZdospyj0zinhuiJ0Mw/00HDdCNzMfV67SKnt8X/ii/rZP/JnLZgOHM/xGb+04lWosPpIvgpom+eUK0issUF0irySfbNQLbBZWVzq/G8Nw2ZsVdWwwSObmDXmxI7rQodFFUoMRpMShM1FURzxh2UuYbgHsqddxLg2H1BgqsQhjlbuy5JHrbZAddFXo62mr6ds9JPHPE7ZzDcLn0XEmGV+KSYdTzOdVRlwc0sIAymx1QHYRYWUAREQBYWUQBERAcqvikbVc0AuY4AXHQhT0zHPILgQ0a69VtilfHheHT1szXOjhbmcG7lVuH8cp8fon1VLHJGxkhjIkAvcAHp6oDqLUMaHZrardYQGURYQGUWEQGURYQGURea4j4wpOHq2KmqKeaV0kfMBjtYC5HU+SA9Ki43D3EEGP0MtVTwyRNjeWESWuTa/ReVd7UIWuLf2XJobfvh/RAfQ0XmuFeK2cSSVLGUjqfkBpuX5r3v5eSiwvi/9ocTz4P7ny+U6RvN5l75T2sgPVIsLKAIiIAiIgMKKedkERkebAfmtpZGxRue82aN152sq3VUtzowfC3ssM2VY1+zXFic3+jSpnfUzGR/yHYKFEXlttu2ekkkqR06Srj5QbIcrmi2vVa1Ncwi0fiPfouci39zPbRj7eO6zJNzcrCyASQBuVYFNprqq48MsnJbJlWPgrIsyMdEdfh/RYVcmN43TLY5qatBERZ9lwpoYHSnbRSU9K6QguGnZdENbE2w3Xbh0/wDtM48uf/WJxXCzj6rC3k+MrRck1Umjqg7imTQVD4CcuoO4UklY540FlVRXjmnFUmUlijJ20ZJJNzusIizbbds0SSVIIit09E+ZuZxytO2mpUxg5uokSkoq2VEVyakYwHK91x3VNWnjlD8iIZIz6CIizLhW6GtdSyW3jO4/mFURWjJxdorKKkqZ6uKRsrA9hDmnYha1f/Q5/wDw3fouDRVr6WTq6M7t/mu1NKyaglex2Zpjd+hXqYsyyL9nnZcTg/0fCuHsSdhGM0tcL5I3gPt1adCPpdfT/aFjDaThsQwPBkrrMYR1ZuT9LD5rwnDGFftbBschazNNHHHLF3zNLtPmLhWOGW1HEuPYXT1fip8PiH91puL+psPktjIueyrTHa2+lqY/7zV0q7jXF8RxaWj4co2ytiJ8RZmc4Dr2AVD2btL+I8UbtmgeL/6YXnqGnjw7F6qkxStrMOLLtL4GkkkHqB0KA97wvxjVVmKnCcZpxBV6hjmtLbuH3SDsVX4g41rxjTsLwGnbNKx2Rzy3OXOG4A7DuuNwpR0OIcUQy0s2J1EkD+a6aZrbWG2Y3vrsoaOrHCnHtVJiMTzG50gzAXOVxuHDugKPF+KYnXzUsOMUfu1VTtcDYWDwbWNvl0Xr/aDW+54ThV6WmqA++k8ea1mjbVeW47x6lx6vp30TXmGBhbzHNtmJN9l3vadrhODf6X+61AdXiTiGtwfhfCaujbC2SdrA5pZ4QCy9gOi60eKVLuDBihye8+5874fDmy327LzHGtPJLwFg8rGkthbEX26Ax2v9VVj4xw8cD/s3LMa33Y04YGaHS179raoDu8I8R1+MYLiVVV8rm098mRlh8N9VwMM414lxKOaGjooqqpFnBzI9GN63F+uisezv/qxjfz/3CnsmGmKXH+S/+5AaUHtAxVjpqKsw8T198kLWNLTnvazh/RBxtj2E4nHFjtExkL7Et5eVwbfdpub2UFOP/wC3Xaac93/01Y9rI+0wu34ZP/tQH0lrg9oc03BFwV432hYFSVWGVOLSOl95pog1gDvDbN1HzK9ZQf8AQKf/AMJv6Bcjjj/qhiX9gf7wQHmeCat1BwDilUz44XyOb65RZczgjhak4hpKysxF8ziJeW3I+xvYEuPfddXgejNfwJilI34pnyMb6lot+a43CHFMXDEFZQ4hTTlxkzgMAuHWsQb+gQFz2fSS4bxZX4TnLofGLHq5jrA/RVeG6qGi49xWpqHhkMXvDnOPQZlc9nkE+IcTV+MvjLYjn16Znm9h6BecdhNRjHE2LU9Kftmvmka38dnfCgPYYFxPjvEeNvjomQQUDHZnudHmLGdBe+rivoAXzz2bY3TxROwaeJtPUh5cxxFuaeoP8QX0NAZREQBERAEREBwuNP8AqliX/hfzC43st/6uT/8AzTv91q7XGTXP4UxJrQXOMWgAuTqF4DhXiibh7DZKR2FVE5fKZMwu3cAW28kB1uOsexGTGocCwuR0T3ZQ9zDZz3O2F+gXHx/D+JOHcMYZ8UfLTTPAJjlcSx/a5177K9xjh+IRYtR8S0ED3B7I5XNDcxjeANx2tZUOJMfxbiTCWD9mOgpIpAXuaC7M+xtbTbdAdyqrKlvsphqRUTCoOX7UPOb95bfdUuD4+IcUdh9S6pccNpZyXZ5Tmk11v3t5qzVxSH2SQxiN/M8Phym/7zsu57O43M4ThZIxzTzJLhwsfiQHkH12NcZ8QzU+H1bqaliuWgPLWtYDa5tqSVTxiXH8Jxuloa/EZnlmTI9kjrPYXfn1GqsNbifAvEU8sdI6ellu1pscsjL3Go2IVDiCur8Tx+irK+lNLzAzkxG9wwO3113ugPV+0LiOso62HCsPm93c9ofLKDY6mwF+g6krzdRWYpw5LBU02Pw1+Y+OOOcyC/ZwPTzXf9ouAVU9fDitJTmpjawMmjaLkWNwbDWx2XAhd+1aqKDC+FaZjjo8ycxwB7k3FggPrOFVrcSwumrGtyieMPt2v0XH44o6aXhuvqZKeJ88cNmSOaC5uo2K7eHUraKggpmNYwRMDbMBDR3tfouZxk1z+FMSa1pc4xaAC53CA4Hsu/6vVf8A8wf90Lx/DVRjFLVVkeEUDamaTV2ePNlAJ72HVez9mMUjMAq2va+NxqDbM233Rrque/iPifAcQmhxOiNdFsxzI8rT2ILR+RQHT4L4plxOtnw6vpoqesjBIMbcuaxsQR0IXkqHFIcG47xWtqNWxvqLNG7nXNh813eBsKxCo4iqsdrqd1OyTOWtc3KXOcegOtgFw4MDOMcaYpSzNkjbI+dzJMpsHXOU+YQHT4Tp8W4mxWXE62rqY6Fr8xYyRzWvd+EAdB1X00bL5lwhi9dw7iD8FxWGUU2cta8NJETu9/wlfTRsgMoiwgMrSWRsUZe8gNG5KxNKyGMve4NaF5+urX1T+rYxs3+ZWObMsa/ZrixOb/Qrq11U+wu2MbD+ZVREXlSk5O2elGKiqQWWtLnBo3JssLLSWuBBsRqFCq+Q/wBE8tI+Ntxqq6uS17pIsuQA91TW+Z43WwyxKaveSQECZmba67DWNsuGrEdXLGALhw81fBmUFUimbE5u0W6iEOuFzS0sOV24Vn36T8LVZppY6m4fGA4dQtpSx5/inyZRU8PyaOfHE+Q2aD6ro09G1li7fzVizIhsonSFx7BbY8MYdGc8sp9kpeGCzVHqTcrULYLUyOZO0tfYqJdStpuc3nQ+LuAuYdDZeXqItTbPRwSTgkYREWBsEREAXZZODSNydrLjLZr3NvlJF1thy+m+THLj3osTyEX7qqskkm5N1hTmy+o+BixbEERFgbBERAFPTVLqdx+9G7RzDsQoEUxk4u0Q4qSpnbwegwula+XDaWGAyAB+Rtjp0KnocJoMPkkko6SKB8vxuY2xcuFBPJTyB8brHr2K79HXR1TbfDIN2n+S9LDnU+H2eflwuHK6I6HBsOw+d81HRwwSvFnOY2xIvdYxDBcNxNwdXUUM7m6Bzm6/XdX0XSYFahw+kw6HlUVNFTsOpEbbX9e6jxDCMPxQNFdSRVGX4S9uo9CryIDlScOYNJDFE/DaYxxXDG5NBfdT12E0GIRxR1lJFOyL4A8XDfRXkQEIpoRSim5TDAG5OWRduXa1lz4OG8Gp3SGLDaZpkaWuszcHceS6yICjR4TQUMEsNJSRQxS/G1gsHaW1WcPwmgwzP7jSxU/MtmyC2a21/qrqICgMGw4Yj7+KOEVd83Oy+K9rb+iziGEUGJlhrqSKoMdw3OL2vuryIDVjGxsaxgAa0WAHQKOqpYKynfT1MTZYX6OY4aFTIgKtBh9Jh0JhoqeOCMuzFrBYE91DWYJhldLzaugpppPxPjBP1XQRARQU8NNC2KCJkUbdmsbYD5KrTYNh1LWvq6ejhjqX3zSNbYm+6vogOXLw9hE1WaqTD6d05dnMmXXN39V01lEAREQBERAEREBhLLKIDCWWUQGLJZZRAfO8WHF2C43LUUbqjEKJziWMN5GgHoWjUW7qlRYPjvE/EcGI4xSupYIi0nM0s8LTcNaDrqeq+oIgCWWUQBYWUQGEWUQGEWUQGLLKLCAKKoqI6eMvkNh0HUqGtro6VtvikOzVwZ55KiTPI65/ILmzZ1Dhdm+LC58vo3q6uSqku7Ro+FvZV0RebKTk7Z6CSiqQREUEhERAEREAREQBdDDm2Y53cqi1pc4AbldaBnLhA7Ls0sHe45dTJVtNJXXflQBa2u8lSNC7ziMgLDjYLZaHUoCOin5T8rvgd+StzUcU3iygk9QuWDYq3R1ZjdyZDp90lUk49SLRT7iZ/Z0d/v8A1WDQRAbP+q6AeCtZHCyr6OP6LerP7ONPS8u5YSR2O6rLp1DhYrmndceoxRhTidWDI5cMwiIuU6QiIgCIiAIiIAiIgCy1xa4OaSCNiFhEB2aHFA60dQbO6P6H1XVvpovIq5SYhLTWafHH+E9PRduLU1xM5MunvmB6JZUFPUxVDM0br9x1CmXcmmrRxtNcMyiwsqSAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIsKGoqYqZmaR1uwG5UNpK2Sk3wiYmw1XKrcUDbx0+rur+g9FSq8QlqbtHgj/CDv6qmuDLqb4gdmLT+ZmXOLnFziSTuSsIi4zrCIiAIiIAiIgCIiALIBJsN1hXaSEAZ3LXDj9SVGWXJsVktLAGC7lK+TNo3ZaPfmNh8IQL1UklSPObbdsyApBstGi5Uh2UkGjijRcrQ7qRqAoBaytzMzdWqR8bo3Frgg/JUnBTi4loS2yTNYquSMWPiH5qY1rCOoVOSMsPkditF56zZMfxZ3PFjmrRNNNn0GyhRFlPJKbtmkIKCpBERULhFkalXo4IcoDhmPU3WuPFLJ0ZzyKHZQRTVEPKdpq07FQqkouLployUlaCIiqWCIiAIiIAiIgNo3ujeHMcWuHULrUmLA2bUCx/GNvmuOi0hllDoznjjPs9axzXtDmkEHYhZXl4KmWnN43kDt0K69LisUtmyjlu79Cu/HqYy4fBxTwSjyuUdFZWoIIuDcFbLpMAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIsLBIAuSAEBlYe5rGlziABuSufVYrFFdsI5ju/RcioqZah15XXHQDYLmyamMeFyzeGCUuXwjpVeLAXbTi5/GdvkuTJI+V5dI4ucepWqLgyZZTfJ2wxxh0ERFmaBERAEREAWxa4C5BAWGmzgSLgFdCeaB0JLXAkjZbYscZJ7nRjknKLW1Wc5FNTmISfa/DbTRRyZeY7J8N9FRxW3dZpue6qNhE9zMwGijv02PZdKjkjdCGkjMNCCk0NO92rgD6rqWCEoJp8nL60oyaaKETc8gCul1hlC3bTtibduvmoCfGV0YsfpxoxyZN7slatwo2qRq2MiRosEedFgFavOqAx1W17BaBZJQFl7oJXZXEXWhoWbtJ+q5gV2nqywZXm46FAbSUoDbHULmSsMbyF1palpboQubMc9yufPjUo35N8M3GVeCBEReYegEREAVmGW481WRb4cvp8Poxy4t/RfnLXQm/ZUFsMzja91mSJ0ds2x6hWzy9T5RXBXDH0/jJmiIi5joCIiAIiIAiIgCIiAIiICeCqmpz9m8gdjqF1KfF43ACdpYe41C4iLWGacOmZTxRn2erjkZI3MxwcO4K3XlI5HxOzRuLT3BV+HF5WWErRIO40K7IaqL/Lg5ZaaS/Hk7qKlDiVNLYZ8juztFbBBFwbhdMZxl0zncXHtGyLCyrEBERAEREAREQBERAEREAREQBERAEREARFhAZRakgC5IA81UmxKni0z53dm6qspKPbJUW+kXVpJIyNuZ7g0dyVxZsXlfcRNEY7nUqhJI+V2aRxce5K5p6qK/Hk6IaaT/Lg7FRi8bLiBuc9zoFy56qaoP2jyR2GgUCLjnmnPtnVDFGHQREWRqEREAREQBERAEREAREQBEJtuilxa7ITT6CblFsz4h6qYq2kJOlZ0qe/KDSdtFFI3K+/dTw6O9VtOwZLr2DySsFLs1RtFyt3bgKQbt+G6jcdVI7wsUF9UBuCsErAKywXKArEFriD0WQrdbTkOztHqqYQArFriy2KwqtEoropJW2OYbFRryZx2SaPUhLdGwiIqFgiIgMtdlN7XW8kpkAFtFGi1WaShsMnii5bwiIsjUIiIAiIgCIiAIiIAiIgCIiAIiIApI5pYjeORzfQqNFKbXRDSfZ0YsXnZo8NkH0Ktx4xC742vZ+YXDRbR1GSPkylgg/B6eOsp5fgmafU2UwIIuDf0Xkls2R7D4XOb6FbLVvyjF6X6Z6y6LzbK+qZtMT66qZuL1LfiDHfKy1Wqh5M3ppnfRcUY0/70Lfk5SNxpv3oXfJwV1qMf2V9Cf0dZFyxjMXWOT8ln9swfgk+gVvXx/ZX0p/R00XNOMwfgk+gWpxmH/Jyfknr4/selP6Ooi5Jxpv3YXfMhRnGn9IWj1cqvUY/st6E/o7SwuC7F6k7BjfldQvr6p+8zh6aKj1UF0WWmmz0ZIGpNgoZKynj+KZo8gbrzT5HvPjc53qbrVZPVvwjRaX7Z3JMYhb8DXv/ACVSXF53/AGxj6lc5FjLUZJeTaOCC8Ekk0spvJI53qVGiLBtvs1SS6CIiEhERAEREAREQBERAEREAREQBWaSISOc49FWU9LPyXnN8J3WuFpTW4zypuDosTQ6bKi6IsJLRcdl0n1EZbcOFlVdUNDtG3C9DJKDjUmcMIzv4orDXYK1HHlbqp2hj2hwba6je4DQKuPDGHKJyZZT4ZPA8EhvUKWd1o7KpHcOB81PUG8gHYLoMTRgsCUZ4n3R2jbLMWgJQGJndFEDqsSOuVhu6AkGqlb4QtGjRbOOiA6kjA9pBXHqYTE+42K7arVcQfGUBx1grOxseib7IALEZTsVA9pa6yuNpZSL2A9Sq9Q0sIDhYrmz490b8o3w5NsqIURTxU5eLl1guCEJTdI7pTjHsgRTSwGMXBzBQqJQcHTEZKStBTU7Gufd2oHTuoVvG/I/1WmBJzSZTM2ocFydrDHbKARtYKgrD3l40UBFjZbaqK4aMdNJ8pmERFxnWERYe7IxzvwglErdAOcGjxED1Nljmx/5Rn94LzUFPV41WlrSCbFxc42axvf0V0YVhjNH41DmG+WFxH1Xvf8ASIRS35Of0rKRmm6OxzGfjZ/eCyCHbEH0K5AwzDSbMxmLMds0TgPqoJ6epwisDXkB1swLTdr2/wBFjL/jI18J8/0dUMUZ8J8/0d9FhrszGuHUXWV4744MAijnnhp2Z55WRM7vcAFXOI001NM6kqYZXsY5wDXA6gdlZRb8EOSRcReclmx2HhqPG3VVGYH5TyxEc2rrei7VNX0lUcsFTDK+2rWvBK0yYJQ7M4ZYz6LKKGoq6elaHVE8cQO2dwF1B+18N/z+m/1gWSjJ9I03JeS6i0hljnjEkL2yMds5puCt1BIRQVFZTUpaKioihLhcZ3WuoTjGGj/t9N/rApUZPpEOSXkuotY5GSsD43New7Oabgqs/FKCOTlvradr+xkCKLfgNpFtFBNW0tOxj5qiKNr/AIS5wAd6KE4xho/7fTf6wKdsn4G5fZdRV5K+kjibK+qhbG7ZxeLFb09TBUsz080cre7HAqNr7oWiVEWssrIY3SSvaxjRcucbAKCTZFS/a+Hf59Tf6wKSfEKOmkyT1UMT7Xs94BsrbZfRG5fZZRU/2rh5YXitp8o3PMClgraWpa50FRFK1ouS14Ngo2teBuX2ToqX7Xw7/P6b/WBSU9fR1TyynqoZXD7rHglTtl9DcvssoiKpIRYc5rGlznBrRuSbAKrHidBLJy46ync/8IkF1KTfRDaXZbRRzzw07M88rIm93uACgZidDJG98VXA8MBJs8aIot9IOSXktovPtxbGH4K7Fm4bAaJtyX87XQ2233Vqnrq/F5zBglPFKY2tMs8rrRsJGw7lbe2yXVGXrw7s6yLl1jsawQNmxeCmlo3ODXTUxP2d9rg9FmlmxfGi9+DU0ApGOLRUVLiA8jfKAntsl1Q9eFXZ00XKqK6vwaZkePU0cUcl8lRA4uYSOh7Fb0cfEWLwiqoaekpqV+sfvLiXPHew2RabJdUPXhVnSRc6nrKuHEDh2K07YKvLnY5huyVvUgrWSpxCuxR1BgscEkkLM08kxORnYXHVV9Ge7b5J9WO3cdNFyqOfE4sanw7ExTB8cIkvDe2p811VWcHB0y8JKatBERULBEWQ0u2BKlJvhENpcswtmtzOATI+/wAKtU0Njcrox6eTl8lwYZM8UviyYAMhCrjxOv0W8787srdgssYTo1eicBltg4KUnM4uPVQvheNSVIDZikGj3Xcticsaib4pFtUOytsgISblbs3UTVI02QFgIStA7RLoDtLDxmaVkhDoNUBw6iMxynTQq5RU20jxqdgeilfVQMcc1ifS6CrY4eEhASy2aFyq2zm+YOiszTgg6rm1EhcRba+qpk/FlofkivI/IAe5srUEml1TqQTESNwbpC/wrn0348G+o/IvSyXaVWWryXENWyz1TXCL6ZdsIRdEXGm1yjravhksBu/KVJUxZbPG3VVwbEHsrkjr0tz1C9CMlmxtPs4ZR9KaaKSIi887gtJ/3En9k/ot1pL+6f8A2Spi6aJXZzcMaWYBixbo4iNt/IlYpqSjo8PjrK+J87pyRFC12UWG5JU+HNvgeKNGptGfzWYTTVuGw0lXKaaSnJ5chbdpB6Fe77t+X2abNsn9XzX1RvA+lZSzYhhtOGPiGSWCbxizvvAqtiXiwHCnO1daQX8rqSeSlocOmpKSY1MlQRzJA2zQB0C1xEWwDCgdDaQ28rq6zW7N8cUpxl++L7qmX4f3Ef8AZH6LdaQ/uY/7I/Rbr5+XZyS7ZysHpKKtoK3iPGo/eYYnPEMLhdrWN022JJXNxXEuFsRw2Qx0j8KxJgPL5cVtegOXSxXRwquo8LpKzAMczRUU7nmGexyua7cXGxBXOxOl4TosNkioA/FsReDkeJHHL5m1hYL2Y1tVdHkSu3fZ36OShh9mtFLicLp6ZjGuMTd3nPoPqq9VR4TjfC1RiuGUIw+ro8xaWNDHNczUg23Fly6nF8Pk9m9Nh7KuI1jcl4gfFo+/6KbBsYw+l4Rxmjnq4o6mSSfJG46m4sFJUs4RSUFPw6/iXH4hWzTeJrXNzBovZrWtOlyujg1Lw/i9HXVMODxQTMJbLDLELscG6W6D5Lj8P4vhtTww3A+ICaVuS8UjrtD2Xu0h3Qgrp4Ri3DGE0dbSUuJZ3OJc+aZxJlcR0NtbIv0S/wBlHhb/AKvUno7/AHiuuvKcPY5BBhENPyKuV8Vw4xRFwFySup/ygh/zPEP/AE5XmZMU3NtI9CGSCilZI+mgq+MsIhqYWTROimux7bg6HorFRLwxh3Epw12DRvlmexj5eU0sjc4eEAdPkuRTY7Rf8sMNqJ3SUsUEcgeZ25LXabKljGIUlRxi+thqI30oq6VxlB8NgNT8rFd2JOONJnHlalNtHTxTA303FcOCYdM6nocRYJXsafgAvmy9r2V+rl4YwfEG4Q/BmSNGRss5jDshdtcnVUOIMeik4xw7EMIe2uFNAeY2PW7bnMPWxV2qm4RxbEGYtPiRikGV0kDnFuct2zNtfTyWtLwZ2/JSxDh+DDeNMIpGN5mGVMjntp5PE1ht4hr02XRxSXhnBsdbTS4NHJJK1nMeImlkQJsND+dlysQ4hixDjDCcQdeDC6d5bHLKMufTxOt22VLivEKSux+eppahksAjgBe06aP1QHfxuj4b4XrWVEuFuqX1NyyAAFkYb8RAOnVaY9RUWGyYVjOExCniq5GxSRsGVr2vFwbdCFzOPsVoMUqqE0NVHUCOGcPyHa7Rb9FLj+OYbLwrgsMNXHLNTyQOkjYfE0NbqokrVExdNM760miZPBJFILskaWuHkVyhxDTuGZtHXkHUEU5Q8QwAEmjrwB//AJyvKWHIvB6Pqwfkzw/g9FiXD2JYXLR04xKkL4hLyxnN9WOv+Si4dpaeLhzEMexymiqHjwRtmYHWyDKAL93afJS4NiEbOKsPrKUOMOKRuiewjW7dnW+Su8XmOtr6HAIAGQC9TUBnQa2HzJJXpxktu6RwSi921FLhTh6iZw+caq8P/aFRNd7IGsBAF7ABu31VvF8Bpq3AZsTosNkwevp2OdkDQ3MANQQNCCOqhwXFqegwp/D+MVMuHvjuIaphLQ5l7gh3QqtjeI0Awx9DhWI1+KVsjCC/3h5Y1vUu6bdFdNNWUpp0WMNocEg9n9NiOI4fFNlbme5rBnec5AF/oFJNR4Pj3DFTiOG0LcOq6PMWljQxzXMF7G24IXKmxfD3ezKPDxVxGsDW/Y38X7y/6KfAcXw+j4axqkqauKKollmyRuOrrtsPzQg6mG1Bq8Npqh3xSxhzvXqrK8zguOwRYTTRCnq5DEwMc6OEuF/VXv8AlBD/AJniH/pyvKlhnudI9KOWNK2TQULeIOJH0NS53uNFG2SSMG3Ne7YHyXUZhOFYhUTYfLw0+lhYCGVPKawOtpoRqPK685hnEMOH8R1FcIKgUcsbY6rNHZ0Th8Lrdl2J8U4fhdNVniCuqRJqymjqX6E9ABY/VeliVQSOHK7m2U+HcCpZcbxOmxN/7Qlw4iOnhldpkIuDbr0CrcSswo4PKavAKjCa0A8qSKIZL9AXN0IKpYaMOGLT1PEUVXSGqPMpqgzPu0bZXOGt7W3Xcr8Yw2m4dqcLpsSlxqpqQ5kTXHORfa57DdXTVcFGnfJewzEaGP2dx1klC19JFFlfBYWeQ7KT21Oq8hHi2K4dRVkVDBDRw107zFC5h5xDtslugFgF18Dr8Mj4Ym4cx2Z1FI0ua69xmaXZgQbW3WnClZw5hlTV1NXXtkqWTujp5JcziIh8JGml076HXZbxEvwL2cOo8UmMlZUNLWsc7MQSb2/0QpMZlmw3g3A6WhnfTCodFG+WM2cAW3OvmVz+JX8MYqKmtfjc01WI3cmO5DQbaNAy7XW2FYzg+I8M02E8RF9O6FrTHI64DgPhc1w620UkImrJ5MW9lTqitcZJ4zpI7clsmUH6Lmiqx7H8QoMKjnhYynyyPfSZmiJthbMe4HTupeKcaw93DYwfAGvkpIrGWUA5WtBva53JK7mFYvwthmECjo8SZTOe3xytaS8utqbkbqCTm8c4mZOJcNpcOaJq2AOFm9HP0A+W661EGcL/ALMwqL7avr5g+plsTp943/ILys4wjDcZw6r4erXYjWumOZs7zY3Frk2HUr0TeL8QpMRpIsYpaKlpp3EOlbITlAH/AOlFpP8AZNNr9FbF6mOm4/mEuYc+njjYQ24Ll01ycZxYY/xHRwYeYJqSic2czNcbm+hHyXWXn6tLedumb2hERcp0m8bDI8NHzV9sbWtAAUMDeWy53KmY7MV6WDHsjb7Z5+bJulS6GQLSR+RpU9lUqxZpXQYGse1+6nifkddV4j4QpVILT5WubYKCQ2astFgopjogNqYXJKhqHZpLKxF4ICVT3eSoBu0aLZAsFSDZpUiiC2c6zUB3c91DVyZISfJTWaFTxBpdEbIDl6nU7ndDoiO2UAjcVi2ZpCLQOyuQkbixHqo4oy0uaNgVaDGv1G6kZEAD5rnx4nCTfg2yZFOKXkqAakrK2c0tcQVquDI25Ns7caSiqCIioXCtyA+5tVRX6Yh8GU9rLq0yvcv0c2odUygi3lYY3kdOi0XNKLi6Z0JqStBYcMzSO4ssooJMYbG6jcXNs4OGVzTs4K2YsPO9G4eQeq17bJc9ys/8q6lx+0RK5PdfJiojw2MZv2e95HQymy49bPNiVW27A0AZGMbsxq7B131WA1rdmgegXTjz5Eqkb4sihz2/7DW5Wtb2FllEWRiayRslYWyMa9p6OAIWkVLTwgiKCKMO0IawC6lRTbIpFf3Cj/zSn/1Tf6IaGkJJNJTknf7Jv9FYRNz+xtX0RPpoHxtjfBE6NuzSwED0C09wo/8ANKf/AFTf6Kwibn9ikcjC5cYwOprxQ4fTSwVExkbmly2GwFguj/yi4j/+E0f/AKgqZF0LVTSowemgzjx09XiGO1GIYrRU7A+FrGtDhIAQfNdD3GksR7pT2PTlN/orCLKeWU3bNYY4xVIhjpaeF4fFTwxvH3msAP1Cw+jpXvzvpoXP/EYwSp0VNz+y1Ijlp4Zg0SwxyBuwcwG3otPcaQAj3Wnsdxym6/kp0Tc/sUiuKGkG1JTj/wApv9FTxbCoqjC6iKlpYBM9tmEMa3W/ey6iKVOSd2Q4pqipTY5xFT00ULcLoyI2BgJqN7Cy2mx7iKWF8ZwqjAe0tv7wdLqyi6PdzMPbQPJcL1UmC4iZ8Qw2undBFyYOTFcNuSXHVdnCGzVFRW4pVxujqKyQkNeLFkY0aF1EUZNQ5x21RaGBRlus0lijmZlljZI3s9oI/NYip4YWFkUMcbTuGtABUiLnt9G1Ir+4Uf8AmlP/AKpv9Fn3GjLrmkpySbkmJuv5KdE3P7FL6ORg1TjmBw1FNS4fSyxSTvlaXTZbA9LD0XR/5RcR/wDwmj/9QVMi6fdTMPbQOXh0Na/FMSra+COF1WWkMY/MNBZXmUdNHJnZTQtf+JsYBUyLCeSUnbNYwUVSNZGMlaWyMa9p3DhcLSGmp4CTDBFETuWMAUqKlvotSNJYYphaWKOQD8bQf1WjaOlaPDTQN9I2/wBFMim2KRF7rT/5vD/qwtnQxOYGOijc0bNLQQFuiWxSNOTHy+Xy2ZPw5Rb6LX3an/yEP+rClRLYpEYp4GuDmwxAjYhguElp4Z7c6KOS22dodb6qREtikRRU0ELiYYIoyRYljAD+SlRFF32TQUsEeeTXYbqMAuNhuujBGIo9d+q6NPj3yt9IwzZNsaXZpKLBaxuANyVFUzZnWbsFXXTk1Cg6XJzwwOStnVDwVDVC7bhVad5bJboeitTkCHVa45747jKcdkqKsR0UzTcqCPQKeNaFCa9mqB3ieAtnusFrCMz7qQSTHLEAq0YUlS67rLRuyA2WpKONlgalAbg6KCZ9zYLd7rCwWjWXNygL5rJTsQFapKkTExSgXOx7rmhZBLXBw0INwgLtTRWN2aeSpvY5ujgQuxDKKiFp69fVayQ6a7IDg7FaSBXqunDbuYLEbhUjqEBHHKWOV2KUOVB7ey1bI6MqpJ1JGB4137qq6Nzdxp3C0ZVbXKsx1DDuscmGOTnya48socFdFdMccguPyVaSJzD3C48mnlDlcnVDPGXBGpYJOW/yO6iRZQm4O0azipqmdCaESsuN+hVBzS11nCxVuln0yuUkrGSD+a78mNZVuj2cWPI8T2yOei2ewsNitV57Ti6Z3Jpq0ERFBIREQBERAERZG6FZvbFs3EfcrPLH4lJTsM8oYDbqT2CndUCJl6eIcsG3McL3K6I401bPmPf6iVycqX9FTlD8Sw6Ow0N1abWMkOWojaWn7zRYhRVDDBJlvmadWu7hHjjVoLX6iPyUrX9FZERc59QnasKnNitBTycuasgY8btL9Qq3EE8zKWGmpnZJ6yZsDXdr7lW65vC/CxpsPq8PbUSStzPldEHkC9szifPsurDp/UW5swy59jpInZLHJGJI5GOjIuHAgj6rmy8R4TFIWOrGkjS7Wkj6rn8WYQzBsSpYKOV1PheJuaJGA6MIcL27CxC9RXT02B1+G4VR4IyanqLNL2svbW3Y3PU3K1jpF5Zk9U/CK1PVU9TBz4JmSRfiB0Hr2VYY1hhk5YroM17fF/NcziLDMNpuMoaL3ltFh1SwS1TA/Ky4vp5Xt+a7VFPwxieKyYHSYVTyxMiLhPG1pabWvY79d+6laReWPdP6I3Yrh7XFrq6nDgbEGQaLR2NYY3evp/k8FUcBo8CosfrMCrqNtXUOqSIJHxhwDMt7E/VV8Yp6PCuPAIcIbU0sdOHOpoowQbgi9tt7J7SK7ZHuZfR1f23hf+f0/wDfWxxjDRE6X32AsabEh3VWeHqjBsdqamJvDsNMKcfaOkiZoe23qvM4TWcMwcQYnW1zAWCUikhEJcy3ew09E9pH7HuZfR3KXGsOq5RHBVxukOzTcE+l1JW4nRUBAqqmOJx1DSdfolUzD+IeEq2ulwsYbJTh5ieWhrgWi4IIA0Oy4PDeL4JQ4dJU1sLsRxmUk8t8RcSOgBIIGmt09pG+yfdOujtRY1hs0TpGVsOVnxXNrfIrH7cwv/P6f++q3GdDQ1nCtNi7KEUNY9zAIw0Nc65tlIG/db0eLYTJW0lA7hMNnnIY3PEwX7nbbqntIfZHuZfRZhxbD55BHFWQPedgHKF/EGFMl5ZrY77XFyPqq3FeG4fVcWYThFDDFTOdfnmFgb4Tr062B+q7FTWUGHV7sLh4cfPQQtAmmigz5SRfa2vnrdT7SP2PdS+gJ4nQc4SMMVs2fN4bd7rnjiHCTJk99jvtext9bLhYbT02L8UfsiifM3B3ymZ0TwWkAC5b6X0Xqp8Sw+OqqqCThqR+GQXiNRFTZhcb6Abed1VaReWS9U/CJmua9oc0hzSLgg3BVWpxOhpJDHUVUUbwL5XHVedwvGaehpcRZTuklp4pf8EY8eJwds1et4d4bpIacOxmGCqxSsvM9srQ4sGmgv2uLqkNLcmn0XlqKimuzn/tzC/8/p/7yftzC/8AP6f++vO4RJT0GOYs+bBXYjT818bGtjBbHZx77aL1+ET4FiWD1WJvwKmpqanv4nxsOawubWC09pD7M/cy+jWnqYaqLm08rZY7kZmm4upVx+FY3R4JGXNyiV7pGjs0nT9F2FwzioyaR2QdxTYREVSwREQBEVmCDMcz9uyvjxubpFJzUFbKy2axzzZoJVx8kTOl1Gau3wsC6HghD8pGCzTn+MSaKFsTbk69VBPUF3hZsopJnybmw8lGmTOlHbjEMLb3TCIpoI8zrrDFDfKjbJPZGzMEJzZisVMmd4YNgpqiURR5RuqbL6k7leqlXCPNbvlm97Kdhs26rDUqZzrNUkGHvubKeHwsuqbTdytONo1IK0r7yLYO0UJ1epGkBAbWJQusLBYzX2WWs7oDDW3NypALIBZEB0KiiAGeNUXNLTZwsutE8t8Dtio6qAOFwEBUpKjkvIPwn8l0nTAsve64xBBIPRMxA0JCAnqpM1wFzj4TZWAe60lZcXCgERF1jKOyNNjYrdSDTlA9FjlW20UqygI45XxHfRXo5GzN81UIBWjS6J1xsoJJ5Yi03AUKuse2ePzVR7HNedNFyZsCfyidOLNXEjDfiCti4UEMZdINNAr/ACwRdW0yajyRqGnLgiDQ9tnC4VWaIxO7g7FXw0DZRzgFhBV8uJTX7KY8rg/0c9EReWeiEREAREQBDsUWH/A70RGeX8Jf0WKN/wDgtYR8QYPpfVT00vvOHPpWZRK03AP3h5eaq4MC+eU3GURkG5sDfYLH7On0MEkUrhuI36hd0bpNI+Rhu2JpX2g+mqI4ua+JzWA2N+ilqnf4DRl3xEO+l1u9tWYg3EagRQDUtJBc7y0XPrKv3ia7RljaMrG9gqtKK4KyUcadefsl6Ig2CLjPsofijj468U9ThFW/93BWMc89h3U3HPD+JYpjMM9BBz4poBC52YWjIde58rK5V00VZTSU87c0cgsQqNOziGghFPRYvG6nbowTxZnNHa67tPmjGO2Ry58UnLdEk46FNU4rw9hU7xYyDmG9rNOVv52K6WNYpi+FYzh1BhWHc2hc1oJDC7rYi/3bDuuGeH2VLJ5MSqZKusnteoOhZbbL2VmKq4qpYxBFXUdQxosJJmHPbz7rdajG/Ji8E0uirxnhoHFtL+z6SOpq62J2eKQXFxoHm+2n6LrUWFP4PwiSWko5cRxWoFiYoyWg9vJo/NcT9k4wzFmYq3FWPrwCHPkjuBfSwHay6PvHFX/xal/9OP6KfXx92PRydUed4eMw41w6Osglir+dJJUGXQuLmkjTpp+q6/E1cMO4vxCpPxNoWBg7uJFlUdg+NHHG4v79SurQb5jGQNrbW7LSuwXGcQxVmIVVTRvnZlt4CGnLtcWUSy45KmyVjyJ3R152ScN8DNpx/wC88TdlPfO/f6DT1XDwzBcVxSjqaOmmo2sw6YDluZZ7nDUagdV2BS4pXYpT1eMVME4pmu5TIm5QHHqVtPh9TDiBxDCas0lU4WkBbdkg8wqPUQ3V4LLDPbfkviSs4i4TxFuPULqJ0QcWEZmXLW3vY9j8l5vDKLHHYbQcQ0Zpas0jXCOBrDnI+E3A3PVdOrix7Fovd8TxKJtKT42U8eUvHYla0+H4jhEjzgVcIIZDd1PM3Oy/cK/r477KLDkroscVc2v4MpsXr4DSYjTua9sdzYEutax7jXuscKFtZWV/EtX4aeCMxQ36AC7z/wDncqhi+G41jcFsRxGJ5abxxRtysB7nuVgYfjhwZuEGspGUNg1zY2EOIvc626p62K7selkqqKmGSyScU4ZjtWcorqp4AOzARZoXsazEMfj4wp6WClzYU62d/L0tbxEu6EdlzazDaerw8Ub25YmgBhbuy2xChjfxPBEKeLGIHxgWD5IbvAVMepi18nRaeCS6Ni6mpPaw0MytM8Fn2/yhbf6mw+q61PX4+7jOWklpcuEgHLII9LW0ObuT0Xnv+TsT4Hmaolkrnv5pq7+MP7jyVrmcUcrkftiDJa3N5Pjt9N1dajG/JV4JrwQUFJhY9omJyTyxRQ0rhJGx7w1nMIFzr2N16mgpYJuI6jE48UjqnOh5TYGFpEbbg9D3H5ry0HDWHMjHPi95mJu+WQnM4nc7qKnwvEMJxOepwSWlpo5WBmWRpdYD/iqx1MG6JenmlZzMZbNhvEVXh2G1bqn3+5DWkWbI91iNOoC9BxJC2hwnC+FqN1jPYzEb5Bq4n1N/ouJR4Di9Hi5xOKpo/ei5z7uYSAXbm1vNdiio612KT4jik8U9S9gjYY22DWjySeeCi3F8kxxTbSfR0Y2NjjbGwZWNADR2AWyIvMPQCIiAKaKAyNzbBQqzTzhjcjtBe4K1wqO75GWVyUfiaOiyG6OmLRYbreaYEaWKrbm5XdPJHHHg44QlklyDqbndERea227Z6CSSpBERQSZAuQO6ui0UV1Wp25pfRbVslm5Qu/SxqLkcWolcqK7nGWS52C36LWMWC3K7DlMDdHu0WFq8oDaLUqw/ayhgb1UrjqgIjHdYEXcqUla3uUBlrQFsdFgaDVak5igNhqVtZGiwWyA6ejmrdhLmEHdV4XdFOXiLxONggObUtyynzUKvV7bhsjdQVSQGh0WwOiELQmyA0lj6haNd0KsghwUUsXUIDCKMEg2K2BQG11jfdZAuslhQGrc0bszdldjljlGtgVTF1nLrcGxUEnQAA6hb5m9CubmkWc0iEHQuFXqHWYVGyUj4hZTlglZohJzxspImcyQNO3VYkjLDrsswuyyg/JeUoVkSkei5XC4nUa1rGWaAAqFU1oOZosVNJLZtlSfIZHabBehmUdjs4sTe9UarZgBe0HQE6rVbMY6RwawXJXlx7PRfRfqmwths1rRYaELnHXdbPDmnK+9wtVrmmpPhVRlihtTt3ZVdTPucjtFgU8o2IHzVtFnuZxS/4rTt3z/8lQ08p1JB+ayymdmu8i3YK0ibmI/8Vp4u6YREVT0wiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIinggMup0b+qtCDm6RWUlFWyBWWxx8kHdxF1meFjG+Hoq1zbddKisErlyYOXrRqPBjqfVERc0mm20dEVSphERVJCJcDqgIOxU7X9EbkERZAubBRVkk1NoSVBWOu8eqttZkZbqqFUfGPVetjjtikeZkluk2Ss2Wy0YdAtlqZgqM+J1ls82C2hZc3KAlaMrFpe5W0jrLRuqA23WQLLICFAYOq2Y1Ghb7BAFlYRAXWFlLG0zOHMtsFVnmdO+50A2Cgc8vlc5+51UjWl7g0C5KhEss04MlNLGdhYt9VUsurHCIYMvXr6rnSi0hUkEa1cFssFARG4K3a++hRzbqO1kBu+MOGigLC0qw1xC3sHBAVQ4hTMeDojoey0LC1QCfKHJkstGPtoVYaQd1IIgFvlC3yrFrIDTKEY4xO02U8cJeL3sFpIyxLTqgNyGStUTKVoeHXNhrZaC7D5KZr8wsqOKl2WUmuinUOzyEDRoUYFhYKaaMtObuoV5+oct9M7sCjttBbxyOifmadVor0FE10WeQm5F7DSyzxQlJ/EvklGK+RTe8vcXO3K1Us8YjfYG4USiakpPd2Wg04/HoIiKhYIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAiIgCIiAIiIAuno2FuXawsuYt2yva3KHadlvgyrG+THNjc0qJKiTp1UCydTcrCjNl9R8dDFj2IIiLE2Clgj5hJOwUSmp5AxxB2ctcNb1uM8t7HRvJEB0VRzWgqzNNa+qoSz62GpK9M81E7RrbMrULGjW9yqEbHu8T9B2VuDe3RYxljc6S5NpRyKFt8E0j7NXMlOeRWqmToFWa25uugxJW7Le9gtWiywbuNgpIDQXu8laAytWkTMo1WzjdARu1K3aLBA1boDCLNkA1QGQLBYK26JZAYCydEWrjdwaOqgGDC4xZm6lriPkrmFBrpHOduAtIf3T/AO0mH/v3+iJUS3ZfqZA0LlvOZ5Kt1WypjZCDVYKysIAtXBbLB2Ug1C22WoWx2QGObZSska/Q2VOTdZiQFx0IOrVGMzNwrEXwrWX4UAY+630Kqt3VhiAnbLlZZVnOLpbhSnZaN+JQDBHQrQAtKsSbBRFACxz26D6qB1M9vYhX/uBRP6qk8UcnDNIZHDlHPLSDYjVdKabkU4HWyrf45nqt8S3Z6rGEFi3UaSn6u2ymXOcSXG5KwsrC8+UnJ2zujFRVIIiKCQrVDCyWU8zZo27qqrNF+9d/ZWmFJzSZnlbUG0ZrWRscOWA3yCrAE7BSVf78ei2pdn/JbZYJ5dqMcc2sW4hLXDoVi6tO3VV/xq+TTxUW14K488pSSYREXEdgREQBERAEREAREQBERAEREAUsEXNcewFyolbw/wDeP/s/zWuFKU0mZ5W1BtGj4LbaKBzS02O66Mu6p1Hxj0XVqMcdm5I5sE5btrZCiIuA7QiIgCIiAIiIAiIgMOaHDVYaxjNQ0DzW/VYl+BbY058NmE5KHNGBd2jfqpARG2w1KxH8IWHbrvx4owXByTyOfZG4FzrrcNsstWXbLUyNbE7BSRx5dTupov3QWpQGCUAWOq2CkGUREAWQsLYIASiwU6KAYJ7LA8Dm3+IlGfEtT/0oeoWWWbjHg1xxUnyf/9k=";
const APP_BG_OPACITY = 0.12;

// Nomor WhatsApp Bos untuk menerima laporan, format 62xxxxxxxxxx (tanpa + atau 0 di depan).
// Kosongkan ("") untuk membuka WhatsApp tanpa nomor tertentu (karyawan pilih kontak sendiri).
const ADMIN_WHATSAPP_NUMBER = '';

function AppBackground() {
    return (
        <div
            aria-hidden="true"
            style={{
                position: 'fixed',
                inset: 0,
                zIndex: -1,
                pointerEvents: 'none',
                backgroundImage: `url(${APP_BG_DATA_URI})`,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                backgroundRepeat: 'no-repeat',
                opacity: APP_BG_OPACITY
            }}
        />
    );
}

// SVG Vector Logo Component matching the seller pouring tea illustration
function TehTarikLogoSVG({ className = "w-12 h-12", darkTheme = false }) {
    const primaryColor = darkTheme ? "#e5a93c" : "#21120b";
    const secondaryColor = darkTheme ? "#ffffff" : "#633c26";
    
    return (
        <svg viewBox="0 0 400 400" className={className} xmlns="http://www.w3.org/2000/svg">
            <path id="curveTop" d="M 60,160 A 150,150 0 0,1 340,160" fill="none" />
            <text className="font-black" fill={primaryColor} fontSize="31" letterSpacing="1">
                <textPath href="#curveTop" startOffset="50%" textAnchor="middle">
                    Cha Nom Yen
                </textPath>
            </text>

            <g transform="translate(45, 80) scale(0.78)" fill="none" stroke={primaryColor} strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
                {/* Vendor Cap / Songkok */}
                <path d="M 175 90 L 225 90 L 220 70 L 180 70 Z" fill={primaryColor} />
                {/* Head & Face */}
                <ellipse cx="200" cy="115" rx="20" ry="22" fill={secondaryColor} stroke={primaryColor} strokeWidth="5" />
                <path d="M 190 110 Q 195 105 200 110" />
                <path d="M 200 110 Q 205 105 210 110" />
                <path d="M 193 125 Q 200 132 207 125" strokeWidth="6" />

                {/* Apron & Body */}
                <path d="M 165 140 L 235 140 L 225 250 L 175 250 Z" fill={darkTheme ? "#381f13" : "#f0e2ca"} stroke={primaryColor} strokeWidth="6" />
                <path d="M 170 145 L 185 180 L 215 180 L 230 145" />

                {/* Upper Arm & Pitcher (Left hand pouring from above) */}
                <path d="M 165 145 Q 120 110 135 70" />
                {/* Upper Pitcher/Pot */}
                <rect x="110" y="50" width="35" height="40" rx="6" fill={primaryColor} />
                <path d="M 110 60 Q 95 70 110 80" />

                {/* Tea Stream Flowing Down */}
                <path d="M 130 90 Q 180 140 208 200" stroke={darkTheme ? "#f7f0e3" : "#c78d4c"} strokeWidth="11" fill="none" />

                {/* Lower Arm & Receiving Mug */}
                <path d="M 235 150 Q 250 180 220 205" />
                {/* Receiving Mug */}
                <rect x="200" y="200" width="30" height="36" rx="4" fill={primaryColor} />
                <path d="M 230 208 Q 242 218 230 228" />

                {/* Legs */}
                <path d="M 180 250 L 175 285" />
                <path d="M 220 250 L 225 285" />
            </g>

            {/* Footer Text */}
            <text x="200" y="360" textAnchor="middle" className="font-black" fill={primaryColor} fontSize="24" letterSpacing="1.5">
                KAW KAW PUNYE SEDAPP
            </text>
        </svg>
    );
}

function App() {
    const [branches, setBranches] = useState(DEFAULT_BRANCHES);
    const [selectedBranchId, setSelectedBranchId] = useState('ALL');
    const [currentTab, setCurrentTab] = useState('dashboard');
    const [salesLogs, setSalesLogs] = useState([]);
    const [materials, setMaterials] = useState(DEFAULT_MATERIALS);
    const [branchMaterialStock, setBranchMaterialStock] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [firestoreError, setFirestoreError] = useState('');
    const [authUser, setAuthUser] = useState(null);
    const [userProfile, setUserProfile] = useState(null);
    const [authReady, setAuthReady] = useState(false);
    const [authError, setAuthError] = useState('');
    const [isLoginSubmitting, setIsLoginSubmitting] = useState(false);

    const userRole = userProfile?.role || 'karyawan';
    const isAdmin = userRole === 'admin';
    const isKaryawan = userRole === 'karyawan';

    const setBranchesSafe = (updater) => {
        if (!isAdmin) return;
        const next = typeof updater === 'function' ? updater(branches) : updater;
        setBranches(next);
        if (firestoreDb) {
            upsertArrayCollection(FIRESTORE_COLLECTIONS.branches, next || DEFAULT_BRANCHES).catch((error) => {
                console.error('branches Firestore write failed:', error);
            });
        }
    };

    const setSalesLogsSafe = (updater) => {
        const next = typeof updater === 'function' ? updater(salesLogs) : updater;
        setSalesLogs(next);
        if (firestoreDb) {
            upsertArrayCollection(FIRESTORE_COLLECTIONS.salesLogs, next || []).catch((error) => {
                console.error('salesLogs Firestore write failed:', error);
            });
        }
    };

    const setMaterialsSafe = (updater) => {
        const next = typeof updater === 'function' ? updater(materials) : updater;
        setMaterials(next);
        if (firestoreDb) {
            upsertArrayCollection(FIRESTORE_COLLECTIONS.materials, next || DEFAULT_MATERIALS).catch((error) => {
                console.error('materials Firestore write failed:', error);
            });
        }
    };

    // Menyimpan stok ke Firestore secara BERTARGET (hanya item yang benar-benar
    // berubah) dengan cara membandingkan (diff) state lama vs state baru.
    // Ini menggantikan pola lama "kirim semua state lokal lalu hapus sisanya di
    // Firestore", yang berbahaya karena bisa menghapus data valid saat state lokal
    // belum lengkap (misalnya baru buka aplikasi / baru ganti perangkat).
    // Item stok hanya akan terhapus dari Firestore jika memang secara eksplisit
    // dihilangkan dari objek berikutnya (misalnya lewat tombol hapus di Menu Stok).
    const setBranchMaterialStockSafe = (updater) => {
        const prevBranchMaterialStock = branchMaterialStock;
        const next = typeof updater === 'function' ? updater(prevBranchMaterialStock) : updater;
        setBranchMaterialStock(next);

        if (!firestoreDb) return;

        const changedMap = {};
        const removedIds = [];

        const allBranchIds = new Set([
            ...Object.keys(prevBranchMaterialStock || {}),
            ...Object.keys(next || {})
        ]);

        allBranchIds.forEach((branchId) => {
            const prevBranchStock = (prevBranchMaterialStock || {})[branchId] || {};
            const nextBranchStock = (next || {})[branchId] || {};
            const allMaterialIds = new Set([
                ...Object.keys(prevBranchStock),
                ...Object.keys(nextBranchStock)
            ]);

            allMaterialIds.forEach((materialId) => {
                const prevDetails = prevBranchStock[materialId];
                const nextDetails = nextBranchStock[materialId];

                if (nextDetails === undefined) {
                    if (prevDetails !== undefined) {
                        // Item ini memang dihapus dari state (mis. tombol hapus item stok)
                        removedIds.push(`${branchId}_${materialId}`);
                    }
                    return;
                }

                if (JSON.stringify(prevDetails) === JSON.stringify(nextDetails)) {
                    return; // tidak berubah, tidak perlu ditulis ulang
                }

                if (!changedMap[branchId]) changedMap[branchId] = {};
                changedMap[branchId][materialId] = nextDetails;
            });
        });

        if (Object.keys(changedMap).length > 0) {
            upsertBranchMaterialStock(changedMap).catch((error) => {
                console.error('stock save error from state update', error);
            });
        }

        if (removedIds.length > 0) {
            deleteBranchMaterialStockDocs(removedIds).catch((error) => {
                console.error('stock delete error from state update', error);
            });
        }
    };

    useEffect(() => {
        if (!branches.length) return;
        // Tunggu sampai data stok awal selesai dimuat dari Firestore dulu.
        // Kalau efek ini jalan sebelum data asli termuat, ia bisa mengira bahan
        // yang sebenarnya sudah ada (tapi belum sempat termuat) sebagai "belum ada",
        // lalu menimpanya dengan nilai kosong.
        if (isLoading) return;

        let hasMissingDefaultStock = false;
        const nextBranchStock = { ...branchMaterialStock };

        branches.forEach((branch) => {
            const currentBranchStock = { ...(nextBranchStock[branch.id] || {}) };
            let branchChanged = false;

            DEFAULT_MATERIALS.forEach((material) => {
                if (!Object.prototype.hasOwnProperty.call(currentBranchStock, material.id)) {
                    currentBranchStock[material.id] = {
                        qty: '',
                        status: 'Aman',
                        notes: 'Belum ada catatan',
                        updatedBy: 'system',
                        updatedAt: new Date().toISOString()
                    };
                    branchChanged = true;
                }
            });

            if (branchChanged) {
                nextBranchStock[branch.id] = currentBranchStock;
                hasMissingDefaultStock = true;
            }
        });

        if (hasMissingDefaultStock) {
            setBranchMaterialStockSafe(nextBranchStock);
        }
    }, [branches, isLoading]);

    useEffect(() => {
        if (!firestoreDb) {
            const errorMessage = window.firebaseInitError || 'Firebase Firestore belum terinisialisasi. Pastikan konfigurasi Firebase sudah diisi di index.html.';
            console.error(errorMessage);
            setFirestoreError(errorMessage);
            setIsLoading(false);
            return;
        }

        const canReadSalesReports = !!authUser;

        console.log('Subscribing to Firestore collections...', { canReadSalesReports, userRole, authReady });

        const unsubBranches = firestoreDb.collection(FIRESTORE_COLLECTIONS.branches).onSnapshot({
            next: (snapshot) => {
                console.log('snapshot branches received', snapshot.size);
                const nextBranches = (snapshot.empty ? DEFAULT_BRANCHES : snapshot.docs.map(normalizeFirestoreDoc)).map(normalizeBranchRecord);
                setBranches(nextBranches);
            },
            error: (error) => {
                console.error('Firestore branches error:', error);
                setFirestoreError(error.message || 'Gagal memuat data cabang dari Firestore.');
            }
        });

        let unsubSalesLogs = () => {};
        if (canReadSalesReports) {
            unsubSalesLogs = firestoreDb.collection(FIRESTORE_COLLECTIONS.salesLogs).onSnapshot({
                next: (snapshot) => {
                    console.log('snapshot salesLogs received', snapshot.size);
                    const nextLogs = snapshot.docs.map(normalizeFirestoreDoc);
                    setSalesLogs(nextLogs);
                },
                error: (error) => {
                    console.error('Firestore salesLogs error:', error);
                    setFirestoreError(error.message || 'Gagal memuat log penjualan dari Firestore.');
                }
            });
        }

        const unsubMaterials = firestoreDb.collection(FIRESTORE_COLLECTIONS.materials).onSnapshot({
            next: (snapshot) => {
                console.log('snapshot materials received', snapshot.size);
                const nextMaterials = snapshot.empty ? DEFAULT_MATERIALS : snapshot.docs.map(normalizeFirestoreDoc);
                setMaterials(nextMaterials);
            },
            error: (error) => {
                console.error('Firestore materials error:', error);
                setFirestoreError(error.message || 'Gagal memuat data bahan dari Firestore.');
            }
        });

        const unsubStock = firestoreDb.collection(FIRESTORE_COLLECTIONS.branchMaterialStock).onSnapshot({
            next: (snapshot) => {
                console.log('snapshot branchMaterialStock received', snapshot.size);
                const nextStock = normalizeBranchStockMap(snapshot);
                setBranchMaterialStock(prev => {
                    const merged = { ...prev, ...nextStock };
                    return merged;
                });
                setIsLoading(false);
            },
            error: (error) => {
                console.error('Firestore stock error:', error);
                setFirestoreError(error.message || 'Gagal memuat stok cabang dari Firestore.');
                setIsLoading(false);
            }
        });

        const unsubscribeAuth = window.firebaseAuth.onAuthStateChanged(async (firebaseUser) => {
            setAuthUser(firebaseUser);
            if (!firebaseUser) {
                setUserProfile(null);
                setAuthReady(true);
                setSalesLogs([]);
                return;
            }

            try {
                const profile = await createOrUpdateUserProfile(firebaseUser);
                setUserProfile(profile);
            } catch (error) {
                console.error('Failed to load user profile:', error);
                setUserProfile({
                    uid: firebaseUser.uid,
                    email: firebaseUser.email || '',
                    role: getDefaultRoleByEmail(firebaseUser.email || ''),
                    displayName: firebaseUser.displayName || 'Pengguna'
                });
            } finally {
                setAuthReady(true);
            }
        });

        return () => {
            unsubBranches();
            unsubSalesLogs();
            unsubMaterials();
            unsubStock();
            unsubscribeAuth();
        };
    }, [authReady, authUser, userRole]);

    useEffect(() => {
        if (!userProfile) return;
        if (isAdmin && currentTab === 'input') {
            setCurrentTab('dashboard');
        }
        if (isKaryawan && !['input', 'inventory', 'history'].includes(currentTab)) {
            setCurrentTab('input');
        }
    }, [userRole, currentTab, userProfile, isAdmin, isKaryawan]);

    // Toast Alert state
    const [toast, setToast] = useState(null);
    const showToast = (message, type = 'success') => {
        setToast({ message, type });
        setTimeout(() => setToast(null), 3500);
    };

    // Custom Confirm Dialog Modal state
    const [confirmModal, setConfirmModal] = useState(null);

    // Helper to resolve Branch Name
    const getBranchName = (id) => {
        if (id === 'ALL') return 'Semua Cabang (Gabungan)';
        const found = branches.find(b => b.id === id);
        return found ? found.name : 'Cabang Tidak Ditemukan';
    };

    // Report Export Modal State
    const [activeReportLog, setActiveReportLog] = useState(null);

    // Keep the unsaved sales form draft alive across tab and slide changes.
    const salesDraftRef = useRef({});

    const handleLogin = async ({ email, password }) => {
        if (!window.firebaseAuth) {
            setAuthError('Firebase Authentication belum siap.');
            return;
        }

        setIsLoginSubmitting(true);
        setAuthError('');

        try {
            await window.firebaseAuth.signInWithEmailAndPassword(email.trim(), password);
        } catch (error) {
            console.error('Login failed', error);
            setAuthError(error?.message || 'Login gagal. Silakan cek email dan password Anda.');
        } finally {
            setIsLoginSubmitting(false);
        }
    };

    const handleLogout = async () => {
        if (!window.firebaseAuth) return;
        salesDraftRef.current = {};
        await window.firebaseAuth.signOut();
        setUserProfile(null);
        setCurrentTab('input');
    };

    if (!authReady) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f3eb] text-brand-950">
                <div className="bg-white px-6 py-5 rounded-3xl shadow-xl border border-brand-200 text-center">
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-amber-700"></i>
                    <p className="mt-3 font-extrabold">Memeriksa sesi login...</p>
                </div>
            </div>
        );
    }

    if (!authUser || !userProfile) {
        return <LoginScreen onSubmit={handleLogin} isSubmitting={isLoginSubmitting} authError={authError} />;
    }

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f3eb] text-brand-950">
                <div className="bg-white px-6 py-5 rounded-3xl shadow-xl border border-brand-200 text-center">
                    <i className="fa-solid fa-spinner fa-spin text-2xl text-amber-700"></i>
                    <p className="mt-3 font-extrabold">Memuat data dari Firestore...</p>
                </div>
            </div>
        );
    }

    if (firestoreError) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-[#f7f3eb] p-6">
                <div className="bg-white max-w-lg w-full rounded-3xl shadow-xl border border-rose-200 p-6 text-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full mx-auto flex items-center justify-center text-2xl">
                        <i className="fa-solid fa-circle-exclamation"></i>
                    </div>
                    <h2 className="mt-4 text-xl font-black text-gray-900">Koneksi Firestore Error</h2>
                    <p className="mt-2 text-sm text-gray-600">{firestoreError}</p>
                </div>
            </div>
        );
    }

    const visibleTabs = isAdmin ? [
        { id: 'dashboard', label: 'Dashboard', icon: 'fa-chart-pie' },
        { id: 'inventory', label: 'Stok', icon: 'fa-boxes-stacked' },
        { id: 'branches', label: 'Cabang', icon: 'fa-code-branch' },
        { id: 'history', label: 'Laporan', icon: 'fa-clock-rotate-left' }
    ] : [
        { id: 'input', label: 'Input', icon: 'fa-pen-to-square' },
        { id: 'inventory', label: 'Stok', icon: 'fa-boxes-stacked' },
        { id: 'history', label: 'Riwayat Saya', icon: 'fa-clock-rotate-left' }
    ];

    // Ukuran tombol navigasi diperkecil lewat inline style (bukan mengganti class
    // main-nav__item) supaya efek/warna "active" dari style.css tetap berlaku.
    // Inline style ini akan menang atas class biasa di style.css, KECUALI jika
    // style.css memakai !important pada properti padding/font-size yang sama —
    // kalau itu terjadi, kecilkan juga nilai padding/font-size pada class
    // .main-nav__item / .main-nav__icon / .main-nav__label di style.css.
    const navButtonStyle = { padding: '0.4rem 0.5rem', minWidth: 0 };
    const navIconStyle = { fontSize: '0.95rem', lineHeight: 1 };
    const navLabelStyle = { fontSize: '0.62rem', lineHeight: 1.1 };

    return (
        <div className="min-h-screen flex flex-col app-shell">
            <AppBackground />
            {/* Header Navbar */}
            <header className="app-header bg-gradient-to-r from-brand-950 via-darkRoast to-brand-900 text-white shadow-xl sticky top-0 z-40 border-b border-amberGold/30">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-2 sm:py-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
                        <div className="flex items-center gap-2 sm:gap-3 cursor-pointer" onClick={() => setCurrentTab(isAdmin ? 'dashboard' : 'input')}>
                            <div className="w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl bg-amberGold p-1 flex items-center justify-center shadow-lg shadow-amberGold/20 transform hover:scale-105 transition-transform shrink-0">
                                <img src={APP_LOGO_DATA_URI} alt="Logo Cha Nom Yen" className="w-full h-full object-cover rounded-lg" />
                            </div>
                            <div className="min-w-0">
                                <h1 className="font-extrabold text-sm sm:text-lg md:text-xl tracking-tight text-amber-100 leading-tight">
                                    CHA NOM YEN
                                </h1>
                                <div className="text-[9px] sm:text-[10px] font-bold text-brand-200 leading-tight">
                                    Teh Tarik Malaysia
                                </div>
                                <div className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.1em] text-amberGold leading-tight">
                                    Kaw Kaw Punye Sedapp
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center justify-between gap-2 w-full sm:w-auto sm:justify-end sm:gap-2">
                            <div className="flex items-center gap-1.5 bg-brand-900/90 px-1.5 py-1 rounded-lg border border-brand-700/80 shadow-inner flex-1 min-w-0 sm:flex-none sm:max-w-[220px]">
                                <div className="text-amberGold text-[9px] sm:text-xs font-bold flex items-center justify-center shrink-0">
                                    <i className="fa-solid fa-store"></i>
                                </div>
                                <select
                                    value={selectedBranchId}
                                    onChange={(e) => setSelectedBranchId(e.target.value)}
                                    className="bg-brand-950 text-amber-50 font-extrabold text-[9px] sm:text-xs md:text-sm rounded-md px-1.5 py-1 focus:outline-none focus:ring-2 focus:ring-amberGold border border-brand-700 w-full min-w-0 cursor-pointer"
                                >
                                    <option value="ALL">Semua Cabang</option>
                                    {branches.map(b => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <button
                                type="button"
                                onClick={handleLogout}
                                className="bg-white/10 border border-white/15 hover:bg-white/20 text-white font-bold text-[10px] sm:text-xs px-3 py-2 rounded-xl shrink-0"
                            >
                                <i className="fa-solid fa-right-from-bracket mr-1"></i>
                                Logout
                            </button>
                        </div>
                    </div>
                </div>
            </header>

            <nav className="tab-nav fixed bottom-2 left-2 right-2 z-40 sm:hidden" aria-label="Main navigation">
                {visibleTabs.map((tab) => (
                    <button
                        key={tab.id}
                        type="button"
                        onClick={() => setCurrentTab(tab.id)}
                        className={`main-nav__item ${currentTab === tab.id ? 'active' : ''}`}
                        style={navButtonStyle}
                    >
                        <span className="main-nav__icon" style={navIconStyle}><i className={`fa-solid ${tab.icon}`}></i></span>
                        <span className="main-nav__label" style={navLabelStyle}>{tab.label}</span>
                    </button>
                ))}
            </nav>

            <div className="hidden sm:block">
                <nav className="tab-nav" aria-label="Main navigation" style={{ marginTop: '1.1rem' }}>
                    {visibleTabs.map((tab) => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setCurrentTab(tab.id)}
                            className={`main-nav__item ${currentTab === tab.id ? 'active' : ''}`}
                            style={navButtonStyle}
                        >
                            <span className="main-nav__icon" style={navIconStyle}><i className={`fa-solid ${tab.icon}`}></i></span>
                            <span className="main-nav__label" style={navLabelStyle}>{tab.label}</span>
                        </button>
                    ))}
                </nav>
            </div>

            {toast && (
                <div className="fixed bottom-5 right-5 z-50 animate-bounce">
                    <div className={`px-4 py-3 rounded-2xl shadow-2xl flex items-center gap-3 text-white font-bold border ${toast.type === 'success' ? 'bg-emerald-700 border-emerald-500' : 'bg-rose-700 border-rose-500'}`}>
                        <i className={`fa-solid ${toast.type === 'success' ? 'fa-circle-check' : 'fa-circle-exclamation'} text-xl`}></i>
                        <span className="text-sm">{toast.message}</span>
                    </div>
                </div>
            )}

            {confirmModal && (
                <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl border border-brand-200 text-center animate-fade-in">
                        <div className="w-14 h-14 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto text-2xl font-bold">
                            <i className="fa-solid fa-triangle-exclamation"></i>
                        </div>
                        <div>
                            <h3 className="font-extrabold text-gray-900 text-lg">{confirmModal.title || 'Konfirmasi Action'}</h3>
                            <p className="text-xs text-gray-500 mt-1">{confirmModal.message}</p>
                        </div>
                        <div className="flex gap-2 pt-2">
                            <button
                                onClick={() => setConfirmModal(null)}
                                className="flex-1 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                            >
                                Batal
                            </button>
                            <button
                                onClick={() => {
                                    confirmModal.onConfirm();
                                    setConfirmModal(null);
                                }}
                                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs shadow-md"
                            >
                                Ya, Lanjutkan
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <main className="app-main flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
                {currentTab === 'dashboard' && isAdmin && (
                    <DashboardView 
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        salesLogs={salesLogs}
                        getBranchName={getBranchName}
                        onNavigateToInput={() => setCurrentTab('input')}
                        showInputButton={false}
                    />
                )}

                {currentTab === 'input' && !isAdmin && (
                    <SalesInputView 
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        materials={materials}
                        setMaterials={setMaterialsSafe}
                        branchMaterialStock={branchMaterialStock}
                        setBranchMaterialStock={setBranchMaterialStockSafe}
                        authUser={authUser}
                        salesDraftRef={salesDraftRef}
                        onSaveLog={(newLog) => {
                            setSalesLogsSafe(prev => [newLog, ...prev]);
                            salesDraftRef.current = {};
                            showToast('Laporan penjualan harian berhasil disimpan!');
                            setCurrentTab('history');
                        }}
                        showToast={showToast}
                    />
                )}

                {currentTab === 'inventory' && (
                    <InventoryView 
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        materials={materials}
                        setMaterials={setMaterialsSafe}
                        branchMaterialStock={branchMaterialStock}
                        setBranchMaterialStock={setBranchMaterialStockSafe}
                        isAdminView={isAdmin}
                        showToast={showToast}
                    />
                )}

                {currentTab === 'history' && (
                    <HistoryView 
                        branches={branches}
                        selectedBranchId={selectedBranchId}
                        salesLogs={salesLogs}
                        setSalesLogs={setSalesLogsSafe}
                        getBranchName={getBranchName}
                        onOpenReport={(log) => setActiveReportLog(log)}
                        setConfirmModal={setConfirmModal}
                        showToast={showToast}
                        role={userRole}
                        currentUserId={authUser?.uid || null}
                    />
                )}

                {currentTab === 'branches' && isAdmin && (
                    <BranchManagementView 
                        branches={branches}
                        setBranches={setBranchesSafe}
                        salesLogs={salesLogs}
                        setConfirmModal={setConfirmModal}
                        showToast={showToast}
                    />
                )}
            </main>

            {activeReportLog && (
                <ReportExportModal 
                    log={activeReportLog}
                    branchName={getBranchName(activeReportLog.branchId)}
                    materials={materials}
                    branchMaterialStock={branchMaterialStock}
                    onClose={() => setActiveReportLog(null)}
                />
            )}

            <footer className="app-footer bg-brand-950 text-brand-400 py-6 text-center text-xs border-t border-brand-900 mt-auto">
                <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                        <img src={APP_LOGO_DATA_URI} alt="Logo Cha Nom Yen" className="w-7 h-7 object-cover rounded-md shadow-sm" />
                        <span className="font-extrabold text-brand-200">CHA NOM YEN &middot; Kaw Kaw Punye Sedapp</span>
                    </div>
                    <p className="text-brand-500">
                        Sistem Penjualan Multi Cabang
                    </p>
                </div>
            </footer>
        </div>
    );
}

function DashboardView({ branches, selectedBranchId, salesLogs, getBranchName, onNavigateToInput, showInputButton = true }) {
    const filteredLogs = useMemo(() => {
        if (selectedBranchId === 'ALL') return salesLogs;
        return salesLogs.filter(log => log.branchId === selectedBranchId);
    }, [selectedBranchId, salesLogs]);

    const stats = useMemo(() => {
        let totalGross = 0;
        let totalExpenses = 0;
        let totalQRIS = 0;
        let totalDeposit = 0;
        let totalCupsSold = 0;

        filteredLogs.forEach(log => {
            let logGross = 0;
            Object.keys(log.items || {}).forEach(pId => {
                const item = log.items[pId];
                const sold = Math.max(0, (item.initial || 0) - (item.final || 0));
                logGross += sold * (item.price || 0);
                totalCupsSold += sold;
            });

            const extraHotCharge = (log.hotTehExtraCount || 0) * 5000;
            const extraMiloCharge = (log.miloQty || 0) * getMiloChargeForBranch(log.branchId || '', '');
            logGross += extraHotCharge + extraMiloCharge;

            totalGross += logGross;
            totalExpenses += Math.max(0, Number(log.expenses) || 0);
            totalQRIS += Math.max(0, Number(log.qris) || 0);
            totalDeposit += Math.max(0, Number(log.deposit) || 0);
        });

        const totalFinalCash = totalGross - totalExpenses - totalQRIS;

        return {
            totalGross,
            totalExpenses,
            totalQRIS,
            totalDeposit,
            totalFinalCash,
            totalCupsSold,
            totalTransactions: filteredLogs.length
        };
    }, [filteredLogs]);

    const branchBreakdown = useMemo(() => {
        return branches.map(branch => {
            const bLogs = salesLogs.filter(l => l.branchId === branch.id);
            let bGross = 0;
            let bCups = 0;
            let bFinalCash = 0;

            bLogs.forEach(log => {
                let logGross = 0;
                Object.keys(log.items || {}).forEach(pId => {
                    const item = log.items[pId];
                    const sold = Math.max(0, (item.initial || 0) - (item.final || 0));
                    logGross += sold * (item.price || 0);
                    bCups += sold;
                });
                const extraMiloCharge = (log.miloQty || 0) * getMiloChargeForBranch(log.branchId || '', '');
                logGross += ((log.hotTehExtraCount || 0) * 5000) + extraMiloCharge;
                bGross += logGross;
                bFinalCash += (logGross - Math.max(0, Number(log.expenses) || 0) - Math.max(0, Number(log.qris) || 0));
            });

            return {
                id: branch.id,
                name: branch.name,
                gross: bGross,
                cups: bCups,
                finalCash: bFinalCash,
                logCount: bLogs.length
            };
        });
    }, [branches, salesLogs]);

    const maxBranchGross = Math.max(...branchBreakdown.map(b => b.gross), 1);
    const [chartRange, setChartRange] = useState('daily');

    const chartSeries = useMemo(() => {
        const bucketMap = new Map();

        filteredLogs.forEach(log => {
            const date = new Date(`${log.date}T00:00:00`);
            if (Number.isNaN(date.getTime())) return;

            let key = '';
            let label = '';

            if (chartRange === 'weekly') {
                const dayIndex = (date.getDay() + 6) % 7;
                const start = new Date(date);
                start.setDate(date.getDate() - dayIndex);
                key = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
                label = `W ${start.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' })}`;
            } else if (chartRange === 'monthly') {
                key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                label = date.toLocaleDateString('id-ID', { month: 'short', year: '2-digit' });
            } else if (chartRange === 'yearly') {
                key = String(date.getFullYear());
                label = String(date.getFullYear());
            } else {
                key = log.date;
                label = new Date(`${log.date}T00:00:00`).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
            }

            const value = bucketMap.get(key) || { label, value: 0 };
            value.value += calculateLogGross(log);
            value.label = label;
            bucketMap.set(key, value);
        });

        return Array.from(bucketMap.values()).sort((a, b) => a.label.localeCompare(b.label));
    }, [filteredLogs, chartRange]);

    return (
        <div className="space-y-6">
            <div className="bg-gradient-to-r from-brand-950 via-darkRoast to-brand-900 p-6 rounded-3xl text-white shadow-xl border border-amberGold/40 flex flex-col md:flex-row md:items-center justify-between gap-5 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-2 text-amberGold text-xs font-black uppercase tracking-wider mb-1">
                        <i className="fa-solid fa-location-dot"></i> Lokasi Terpilih
                    </div>
                    <h2 className="text-2xl sm:text-3xl font-black text-amber-50">
                        {getBranchName(selectedBranchId)}
                    </h2>
                    <p className="text-xs text-brand-300 mt-1">
                        {selectedBranchId === 'ALL' 
                            ? 'Menampilkan akumulasi data penjualan & kas dari semua lokasi berjualan' 
                            : 'Menampilkan data performa penjualan spesifik cabang ini'}
                    </p>
                </div>
                {showInputButton && (
                    <button
                        onClick={onNavigateToInput}
                        className="relative z-10 bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black px-6 py-3.5 rounded-2xl shadow-xl transition transform hover:-translate-y-0.5 flex items-center justify-center gap-2.5 text-sm whitespace-nowrap"
                    >
                        <i className="fa-solid fa-circle-plus text-lg"></i>
                        Input Penjualan & Absensi
                    </button>
                )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200/80">
                    <div className="w-11 h-11 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-lg mb-3 font-bold">
                        <i className="fa-solid fa-sack-dollar"></i>
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Pendapatan</span>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">
                        {formatRp(stats.totalGross)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200/80">
                    <div className="w-11 h-11 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center text-lg mb-3 font-bold">
                        <i className="fa-solid fa-qrcode"></i>
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total QRIS</span>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">
                        {formatRp(stats.totalQRIS)}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl shadow-sm border border-brand-200/80">
                    <div className="w-11 h-11 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center text-lg mb-3 font-bold">
                        <i className="fa-solid fa-wallet"></i>
                    </div>
                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Total Pengeluaran</span>
                    <div className="text-2xl font-black text-gray-900 mt-0.5">
                        {formatRp(stats.totalExpenses)}
                    </div>
                </div>

                <div className="bg-gradient-to-br from-brand-900 via-brand-950 to-darkRoast p-5 rounded-2xl shadow-md border border-amberGold/50 text-white lg:col-span-3">
                    <div className="w-11 h-11 rounded-xl bg-amberGold/20 text-amberGold border border-amberGold/40 flex items-center justify-center text-lg mb-3 font-bold">
                        <i className="fa-solid fa-vault"></i>
                    </div>
                    <span className="text-xs font-bold text-amberGold uppercase tracking-wider">Total Akhir (Setoran Cash)</span>
                    <div className="text-2xl font-black text-amber-100 mt-0.5">
                        {formatRp(stats.totalFinalCash)}
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
                    <div>
                        <h3 className="font-extrabold text-lg text-brand-950 flex items-center gap-2">
                            <i className="fa-solid fa-chart-line text-amber-700"></i>
                            Grafik Penjualan
                        </h3>
                        <p className="text-xs text-gray-500">Performa omzet berdasarkan harian, mingguan, bulanan, dan tahunan</p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                        {['daily', 'weekly', 'monthly', 'yearly'].map((range) => (
                            <button
                                key={range}
                                type="button"
                                onClick={() => setChartRange(range)}
                                className={`px-3 py-2 rounded-xl text-xs font-black border ${chartRange === range ? 'bg-amber-500 text-brand-950 border-amber-500' : 'bg-brand-50 text-brand-800 border-brand-200 hover:bg-brand-100'}`}
                            >
                                {range === 'daily' ? 'Harian' : range === 'weekly' ? 'Mingguan' : range === 'monthly' ? 'Bulanan' : 'Tahunan'}
                            </button>
                        ))}
                    </div>
                </div>

                <SalesTrendChart data={chartSeries} title={`Penjualan ${chartRange === 'daily' ? 'Harian' : chartRange === 'weekly' ? 'Mingguan' : chartRange === 'monthly' ? 'Bulanan' : 'Tahunan'}`} />
            </div>

            {selectedBranchId === 'ALL' && (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-brand-200/80 space-y-4">
                    <div className="flex items-center justify-between border-b border-gray-100 pb-3">
                        <div>
                            <h3 className="font-extrabold text-lg text-brand-950 flex items-center gap-2">
                                <i className="fa-solid fa-chart-column text-amber-700"></i>
                                Ringkasan Pendapatan Seluruh Cabang
                            </h3>
                            <p className="text-xs text-gray-500">Perbandingan hasil penjualan kotor per cabang lokasi</p>
                        </div>
                    </div>

                    <div className="space-y-3">
                        {branchBreakdown.map(b => {
                            const percentage = Math.round((b.gross / maxBranchGross) * 100);
                            return (
                                <div key={b.id} className="p-3.5 rounded-xl bg-brand-50/60 border border-brand-100 space-y-2">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between text-xs font-bold gap-1">
                                        <div className="text-brand-950 flex items-center gap-2 text-sm">
                                            <span>📍 {b.name}</span>
                                            <span className="text-xs font-normal text-gray-500">({b.logCount} Laporan)</span>
                                        </div>
                                        <div className="text-brand-900 font-black text-sm">
                                            {formatRp(b.gross)} <span className="text-xs font-normal text-gray-500">({b.cups} gelas)</span>
                                        </div>
                                    </div>
                                    <div className="w-full bg-gray-200 rounded-full h-2.5 overflow-hidden">
                                        <div 
                                            className="bg-gradient-to-r from-amber-700 to-amberGold h-2.5 rounded-full transition-all duration-500"
                                            style={{ width: `${percentage}%` }}
                                        ></div>
                                    </div>
                                    <div className="flex justify-between text-[11px] text-gray-500">
                                        <span>Total Akhir Cash: <strong className="text-emerald-700">{formatRp(b.finalCash)}</strong></span>
                                        <span>{percentage}% dari cabang tertinggi</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}
        </div>
    );
}

function SalesInputView({ branches, selectedBranchId, materials, setMaterials, branchMaterialStock, setBranchMaterialStock, authUser, onSaveLog, showToast, salesDraftRef }) {
    const createBlankDraft = (branchId = selectedBranchId !== 'ALL' ? selectedBranchId : (branches[0]?.id || '')) => {
        const selectedBranch = branches.find(b => b.id === branchId) || branches[0];
        const savedCupStock = branchMaterialStock[branchId] || {};
        const initialStockData = {
            p1: { initial: getSavedCupQty(savedCupStock, 'p1') ?? 0, final: 0, price: 15000 },
            p2: { initial: getSavedCupQty(savedCupStock, 'p2') ?? 0, final: 0, price: 10000 },
            p3: { initial: getSavedCupQty(savedCupStock, 'p3') ?? 0, final: 0, price: 10000 },
            p4: { initial: getSavedCupQty(savedCupStock, 'p4') ?? 0, final: 0, price: getProductPriceByBranch('p4', branchId, selectedBranch?.name || '') },
        };

        const bStock = branchMaterialStock[branchId] || {};
        const matStatus = {};
        materials.forEach(m => {
            if (!Object.prototype.hasOwnProperty.call(bStock, m.id)) return;
            const prev = bStock[m.id];
            matStatus[m.id] = { qty: prev.qty || '0', status: prev.status || 'Aman' };
        });

        return {
            inputBranchId: branchId || (branches[0]?.id || ''),
            date: new Date().toISOString().split('T')[0],
            staff1: '',
            staff2: '',
            stockData: initialStockData,
            hotTehExtraCount: 0,
            expenseItems: [{ id: Date.now(), name: '', amount: '' }],
            qris: 0,
            deposit: 0,
            notes: '',
            matStatus
        };
    };

    const [inputBranchId, setInputBranchId] = useState(() => {
        const saved = salesDraftRef?.current;
        return saved?.inputBranchId || (selectedBranchId !== 'ALL' ? selectedBranchId : (branches[0]?.id || ''));
    });
    const [date, setDate] = useState(() => salesDraftRef?.current?.date || new Date().toISOString().split('T')[0]);
    const [staff1, setStaff1] = useState(() => salesDraftRef?.current?.staff1 || '');
    const [staff2, setStaff2] = useState(() => salesDraftRef?.current?.staff2 || '');
    const [stockData, setStockData] = useState(() => salesDraftRef?.current?.stockData || createBlankDraft(selectedBranchId !== 'ALL' ? selectedBranchId : (branches[0]?.id || '')).stockData);
    const [hotTehExtraCount, setHotTehExtraCount] = useState(() => salesDraftRef?.current?.hotTehExtraCount || 0);
    const [miloQty, setMiloQty] = useState(() => salesDraftRef?.current?.miloQty || 0);
    const [expenseItems, setExpenseItems] = useState(() => salesDraftRef?.current?.expenseItems || [{ id: Date.now(), name: '', amount: '' }]);
    const [qris, setQris] = useState(() => salesDraftRef?.current?.qris || 0);
    const [deposit, setDeposit] = useState(() => salesDraftRef?.current?.deposit || 0);
    const [notes, setNotes] = useState(() => salesDraftRef?.current?.notes || '');
    const [matStatus, setMatStatus] = useState(() => salesDraftRef?.current?.matStatus || createBlankDraft(selectedBranchId !== 'ALL' ? selectedBranchId : (branches[0]?.id || '')).matStatus);

    useEffect(() => {
        const saved = salesDraftRef?.current;
        if (saved && Object.keys(saved).length > 0) {
            if (saved.inputBranchId) setInputBranchId(saved.inputBranchId);
            if (saved.date) setDate(saved.date);
            if (saved.staff1 !== undefined) setStaff1(saved.staff1);
            if (saved.staff2 !== undefined) setStaff2(saved.staff2);
            if (saved.stockData) setStockData(saved.stockData);
            if (saved.hotTehExtraCount !== undefined) setHotTehExtraCount(saved.hotTehExtraCount);
            if (saved.miloQty !== undefined) setMiloQty(saved.miloQty);
            if (saved.expenseItems) setExpenseItems(saved.expenseItems);
            if (saved.qris !== undefined) setQris(saved.qris);
            if (saved.deposit !== undefined) setDeposit(saved.deposit);
            if (saved.notes !== undefined) setNotes(saved.notes);
            if (saved.matStatus) setMatStatus(saved.matStatus);
        }
    }, []);

    useEffect(() => {
        salesDraftRef.current = {
            inputBranchId,
            date,
            staff1,
            staff2,
            stockData,
            hotTehExtraCount,
            miloQty,
            expenseItems,
            qris,
            deposit,
            notes,
            matStatus
        };
    }, [inputBranchId, date, staff1, staff2, stockData, hotTehExtraCount, miloQty, expenseItems, qris, deposit, notes, matStatus]);

    useEffect(() => {
        if (selectedBranchId !== 'ALL') {
            setInputBranchId(selectedBranchId);
        }
    }, [selectedBranchId]);

    const visibleProducts = useMemo(() => {
        const selectedBranch = branches.find(b => b.id === inputBranchId);
        return getVisibleProductsForBranch(inputBranchId, selectedBranch?.name || '');
    }, [inputBranchId, branches]);

    // Setiap cabang punya stok sendiri. Saat ganti cabang, tabel diisi dengan stok cabang tujuan
    // (bukan membawa angka cabang sebelumnya), dan Stok Akhir dikosongkan.
    const lastInputBranchRef = useRef(inputBranchId);
    useEffect(() => {
        if (lastInputBranchRef.current === inputBranchId) return;
        lastInputBranchRef.current = inputBranchId;
        const savedStock = branchMaterialStock[inputBranchId] || {};
        const branchName = branches.find(b => b.id === inputBranchId)?.name || '';
        setStockData(prev => {
            const next = { ...prev };
            PRODUCTS_LIST.forEach(p => {
                next[p.id] = {
                    ...(prev[p.id] || {}),
                    initial: getSavedCupQty(savedStock, p.id) ?? 0,
                    final: 0,
                    price: getProductPriceByBranch(p.id, inputBranchId, branchName)
                };
            });
            return next;
        });
    }, [inputBranchId]);

    // Isi otomatis Stok Awal dari Stok Gelas yang tersimpan (hanya baris yang masih kosong).
    const cupPrefillKey = visibleProducts
        .map(p => `${p.id}:${getSavedCupQty(branchMaterialStock[inputBranchId] || {}, p.id) ?? ''}`)
        .join('|');

    useEffect(() => {
        const savedStock = branchMaterialStock[inputBranchId] || {};
        const branchName = branches.find(b => b.id === inputBranchId)?.name || '';
        setStockData(prev => {
            let changed = false;
            const next = { ...prev };
            visibleProducts.forEach(p => {
                const saved = getSavedCupQty(savedStock, p.id);
                const cur = prev[p.id] || {};
                if (saved !== null && saved > 0 && !cur.initial && !cur.final) {
                    next[p.id] = {
                        final: 0,
                        price: getProductPriceByBranch(p.id, inputBranchId, branchName),
                        ...cur,
                        initial: saved
                    };
                    changed = true;
                }
            });
            return changed ? next : prev;
        });
    }, [inputBranchId, cupPrefillKey]);

    useEffect(() => {
        if (!['b2', 'b3'].includes(inputBranchId)) {
            setMiloQty(0);
        }
    }, [inputBranchId]);

    useEffect(() => {
        const selectedBranch = branches.find(b => b.id === inputBranchId);
        setStockData(prev => ({
            ...prev,
            p4: {
                ...prev.p4,
                price: getProductPriceByBranch('p4', inputBranchId, selectedBranch?.name || '')
            },
            p5: {
                ...prev.p5,
                price: getProductPriceByBranch('p5', inputBranchId, selectedBranch?.name || '')
            }
        }));
    }, [inputBranchId, branches]);

    useEffect(() => {
        if (inputBranchId) {
            const bStock = branchMaterialStock[inputBranchId] || {};
            const res = {};
            materials.forEach(m => {
                if (!Object.prototype.hasOwnProperty.call(bStock, m.id)) return;
                const prev = bStock[m.id];
                res[m.id] = { qty: prev.qty || '0', status: prev.status || 'Aman' };
            });
            setMatStatus(res);
        }
    }, [inputBranchId, materials]);

    // Stok Awal yang diketik disimpan otomatis ke Firebase (tunggu 0,8 detik setelah berhenti mengetik)
    // supaya tetap ada walau halaman ditutup / keluar dari website.
    const setBranchStockRef = useRef(setBranchMaterialStock);
    setBranchStockRef.current = setBranchMaterialStock;
    const initialSaveTimers = useRef({});

    const scheduleSaveInitialStock = (pId, qty) => {
        const branchId = inputBranchId;
        if (!branchId) return;
        clearTimeout(initialSaveTimers.current[pId]);
        initialSaveTimers.current[pId] = setTimeout(() => {
            setBranchStockRef.current(prev => {
                const branchMap = { ...(prev[branchId] || {}) };
                branchMap[getCupStockKey(pId)] = {
                    qty: String(qty),
                    status: 'Aman',
                    notes: 'Stok awal tersimpan',
                    updatedBy: authUser?.uid || 'system',
                    updatedAt: new Date().toISOString()
                };
                return { ...prev, [branchId]: branchMap };
            });
        }, 800);
    };

    const handleStockChange = (pId, field, val) => {
        const numVal = Math.max(0, parseInt(val) || 0);
        setStockData(prev => ({
            ...prev,
            [pId]: {
                ...prev[pId],
                [field]: numVal
            }
        }));
        if (field === 'initial') {
            scheduleSaveInitialStock(pId, numVal);
        }
    };

    const addExpenseItem = () => {
        setExpenseItems(prev => [...prev, { id: Date.now() + Math.random(), name: '', amount: '' }]);
    };

    const updateExpenseItem = (id, field, value) => {
        setExpenseItems(prev => prev.map(item =>
            item.id === id ? { ...item, [field]: value } : item
        ));
    };

    const removeExpenseItem = (id) => {
        setExpenseItems(prev => prev.length > 1 ? prev.filter(item => item.id !== id) : prev);
    };

    const totalExpenses = useMemo(() => {
        return expenseItems.reduce((sum, item) => {
            const amount = parseCurrencyInput(item.amount);
            return sum + amount;
        }, 0);
    }, [expenseItems]);

    const calculated = useMemo(() => {
        let grossTotal = 0;
        let totalCups = 0;
        const details = {};

        visibleProducts.forEach(p => {
            const branchPrice = getProductPriceByBranch(p.id, inputBranchId, branches.find(b => b.id === inputBranchId)?.name || '');
            const data = stockData[p.id] || { initial: 0, final: 0, price: branchPrice };
            const sold = Math.max(0, data.initial - data.final);
            const subtotal = sold * branchPrice;
            grossTotal += subtotal;
            totalCups += sold;

            details[p.id] = {
                ...data,
                name: p.name,
                sold,
                subtotal,
                price: branchPrice
            };
        });

        const hotTehExtraSubtotal = (Math.max(0, parseInt(hotTehExtraCount) || 0)) * 5000;
        const miloCharge = ((Math.max(0, parseInt(miloQty) || 0)) * getMiloChargeForBranch(inputBranchId, branches.find(b => b.id === inputBranchId)?.name || ''));
        const totalPendapatan = grossTotal + hotTehExtraSubtotal + miloCharge;
        const totalAkhirCash = totalPendapatan - totalExpenses - Math.max(0, Number(qris) || 0);

        return {
            details,
            baseGross: grossTotal,
            hotTehExtraSubtotal,
            miloCharge,
            totalPendapatan,
            totalCups,
            totalAkhirCash,
            totalExpenses
        };
    }, [visibleProducts, stockData, hotTehExtraCount, miloQty, totalExpenses, qris, deposit, inputBranchId, branches]);

    const handleSubmit = (e) => {
        e.preventDefault();

        if (!inputBranchId) {
            showToast('Silakan pilih lokasi cabang berjualan!', 'error');
            return;
        }
        if (!staff1.trim()) {
            showToast('Nama Pegawai 1 wajib diisi untuk absensi!', 'error');
            return;
        }

        const invalidStockItems = visibleProducts.filter((product) => {
            const rowInitial = Number(stockData[product.id]?.initial) || 0;
            const rowFinal = Number(stockData[product.id]?.final) || 0;
            return rowFinal > rowInitial;
        });
        if (invalidStockItems.length > 0) {
            showToast(`Cek lagi stok ${invalidStockItems.map(p => p.name).join(', ')}: Stok Akhir tidak boleh lebih besar dari Stok Awal (penjualan akan tercatat 0).`, 'error');
            return;
        }

        const soldOutItems = visibleProducts.filter(p => {
            const row = stockData[p.id] || {};
            return (Number(row.initial) || 0) > 0 && !(Number(row.final) > 0);
        });
        if (soldOutItems.length > 0) {
            const proceed = window.confirm(`Stok Akhir ${soldOutItems.map(p => p.name).join(', ')} masih 0, artinya semuanya dianggap terjual habis. Lanjut simpan laporan?`);
            if (!proceed) return;
        }

        const normalizedExpenseItems = expenseItems
            .filter(item => item.name.trim() || parseCurrencyInput(item.amount) > 0)
            .map(item => ({
                name: item.name.trim(),
                amount: parseCurrencyInput(item.amount)
            }));

        const branchAdjustedStockData = Object.fromEntries(
            visibleProducts.map((product) => {
                const productStock = stockData[product.id] || { initial: 0, final: 0 };
                return [product.id, {
                    ...productStock,
                    price: getProductPriceByBranch(product.id, inputBranchId, branches.find(b => b.id === inputBranchId)?.name || '')
                }];
            })
        );

        const miloCharge = (Math.max(0, parseInt(miloQty) || 0)) * getMiloChargeForBranch(inputBranchId, branches.find(b => b.id === inputBranchId)?.name || '');

        const newLog = {
            id: 'log-' + Date.now(),
            branchId: inputBranchId,
            date,
            staff1: staff1.trim(),
            staff2: staff2.trim() || '-',
            items: branchAdjustedStockData,
            hotTehExtraCount: Math.max(0, parseInt(hotTehExtraCount) || 0),
            miloQty: Math.max(0, parseInt(miloQty) || 0),
            miloCharge,
            expenses: normalizedExpenseItems.reduce((sum, item) => sum + item.amount, 0),
            expenseItems: normalizedExpenseItems,
            qris: Math.max(0, Number(qris) || 0),
            deposit: Math.max(0, Number(deposit) || 0),
            notes: notes.trim(),
            materialStatus: Object.fromEntries(
                Object.entries(branchMaterialStock[inputBranchId] || {}).filter(([materialId]) => !isCupStockKey(materialId)).map(([materialId, value]) => [
                    materialId,
                    { qty: value?.qty || '0', status: value?.status || 'Aman' }
                ])
            ),
            createdBy: authUser?.uid || 'unknown-user',
            createdByName: authUser?.displayName || staff1.trim() || 'Karyawan',
            createdAt: new Date().toISOString()
        };

        // Stok bahan HANYA diubah lewat menu Stok. Menyimpan laporan penjualan tidak lagi
        // menulis/menimpa stok cabang (sebelumnya menyebarkan semua bahan ke semua cabang).

        // Stok Akhir otomatis masuk ke Stok > Perlengkapan (hanya produk yang diisi hari ini).
        const trackedProducts = visibleProducts.filter(p => {
            const row = stockData[p.id] || {};
            return (Number(row.initial) || 0) > 0 || (Number(row.final) || 0) > 0;
        });
        if (trackedProducts.length > 0) {
            setBranchMaterialStock(prev => {
                const branchMap = { ...(prev[inputBranchId] || {}) };
                trackedProducts.forEach(p => {
                    branchMap[getCupStockKey(p.id)] = {
                        qty: String(Math.max(0, parseInt(stockData[p.id]?.final, 10) || 0)),
                        status: 'Aman',
                        notes: 'Stok gelas',
                        updatedBy: authUser?.uid || 'system',
                        updatedAt: new Date().toISOString()
                    };
                });
                return { ...prev, [inputBranchId]: branchMap };
            });
        }

        onSaveLog(newLog);
    };

    return (
        <form onSubmit={handleSubmit} className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-100 text-amber-800 flex items-center justify-center text-xl font-bold">
                    <i className="fa-solid fa-receipt"></i>
                </div>
                <div>
                    <h2 className="text-xl font-extrabold text-brand-950">Form Pencatatan Laporan Penjualan Harian</h2>
                    <p className="text-xs text-gray-500">Absensi pegawai, stok gelas awal/akhir, tambahan Teh Panas, deposit, dan keuangan.</p>
                </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm text-brand-950 border-b border-brand-100 pb-2.5 flex items-center gap-2">
                    <i className="fa-solid fa-users text-amber-700"></i>
                    1. Lokasi Cabang & Absensi Pegawai
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Lokasi/Cabang Berjualan</label>
                        <select
                            value={inputBranchId}
                            onChange={(e) => setInputBranchId(e.target.value)}
                            className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-sm font-bold text-brand-950 focus:ring-2 focus:ring-amber-500"
                            required
                        >
                            {branches.map(b => (
                                <option key={b.id} value={b.id}>📍 {b.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Tanggal</label>
                        <input 
                            type="date"
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-sm font-bold text-brand-950 focus:ring-2 focus:ring-amber-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Pegawai 1 (Shift Utama)</label>
                        <input 
                            type="text"
                            placeholder="Nama Pegawai 1"
                            value={staff1}
                            onChange={(e) => setStaff1(e.target.value)}
                            className="w-full bg-white border border-brand-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Pegawai 2 (Opsional)</label>
                        <input 
                            type="text"
                            placeholder="Nama Pegawai 2"
                            value={staff2}
                            onChange={(e) => setStaff2(e.target.value)}
                            className="w-full bg-white border border-brand-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-4">
                <h3 className="font-extrabold text-sm text-brand-950 border-b border-brand-100 pb-2.5 flex items-center gap-2">
                    <i className="fa-solid fa-cup-straw text-amber-700"></i>
                    2. Input Stok Awal & Stok Akhir Gelas
                </h3>
                <p className="text-[11px] text-emerald-700 font-semibold -mt-2">
                    Stok Awal yang Anda isi tersimpan otomatis, jadi tetap ada walau keluar dari website. Bisa diubah kapan saja kalau ada penambahan. Setelah laporan disimpan, Stok Akhir otomatis masuk ke menu Stok → Perlengkapan dan jadi Stok Awal berikutnya.
                </p>

                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse stock-table">
                        <thead>
                            <tr className="bg-brand-50/80 text-brand-900 text-xs font-extrabold uppercase tracking-wider">
                                <th className="p-3 rounded-l-xl stock-name-header">Jenis Gelas/Produk</th>
                                <th className="p-3 stock-price-header">Harga Dasar</th>
                                <th className="p-3 w-24 stock-input-header">Stok Awal</th>
                                <th className="p-3 w-24 stock-input-header">Stok Akhir</th>
                                <th className="p-3 text-center stock-sold-header">Terjual</th>
                                <th className="p-3 text-right rounded-r-xl stock-subtotal-header">Subtotal</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-sm">
                            {visibleProducts.map(p => {
                                const price = getProductPriceByBranch(p.id, inputBranchId, branches.find(b => b.id === inputBranchId)?.name || '');
                                const calc = calculated.details[p.id] || { sold: 0, subtotal: 0 };
                                const rowInitial = Number(stockData[p.id]?.initial) || 0;
                                const rowFinal = Number(stockData[p.id]?.final) || 0;
                                const hasStockWarning = rowFinal > rowInitial;
                                return (
                                    <tr key={p.id} className={`hover:bg-amber-50/30 transition ${hasStockWarning ? 'bg-rose-50/60' : ''}`}>
                                        <td className="p-3 font-extrabold text-brand-950 flex items-center gap-2 stock-name">
                                            <i className={`fa-solid ${p.icon} text-amber-700 text-base`}></i>
                                            {p.name}
                                        </td>
                                        <td className="p-3 text-gray-600 font-semibold stock-price">{formatRp(price)}</td>
                                        <td className="p-3 stock-input-cell">
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={emptyIfZero(stockData[p.id]?.initial)}
                                                onChange={(e) => handleStockChange(p.id, 'initial', e.target.value)}
                                                className="w-16 bg-gray-50 border border-gray-300 rounded-lg p-1.5 font-bold text-center focus:bg-white focus:ring-2 focus:ring-amber-500 stock-input"
                                            />
                                        </td>
                                        <td className="p-3 stock-input-cell">
                                            <input 
                                                type="number" 
                                                min="0"
                                                value={emptyIfZero(stockData[p.id]?.final)}
                                                onChange={(e) => handleStockChange(p.id, 'final', e.target.value)}
                                                className={`w-16 bg-gray-50 border rounded-lg p-1.5 font-bold text-center focus:bg-white focus:ring-2 focus:ring-amber-500 stock-input ${hasStockWarning ? 'border-rose-400' : 'border-gray-300'}`}
                                            />
                                            {hasStockWarning && (
                                                <span className="block text-[9px] font-bold text-rose-600 mt-1 whitespace-nowrap">
                                                    ⚠ Akhir &gt; Awal, terjual dianggap 0
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-3 text-center stock-sold-cell">
                                            <span className={`font-extrabold px-3 py-1 rounded-full text-xs stock-sold ${hasStockWarning ? 'text-rose-900 bg-rose-100' : 'text-amber-900 bg-amber-100'}`}>
                                                {calc.sold}
                                            </span>
                                        </td>
                                        <td className="p-3 text-right font-black text-brand-900 stock-subtotal">
                                            {formatRp(calc.subtotal)}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>

                <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 space-y-2 mt-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div>
                            <h4 className="font-extrabold text-xs text-amber-950 uppercase tracking-wider flex items-center gap-1.5">
                                <i className="fa-solid fa-mug-hot text-amber-700"></i>
                                Aturan Tambahan Harga Teh Tarik Panas (+Rp 5.000)
                            </h4>
                            <p className="text-xs text-amber-800/90 mt-0.5">
                                Harga dasar Gelas Panas = Rp10.000. Jika pelanggan minta Teh Panas memakai <strong>Gelas Besar / Gelas Kecil</strong>, terdapat tambahan harga Rp 5.000 (Total Rp15.000).
                            </p>
                        </div>
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <label className="text-xs font-bold text-amber-950">Jumlah Porsi (+Rp 5k):</label>
                            <input 
                                type="number" 
                                min="0"
                                value={emptyIfZero(hotTehExtraCount)}
                                onChange={(e) => setHotTehExtraCount(e.target.value)}
                                className="w-20 bg-white border border-amber-300 rounded-xl p-2 text-center font-extrabold text-brand-950 text-sm focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>
                    {calculated.hotTehExtraSubtotal > 0 && (
                        <div className="text-right text-xs font-black text-amber-900 border-t border-amber-200/60 pt-2">
                            Subtotal Tambahan Teh Tarik Panas ({hotTehExtraCount} porsi × Rp5.000): +{formatRp(calculated.hotTehExtraSubtotal)}
                        </div>
                    )}
                    {calculated.miloCharge > 0 && (
                        <div className="text-right text-xs font-black text-amber-900 border-t border-amber-200/60 pt-2">
                            Tambahan Milo: +{formatRp(calculated.miloCharge)}
                        </div>
                    )}
                </div>

                {getMiloChargeForBranch(inputBranchId, branches.find(b => b.id === inputBranchId)?.name || '') > 0 && (
                    <div className="bg-amber-50/80 p-4 rounded-2xl border border-amber-200 mt-4">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                            <label className="text-xs font-bold text-amber-950">Jumlah Milo (x Rp2.000):</label>
                            <input 
                                type="number"
                                min="0"
                                value={emptyIfZero(miloQty)}
                                onChange={(e) => setMiloQty(e.target.value)}
                                className="w-20 bg-white border border-amber-300 rounded-xl p-2 text-center font-extrabold text-brand-950 text-sm focus:ring-2 focus:ring-amber-500"
                            />
                        </div>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-4">
                    <h3 className="font-extrabold text-sm text-brand-950 border-b border-brand-100 pb-2.5 flex items-center gap-2">
                        <i className="fa-solid fa-wallet text-amber-700"></i>
                        3. Input Pengeluaran, QRIS, & Deposit
                    </h3>

                    <div className="space-y-3.5">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Deposit Kas Masuk (Rp)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">Rp</span>
                                <input 
                                    type="text"
                                    inputMode="numeric"
                                    value={formatCurrencyInput(deposit) || ''}
                                    onChange={(e) => setDeposit(parseCurrencyInput(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 font-bold text-amber-900 focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Total Pembayaran Non-Tunai / QRIS (Rp)
                            </label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-xs font-bold text-gray-400">Rp</span>
                                <input 
                                    type="text"
                                    inputMode="numeric"
                                    value={formatCurrencyInput(qris) || ''}
                                    onChange={(e) => setQris(parseCurrencyInput(e.target.value))}
                                    className="w-full bg-white border border-gray-300 rounded-xl pl-9 pr-3 py-2 font-bold text-blue-900 focus:ring-2 focus:ring-amber-500"
                                />
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                Daftar Pengeluaran Operasional
                            </label>
                            <div className="space-y-2">
                                {expenseItems.map((item, index) => (
                                    <div key={item.id} className="grid grid-cols-[1.3fr,1fr,auto] gap-2 items-center">
                                        <input
                                            type="text"
                                            value={item.name}
                                            onChange={(e) => updateExpenseItem(item.id, 'name', e.target.value)}
                                            className="w-full bg-white border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium focus:ring-2 focus:ring-amber-500"
                                            placeholder="Nama item"
                                        />
                                        <div className="relative">
                                            <span className="absolute left-3 top-2.5 text-[10px] font-bold text-gray-400">Rp</span>
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                value={formatCurrencyInput(item.amount) || ''}
                                                onChange={(e) => updateExpenseItem(item.id, 'amount', e.target.value)}
                                                className="w-full bg-white border border-gray-300 rounded-xl pl-7 pr-2 py-2 text-xs font-bold text-rose-700 focus:ring-2 focus:ring-amber-500"
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeExpenseItem(item.id)}
                                            className="h-10 w-10 rounded-xl border border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                            disabled={expenseItems.length === 1}
                                            title="Hapus item"
                                        >
                                            <i className="fa-solid fa-xmark"></i>
                                        </button>
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addExpenseItem}
                                    className="inline-flex items-center gap-2 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 rounded-xl px-3 py-2 text-xs font-bold"
                                >
                                    <i className="fa-solid fa-plus"></i>
                                    Tambah Item Pengeluaran
                                </button>
                            </div>
                            <div className="mt-2 flex items-center justify-between rounded-xl bg-rose-50 border border-rose-200 px-3 py-2 text-xs font-bold text-rose-800">
                                <span>Total Pengeluaran</span>
                                <span>{formatRp(totalExpenses)}</span>
                            </div>
                        </div>

                    </div>
                </div>

                <div className="bg-gradient-to-br from-brand-950 via-darkRoast to-brand-900 p-6 rounded-3xl shadow-xl text-white border border-amberGold/40 flex flex-col justify-between">
                    <div>
                        <h3 className="text-amberGold text-xs font-extrabold uppercase tracking-wider mb-4 flex items-center gap-2">
                            <i className="fa-solid fa-calculator text-base"></i>
                            Ringkasan Perhitungan Keuangan
                        </h3>

                        <div className="space-y-2 text-sm border-b border-brand-800 pb-4">
                            <div className="flex justify-between text-brand-200">
                                <span>Total Penjualan Produk:</span>
                                <span className="font-bold text-white">{formatRp(calculated.baseGross)}</span>
                            </div>
                            <div className="flex justify-between text-amber-200">
                                <span>Tambahan Teh Tarik Panas:</span>
                                <span className="font-bold">+{formatRp(calculated.hotTehExtraSubtotal)}</span>
                            </div>
                            {calculated.miloCharge > 0 && (
                                <div className="flex justify-between text-amber-200">
                                    <span>Tambahan Milo:</span>
                                    <span className="font-bold">+{formatRp(calculated.miloCharge)}</span>
                                </div>
                            )}
                            <div className="flex justify-between text-emerald-300 font-bold border-t border-brand-800 pt-2">
                                <span>TOTAL PENDAPATAN:</span>
                                <span>{formatRp(calculated.totalPendapatan)}</span>
                            </div>
                            <div className="flex justify-between text-amber-300">
                                <span>Deposit</span>
                                <span className="font-bold">{formatRp(deposit)}</span>
                            </div>
                            <div className="flex justify-between text-rose-300">
                                <span>Pengeluaran (-)</span>
                                <span className="font-bold">-{formatRp(calculated.totalExpenses)}</span>
                            </div>
                            <div className="flex justify-between text-blue-300">
                                <span>QRIS (-)</span>
                                <span className="font-bold">-{formatRp(qris)}</span>
                            </div>
                        </div>

                        <div className="pt-4">
                            <span className="text-xs text-amberGold font-extrabold uppercase tracking-wider block">
                                TOTAL AKHIR SETORAN CASH
                            </span>
                            <div className="text-3xl sm:text-4xl font-black text-amber-100 mt-1">
                                {formatRp(calculated.totalAkhirCash)}
                            </div>
                            <p className="text-[11px] text-brand-300 mt-1">
                            </p>
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="w-full mt-6 bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black py-4 px-4 rounded-2xl shadow-xl transition transform active:scale-95 flex items-center justify-center gap-2 text-base"
                    >
                        <i className="fa-solid fa-floppy-disk text-lg"></i>
                        Simpan Laporan Harian
                    </button>
                </div>
            </div>

        </form>
    );
}

function InventoryView({ branches, selectedBranchId, materials, setMaterials, branchMaterialStock, setBranchMaterialStock, isAdminView = false, showToast }) {
    const activeBranchId = selectedBranchId !== 'ALL' ? selectedBranchId : branches[0]?.id;

    const [newItemName, setNewItemName] = useState('');
    const [newItemUnit, setNewItemUnit] = useState('bungkus');
    const [newItemCategory, setNewItemCategory] = useState('bahan');
    const [editingMaterialId, setEditingMaterialId] = useState(null);
    const [editingMaterialName, setEditingMaterialName] = useState('');

    const activeBranchStock = branchMaterialStock[activeBranchId] || {};

    // Admin dengan filter "Semua Cabang" melihat stok dari SEMUA cabang (tiap item diberi label cabangnya).
    // Admin dengan cabang tertentu, atau karyawan, hanya melihat satu cabang.
    const isAllView = isAdminView && selectedBranchId === 'ALL';
    const isFilledQty = (rawQty) => {
        const qtyText = (rawQty === undefined || rawQty === null) ? '' : String(rawQty).trim();
        return qtyText !== '' && qtyText !== '0';
    };

    const buildEntries = (categoryKey) => {
        const branchIds = isAllView ? branches.map(b => b.id) : [activeBranchId];
        const list = [];
        branchIds.forEach(branchId => {
            const branchStock = branchMaterialStock[branchId] || {};
            const branchName = branches.find(b => b.id === branchId)?.name || branchId;

            // Produk yang dijual (Gelas Besar, Gelas Kecil, Sanford, dll) otomatis jadi item Perlengkapan
            // di semua cabang. Jumlahnya diisi dari Stok Akhir pada form penjualan.
            const productList = categoryKey === 'perlengkapan'
                ? getVisibleProductsForBranch(branchId, branches.find(b => b.id === branchId)?.name || '')
                : [];
            const productNames = new Set(productList.map(p => p.name.trim().toLowerCase()));
            productList.forEach(p => {
                const stockKey = getCupStockKey(p.id);
                const stockData = branchStock[stockKey];
                const hasValue = stockData && String(stockData.qty ?? '').trim() !== '';
                if (isAdminView && !hasValue) return;
                list.push({
                    key: `${branchId}_${stockKey}`,
                    material: { id: stockKey, name: p.name },
                    data: stockData || { qty: '', status: 'Aman', notes: '' },
                    branchName,
                    isProduct: true,
                    unit: PRODUCT_STOCK_UNITS[p.id] || 'cup'
                });
            });

            materials.forEach(item => {
                if ((item.category || categoryKey) !== categoryKey) return;
                // Hindari dobel: item lama bernama sama dengan produk (mis. "Gelas Panas") disembunyikan.
                if (categoryKey === 'perlengkapan' && productNames.has(String(item.name || '').trim().toLowerCase())) return;
                if (!Object.prototype.hasOwnProperty.call(branchStock, item.id)) return;
                if (isAdminView && !isFilledQty(branchStock[item.id]?.qty)) return;
                list.push({ key: `${branchId}_${item.id}`, material: item, data: branchStock[item.id], branchName });
            });
        });
        return list;
    };

    const groupedMaterials = {
        bahan: buildEntries('bahan'),
        perlengkapan: buildEntries('perlengkapan')
    };

    const handleUpdateMaterial = (mId, field, value) => {
        if (isAdminView) return;
        setBranchMaterialStock(prev => {
            const currentBranchMap = { ...(prev[activeBranchId] || {}) };
            const currentMat = currentBranchMap[mId] || { qty: '', status: 'Aman', notes: '' };

            currentBranchMap[mId] = {
                ...currentMat,
                [field]: value
            };

            return {
                ...prev,
                [activeBranchId]: currentBranchMap
            };
        });
    };

    const handleAddNewMaterial = (e) => {
        e.preventDefault();
        if (isAdminView) return;
        if (!newItemName.trim()) return;

        const newM = {
            id: 'm-' + Date.now(),
            name: newItemName.trim(),
            defaultUnit: newItemUnit.trim() || 'pcs',
            category: newItemCategory
        };

        setMaterials(prev => [...prev, newM]);
        setBranchMaterialStock(prev => ({
            ...prev,
            [activeBranchId]: {
                ...(prev[activeBranchId] || {}),
                [newM.id]: {
                    qty: '',
                    status: 'Aman',
                    notes: 'Belum ada catatan',
                    updatedBy: 'system',
                    updatedAt: new Date().toISOString()
                }
            }
        }));
        setNewItemName('');
        setNewItemUnit('bungkus');
        setNewItemCategory('bahan');
        showToast(`Item ${newItemCategory === 'bahan' ? 'Bahan' : 'Perlengkapan Operasional'} "${newM.name}" berhasil ditambahkan!`);
    };

    const handleUpdateMaterialName = (mId) => {
        if (isAdminView) return;
        const trimmed = editingMaterialName.trim();
        if (!trimmed) return;

        setMaterials(prev => prev.map(material =>
            material.id === mId ? { ...material, name: trimmed } : material
        ));

        setEditingMaterialId(null);
        setEditingMaterialName('');
        showToast('Nama bahan berhasil diperbarui');
    };

    const handleDeleteMaterial = (mId) => {
        if (isAdminView) return;

        setBranchMaterialStock(prev => {
            const next = { ...prev };
            const currentBranch = { ...(next[activeBranchId] || {}) };
            delete currentBranch[mId];
            next[activeBranchId] = currentBranch;
            return next;
        });

        showToast('Item stok berhasil dihapus dari cabang ini');
    };

    const readOnlyNotice = isAdminView
        ? 'Mode lihat stok saja: hanya menampilkan bahan yang sudah diisi kondisinya oleh karyawan (item kosong/belum diisi disembunyikan).'
        : 'Isi kondisi stok dengan teks bebas seperti 1/2 toples, 1 bungkus, 2 pak, atau hampir habis.';

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                        <i className="fa-solid fa-boxes-stacked text-amber-700"></i>
                        Kelola Stok Bahan & Perlengkapan Operasional
                    </h2>
                    <p className="text-xs text-gray-500">
                        {readOnlyNotice}
                    </p>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-gray-600">Cabang:</span>
                    <span className="px-3 me-1 py-1.5 rounded-xl bg-amber-100 text-amber-950 font-extrabold text-xs border border-amber-300">
                        📍 {isAllView ? 'Semua Cabang' : branches.find(b => b.id === activeBranchId)?.name}
                    </span>
                    {!isAdminView && selectedBranchId === 'ALL' && (
                        <span className="text-[10px] font-bold text-rose-600">
                            Cabang belum dipilih! Pilih cabang di kanan atas, kalau tidak data masuk ke cabang pertama.
                        </span>
                    )}
                </div>
            </div>

            {!isAdminView && (
                <form onSubmit={handleAddNewMaterial} className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-3">
                    <h3 className="font-extrabold text-xs text-brand-950 uppercase tracking-wider">
                        ➕ Tambah Item Stok Baru
                    </h3>
                    <div className="flex flex-col sm:flex-row gap-3">
                        <input 
                            type="text"
                            placeholder="Nama item stok"
                            value={newItemName}
                            onChange={(e) => setNewItemName(e.target.value)}
                            className="flex-1 bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-amber-500"
                            required
                        />
                        <select
                            value={newItemCategory}
                            onChange={(e) => setNewItemCategory(e.target.value)}
                            className="w-full sm:w-52 bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-xs font-bold focus:ring-2 focus:ring-amber-500"
                        >
                            <option value="bahan">Kategori: Bahan</option>
                            <option value="perlengkapan">Kategori: Perlengkapan Operasional</option>
                        </select>
                        <button
                            type="submit"
                            className="bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black px-5 py-2 rounded-xl text-xs shadow-md whitespace-nowrap"
                        >
                            Simpan Item Baru
                        </button>
                    </div>
                </form>
            )}

            <div className="space-y-6">
                {[
                    {
                        key: 'bahan',
                        title: 'Stok Bahan',
                        icon: 'fa-seedling',
                        description: 'Bahan baku utama produksi seperti susu, teh, gula, dan bahan campuran.'
                    },
                    {
                        key: 'perlengkapan',
                        title: 'Perlengkapan Operasional',
                        icon: 'fa-toolbox',
                        description: 'Alat dan kebutuhan operasi pendukung. Stok produk yang dijual (gelas, Sanford, dll) terisi otomatis dari Stok Akhir laporan penjualan.'
                    }
                ].map(group => {
                    const items = groupedMaterials[group.key] || [];

                    return (
                        <div key={group.key} className="bg-white p-3 sm:p-5 rounded-2xl sm:rounded-3xl border border-brand-200/80 shadow-sm">
                            <div className="mb-3 sm:mb-4 flex items-center justify-between gap-2 sm:gap-3 border-b border-brand-100 pb-2 sm:pb-3">
                                <div className="min-w-0">
                                    <h3 className="font-extrabold text-sm sm:text-base text-brand-950 flex items-center gap-2">
                                        <i className={`fa-solid ${group.icon} text-amber-700 text-xs sm:text-sm`}></i>
                                        {group.title}
                                    </h3>
                                    <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1">{group.description}</p>
                                </div>
                                <span className="text-[10px] sm:text-[11px] font-black px-2 py-1 sm:px-2.5 sm:py-1 rounded-full bg-brand-100 text-brand-800 border border-brand-200 whitespace-nowrap">
                                    {items.length} item
                                </span>
                            </div>

                            {items.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-gray-300 bg-gray-50 p-4 text-center text-xs text-gray-500">
                                    Belum ada item di kategori {group.title.toLowerCase()}.
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-3">
                                    {items.map(entry => {
                                        const m = entry.material;
                                        const data = entry.data || { qty: '', status: 'Aman', notes: 'Belum ada catatan' };
                                        const isProduct = Boolean(entry.isProduct);

                                        return (
                                            <div key={entry.key} className="bg-brand-50/50 p-2.5 rounded-xl border border-brand-200/80 shadow-sm min-w-0">
                                                <div className="border-b border-gray-100 pb-1.5 flex items-start justify-between gap-2">
                                                    <div className="font-extrabold text-brand-950 text-[10px] leading-tight break-words flex-1">
                                                        {m.name}
                                                        {isAllView && (
                                                            <span className="block text-[9px] font-bold text-amber-700 mt-0.5">📍 {entry.branchName}</span>
                                                        )}
                                                    </div>
                                                    {!isAdminView && !isProduct && (
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteMaterial(m.id)}
                                                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-[10px] font-bold border border-rose-200"
                                                            title="Hapus item stok"
                                                        >
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="mt-2 rounded-lg bg-white border border-brand-200 px-2 py-2 shadow-sm min-w-0">
                                                    <div className="text-[8px] font-extrabold uppercase tracking-wide text-gray-500 mb-1">
                                                        Kondisi stok
                                                    </div>
                                                    {isProduct ? (
                                                        isAdminView ? (
                                                            <div className="text-xs font-bold text-brand-950 break-words min-h-[28px]">
                                                                {String(data.qty ?? '').trim() !== '' ? `${data.qty} ${entry.unit}` : 'Belum ada catatan stok'}
                                                            </div>
                                                        ) : (
                                                            <div className="flex items-baseline gap-1.5">
                                                                <input
                                                                    type="text"
                                                                    inputMode="numeric"
                                                                    value={data.qty ?? ''}
                                                                    onChange={(e) => handleUpdateMaterial(m.id, 'qty', e.target.value.replace(/\D/g, ''))}
                                                                    placeholder="0"
                                                                    className="w-full bg-transparent border-0 p-0 text-xs font-bold text-brand-950 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                                                />
                                                                <span className="text-xs font-bold text-gray-500 shrink-0">{entry.unit}</span>
                                                            </div>
                                                        )
                                                    ) : isAdminView ? (
                                                        <div className="text-xs font-bold text-brand-950 break-words min-h-[28px]">
                                                            {data.qty || 'Belum ada catatan stok'}
                                                        </div>
                                                    ) : (
                                                        <input
                                                            type="text"
                                                            value={data.qty || ''}
                                                            onChange={(e) => handleUpdateMaterial(m.id, 'qty', e.target.value)}
                                                            placeholder="Contoh: 1/2 toples, 1 bungkus, 2 pak, hampir habis"
                                                            className="w-full bg-transparent border-0 p-0 text-xs font-bold text-brand-950 placeholder:text-gray-400 focus:outline-none focus:ring-0"
                                                        />
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

const buildExpenseCategoryRekap = (logs) => {
    const map = {};
    logs.forEach(log => {
        (log.expenseItems || []).forEach(item => {
            const rawName = (item.name || '').trim();
            const amount = Math.max(0, Number(item.amount) || 0);
            if (!rawName || amount <= 0) return;
            const key = rawName.toLowerCase();
            if (!map[key]) {
                map[key] = { label: rawName, total: 0, count: 0 };
            }
            map[key].total += amount;
            map[key].count += 1;
        });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
};

const exportLogsToExcel = (logs, getBranchName, showToast) => {
    if (typeof XLSX === 'undefined') {
        showToast && showToast('Fitur Excel belum termuat, cek koneksi internet lalu muat ulang halaman.', 'error');
        return;
    }
    if (!logs.length) {
        showToast && showToast('Tidak ada data pada filter ini untuk diekspor.', 'error');
        return;
    }

    const rows = [...logs]
        .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
        .map(log => {
            const pendapatan = calculateLogGross(log);
            const qris = Math.max(0, Number(log.qris) || 0);
            const expenses = Math.max(0, Number(log.expenses) || 0);
            const deposit = Math.max(0, Number(log.deposit) || 0);
            const cash = pendapatan - expenses - qris;
            return {
                'Tanggal': log.date || '',
                'Cabang': getBranchName(log.branchId) || log.branchId || '',
                'Pegawai 1': log.staff1 || '',
                'Pegawai 2': log.staff2 || '',
                'Pendapatan': pendapatan,
                'QRIS': qris,
                'Pengeluaran': expenses,
                'Cash (Setoran)': cash,
                'Deposit (Info)': deposit,
                'Dibuat Oleh': log.createdByName || ''
            };
        });

    const totalRow = {
        'Tanggal': 'TOTAL', 'Cabang': '', 'Pegawai 1': '', 'Pegawai 2': '',
        'Pendapatan': rows.reduce((sum, r) => sum + r['Pendapatan'], 0),
        'QRIS': rows.reduce((sum, r) => sum + r['QRIS'], 0),
        'Pengeluaran': rows.reduce((sum, r) => sum + r['Pengeluaran'], 0),
        'Cash (Setoran)': rows.reduce((sum, r) => sum + r['Cash (Setoran)'], 0),
        'Deposit (Info)': rows.reduce((sum, r) => sum + r['Deposit (Info)'], 0),
        'Dibuat Oleh': ''
    };
    rows.push(totalRow);

    const worksheet = XLSX.utils.json_to_sheet(rows);
    worksheet['!cols'] = [
        { wch: 12 }, { wch: 18 }, { wch: 16 }, { wch: 16 },
        { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 16 }
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Laporan Penjualan');

    const expenseRekap = buildExpenseCategoryRekap(logs);
    if (expenseRekap.length > 0) {
        const expenseRows = expenseRekap.map(row => ({
            'Kategori Pengeluaran': row.label,
            'Total': row.total,
            'Berapa Kali Dicatat': row.count
        }));
        expenseRows.push({
            'Kategori Pengeluaran': 'TOTAL',
            'Total': expenseRekap.reduce((sum, r) => sum + r.total, 0),
            'Berapa Kali Dicatat': expenseRekap.reduce((sum, r) => sum + r.count, 0)
        });
        const expenseSheet = XLSX.utils.json_to_sheet(expenseRows);
        expenseSheet['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 18 }];
        XLSX.utils.book_append_sheet(workbook, expenseSheet, 'Rekap Pengeluaran');
    }

    const today = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(workbook, `Laporan-Penjualan-${today}.xlsx`);
    showToast && showToast(`Berhasil mengekspor ${logs.length} laporan ke Excel`);
};

function HistoryView({ branches, selectedBranchId, salesLogs, setSalesLogs, getBranchName, onOpenReport, setConfirmModal, showToast, role, currentUserId }) {
    const [dateFilter, setDateFilter] = useState('');
    const [periodFilter, setPeriodFilter] = useState('all');

    const filteredLogs = useMemo(() => {
        return salesLogs.filter(log => {
            if (role === 'karyawan' && currentUserId && log.createdBy !== currentUserId) {
                return false;
            }

            const matchBranch = selectedBranchId === 'ALL' || log.branchId === selectedBranchId;
            const matchDate = !dateFilter || log.date === dateFilter;
            const matchPeriod = periodFilter === 'all' || matchesPeriod(log.date, periodFilter);
            return matchBranch && matchDate && matchPeriod;
        });
    }, [salesLogs, selectedBranchId, dateFilter, periodFilter, role, currentUserId]);

    const canDeleteLog = role === 'admin';

    const handleDelete = (id) => {
        setConfirmModal({
            title: 'Hapus Laporan Transaksi',
            message: 'Apakah Anda yakin ingin menghapus data laporan penjualan ini secara permanen?',
            onConfirm: () => {
                setSalesLogs(salesLogs.filter(l => l.id !== id));
                showToast('Data riwayat berhasil dihapus');
            }
        });
    };

    return (
        <div className="space-y-6">
            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                        <i className="fa-solid fa-clock-rotate-left text-amber-700"></i>
                        Riwayat Transaksi & Laporan
                    </h2>
                    <p className="text-xs text-gray-500">Buka kembali data penjualan dan unduh laporan bukti.</p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs font-bold text-gray-600 whitespace-nowrap">Filter Tanggal:</span>
                    <input 
                        type="date"
                        value={dateFilter}
                        onChange={(e) => setDateFilter(e.target.value)}
                        className="bg-brand-50 border border-brand-300 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-950 focus:ring-2 focus:ring-amber-500"
                    />
                    <select
                        value={periodFilter}
                        onChange={(e) => setPeriodFilter(e.target.value)}
                        className="bg-brand-50 border border-brand-300 rounded-xl px-3 py-1.5 text-xs font-bold text-brand-950 focus:ring-2 focus:ring-amber-500"
                    >
                        <option value="all">Semua Periode</option>
                        <option value="day">Hari Ini</option>
                        <option value="week">7 Hari Terakhir</option>
                        <option value="month">Bulan Ini</option>
                    </select>
                    {(dateFilter || periodFilter !== 'all') && (
                        <button 
                            onClick={() => {
                                setDateFilter('');
                                setPeriodFilter('all');
                            }}
                            className="text-xs font-bold text-rose-600 hover:underline ml-1"
                        >
                            Reset
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={() => exportLogsToExcel(filteredLogs, getBranchName, showToast)}
                        className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs px-3 py-2 rounded-xl shrink-0"
                    >
                        <i className="fa-solid fa-file-excel"></i>
                        Ekspor Excel
                    </button>
                </div>
            </div>

            {filteredLogs.length === 0 ? (
                <div className="bg-white p-12 rounded-3xl border border-dashed border-brand-300 text-center space-y-3">
                    <div className="w-16 h-16 rounded-2xl bg-amber-50 text-amber-800 mx-auto flex items-center justify-center text-2xl font-bold">
                        <i className="fa-solid fa-folder-open"></i>
                    </div>
                    <h3 className="font-extrabold text-brand-950 text-base">Belum Ada Riwayat Laporan</h3>
                    <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        Belum ada data laporan transaksi tersimpan untuk cabang atau tanggal yang Anda pilih.
                    </p>
                </div>
            ) : (
                <div className="space-y-4">
                    {filteredLogs.map(log => {
                        let gross = 0;
                        let cups = 0;
                        Object.keys(log.items || {}).forEach(pId => {
                            const item = log.items[pId];
                            const sold = Math.max(0, (item.initial || 0) - (item.final || 0));
                            gross += sold * (item.price || 0);
                            cups += sold;
                        });
                        const hotExtra = (log.hotTehExtraCount || 0) * 5000;
                        const miloCharge = ((log.miloQty || 0) * getMiloChargeForBranch(log.branchId || '', getBranchName(log.branchId))) || (log.miloCharge || 0);
                        const totalPendapatan = gross + hotExtra + miloCharge;
                        const totalAkhirCash = totalPendapatan - Math.max(0, Number(log.expenses) || 0) - Math.max(0, Number(log.qris) || 0);

                        return (
                            <div key={log.id} className="bg-white p-5 rounded-3xl border border-brand-200 hover:border-amberGold/80 shadow-sm transition flex flex-col md:flex-row md:items-center justify-between gap-4">
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-950 font-extrabold text-xs border border-amber-300">
                                            📍 {getBranchName(log.branchId)}
                                        </span>
                                        <span className="text-xs font-bold text-gray-500">
                                            <i className="fa-regular fa-calendar-check mr-1 text-amber-700"></i>
                                            {log.date}
                                        </span>
                                        <span className="text-xs font-bold bg-gray-100 text-gray-700 px-2.5 py-0.5 rounded-md">
                                            <i className="fa-solid fa-user-gear mr-1 text-gray-500"></i>
                                            Pegawai: {log.staff1} {log.staff2 && log.staff2 !== '-' ? `& ${log.staff2}` : ''}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
                                        <div>
                                            <span className="text-[11px] text-gray-500 block">Total Terjual</span>
                                            <span className="font-black text-brand-950 text-sm">{cups} Gelas</span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-gray-500 block">Total Pendapatan</span>
                                            <span className="font-black text-emerald-700 text-sm">{formatRp(totalPendapatan)}</span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-gray-500 block">QRIS / Pengeluaran (pengurang Cash)</span>
                                            <span className="font-bold text-gray-700 text-xs block">
                                                -{formatRp(log.qris)} / -{formatRp(log.expenses)}
                                            </span>
                                            <span className="text-[10px] text-gray-400 block mt-0.5">
                                                Deposit (info, tidak mengurangi/menambah Cash): {formatRp(log.deposit)}
                                            </span>
                                        </div>
                                        <div>
                                            <span className="text-[11px] text-gray-500 block">Setoran Cash Akhir</span>
                                            <span className="font-black text-amber-900 text-sm">{formatRp(totalAkhirCash)}</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 border-t md:border-t-0 pt-3 md:pt-0 border-gray-100">
                                    <button
                                        onClick={() => onOpenReport(log)}
                                        className="flex-1 md:flex-none px-4 py-2.5 rounded-xl bg-gradient-to-r from-brand-900 to-brand-950 hover:from-amber-800 hover:to-brand-900 text-amberGold font-extrabold text-xs shadow-md border border-amberGold/30 flex items-center justify-center gap-2 transition"
                                    >
                                        <i className="fa-solid fa-file-image text-sm"></i>
                                        Laporan Gambar
                                    </button>
                                    {canDeleteLog && (
                                        <button
                                            onClick={() => handleDelete(log.id)}
                                            className="p-2.5 rounded-xl bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold transition border border-rose-200"
                                            title="Hapus Laporan"
                                        >
                                            <i className="fa-solid fa-trash-can"></i>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function BranchManagementView({ branches, setBranches, salesLogs, setConfirmModal, showToast }) {
    const [newBranchName, setNewBranchName] = useState('');
    const [newBranchLocation, setNewBranchLocation] = useState('');
    const [newBranchProducts, setNewBranchProducts] = useState([]);
    const [editingBranch, setEditingBranch] = useState(null);

    const toggleProductSelection = (productId, currentSelected) => {
        const next = currentSelected.includes(productId)
            ? currentSelected.filter(id => id !== productId)
            : [...currentSelected, productId];

        return next;
    };

    const selectedProductIds = editingBranch ? getBranchProductIds(editingBranch) : newBranchProducts;

    const handleAddBranch = (e) => {
        e.preventDefault();
        if (!newBranchName.trim()) return;
        if (newBranchProducts.length === 0) {
            showToast('Pilih minimal satu produk penjualan untuk cabang baru.', 'error');
            return;
        }

        const newB = {
            id: 'b-' + Date.now(),
            name: newBranchName.trim(),
            location: newBranchLocation.trim() || 'Lokasi Baru',
            active: true,
            productIds: [...new Set(newBranchProducts)]
        };

        setBranches([...branches, newB]);
        setNewBranchName('');
        setNewBranchLocation('');
        setNewBranchProducts([]);
        showToast(`Cabang "${newB.name}" berhasil ditambahkan!`);
    };

    const handleUpdateBranch = (e) => {
        e.preventDefault();
        if (!editingBranch) return;
        if (selectedProductIds.length === 0) {
            showToast('Pilih minimal satu produk penjualan untuk cabang ini.', 'error');
            return;
        }

        setBranches(branches.map(b => b.id === editingBranch.id ? { ...editingBranch, productIds: selectedProductIds } : b));
        setEditingBranch(null);
        showToast('Detail cabang berhasil diperbarui');
    };

    const handleDeleteBranch = (id) => {
        const logsCount = salesLogs.filter(l => l.branchId === id).length;
        setConfirmModal({
            title: 'Hapus Lokasi Cabang',
            message: logsCount > 0 
                ? `Cabang ini memiliki ${logsCount} riwayat laporan. Menghapus tidak akan menghapus riwayat lama, namun lokasi tidak dapat dipilih untuk input baru. Lanjutkan?`
                : 'Apakah Anda yakin ingin menghapus lokasi cabang ini?',
            onConfirm: () => {
                setBranches(branches.filter(b => b.id !== id));
                showToast('Cabang berhasil dihapus');
            }
        });
    };

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm">
                <h2 className="text-xl font-extrabold text-brand-950 flex items-center gap-2">
                    <i className="fa-solid fa-store text-amber-700"></i>
                    Kelola Lokasi Cabang "Teh Tarik Kaw Kaw"
                </h2>
                <p className="text-xs text-gray-500">Tambah lokasi baru atau perbarui nama cabang operasional.</p>
            </div>

            <form onSubmit={editingBranch ? handleUpdateBranch : handleAddBranch} className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-4">
                <h3 className="font-bold text-xs text-brand-950 uppercase tracking-wider border-b border-brand-100 pb-2">
                    {editingBranch ? '✏️ Edit Lokasi Cabang' : '➕ Tambah Lokasi Cabang Baru'}
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Nama Cabang / Lokasi</label>
                        <input 
                            type="text"
                            placeholder="Misal: Teh Tarik di Lapangan Merdeka"
                            value={editingBranch ? editingBranch.name : newBranchName}
                            onChange={(e) => editingBranch ? setEditingBranch({ ...editingBranch, name: e.target.value }) : setNewBranchName(e.target.value)}
                            className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-sm font-bold text-brand-950 focus:ring-2 focus:ring-amber-500"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Keterangan Lokasi</label>
                        <input 
                            type="text"
                            placeholder="Misal: Samping gate utama"
                            value={editingBranch ? editingBranch.location : newBranchLocation}
                            onChange={(e) => editingBranch ? setEditingBranch({ ...editingBranch, location: e.target.value }) : setNewBranchLocation(e.target.value)}
                            className="w-full bg-brand-50 border border-brand-300 rounded-xl px-3 py-2 text-sm font-medium focus:ring-2 focus:ring-amber-500"
                        />
                    </div>
                </div>

                <div className="space-y-2 pt-1">
                    <label className="block text-xs font-bold text-gray-700">Produk Penjualan yang Tersedia di Cabang</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {SALES_PRODUCT_OPTIONS.map((product) => {
                            const checked = selectedProductIds.includes(product.id);
                            const currentSelection = (editingBranch ? getBranchProductIds(editingBranch) : newBranchProducts);
                            return (
                                <label key={product.id} className="flex items-center gap-2 p-2 rounded-xl border border-brand-200 bg-brand-50 cursor-pointer hover:bg-amber-50">
                                    <input
                                        type="checkbox"
                                        checked={checked}
                                        onChange={() => {
                                            const nextValue = toggleProductSelection(product.id, currentSelection);
                                            if (editingBranch) {
                                                setEditingBranch({ ...editingBranch, productIds: nextValue });
                                            } else {
                                                setNewBranchProducts(nextValue);
                                            }
                                        }}
                                        className="h-4 w-4 text-amber-600 border-amber-300 rounded focus:ring-amber-500"
                                    />
                                    <span className="text-xs font-bold text-brand-950">{product.label}</span>
                                </label>
                            );
                        })}
                    </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                    <button
                        type="submit"
                        className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black text-xs shadow-md transition"
                    >
                        {editingBranch ? 'Simpan Perubahan' : 'Tambah Cabang Baru'}
                    </button>

                    {editingBranch && (
                        <button
                            type="button"
                            onClick={() => setEditingBranch(null)}
                            className="px-4 py-2.5 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold text-xs"
                        >
                            Batal Edit
                        </button>
                    )}
                </div>
            </form>

            <div className="bg-white p-5 rounded-3xl border border-brand-200/80 shadow-sm space-y-3">
                <h3 className="font-bold text-xs text-brand-950 uppercase tracking-wider border-b border-brand-100 pb-2">
                    Daftar Cabang Aktif ({branches.length})
                </h3>

                <div className="divide-y divide-gray-100">
                    {branches.map(b => (
                        <div key={b.id} className="py-3 flex items-center justify-between gap-3">
                            <div>
                                <div className="font-extrabold text-brand-950 text-sm flex items-center gap-2">
                                    📍 {b.name}
                                </div>
                                <div className="text-xs text-gray-500">{b.location}</div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setEditingBranch(b)}
                                    className="p-2 rounded-lg bg-amber-50 text-amber-900 hover:bg-amber-100 text-xs font-bold border border-amber-200"
                                    title="Edit Cabang"
                                >
                                    <i className="fa-solid fa-pen"></i>
                                </button>
                                <button
                                    onClick={() => handleDeleteBranch(b.id)}
                                    className="p-2 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 text-xs font-bold border border-rose-200"
                                    title="Hapus Cabang"
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

function ReportExportModal({ log, branchName, materials, branchMaterialStock = {}, onClose }) {
    const reportRef = useRef(null);
    const [isGenerating, setIsGenerating] = useState(false);

    let baseGross = 0;
    let totalCups = 0;
    const glassRows = [];

    getVisibleProductsForBranch(log.branchId, branchName).forEach(p => {
        const itemPrice = getProductPriceByBranch(p.id, log.branchId, branchName);
        const item = log.items?.[p.id] || { initial: 0, final: 0, price: itemPrice };
        const sold = Math.max(0, (item.initial || 0) - (item.final || 0));
        const subtotal = sold * (item.price || itemPrice || 0);
        baseGross += subtotal;
        totalCups += sold;

        glassRows.push({
            name: p.name,
            price: item.price || itemPrice || 0,
            initial: item.initial || 0,
            final: item.final || 0,
            sold,
            subtotal
        });
    });

    const hotTehExtraCount = log.hotTehExtraCount || 0;
    const hotTehExtraSubtotal = hotTehExtraCount * 5000;
    const miloQty = log.miloQty || 0;
    const miloCharge = (log.miloCharge || 0) || (miloQty * getMiloChargeForBranch(log.branchId || '', branchName));
    const totalPendapatan = baseGross + hotTehExtraSubtotal + miloCharge;

    const fallbackStock = branchMaterialStock[log.branchId] || {};
    const materialStatusMap = log.materialStatus && Object.keys(log.materialStatus).length > 0 ? log.materialStatus : fallbackStock;
    const stockRows = Object.entries(materialStatusMap || {})
        .filter(([mId, value]) => {
            if (isCupStockKey(mId)) return false;
            const rawQty = typeof value === 'string' ? value : (value?.qty ?? '');
            const cleanQty = String(rawQty ?? '').trim();
            return cleanQty !== '' && cleanQty !== '0' && cleanQty.toLowerCase() !== 'belum ada catatan';
        })
        .map(([mId, value]) => {
            const material = materials.find((item) => item.id === mId);
            const qtyValue = typeof value === 'string' ? value : (value?.qty ?? '');
            const qtyLabel = String(qtyValue ?? '').trim();

            return {
                id: mId,
                name: material?.name || mId,
                qty: qtyLabel
            };
        });

    const deposit = Math.max(0, Number(log.deposit) || 0);
    const expenses = Math.max(0, Number(log.expenses) || 0);
    const qris = Math.max(0, Number(log.qris) || 0);
    const totalAkhirCash = totalPendapatan - expenses - qris;

    const handleShareWhatsApp = () => {
        const lines = [];
        lines.push('*CHA NOM YEN - Teh Tarik Malaysia*');
        lines.push(`📍 ${branchName}`);
        lines.push(`🗓️ ${log.date}`);
        lines.push(`👤 ${log.staff1}${log.staff2 && log.staff2 !== '-' ? ' & ' + log.staff2 : ''}`);
        lines.push('');
        lines.push('*Rincian Stok Gelas (Awal - Akhir = Jual = Subtotal)*');
        glassRows.forEach(row => {
            lines.push(`- ${row.name}: ${row.initial} - ${row.final} = ${row.sold} = ${formatRp(row.subtotal)}`);
        });
        if (hotTehExtraCount > 0) {
            lines.push(`- Tambahan Teh Panas: ${hotTehExtraCount} x Rp5k = +${formatRp(hotTehExtraSubtotal)}`);
        }
        if (miloCharge > 0) {
            lines.push(`- Tambahan Milo: +${formatRp(miloCharge)}`);
        }
        lines.push('');
        lines.push(`*TOTAL PENDAPATAN: ${formatRp(totalPendapatan)}*`);
        lines.push(`Deposit Kas: ${formatRp(deposit)}`);
        if ((log.expenseItems || []).length > 0) {
            lines.push('Rincian Pengeluaran:');
            log.expenseItems.forEach(item => {
                const amt = Math.max(0, Number(item.amount) || 0);
                if (item.name && amt > 0) lines.push(`  - ${item.name}: -${formatRp(amt)}`);
            });
        }
        lines.push(`Pengeluaran Operasional (-): -${formatRp(expenses)}`);
        lines.push(`QRIS Non-Tunai (-): -${formatRp(qris)}`);
        lines.push(`*TOTAL AKHIR (SETORAN CASH): ${formatRp(totalAkhirCash)}*`);
        if (stockRows.length > 0) {
            lines.push('');
            lines.push('*Stok Bahan & Perlengkapan:*');
            stockRows.forEach(item => {
                lines.push(`- ${item.name}: ${item.qty}`);
            });
        }
        lines.push('');
        lines.push('_Laporan Penjualan Resmi - CHA NOM YEN Teh Tarik Malaysia Kaw Kaw Punye Sedapp_');

        const text = encodeURIComponent(lines.join('\n'));
        const base = ADMIN_WHATSAPP_NUMBER
            ? `https://wa.me/${ADMIN_WHATSAPP_NUMBER}`
            : 'https://api.whatsapp.com/send';
        window.open(`${base}?text=${text}`, '_blank');
    };

    const handleDownloadImage = async () => {
        if (!reportRef.current) {
            console.error('Report export target not found');
            return;
        }

        setIsGenerating(true);

        try {
            console.log('Preparing report export image...', {
                branchName,
                logId: log.id,
                width: reportRef.current.getBoundingClientRect().width,
                height: reportRef.current.getBoundingClientRect().height
            });

            const fileName = `laporan-transaksi-${log.date}.png`;
            await captureElementToPng(reportRef.current, fileName, {
                width: 1080,
                height: 1920,
                background: '#21120b'
            });
        } catch (err) {
            console.error('Failed to capture report image:', err);
            alert(`Download gagal: ${err.message || 'Tidak diketahui. Cek console untuk detail.'}`);
        } finally {
            setIsGenerating(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div className="bg-brand-950 rounded-3xl p-4 sm:p-6 max-w-xl w-full border border-amberGold/50 shadow-2xl space-y-4 my-auto">
                <div className="flex items-center justify-between text-white border-b border-brand-800 pb-3">
                    <div>
                        <h3 className="font-extrabold text-amber-100 text-base sm:text-lg flex items-center gap-2">
                            <i className="fa-solid fa-file-image text-amberGold"></i>
                            Pratinjau Gambar Laporan Rasio 9:16
                        </h3>
                        <p className="text-xs text-brand-300">Format portrait siap dikirim ke WhatsApp / Story Media Sosial</p>
                    </div>
                    <button 
                        onClick={onClose}
                        className="w-8 h-8 rounded-full bg-brand-800 hover:bg-brand-700 text-gray-300 flex items-center justify-center"
                    >
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                </div>

                <div className="overflow-x-auto overflow-y-visible flex justify-center py-2">
                    <div 
                        ref={reportRef}
                        className="bg-gradient-to-b from-brand-950 via-[#2a170e] to-darkRoast text-white p-5 rounded-3xl border-2 border-amberGold/60 shadow-2xl space-y-3 text-xs font-sans relative flex flex-col justify-between"
                        style={{ width: '100%', maxWidth: '420px', minHeight: '720px', height: 'auto', overflow: 'visible', boxSizing: 'border-box' }}
                    >
                        <div className="absolute top-0 right-0 w-48 h-48 bg-amberGold/10 rounded-full blur-3xl pointer-events-none"></div>

                        <div>
                            <div className="text-center border-b border-amberGold/30 pb-3 space-y-0.5">
                                <div className="flex flex-col items-center gap-1.5 mb-1 px-2">
                                    <div className="w-11 h-11 rounded-xl bg-amberGold p-1 flex items-center justify-center shadow-md shrink-0">
                                        <img src={APP_LOGO_DATA_URI} alt="Logo Cha Nom Yen" className="w-full h-full object-cover rounded-lg" />
                                    </div>
                                    <div className="text-center w-full">
                                        <h2 className="font-black text-amber-100 text-base leading-tight uppercase">
                                            CHA NOM YEN
                                        </h2>
                                        <div className="text-[10px] text-brand-200 font-bold leading-tight mt-0.5">
                                            Teh Tarik Malaysia
                                        </div>
                                        <span className="inline-block text-[9px] px-2 py-0.5 rounded bg-amberGold text-brand-950 font-black uppercase mt-1">
                                            Kaw Kaw Punye Sedapp
                                        </span>
                                    </div>
                                </div>

                                <div className="pt-1">
                                    <h1 className="text-base font-black text-amber-300 tracking-tight leading-snug">
                                        📍 {branchName}
                                    </h1>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2 bg-brand-900/90 p-2 rounded-xl border border-brand-700/60 text-[11px] my-2">
                                <div>
                                    <span className="text-brand-400 font-bold block text-[9px] uppercase">Tanggal:</span>
                                    <span className="font-black text-white">{log.date}</span>
                                </div>
                                <div>
                                    <span className="text-brand-400 font-bold block text-[9px] uppercase">Pegawai:</span>
                                    <span
    className="font-bold text-amber-200 block"
    style={{
        lineHeight: '1.5',
        overflow: 'visible'
    }}
>
                                        {log.staff1} {log.staff2 && log.staff2 !== '-' ? `& ${log.staff2}` : ''}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-1 mb-2">
                                <div className="flex justify-between text-[10px] font-extrabold text-amberGold uppercase tracking-wider px-1">
                                    <span>Rincian Stok Gelas</span>
                                    <span>Awal - Akhir = Jual</span>
                                    <span>Subtotal</span>
                                </div>

                                <div className="space-y-0.5 bg-brand-900/40 p-2 rounded-xl border border-brand-800">
                                    {glassRows.map((row, idx) => (
                                        <div key={idx} className="flex items-center justify-between text-[11px] py-0.5 border-b border-brand-800/40 last:border-0">
                                            <span className="font-bold text-brand-100">{row.name}</span>
                                            <span className="text-brand-300 font-mono text-[10px]">
                                                {row.initial} - {row.final} = <strong className="text-amberGold text-xs">{row.sold}</strong>
                                            </span>
                                            <span className="font-black text-amber-100">{formatRp(row.subtotal)}</span>
                                        </div>
                                    ))}

                                    {hotTehExtraCount > 0 && (
                                        <div className="flex items-center justify-between text-[10px] py-1 border-t border-amberGold/30 text-amber-200 font-bold">
                                            <span>Tambahan Teh Panas (Gelas B/K):</span>
                                            <span>{hotTehExtraCount} x Rp5k = +{formatRp(hotTehExtraSubtotal)}</span>
                                        </div>
                                    )}
                                    {miloCharge > 0 && (
                                        <div className="flex items-center justify-between text-[10px] py-1 border-t border-amberGold/30 text-amber-200 font-bold">
                                            <span>Tambahan Milo:</span>
                                            <span>+{formatRp(miloCharge)}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="bg-gradient-to-r from-brand-900 to-brand-950 p-2.5 rounded-xl border border-amberGold/40 space-y-1 shadow-md">
                                <div className="flex justify-between text-[11px] font-extrabold text-emerald-300">
                                    <span>TOTAL PENDAPATAN:</span>
                                    <span>{formatRp(totalPendapatan)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-amber-300">
                                    <span>Deposit Kas:</span>
                                    <span className="font-bold">{formatRp(deposit)}</span>
                                </div>
                                {(log.expenseItems || []).filter(item => item.name && Math.max(0, Number(item.amount) || 0) > 0).length > 0 && (
                                    <div className="text-[9px] text-rose-200/90 pl-2 space-y-0.5">
                                        {(log.expenseItems || [])
                                            .filter(item => item.name && Math.max(0, Number(item.amount) || 0) > 0)
                                            .map((item, idx) => (
                                                <div key={idx} className="flex justify-between">
                                                    <span>- {item.name}</span>
                                                    <span>-{formatRp(Math.max(0, Number(item.amount) || 0))}</span>
                                                </div>
                                            ))}
                                    </div>
                                )}
                                <div className="flex justify-between text-[10px] text-rose-300">
                                    <span>Pengeluaran Operasional (-):</span>
                                    <span className="font-bold">-{formatRp(expenses)}</span>
                                </div>
                                <div className="flex justify-between text-[10px] text-blue-300">
                                    <span>QRIS Non-Tunai (-):</span>
                                    <span className="font-bold">-{formatRp(qris)}</span>
                                </div>

                                <div className="pt-1.5 border-t border-brand-800 flex justify-between items-center">
                                    <span className="font-black text-amberGold uppercase tracking-wider text-[11px]">
                                        TOTAL AKHIR (SETORAN CASH):
                                    </span>
                                    <span className="font-black text-base text-amber-200">
                                        {formatRp(totalAkhirCash)}
                                    </span>
                                </div>
                            </div>

                            {stockRows.length > 0 && (
                                <div className="bg-brand-900/40 p-2 rounded-xl border border-brand-800 text-[10px] mt-2">
                                    <span className="font-extrabold text-amberGold block mb-1">Stok Bahan & Perlengkapan:</span>
                                    <div
                                        className="grid grid-cols-2 gap-x-2 gap-y-1 text-brand-300"
                                        style={{
                                            lineHeight: '1.5',
                                            overflow: 'visible'
                                        }}
                                    >
                                        {stockRows.map((item) => (
                                            <div key={item.id} className="whitespace-nowrap" style={{ lineHeight: '1.6', overflow: 'visible' }}>
                                                <span>{item.name}</span>
                                                <span className="text-amber-200 font-bold ml-1">
                                                    {item.qty}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>

                        <div className="text-center text-[8px] text-brand-400 pt-1 border-t border-brand-800/80">
                            Laporan Penjualan Resmi - CHA NOM YEN Teh Tarik Malaysia Kaw Kaw Punye Sedapp
                        </div>
                    </div>
                </div>

                <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                        onClick={handleDownloadImage}
                        disabled={isGenerating}
                        className="w-full bg-gradient-to-r from-amberGold to-amber-500 hover:from-amber-400 hover:to-amberGold text-brand-950 font-black py-3 px-4 rounded-2xl shadow-xl transition flex items-center justify-center gap-2 text-sm disabled:opacity-50"
                    >
                        {isGenerating ? (
                            <>
                                <i className="fa-solid fa-spinner fa-spin"></i>
                                Membuat Gambar Laporan...
                            </>
                        ) : (
                            <>
                                <i className="fa-solid fa-download"></i>
                                Unduh Gambar
                            </>
                        )}
                    </button>
                    <button
                        onClick={handleShareWhatsApp}
                        className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black py-3 px-4 rounded-2xl shadow-xl transition flex items-center justify-center gap-2 text-sm"
                    >
                        <i className="fa-brands fa-whatsapp"></i>
                        Kirim ke WhatsApp
                    </button>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);