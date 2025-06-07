// 既存のコード（統計情報削除、Supabase初期化、ユーザー管理など）は変更なし

// 統計情報の削除
function forceRemoveStats() {
    const stats = document.querySelectorAll('[class*="stat"]');
    stats.forEach(stat => {
        stat.remove();
        console.log('削除した要素:', stat);
    });
}

// 統計情報の監視と削除
function startStatsRemovalWatcher() {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            if (mutation.addedNodes.length) {
                mutation.addedNodes.forEach((node) => {
                    if (node.classList && Array.from(node.classList).some(c => c.includes('stat'))) {
                        node.remove();
                        console.log('動的に追加された統計要素を削除:', node);
                    }
                });
            }
        });
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
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
    console.log('デフォルト日時を設定');
}

// Supabaseクライアントライブラリの動的ロード
async function loadSupabaseClient() {
    return new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
        script.onload = () => {
            console.log('Supabaseクライアントライブラリのロード完了');
            const checkSupabase = setInterval(() => {
                if (window.supabase) {
                    clearInterval(checkSupabase);
                    resolve();
                }
            }, 100);
            
            setTimeout(() => {
                clearInterval(checkSupabase);
                reject(new Error('Supabaseクライアントライブラリのロードがタイムアウトしました'));
            }, 10000);
        };
        script.onerror = () => {
            console.error('Supabaseクライアントライブラリのロード失敗');
            reject(new Error('Supabaseクライアントライブラリのロードに失敗しました'));
        };
        document.head.appendChild(script);
    });
}

// Supabaseの初期化
async function initializeSupabase() {
    console.log('🔄 Supabase接続開始...');
    const statusDiv = document.getElementById('connectionStatus');
    if (statusDiv) {
        statusDiv.textContent = 'データベース接続中...';
        statusDiv.className = 'status';
    }

    try {
        if (typeof window.supabase === 'undefined') {
            console.log('Supabaseライブラリを動的読み込み中...');
            await loadSupabaseClient();
        }

        const waitForCreateClient = () => {
            return new Promise((resolve, reject) => {
                const check = setInterval(() => {
                    if (window.supabase && window.supabase.createClient) {
                        clearInterval(check);
                        resolve();
                    }
                }, 100);

                setTimeout(() => {
                    clearInterval(check);
                    reject(new Error('createClient関数の待機がタイムアウトしました'));
                }, 10000);
            });
        };

        await waitForCreateClient();
        
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        console.log('✅ Supabaseクライアント作成成功');

        let testSuccess = false;
        let retryCount = 0;
        const maxRetries = 3;
        
        while (!testSuccess && retryCount < maxRetries) {
            try {
                const { data, error } = await supabaseClient
                    .from('users')
                    .select('id')
                    .limit(1);

                if (error) {
                    throw error;
                }

                console.log('📊 接続テスト成功');
                testSuccess = true;
                
                if (statusDiv) {
                    statusDiv.textContent = '✅ データベース接続完了';
                    statusDiv.className = 'status success';
                }
    } catch (error) {                retryCount++;
                console.warn(`📊 接続テスト失敗 (試行 ${retryCount}/${maxRetries}):`, error.message);
                
                if (retryCount < maxRetries) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } else {
                    throw error;
                }
            }
        }

        return true;
    } catch (error) {        console.error('❌ Supabase接続エラー:', error);
        
        if (statusDiv) {
            statusDiv.textContent = '❌ データベース接続失敗';
            statusDiv.className = 'status error';
        }
        
        showNotification('データベースへの接続に失敗しました。ページを再読み込みしてください。', 'error');
        supabaseClient = null;
        return false;
    }
}

// ユーザー一覧の読み込み
async function loadUsers() {
    console.log('ユーザー読み込み開始');
    try {
        if (!supabaseClient) {
            throw new Error('Supabaseクライアントが初期化されていません');
        }

        const { data: users, error } = await supabaseClient
            .from('users')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) throw error;

        console.log('取得したユーザー:', users);
        updateUserOptions(users);

        if (users && users.length > 0) {
            const firstUser = users[0];
            await switchUser(firstUser.id);
        }

        return true;
    } catch (error) {        console.error('ユーザー読み込みエラー:', error);
        showNotification('ユーザー情報の読み込みに失敗しました: ' + error.message, 'error');
        return false;
    }
}

