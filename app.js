// グローバル変数
let supabase = null;
let currentUser = null;
let currentUserId = null;
let editingId = null;
let allUsers = [];

// Supabase設定
const supabaseUrl = 'https://nhnanyzkcxlysugllpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmFueXprY3hseXN1Z2xscGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2MjQzNDgsImV4cCI6MjAyNTIwMDM0OH0.KqKilHHzKxXmwnDGqEDqMDGZ_E5MmGGHN-JQ9lNJVGE';

// SupabaseキーとURLの取得関数
function getSupabaseKey() {
    return SUPABASE_ANON_KEY;
}

function getSupabaseUrl() {
    return supabaseUrl;
}

// 統計情報を強制削除する関数
function forceRemoveStats() {
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
                !element.closest('#currentUserDisplay') && 
                !element.closest('#recordsList') && 
                !element.closest('.record-item') && 
                element.id !== 'currentUserName' && 
                element.id !== 'currentUserDisplay') {
                element.remove();
                console.log(`削除した要素: ${selector}`);
            }
        });
    });
}

// 定期的に統計情報を削除する監視機能
function startStatsRemovalWatcher() {
    setInterval(() => {
        forceRemoveStats();
    }, 500);
}

// 日付と時間のデフォルト値を設定
function setDefaultDateTime() {
    const now = new Date();
    const dateInput = document.getElementById('date');
    const timeInput = document.getElementById('time');
    
    if (dateInput) {
        dateInput.value = now.toISOString().split('T')[0];
    }
    if (timeInput) {
        timeInput.value = now.toTimeString().slice(0, 5);
    }
}

