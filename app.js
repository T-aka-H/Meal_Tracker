// グローバル変数
let supabase = null;
let currentUser = null;
let currentUserId = null;
let editingId = null;
let allUsers = [];

// Supabaseクライアントのシングルトンインスタンス
let supabaseInstance = null;

// Supabase設定
const supabaseUrl = 'https://nhnanyzkcxlysugllpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmFueXprY3hseXN1Z2xscGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2MjQzNDgsImV4cCI6MjAyNTIwMDM0OH0.KqKilHHzKxXmwnDGqEDqMDGZ_E5MmGGHN-JQ9lNJVGE';

// プロキシサーバーのURL（環境に応じて変更）
const PROXY_URL = location.hostname === 'localhost' 
    ? 'http://localhost:8080'
    : 'https://meal-tracker-2-jyq6.onrender.com';

// 統計情報を強制削除する関数
function forceRemoveStats() {
    // 統計情報に関連する要素を全て削除
    const statsSelectors = [
        '#userStats',
        '.user-stats',
        '.stat-row',
        '.stat-value',
        '.stat-label',
        '[class*="stat"]',
        '[id*="stat"]',
        '[class*="Stats"]',
        '[id*="Stats"]',
        '.statistics',
        '.statistics-container',
        '.user-statistics',
        '.stats-wrapper',
        '.stats-container',
        '.stats-grid',
        '.stats-box',
        '[class*="statistics"]',
        '[id*="statistics"]'
    ];
    
    statsSelectors.forEach(selector => {
        const elements = document.querySelectorAll(selector);
        elements.forEach(element => {
            if (element && 
                !element.closest('#currentUserDisplay') && // ユーザー表示の親要素をチェック
                !element.closest('#recordsList') && // 食事記録リストの親要素をチェック
                !element.closest('.record-item') && // 個別の食事記録要素をチェック
                element.id !== 'currentUserName' && 
                element.id !== 'currentUserDisplay') {
                element.remove();
                console.log(`削除した要素: ${selector}`);
            }
        });
    });
    
    // 統計情報のテキストを含む要素を削除
    const allElements = document.querySelectorAll('*');
    allElements.forEach(element => {
        if (!element || !element.textContent) return;
        
        // 保護する要素をチェック
        if (element.id === 'currentUserName' || 
            element.id === 'currentUserDisplay' ||
            element.closest('#currentUserDisplay') ||
            element.closest('#userSection') ||
            element.closest('#recordsList') ||
            element.closest('.record-item') ||
            element.closest('.records-section')) {
            return;
        }
        
        const text = element.textContent.trim();
        // 統計情報に関連する文字列パターン
        const statsPatterns = [
            '総記録数',
            '今週の記録',
            '平均カロリー',
            '最後の記録',
            '統計',
            '集計',
            '件数',
            '合計'
        ];
        
        // 数値のみの要素で、特定のスタイルが適用されているもの
        const isStyledNumber = text.match(/^[0-9]+$/) && 
            element.style && 
            element.style.color === 'rgb(37, 99, 235)';
            
        // 統計情報らしき数値パターン
        const isStatsNumber = (
            /^[0-9]+件$/.test(text) ||
            text === '4' ||
            text === '300'
        );
        
        if (statsPatterns.some(pattern => text.includes(pattern)) || 
            isStyledNumber || 
            isStatsNumber) {
            
            // 親要素も含めて削除
            let parentToRemove = element;
            let depth = 0;
            const maxDepth = 5; // 最大5階層まで遡る
            
            while (parentToRemove.parentNode && 
                   depth < maxDepth && 
                   parentToRemove.parentNode !== document.body && 
                   parentToRemove.parentNode !== document.documentElement) {
                // 保護する要素の親要素は削除しない
                if (parentToRemove.querySelector('#currentUserName') || 
                    parentToRemove.querySelector('#currentUserDisplay') ||
                    parentToRemove.closest('#userSection') ||
                    parentToRemove.closest('#recordsList') ||
                    parentToRemove.closest('.record-item') ||
                    parentToRemove.closest('.records-section')) {
                    return;
                }
                
                // 親要素に他の重要な要素が含まれていないかチェック
                const siblings = Array.from(parentToRemove.parentNode.children);
                const hasCriticalSibling = siblings.some(sibling => {
                    return sibling !== parentToRemove && (
                        sibling.classList.contains('records-section') ||
                        sibling.classList.contains('form-section') ||
                        sibling.classList.contains('user-section') ||
                        sibling.id === 'mealForm' ||
                        sibling.id === 'recordsList' ||
                        sibling.id === 'currentUserDisplay'
                    );
                });
                
                if (hasCriticalSibling) break;
                
                parentToRemove = parentToRemove.parentNode;
                depth++;
            }
            
            if (parentToRemove && 
                parentToRemove !== document.body && 
                parentToRemove !== document.documentElement &&
                !parentToRemove.contains(document.getElementById('currentUserName')) &&
                !parentToRemove.contains(document.getElementById('currentUserDisplay')) &&
                !parentToRemove.closest('#userSection') &&
                !parentToRemove.closest('#recordsList') &&
                !parentToRemove.closest('.record-item') &&
                !parentToRemove.closest('.records-section')) {
                parentToRemove.remove();
                console.log(`統計情報を含む要素を削除: ${text}`);
            }
        }
    });
}

