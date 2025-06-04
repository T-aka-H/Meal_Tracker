// グローバル変数
let supabase = null;
let currentUser = null;
let currentUserId = null;
let editingId = null;
let allUsers = [];

// Supabaseクライアントのシングルトンインスタンス
let supabaseInstance = null;

// プロキシサーバーのURL（環境に応じて変更）
// 1. プロキシURLの修正
const PROXY_URL = location.hostname === 'localhost' 
    ? 'http://localhost:8080'
    : 'https://meal-tracker-1-y2dy.onrender.com';  // 新しいプロキシサーバーURL

// 2. 食事記録の更新（プロキシ対応版に修正）
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
        await Promise.all([
            loadMealRecords(),
            updateUserStats()
        ]);
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// 3. 記録の編集（プロキシ対応版に修正）
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
        const record = data[0]; // 配列の最初の要素を取得
        
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

// 4. 記録の削除（プロキシ対応版に修正）
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
            await Promise.all([
                loadMealRecords(),
                updateUserStats()
            ]);
            
        } catch (error) {
            console.error('記録削除エラー:', error);
            showNotification('記録の削除に失敗しました', 'error');
        }
    };
}

// 5. ユーザーデータの削除（プロキシ対応版に修正）
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
            await Promise.all([
                loadMealRecords(),
                updateUserStats()
            ]);
            
        } catch (error) {
            console.error('データ削除エラー:', error);
            showNotification('データの削除に失敗しました', 'error');
        }
    };
}

// 6. データダウンロード機能もプロキシ対応版に修正（必要に応じて）
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

