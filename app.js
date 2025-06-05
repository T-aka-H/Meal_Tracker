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

// プロキシサーバーのURL（環境に応じて変更）
const PROXY_URL = location.hostname === 'localhost' 
    ? 'http://localhost:8080'
    : 'https://meal-tracker-1-y2dy.onrender.com';

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
        
        // ユーザー表示要素は削除しない
        if (element.id === 'currentUserName' || 
            element.id === 'currentUserDisplay' ||
            element.closest('#currentUserDisplay') ||
            element.closest('#userSection')) {
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
            /^[0-9]+kcal$/.test(text) ||
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
                // ユーザー表示要素の親要素は削除しない
                if (parentToRemove.querySelector('#currentUserName') || 
                    parentToRemove.querySelector('#currentUserDisplay') ||
                    parentToRemove.closest('#userSection')) {
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
                !parentToRemove.closest('#userSection')) {
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

// 食事記録の更新（プロキシ対応版に修正）
async function updateMealRecord() {
    if (!editingId) return;
    
    const record = getMealFormData();
    const loadingSpinner = document.getElementById('addLoading');
    loadingSpinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${PROXY_URL}/rest/v1/meal_records?id=eq.${editingId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
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
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// 記録の編集（プロキシ対応版に修正）
async function editRecord(id) {
    try {
        const response = await fetch(`${PROXY_URL}/rest/v1/meal_records?select=*&id=eq.${id}`, {
            method: 'GET',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
                'Accept': 'application/json'
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

// 記録の削除（プロキシ対応版に修正）
function deleteRecord(id) {
    document.getElementById('confirmModal').style.display = 'block';
    document.getElementById('confirmMessage').textContent = 'この記録を削除してもよろしいですか？';
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = async () => {
        try {
            const response = await fetch(`${PROXY_URL}/rest/v1/meal_records?id=eq.${id}`, {
                method: 'DELETE',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            closeModal('confirmModal');
            showNotification('記録を削除しました', 'success');
            await loadMealRecords();
            
            // 統計情報を削除
            setTimeout(forceRemoveStats, 100);
            
        } catch (error) {
            console.error('記録削除エラー:', error);
            showNotification('記録の削除に失敗しました', 'error');
        }
    };
}

// ユーザーデータの削除（プロキシ対応版に修正）
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
            const response = await fetch(`${PROXY_URL}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
                method: 'DELETE',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            
            closeModal('confirmModal');
            showNotification('全ての記録を削除しました', 'success');
            await loadMealRecords();
            
            // 統計情報を削除
            setTimeout(forceRemoveStats, 100);
            
        } catch (error) {
            console.error('データ削除エラー:', error);
            showNotification('データの削除に失敗しました', 'error');
        }
    };
}

// データダウンロード機能もプロキシ対応版に修正
async function downloadUserData() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    try {
        const response = await fetch(
            `${PROXY_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`,
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

// 初期化 - 統計情報を完全に削除
document.addEventListener('DOMContentLoaded', function() {
    loadSupabaseConfig();
    setDefaultDateTime();
    
    // 統計情報を強制削除
    forceRemoveStats();
    
    // 統計情報削除の監視を開始
    startStatsRemovalWatcher();
    
    // フォームのサブミットイベントを設定
    document.getElementById('mealForm').addEventListener('submit', function(e) {
        e.preventDefault();
        if (editingId) {
            updateMealRecord();
        } else {
            addMealRecord();
        }
    });
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
    const savedUrl = localStorage.getItem('supabaseUrl');
    const savedKey = localStorage.getItem('supabaseKey');
    
    if (savedUrl && savedKey) {
        document.getElementById('supabaseUrl').value = savedUrl;
        document.getElementById('supabaseKey').value = savedKey;
        connectSupabase();
    }
}

// Supabaseへの接続
async function connectSupabase() {
    let url = document.getElementById('supabaseUrl').value.trim();
    const key = document.getElementById('supabaseKey').value.trim();
    
    if (!url || !key) {
        showNotification('URLとキーの両方を入力してください', 'error');
        return;
    }

    try {
        // URLの末尾のスラッシュを削除
        url = url.replace(/\/$/, '');

        // 古いクライアントインスタンスをクリア
        supabase = null;
        supabaseInstance = null;

        // 新しいSupabaseクライアントを作成
        supabase = window.supabase.createClient(url, key);

        // 最小限の接続テスト - セッションチェックのみ
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            throw new Error('認証エラー: ' + sessionError.message);
        }

        // 接続成功時の処理
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.className = 'status connected';
            status.textContent = '✅ Supabaseに接続済み';
        }

        const setupSection = document.getElementById('setupSection');
        if (setupSection) {
            setupSection.style.display = 'none';
        }

        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.style.display = 'block';
        }

        await loadUsers();
        showNotification('Supabaseに接続しました！', 'success');
        
        // 設定を保存
        localStorage.setItem('supabaseUrl', url);
        localStorage.setItem('supabaseKey', key);
        
    } catch (error) {
        console.error('Supabase接続エラー:', error);
        const errorMessage = error.message || error.error_description || 'Unknown error';
        showNotification('接続に失敗しました: ' + errorMessage, 'error');
        
        const status = document.getElementById('connectionStatus');
        if (status) {
            status.className = 'status disconnected';
            status.textContent = '❌ 接続に失敗しました。設定を確認してください。';
        }
        
        // エラーの詳細をコンソールに出力
        if (error.status) {
            console.error('Status:', error.status);
        }
        if (error.statusText) {
            console.error('Status Text:', error.statusText);
        }
    }
}

// SupabaseキーとURLの取得関数
function getSupabaseKey() {
    return localStorage.getItem('supabaseKey') || 
           document.getElementById('supabaseKey')?.value || 
           '';
}

function getSupabaseUrl() {
    return localStorage.getItem('supabaseUrl') || 
           document.getElementById('supabaseUrl')?.value || 
           '';
}

// 接続テスト関数（プロキシ対応版）
async function testConnection() {
    try {
        console.log('接続テスト開始');
        
        const response = await fetch(`${PROXY_URL}/rest/v1/users?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`
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
        
        // プロキシサーバー経由でリクエスト
        const response = await fetch(`${PROXY_URL}/rest/v1/users?order=name.asc`, {
            method: 'GET',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
                'Accept': 'application/json'
            }
        });

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const users = await response.json();
        console.log('ユーザー読み込み成功:', users);
        
        allUsers = users;
        updateUserSelect();
        updateUserCount(users.length);
        
        // 最後に選択されていたユーザーを復元
        const lastUserId = localStorage.getItem('lastUserId');
        if (lastUserId) {
            const userSelect = document.getElementById('userSelect');
            if (userSelect) {
                userSelect.value = lastUserId;
                await switchUser();
            }
        }
        
    } catch (error) {
        console.error('ユーザー読み込みエラー:', error);
        console.error('エラーの詳細:', error.stack);
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
async function switchUser() {
    const userId = document.getElementById('userSelect').value;
    if (!userId) {
        currentUser = null;
        currentUserId = null;
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('currentUserDisplay').style.display = 'none';
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        return;
    }
    
    currentUserId = parseInt(userId);
    currentUser = allUsers.find(u => u.id === currentUserId);
    
    if (currentUser) {
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('currentUserDisplay').style.display = 'block';
        document.getElementById('currentUserName').textContent = currentUser.name;
        
        localStorage.setItem('lastUserId', currentUserId);
        await loadMealRecords();
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
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

// ユーザー追加関数（プロキシ対応版）
async function addUser() {
    const name = document.getElementById('newUserName').value.trim();
    
    if (!name) {
        showNotification('ユーザー名を入力してください', 'error');
        return;
    }

    try {
        console.log('ユーザー追加開始:', name);
        
        const response = await fetch(`${PROXY_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
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
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('ユーザー追加エラー:', error);
        showNotification('ユーザーの追加に失敗しました', 'error');
    }
}

// 食事記録の追加（プロキシ対応版）
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

        const response = await fetch(`${PROXY_URL}/rest/v1/meal_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
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
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('食事記録追加エラー:', error);
        showNotification('記録の追加に失敗しました: ' + error.message, 'error');
    } finally {
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
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
    
    // 統計情報を削除
    setTimeout(forceRemoveStats, 100);
}

function createRecordElement(record) {
    console.log('記録要素を作成:', record);
    const recordDiv = document.createElement('div');
    recordDiv.className = 'record-item';

    try {
        // 日付と時間
        const dateDiv = document.createElement('div');
        dateDiv.className = 'record-date';
        const date = new Date(record.datetime);
        dateDiv.textContent = `${date.toLocaleDateString('ja-JP')} ${date.toLocaleTimeString('ja-JP')}`;
        
        // 食事名
        const foodDiv = document.createElement('div');
        foodDiv.className = 'record-food';
        foodDiv.textContent = `${record.meal_type} - ${record.food_name}`;
        
        // カロリー
        const caloriesDiv = document.createElement('div');
        caloriesDiv.className = 'record-calories';
        caloriesDiv.textContent = record.calories ? `${record.calories} kcal` : '-';
        
        // 場所
        const locationDiv = document.createElement('div');
        locationDiv.className = 'record-location';
        locationDiv.textContent = record.location || '-';
        
        // アクション
        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'record-actions';
        
        const editButton = document.createElement('button');
        editButton.className = 'btn btn-secondary btn-small';
        editButton.textContent = '編集';
        editButton.onclick = () => editRecord(record.id);
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'btn btn-danger btn-small';
        deleteButton.textContent = '削除';
        deleteButton.onclick = () => deleteRecord(record.id);
        
        actionsDiv.appendChild(editButton);
        actionsDiv.appendChild(deleteButton);
        
        recordDiv.appendChild(dateDiv);
        recordDiv.appendChild(foodDiv);
        recordDiv.appendChild(caloriesDiv);
        recordDiv.appendChild(locationDiv);
        recordDiv.appendChild(actionsDiv);
        
    } catch (error) {
        console.error('記録要素作成エラー:', error);
        recordDiv.textContent = 'エラー: 記録の表示に失敗しました';
    }
    
    return recordDiv;
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
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;
    
    while (userSelect.children.length > 1) {
        userSelect.removeChild(userSelect.lastChild);
    }
    
    allUsers.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });
    
    console.log('ユーザー選択肢を更新:', allUsers.length);
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

// 食事記録の読み込み（プロキシ対応版）
async function loadMealRecords() {
    if (!currentUserId) return;
    
    try {
        const response = await fetch(
            `${PROXY_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`,
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
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const records = await response.json();
        displayMealRecords(records);
        
        // 統計情報を削除
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('記録読み込みエラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

async function getAIAdvice() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    try {
        // ローディング表示
        const adviceElement = document.getElementById('ai-advice');
        if (adviceElement) {
            adviceElement.innerHTML = '<div class="loading">AIアドバイスを生成中...</div>';
        }

        // 最新の食事記録を取得
        const recordsResponse = await fetch(
            `${PROXY_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc&limit=10`,
            {
                method: 'GET',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!recordsResponse.ok) {
            throw new Error(`食事記録の取得に失敗しました: ${recordsResponse.status}`);
        }

        const mealRecords = await recordsResponse.json();
        
        if (!mealRecords || mealRecords.length === 0) {
            throw new Error('食事記録が見つかりません');
        }

        // AIアドバイスを取得
        const adviceResponse = await fetch(`${PROXY_URL}/api/get-meal-advice`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`
            },
            body: JSON.stringify({
                meal_records: mealRecords
            })
        });

        if (!adviceResponse.ok) {
            const errorText = await adviceResponse.text();
            throw new Error(`AIアドバイスの取得に失敗しました: ${errorText}`);
        }

        const data = await adviceResponse.json();
        
        // アドバイスを表示
        if (adviceElement) {
            adviceElement.innerHTML = `
                <div class="advice-section">
                    <h4>AI Dietary Advice</h4>
                    <div class="advice-content">
                        <div class="japanese-advice">
                            ${data.advice_jp.split('\n').join('<br>')}
                        </div>
                        <div class="english-advice">
                            ${data.advice_en.split('\n').join('<br>')}
                        </div>
                    </div>
                </div>
            `;
        }
    } catch (error) {
        console.error('AIアドバイスエラー:', error);
        const adviceElement = document.getElementById('ai-advice');
        if (adviceElement) {
            adviceElement.innerHTML = `<p class="error">申し訳ありません。アドバイスの取得中にエラーが発生しました。<br>${error.message}</p>`;
        }
        showNotification(error.message, 'error');
    }
}