// 定期的に統計情報を削除する監視機能
function startStatsRemovalWatcher() {
    setInterval(() => {
        forceRemoveStats();
    }, 500); // 500msごとに統計情報をチェックして削除
}

// 食事記録の追加
async function addMealRecord() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    const record = getMealFormData();
    const loadingSpinner = document.getElementById('addLoading');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'inline-block';
    }
    
    try {
        console.log('食事記録追加開始:', record);
        
        const requestBody = {
            ...record,
            user_id: currentUserId
        };
        console.log('送信するデータ:', requestBody);

        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
                'prefer': 'return=minimal'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        showNotification('記録を追加しました', 'success');
        document.getElementById('mealForm').reset();
        setDefaultDateTime();
        
        // 記録の再読み込み
        console.log('記録を再読み込みします');
        await loadMealRecords();
        
    } catch (error) {
        console.error('食事記録追加エラー:', error);
        showNotification('記録の追加に失敗しました: ' + error.message, 'error');
    } finally {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

// 食事記録の読み込み
async function loadMealRecords() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const records = await response.json();
        displayMealRecords(records);
        
    } catch (error) {
        console.error('記録読み込みエラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 記録の編集
async function editRecord(id) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?select=*&id=eq.${id}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        const record = data[0];
        
        if (!record) {
            throw new Error('記録が見つかりません');
        }
        
        const datetime = new Date(record.datetime);
        document.getElementById('date').value = datetime.toISOString().split('T')[0];
        document.getElementById('time').value = datetime.toTimeString().slice(0, 5);
        document.getElementById('mealType').value = record.meal_type;
        document.getElementById('foodName').value = record.food_name;
        document.getElementById('calories').value = record.calories || '';
        document.getElementById('location').value = record.location || '';
        document.getElementById('notes').value = record.notes || '';
        
        editingId = id;
        document.querySelector('button[type="submit"]').textContent = '✏️ 記録を更新';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('記録編集エラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 記録の更新
async function updateMealRecord() {
    if (!editingId) return;
    
    const record = getMealFormData();
    const loadingSpinner = document.getElementById('addLoading');
    loadingSpinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?id=eq.${editingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'prefer': 'return=minimal'
            },
            body: JSON.stringify(record)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        
        showNotification('記録を更新しました', 'success');
        editingId = null;
        document.getElementById('mealForm').reset();
        setDefaultDateTime();
        document.querySelector('button[type="submit"]').textContent = '📝 記録を追加';
        await loadMealRecords();
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// 記録の削除
function deleteRecord(id) {
    document.getElementById('confirmModal').style.display = 'block';
    document.getElementById('confirmMessage').textContent = 'この記録を削除してもよろしいですか？';
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = async () => {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            closeModal('confirmModal');
            showNotification('記録を削除しました', 'success');
            await loadMealRecords();
            
        } catch (error) {
            console.error('記録削除エラー:', error);
            showNotification('記録の削除に失敗しました', 'error');
        }
    };
}

// ユーザーデータの削除
function clearUserData() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    document.getElementById('confirmModal').style.display = 'block';
    document.getElementById('confirmMessage').textContent = 
        'このユーザーの全ての記録を削除してもよろしいですか？この操作は取り消せません。';
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = async () => {
        try {
            const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            closeModal('confirmModal');
            showNotification('全ての記録を削除しました', 'success');
            await loadMealRecords();
            
        } catch (error) {
            console.error('データ削除エラー:', error);
            showNotification('データの削除に失敗しました', 'error');
        }
    };
}

// データダウンロード機能
async function downloadUserData() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        
        const csvContent = convertToCSV(data);
        downloadCSV(csvContent, `meal_records_${currentUser.name}.csv`);
        showNotification('データをダウンロードしました', 'success');
        
    } catch (error) {
        console.error('データダウンロードエラー:', error);
        showNotification('データのダウンロードに失敗しました', 'error');
    }
}