// Supabaseへの接続
async function connectSupabase() {
    try {
        console.log('🔄 Supabase接続開始...');
        console.log('📍 接続先URL:', supabaseUrl);
        console.log('🔑 APIキー（最初の20文字）:', SUPABASE_ANON_KEY.substring(0, 20) + '...');
        
        // APIキーの有効期限をチェック
        try {
            const payload = JSON.parse(atob(SUPABASE_ANON_KEY.split('.')[1]));
            console.log('📅 APIキー有効期限:', new Date(payload.exp * 1000));
            console.log('📅 現在時刻:', new Date());
            console.log('✅ APIキー有効:', payload.exp * 1000 > Date.now());
        } catch (e) {
            console.warn('⚠️ APIキーのペイロード解析に失敗:', e.message);
        }
        
        // Supabaseクライアントを作成
        if (window.supabase && window.supabase.createClient) {
            supabase = window.supabase.createClient(supabaseUrl, SUPABASE_ANON_KEY);
            console.log('✅ Supabaseクライアント作成成功');
        } else {
            throw new Error('Supabase SDKが読み込まれていません');
        }

        // 接続テスト
        console.log('🔄 接続テスト開始...');
        const response = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        console.log('📊 接続テストレスポンス:', response.status);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ 接続テストエラー詳細:', errorText);
            
            if (response.status === 401) {
                throw new Error('APIキーが無効です。Supabaseダッシュボードで最新のAPIキーを確認してください。');
            } else {
                throw new Error(`接続テストに失敗: ${response.status} - ${errorText}`);
            }
        }

        const data = await response.json();
        console.log('📊 取得データ:', data);

        // 接続成功時の処理
        const userSection = document.getElementById('userSection');
        if (userSection) {
            userSection.style.display = 'block';
        }

        await loadUsers();
        showNotification('Supabaseに接続しました', 'success');
        updateConnectionStatus(true);
        return true;

    } catch (error) {
        console.error('❌ Supabase接続エラー:', error);
        showNotification(`Supabaseへの接続に失敗しました: ${error.message}`, 'error');
        updateConnectionStatus(false);
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
    console.log('ユーザー読み込み開始');
    
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/users?select=*`, {
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
            throw new Error(`ユーザー一覧の取得に失敗: ${response.status} - ${errorText}`);
        }

        const users = await response.json();
        console.log('取得したユーザー:', users);
        
        allUsers = users;
        updateUserSelect();
        
        // 最初のユーザーを選択
        if (users.length > 0 && !currentUserId) {
            await switchUser(users[0].id);
        }
        
    } catch (error) {
        console.error('ユーザー読み込みエラー:', error);
        showNotification('ユーザー一覧の読み込みに失敗しました', 'error');
    }
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
    });

    // 以前の選択を復元（存在する場合）
    if (currentValue && Array.from(userSelect.options).some(opt => opt.value === currentValue)) {
        userSelect.value = currentValue;
    }
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
        
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        const mainContent = document.getElementById('mainContent');
        if (currentUserDisplay) currentUserDisplay.style.display = 'block';
        if (mainContent) mainContent.style.display = 'block';

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
    const modal = document.getElementById('addUserModal');
    const nameInput = document.getElementById('newUserName');
    if (modal) modal.style.display = 'block';
    if (nameInput) {
        nameInput.value = '';
        nameInput.focus();
    }
}

function showDeleteUserModal() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    const modal = document.getElementById('deleteUserModal');
    if (modal) modal.style.display = 'block';
}

// モーダルを閉じる
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.style.display = 'none';
}

// ユーザー追加関数
async function addUser() {
    const nameInput = document.getElementById('newUserName');
    const name = nameInput ? nameInput.value.trim() : '';
    
    if (!name) {
        showNotification('ユーザー名を入力してください', 'error');
        return;
    }

    try {
        console.log('ユーザー追加開始:', name);
        
        const response = await fetch(`${supabaseUrl}/rest/v1/users`, {
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
        
        if (nameInput) nameInput.value = '';
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('ユーザー追加エラー:', error);
        showNotification('ユーザーの追加に失敗しました', 'error');
    }
}

// ユーザー削除
async function deleteUser() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    const loadingSpinner = document.getElementById('deleteUserLoading');
    if (loadingSpinner) loadingSpinner.style.display = 'inline-block';

    try {
        // まず、ユーザーの全ての記録を削除
        const recordsResponse = await fetch(`${supabaseUrl}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
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
        const userResponse = await fetch(`${supabaseUrl}/rest/v1/users?id=eq.${currentUserId}`, {
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
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        const mainContent = document.getElementById('mainContent');
        if (currentUserDisplay) currentUserDisplay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'none';
        
        // ユーザーリストを更新
        await loadUsers();
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('ユーザー削除エラー:', error);
        showNotification('ユーザーの削除に失敗しました', 'error');
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
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
        
        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
                'prefer': 'return=minimal'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`記録の追加に失敗: ${response.status} - ${errorText}`);
        }

        showNotification('記録を追加しました', 'success');
        const form = document.getElementById('mealForm');
        if (form) form.reset();
        setDefaultDateTime();
        
        await loadMealRecords();
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

// 食事記録の読み込み
async function loadMealRecords() {
    console.log('loadMealRecords開始: currentUserId =', currentUserId);
    if (!currentUserId) return;
    
    try {
        const url = `${supabaseUrl}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`;
        console.log('APIリクエストURL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
                'Accept': 'application/json'
            }
        });

        console.log('APIレスポンスステータス:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('APIエラーレスポンス:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const records = await response.json();
        console.log('取得した記録:', records);
        
        displayMealRecords(records);
        
    } catch (error) {
        console.error('記録読み込みエラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 食事記録の表示
function displayMealRecords(records) {
    const recordsList = document.getElementById('recordsList');
    if (!recordsList) return;
    
    if (!records || records.length === 0) {
        recordsList.innerHTML = '<div class="empty-state">記録がありません</div>';
        return;
    }
    
    recordsList.innerHTML = '';
    records.forEach(record => {
        const recordElement = createRecordElement(record);
        recordsList.insertAdjacentHTML('beforeend', recordElement);
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

// 記録の編集
async function editRecord(id) {
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?select=*&id=eq.${id}`, {
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
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '✏️ 記録を更新';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('記録編集エラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 食事記録の更新
async function updateMealRecord() {
    if (!editingId) return;
    
    const record = getMealFormData();
    const loadingSpinner = document.getElementById('addLoading');
    if (loadingSpinner) loadingSpinner.style.display = 'inline-block';
    
    try {
        const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?id=eq.${editingId}`, {
            method: 'PATCH',
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
        const form = document.getElementById('mealForm');
        if (form) form.reset();
        setDefaultDateTime();
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '📝 記録を追加';
        await loadMealRecords();
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

// 記録の削除
function deleteRecord(id) {
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    if (modal) modal.style.display = 'block';
    if (message) message.textContent = 'この記録を削除してもよろしいですか？';
    
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            try {
                const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?id=eq.${id}`, {
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
                
                setTimeout(forceRemoveStats, 100);
                
            } catch (error) {
                console.error('記録削除エラー:', error);
                showNotification('記録の削除に失敗しました', 'error');
            }
        };
    }
}

// ユーザーデータの削除
function clearUserData() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    const modal = document.getElementById('confirmModal');
    const message = document.getElementById('confirmMessage');
    if (modal) modal.style.display = 'block';
    if (message) {
        message.textContent = 'このユーザーの全ての記録を削除してもよろしいですか？この操作は取り消せません。';
    }
    
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
        confirmBtn.onclick = async () => {
            try {
                const response = await fetch(`${supabaseUrl}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
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
                
                setTimeout(forceRemoveStats, 100);
                
            } catch (error) {
                console.error('データ削除エラー:', error);
                showNotification('データの削除に失敗しました', 'error');
            }
        };
    }
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

// ユーザーの更新
async function refreshUsers() {
    await loadUsers();
    showNotification('ユーザー一覧を更新しました', 'success');
    setTimeout(forceRemoveStats, 100);
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

// イベントリスナーの設定
function setupEventListeners() {
    console.log('イベントリスナー設定開始...');
    
    // フォームのサブミットイベント
    const mealForm = document.getElementById('mealForm');
    if (mealForm) {
        mealForm.addEventListener('submit', function(e) {
            e.preventDefault();
            if (editingId) {
                updateMealRecord();
            } else {
                addMealRecord();
            }
        });
        console.log('フォームイベントリスナー設定完了');
    } else {
        console.error('mealForm要素が見つかりません');
    }

    // ユーザー選択
    const userSelect = document.getElementById('userSelect');
    if (userSelect) {
        userSelect.addEventListener('change', function(e) {
            if (e.target.value) {
                switchUser(e.target.value);
            }
        });
        console.log('ユーザー選択イベントリスナー設定完了');
    } else {
        console.error('userSelect要素が見つかりません');
    }

    // ウィンドウクリックイベント（モーダル閉じる）
    window.onclick = function(event) {
        const modals = document.getElementsByClassName('modal');
        for (const modal of modals) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
    };

    // Enterキーでユーザー追加
    const newUserName = document.getElementById('newUserName');
    if (newUserName) {
        newUserName.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                addUser();
            }
        });
        console.log('ユーザー名入力イベントリスナー設定完了');
    }
    
    console.log('イベントリスナー設定完了');
}

// 初期化
async function initialize() {
    console.log('アプリケーション初期化開始');
    
    // デフォルト日時設定
    setDefaultDateTime();
    
    // 統計情報削除
    forceRemoveStats();
    startStatsRemovalWatcher();
    
    // イベントリスナー設定
    setupEventListeners();
    
    // Supabase接続
    const connected = await connectSupabase();
    if (!connected) {
        console.error('Supabase接続に失敗しました');
        return;
    }
    
    console.log('アプリケーション初期化完了');
}

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    initialize();
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

// ユーザー数を更新する関数
function updateUserCount(count) {
    const userCountElement = document.getElementById('userCount');
    if (userCountElement) {
        userCountElement.textContent = count;
    }
    console.log('ユーザー数を更新:', count);
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

// AIアドバイス機能
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
        const response = await fetch(
            `${supabaseUrl}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc&limit=10`,
            {
                method: 'GET',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`,
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('食事記録の取得に失敗しました');
        }

        const mealRecords = await response.json();

        if (!mealRecords || mealRecords.length === 0) {
            if (adviceElement) {
                adviceElement.innerHTML = '<p>食事記録が見つかりません。まず食事を記録してください。</p>';
            }
            return;
        }

        // 食事記録を文字列に整形
        const mealSummary = mealRecords.map(record => {
            return `日時: ${new Date(record.datetime).toLocaleString()}\n食事: ${record.food_name}\n種類: ${record.meal_type}\nカロリー: ${record.calories || '不明'}kcal\n場所: ${record.location || '不明'}\n備考: ${record.notes || 'なし'}\n`;
        }).join('\n');

        // 簡易的なアドバイス生成（実際のAI APIは使用せず、パターンベースで生成）
        const advice = generateSimpleAdvice(mealRecords);
        
        // アドバイスを表示
        if (adviceElement) {
            adviceElement.innerHTML = `
                <div class="advice-section">
                    <h4>食事診断</h4>
                    <div class="advice-content">
                        <div class="japanese-advice">
                            ${advice}
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

// 簡易的なアドバイス生成
function generateSimpleAdvice(records) {
    const mealTypes = records.map(r => r.meal_type);
    const foods = records.map(r => r.food_name);
    const calories = records.filter(r => r.calories).map(r => r.calories);
    
    let advice = '<h5>食事パターン分析:</h5>';
    
    // 食事回数の分析
    const mealTypeCount = {};
    mealTypes.forEach(type => {
        mealTypeCount[type] = (mealTypeCount[type] || 0) + 1;
    });
    
    advice += '<ul>';
    Object.entries(mealTypeCount).forEach(([type, count]) => {
        advice += `<li>${type}: ${count}回</li>`;
    });
    advice += '</ul>';
    
    // カロリー分析
    if (calories.length > 0) {
        const avgCalories = Math.round(calories.reduce((a, b) => a + b, 0) / calories.length);
        advice += `<h5>平均カロリー: ${avgCalories}kcal</h5>`;
        
        if (avgCalories > 800) {
            advice += '<p>カロリーが高めです。野菜を多く取り入れることをお勧めします。</p>';
        } else if (avgCalories < 300) {
            advice += '<p>カロリーが低めです。バランスの取れた食事を心がけましょう。</p>';
        } else {
            advice += '<p>適度なカロリー摂取ですね。この調子を続けましょう。</p>';
        }
    }
    
    // 一般的なアドバイス
    advice += '<h5>おすすめ:</h5>';
    advice += '<ul>';
    advice += '<li>1日3食、規則正しく食事をとりましょう</li>';
    advice += '<li>野菜を多く取り入れ、バランスの良い食事を心がけましょう</li>';
    advice += '<li>適度な運動も健康には大切です</li>';
    advice += '</ul>';
    
    return advice;
}