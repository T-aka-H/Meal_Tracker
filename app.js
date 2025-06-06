// 食事記録アプリ - 完全版（COHERE AI診断機能付き + プロンプト編集機能）
console.log('app.js読み込み開始');

// グローバル変数
let supabase = null;
let currentUser = null;
let currentUserId = null;
let editingId = null;
let allUsers = [];
let customPromptTemplate = null; // カスタムプロンプト保存用

// Supabase設定（動作確認済み）
const supabaseUrl = 'https://nhnanyzkcxlysugllpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmFueXprY3hseXN1Z2xscGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDkwMTA5NzMsImV4cCI6MjA2NDU4Njk3M30.Ccc7gETnFohBMROiMF8VDiAqPicrkI_ZEaNDQITwj30';

// COHERE AI食事診断機能（バックエンドAPI経由）

// AI食事診断の実行
async function getAIFoodDiagnosis() {
    try {
        // 診断中の表示
        document.getElementById('diagnosisJa').textContent = '診断中...';
        document.getElementById('diagnosisEn').textContent = 'Analyzing...';

        const mealRecords = await loadMealRecords();
        const diagnosis = await getAIDiagnosisFromBackend(mealRecords);

        // 診断結果の表示
        document.getElementById('diagnosisJa').textContent = diagnosis.diagnosisJa;
        document.getElementById('diagnosisEn').textContent = diagnosis.diagnosisEn;
    } catch (error) {
        console.error(' AI食事診断エラー:', error);
        document.getElementById('diagnosisJa').innerHTML = `<div class="diagnosis-error">エラー: ${error.message}</div>`;
        document.getElementById('diagnosisEn').innerHTML = `<div class="diagnosis-error">Error: ${error.message}</div>`;
    }
}

// バックエンドAPIを使用して食事診断を取得
async function getAIDiagnosisFromBackend(mealRecords) {
    try {
        const response = await fetch('https://meal-tracker-1-y2dy.onrender.com/api/ai-diagnosis', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ meal_records: mealRecords })
        });

        if (!response.ok) {
            throw new Error(`APIエラー: ${response.status} \nレスポンス: ${await response.text()}`);
        }

        const data = await response.json();
        if (!data.success) {
            throw new Error(data.error || 'AI診断に失敗しました');
        }

        return {
            diagnosisJa: data.diagnosis_ja,
            diagnosisEn: data.diagnosis_en
        };
    } catch (error) {
        console.error(' バックエンドAPI呼び出しエラー:', error);
        throw new Error(`AI診断サービスへの接続に失敗しました: ${error.message}`);
    }
}

// プロンプト編集機能

// 1. プロンプト編集モーダルを表示（156行目付近）
async function showPromptEditorModal() {
    const modal = document.getElementById('promptEditorModal');
    const textarea = document.getElementById('promptTemplateTextarea');
    const statusDiv = document.getElementById('promptEditorStatus');
    
    if (!modal || !textarea) return;
    
    // デフォルトプロンプトを取得
    try {
        statusDiv.textContent = 'プロンプトテンプレートを読み込み中...';
        
        // ★修正: Meal_Tracker-2のURLを使用
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template');
        if (response.ok) {
            const data = await response.json();
            textarea.value = customPromptTemplate || data.default_template;
            statusDiv.textContent = '準備完了';
        } else {
            throw new Error('プロンプトテンプレートの取得に失敗しました');
        }
    } catch (error) {
        console.error('プロンプト取得エラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
    }
    
    modal.style.display = 'block';
}


// 2. プロンプトを保存（195行目付近）
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
        
        // ★修正: Meal_Tracker-2のURLを使用
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
            statusDiv.textContent = '保存完了！';
            showNotification('カスタムプロンプトを保存しました', 'success');
            
            setTimeout(() => {
                closeModal('promptEditorModal');
            }, 1500);
        } else {
            const errorData = await response.json();
            throw new Error(errorData.error || '保存に失敗しました');
        }
    } catch (error) {
        console.error('プロンプト保存エラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
        showNotification('プロンプトの保存に失敗しました', 'error');
    }
}