// Supabaseクライアントの取得
function getSupabaseClient(url, key) {
    return window.supabase.createClient(url, key);
}

// CORS用のヘッダー設定
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS'
};

// 初期化関数
async function initialize() {
    try {
        // 接続テスト
        const connected = await testConnection();
        updateConnectionStatus(connected);
        
        if (connected) {
            await loadUsers();
        }
    } catch (error) {
        console.error('初期化エラー:', error);
        showNotification('アプリケーションの初期化に失敗しました', 'error');
    }
}

// ページ読み込み時の処理
document.addEventListener('DOMContentLoaded', () => {
    initialize();
    setDefaultDateTime();
    setupEventListeners();
});

// DOMの変更を監視して統計情報を削除
const observer = new MutationObserver((mutations) => {
    let needsCleanup = false;
    mutations.forEach((mutation) => {
        if (mutation.type === 'childList') {
            needsCleanup = true;
        }
    });
    if (needsCleanup) {
        setTimeout(forceRemoveStats, 100);
    }
});

// 監視を開始（ページ読み込み後）
window.addEventListener('load', function() {
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
});

// 日付と時間のデフォルト値を設定
function setDefaultDateTime() {
    const now = new Date();
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    dateInput.value = now.toISOString().split('T')[0];
    timeInput.value = now.toTimeString().slice(0, 5);
}

// Supabase設定の読み込み
function loadSupabaseConfig() {
    connectSupabase();
}

// Supabaseへの接続
async function connectSupabase() {
    try {
        // 古いクライアントインスタンスをクリア
        supabase = null;
        supabaseInstance = null;

        // 新しいSupabaseクライアントを作成
        supabase = window.supabase.createClient(getSupabaseUrl(), getSupabaseKey());

        // 直接Supabaseにアクセス
        const response = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`接続テストに失敗: ${response.status} - ${errorText}`);
        }

        // 接続成功時の処理
        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.style.display = 'block';
        }

        await loadUsers();
        
        showNotification('Supabaseに接続しました', 'success');
        return true;

    } catch (error) {
        console.error('Supabase接続エラー:', error);
        showNotification('Supabaseへの接続に失敗しました', 'error');
        return false;
    }
}

// SupabaseキーとURLの取得関数
function getSupabaseKey() {
    return SUPABASE_ANON_KEY;
}

function getSupabaseUrl() {
    return supabaseUrl;
}

// 接続テスト関数
async function testConnection() {
    try {
        console.log('接続テスト開始');
        
        const response = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const data = await response.json();
        console.log('接続テスト成功:', data);
        
        showNotification('Supabaseへの接続に成功しました', 'success');
        return true;
        
    } catch (error) {
        console.error('接続テストエラー:', error);
        showNotification('Supabaseへの接続に失敗しました', 'error');
        return false;
    }
}

// 接続状態の更新
function updateConnectionStatus(connected) {
    const status = document.getElementById('connectionStatus');
    if (!status) return;
    
    if (connected) {
        status.className = 'status connected';
        status.textContent = '✅ Supabaseに接続済み';
    } else {
        status.className = 'status disconnected';
        status.textContent = '❌ 接続に失敗しました。設定を確認してください。';
    }
}

