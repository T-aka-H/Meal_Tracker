-- ユーザーテーブル
create table users (
    id bigint primary key generated always as identity,
    name text not null,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 食事記録テーブル
create table meal_records (
    id bigint primary key generated always as identity,
    user_id bigint references users(id) on delete cascade not null,
    datetime timestamp with time zone not null,
    meal_type text not null,
    food_name text not null,
    calories integer,
    location text,
    notes text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 更新日時を自動的に設定するトリガー
create or replace function update_updated_at_column()
returns trigger as $$
begin
    new.updated_at = timezone('utc'::text, now());
    return new;
end;
$$ language plpgsql;

create trigger update_meal_records_updated_at
    before update on meal_records
    for each row
    execute function update_updated_at_column();

-- RLSポリシーの設定
alter table users enable row level security;
alter table meal_records enable row level security;

-- 匿名ユーザーに全ての操作を許可（デモ用）
create policy "Enable anonymous access to users"
    on users for all
    to anon
    using (true)
    with check (true);

create policy "Enable anonymous access to meal_records"
    on meal_records for all
    to anon
    using (true)
    with check (true);

-- インデックスの作成
create index meal_records_user_id_idx on meal_records(user_id);
create index meal_records_datetime_idx on meal_records(datetime);
create index meal_records_meal_type_idx on meal_records(meal_type);

-- 基本的な統計を取得するビューの作成
create or replace view user_stats as
select
    u.id as user_id,
    u.name as user_name,
    count(m.id) as total_records,
    count(m.id) filter (where m.datetime >= date_trunc('week', now())) as records_this_week,
    round(avg(m.calories) filter (where m.calories is not null))::integer as avg_calories,
    max(m.datetime) as last_meal_datetime
from users u
left join meal_records m on u.id = m.user_id
group by u.id, u.name; 