// 3. プロンプトをデフォルトに戻す（241行目付近）
async function resetPromptTemplate() {
    const textarea = document.getElementById('promptTemplateTextarea');
    const statusDiv = document.getElementById('promptEditorStatus');
    
    if (!textarea) return;
    
    try {
        statusDiv.textContent = 'デフォルトプロンプトを読み込み中...';
        
        // ★修正: Meal_Tracker-2のURLを使用
        const response = await fetch('https://meal-tracker-2-jyq6.onrender.com/api/prompt-template');
        if (response.ok) {
            const data = await response.json();
            textarea.value = data.default_template;
            customPromptTemplate = null;
            statusDiv.textContent = 'デフォルトプロンプトに戻しました';
            showNotification('デフォルトプロンプトに戻しました', 'success');
        } else {
            throw new Error('デフォルトプロンプトの取得に失敗しました');
        }
    } catch (error) {
        console.error('プロンプトリセットエラー:', error);
        statusDiv.textContent = 'エラー: ' + error.message;
    }
}

// 4. COHERE接続テスト（265行目付近）
async function testCohereConnection() {
    const testBtn = document.getElementById('testCohereBtn');
    const statusDiv = document.getElementById('cohereTestStatus');
    
    if (testBtn) testBtn.disabled = true;
    if (statusDiv) statusDiv.textContent = 'COHERE API接続テスト中...';
    
    try {
        // ★修正: Meal_Tracker-2のURLを使用
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
    } catch (error) {
        console.error('COHERE接続テストエラー:', error);
        statusDiv.textContent = '❌ テストエラー: ' + error.message;
        showNotification('接続テストでエラーが発生しました', 'error');
    } finally {
        if (testBtn) testBtn.disabled = false;
    }
}

// AI診断結果の表示
function showAIDiagnosisResult(diagnosis) {
    const resultContainer = document.getElementById('aiDiagnosisResult');
    if (!resultContainer) {
        console.error('AI診断結果表示エリアが見つかりません');
        return;
    }

    // 診断結果をHTMLに整形
    const formattedDiagnosis = formatDiagnosisForDisplay(diagnosis);
    
    const promptStatus = customPromptTemplate ? 
        '<span style="color: #059669;">📝 カスタムプロンプト使用</span>' : 
        '<span style="color: #6b7280;">📄 デフォルトプロンプト使用</span>';
    
    resultContainer.innerHTML = `
        <div class="ai-diagnosis-container">
            <h4>🤖 AI食事診断結果</h4>
            <div style="text-align: right; font-size: 0.8em; margin-bottom: 10px;">
                ${promptStatus}
            </div>
            <div class="diagnosis-content">
                ${formattedDiagnosis}
            </div>
            <div class="diagnosis-footer">
                <small>※ この診断は参考情報です。詳細な栄養指導については専門家にご相談ください。</small>
            </div>
        </div>
    `;

    // 結果エリアにスクロール
    resultContainer.scrollIntoView({ behavior: 'smooth' });
}

// 診断結果をHTML表示用にフォーマット
function formatDiagnosisForDisplay(diagnosis) {
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
    
    return `<div class="diagnosis-text">${formatted}</div>`;
}