// ユーザー一覧の読み込み
async function loadUsers() {
    try {
        console.log('ユーザー読み込み開始');
        
        const response = await fetch(`${supabaseUrl}/rest/v1/users?order=name.asc`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const users = await response.json();
        console.log('ユーザー読み込み成功:', users);
        
        allUsers = users;
        updateUserSelect();
        updateUserCount(users.length);
        
    } catch (error) {
        console.error('ユーザー読み込みエラー:', error);
        allUsers = [];
        updateUserSelect();
        updateUserCount(0);
        showNotification('ユーザーの読み込みに失敗しました: ' + error.message, 'error');
    }
}

// ユーザーの更新
async function refreshUsers() {
    await loadUsers();
    showNotification('ユーザー一覧を更新しました', 'success');
    
    // 統計情報を削除
    setTimeout(forceRemoveStats, 100);
}

// ユーザーの切り替え
async function switchUser(userId) {
    console.log('ユーザー切り替え:', userId);

    if (!userId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    try {
        const response = await fetch(
            `${supabaseUrl}/rest/v1/users?id=eq.${userId}`,
            {
                method: 'GET',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('ユーザー情報の取得に失敗しました');
        }

        const users = await response.json();
        if (users.length === 0) {
            throw new Error('ユーザーが見つかりません');
        }

        currentUser = users[0];
        currentUserId = currentUser.id;
        
        // ユーザー表示を更新
        const userDisplay = document.getElementById('currentUserName');
        if (userDisplay) {
            userDisplay.textContent = currentUser.name;
        }
        document.getElementById('currentUserDisplay').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';

        console.log('ユーザー切り替え完了:', currentUser);
        
        // 食事記録を読み込む
        await loadMealRecords();
        
        showNotification(`${currentUser.name}さんに切り替えました`, 'success');
        
    } catch (error) {
        console.error('ユーザー切り替えエラー:', error);
        showNotification(error.message, 'error');
    }
}

// ユーザー追加モーダルの表示
function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'block';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserName').focus();
}

function showDeleteUserModal() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    document.getElementById('deleteUserModal').style.display = 'block';
}

// モーダルを閉じる
function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

// ユーザー追加関数
async function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    if (!name) {
        showNotification('ユーザー名を入力してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'prefer': 'return=minimal'
            },
            body: JSON.stringify({ name: name })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        await loadUsers();
        closeModal('addUserModal');
        showNotification('ユーザーを追加しました', 'success');
        document.getElementById('newUserName').value = '';
        
    } catch (error) {
        console.error('ユーザー追加エラー:', error);
        showNotification('ユーザーの追加に失敗しました', 'error');
    }
}

// 食事記録の表示
function displayMealRecords(records) {
    const recordsList = document.getElementById('recordsList');
    if (!records || records.length === 0) {
        recordsList.innerHTML = '<div class="empty-state">記録がありません</div>';
        return;
    }
    
    recordsList.innerHTML = '';
    records.forEach(record => {
        const recordElement = createRecordElement(record);
        recordsList.appendChild(recordElement);
    });
}

// 記録要素の作成
function createRecordElement(record) {
    console.log('記録要素を作成:', record);
    const datetime = new Date(record.datetime);
    const formattedDate = datetime.toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const formattedTime = datetime.toLocaleTimeString('ja-JP', {
        hour: '2-digit',
        minute: '2-digit'
    });

    return `
        <div class="record-item" data-id="${record.id}">
            <div class="record-header">
                <div class="record-datetime">
                    <span class="record-date">${formattedDate}</span>
                    <span class="record-time">${formattedTime}</span>
                </div>
                <div class="record-type">${record.meal_type}</div>
            </div>
            <div class="record-content">
                <div class="record-food">
                    <strong>${record.food_name}</strong>
                    ${record.calories ? `<span class="record-calories">${record.calories}kcal</span>` : ''}
                </div>
                ${record.location ? `<div class="record-location">📍 ${record.location}</div>` : ''}
                ${record.notes ? `<div class="record-notes">📝 ${record.notes}</div>` : ''}
            </div>
            <div class="record-actions">
                <button onclick="editRecord(${record.id})" class="edit-button">
                    ✏️ 編集
                </button>
                <button onclick="deleteRecord(${record.id})" class="delete-button">
                    🗑️ 削除
                </button>
            </div>
        </div>
    `;
}

