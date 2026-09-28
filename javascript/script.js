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
        <div className="min-h-screen flex items-center justify-center bg-[#f7f3eb] px-4">
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
        const initialStockData = {
            p1: { initial: 0, final: 0, price: 15000 },
            p2: { initial: 0, final: 0, price: 10000 },
            p3: { initial: 0, final: 0, price: 10000 },
            p4: { initial: 0, final: 0, price: getProductPriceByBranch('p4', branchId, selectedBranch?.name || '') },
        };

        const bStock = branchMaterialStock[branchId] || {};
        const matStatus = {};
        materials.forEach(m => {
            const prev = bStock[m.id] || { qty: '0', status: 'Aman' };
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
                const prev = bStock[m.id] || { qty: '0', status: 'Aman' };
                res[m.id] = { qty: prev.qty || '0', status: prev.status || 'Aman' };
            });
            setMatStatus(prev => ({ ...prev, ...res }));
        }
    }, [inputBranchId, materials]);

    const handleStockChange = (pId, field, val) => {
        const numVal = Math.max(0, parseInt(val) || 0);
        setStockData(prev => ({
            ...prev,
            [pId]: {
                ...prev[pId],
                [field]: numVal
            }
        }));
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
            materialStatus: matStatus,
            createdBy: authUser?.uid || 'unknown-user',
            createdByName: authUser?.displayName || staff1.trim() || 'Karyawan',
            createdAt: new Date().toISOString()
        };

        // PENTING: gabungkan (merge) status bahan dari form ini ke stok cabang yang
        // SUDAH ADA — jangan mengganti seluruh isi stok cabang. Form penjualan ini
        // hanya menampilkan sebagian bahan (matStatus), jadi mengganti total akan
        // menghilangkan item stok lain (mis. yang ditambahkan lewat Menu Stok) setiap
        // kali laporan penjualan disimpan.
        setBranchMaterialStock(prev => ({
            ...prev,
            [inputBranchId]: {
                ...(prev[inputBranchId] || {}),
                ...Object.fromEntries(
                    Object.entries(matStatus).map(([materialId, value]) => [
                        materialId,
                        {
                            ...(prev[inputBranchId]?.[materialId] || {}),
                            ...(value || {}),
                            updatedBy: authUser?.uid || 'unknown-user',
                            updatedAt: new Date().toISOString()
                        }
                    ])
                )
            }
        }));

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
    const isFilledForAdmin = (materialId) => {
        if (!isAdminView) return true;
        const rawQty = activeBranchStock[materialId]?.qty;
        const qtyText = (rawQty === undefined || rawQty === null) ? '' : String(rawQty).trim();
        return qtyText !== '' && qtyText !== '0';
    };

    const groupedMaterials = useMemo(() => ({
        bahan: materials.filter(item => {
            const categoryOk = (item.category || 'bahan') === 'bahan';
            return categoryOk && Object.prototype.hasOwnProperty.call(activeBranchStock, item.id) && isFilledForAdmin(item.id);
        }),
        perlengkapan: materials.filter(item => {
            const categoryOk = (item.category || 'perlengkapan') === 'perlengkapan';
            return categoryOk && Object.prototype.hasOwnProperty.call(activeBranchStock, item.id) && isFilledForAdmin(item.id);
        })
    }), [materials, activeBranchStock, isAdminView]);

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
                        📍 {branches.find(b => b.id === activeBranchId)?.name}
                    </span>
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
                        description: 'Alat dan kebutuhan operasi pendukung seperti sedotan, kantong, dan gelas.'
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
                                    {items.map(m => {
                                        const data = activeBranchStock[m.id] || { qty: '', status: 'Aman', notes: 'Belum ada catatan' };

                                        return (
                                            <div key={m.id} className="bg-brand-50/50 p-2.5 rounded-xl border border-brand-200/80 shadow-sm min-w-0">
                                                <div className="border-b border-gray-100 pb-1.5 flex items-start justify-between gap-2">
                                                    <div className="font-extrabold text-brand-950 text-[10px] leading-tight break-words flex-1">
                                                        {m.name}
                                                    </div>
                                                    {!isAdminView && (
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
                                                    {isAdminView ? (
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

                <div className="pt-2">
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
                                Unduh Laporan Gambar 
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);