// HTML要素の追加（既存のHTMLに追加）
function addAIDiagnosisElements() {
    // AI診断ボタンを記録セクションに追加
    const recordsSection = document.querySelector('.records-section');
    if (recordsSection && !document.getElementById('aiDiagnosisBtn')) {
        const aiDiagnosisButton = document.createElement('div');
        aiDiagnosisButton.innerHTML = `
            <div class="ai-diagnosis-section" style="margin-top: 20px; padding: 15px; background: #f0f8ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <h4 style="color: #1f2937; margin-bottom: 10px;">🤖 AI食事診断</h4>
                <p style="color: #6b7280; font-size: 0.9em; margin-bottom: 15px;">
                    過去1週間の食事記録を基に、AIが栄養バランスとアドバイスを提供します
                </p>
                <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                    <button id="aiDiagnosisBtn" onclick="getAIFoodDiagnosis()" class="btn btn-primary">
                        🔍 AI診断を実行
                        <span id="aiDiagnosisLoading" style="display: none;" class="loading-spinner"></span>
                    </button>
                    <button onclick="showPromptEditorModal()" class="btn btn-secondary">
                        ✏️ プロンプト編集
                    </button>
                    <button id="testCohereBtn" onclick="testCohereConnection()" class="btn btn-secondary">
                        🔗 接続テスト
                    </button>
                </div>
                <div id="cohereTestStatus" style="margin-top: 10px; font-size: 0.9em; color: #6b7280;"></div>
            </div>
            
            <!-- AI診断結果表示エリア -->
            <div id="aiDiagnosisResult" style="margin-top: 20px;"></div>
        `;
        
        recordsSection.appendChild(aiDiagnosisButton);
    }
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

// CSS追加
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
        }
    `;
    document.head.appendChild(style);
}

// 初期化時にAI診断機能を追加
function initializeAIDiagnosis() {
    // DOM読み込み完了後に要素を追加
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            setTimeout(() => {
                addAIDiagnosisElements();
                addPromptEditorSection();
                addAIDiagnosisStyles();
            }, 1000);
        });
    } else {
        setTimeout(() => {
            addAIDiagnosisElements();
            addPromptEditorSection();
            addAIDiagnosisStyles();
        }, 1000);
    }
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
    console.log('デフォルト日時を設定');
}

// Supabaseへの接続
async function connectSupabase() {
    try {
        console.log('🔄 Supabase接続開始...');
        
        if (window.supabase && window.supabase.createClient) {
            supabase = window.supabase.createClient(supabaseUrl, SUPABASE_ANON_KEY);
            console.log('✅ Supabaseクライアント作成成功');
        } else {
            throw new Error('Supabase SDKが読み込まれていません');
        }

        // 接続テスト
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
            throw new Error(`接続テストに失敗: ${response.status} - ${errorText}`);
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
        
        // AI診断機能を追加
        setTimeout(() => {
            addAIDiagnosisElements();
            addPromptEditorSection();
            addAIDiagnosisStyles();
        }, 500);
        
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
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
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
        
    } catch (error) {
        console.error('記録更新エラー:', error);
        showNotification('記録の更新に失敗しました', 'error');
    } finally {
        if (loadingSpinner) loadingSpinner.style.display = 'none';
    }
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
    
    // AI診断機能を初期化
    initializeAIDiagnosis();
    
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

// AIアドバイス機能（簡易版）
async function getAIAdvice() {
    if (!currentUserId) {
        showNotification('ユーザーを選択してください', 'error');
        return;
    }

    try {
        // 最新の食事記録を取得
        const response = await fetch(
            `${supabaseUrl}/rest/v1/meal_records?select=*&user_id=eq.${currentUserId}&order=datetime.desc&limit=10`,
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

        // 簡易的なアドバイス生成
        const advice = generateSimpleAdvice(mealRecords);
        showNotification(advice, 'info');
        
    } catch (error) {
        console.error('AIアドバイスエラー:', error);
        showNotification('アドバイスの取得中にエラーが発生しました。', 'error');
    }
}

// 簡易的なアドバイス生成
function generateSimpleAdvice(records) {
    const mealTypes = records.map(r => r.meal_type);
    const calories = records.filter(r => r.calories).map(r => r.calories);
    
    let advice = '📊 食事パターン分析: ';
    
    // 食事回数の分析
    const mealTypeCount = {};
    mealTypes.forEach(type => {
        mealTypeCount[type] = (mealTypeCount[type] || 0) + 1;
    });
    
    const typeList = Object.entries(mealTypeCount).map(([type, count]) => `${type}${count}回`).join('、');
    advice += typeList;
    
    // カロリー分析
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

console.log('app.js読み込み完了');