// 初期化
document.addEventListener('DOMContentLoaded', function() {
    loadSupabaseConfig();
    setDefaultDateTime();
    
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

        console.log('Supabaseクライアント作成完了'); // デバッグ用

        // 最小限の接続テスト - セッションチェックのみ
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
            throw new Error('認証エラー: ' + sessionError.message);
        }

        console.log('認証チェック完了'); // デバッグ用

        updateConnectionStatus(true);
        document.getElementById('setupSection').style.display = 'none';
        document.getElementById('userSection').style.display = 'block';
        await loadUsers();
        showNotification('Supabaseに接続しました！', 'success');
        
        // 設定を保存
        localStorage.setItem('supabaseUrl', url);
        localStorage.setItem('supabaseKey', key);
        
    } catch (error) {
        console.error('Supabase接続エラー:', error);
        const errorMessage = error.message || error.error_description || 'Unknown error';
        showNotification('接続に失敗しました: ' + errorMessage, 'error');
        updateConnectionStatus(false);
        
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
        
        const response = await fetch('http://localhost:8080/rest/v1/users?limit=1', {
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

        // レスポンスのContent-Typeをチェック
        const contentType = response.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
            const text = await response.text();
            console.error('Invalid response type:', contentType);
            console.error('Response text:', text);
            throw new Error(`Invalid response type: ${contentType}. Expected JSON.`);
        }

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
}

// ユーザーの切り替え
async function switchUser() {
    const userId = document.getElementById('userSelect').value;
    if (!userId) {
        currentUser = null;
        currentUserId = null;
        document.getElementById('mainContent').style.display = 'none';
        document.getElementById('currentUserDisplay').style.display = 'none';
        document.getElementById('userStats').style.display = 'none';
        return;
    }
    
    currentUserId = parseInt(userId);
    currentUser = allUsers.find(u => u.id === currentUserId);
    
    if (currentUser) {
        document.getElementById('mainContent').style.display = 'block';
        document.getElementById('currentUserDisplay').style.display = 'block';
        document.getElementById('currentUserName').textContent = currentUser.name;
        document.getElementById('userStats').style.display = 'block';
        
        localStorage.setItem('lastUserId', currentUserId);
        
        await Promise.all([
            loadMealRecords(),
            updateUserStats()
        ]);
    }
}

// ユーザー追加モーダルの表示
function showAddUserModal() {
    document.getElementById('addUserModal').style.display = 'block';
    document.getElementById('newUserName').value = '';
    document.getElementById('newUserName').focus();
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
    
    try {
        console.log('食事記録追加開始:', record);
        
        const response = await fetch(`${PROXY_URL}/rest/v1/meal_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': getSupabaseKey(),
                'Authorization': `Bearer ${getSupabaseKey()}`,
                'Accept': 'application/json',
                'prefer': 'return=minimal'
            },
            body: JSON.stringify({
                ...record,
                user_id: currentUserId
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        showNotification('記録を追加しました', 'success');
        document.getElementById('mealForm').reset();
        setDefaultDateTime();
        await Promise.all([
            loadMealRecords(),
            updateUserStats()
        ]);
        
    } catch (error) {
        console.error('食事記録追加エラー:', error);
        showNotification('記録の追加に失敗しました', 'error');
    }
}

// 食事記録の更新
async function updateMealRecord() {
    if (!editingId) return;
    
    const record = getMealFormData();
    const loadingSpinner = document.getElementById('addLoading');
    loadingSpinner.style.display = 'inline-block';
    
    try {
        const { error } = await supabase
            .from('meal_records')
            .update(record)
            .eq('id', editingId);
        
        if (error) throw error;
        
        showNotification('記録を更新しました', 'success');
        editingId = null;
        document.getElementById('mealForm').reset();
        setDefaultDateTime();
        document.querySelector('button[type="submit"]').textContent = '📝 記録を追加';
        await Promise.all([
            loadMealRecords(),
            updateUserStats()
        ]);
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
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
        console.log('食事記録読み込み開始');
        
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

        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Response error:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = await response.json();
        console.log('食事記録読み込み成功:', data);
        
        displayMealRecords(data);
        
    } catch (error) {
        console.error('食事記録読み込みエラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 食事記録の表示
function displayMealRecords(records) {
    const recordsList = document.getElementById('recordsList');
    
    if (!records || records.length === 0) {
        recordsList.innerHTML = '<div class="empty-state">記録がありません</div>';
        return;
    }
    
    recordsList.innerHTML = records.map(record => `
        <div class="record-item">
            <div class="record-header">
                <div class="record-date">
                    ${new Date(record.datetime).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
                <div class="record-actions">
                    <button onclick="editRecord(${record.id})" class="btn btn-edit">✏️ 編集</button>
                    <button onclick="deleteRecord(${record.id})" class="btn btn-danger">🗑️ 削除</button>
                </div>
            </div>
            <div class="record-details">
                <div class="record-field">
                    <strong>食事タイプ</strong>
                    ${record.meal_type}
                </div>
                <div class="record-field">
                    <strong>料理名</strong>
                    ${record.food_name}
                </div>
                ${record.calories ? `
                <div class="record-field">
                    <strong>カロリー</strong>
                    ${record.calories} kcal
                </div>
                ` : ''}
                ${record.location ? `
                <div class="record-field">
                    <strong>場所</strong>
                    ${record.location}
                </div>
                ` : ''}
            </div>
            ${record.notes ? `
            <div class="record-field">
                <strong>メモ</strong>
                ${record.notes}
            </div>
            ` : ''}
        </div>
    `).join('');
}

// 記録の編集
async function editRecord(id) {
    try {
        const { data, error } = await supabase
            .from('meal_records')
            .select('*')
            .eq('id', id)
            .single();
        
        if (error) throw error;
        
        const datetime = new Date(data.datetime);
        document.getElementById('date').value = datetime.toISOString().split('T')[0];
        document.getElementById('time').value = datetime.toTimeString().slice(0, 5);
        document.getElementById('mealType').value = data.meal_type;
        document.getElementById('foodName').value = data.food_name;
        document.getElementById('calories').value = data.calories || '';
        document.getElementById('location').value = data.location || '';
        document.getElementById('notes').value = data.notes || '';
        
        editingId = id;
        document.querySelector('button[type="submit"]').textContent = '✏️ 記録を更新';
        window.scrollTo({ top: 0, behavior: 'smooth' });
        
    } catch (error) {
        console.error('記録編集エラー:', error);
        showNotification('記録の読み込みに失敗しました', 'error');
    }
}

// 記録の削除
function deleteRecord(id) {
    document.getElementById('confirmModal').style.display = 'block';
    document.getElementById('confirmMessage').textContent = 'この記録を削除してもよろしいですか？';
    
    const confirmBtn = document.getElementById('confirmBtn');
    confirmBtn.onclick = async () => {
        try {
            const { error } = await supabase
                .from('meal_records')
                .delete()
                .eq('id', id);
            
            if (error) throw error;
            
            closeModal('confirmModal');
            showNotification('記録を削除しました', 'success');
            await Promise.all([
                loadMealRecords(),
                updateUserStats()
            ]);
            
        } catch (error) {
            console.error('記録削除エラー:', error);
            showNotification('記録の削除に失敗しました', 'error');
        }
    };
}

// ユーザー統計の更新（プロキシ対応版）
async function updateUserStats() {
    if (!currentUserId) return;
    
    try {
        console.log('統計更新開始');
        
        // 最後の記録を取得
        const lastRecordResponse = await fetch(
            `${PROXY_URL}/rest/v1/meal_records?select=datetime&user_id=eq.${currentUserId}&order=datetime.desc&limit=1`,
            {
                method: 'GET',
                headers: {
                    'apikey': getSupabaseKey(),
                    'Authorization': `Bearer ${getSupabaseKey()}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!lastRecordResponse.ok) {
            throw new Error(`HTTP ${lastRecordResponse.status}`);
        }

        const lastRecords = await lastRecordResponse.json();
        const lastRecord = lastRecords[0];
        
        // 統計を表示
        document.getElementById('userLastMeal').textContent = lastRecord
            ? new Date(lastRecord.datetime).toLocaleDateString('ja-JP')
            : '-';
        
        console.log('統計更新完了');
        
    } catch (error) {
        console.error('統計更新エラー:', error);
        document.getElementById('userLastMeal').textContent = '-';
    }
}

// ユーザーデータのダウンロード
async function downloadUserData() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('meal_records')
            .select('*')
            .eq('user_id', currentUserId)
            .order('datetime', { ascending: false });
        
        if (error) throw error;
        
        const csvContent = convertToCSV(data);
        downloadCSV(csvContent, `meal_records_${currentUser.name}.csv`);
        showNotification('データをダウンロードしました', 'success');
        
    } catch (error) {
        console.error('データダウンロードエラー:', error);
        showNotification('データのダウンロードに失敗しました', 'error');
    }
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
            const { error } = await supabase
                .from('meal_records')
                .delete()
                .eq('user_id', currentUserId);
            
            if (error) throw error;
            
            closeModal('confirmModal');
            showNotification('全ての記録を削除しました', 'success');
            await Promise.all([
                loadMealRecords(),
                updateUserStats()
            ]);
            
        } catch (error) {
            console.error('データ削除エラー:', error);
            showNotification('データの削除に失敗しました', 'error');
        }
    };
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