// ユーザー選択肢の更新
function updateUserOptions(users) {
    console.log('ユーザー選択肢の更新開始');
    const userSelect = document.getElementById('userSelect');
    if (!userSelect) return;

    userSelect.innerHTML = '';

    users.forEach(user => {
        const option = document.createElement('option');
        option.value = user.id;
        option.textContent = user.name;
        userSelect.appendChild(option);
    });

    const newUserOption = document.createElement('option');
    newUserOption.value = 'new';
    newUserOption.textContent = '+ 新規ユーザー';
    userSelect.appendChild(newUserOption);
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
            `${SUPABASE_URL}/rest/v1/users?id=eq.${userId}`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
        
        const userDisplay = document.getElementById('currentUserName');
        if (userDisplay) {
            userDisplay.textContent = currentUser.name;
        }
        
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        const mainContent = document.getElementById('mainContent');
        if (currentUserDisplay) currentUserDisplay.style.display = 'block';
        if (mainContent) mainContent.style.display = 'block';

        console.log('ユーザー切り替え完了:', currentUser);
        
        await loadMealRecords();
        
        showNotification(`${currentUser.name}さんに切り替えました`, 'success');
        
        // AI診断機能を追加
        setTimeout(() => {
            addAIDiagnosisElements();
            addPromptEditorSection();
            addAIDiagnosisStyles();
        }, 500);
        
    } catch (error) {        console.error('ユーザー切り替えエラー:', error);
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
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
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
        
        if (nameInput) nameInput.value = '';
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {        console.error('ユーザー追加エラー:', error);
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
        const recordsResponse = await fetch(`${SUPABASE_URL}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!recordsResponse.ok) {
            const errorText = await recordsResponse.text();
            throw new Error(`記録の削除に失敗: HTTP ${recordsResponse.status}: ${errorText}`);
        }

        const userResponse = await fetch(`${SUPABASE_URL}/rest/v1/users?id=eq.${currentUserId}`, {
            method: 'DELETE',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
            }
        });

        if (!userResponse.ok) {
            const errorText = await userResponse.text();
            throw new Error(`ユーザーの削除に失敗: HTTP ${userResponse.status}: ${errorText}`);
        }

        closeModal('deleteUserModal');
        showNotification('ユーザーを削除しました', 'success');
        
        currentUser = null;
        currentUserId = null;
        const currentUserDisplay = document.getElementById('currentUserDisplay');
        const mainContent = document.getElementById('mainContent');
        if (currentUserDisplay) currentUserDisplay.style.display = 'none';
        if (mainContent) mainContent.style.display = 'none';
        
        await loadUsers();
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {        console.error('ユーザー削除エラー:', error);
        showNotification('ユーザーの削除に失敗しました', 'error');
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
                const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_records?id=eq.${id}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
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
                
    } catch (error) {                console.error('記録削除エラー:', error);
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
                const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_records?user_id=eq.${currentUserId}`, {
                    method: 'DELETE',
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
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
                
    } catch (error) {                console.error('データ削除エラー:', error);
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
            `${SUPABASE_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
        
    } catch (error) {        console.error('データダウンロードエラー:', error);
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

    window.onclick = function(event) {
        const modals = document.getElementsByClassName('modal');
        for (const modal of modals) {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        }
    };

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
        
        const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_records`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
        
    } catch (error) {        console.error('食事記録追加エラー:', error);
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
        const url = `${SUPABASE_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc`;
        console.log('APIリクエストURL:', url);

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
        
    } catch (error) {        console.error('記録読み込みエラー:', error);
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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_records?select=*&id=eq.${id}`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
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
        
    } catch (error) {        console.error('記録編集エラー:', error);
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
        const response = await fetch(`${SUPABASE_URL}/rest/v1/meal_records?id=eq.${editingId}`, {
            method: 'PATCH',
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
        const form = document.getElementById('mealForm');
        if (form) form.reset();
        setDefaultDateTime();
        const submitBtn = document.querySelector('button[type="submit"]');
        if (submitBtn) submitBtn.textContent = '📝 記録を追加';
        await loadMealRecords();
        
        setTimeout(forceRemoveStats, 100);
        
    } catch (error) {        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
}

// アプリケーションの初期化
async function initialize() {
    console.log('アプリケーション初期化開始');
    
    try {
        await loadCustomPrompt();
        
        setDefaultDateTime();
        
        forceRemoveStats();
        startStatsRemovalWatcher();
        
        setupEventListeners();
        const supabaseInitialized = await initializeSupabase();
        
        if (supabaseInitialized) {
            await loadUsers();
        }
        
        console.log('アプリケーション初期化完了');
    } catch (error) {        console.error('初期化エラー:', error);
        showNotification('アプリケーションの初期化に失敗しました: ' + error.message, 'error');
    }
}

// カスタムプロンプトの取得処理を更新
async function loadCustomPrompt() {
    try {
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template');
        if (!response.ok) {
            throw new Error('プロンプトの取得に失敗しました');
        }

        const data = await response.json();
        if (data.success && data.default_template) {
            if (!localStorage.getItem('customPromptJa')) {
                localStorage.setItem('customPromptJa', data.default_template);
            }
            const promptTextarea = document.getElementById('promptTemplate');
            if (promptTextarea && !promptTextarea.value) {
                promptTextarea.value = localStorage.getItem('customPromptJa') || data.default_template;
            }
        }
    } catch (error) {        console.error('プロンプト取得エラー:', error);
        console.warn('デフォルトプロンプトを使用します');
    }
}

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    initialize();

    const promptForm = document.getElementById('promptEditForm');
    if (promptForm) {
        loadCustomPrompt();

        promptForm.addEventListener('submit', async function(e) {
            e.preventDefault();
            const promptTemplate = document.getElementById('promptTemplate').value;
            await saveCustomPrompt(promptTemplate);
        });
    }
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
        const result = await supabaseClient
            .from('users')
            .insert([{ name: 'テストユーザー2024' }]);
        
        console.log('成功:', result);
    } catch (error) {        console.error('エラー:', error);
    }
}

// AIアドバイス機能（簡易版）
async function getAIAdvice() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc&limit=10`,
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
            throw new Error('食事記録の取得に失敗しました');
        }

        const mealRecords = await response.json();

        if (!mealRecords || mealRecords.length === 0) {
            showNotification('食事記録が見つかりません。まず食事を記録してください。', 'info');
            return;
        }

        const advice = generateSimpleAdvice(mealRecords);
        showNotification(advice, 'info');
        
    } catch (error) {        console.error('AIアドバイスエラー:', error);
        showNotification('アドバイスの取得中にエラーが発生しました。', 'error');
    }
}

// 簡易的なアドバイス生成
function generateSimpleAdvice(records) {
    const mealTypes = records.map(r => r.meal_type);
    const calories = records.filter(r => r.calories).map(r => r.calories);
    
    let advice = '📊 食事パターン分析: ';
    
    const mealTypeCount = {};
    mealTypes.forEach(type => {
        mealTypeCount[type] = (mealTypeCount[type] || 0) + 1;
    });
    
    const typeList = Object.entries(mealTypeCount).map(([type, count]) => `${type}${count}回`).join('、');
    advice += typeList;
    
    if (calories.length > 0) {
        const avgCalories = Math.round(calories.reduce((a, b) => a + b, 0) / calories.length);
        advice += ` | 平均カロリー: ${avgCalories}kcal`;
        
        if (avgCalories > 800) {
            advice += ' | 💡 カロリーが高めです。野菜を多く取り入れましょう';
        } else if (avgCalories < 300) {
            advice += ' | 💡 カロリーが低めです。バランスの取れた食事を心がけましょう';
        } else {
            advice += ' | ✅ 適度なカロリー摂取です';
        }
    }
    
    return advice;
}

console.log('app.js読み込み完了');// 食事記録アプリ - 完全版（COHERE & GEMINI AI診断機能付き + LLM選択機能）
console.log('app.js読み込み開始');

// Supabase設定
const SUPABASE_URL = 'https://nhnanyzkcxlysugllpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmFueXprY3hseXN1Z2xscGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMTA5NzMsImV4cCI6MjA2NDU4Njk3M30.Ccc7gETnFohBMROiMF8VDiAqPicrkI_ZEaNDQITwj30';

// グローバル変数
let supabaseClient = null;
let currentUser = null;
let currentUserId = null;
let editingId = null;
let allUsers = [];
let customPromptTemplate = null;
let selectedLLMProvider = 'cohere'; // デフォルトはCohere

// LLM選択機能

// 選択されたLLMプロバイダーを取得
function getSelectedLLMProvider() {
    const selectedRadio = document.querySelector('input[name="llmProvider"]:checked');
    return selectedRadio ? selectedRadio.value : 'cohere';
}

// LLMプロバイダーを設定
function setLLMProvider(provider) {
    selectedLLMProvider = provider;
    localStorage.setItem('selectedLLMProvider', provider);
    console.log(`LLMプロバイダーを${provider}に設定しました`);
}

// 保存されたLLMプロバイダーを読み込み
function loadSavedLLMProvider() {
    const saved = localStorage.getItem('selectedLLMProvider');
    if (saved) {
        selectedLLMProvider = saved;
        const radio = document.querySelector(`input[name="llmProvider"][value="${saved}"]`);
        if (radio) {
            radio.checked = true;
        }
    }
}

// AI食事診断の実行（LLM選択対応版）
async function getAIFoodDiagnosis() {
    // 診断結果セクションを表示
    const resultContainer = document.getElementById('aiDiagnosisResult');
    if (!resultContainer) {
        console.error('診断結果表示エリアが見つかりません');
        return;
    }
    resultContainer.style.display = 'block';

    // ローディング表示の制御
    const loadingSpinner = document.getElementById('diagnosisLoading');
    if (loadingSpinner) {
        loadingSpinner.style.display = 'inline-block';
    }

    try {
        // 選択されたLLMプロバイダーを取得
        const llmProvider = getSelectedLLMProvider();
        console.log(`選択されたLLMプロバイダー: ${llmProvider}`);

        // 診断中の表示
        const diagnosisJa = document.getElementById('diagnosisJa');
        const diagnosisEn = document.getElementById('diagnosisEn');
        
        if (diagnosisJa) diagnosisJa.textContent = `${llmProvider.toUpperCase()}で診断中...`;
        if (diagnosisEn) diagnosisEn.textContent = `Analyzing with ${llmProvider.toUpperCase()}...`;

        // 最新の食事記録を取得（過去1週間）
        const oneWeekAgo = new Date();
        oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
        
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&datetime=gte.${oneWeekAgo.toISOString()}&order=datetime.desc`,
            {
                method: 'GET',
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Accept': 'application/json'
                }
            }
        );

        if (!response.ok) {
            throw new Error('食事記録の取得に失敗しました');
        }

        const mealRecords = await response.json();

        if (!mealRecords || mealRecords.length === 0) {
            if (diagnosisJa) diagnosisJa.textContent = '食事記録が見つかりません。まず食事を記録してから診断をお試しください。';
            if (diagnosisEn) diagnosisEn.textContent = 'No meal records found. Please record some meals before requesting a diagnosis.';
            return;
        }

        // AI診断を取得（LLMプロバイダー指定）
        const diagnosis = await getAIDiagnosisFromBackend(mealRecords, llmProvider);

        // 診断結果の表示
        if (diagnosisJa) diagnosisJa.textContent = diagnosis.diagnosisJa;
        if (diagnosisEn) diagnosisEn.textContent = diagnosis.diagnosisEn;

        // 使用されたLLMプロバイダーの表示を更新
        updateLLMProviderStatus(diagnosis.llmProvider || llmProvider);

    } catch (error) {
        console.error('AI食事診断エラー:', error);
        const errorMessage = `<div class="diagnosis-error">エラー: ${error.message}</div>`;
        const errorMessageEn = `<div class="diagnosis-error">Error: ${error.message}</div>`;
        
        const diagnosisJa = document.getElementById('diagnosisJa');
        const diagnosisEn = document.getElementById('diagnosisEn');
        
        if (diagnosisJa) diagnosisJa.innerHTML = errorMessage;
        if (diagnosisEn) diagnosisEn.innerHTML = errorMessageEn;
    } finally {
        // ローディング表示を非表示に
        const loadingSpinner = document.getElementById('diagnosisLoading');
        if (loadingSpinner) {
            loadingSpinner.style.display = 'none';
        }
    }
}

// バックエンドAPIを使用して食事診断を取得（LLM選択対応版）
async function getAIDiagnosisFromBackend(mealRecords, llmProvider) {
    try {
        // カスタムプロンプトを取得
        let customPromptJa = localStorage.getItem('customPromptJa');
        let customPromptEn = localStorage.getItem('customPromptEn');

        console.log('AI診断リクエスト:', { 
            meal_records: mealRecords,
            llm_provider: llmProvider,
            custom_prompt_ja: customPromptJa,
            custom_prompt_en: customPromptEn
        });

        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/ai-diagnosis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ 
                meal_records: mealRecords,
                llm_provider: llmProvider,  // 新規追加
                custom_prompt_ja: customPromptJa,
                custom_prompt_en: customPromptEn
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`APIエラー: ${response.status} \nレスポンス: ${errorText}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'AI診断に失敗しました');
        }

        return {
            diagnosisJa: data.diagnosis_ja,
            diagnosisEn: data.diagnosis_en,
            llmProvider: data.llm_provider
        };
    } catch (error) {        console.error('バックエンドAPI呼び出しエラー:', error);
        throw new Error(`AI診断サービスへの接続に失敗しました: ${error.message}`);
    }
}

