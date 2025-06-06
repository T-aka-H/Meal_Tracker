// テスト用最小app.js
console.log('app.js読み込み開始');

// グローバル変数
let supabase = null;
let currentUser = null;
let currentUserId = null;

// Supabase設定
const supabaseUrl = 'https://nhnanyzkcxlysugllpde.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5obmFueXprY3hseXN1Z2xscGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDk2MjQzNDgsImV4cCI6MjAyNTIwMDM0OH0.KqKilHHzKxXmwnDGqEDqMDGZ_E5MmGGHN-JQ9lNJVGE';

// 通知表示
function showNotification(message, type = 'success') {
    console.log(`通知: ${message} (${type})`);
    alert(message);
}

// 日付設定
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

// Supabase接続
async function connectSupabase() {
    try {
        console.log('Supabase接続テスト開始...');
        
        if (window.supabase && window.supabase.createClient) {
            supabase = window.supabase.createClient(supabaseUrl, SUPABASE_ANON_KEY);
            console.log('Supabaseクライアント作成成功');
        } else {
            throw new Error('Supabase SDKが読み込まれていません');
        }

        const response = await fetch(`${supabaseUrl}/rest/v1/users?limit=1`, {
            method: 'GET',
            headers: {
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Accept': 'application/json'
            }
        });

        console.log('接続テストレスポンス:', response.status);

        if (response.ok) {
            showNotification('Supabase接続成功!', 'success');
            console.log('✅ 接続成功');
            return true;
        } else {
            const errorText = await response.text();
            console.error('接続エラー:', errorText);
            showNotification('接続失敗: ' + errorText, 'error');
            return false;
        }
        
    } catch (error) {
        console.error('Supabase接続エラー:', error);
        showNotification('接続エラー: ' + error.message, 'error');
        return false;
    }
}

// 初期化
async function initialize() {
    console.log('アプリケーション初期化開始');
    setDefaultDateTime();
    await connectSupabase();
    console.log('初期化完了');
}

// DOMContentLoaded イベント
document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM読み込み完了');
    initialize();
});

console.log('app.js読み込み完了');