// 全ユーザーデータのダウンロード
async function downloadAllData() {
    try {
        const { data, error } = await supabase
            .from('meal_records')
            .select('*, users!inner(*)')
            .order('datetime', { ascending: false });
        
        if (error) throw error;
        
        const processedData = data.map(record => ({
            ...record,
            user_name: record.users.name
        }));
        
        const csvContent = convertToCSV(processedData);
        downloadCSV(csvContent, 'all_meal_records.csv');
        showNotification('全データをダウンロードしました', 'success');
        
    } catch (error) {
        console.error('全データダウンロードエラー:', error);
        showNotification('データのダウンロードに失敗しました', 'error');
    }
}

// CSVへの変換
function convertToCSV(data) {
    if (data.length === 0) return '';
    
    const headers = Object.keys(data[0]);
    const rows = [
        headers.join(','),
        ...data.map(row =>
            headers.map(header => {
                const value = row[header];
                return value === null ? '' : JSON.stringify(value);
            }).join(',')
        )
    ];
    
    return rows.join('\n');
}

// CSVのダウンロード
function downloadCSV(content, filename) {
    const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
    URL.revokeObjectURL(link.href);
}

// 通知の表示
function showNotification(message, type = 'default') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.animation = 'slideOut 0.3s ease forwards';
        setTimeout(() => notification.remove(), 300);
    }, 3000);
}

// デバッグ用のテスト関数
async function debugTest() {
    console.log('デバッグテスト開始');
    
    try {
        const result = await supabase
            .from('users')
            .insert([{ name: 'テストユーザー2024' }]);
        
        console.log('成功:', result);
    } catch (error) {
        console.error('エラー:', error);
    }
}

// ウィンドウクリックイベントの設定
window.onclick = function(event) {
    const modals = document.getElementsByClassName('modal');
    for (const modal of modals) {
        if (event.target === modal) {
            modal.style.display = 'none';
        }
    }
};

// ユーザー数を更新する関数
function updateUserCount(count) {
    const userCountElement = document.getElementById('userCount');
    if (userCountElement) {
        userCountElement.textContent = count;
    }
    console.log('ユーザー数を更新:', count);
}

// ユーザー選択肢を更新する関数
function updateUserSelect() {
    console.log('ユーザー選択肢の更新開始');
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) {
        console.error('userSelect要素が見つかりません');
        return;
    }
    
    // 現在の選択値を保持
    const currentValue = userSelect.value;
    console.log('現在の選択値:', currentValue);

    // 既存のオプションをクリア（最初の「選択してください」は残す）
    while (userSelect.options.length > 1) {
        userSelect.remove(1);
    }

    // ユーザーオプションを追加
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        userSelect.appendChild(option);
        console.log('ユーザーオプション追加:', user.name, user.id);
    });

    // 以前の選択を復元（存在する場合）
    if (currentValue && Array.from(userSelect.options).some(opt => opt.value === currentValue)) {
        userSelect.value = currentValue;
        console.log('選択値を復元:', currentValue);
    }
    
    console.log('ユーザー選択肢の更新完了');
}