// LLMプロバイダーステータスの更新
function updateLLMProviderStatus(provider) {
    const statusElements = document.querySelectorAll('.llm-provider-status');
    statusElements.forEach(element => {
        element.textContent = `診断に使用: ${provider.toUpperCase()}`;
        element.className = `llm-provider-status ${provider}`;
    });
}

// Cohere接続テスト
async function testCohereConnection() {
    const testBtn = document.getElementById('testCohereBtn');
    const statusDiv = document.getElementById('cohereTestStatus');
    
    if (testBtn) testBtn.disabled = true;
    if (statusDiv) statusDiv.textContent = 'COHERE API接続テスト中...';
    
    try {
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/test-cohere', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.textContent = '✅ COHERE API接続成功: ' + data.test_response;
            showNotification('COHERE API接続テスト成功', 'success');
        } else {
            statusDiv.textContent = '❌ 接続失敗: ' + data.error;
            showNotification('COHERE API接続テスト失敗', 'error');
        }
    } catch (error) {        console.error('COHERE接続テストエラー:', error);
        statusDiv.textContent = '❌ テストエラー: ' + error.message;
        showNotification('接続テストでエラーが発生しました', 'error');
    } finally {
        if (testBtn) testBtn.disabled = false;
    }
}

// Gemini接続テスト（新規追加）
async function testGeminiConnection() {
    const testBtn = document.getElementById('testGeminiBtn');
    const statusDiv = document.getElementById('geminiTestStatus');
    
    if (testBtn) testBtn.disabled = true;
    if (statusDiv) statusDiv.textContent = 'Gemini API接続テスト中...';
    
    try {
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/test-gemini', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (data.success) {
            statusDiv.textContent = '✅ Gemini API接続成功: ' + data.test_response;
            showNotification('Gemini API接続テスト成功', 'success');
        } else {
            statusDiv.textContent = '❌ 接続失敗: ' + data.error;
            showNotification('Gemini API接続テスト失敗', 'error');
        }
    } catch (error) {        console.error('Gemini接続テストエラー:', error);
        statusDiv.textContent = '❌ テストエラー: ' + error.message;
        showNotification('接続テストでエラーが発生しました', 'error');
    } finally {
        if (testBtn) testBtn.disabled = false;
    }
}

// プロンプト編集機能

// 1. プロンプト編集モーダルを表示
async function showPromptEditorModal() {
    const modal = document.getElementById('promptEditorModal');
    const textarea = document.getElementById('promptTemplateTextarea');
    const statusDiv = document.getElementById('promptEditorStatus');
    
    if (!modal || !textarea) return;
    
    // デフォルトプロンプトを取得
    try {
        statusDiv.textContent = 'プロンプトテンプレートを読み込み中...';
        
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template');
        if (response.ok) {
            const data = await response.json();
            textarea.value = customPromptTemplate || data.default_template;
            statusDiv.textContent = '準備完了';
        } else {
            throw new Error('プロンプトテンプレートの取得に失敗しました');
        }
    } catch (error) {        console.error('プロンプト取得エラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
    }
    
    modal.style.display = 'block';
}

// 2. プロンプトを保存
async function savePromptTemplate() {
    const textarea = document.getElementById('promptTemplateTextarea');
    const statusDiv = document.getElementById('promptEditorStatus');
    
    if (!textarea) return;
    
    const promptTemplate = textarea.value.trim();
    
    if (!promptTemplate) {
        statusDiv.textContent = 'エラー: プロンプトが空です';
        return;
    }
    
    if (!promptTemplate.includes('{meal_summary}')) {
        statusDiv.textContent = 'エラー: プロンプトには {meal_summary} を含める必要があります';
        return;
    }
    
    try {
        statusDiv.textContent = '保存中...';
        
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                prompt_template: promptTemplate
            })
        });
        
        if (response.ok) {
            customPromptTemplate = promptTemplate;
            // ローカルストレージにも保存
            localStorage.setItem('customPromptJa', promptTemplate);
            
            statusDiv.textContent = '保存完了！';
            showNotification('カスタムプロンプトを保存しました', 'success');
            
            setTimeout(() => {
                closeModal('promptEditorModal');
            }, 1500);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存に失敗しました');
        }
    } catch (error) {        console.error('プロンプト保存エラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
        showNotification('プロンプトの保存に失敗しました', 'error');
    }
}