async function deleteUser() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    const loadingSpinner = document.getElementById('deleteUserLoading');
    loadingSpinner.style.display = 'inline-block';

    try {
        // まず、ユーザーの全ての記録を削除
        const recordsResponse = await fetch(`${PROXY_URL}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
            method: 'DELETE',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`
            }
        });

        if (!recordsResponse.ok) {
            const errorText = await recordsResponse.text();
            throw new Error(`記録の削除に失敗: HTTP ${recordsResponse.status}: ${errorText}`);
        }

        // 次に、ユーザーを削除
        const userResponse = await fetch(`${PROXY_URL}/rest/v1/users?id=eq.${currentUserId}`, {
            method: 'DELETE',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`
            }
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            throw new Error(`ユーザーの削除に失敗: HTTP ${userResponse.status}: ${errorText}`);
        }

        closeModal('deleteUserModal');
        showNotification('ユーザーを削除しました', 'success');
        
        // ユーザー情報をリセット
        currentUser = null;
        currentUserId = null;
        document.getElementById('currentUserDisplay').style.display = 'none';
        document.getElementById('mainContent').style.display = 'none';
        
        // ユーザーリストを更新
        await loadUsers();
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        showNotification('ユーザーの削除に失敗しました', 'error');
    } finally {
        loadingSpinner.style.display = 'none';
    }
} 

// フォームデータの取得
function getMealFormData() {
    const date = document.getElementById('date').value;
    const time = document.getElementById('time').value;
    const datetime = new Date(`${date}T${time}`).toISOString();
    
    return {
        datetime,
        meal_type: document.getElementById('mealType').value,
        food_name: document.getElementById('foodName').value,
        calories: parseInt(document.getElementById('calories').value) || null,
        location: document.getElementById('location').value,
        notes: document.getElementById('notes').value
    };
}

// AIアドバイス機能
async function generateAIAdvice(records) {
    const adviceElement = document.getElementById('aiAdvice');
    if (!adviceElement || !records || records.length === 0) return;
    
    try {
        // 食事記録のサマリーを作成
        const mealSummary = records.map(record => {
            return `日時: ${new Date(record.datetime).toLocaleString()}\n` +
                   `食事タイプ: ${record.meal_type}\n` +
                   `食事内容: ${record.food_name}\n` +
                   `カロリー: ${record.calories || '不明'}\n` +
                   `場所: ${record.location || '不明'}\n` +
                   `メモ: ${record.notes || 'なし'}\n`;
        }).join('\n');

        // 英語のアドバイスを生成
        const englishPrompt = `Based on the following meal records, provide detailed dietary advice focusing on health, nutrition, and areas for improvement. Include specific recommendations and explanations:\n\n${mealSummary}`;
        
        const englishResponse = await fetch(`${supabaseUrl}/functions/v1/cohere-analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: englishPrompt,
                language: 'en'
            })
        });

        if (!englishResponse.ok) {
            throw new Error('英語のアドバイス生成に失敗しました');
        }

        const englishAdvice = await englishResponse.json();

        // 日本語のアドバイスを生成
        const japanesePrompt = `以下の食事記録に基づいて、健康、栄養、改善点に焦点を当てた詳細な食事アドバイスを提供してください。具体的な推奨事項と説明を含めてください：\n\n${mealSummary}`;
        
        const japaneseResponse = await fetch(`${supabaseUrl}/functions/v1/cohere-analyze`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json'
            },
            body: JSON.stringify({
                prompt: japanesePrompt,
                language: 'ja'
            })
        });

        if (!japaneseResponse.ok) {
            throw new Error('日本語のアドバイス生成に失敗しました');
        }

        const japaneseAdvice = await japaneseResponse.json();
        
        // アドバイスを表示
        adviceElement.innerHTML = `
            <div class="advice-section">
                <h4>AI食事診断</h4>
                <div class="advice-content">
                    <div class="japanese-advice">
                        <h5>日本語アドバイス</h5>
                        <p>${japaneseAdvice.replace(/\n/g, '<br>')}</p>
                    </div>
                    <div class="english-advice">
                        <h5>English Advice</h5>
                        <p>${englishAdvice.replace(/\n/g, '<br>')}</p>
                    </div>
                </div>
            </div>
        `;
        
    } catch (error) {
        console.error('AIアドバイス生成エラー:', error);
        adviceElement.innerHTML = `
            <div class="advice-section error">
                <h4>AI食事診断</h4>
                <p>申し訳ありません。アドバイスの生成に失敗しました。</p>
                <p>エラー: ${error.message}</p>
            </div>
        `;
    }
}

// イベントリスナーの設定
function setupEventListeners() {
    // フォームのサブミットイベントを設定
    document.getElementById('mealForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (editingId) {
            updateMealRecord();
        } else {
            addMealRecord();
        }
    });

    // ユーザー選択の変更イベントを設定
    document.getElementById('userSelect').addEventListener('change', function(e) {
        const selectedUserId = e.target.value;
        if (selectedUserId) {
            currentUserId = selectedUserId;
            currentUser = allUsers.find(user => user.id === selectedUserId);
            loadMealRecords();
        }
    });

    // 新規ユーザー追加フォームのサブミットイベントを設定
    document.getElementById('addUserForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addUser();
    });
}