// 3. プロンプトをデフォルトに戻す
async function resetPromptTemplate() {
    const textarea = document.getElementById('promptTemplateTextarea');
    const statusDiv = document.getElementById('promptEditorStatus');
    
    if (!textarea) return;
    
    try {
        statusDiv.textContent = 'デフォルトプロンプトを読み込み中...';
        
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template');
        if (response.ok) {
            const data = await response.json();
            textarea.value = data.default_template;
            customPromptTemplate = null;
            // ローカルストレージからも削除
            localStorage.removeItem('customPromptJa');
            
            statusDiv.textContent = 'デフォルトプロンプトに戻しました';
            showNotification('デフォルトプロンプトに戻しました', 'success');
        } else {
            throw new Error('デフォルトプロンプトの取得に失敗しました');
        }
    } catch (error) {        console.error('プロンプトリセットエラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
    }
}

// AI診断結果の表示
function showAIDiagnosisResult(diagnosis) {
    const resultContainer = document.getElementById('aiDiagnosisResult');
    if (!resultContainer) {
        console.error('AI診断結果表示エリアが見つかりません');
        return;
    }

    // 日本語とEnglishの部分を分離
    const [jaText, enText] = diagnosis.split('===English Analysis===').map(text => text.trim());

    // 診断結果を表示
    const diagnosisJa = document.getElementById('diagnosisJa');
    const diagnosisEn = document.getElementById('diagnosisEn');

    if (diagnosisJa) {
        diagnosisJa.innerHTML = formatDiagnosisForDisplay(jaText);
    }

    if (diagnosisEn) {
        diagnosisEn.innerHTML = formatDiagnosisForDisplay(enText || '');
    }

    // 結果エリアを表示
    resultContainer.style.display = 'block';

    // 結果エリアにスクロール
    resultContainer.scrollIntoView({ behavior: 'smooth' });
}

// 診断結果をHTML表示用にフォーマット
function formatDiagnosisForDisplay(diagnosis) {
    if (!diagnosis) return '';

    // 改行を<br>タグに変換
    let formatted = diagnosis.replace(/\n/g, '<br>');
    
    // 番号付きリストを検出してスタイリング
    formatted = formatted.replace(/(\d+\.\s)/g, '<strong>$1</strong>');
    
    // 重要なキーワードを強調
    const keywords = ['栄養バランス', 'カロリー', 'タンパク質', '炭水化物', 'ビタミン', 'ミネラル', '改善', '推奨', 'アドバイス'];
    keywords.forEach(keyword => {
        const regex = new RegExp(`(${keyword})`, 'gi');
        formatted = formatted.replace(regex, '<span class="highlight">$1</span>');
    });
    
    return formatted;
}

// HTML要素の追加（修正版 - LLM選択UI含む）
function addAIDiagnosisElements() {
    // 既にAI診断ボタンが存在する場合は追加しない
    if (document.getElementById('aiDiagnosisBtn')) {
        return;
    }

    // メインコンテンツエリアを取得
    const mainContent = document.getElementById('mainContent');
    if (!mainContent) {
        console.error('mainContent要素が見つかりません');
        return;
    }

    // 既存のAI診断セクションを取得
    const aiDiagnosisSection = mainContent.querySelector('.ai-diagnosis-section');
    if (!aiDiagnosisSection) {
        console.error('ai-diagnosis-section要素が見つかりません');
        return;
    }

    // AI診断コントロールを追加
    const aiControls = aiDiagnosisSection.querySelector('.ai-controls');
    if (!aiControls) {
        console.error('ai-controls要素が見つかりません');
        return;
    }

    // エンジン選択部分を更新
    const engineSelection = aiControls.querySelector('.engine-selection');
    if (engineSelection) {
        const radioGroup = engineSelection.querySelector('.radio-group');
        if (radioGroup) {
            radioGroup.innerHTML = `
                <label><input type="radio" name="llmProvider" value="cohere" checked onchange="setLLMProvider('cohere')"> Cohere</label>
                <label><input type="radio" name="llmProvider" value="gemini" onchange="setLLMProvider('gemini')"> Gemini</label>
            `;
        }
    }

    // ボタングループを更新
    const btnGroup = aiControls.querySelector('.ai-btn-group');
    if (btnGroup) {
        btnGroup.innerHTML = `
            <button id="aiDiagnosisBtn" onclick="getAIFoodDiagnosis()" class="btn btn-primary">
                🔍 AI診断を実行
                <span id="diagnosisLoading" class="loading" style="display: none;"></span>
            </button>
            <button onclick="showPromptEditorModal()" class="btn btn-secondary">
                ✏️ プロンプト編集
            </button>
            <button id="testCohereBtn" onclick="testCohereConnection()" class="btn btn-secondary">
                🔗 Cohereテスト
            </button>
            <button id="testGeminiBtn" onclick="testGeminiConnection()" class="btn btn-secondary">
                🔗 Geminiテスト
            </button>
        `;
    }

    // テストステータス表示エリアを更新
    const testStatus = aiControls.querySelector('.test-status');
    if (testStatus) {
        testStatus.innerHTML = `
            <div id="cohereTestStatus"></div>
            <div id="geminiTestStatus"></div>
        `;
    }

    // 保存されたLLMプロバイダーを読み込み
    loadSavedLLMProvider();
}

// プロンプト編集機能をページ下部に追加
function addPromptEditorSection() {
    const body = document.body;
    if (!document.getElementById('promptEditorModal')) {
        const promptEditorHTML = `
            <!-- プロンプト編集モーダル -->
            <div id="promptEditorModal" class="modal">
                <div class="modal-content" style="max-width: 800px; width: 95%;">
                    <h3>🎯 AI診断プロンプト編集</h3>
                    <div style="margin-bottom: 15px;">
                        <p style="color: #6b7280; font-size: 0.9em;">
                            AI診断で使用するプロンプトをカスタマイズできます。<br>
                            <strong>{meal_summary}</strong> の部分に実際の食事記録が挿入されます。
                        </p>
                        <div id="promptEditorStatus" style="color: #059669; font-size: 0.9em; margin-top: 5px;">
                            準備中...
                        </div>
                    </div>
                    <div style="margin-bottom: 20px;">
                        <label for="promptTemplateTextarea" style="display: block; margin-bottom: 8px; font-weight: 500;">
                            プロンプトテンプレート:
                        </label>
                        <textarea 
                            id="promptTemplateTextarea" 
                            rows="15" 
                            style="width: 100%; padding: 12px; border: 1px solid #d1d5db; border-radius: 6px; font-family: monospace; font-size: 14px; line-height: 1.4;"
                            placeholder="プロンプトテンプレートを入力してください..."
                        ></textarea>
                    </div>
                    <div class="modal-actions">
                        <button onclick="savePromptTemplate()" class="btn btn-primary">
                            💾 保存
                        </button>
                        <button onclick="resetPromptTemplate()" class="btn btn-secondary">
                            🔄 デフォルトに戻す
                        </button>
                        <button onclick="closeModal('promptEditorModal')" class="btn btn-secondary">
                            ❌ キャンセル
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        body.insertAdjacentHTML('beforeend', promptEditorHTML);
    }
}

// CSS追加（LLM選択用スタイル追加）
function addAIDiagnosisStyles() {
    const style = document.createElement('style');
    style.textContent = `
        .ai-diagnosis-container {
            background: white;
            border-radius: 12px;
            padding: 20px;
            box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
            border-left: 4px solid #10b981;
        }
        
        .ai-diagnosis-container h4 {
            color: #1f2937;
            margin-bottom: 15px;
            font-size: 1.2em;
        }
        
        .diagnosis-content {
            background: #f9fafb;
            padding: 15px;
            border-radius: 8px;
            margin-bottom: 15px;
        }
        
        .diagnosis-text {
            line-height: 1.6;
            color: #374151;
        }
        
        .highlight {
            background: #fef3c7;
            color: #92400e;
            padding: 1px 3px;
            border-radius: 3px;
            font-weight: 500;
        }
        
        .diagnosis-footer {
            text-align: center;
            color: #9ca3af;
            font-style: italic;
        }
        
        .loading-spinner {
            display: inline-block;
            width: 16px;
            height: 16px;
            border: 2px solid #f3f3f3;
            border-top: 2px solid #3b82f6;
            border-radius: 50%;
            animation: spin 1s linear infinite;
            margin-left: 8px;
        }
        
        .btn {
            padding: 8px 16px;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            transition: all 0.2s ease;
            display: inline-flex;
            align-items: center;
            gap: 6px;
        }
        
        .btn-primary {
            background: #3b82f6;
            color: white;
        }
        
        .btn-primary:hover {
            background: #2563eb;
        }
        
        .btn-secondary {
            background: #f3f4f6;
            color: #374151;
            border: 1px solid #d1d5db;
        }
        
        .btn-secondary:hover {
            background: #e5e7eb;
        }
        
        .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
        }
        
        /* LLM選択関連のスタイル */
        .llm-option input[type="radio"]:checked + label {
            border-color: #3b82f6;
            background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
            color: white;
            transform: translateY(-2px);
            box-shadow: 0 5px 15px rgba(59, 130, 246, 0.3);
        }
        
        .llm-option input[type="radio"]:checked + label .llm-brand,
        .llm-option input[type="radio"]:checked + label .llm-description {
            color: white;
            opacity: 1;
        }
        
        .llm-provider-status {
            padding: 4px 8px;
            border-radius: 4px;
            font-size: 0.8em;
            font-weight: 500;
            margin-left: 10px;
        }
        
        .llm-provider-status.cohere {
            background: #dbeafe;
            color: #1e40af;
        }
        
        .llm-provider-status.gemini {
            background: #d1fae5;
            color: #065f46;
        }
        
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        
        /* プロンプト編集モーダル専用スタイル */
        #promptEditorModal .modal-content {
            max-height: 90vh;
            overflow-y: auto;
        }
        
        #promptTemplateTextarea {
            resize: vertical;
            min-height: 300px;
        }
        
        #promptEditorStatus {
            padding: 8px;
            border-radius: 4px;
            background: #f0fdf4;
            border: 1px solid #bbf7d0;
        }
        
        .modal-actions {
            display: flex;
            gap: 10px;
            justify-content: flex-end;
            flex-wrap: wrap;
        }
        
        @media (max-width: 768px) {
            .modal-actions {
                flex-direction: column;
            }
            
            .btn {
                justify-content: center;
            }
            
            .llm-options {
                grid-template-columns: 1fr;
            }
        }
    `;
    document.head.appendChild(style);
}